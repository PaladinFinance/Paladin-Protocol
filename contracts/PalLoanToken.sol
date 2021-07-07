//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "./PalLoanTokenInterface.sol";
import "./utils/ERC165.sol";
import "./utils/SafeMath.sol";
import "./utils/Admin.sol";
import "./PaladinControllerInterface.sol";
import "./BurnedPalLoanToken.sol";
import {Errors} from  "./utils/Errors.sol";

/** @title palLoanToken contract  */
/// @author Paladin
contract PalLoanToken is PalLoanTokenInterface, ERC165, Admin {
    using SafeMath for uint;

    //Storage

    // Token name
    string public name;

    // Token symbol
    string public symbol;

    //Incremental index for next token ID
    uint256 private index;

    // Mapping from token ID to owner address
    mapping(uint256 => address) private owners;

    // Mapping owner address to token count
    mapping(address => uint256) private balances;

    // Mapping from token ID to approved address
    mapping(uint256 => address) private approvals;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private operatorApprovals;

    // Paladin controller
    PaladinControllerInterface public controller;

    // Burned Token contract
    BurnedPalLoanToken public burnedToken;

    // Mapping from token ID to origin PalPool
    mapping(uint256 => address) private pools;

    // Mapping from token ID to PalLoan address
    mapping(uint256 => address) private loans;




    //Modifiers
    modifier controllerOnly() {
        //allows only the Controller and the admin to call the function
        require(msg.sender == admin || msg.sender == address(controller), Errors.CALLER_NOT_CONTROLLER);
        _;
    }

    modifier poolsOnly() {
        //allows only a PalPool listed in the Controller
        require(controller.isPalPool(msg.sender), Errors.CALLER_NOT_ALLOWED_POOL);
        _;
    }



    //Constructor
    constructor(address _controller) {
        admin = msg.sender;

        // ERC721 parameters + storage data
        name = "PalLoan Token";
        symbol = "PLT";
        controller = PaladinControllerInterface(_controller);
        index = 0;

        //Create the Burned version of this ERC721
        burnedToken = new BurnedPalLoanToken("burnedPalLoan Token", "bPLT");
    }


    //Functions

    //Required ERC165 function
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IERC721).interfaceId ||
            super.supportsInterface(interfaceId);
    }



    /**
    * @notice Return the user balance (total number of token owned)
    * @param owner Address of the user
    * @return uint256 : number of token owned (in this contract only)
    */
    function balanceOf(address owner) external view override returns (uint256) {
        require(owner != address(0), "ERC721: balance query for the zero address");
        return balances[owner];
    }


    /**
    * @notice Return owner of the token
    * @param tokenId Id of the token
    * @return address : owner address
    */
    function ownerOf(uint256 tokenId) public view override returns (address) {
        address owner = owners[tokenId];
        require(owner != address(0), "ERC721: owner query for nonexistent token");
        return owner;
    }


    /**
    * @notice Return owner of the token, even is the token was burned 
    * @dev Check if the given id has an owner in this contract, and then if it was burned and has an owner
    * @param tokenId Id of the token
    * @return address : address of the owner
    */
    function allOwnerOf(uint256 tokenId) external view override returns (address) {
        require(tokenId < index, "ERC721: owner query for nonexistent token");
        return owners[tokenId] != address(0) ? owners[tokenId] : burnedToken.ownerOf(tokenId);
    }


    /**
    * @notice Return the address of the palLoan for this token
    * @param tokenId Id of the token
    * @return address : address of the palLoan
    */
    function loanOf(uint256 tokenId) external view override returns(address){
        return loans[tokenId];
    }


    /**
    * @notice Return the palPool that issued this token
    * @param tokenId Id of the token
    * @return address : address of the palPool
    */
    function poolOf(uint256 tokenId) external view override returns(address){
        return pools[tokenId];
    }

    
    /**
    * @notice Return the list of all active palLoans owned by the user
    * @dev Find all the token owned by the user, and return the list of palLoans linked to the found tokens
    * @param owner User address
    * @return address[] : list of owned active palLoans
    */
    function loansOf(address owner) external view override returns(address[] memory){
        require(index > 0);
        uint256 tokenCount = balances[owner];
        uint256 j = 0;
        address[] memory result = new address[](tokenCount);
        for(uint256 id = 0; id < index; id++){
            if(owners[id] == owner){
                result[j] = loans[id];
                j++;
            }   
        }
        return result;
    }


    /**
    * @notice Return the list of all tokens owned by the user
    * @dev Find all the token owned by the user
    * @param owner User address
    * @return uint256[] : list of owned tokens
    */
    function tokensOf(address owner) external view override returns(uint256[] memory){
        require(index > 0);
        uint256 tokenCount = balances[owner];
        uint256 j = 0;
        uint256[] memory result = new uint256[](tokenCount);
        for(uint256 id = 0; id < index; id++){
            if(owners[id] == owner){
                result[j] = id;
                j++;
            }   
        }
        return result;
    }


    /**
    * @notice Return the list of all active palLoans owned by the user for the given palPool
    * @dev Find all the token owned by the user issued by the given Pool, and return the list of palLoans linked to the found tokens
    * @param owner User address
    * @return address[] : list of owned active palLoans for the given palPool
    */
    function loansOfForPool(address owner, address palPool) external view override returns(address[] memory){
        require(index > 0);
        uint256 tokenCount = balances[owner];
        uint256 j = 0;
        //go through all the id to find the ones for the owner, from the given pool
        address[] memory result = new address[](tokenCount);
        for(uint256 id = 0; id < index; id++){
            if(owners[id] == owner && pools[id] == palPool){
                result[j] = loans[id];
                j++;
            }   
        }

        //put the result in a new array with correct size to avoid 0x00 addresses in the return array
        address[] memory filteredResult = new address[](j);
        for(uint256 i = 0; i < j; i++){
            filteredResult[i] = result[i];   
        }

        return filteredResult;
    }


    /**
    * @notice Return the list of all tokens owned by the user
    * @dev Find all the token owned by the user (in this contract and in the Burned contract)
    * @param owner User address
    * @return uint256[] : list of owned tokens
    */
    function allTokensOf(address owner) external view override returns(uint256[] memory){
        require(index > 0);
        uint256 tokenCount = balances[owner].add(burnedToken.balanceOf(owner));
        uint256 j = 0;
        uint256[] memory result = new uint256[](tokenCount);
        for(uint256 id = 0; id < index; id++){
            if(owners[id] == owner){
                result[j] = id;
                j++;
            }   
        }

        //get the burned Tokens for the owner and add them to the array
        uint256[] memory burnedTokens = burnedToken.tokensOf(owner);
        for(uint256 i = j; i < tokenCount; i++){
            result[i] = burnedTokens[i.sub(j)];
        }

        return result;
    }


    /**
    * @notice Return the list of all palLoans (active and closed) owned by the user
    * @dev Find all the token owned by the user, and all the burned tokens owned by the user,
    * and return the list of palLoans linked to the found tokens
    * @param owner User address
    * @return address[] : list of owned palLoans
    */
    function allLoansOf(address owner) external view override returns(address[] memory){
        require(index > 0);
        uint256 tokenCount = balances[owner].add(burnedToken.balanceOf(owner));
        uint256 j = 0;
        //go through all the id to find the ones for the owner, from the given pool
        address[] memory result = new address[](tokenCount);
        for(uint256 id = 0; id < index; id++){
            if(owners[id] == owner){
                result[j] = loans[id];
                j++;
            }   
        }

        //get the burned Tokens for the owner and add them to the array
        uint256[] memory burnedTokens = burnedToken.tokensOf(owner);
        for(uint256 i = j; i < tokenCount; i++){
            result[i] = loans[burnedTokens[i.sub(j)]];
        }

        return result;
    }


    /**
    * @notice Return the list of all palLoans owned by the user for the given palPool
    * @dev Find all the token owned by the user issued by the given Pool, and return the list of palLoans linked to the found tokens
    * @param owner User address
    * @return address[] : list of owned palLoans (active & closed) for the given palPool
    */
    function allLoansOfForPool(address owner, address palPool) external view override returns(address[] memory){
        require(index > 0);
        uint256 tokenCount = balances[owner].add(burnedToken.balanceOf(owner));
        uint256 j = 0;
        //go through all the id to find the ones for the owner, from the given pool
        address[] memory result = new address[](tokenCount);
        for(uint256 id = 0; id < index; id++){
            if(owners[id] == owner && pools[id] == palPool){
                result[j] = loans[id];
                j++;
            }   
        }

        //get the burned Tokens for the owner and add them to the array
        uint256[] memory burnedTokens = burnedToken.tokensOf(owner);
        for(uint256 i = 0; i < burnedTokens.length; i++){
            if(pools[burnedTokens[i]] == palPool){
                result[j] = loans[burnedTokens[i]];
                j++;
            }
        }

        //put the result in a new array with correct size to avoid 0x00 addresses in the return array
        address[] memory filteredResult = new address[](j);
        for(uint256 k = 0; k < j; k++){
            filteredResult[k] = result[k];   
        }

        return filteredResult;
    }


    /**
    * @notice Check if the token was burned
    * @param tokenId Id of the token
    * @return bool : true if burned
    */
    function isBurned(uint256 tokenId) external view override returns(bool){
        return burnedToken.ownerOf(tokenId) != address(0);
    }





    /**
    * @notice Approve the address to spend the token
    * @param to Address of the spender
    * @param tokenId Id of the token to approve
    */
    function approve(address to, uint256 tokenId) external virtual override {
        address owner = ownerOf(tokenId);
        require(to != owner, "ERC721: approval to current owner");

        require(
            msg.sender == owner || isApprovedForAll(owner, msg.sender),
            "ERC721: approve caller is not owner nor approved for all"
        );

        _approve(to, tokenId);
    }


    /**
    * @notice Return the approved address for the token
    * @param tokenId Id of the token
    * @return address : spender's address
    */
    function getApproved(uint256 tokenId) public view override returns (address) {
        require(_exists(tokenId), "ERC721: approved query for nonexistent token");

        return approvals[tokenId];
    }


    /**
    * @notice Give the operator approval on all tokens owned by the user, or remove it by setting it to false
    * @param operator Address of the operator to approve
    * @param approved Boolean : give or remove approval
    */
    function setApprovalForAll(address operator, bool approved) external virtual override {
        require(operator != msg.sender, "ERC721: approve to caller");

        operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }


    /**
    * @notice Return true if the operator is approved for the given user
    * @param owner Amount of the owner
    * @param operator Address of the operator
    * @return bool :  result
    */
    function isApprovedForAll(address owner, address operator) public view override returns (bool) {
        return operatorApprovals[owner][operator];
    }







    /**
    * @notice Transfer the token from the owner to the recipient (if allowed)
    * @param from Address of the owner
    * @param to Address of the recipient
    * @param tokenId Id of the token
    */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external virtual override {
        require(_isApprovedOrOwner(msg.sender, tokenId), "ERC721: transfer caller is not owner nor approved");

        _transfer(from, to, tokenId);
    }


    /**
    * @notice Safe transfer the token from the owner to the recipient (if allowed)
    * @param from Address of the owner
    * @param to Address of the recipient
    * @param tokenId Id of the token
    */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external virtual override {
        require(_isApprovedOrOwner(msg.sender, tokenId), "ERC721: transfer caller is not owner nor approved");
        require(_transfer(from, to, tokenId), "ERC721: transfer failed");
    }


    /**
    * @notice Safe transfer the token from the owner to the recipient (if allowed)
    * @param from Address of the owner
    * @param to Address of the recipient
    * @param tokenId Id of the token
    */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) external virtual override {
        _data;
        require(_isApprovedOrOwner(msg.sender, tokenId), "ERC721: transfer caller is not owner nor approved");
        require(_transfer(from, to, tokenId), "ERC721: transfer failed");
    }






    /**
    * @notice Mint a new token to the given address
    * @dev Mint the new token, and list it with the given palLoan and palPool
    * @param to Address of the user to mint the token to
    * @param palPool Address of the palPool issuing the token
    * @param palLoan Address of the palLoan linked to the token
    * @return uint256 : new token Id
    */
    function mint(address to, address palPool, address palLoan) external override poolsOnly returns(uint256){
        require(palLoan != address(0), Errors.ZERO_ADDRESS);

        //Call the internal mint method, and get the new token Id
        uint256 newId = _mint(to);

        //Set the correct data in mappings for this token
        loans[newId] = palLoan;
        pools[newId] = palPool;

        //Emit the Mint Event
        emit NewLoanToken(palPool, to, palLoan, newId);

        //Return the new token Id
        return newId;
    }


    /**
    * @notice Burn the given token
    * @dev Burn the token, and mint the BurnedToken for this token
    * @param tokenId Id of the token to burn
    * @return bool : success
    */
    function burn(uint256 tokenId) external override poolsOnly returns(bool){
        address owner = ownerOf(tokenId);

        require(owner != address(0), "ERC721: token nonexistant");

        //Mint the Burned version of this token
        burnedToken.mint(owner, tokenId);

        //Emit the correct event
        emit BurnLoanToken(pools[tokenId], owner, loans[tokenId], tokenId);

        //call the internal burn method
        return _burn(owner, tokenId);
    }

    

    



    /**
    * @notice Check if a token exists
    * @param tokenId Id of the token
    * @return bool : treu if token exists (active or burned)
    */
    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return owners[tokenId] != address(0) || burnedToken.ownerOf(tokenId) != address(0);
    }


    /**
    * @notice Check if the given user is approved for the given token
    * @param spender Address of the user to check
    * @param tokenId Id of the token
    * @return bool : true if approved
    */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual returns (bool) {
        require(_exists(tokenId), "ERC721: operator query for nonexistent token");
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }





    /**
    * @notice Mint the new token
    * @param to Address of the user to mint the token to
    * @return uint : Id of the new token
    */
    function _mint(address to) internal virtual returns(uint) {
        require(to != address(0), "ERC721: mint to the zero address");

        //Get the new token Id, and increase the global index
        uint tokenId = index;
        index = index.add(1);

        //Write this token in the storage
        balances[to] = balances[to].add(1);
        owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);

        //Return the new token Id
        return tokenId;
    }


    /**
    * @notice Burn the given token
    * @param owner Address of the token owner
    * @param tokenId Id of the token to burn
    * @return bool : success
    */
    function _burn(address owner, uint256 tokenId) internal virtual returns(bool) {
        //Reset the token approval
        _approve(address(0), tokenId);

        //Update data in storage
        balances[owner] = balances[owner].sub(1);
        delete owners[tokenId];

        emit Transfer(owner, address(0), tokenId);

        return true;
    }


    /**
    * @notice Transfer the token from the owner to the recipient
    * @dev Deposit underlying, and mints palToken for the user
    * @param from Address of the owner
    * @param to Address of the recipient
    * @param tokenId Id of the token
    * @return bool : success
    */
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual returns(bool) {
        require(ownerOf(tokenId) == from, "ERC721: transfer of token that is not own");
        require(to != address(0), "ERC721: transfer to the zero address");

        //Reset token approval
        _approve(address(0), tokenId);

        //Update storage data
        balances[from] = balances[from].sub(1);
        balances[to] = balances[to].add(1);
        owners[tokenId] = to;

        emit Transfer(from, to, tokenId);

        return true;
    }


    /**
    * @notice Approve the given address to spend the token
    * @param to Address to approve
    * @param tokenId Id of the token to approve
    */
    function _approve(address to, uint256 tokenId) internal virtual {
        approvals[tokenId] = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }



    //Admin functions
    /**
    * @notice Set a new Controller
    * @dev Loads the new Controller for the Pool
    * @param  _newController address of the new Controller
    */
    function setNewController(address _newController) external override controllerOnly {
        controller = PaladinControllerInterface(_newController);
    }

}