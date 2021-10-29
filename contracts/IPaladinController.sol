//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "./ControllerProxy.sol";

/** @title Paladin Controller Interface  */
/// @author Paladin
interface IPaladinController {
    
    //Events

    /** @notice Event emitted when a new token & pool are added to the list */
    event NewPalPool(address palPool, address palToken);
    /** @notice Event emitted when a token & pool are removed from the list */
    event RemovePalPool(address palPool, address palToken);

    event ClaimRewards(address user, uint amount);

    event PoolRewardsUpdated(address palPool, uint newSupplySpeed, uint newBorrowRatio);


    //Functions
    function isPalPool(address pool) external view returns(bool);
    function getPalTokens() external view returns(address[] memory);
    function getPalPools() external view returns(address[] memory);
    function setInitialPools(address[] memory palTokens, address[] memory palPools) external returns(bool);
    function addNewPool(address palToken, address palPool) external returns(bool);
    function removePool(address _palPool) external returns(bool);

    function withdrawPossible(address palPool, uint amount) external view returns(bool);
    function borrowPossible(address palPool, uint amount) external view returns(bool);

    function depositVerify(address palPool, address dest, uint amount) external returns(bool);
    function withdrawVerify(address palPool, address dest, uint amount) external returns(bool);
    function borrowVerify(address palPool, address borrower, address delegatee, uint amount, uint feesAmount, address loanAddress) external view returns(bool);
    function expandBorrowVerify(address palPool, address loanAddress, uint newFeesAmount) external view returns(bool);
    function closeBorrowVerify(address palPool, address borrower, address loanAddress) external returns(bool);
    function killBorrowVerify(address palPool, address killer, address loanAddress) external returns(bool);

    // Rewards functions

    function totalSupplyRewardSpeed() external view returns(uint);
    function claimable(address user) external view returns(uint);
    function updateUserRewards(address user) external;
    function claim(address user) external;
    function updatePoolRewards(address palPool, uint newSupplyspeed, uint newBorrowRatio) external;

    //Admin functions
    function becomeImplementation(ControllerProxy proxy) external;
    function setPoolsNewController(address _newController) external returns(bool);
    function withdrawFromPool(address _pool, uint _amount, address _recipient) external returns(bool);

}