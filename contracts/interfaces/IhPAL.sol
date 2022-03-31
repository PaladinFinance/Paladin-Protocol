pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

interface IhPAL {

    struct UserLock {
        uint128 amount;
        uint48 startTimestamp;
        uint48 duration;
        uint32 fromBlock;
    }

    // solhint-disable-next-line
    function MIN_LOCK_DURATION() external view returns(uint256);
    // solhint-disable-next-line
    function MAX_LOCK_DURATION() external view returns(uint256);

    function getUserLock(address user) external view returns(UserLock memory);

    function getUserLockCount(address user) external view returns(uint256);

    function getUserPastLock(address user, uint256 blockNumber) external view returns(UserLock memory);

}