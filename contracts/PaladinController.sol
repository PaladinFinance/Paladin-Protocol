//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "./utils/SafeMath.sol";
import "./PaladinControllerInterface.sol";
import "./PalPool.sol";
import "./utils/IERC20.sol";

/** @title Paladin Controller contract  */
/// @author Paladin
contract PaladinController is PaladinControllerInterface {
    using SafeMath for uint;
    

    /** @dev Admin address for this contract */
    address payable internal admin;

    /** @notice List of current active palToken Pools */
    address[] public palTokens;
    address[] public palPools;

    bool private initialized = false;

    constructor(){
        admin = msg.sender;
    }

    //Check if an address is a valid palPool
    function isPalPool(address _pool) public view override returns(bool){
        //Check if the given address is in the palPools list
        for(uint i = 0; i < palPools.length; i++){
            if(palPools[i] == _pool){
                return true;
            }
        }
        return false;
    }


    /**
    * @notice Get all the PalTokens listed in the controller
    * @return address[] : List of PalToken addresses
    */
    function getPalTokens() external view override returns(address[] memory){
        return palTokens;
    }


    /**
    * @notice Get all the PalPools listed in the controller
    * @return address[] : List of PalPool addresses
    */
    function getPalPools() external view override returns(address[] memory){
        return palPools;
    }

    /**
    * @notice Set the basic PalPools/PalTokens controller list
    * @param _palTokens array of address of PalToken contracts
    * @param _palPools array of address of PalPool contracts
    * @return bool : Success
    */ 
    function setInitialPools(address[] memory _palTokens, address[] memory _palPools) external override returns(bool){
        require(msg.sender == admin, "Admin function");
        require(!initialized, "Lists already set");
        palPools = _palPools;
        palTokens = _palTokens;
        initialized = true;
        return true;
    }
    
    /**
    * @notice Add a new PalPool/PalToken couple to the controller list
    * @param _palToken address of the PalToken contract
    * @param _palPool address of the PalPool contract
    * @return bool : Success
    */ 
    function addNewPool(address _palToken, address _palPool) external override returns(bool){
        //Add a new address to the palToken & palPool list
        require(msg.sender == admin, "Admin function");
        require(!isPalPool(_palPool), "Already added");
        palTokens.push(_palToken);
        palPools.push(_palPool);
        return true;
    }


    /**
    * @notice Check if the given PalPool has enough cash to make a withdraw
    * @param palPool address of PalPool
    * @param amount amount withdrawn
    * @return bool : true if possible
    */
    function withdrawPossible(address palPool, uint amount) external view override returns(bool){
        //Get the underlying balance of the palPool contract to check if the action is possible
        PalPool _palPool = PalPool(palPool);
        IERC20 underlying = _palPool.underlying();
        return(underlying.balanceOf(palPool) >= amount);
    }
    

    /**
    * @notice Check if the given PalPool has enough cash to borrow
    * @param palPool address of PalPool
    * @param amount amount ot borrow
    * @return bool : true if possible
    */
    function borrowPossible(address palPool, uint amount) external view override returns(bool){
        //Get the underlying balance of the palPool contract to check if the action is possible
        PalPool _palPool = PalPool(palPool);
        IERC20 underlying = _palPool.underlying();
        return(underlying.balanceOf(palPool) >= amount);
    }
    

    /**
    * @notice Check if Deposit was correctly done
    * @param palPool address of PalPool
    * @param dest address to send the minted palTokens
    * @param amount amount of underlying tokens deposited
    * @return bool : Verification Success
    */
    function depositVerify(address palPool, address dest, uint amount) external view override returns(bool){
        require(isPalPool(msg.sender), "Call not allowed");

        palPool;
        dest;
        amount;
        
        //no method yet 
        return true;
    }


    /**
    * @notice Check if Withdraw was correctly done
    * @param palPool address of PalPool
    * @param dest address to send the underlying tokens
    * @param amount amount of PalToken returned
    * @return bool : Verification Success
    */
    function withdrawVerify(address palPool, address dest, uint amount) external view override returns(bool){
        require(isPalPool(msg.sender), "Call not allowed");
        
        palPool;
        dest;
        amount;

        //no method yet 
        return true;
    }
    

    /**
    * @notice Check if Borrow was correctly done
    * @param palPool address of PalPool
    * @param borrower borrower's address 
    * @param amount amount of token borrowed
    * @param feesAmount amount of fees paid by the borrower
    * @param loanPool address of the new deployed PalLoan
    * @return bool : Verification Success
    */
    function borrowVerify(address palPool, address borrower, address delegatee, uint amount, uint feesAmount, address loanPool) external view override returns(bool){
        require(isPalPool(msg.sender), "Call not allowed");
        //Check if the borrow was successful
        PalPoolInterface _palPool = PalPoolInterface(palPool);
        (
            address _borrower,
            address _delegatee,
            address _loan,
            uint _tokenId,
            uint _amount,
            address _underlying,
            uint _feesAmount,
            ,
            ,
            ,
            bool _closed,
        ) = _palPool.getBorrowData(loanPool);

        _underlying;
        _loan;
        _tokenId;

        return(borrower == _borrower && delegatee == _delegatee && amount == _amount && feesAmount == _feesAmount && !_closed);
    }


    /**
    * @notice Check if Borrow Closing was correctly done
    * @param palPool address of PalPool
    * @param borrower borrower's address
    * @param loanPool address of the PalLoan contract to close
    * @return bool : Verification Success
    */
    function closeBorrowVerify(address palPool, address borrower, address loanPool) external view override returns(bool){
        require(isPalPool(msg.sender), "Call not allowed");
        
        palPool;
        borrower;
        loanPool;
        
        //no method yet 
        return true;
    }


    /**
    * @notice Check if Borrow Killing was correctly done
    * @param palPool address of PalPool
    * @param killer killer's address
    * @param loanPool address of the PalLoan contract to kill
    * @return bool : Verification Success
    */
    function killBorrowVerify(address palPool, address killer, address loanPool) external view override returns(bool){
        require(isPalPool(msg.sender), "Call not allowed");
        
        palPool;
        killer;
        loanPool;
        
        //no method yet 
        return true;
    }

        
    
    //Admin function

    /**
    * @notice Set a new Controller Admin
    * @dev Changes the address for the admin parameter
    * @param _newAdmin address of the new Controller Admin
    * @return bool : Update success
    */
    function setNewAdmin(address payable _newAdmin) external override returns(bool){
        require(msg.sender == admin, "Admin function");
        admin = _newAdmin;
        return true;
    }


    function setPoolsNewController(address _newController) external override returns(bool){
        require(msg.sender == admin, "Admin function");
        for(uint i = 0; i < palPools.length; i++){
            PalPoolInterface _palPool = PalPoolInterface(palPools[i]);
            _palPool.setNewController(_newController);
        }
        return true;
    }


    function removeReserveFromPool(address _pool, uint _amount, address _recipient) external override returns(bool){
        require(msg.sender == admin, "Admin function");
        PalPoolInterface _palPool = PalPoolInterface(_pool);
        _palPool.removeReserve(_amount, _recipient);
        return true;
    }


    function removeReserveFromAllPools(address _recipient) external override returns(bool){
        //TO DO
        //Do we swap all the funds into 1 token ?
        //Do we send each of them, and another contract takes care of that ?
    }


}