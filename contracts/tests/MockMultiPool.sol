pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "../utils/SafeMath.sol";
import "../utils/IERC20.sol";
import "../utils/Admin.sol";
import "../IPaladinController.sol";
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
    IPaladinController public controller;

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

        controller = IPaladinController(_controller);
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
        controller = IPaladinController(_newController);
    }
}