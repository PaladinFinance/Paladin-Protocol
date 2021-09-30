pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "../utils/SafeMath.sol";
import "../utils/IERC20.sol";
import "../utils/Admin.sol";
import "../IPaladinController.sol";
import {Errors} from  "../utils/Errors.sol";

contract MockPalPool is Admin {
    using SafeMath for uint;

    IERC20 public underlying;
    uint public totalReserve;
    uint public accruedFees;
    IPaladinController public controller;

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
        accruedFees = accruedFees.sub(_amount);
        totalReserve = totalReserve.sub(_amount);

        underlying.transfer(_recipient, _amount);
    }

    function setNewController(address _newController) external controllerOnly {
        controller = IPaladinController(_newController);
    }
}