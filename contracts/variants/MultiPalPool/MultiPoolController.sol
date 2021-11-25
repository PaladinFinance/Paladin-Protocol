//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "../../utils/SafeMath.sol";
import "../../IPaladinController.sol";
import "./IMultiPalPool.sol";
import "../../IPalLoan.sol";
import "../../utils/IERC20.sol";
import "../../utils/Admin.sol";

/** @title Paladin MultiPoolController contract  */
/// @author Paladin
contract MultiPoolController is Admin {
    using SafeMath for uint;


    /** @notice List of current active palToken Pools */
    address[] public palPools;
    mapping(address => address) public palTokenToPalPool;
    // mapping MultiPalPool => list of PalTokens controlled by the Pool
    mapping(address => address[]) public palTokens;

    /** @notice Event emitted when a new token & pool are added to the list */
    event NewPalPool(address palPool);
    /** @notice Event emitted when a token & pool are removed from the list */
    event RemovePalPool(address palPool);

    constructor(){
        admin = msg.sender;
    }

    //Check if an address is a valid multiPool
    function isPalPool(address _pool) public view returns(bool){
        //Check if the given address is in the palPools list
        address[] memory _pools = palPools;
        for(uint i = 0; i < _pools.length; i++){
            if(_pools[i] == _pool){
                return true;
            }
        }
        return false;
    }

    function isPalTokenForPool(address _pool, address _palToken) public view returns(bool){
        //Check if the given address is in the palPools list
        address[] memory _tokens = palTokens[_pool];
        for(uint i = 0; i < _tokens.length; i++){
            if(_tokens[i] == _palToken){
                return true;
            }
        }
        return false;
    }


    /**
    * @notice Get all the PalTokens listed in the controller
    * @return address[] : List of PalToken addresses
    */
    function getPalTokens(address _pool) external view returns(address[] memory){
        return palTokens[_pool];
    }


    /**
    * @notice Get all the PalPools listed in the controller
    * @return address[] : List of PalPool addresses
    */
    function getPalPools() external view returns(address[] memory){
        return palPools;
    }
    
    /**
    * @notice Add a new PalPool/PalToken couple to the controller list
    * @param _palTokens array of : address of the PalToken contract
    * @param _palPool address of the PalPool contract
    * @return bool : Success
    */ 
    function addNewPool(address _palPool, address[] memory _palTokens) external adminOnly returns(bool){
        //Add a new address to the palPool list
        //and its list of palTokens to the mapping
        require(!isPalPool(_palPool), "Already added");
        require(_palTokens.length > 0, "Empty list");
        require(_palPool != address(0), "Address 0x0");

        palPools.push(_palPool);
        palTokens[_palPool] = _palTokens;

        for(uint i = 0; i < _palTokens.length; i++){
            palTokenToPalPool[_palTokens[i]] = _palPool;
        }

        emit NewPalPool(_palPool);

        return true;
    }


    function addNewPalToken(address _palPool, address _newPalToken) external adminOnly returns(bool){
        //Add a Paltoken to the MultiPool list
        require(isPalPool(_palPool), "Not listed");
        require(!isPalTokenForPool(_palPool, _newPalToken), "Already added");
        require(_palPool != address(0), "Address 0x0");
        require(_newPalToken != address(0), "Address 0x0");

        palTokens[_palPool].push(_newPalToken);
        palTokenToPalPool[_newPalToken] = _palPool;

        return true;
    }

    
    /**
    * @notice Remove a PalPool from the list (& the related PalTokens)
    * @param _palPool address of the PalPool contract to remove
    * @return bool : Success
    */ 
    function removePool(address _palPool) external adminOnly returns(bool){
        require(isPalPool(_palPool), "Not listed");

        address[] memory _pools = palPools;
        
        uint lastIndex = (_pools.length).sub(1);
        for(uint i = 0; i < _pools.length; i++){
            if(_pools[i] == _palPool){
                address[] memory _tokens = palTokens[_palPool];
                for(uint j = 0; j < _tokens.length; j++){
                    delete palTokenToPalPool[_tokens[j]];
                }

                //Delete the list of palTokens for this Pool
                delete palTokens[_palPool];

                //Replace the address to remove with the last one of the array
                palPools[i] = palPools[lastIndex];

                //And pop the last item of the array
                palPools.pop();

                emit RemovePalPool(_palPool);
             
                return true;
            }
        }
        return false;
    }


    /**
    * @notice Check if the given PalPool has enough cash to make a withdraw
    * @param palPool address of PalPool
    * @param amount amount withdrawn
    * @return bool : true if possible
    */
    function withdrawPossible(address palPool, address underlying, uint amount) external view returns(bool){
        //Get the underlying balance of the palPool contract to check if the action is possible
        IMultiPalPool _palPool = IMultiPalPool(palPool);
        return(_palPool.underlyingBalance(underlying) >= amount);
    }
    

    /**
    * @notice Check if the given PalPool has enough cash to borrow
    * @param palPool address of PalPool
    * @param amount amount ot borrow
    * @return bool : true if possible
    */
    function borrowPossible(address palPool, address underlying, uint amount) external view returns(bool){
        //Get the underlying balance of the palPool contract to check if the action is possible
        IMultiPalPool _palPool = IMultiPalPool(palPool);
        return(_palPool.underlyingBalance(underlying) >= amount);
    }
    

    /**
    * @notice Check if Deposit was correctly done
    * @param palPool address of PalPool
    * @param dest address to send the minted palTokens
    * @param amount amount of palTokens minted
    * @return bool : Verification Success
    */
    function depositVerify(address palPool, address dest, uint amount) external view returns(bool){
        require(isPalPool(msg.sender), "Call not allowed");

        palPool;
        dest;
        amount;
        
        //Check the amount sent isn't null 
        return amount > 0;
    }


    /**
    * @notice Check if Withdraw was correctly done
    * @param palPool address of PalPool
    * @param dest address to send the underlying tokens
    * @param amount amount of underlying token returned
    * @return bool : Verification Success
    */
    function withdrawVerify(address palPool, address dest, uint amount) external view returns(bool){
        require(isPalPool(msg.sender), "Call not allowed");
        
        palPool;
        dest;
        amount;

        //Check the amount sent isn't null
        return amount > 0;
    }
    

    /**
    * @notice Check if Borrow was correctly done
    * @param palPool address of PalPool
    * @param borrower borrower's address 
    * @param amount amount of token borrowed
    * @param feesAmount amount of fees paid by the borrower
    * @param loanAddress address of the new deployed PalLoan
    * @return bool : Verification Success
    */
    function borrowVerify(address palPool, address borrower, address delegatee, uint amount, uint feesAmount, address loanAddress) external view returns(bool){
        require(isPalPool(msg.sender), "Call not allowed");
        
        palPool;
        borrower;
        delegatee;
        amount;
        feesAmount;
        loanAddress;
        
        //no method yet 
        return true;
    }

    /**
    * @notice Check if Expand Borrow was correctly done
    * @param loanAddress address of the PalLoan contract
    * @param newFeesAmount new amount of fees in the PalLoan
    * @return bool : Verification Success
    */
    function expandBorrowVerify(address palPool, address loanAddress, uint newFeesAmount) external view returns(bool){
        require(isPalPool(msg.sender), "Call not allowed");
        
        palPool;
        loanAddress;
        newFeesAmount;
        
        //no method yet 
        return true;
    }


    /**
    * @notice Check if Borrow Closing was correctly done
    * @param palPool address of PalPool
    * @param borrower borrower's address
    * @param loanAddress address of the PalLoan contract to close
    * @return bool : Verification Success
    */
    function closeBorrowVerify(address palPool, address borrower, address loanAddress) external view returns(bool){
        require(isPalPool(msg.sender), "Call not allowed");
        
        palPool;
        borrower;
        loanAddress;
        
        //no method yet 
        return true;
    }


    /**
    * @notice Check if Borrow Killing was correctly done
    * @param palPool address of PalPool
    * @param killer killer's address
    * @param loanAddress address of the PalLoan contract to kill
    * @return bool : Verification Success
    */
    function killBorrowVerify(address palPool, address killer, address loanAddress) external view returns(bool){
        require(isPalPool(msg.sender), "Call not allowed");
        
        palPool;
        killer;
        loanAddress;
        
        //no method yet 
        return true;
    }

        
    
    //Admin function


    function setPoolsNewController(address _newController) external adminOnly returns(bool){
        address[] memory _pools = palPools;
        for(uint i = 0; i < _pools.length; i++){
            IMultiPalPool _palPool = IMultiPalPool(_pools[i]);
            _palPool.setNewController(_newController);
        }
        return true;
    }


    function withdrawFromPool(address _pool, address _underlying, uint _amount, address _recipient) external adminOnly returns(bool){
        IMultiPalPool _palPool = IMultiPalPool(_pool);
        _palPool.withdrawFees(_underlying, _amount, _recipient);
        return true;
    }


}