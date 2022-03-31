pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "../utils/SafeMath.sol";
import "./ERC20.sol";

contract MockhPAL is ERC20('mock hPAL', 'mock hPAL') {
    using SafeMath for uint256;

    struct UserLock {
        uint128 amount;
        uint48 startTimestamp;
        uint48 duration;
        uint32 fromBlock;
    }

    mapping(address => UserLock[]) public userLocks;

    uint256 public constant MIN_LOCK_DURATION = 7889400; // 3 months

    uint256 public constant MAX_LOCK_DURATION = 63115200; // 2 years

    function pushUserLock(
        address user,
        uint256 amount,
        uint256 startTimestamp,
        uint256 duration,
        uint256 fromBlock
    ) external{
        userLocks[user].push(UserLock(
            safe128(amount),
            safe48(startTimestamp),
            safe48(duration),
            safe32(fromBlock)
        ));
    }

    function getUserLock(address user) external view returns(UserLock memory){
        if(userLocks[user].length == 0) return UserLock(0, 0, 0, 0);
        uint256 lastUserLockIndex = userLocks[user].length - 1;
        return userLocks[user][lastUserLockIndex];
    }

    function getUserLockCount(address user) external view returns(uint256){
        return userLocks[user].length;
    }

    function getUserPastLock(address user, uint256 blockNumber) external view returns(UserLock memory){
        require(
            blockNumber < block.number,
            "invalid blockNumber"
        );

        UserLock memory emptyLock = UserLock(
            0,
            0,
            0,
            0
        );

        // no checkpoints written
        uint256 nbCheckpoints = userLocks[user].length;
        if (nbCheckpoints == 0) return emptyLock;

        // last checkpoint check
        if (userLocks[user][nbCheckpoints - 1].fromBlock <= blockNumber) {
            return userLocks[user][nbCheckpoints - 1];
        }

        // no checkpoint old enough
        if (userLocks[user][0].fromBlock > blockNumber) {
            return emptyLock;
        }

        uint256 high = nbCheckpoints - 1; // last checkpoint already checked
        uint256 low = 0;
        uint256 mid;
        while (low < high) {
            mid = average(low, high);
            if (userLocks[user][mid].fromBlock == blockNumber) {
                return userLocks[user][mid];
            }
            if (userLocks[user][mid].fromBlock > blockNumber) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return high == 0 ? emptyLock : userLocks[user][high - 1];
    }


    function safe32(uint n) internal pure returns (uint32) {
        if(n > type(uint32).max) revert();
        return uint32(n);
    }

    function safe48(uint n) internal pure returns (uint48) {
        if(n > type(uint48).max) revert();
        return uint48(n);
    }

    function safe128(uint n) internal pure returns (uint128) {
        if(n > type(uint128).max) revert();
        return uint128(n);
    }

    function safe224(uint n) internal pure returns (uint224) {
        if(n > type(uint224).max) revert();
        return uint224(n);
    }

    function average(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a + b) / 2 can overflow.
        return (a & b).add(a ^ b).div(2);
    }

}