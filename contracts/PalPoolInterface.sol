pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "./PaladinControllerInterface.sol";

/** @title palPool Interface  */
/// @author Paladin
interface PalPoolInterface {

    //Events
    /** @notice Event when an user deposit tokens in the pool */
    event Deposit(address user, uint amount, address palToken);
    /** @notice Event when an user withdraw tokens from the pool */
    event Withdraw(address user, uint amount, address palToken);
    /** @notice Event when a loan is started */
    event NewLoan(
        address user,
        uint amount,
        address palToken,
        address loanAddress,
        uint startBlock);
    /** @notice Event when the fee amount in the loan is updated */
    event ExpandLoan(
        address borrower,
        address underlying,
        uint addedFees,
        address loanAddress
    );
    /** @notice Event when a loan is ended */
    event CloseLoan(address user, uint amount, address palToken, bool wasKilled);
    /** @notice (Admin) Event when the contract admin is updated */
    event newAdmin(address oldAdmin, address newAdmin);


    //Functions
    function deposit(uint amount) external returns(uint);
    function withdraw(uint amount) external returns(uint);
    function borrow(uint amount, uint feeAmount) external returns(uint);
    function expandBorrow(address loanPool, uint feeAmount) external returns(uint);
    function closeBorrow(address loanPool) external;
    function killBorrow(address loanPool) external;

    function getPalToken() external view returns(address);
    function balanceOf(address _account) external view returns(uint);
    function underlyingBalanceOf(address _account) external view returns(uint);

    function getLoansPools() external view returns(address [] memory);
    function getLoansByBorrower(address borrower) external view returns(address [] memory);
    function getBorrowDataStored(address __loanPool) external view returns(
        address _borrower,
        address _loanPool,
        uint _amount,
        address _underlying,
        uint _feesAmount,
        uint _feesUsed,
        bool _closed
    );
    function getBorrowData(address _loanPool) external returns(
        address borrower,
        address loanPool,
        uint amount,
        address underlying,
        uint feesAmount,
        uint feesUsed,
        bool closed
    );

    function borrowRatePerBlock() external view returns (uint);
    function supplyRatePerBlock() external view returns (uint);
    function totalBorrowsCurrent() external returns (uint);

    function exchangeRateCurrent() external returns (uint);
    function exchangeRateStored() external view returns (uint);

    // Admin Functions
    //function setNewAdmin(address payable _newAdmin) external;

    function setNewController(address _newController) external;
    function setNewInterestModule(address _interestModule) external;
    function setNewDelegator(address _delegator) external;

    function addReserve(uint _amount) external;
    function removeReserve(uint _amount) external;

}