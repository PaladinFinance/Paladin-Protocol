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
import "../tokens/ICompLike.sol";
import {Errors} from  "../utils/Errors.sol";

/** @title Basic Governance token Delegator (Governor Alpha version)  */
/// @author Paladin
contract BasicDelegator {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    //Mock Variables for DelegateCall

    address internal underlying;
    uint internal amount;
    address internal borrower;
    address internal delegatee;
    address payable internal motherPool;
    uint internal feesAmount;


    /**
    * @notice Starts the Loan and Delegate the voting Power to the Delegatee
    * @dev Sets the amount values for the Loan, then delegate the voting power to the Delegatee
    * @param _delegatee Address to delegate the voting power to
    * @param _amount Amount of the underlying token for this loan
    * @param _feesAmount Amount of fees (in the underlying token) paid by the borrower
    * @return bool : Power Delagation success
    */
    function initiate(address _delegatee, uint _amount, uint _feesAmount) external returns(bool){
        //Set up the borrowed amount and the amount of fees paid
        amount = _amount;
        feesAmount = _feesAmount;
        delegatee = _delegatee;
        
        //Delegate governance power : Governor Alpha version
        ICompLike govToken = ICompLike(underlying);
        govToken.delegate(_delegatee);
        return true;
    }

    /**
    * @notice Increases the amount of fees paid to expand the Loan
    * @dev Updates the feesAmount value for this Loan
    * @param _newFeesAmount new Amount of fees paid by the Borrower
    * @return bool : Expand success
    */
    function expand(uint _newFeesAmount) external returns(bool){
        feesAmount = feesAmount.add(_newFeesAmount);
        return true;
    }

    /**
    * @notice Closes a Loan, and returns the non-used fees to the Borrower
    * @dev Return the non-used fees to the Borrower, the loaned tokens and the used fees to the PalPool, then destroy the contract
    * @param _usedAmount Amount of fees to be used as interest for the Loan
    */
    function closeLoan(uint _usedAmount) external {
        IERC20 _underlying = IERC20(underlying);
        
        //Return the remaining amount to the borrower
        //Then return the borrowed amount and the used fees to the pool
        uint _returnAmount = feesAmount.sub(_usedAmount);
        uint _keepAmount = amount.add(_usedAmount);
        if(_returnAmount > 0){
            _underlying.safeTransfer(borrower, _returnAmount);
        }
        _underlying.safeTransfer(motherPool, _keepAmount);
    }

    /**
    * @notice Kills a Loan, and reward the Killer a part of the fees of the Loan
    * @dev Send the reward fees to the Killer, then return the loaned tokens and the fees to the PalPool, and destroy the contract
    * @param _killer Address of the Loan Killer
    * @param _killerRatio Percentage of the fees to reward to the killer (scale 1e18)
    */
    function killLoan(address _killer, uint _killerRatio) external {
        IERC20 _underlying = IERC20(underlying);
        
        //Send the killer reward to the killer
        //Then return the borrowed amount and the fees to the pool
        uint _killerAmount = feesAmount.mul(_killerRatio).div(uint(1e18));
        uint _balance = amount.add(feesAmount);
        uint _poolAmount = _balance.sub(_killerAmount);
        _underlying.safeTransfer(_killer, _killerAmount);
        _underlying.safeTransfer(motherPool, _poolAmount);
    }

}