pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT


contract MockPoolBorrowsOnly {

    uint public totalBorrowed;

    function changeTotalBorrowed(uint value) external {
        totalBorrowed = value;
    }
}