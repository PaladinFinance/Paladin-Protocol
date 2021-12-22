//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "../../utils/Admin.sol";

/** @title Paladin MultiController Storage contract  */
/// @author Paladin
contract MultiControllerStorage is Admin {

    /** @notice Layout for the Proxy contract */
    address public currentImplementation;
    address public pendingImplementation;

    /** @notice List of current active Pools */
    address[] public pools;
    /** @notice  mapping PalToken => MultiPalPool */
    mapping(address => address) public palTokenToPool;
    /** @notice  mapping MultiPalPool => list of PalTokens controlled by the Pool */
    mapping(address => address[]) public palTokens;
    /** @notice List of all PalTokens (not linked by MultiPool) */
    address[] public allPalTokens;

    bool internal initialized;

    /** @notice Struct with current SupplyIndex for a Token, and the block of the last update */
    struct TokenRewardsState {
        uint224 index;
        uint32 blockNumber;
    }

    /** @notice Initial index for Rewards */
    uint224 public constant initialRewardsIndex = 1e36;

    address public rewardTokenAddress; // PAL token address to put here

    /** @notice State of the Rewards for each Token */
    mapping(address => TokenRewardsState) public supplyRewardState;

    /** @notice Amount of reward tokens to distribute each block */
    mapping(address => uint) public supplySpeeds;

    /** @notice Last reward index for each Pool for each user */
    /** PalToken => User => Index */
    mapping(address => mapping(address => uint)) public supplierRewardIndex;

    /** @notice Deposited amounts by user for each palToken */
    /** PalToken => User => Amount */
    mapping(address => mapping(address => uint)) public supplierDeposits;

    /** @notice Total amount of each palToken deposited */
    /** PalToken => Total Amount */
    mapping(address => uint) public totalSupplierDeposits;

    /** @notice Ratio to distribute Borrow Rewards for each Pool */
    mapping(address => uint) public borrowRatios; // scaled 1e18

    /** @notice Ratio for each PalLoan (set at PalLoan creation) */
    mapping(address => uint) public loansBorrowRatios; // scaled 1e18

    /** @notice Amount of reward Tokens accrued by the user, and claimable */
    mapping(address => uint) public accruedRewards;

    /** @notice Was PalLoan Borrow Rewards distributed & claimed */
    mapping(address => bool) public isLoanRewardClaimed;

    /** @dev Prevent reentry in some functions */
    bool internal locked;

    /*
    !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    !!!!!!!!!!!!!!!!!! ALWAYS PUT NEW STORAGE AT THE BOTTOM !!!!!!!!!!!!!!!!!!
    !!!!!!!!! WE DON'T WANT COLLISION WHEN SWITCHING IMPLEMENTATIONS !!!!!!!!!
    !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    */


}