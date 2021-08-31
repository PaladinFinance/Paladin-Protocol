//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "../utils/IERC20.sol";
import "../utils/SafeERC20.sol";
import "../utils/SafeMath.sol";
import {Errors} from  "../utils/Errors.sol";
import "./utils/DelegateRegistry.sol";


/** @title Snapshot token Delegator  */
/// @author Paladin
contract SnapshotDelegator{
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    //Mock Variables for DelegateCall

    address public underlying;
    uint public amount;
    address public borrower;
    address public delegatee;
    address payable public motherPool;
    uint public feesAmount;

    constructor(){
        //Set up initial values
        motherPool = payable(address(0xdead));
        
    }

    modifier motherPoolOnly() {
        require(msg.sender == motherPool);
        _;
    }

    /**
    * @notice Starts the Loan and Delegate the voting Power to the Delegatee
    * @dev Sets the amount values for the Loan, then delegate the voting power to the Delegatee
    * @param _delegatee Address to delegate the voting power to
    * @param _amount Amount of the underlying token for this loan
    * @param _feesAmount Amount of fees (in the underlying token) paid by the borrower
    * @return bool : Power Delagation success
    */
    function initiate(
        address _motherPool,
        address _borrower,
        address _underlying,
        address _delegatee,
        uint _amount,
        uint _feesAmount
    ) public returns(bool){
        require(motherPool == address(0));

        motherPool = payable(_motherPool);
        borrower = _borrower;
        underlying = _underlying;
        //Set up the borrowed amount and the amount of fees paid
        amount = _amount;
        feesAmount = _feesAmount;
        delegatee = _delegatee;
        
        //Delegate governance power : Snapshot version
        //This is the Delegate Registry for Mainnet & Kovan
        DelegateRegistry _registry = DelegateRegistry(0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446);
        _registry.setDelegate("", _delegatee);

        return true;
    }

    /**
    * @notice Increases the amount of fees paid to expand the Loan
    * @dev Updates the feesAmount value for this Loan
    * @param _newFeesAmount new Amount of fees paid by the Borrower
    * @return bool : Expand success
    */
    function expand(uint _newFeesAmount) external motherPoolOnly returns(bool){
        feesAmount = feesAmount.add(_newFeesAmount);
        return true;
    }

    /**
    * @notice Closes a Loan, and returns the non-used fees to the Borrower
    * @dev Return the non-used fees to the Borrower, the loaned tokens and the used fees to the PalPool, then destroy the contract
    * @param _usedAmount Amount of fees to be used as interest for the Loan
    */
    function closeLoan(uint _usedAmount) external motherPoolOnly {
        IERC20 _underlying = IERC20(underlying);

        DelegateRegistry _registry = DelegateRegistry(0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446);
        _registry.clearDelegate("");
        
        //Return the remaining amount to the borrower
        //Then return the borrowed amount and the used fees to the pool
        uint _returnAmount = feesAmount.sub(_usedAmount);
        uint _balance = _underlying.balanceOf(address(this));
        uint _keepAmount = _balance.sub(_returnAmount);
        if(_returnAmount > 0){
            _underlying.safeTransfer(borrower, _returnAmount);
        }
        _underlying.safeTransfer(motherPool, _keepAmount);

         //Destruct the contract, so it's not usable anymore
        selfdestruct(motherPool);
    }

    /**
    * @notice Kills a Loan, and reward the Killer a part of the fees of the Loan
    * @dev Send the reward fees to the Killer, then return the loaned tokens and the fees to the PalPool, and destroy the contract
    * @param _killer Address of the Loan Killer
    * @param _killerRatio Percentage of the fees to reward to the killer (scale 1e18)
    */
    function killLoan(address _killer, uint _killerRatio) external motherPoolOnly {
        IERC20 _underlying = IERC20(underlying);

        DelegateRegistry _registry = DelegateRegistry(0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446);
        _registry.clearDelegate("");
        
        //Send the killer reward to the killer
        //Then return the borrowed amount and the fees to the pool
        uint _killerAmount = feesAmount.mul(_killerRatio).div(uint(1e18));
        uint _balance = _underlying.balanceOf(address(this));
        uint _poolAmount = _balance.sub(_killerAmount);
        _underlying.safeTransfer(_killer, _killerAmount);
        _underlying.safeTransfer(motherPool, _poolAmount);

         //Destruct the contract, so it's not usable anymore
        selfdestruct(motherPool);
    }


    /**
    * @notice Change the voring power delegatee
    * @dev Update the delegatee and delegate him the voting power
    * @param _delegatee Address to delegate the voting power to
    * @return bool : Power Delagation success
    */
    function changeDelegatee(address _delegatee) external motherPoolOnly returns(bool){
        delegatee = _delegatee;
        
        //Delegate governance power : Snapshot version
        //This is the Delegate Registry for Mainnet & Kovan
        DelegateRegistry _registry = DelegateRegistry(0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446);
        _registry.setDelegate("", _delegatee);
        return true;
    }
}