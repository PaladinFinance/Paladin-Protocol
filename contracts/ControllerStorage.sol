//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "./utils/Admin.sol";

/** @title Paladin Controller contract  */
/// @author Paladin
contract ControllerStorage is Admin {

    /** @notice Layout for the Proxy contract */
    address public currentImplementation;
    address public pendingImplementation;

    /** @notice List of current active palToken Pools */
    address[] public palTokens;
    address[] public palPools;
    mapping(address => address) public palTokenToPalPool;

    bool internal initialized;

    /** @notice Struct with current SupplyIndex for a Pool, and the block of the last update */
    struct PoolRewardsState {
        uint224 index;
        uint32 blockNumber;
    }

    /** @notice Initial index for Rewards */
    uint224 public constant initialRewardsIndex = 1e36;

    address public rewardTokenAddress; // PAL token address to put here

    /** @notice State of the Rewards for each Pool */
    mapping(address => PoolRewardsState) public supplyRewardState;

    /** @notice Amount of reward tokens to distribute each block */
    mapping(address => uint) public supplySpeeds;

    /** @notice Last reward index for each Pool for each user */
    /** PalPool => User => Index */
    mapping(address => mapping(address => uint)) public supplierRewardIndex;

    /** @notice Deposited amounts by user for each palToken (indexed by corresponding PalPool address) */
    /** PalPool => User => Amount */
    mapping(address => mapping(address => uint)) public supplierDeposits;

    /** @notice Total amount of each palToken deposited (indexed by corresponding PalPool address) */
    /** PalPool => Total Amount */
    mapping(address => uint) public totalSupplierDeposits;

    /** @notice Ratio to distribute Borrow Rewards */
    mapping(address => uint) public borrowRatios; // scaled 1e18

    /** @notice Ratio for each PalLoan (set at PalLoan creation) */
    mapping(address => uint) public loansBorrowRatios; // scaled 1e18

    /** @notice Amount of reward Tokens accrued by the user, and claimable */
    mapping(address => uint) public accruedRewards;

    /** @notice Is Auto Borrow Rewards is activated for the PalPool  */
    mapping(address => bool) public autoBorrowRewards;

    /** @notice Was PalLoan Borrow Rewards distributed & claimed */
    mapping(address => bool) public isLoanRewardClaimed;

    /** @notice Block at which Borrow Rewards Ratio where set for the PalPool (if Ratio is put back to 0, this block number is set back to 0 too) */
    /** So PalLoan started when no Borrow Rewards where set do not receive rewards */
    /** PalPool => Block Number */
    mapping(address => uint) public borrowRewardsStartBlock;

    /** @dev Prevent reentry in some functions */
    bool internal locked;

    /*
        Paladin Controller update V2
    */

    /** @notice Seconds in a Month */
    uint256 public constant MONTH = 2629800;

    /** @notice Minimum duration of a Lock  */
    uint256 public constant MIN_LOCK_DURATION = 7889400; // 3 months
    /** @notice Maximum duration of a Lock  */
    uint256 public constant MAX_LOCK_DURATION = 63115200; // 2 years

    uint256 public baseRatio = 1e18;
    
    uint256 public bonusRatioPerLockMonth = 0.0625 * 1e18;

    uint256 public maxTotalBonusRatio = 2.5 * 1e18;

    struct SupplierRewardUpdate {
        uint32 blockNumber;
        uint48 timestamp;
    }

    SupplierRewardUpdate public newRewardsStartBlockNumber;

    /** PalPool => User => Index */
    mapping(address => mapping(address => SupplierRewardUpdate)) public supplierLastUpdate;

    /*
    !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    !!!!!!!!!!!!!!!!!! ALWAYS PUT NEW STORAGE AT THE BOTTOM !!!!!!!!!!!!!!!!!!
    !!!!!!!!! WE DON'T WANT COLLISION WHEN SWITCHING IMPLEMENTATIONS !!!!!!!!!
    !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    */


}