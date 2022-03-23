pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "../utils/SafeMath.sol";
import "../utils/IERC20.sol";
import "../utils/Admin.sol";
import "../variants/MultiPalPool/IMultiPoolController.sol";
import {Errors} from  "../utils/Errors.sol";

contract MockMultiPool is Admin {
    using SafeMath for uint;

    address[] public underlyings;
    struct PoolState {
        uint totalReserve;
        uint totalBorrowed;
        uint accruedFees;
        uint numberActiveLoans;
    }
    mapping (address => PoolState) public poolStates;
    IMultiPoolController public controller;
    bool public lastControllerCallResult;

    modifier controllerOnly() {
        require(msg.sender == admin || msg.sender == address(controller), Errors.CALLER_NOT_CONTROLLER);
        _;
    }

    constructor(
        address _controller, 
        address[] memory _underlyings,
        uint[] memory _reserveAmount,
        uint[] memory _accruedFees
    ){
        admin = msg.sender;

        controller = IMultiPoolController(_controller);
        underlyings = _underlyings;

        for(uint i = 0; i < _underlyings.length; i++){
            poolStates[_underlyings[i]].totalReserve = _reserveAmount[i];
            poolStates[_underlyings[i]].accruedFees = _accruedFees[i];
        }
    }

    function underlyingBalance(address _underlying) external view returns(uint){
        return IERC20(_underlying).balanceOf(address(this));
    }

    function withdrawFees(address _underlying, uint _amount, address _recipient) external controllerOnly {
        require(_amount<= poolStates[_underlying].accruedFees && _amount <= poolStates[_underlying].totalReserve, Errors.FEES_ACCRUED_INSUFFICIENT);
        poolStates[_underlying].accruedFees = poolStates[_underlying].accruedFees.sub(_amount);
        poolStates[_underlying].totalReserve = poolStates[_underlying].totalReserve.sub(_amount);

        IERC20(_underlying).transfer(_recipient, _amount);
    }

    function setNewController(address _newController) external controllerOnly {
        controller = IMultiPoolController(_newController);
    }

    function testDepositVerify(address palPool, address dest, uint amount) public {
        lastControllerCallResult = controller.depositVerify(palPool, dest, amount);
    }

    function testWithdrawVerify(address palPool, address dest, uint amount) public {
        lastControllerCallResult = controller.withdrawVerify(palPool, dest, amount);
    }

    function testBorrowVerify(address palPool, address borrower, address delegatee, uint amount, uint feesAmount, address loanAddress) public {
        lastControllerCallResult = controller.borrowVerify(palPool, borrower, delegatee, amount, feesAmount, loanAddress);
    }

    function testExpandBorrowVerify(address palPool, address loanAddress, uint newFeesAmount) public {
        lastControllerCallResult = controller.expandBorrowVerify(palPool, loanAddress, newFeesAmount);
    }

    function testCloseBorrowVerify(address palPool, address borrower, address loanAddress) public {
        lastControllerCallResult = controller.closeBorrowVerify(palPool, borrower, loanAddress);
    }

    function testKillBorrowVerify(address palPool, address killer, address loanAddress) public {
        lastControllerCallResult = controller.killBorrowVerify(palPool, killer, loanAddress);
    }
}