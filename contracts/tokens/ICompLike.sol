pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

interface ICompLike {
    function delegate(address delegatee) external;
    function getCurrentVotes(address account) external view returns (uint96);
}