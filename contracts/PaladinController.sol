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

    //Return the list of palToken
    function getPalTokens() external view override returns(address[] memory){
        return palTokens;
    }

    function getPalPools() external view override returns(address[] memory){
        return palPools;
    }

    //Add a new palToken & palPool to the list
    function addNewPalToken(address palToken, address palPool) external override returns(bool){
        //Add a new address to the palToken & palPool list
        require(msg.sender == admin, "Admin function");
        require(!_isPalPool(palPool), "Already added");
        palTokens.push(palToken);
        palPools.push(palPool);
        return true;
    }    
    
    //Check if a Withdraw is possible for a given palPool
    function withdrawPossible(address palPool, uint amount) external view override returns(bool){
        //Get the underlying balance of the palPool contract to check if the action is possible
        PalPool _palPool = PalPool(palPool);
        IERC20 underlying = _palPool.underlying();
        return(underlying.balanceOf(palPool) >= amount);
    }
    
    //Check if a Borrow is possible for a given palPool
    function borrowPossible(address palPool, uint amount) external view override returns(bool){
        //Get the underlying balance of the palPool contract to check if the action is possible
        PalPool _palPool = PalPool(palPool);
        IERC20 underlying = _palPool.underlying();
        return(underlying.balanceOf(palPool) >= amount);
    }
    
    //Check if a Deposit was successful (to do)
    function depositVerify(address palPool, address dest, uint amount) external view override returns(bool){
        require(_isPalPool(msg.sender), "Call not allowed");
        //Check if the minting succeeded
        
        //no method yet 
        return true;
    }

    //Check if a Deposit was successful (to do)
    function withdrawVerify(address palPool, address dest, uint amount) external view override returns(bool){
        require(_isPalPool(msg.sender), "Call not allowed");
        //Check if the minting succeeded
        
        //no method yet 
        return true;
    }
    
    //Check if a Borrow was successful
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
        return(borrower == _borrower && amount == _amount && feesAmount == _feesAmount && _closed == false);
    }


    function closeBorrowVerify(address palPool, address borrower, address loanPool) external view override returns(bool){
        require(_isPalPool(msg.sender), "Call not allowed");
        //Check if the minting succeeded
        
        //no method yet 
        return true;
    }


    function killBorrowVerify(address palPool, address killer, address loanPool) external view override returns(bool){
        require(_isPalPool(msg.sender), "Call not allowed");
        //Check if the minting succeeded
        
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