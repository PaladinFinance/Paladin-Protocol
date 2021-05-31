pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "./utils/SafeMath.sol";
import "./PaladinControllerInterface.sol";
import "./PalPool.sol";
import "./PalToken.sol";
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


    constructor(){
        admin = msg.sender;
    }

    //Check if an address is a valid palPool
    function _isPalPool(address _pool) internal view returns(bool){
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
    * @notice Add a new PalPool/PalToken couple to the controller list
    * @param palToken address of the PalToken contract
    * @param palPool address of the PalPool contract
    * @return bool : Success
    */
    function addNewPalToken(address palToken, address palPool) external override returns(bool){
        //Add a new address to the palToken & palPool list
        require(msg.sender == admin, "Admin function");
        require(!_isPalPool(palPool), "Already added");
        palTokens.push(palToken);
        palPools.push(palPool);
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
        require(_isPalPool(msg.sender), "Call not allowed");

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
        require(_isPalPool(msg.sender), "Call not allowed");
        
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
    function borrowVerify(address palPool, address borrower, uint amount, uint feesAmount, address loanPool) external view override returns(bool){
        require(_isPalPool(msg.sender), "Call not allowed");
        //Check if the borrow was successful
        PalPoolInterface _palPool = PalPoolInterface(palPool);
        (
            address _borrower,
            address _loan,
            uint _amount,
            address _underlying,
            uint _feesAmount,
            uint _feesUsed,
            uint _startBlock,
            bool _closed
        ) = _palPool.getBorrowDataStored(loanPool);

        _loan;
        _amount;
        _underlying;
        _feesAmount;
        _feesUsed;
        _startBlock;

        return(borrower == _borrower && amount == _amount && feesAmount == _feesAmount && !_closed);
    }


    /**
    * @notice Check if Borrow Closing was correctly done
    * @param palPool address of PalPool
    * @param borrower borrower's address
    * @param loanPool address of the PalLoan contract to close
    * @return bool : Verification Success
    */
    function closeBorrowVerify(address palPool, address borrower, address loanPool) external view override returns(bool){
        require(_isPalPool(msg.sender), "Call not allowed");
        
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
        require(_isPalPool(msg.sender), "Call not allowed");
        
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
    * @param newAdmin address of the new Controller Admin
    * @return bool : Update success
    */
    function setNewAdmin(address payable newAdmin) external override returns(bool){
        require(msg.sender == admin, "Admin function");
        admin = newAdmin;
        return true;
    }
}