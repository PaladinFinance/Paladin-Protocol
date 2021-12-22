//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "../../ControllerProxy.sol";

/** @title Paladin MultiPoolController Interface  */
/// @author Paladin
interface IMultiPoolController {
    
    //Events

    /** @notice Event emitted when a new token & pool are added to the list */
    event NewPool(address pool);
    /** @notice Event emitted when a token & pool are removed from the list */
    event RemovePool(address pool);

    event Deposit(address indexed user, address palToken, uint amount);
    event Withdraw(address indexed user, address palToken, uint amount);

    event ClaimRewards(address indexed user, uint amount);

    event SupplySpeedUpdated(address multiPool, address palToken, uint newSupplySpeed);
    event BorrowRatioUpdated(address multiPool, uint newBorrowRatio);


    //Functions
    function isPalPool(address pool) external view returns(bool); //need this wording for PalLoanToken contract
    function isPalToken(address _token) external view  returns(bool);
    function isPalTokenForPool(address _pool, address _palToken) external view returns(bool);
    function getPalTokens() external view returns(address[] memory);
    function getPalTokens(address _pool) external view returns(address[] memory);
    function getPools() external view returns(address[] memory);
    function addNewPool(address _pool, address[] memory _palTokens) external returns(bool);
    function addNewPalToken(address _pool, address _newPalToken) external returns(bool);
    function removePool(address _pool) external returns(bool);

    function withdrawPossible(address pool, address underlying, uint amount) external view returns(bool);
    function borrowPossible(address pool, address underlying, uint amount) external view returns(bool);

    function depositVerify(address pool, address dest, uint amount) external returns(bool);
    function withdrawVerify(address pool, address dest, uint amount) external returns(bool);
    function borrowVerify(address pool, address borrower, address delegatee, uint amount, uint feesAmount, address loanAddress) external returns(bool);
    function expandBorrowVerify(address pool, address loanAddress, uint newFeesAmount) external returns(bool);
    function closeBorrowVerify(address pool, address borrower, address loanAddress) external returns(bool);
    function killBorrowVerify(address pool, address killer, address loanAddress) external returns(bool);

    // PalToken Deposit/Withdraw functions
    function deposit(address palToken, uint amount) external returns(bool);
    function withdraw(address palToken, uint amount) external returns(bool);

    // Rewards functions
    function totalSupplyRewardSpeed() external view returns(uint);
    function claimable(address user) external view returns(uint);
    function estimateClaimable(address user) external view returns(uint);
    function updateUserRewards(address user) external;
    function claim(address user) external;

    //Admin functions
    function becomeImplementation(ControllerProxy proxy) external;
    function updateRewardToken(address newRewardTokenAddress) external;
    function updateTokenSupplySpeed(address multiPool, address palToken, uint newSupplySpeed) external;
    function updatePoolBorrowRatio(address multiPool, uint newBorrowRatio) external;
    function setPoolsNewController(address newController) external returns(bool);
    function withdrawFromPool(address _pool, address _underlying, uint _amount, address _recipient) external returns(bool);

}