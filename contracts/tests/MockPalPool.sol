pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "../utils/SafeMath.sol";
import "../utils/IERC20.sol";
import "../utils/Admin.sol";
import "../PaladinControllerInterface.sol";
import {Errors} from  "../utils/Errors.sol";

contract MockPalPool is Admin {
    using SafeMath for uint;

    IERC20 public underlying;
    uint public totalReserve;
    PaladinControllerInterface public controller;

    modifier controllerOnly() {
        require(msg.sender == admin || msg.sender == address(controller), Errors.CALLER_NOT_CONTROLLER);
        _;
    }

    constructor(
        address _controller, 
        address _underlying,
        uint _reserveAmount
    ){
        admin = msg.sender;

        controller = PaladinControllerInterface(_controller);
        underlying = IERC20(_underlying);
        totalReserve = _reserveAmount;
    }

    function _underlyingBalance() public pure returns(uint){
        return 10e18;
    }

    function removeReserve(uint _amount, address _recipient) external controllerOnly {
        require(_amount <= _underlyingBalance() && _amount <= totalReserve, Errors.RESERVE_FUNDS_INSUFFICIENT);
        totalReserve = totalReserve.sub(_amount);
        underlying.transfer(_recipient, _amount);
    }

    function setNewController(address _newController) external controllerOnly {
        controller = PaladinControllerInterface(_newController);
    }
}