//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

import "../IPaladinController.sol";
import "../ControllerStorage.sol";
import "../PalPool.sol";
import "../IPalPool.sol";
import "../utils/IERC20.sol";
import {Errors} from  "../utils/Errors.sol";

/** @title DoomsdayController contract -> blocks any transaction from the PalPools  */
/// @author Paladin
contract DoomsdayController is IPaladinController, ControllerStorage {
    using SafeERC20 for IERC20;

    constructor(){
        admin = msg.sender;
    }

    //Check if an address is a valid palPool
    function isPalPool(address _pool) public view override returns(bool){
        //Check if the given address is in the palPools list
        address[] memory _pools = palPools;
        for(uint i = 0; i < _pools.length; i++){
            if(_pools[i] == _pool){
                return true;
            }
        }
        return false;
    }


    /**
    * @notice Get all the PalTokens listed in the controller
    * @return address[] : List of PalToken addresses
    */
    function getPalTokens() external view override returns(address[] memory){
        return palTokens;
    }


    /**
    * @notice Get all the PalPools listed in the controller
    * @return address[] : List of PalPool addresses
    */
    function getPalPools() external view override returns(address[] memory){
        return palPools;
    }

    /**
    * @notice Set the basic PalPools/PalTokens controller list
    * @param _palTokens array of address of PalToken contracts
    * @param _palPools array of address of PalPool contracts
    * @return bool : Success
    */ 
    function setInitialPools(address[] memory _palTokens, address[] memory _palPools) external override adminOnly returns(bool){
        if(initialized) revert Errors.PoolListAlreadySet();
        if(_palTokens.length != _palPools.length) revert Errors.ListSizesNotEqual();
        palPools = _palPools;
        palTokens = _palTokens;
        initialized = true;

        for(uint i = 0; i < _palPools.length; i++){
            //Update the Reward State for the new Pool
            PoolRewardsState storage supplyState = supplyRewardState[_palPools[i]];
            if(supplyState.index == 0){
                supplyState.index = initialRewardsIndex;
            }
            supplyState.blockNumber = safe32(block.number);

            //Link PalToken with PalPool
            palTokenToPalPool[_palTokens[i]] = _palPools[i];
        }
        
        return true;
    }
    
    /**
    * @notice Add a new PalPool/PalToken couple to the controller list
    * @param _palToken address of the PalToken contract
    * @param _palPool address of the PalPool contract
    * @return bool : Success
    */ 
    function addNewPool(address _palToken, address _palPool) external pure override returns(bool){
        _palToken;
        _palPool;
        revert();
    }

    
    /**
    * @notice Remove a PalPool from teh list (& the related PalToken)
    * @param _palPool address of the PalPool contract to remove
    * @return bool : Success
    */ 
    function removePool(address _palPool) external override adminOnly returns(bool){
        //Remove a palToken & palPool from the list
        if(!isPalPool(_palPool)) revert Errors.PoolNotListed();

        address[] memory _pools = palPools;
        
        uint lastIndex = _pools.length - 1;
        for(uint i = 0; i < _pools.length; i++){
            if(_pools[i] == _palPool){
                //get the address of the PalToken for the Event
                address _palToken = palTokens[i];

                delete palTokenToPalPool[_palToken];

                //Replace the address to remove with the last one of the array
                palPools[i] = palPools[lastIndex];
                palTokens[i] = palTokens[lastIndex];

                //And pop the last item of the array
                palPools.pop();
                palTokens.pop();

                emit RemovePalPool(_palPool, _palToken);
             
                return true;
            }
        }
        return false;
    }


    /**
    * @notice Check if the given PalPool has enough cash to make a withdraw
    * @param palPool address of PalPool
    * @param amount amount withdrawn
    * @return bool : true if possible
    */
    function withdrawPossible(address palPool, uint amount) external pure override returns(bool){
        palPool;
        amount;
        return false;
    }
    

    /**
    * @notice Check if the given PalPool has enough cash to borrow
    * @param palPool address of PalPool
    * @param amount amount ot borrow
    * @return bool : true if possible
    */
    function borrowPossible(address palPool, uint amount) external pure override returns(bool){
        palPool;
        amount;
        return false;
    }


    /**
    * @notice Check if Deposit was correctly done
    * @param palPool address of PalPool
    * @param dest address to send the minted palTokens
    * @param amount amount of underlying tokens deposited
    * @return bool : Verification Success
    */
    function depositVerify(address palPool, address dest, uint amount) external view override returns(bool){
        if(!isPalPool(msg.sender)) revert Errors.CallerNotPool();

        palPool;
        dest;
        amount;
        
        //no method yet 
        return false;
    }


    /**
    * @notice Check if Withdraw was correctly done
    * @param palPool address of PalPool
    * @param dest address to send the underlying tokens
    * @param amount amount of PalToken returned
    * @return bool : Verification Success
    */
    function withdrawVerify(address palPool, address dest, uint amount) external view override returns(bool){
        if(!isPalPool(msg.sender)) revert Errors.CallerNotPool();
        
        palPool;
        dest;
        amount;

        //no method yet 
        return false;
    }
    

    /**
    * @notice Check if Borrow was correctly done
    * @param palPool address of PalPool
    * @param borrower borrower's address 
    * @param amount amount of token borrowed
    * @param feesAmount amount of fees paid by the borrower
    * @param loanPool address of the new deployed PalLoan
    * @return bool : Verification Success
    */
    function borrowVerify(address palPool, address borrower, address delegatee, uint amount, uint feesAmount, address loanPool) external view override returns(bool){
        if(!isPalPool(msg.sender)) revert Errors.CallerNotPool();
        
        palPool;
        borrower;
        delegatee;
        amount;
        feesAmount;
        loanPool;

        return false;
    }


    /**
    * @notice Check if Expand Borrow was correctly done
    * @param loanAddress address of the PalLoan contract
    * @param newFeesAmount new amount of fees in the PalLoan
    * @return bool : Verification Success
    */
    function expandBorrowVerify(address palPool, address loanAddress, uint newFeesAmount) external view override returns(bool){
        if(!isPalPool(msg.sender)) revert Errors.CallerNotPool();

        palPool;
        loanAddress;
        newFeesAmount;
        
        return false;
    }


    /**
    * @notice Check if Borrow Closing was correctly done
    * @param palPool address of PalPool
    * @param borrower borrower's address
    * @param loanAddress address of the PalLoan contract to close
    * @return bool : Verification Success
    */
    function closeBorrowVerify(address palPool, address borrower, address loanAddress) external override returns(bool){
        if(!isPalPool(msg.sender)) revert Errors.CallerNotPool();
        
        borrower;

        //Accrue Rewards to the Loan's owner
        accrueBorrowRewards(palPool, loanAddress);
        
        //no method yet 
        return true;
    }


    /**
    * @notice Check if Borrow Killing was correctly done
    * @param palPool address of PalPool
    * @param killer killer's address
    * @param loanAddress address of the PalLoan contract to kill
    * @return bool : Verification Success
    */
    function killBorrowVerify(address palPool, address killer, address loanAddress) external override returns(bool){
        if(!isPalPool(msg.sender)) revert Errors.CallerNotPool();
        
        killer;

        //Accrue Rewards to the Loan's owner
        accrueBorrowRewards(palPool, loanAddress);
        
        //no method yet 
        return true;
    }


    // PalToken Deposit/Withdraw functions

    function deposit(address palToken, uint amount) external pure override returns(bool){
        palToken;
        amount;
        revert();
    }


    function withdraw(address palToken, uint amount) external pure override returns(bool){
        palToken;
        amount;
        revert();
    }

        
    // Rewards functions
    
    /**
    * @notice Internal - Updates the Supply Index of a Pool for reward distribution
    * @param palPool address of the Pool to update the Supply Index for
    */
    function updateSupplyIndex(address palPool) internal {
        // Get last Pool Supply Rewards state
        PoolRewardsState storage state = supplyRewardState[palPool];
        // Get the current block number, and the Supply Speed for the given Pool
        uint currentBlock = block.number;
        uint supplySpeed = supplySpeeds[palPool];

        // Calculate the number of blocks since last update
        uint ellapsedBlocks = currentBlock - uint(state.blockNumber);

        // If an update is needed : block ellapsed & non-null speed (rewards to distribute)
        if(ellapsedBlocks > 0 && supplySpeed > 0){
            // Get the Total Amount deposited in the Controller of PalToken associated to the Pool
            uint totalDeposited = totalSupplierDeposits[palPool];

            // Calculate the amount of rewards token accrued since last update
            uint accruedAmount = ellapsedBlocks * supplySpeed;

            // And the new ratio for reward distribution to user
            // Based on the amount of rewards accrued, and the change in the TotalSupply
            uint ratio = totalDeposited > 0 ? (accruedAmount * 1e36) / totalDeposited : 0;

            // Write new Supply Rewards values in the storage
            state.index = safe224(uint(state.index) + ratio);
            state.blockNumber = safe32(currentBlock);
        }
        else if(ellapsedBlocks > 0){
            // If blocks ellapsed, but no rewards to distribute (speed == 0),
            // just write the last update block number
            state.blockNumber = safe32(currentBlock);
        }

    }

    /**
    * @notice Internal - Accrues rewards token to the user claimable balance, depending on the Pool SupplyRewards state
    * @param palPool address of the PalPool the user interracted with
    * @param user address of the user to accrue rewards to
    */
    function accrueSupplyRewards(address palPool, address user) internal {
        // Get the Pool current SupplyRewards state
        PoolRewardsState storage state = supplyRewardState[palPool];

        // Get the current reward index for the Pool
        // And the user last reward index
        uint currentSupplyIndex = state.index;
        uint userSupplyIndex = supplierRewardIndex[palPool][user];

        // Update the Index in the mapping, the local value is used after
        supplierRewardIndex[palPool][user] = currentSupplyIndex;

        if(userSupplyIndex == 0 && currentSupplyIndex >= initialRewardsIndex){
            // Set the initial Index for the user
            userSupplyIndex = initialRewardsIndex;
        }

        // Get the difference of index with the last one for user
        uint indexDiff = currentSupplyIndex - userSupplyIndex;

        if(indexDiff > 0){
            // And using the user PalToken balance deposited in the Controller,
            // we can get how much rewards where accrued
            uint userBalance = supplierDeposits[palPool][user];

            uint userAccruedRewards = (userBalance * indexDiff) / 1e36;

            // Add the new amount of rewards to the user total claimable balance
            accruedRewards[user] += userAccruedRewards;
        }

    }

    /**
    * @notice Internal - Accrues reward to the PalLoan owner when the Loan is closed
    * @param palPool address of the PalPool the Loan comes from
    * @param loanAddress address of the PalLoan contract
    */
    function accrueBorrowRewards(address palPool, address loanAddress) internal {
        // Get the Pool BorrowRatio for rewards
        uint poolBorrowRatio = borrowRatios[palPool];

        // Skip if no rewards set for the Pool
        if(poolBorrowRatio > 0){
            IPalPool pool = IPalPool(palPool);

            // Get the Borrower, and the amount of fees used by the Loan
            // And using the borrowRatio, accrue rewards for the borrower
            // The amount ot be accrued is calculated as feesUsed * borrowRatio
            address borrower;
            uint feesUsedAmount;

            (borrower,,,,,,,feesUsedAmount,,,,) = pool.getBorrowData(loanAddress);

            uint userAccruedRewards = (feesUsedAmount * feesUsedAmount) / 1e18;

            // Add the new amount of rewards to the user total claimable balance
            accruedRewards[borrower] += userAccruedRewards;
        }

    }

    function _calculateLoanRewards(address palPool, address loanAddress) internal view returns(uint){
        // Rewards already claimed
        if(isLoanRewardClaimed[loanAddress]) return 0;

        IPalPool pool = IPalPool(palPool);
        (,,,,,,,uint feesUsedAmount,uint loanStartBlock,,bool closed,) = pool.getBorrowData(loanAddress);

        // Need the Loan to be closed before accruing rewards
        if(!closed) return 0;

        // Loan as taken before Borrow Rewards were set
        if(borrowRewardsStartBlock[palPool] == 0 || borrowRewardsStartBlock[palPool] > loanStartBlock) return 0;

        // Calculate the amount of rewards based on the Pool ratio & the amount of usedFees in the Loan
        uint poolBorrowRatio = loansBorrowRatios[loanAddress] > 0 ? loansBorrowRatios[loanAddress] : borrowRatios[palPool];

        return (feesUsedAmount * poolBorrowRatio) / 1e18;
    }

    /**
    * @notice Returns the current amount of reward tokens the user can claim for a PalLoan
    * @param palPool address of the PalPool
    * @param loanAddress address of the PalLoan
    */
    function claimableLoanRewards(address palPool, address loanAddress) external view override returns(uint) {
        return _calculateLoanRewards(palPool, loanAddress);
    }

    function claimLoanRewards(address palPool, address loanAddress) external override {
        palPool;
        loanAddress;
        revert();
    }

    /**
    * @notice Returns the current amount of reward tokens the user can claim
    * @param user address of user
    */
    function claimable(address user) external view override returns(uint) {
        return accruedRewards[user];
    }

    /**
    * @notice Returns the current amount of reward tokens the user can claim + the estimation from last Supplier Index updates
    * @param user address of user
    */
    function estimateClaimable(address user) external view override returns(uint){
        //All the rewards already accrued and not claimed
        uint _total = accruedRewards[user];

        //Calculate the estimated pending rewards for all Pools for the user
        //(depending on the last Pool's updateSupplyIndex)
        address[] memory _pools = palPools;
        for(uint i = 0; i < _pools.length; i++){
            // Get the current reward index for the Pool
            // And the user last reward index
            uint currentSupplyIndex = supplyRewardState[_pools[i]].index;
            uint userSupplyIndex = supplierRewardIndex[_pools[i]][user];

            if(userSupplyIndex == 0 && currentSupplyIndex >= initialRewardsIndex){
                // Set the initial Index for the user
                userSupplyIndex = initialRewardsIndex;
            }

            // Get the difference of index with the last one for user
            uint indexDiff = currentSupplyIndex - userSupplyIndex;

            if(indexDiff > 0){
                // And using the user PalToken balance deposited in the Controller,
                // we can get how much rewards where accrued
                uint userBalance = supplierDeposits[_pools[i]][user];

                uint userAccruedRewards = (userBalance * indexDiff) / 1e36;

                // Add the new amount of rewards to the user total claimable balance
                _total += userAccruedRewards;
            }
        }

        return _total;
    }

    /**
    * @notice Update the claimable rewards for a given user
    * @param user address of user
    */
    function updateUserRewards(address user) external override {
        user;
        revert();
    }

    /**
    * @notice Accrues rewards for the user, then send all rewards tokens claimable
    * @param user address of user
    */
    function claim(address user) external override {
        user;
        revert();
    }

    /**
    * @notice Returns the global Supply distribution speed
    * @return uint : Total Speed
    */
    function totalSupplyRewardSpeed() external view override returns(uint) {
        // Sum up the SupplySpeed for all the listed PalPools
        address[] memory _pools = palPools;
        uint totalSpeed = 0;
        for(uint i = 0; i < _pools.length; i++){
            totalSpeed += supplySpeeds[_pools[i]];
        }
        return totalSpeed;
    }


    /** @notice Address of the reward Token (PAL token) */
    function rewardToken() public view returns(address) {
        return rewardTokenAddress;
    }

    
    //Admin function

    function becomeImplementation(ControllerProxy proxy) external override adminOnly {
        // Only to call after the contract was set as Pending Implementation in the Proxy contract
        // To accept the delegatecalls, and update the Implementation address in the Proxy
        if(!proxy.acceptImplementation()) revert Errors.FailBecomeImplementation();
    }

    function updateRewardToken(address newRewardTokenAddress) external override adminOnly {
        rewardTokenAddress = newRewardTokenAddress;
    }

    // Allows to withdraw reward tokens from the Controller if rewards are removed or changed
    function withdrawRewardToken(uint256 amount, address recipient) external override adminOnly {
        if(recipient == address(0)) revert Errors.ZeroAddress();
        if(amount == 0) revert Errors.InvalidParameters();

        IERC20 token = IERC20(rewardToken());

        if(amount > token.balanceOf(address(this))) revert Errors.BalanceTooLow();

        token.safeTransfer(recipient, amount);
    }

    function setPoolsNewController(address _newController) external override adminOnly returns(bool){
        address[] memory _pools = palPools;
        for(uint i = 0; i < _pools.length; i++){
            IPalPool _palPool = IPalPool(_pools[i]);
            _palPool.setNewController(_newController);
        }
        return true;
    }


    function withdrawFromPool(address _pool, uint _amount, address _recipient) external override adminOnly returns(bool){
        IPalPool _palPool = IPalPool(_pool);
        _palPool.withdrawFees(_amount, _recipient);
        return true;
    }

    // set a pool rewards values (admin)
    function updatePoolRewards(address palPool, uint newSupplySpeed, uint newBorrowRatio, bool autoBorrowReward) external override adminOnly {
        if(!isPalPool(palPool)) revert Errors.PoolNotListed();

        if(newSupplySpeed != supplySpeeds[palPool]){
            //Make sure it's updated before setting the new speed
            updateSupplyIndex(palPool);

            supplySpeeds[palPool] = newSupplySpeed;
        }

        if(newBorrowRatio != borrowRatios[palPool]){
            borrowRatios[palPool] = newBorrowRatio;
        }

        if(borrowRewardsStartBlock[palPool] == 0 && newBorrowRatio != 0){
            borrowRewardsStartBlock[palPool] = block.number;
        }
        else if(newBorrowRatio == 0){
            borrowRewardsStartBlock[palPool] = 0;
        }

        autoBorrowRewards[palPool] = autoBorrowReward;

        emit PoolRewardsUpdated(palPool, newSupplySpeed, newBorrowRatio, autoBorrowReward);
    }
    
    
    //Math utils

    function safe224(uint n) internal pure returns (uint224) {
        require(n < 2**224, "Number is over 224 bits");
        return uint224(n);
    }

    function safe32(uint n) internal pure returns (uint32) {
        require(n < 2**32, "Number is over 32 bits");
        return uint32(n);
    }


}