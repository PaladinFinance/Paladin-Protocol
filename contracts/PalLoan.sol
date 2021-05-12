pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "./PalLoanInterface.sol";
import "./utils/IERC20.sol";
import "./utils/SafeERC20.sol";
import "./utils/SafeMath.sol";
import "./tokens/AAVE/IGovernancePowerDelegationToken.sol";
import {Errors} from  "./utils/Errors.sol";

/** @title PalToken Loan Pool contract (deployed by PalToken contract) - AAVE version  */
/// @author Paladin
contract PalLoan is PalLoanInterface {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    //Variables

    /** @notice Address of the udnerlying token for this loan */
    address public underlying;
    /** @notice Amount of the underlying token in this loan */
    uint public amount;
    /** @notice Address of the borrower to delegate the voting power */
    address public borrower;
    /** @notice vToken Pool that created this loan */
    address payable public motherPool;
    /** @notice Amount of fees paid for this loan */
    uint public feesAmount;
    /** @notice Address of the delegator for the underlying token */
    address public delegator;

    //Functions
    constructor(address _motherPool, address _borrower, address _underlying, address _delegator){
        //Set up initial values
        motherPool = payable(_motherPool);
        borrower = _borrower;
        underlying = _underlying;
        delegator = _delegator;
    }

    modifier motherPoolOnly() {
        require(msg.sender == motherPool);
        _;
    }

    /**
    * @notice Starts the Loan and Delegate the voting Power to the Borrower
    * @dev Sets the amount values for the Loan, then delegate the voting power to the Borrower
    * @param _amount Amount of the underlying token for this loan
    * @param _feesAmount Amount of fees (in the underlying token) paid by the borrower
    * @return bool : Power Delagation success
    */
    function initiate(uint _amount, uint _feesAmount) external override motherPoolOnly returns(bool){
        (bool success, bytes memory result) = delegator.delegatecall(msg.data);
        require(success);
        return success;
    }

    /**
    * @notice Increases the amount of fees paid to expand the Loan
    * @dev Updates the feesAmount value for this Loan
    * @param _newFeesAmount new Amount of fees paid by the Borrower
    * @return bool : Expand success
    */
    function expand(uint _newFeesAmount) external override motherPoolOnly returns(bool){
        (bool success, bytes memory result) = delegator.delegatecall(msg.data);
        require(success);
        return success;
    }

    /**
    * @notice Closes a Loan, and returns the non-used fees to the Borrower
    * @dev Return the non-used fees to the Borrower, the loaned tokens and the used fees to the vToken Pool, then destroy the contract
    * @param _usedAmount Amount of fees to be used as interest for the Loan
    */
    function closeLoan(uint _usedAmount) external motherPoolOnly override {
        (bool success, bytes memory result) = delegator.delegatecall(msg.data);
        require(success);

        //Destruct the contract (to get gas refund on the transaction)
        selfdestruct(motherPool);
    }

    /**
    * @notice Kills a Loan, and reward the Killer a part of the fees of the Loan
    * @dev Send the reward fees to the Killer, then return the loaned tokens and the fees to the vToken Pool, and destroy the contract
    * @param _killer Address of the Loan Killer
    * @param killerRatio Percentage of the fees to reward to the killer (scale 1e18)
    */
    function killLoan(address _killer, uint killerRatio) external override motherPoolOnly {
        (bool success, bytes memory result) = delegator.delegatecall(msg.data);
        require(success);

        //Destruct the contract (to get gas refund on the transaction)
        selfdestruct(motherPool);
    }
}