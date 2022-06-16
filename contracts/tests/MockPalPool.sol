pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

import "../utils/IERC20.sol";
import "../utils/Admin.sol";
import "../IPaladinController.sol";
import {Errors} from  "../utils/Errors.sol";

contract MockPalPool is Admin {

    IERC20 public underlying;
    uint public totalReserve;
    uint public accruedFees;
    IPaladinController public controller;
    bool public lastControllerCallResult;

    modifier controllerOnly() {
        require(msg.sender == admin || msg.sender == address(controller), Errors.CALLER_NOT_CONTROLLER);
        _;
    }

    constructor(
        address _controller, 
        address _underlying,
        uint _reserveAmount,
        uint _accruedFees
    ){
        admin = msg.sender;

        controller = IPaladinController(_controller);
        underlying = IERC20(_underlying);
        totalReserve = _reserveAmount;
        accruedFees = _accruedFees;
    }

    function underlyingBalance() public pure returns(uint){
        return 10e18;
    }

    function withdrawFees(uint _amount, address _recipient) external controllerOnly {
        require(_amount<= accruedFees && _amount <= totalReserve, Errors.FEES_ACCRUED_INSUFFICIENT);
        accruedFees -= _amount;
        totalReserve -= _amount;

        underlying.transfer(_recipient, _amount);
    }

    function setNewController(address _newController) external controllerOnly {
        controller = IPaladinController(_newController);
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