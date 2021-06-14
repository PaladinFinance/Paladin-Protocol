pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "./PaladinControllerInterface.sol";

/** @title palPool Interface  */
/// @author Paladin
interface PalPoolInterface {

    //Events
    /** @notice Event when an user deposit tokens in the pool */
    event Deposit(address user, uint amount, address palPool);
    /** @notice Event when an user withdraw tokens from the pool */
    event Withdraw(address user, uint amount, address palPool);
    /** @notice Event when a loan is started */
    event NewLoan(
        address borrower,
        address underlying,
        uint amount,
        address palPool,
        address loanAddress,
        uint startBlock);
    /** @notice Event when the fee amount in the loan is updated */
    event ExpandLoan(
        address borrower,
        address underlying,
        address palPool,
        uint newFeesAmount,
        address loanAddress
    );
    /** @notice Event when a loan is ended */
    event CloseLoan(
        address borrower,
        address underlying,
        uint amount,
        address palPool,
        uint usedFees,
        address loanAddress,
        bool wasKilled
    );

    /** @notice Reserve Events */
    event AddReserve(uint amount);
    event RemoveReserve(uint amount);


    //Functions
    function deposit(uint _amount) external returns(uint);
    function withdraw(uint _amount) external returns(uint);
    function borrow(uint _amount, uint _feeAmount) external returns(uint);
    function expandBorrow(address _loanPool, uint _feeAmount) external returns(uint);
    function closeBorrow(address _loanPool) external;
    function killBorrow(address _loanPool) external;

    function getPalToken() external view returns(address);
    function balanceOf(address _account) external view returns(uint);
    function underlyingBalanceOf(address _account) external view returns(uint);

    function getLoansPools() external view returns(address [] memory);
    function getLoansByBorrower(address _borrower) external view returns(address [] memory);
    function getBorrowDataStored(address _loanAddress) external view returns(
        address _borrower,
        address _loanPool,
        uint _amount,
        address _underlying,
        uint _feesAmount,
        uint _feesUsed,
        uint _startBlock,
        bool _closed
    );
    function getBorrowData(address _loanAddress) external returns(
        address borrower,
        address loanPool,
        uint amount,
        address underlying,
        uint feesAmount,
        uint feesUsed,
        uint startBlock,
        bool closed
    );

    function borrowRatePerBlock() external view returns (uint);
    function supplyRatePerBlock() external view returns (uint);
    function totalBorrowsCurrent() external returns (uint);

    function exchangeRateCurrent() external returns (uint);
    function exchangeRateStored() external view returns (uint);

    function minBorrowFees(uint _amount) external view returns (uint);

    function isKillable(address _loan) external view returns(bool);

    //Admin functions : 
    function setNewController(address _newController) external;
    function setNewInterestModule(address _interestModule) external;
    function setNewDelegator(address _delegator) external;

    function updateMinBorrowLength(uint _length) external;
    function updatePoolFactors(uint _reserveFactor, uint _killerRatio) external;

    function addReserve(uint _amount) external;
    function removeReserve(uint _amount) external;

}