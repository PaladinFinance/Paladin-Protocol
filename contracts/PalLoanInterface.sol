pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

/** @title Interface for PalLoan contract  */
/// @author Paladin
interface PalLoanInterface {
    //Functions
    function initiate(uint _amount, uint _feesAmount) external returns(bool);
    function expand(uint _newFeesAmount) external returns(bool);
    function closeLoan(uint _usedAmount) external;
    function killLoan(address _killer, uint _killerRatio) external;
}