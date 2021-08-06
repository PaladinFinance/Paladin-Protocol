pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT


contract MockPoolBorrowsOnly {

    uint public totalBorrowed;

    function changeTotalBorrowed(uint value) external {
        totalBorrowed = value;
    }
}