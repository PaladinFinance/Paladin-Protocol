pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

/** @title Paladin Controller Interface  */
/// @author Paladin
interface PaladinControllerInterface {
    
    //Events

    /** @notice Event emitted when a new token & pool are added to the list */
    event NewPalPool(address palPool);

    /** @notice Event emitted when the contract admni is updated */
    event NewAdmin(address oldAdmin, address newAdmin);


    //Functions
    function getPalTokens() external view returns(address[] memory);
    function getPalPools() external view returns(address[] memory);
    function addNewPalToken(address palToken, address palPool) external returns(bool);

    function setNewAdmin(address payable newAdmin) external returns(bool);

    function withdrawPossible(address palPool, uint amount) external view returns(bool);
    function borrowPossible(address palPool, uint amount) external view returns(bool);

    function depositVerify(address palPool, address dest, uint amount) external view returns(bool);
    function borrowVerify(address palPool, address borrower, uint amount, uint feesAmount, address loanPool) external view returns(bool);

}