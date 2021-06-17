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
    function setInitialPools(address[] memory _palTokens, address[] memory _palPools) external returns(bool);
    function addNewPool(address _palToken, address _palPool) external returns(bool);

    function withdrawPossible(address palPool, uint amount) external view returns(bool);
    function borrowPossible(address palPool, uint amount) external view returns(bool);

    function depositVerify(address palPool, address dest, uint amount) external view returns(bool);
    function withdrawVerify(address palPool, address dest, uint amount) external view returns(bool);
    function borrowVerify(address palPool, address borrower, uint amount, uint feesAmount, address loanPool) external view returns(bool);
    function closeBorrowVerify(address palPool, address borrower, address loanPool) external view returns(bool);
    function killBorrowVerify(address palPool, address killer, address loanPool) external view returns(bool);

    //Admin functions
    function setNewAdmin(address payable _newAdmin) external returns(bool);
    function setPoolsNewController(address _newController) external returns(bool);
    function removeReserveFromPool(address _pool, uint _amount, address _recipient) external returns(bool);
    function removeReserveFromAllPools(address _recipient) external returns(bool);

}