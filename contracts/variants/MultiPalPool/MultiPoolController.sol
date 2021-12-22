//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "../../utils/SafeMath.sol";
import "../../utils/SafeERC20.sol";
import "./MultiControllerStorage.sol";
import "./IMultiPoolController.sol";
import "./IMultiPalPool.sol";
import "../../IPalLoan.sol";
import "../../utils/IERC20.sol";
import "../../utils/Errors.sol";

/** @title Paladin MultiPoolController contract  */
/// @author Paladin
contract MultiPoolController is IMultiPoolController, MultiControllerStorage {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    // Prevent reentry in deposit & withdraw
    modifier lock() {
        require(!locked, Errors.LOCKED);
        locked = true;
        _;
        locked = false;
    }

    constructor(){
        admin = msg.sender;
    }

    //Check if an address is a valid multiPool
    function isPalPool(address _pool) public view override returns(bool){
        //Check if the given address is in the pools list
        address[] memory _pools = pools;
        for(uint i = 0; i < _pools.length; i++){
            if(_pools[i] == _pool){
                return true;
            }
        }
        return false;
    }

    function isPalToken(address _token) public view override returns(bool){
        //Check if the given address is in the allPalTokens list
        address[] memory _tokens = allPalTokens;
        for(uint i = 0; i < _tokens.length; i++){
            if(_tokens[i] == _token){
                return true;
            }
        }
        return false;
    }

    function isPalTokenForPool(address _pool, address _palToken) public view override returns(bool){
        //Check if the given address is in the palPools list
        address[] memory _tokens = palTokens[_pool];
        for(uint i = 0; i < _tokens.length; i++){
            if(_tokens[i] == _palToken){
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
        return allPalTokens;
    }


    /**
    * @notice Get all the PalTokens listed in the controller for a given MulitPool
    * @return address[] : List of PalToken addresses
    */
    function getPalTokens(address _pool) external view override returns(address[] memory){
        return palTokens[_pool];
    }


    /**
    * @notice Get all the PalPools listed in the controller
    * @return address[] : List of PalPool addresses
    */
    function getPools() external view override returns(address[] memory){
        return pools;
    }
    
    /**
    * @notice Add a new MultiPool & its PalToken list to the controller list
    * @param _palTokens array of : address of the PalToken contract
    * @param _pool address of the Pool contract
    * @return bool : Success
    */ 
    function addNewPool(address _pool, address[] memory _palTokens) external adminOnly override returns(bool){
        //Add a new address to the palPool list
        //and its list of palTokens to the mapping
        require(!isPalPool(_pool), Errors.POOL_ALREADY_LISTED);
        require(_palTokens.length > 0, Errors.EMPTY_LIST);
        require(_pool != address(0), Errors.ZERO_ADDRESS);

        pools.push(_pool);
        palTokens[_pool] = _palTokens;

        for(uint i = 0; i < _palTokens.length; i++){
            palTokenToPool[_palTokens[i]] = _pool;
            allPalTokens.push(_palTokens[i]);

            //Update the Reward State for the new PalToken
            TokenRewardsState storage supplyState = supplyRewardState[_palTokens[i]];
            if(supplyState.index == 0){
                supplyState.index = initialRewardsIndex;
            }
            supplyState.blockNumber = safe32(block.number);
        }

        emit NewPool(_pool);

        return true;
    }


    function addNewPalToken(address _pool, address _newPalToken) external adminOnly override returns(bool){
        //Add a Paltoken to the MultiPool list
        require(isPalPool(_pool), Errors.POOL_NOT_LISTED);
        require(!isPalTokenForPool(_pool, _newPalToken), Errors.PALTOKEN_ALREADY_LISTED);
        require(_pool != address(0), Errors.ZERO_ADDRESS);
        require(_newPalToken != address(0), Errors.ZERO_ADDRESS);

        palTokens[_pool].push(_newPalToken);
        palTokenToPool[_newPalToken] = _pool;
        allPalTokens.push(_newPalToken);

        //Update the Reward State for the new PalToken
        TokenRewardsState storage supplyState = supplyRewardState[_newPalToken];
        if(supplyState.index == 0){
            supplyState.index = initialRewardsIndex;
        }
        supplyState.blockNumber = safe32(block.number);

        return true;
    }

    
    /**
    * @notice Remove a Pool from the list (& the related PalTokens)
    * @param _pool address of the Pool contract to remove
    * @return bool : Success
    */ 
    function removePool(address _pool) external adminOnly override returns(bool){
        require(isPalPool(_pool), Errors.POOL_NOT_LISTED);

        address[] memory _pools = pools;

        address[] memory _tokens = palTokens[_pool];

        for(uint j = 0; j < _tokens.length; j++){
            delete palTokenToPool[_tokens[j]];

            uint lastTokenIndex = (allPalTokens.length).sub(1);
            address[] memory _allTokens = allPalTokens;

            for(uint k = 0; k < _allTokens.length; k++){
                
                if(_tokens[j] == _allTokens[k]){

                    //Replace the address to remove with the last one of the array
                    allPalTokens[k] = allPalTokens[lastTokenIndex];

                    //And pop the last item of the array
                    allPalTokens.pop();

                }

            }
        }
        
        uint lastIndex = (_pools.length).sub(1);
        for(uint i = 0; i < _pools.length; i++){
            if(_pools[i] == _pool){

                //Delete the list of palTokens for this Pool
                delete palTokens[_pool];

                //Replace the address to remove with the last one of the array
                pools[i] = pools[lastIndex];

                //And pop the last item of the array
                pools.pop();

                emit RemovePool(_pool);
             
                return true;
            }
        }
        return false;
    }


    /**
    * @notice Check if the given Pool has enough cash to make a withdraw
    * @param pool address of Pool
    * @param amount amount withdrawn
    * @return bool : true if possible
    */
    function withdrawPossible(address pool, address underlying, uint amount) external view override returns(bool){
        //Get the underlying balance of the pool contract to check if the action is possible
        IMultiPalPool _pool = IMultiPalPool(pool);
        return(_pool.underlyingBalance(underlying) >= amount);
    }
    

    /**
    * @notice Check if the given Pool has enough cash to borrow
    * @param pool address of Pool
    * @param amount amount ot borrow
    * @return bool : true if possible
    */
    function borrowPossible(address pool, address underlying, uint amount) external view override returns(bool){
        //Get the underlying balance of the pool contract to check if the action is possible
        IMultiPalPool _pool = IMultiPalPool(pool);
        return(_pool.underlyingBalance(underlying) >= amount);
    }
    

    /**
    * @notice Check if Deposit was correctly done
    * @param pool address of Pool
    * @param dest address to send the minted palTokens
    * @param amount amount of palTokens minted
    * @return bool : Verification Success
    */
    function depositVerify(address pool, address dest, uint amount) external override returns(bool){
        require(isPalPool(msg.sender), Errors.CALLER_NOT_POOL);

        pool;
        dest;
        amount;
        
        //Check the amount sent isn't null 
        return amount > 0;
    }


    /**
    * @notice Check if Withdraw was correctly done
    * @param pool address of Pool
    * @param dest address to send the underlying tokens
    * @param amount amount of underlying token returned
    * @return bool : Verification Success
    */
    function withdrawVerify(address pool, address dest, uint amount) external override returns(bool){
        require(isPalPool(msg.sender), Errors.CALLER_NOT_POOL);
        
        pool;
        dest;
        amount;

        //Check the amount sent isn't null
        return amount > 0;
    }
    

    /**
    * @notice Check if Borrow was correctly done
    * @param pool address of Pool
    * @param borrower borrower's address 
    * @param amount amount of token borrowed
    * @param feesAmount amount of fees paid by the borrower
    * @param loanAddress address of the new deployed PalLoan
    * @return bool : Verification Success
    */
    function borrowVerify(address pool, address borrower, address delegatee, uint amount, uint feesAmount, address loanAddress) external override returns(bool){
        require(isPalPool(msg.sender), Errors.CALLER_NOT_POOL);
        
        borrower;
        delegatee;
        amount;
        feesAmount;

        setLoanBorrowRewards(pool, loanAddress);
        
        return true;
    }

    /**
    * @notice Check if Expand Borrow was correctly done
    * @param pool address of Pool
    * @param loanAddress address of the PalLoan contract
    * @param newFeesAmount new amount of fees in the PalLoan
    * @return bool : Verification Success
    */
    function expandBorrowVerify(address pool, address loanAddress, uint newFeesAmount) external override returns(bool){
        require(isPalPool(msg.sender), Errors.CALLER_NOT_POOL);
        
        newFeesAmount;

        setLoanBorrowRewards(pool, loanAddress);
        
        return true;
    }


    /**
    * @notice Check if Borrow Closing was correctly done
    * @param pool address of Pool
    * @param borrower borrower's address
    * @param loanAddress address of the PalLoan contract to close
    * @return bool : Verification Success
    */
    function closeBorrowVerify(address pool, address borrower, address loanAddress) external override returns(bool){
        require(isPalPool(msg.sender), Errors.CALLER_NOT_POOL);
        
        borrower;

        accrueBorrowRewards(pool, loanAddress);
        
        return true;
    }


    /**
    * @notice Check if Borrow Killing was correctly done
    * @param pool address of Pool
    * @param killer killer's address
    * @param loanAddress address of the PalLoan contract to kill
    * @return bool : Verification Success
    */
    function killBorrowVerify(address pool, address killer, address loanAddress) external override returns(bool){
        require(isPalPool(msg.sender), Errors.CALLER_NOT_POOL);
        
        killer;

        accrueBorrowRewards(pool, loanAddress);
        
        return true;
    }

    // PalToken Deposit/Withdraw functions

    function deposit(address palToken, uint amount) external lock override returns(bool){
        require(isPalToken(palToken), Errors.PALTOKEN_NOT_LISTED);
        address user = msg.sender;
        IERC20 token = IERC20(palToken);

        require(amount <= token.balanceOf(user), Errors.INSUFFICIENT_BALANCE);

        updateSupplyIndex(palToken);
        accrueSupplyRewards(palToken, user);

        supplierDeposits[palToken][user] = supplierDeposits[palToken][user].add(amount);
        totalSupplierDeposits[palToken] = totalSupplierDeposits[palToken].add(amount);

        token.safeTransferFrom(user, address(this), amount);

        emit Deposit(user, palToken, amount);

        return true;
    }


    function withdraw(address palToken, uint amount) external lock override returns(bool){
        require(isPalToken(palToken), Errors.PALTOKEN_NOT_LISTED);
        address user = msg.sender;

        require(amount <= supplierDeposits[palToken][user], Errors.INSUFFICIENT_DEPOSITED);

        updateSupplyIndex(palToken);
        accrueSupplyRewards(palToken, user);

        IERC20 token = IERC20(palToken);

        supplierDeposits[palToken][user] = supplierDeposits[palToken][user].sub(amount);
        totalSupplierDeposits[palToken] = totalSupplierDeposits[palToken].sub(amount);

        token.safeTransfer(user, amount);

        emit Withdraw(user, palToken, amount);

        return true;
    }

    // Rewards functions
    
    /**
    * @notice Internal - Updates the Supply Index of a PalToken for reward distribution
    * @param palToken address of the PalToken to update the Supply Index for
    */
    function updateSupplyIndex(address palToken) internal {
        // Get last palToken Supply Rewards state
        TokenRewardsState storage state = supplyRewardState[palToken];
        // Get the current block number, and the Supply Speed for the given palToken
        uint currentBlock = block.number;
        uint supplySpeed = supplySpeeds[palToken];

        // Calculate the number of blocks since last update
        uint ellapsedBlocks = currentBlock.sub(uint(state.blockNumber));

        // If an update is needed : block ellapsed & non-null speed (rewards to distribute)
        if(ellapsedBlocks > 0 && supplySpeed > 0){
            // Get the Total Amount deposited in the Controller of PalToken
            uint totalDeposited = totalSupplierDeposits[palToken];

            // Calculate the amount of rewards token accrued since last update
            uint accruedAmount = ellapsedBlocks.mul(supplySpeed);

            // And the new ratio for reward distribution to user
            // Based on the amount of rewards accrued, and the change in the TotalSupply
            uint ratio = totalDeposited > 0 ? accruedAmount.mul(1e36).div(totalDeposited) : 0;

            // Write new Supply Rewards values in the storage
            state.index = safe224(uint(state.index).add(ratio));
            state.blockNumber = safe32(currentBlock);
        }
        else if(ellapsedBlocks > 0){
            // If blocks ellapsed, but no rewards to distribute (speed == 0),
            // just write the last update block number
            state.blockNumber = safe32(currentBlock);
        }

    }

    /**
    * @notice Internal - Accrues rewards token to the user claimable balance, depending on the palToken SupplyRewards state
    * @param palToken address of the palToken the user interracted with
    * @param user address of the user to accrue rewards to
    */
    function accrueSupplyRewards(address palToken, address user) internal {
        // Get the Pool current SupplyRewards state
        TokenRewardsState storage state = supplyRewardState[palToken];

        // Get the current reward index for the palToken
        // And the user last reward index
        uint currentSupplyIndex = state.index;
        uint userSupplyIndex = supplierRewardIndex[palToken][user];

        // Update the Index in the mapping, the local value is used after
        supplierRewardIndex[palToken][user] = currentSupplyIndex;

        if(userSupplyIndex == 0 && currentSupplyIndex >= initialRewardsIndex){
            // Set the initial Index for the user
            userSupplyIndex = initialRewardsIndex;
        }

        // Get the difference of index with the last one for user
        uint indexDiff = currentSupplyIndex.sub(userSupplyIndex);

        if(indexDiff > 0){
            // And using the user PalToken balance deposited in the Controller,
            // we can get how much rewards where accrued
            uint userBalance = supplierDeposits[palToken][user];

            uint userAccruedRewards = userBalance.mul(indexDiff).div(1e36);

            // Add the new amount of rewards to the user total claimable balance
            accruedRewards[user] = accruedRewards[user].add(userAccruedRewards);
        }

    }

    /**
    * @notice Internal - Saves the BorrowRewards Ratio for a PalLoan, depending on the Pool
    * @param pool address of the Pool the Loan comes from
    * @param loanAddress address of the PalLoan contract
    */
    function setLoanBorrowRewards(address pool, address loanAddress) internal {
        // Saves the current Borrow Reward Ratio to use for that Loan rewards at Closing/Killing
        loansBorrowRatios[loanAddress] = borrowRatios[pool];
    }

    /**
    * @notice Internal - Accrues reward to the PalLoan owner when the Loan is closed (if the auto-accrue rewards is on for the Pool)
    * @param pool address of the Pool the Loan comes from
    * @param loanAddress address of the PalLoan contract
    */
    function accrueBorrowRewards(address pool, address loanAddress) internal {
        // Get the PalLoan BorrowRatio for rewards
        uint loanBorrowRatio = loansBorrowRatios[loanAddress];

        // Skip if no rewards set for the PalLoan OR if rewards were already claimed for the PalLoan
        if(loanBorrowRatio > 0 && !isLoanRewardClaimed[loanAddress]){
            IMultiPalPool multiPool = IMultiPalPool(pool);

            // Get the Borrower, and the amount of fees used by the Loan
            // And using the borrowRatio, accrue rewards for the borrower
            // The amount ot be accrued is calculated as feesUsed * borrowRatio
            (address borrower,,,,,,,uint feesUsedAmount,,,,) = multiPool.getBorrowData(loanAddress);

            uint userAccruedRewards = feesUsedAmount.mul(loanBorrowRatio).div(1e18);

            // Add the new amount of rewards to the user total claimable balance
            accruedRewards[borrower] = accruedRewards[borrower].add(userAccruedRewards);

            // Set this Loan rewards as claimed/distributed
            isLoanRewardClaimed[loanAddress] = true;
        }

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
        address[] memory _tokens = allPalTokens;
        for(uint i = 0; i < _tokens.length; i++){
            // Get the current reward index for the Pool
            // And the user last reward index
            uint currentSupplyIndex = supplyRewardState[_tokens[i]].index;
            uint userSupplyIndex = supplierRewardIndex[_tokens[i]][user];

            if(userSupplyIndex == 0 && currentSupplyIndex >= initialRewardsIndex){
                // Set the initial Index for the user
                userSupplyIndex = initialRewardsIndex;
            }

            // Get the difference of index with the last one for user
            uint indexDiff = currentSupplyIndex.sub(userSupplyIndex);

            if(indexDiff > 0){
                // And using the user PalToken balance deposited in the Controller,
                // we can get how much rewards where accrued
                uint userBalance = supplierDeposits[_tokens[i]][user];

                uint userAccruedRewards = userBalance.mul(indexDiff).div(1e36);

                // Add the new amount of rewards to the user total claimable balance
                _total = _total.add(userAccruedRewards);
            }
        }

        return _total;
    }

    /**
    * @notice Update the claimable rewards for a given user
    * @param user address of user
    */
    function updateUserRewards(address user) public override {
        address[] memory _tokens = allPalTokens;
        for(uint i = 0; i < _tokens.length; i++){
            // Need to update the Supply Index
            updateSupplyIndex(_tokens[i]);
            // To then accrue the user rewards for that PalToken
            //set at 0 & true for amount & positive, since no change in user LP position
            accrueSupplyRewards(_tokens[i], user);
            // No need to do it for the Borrower rewards
        }
    }

    /**
    * @notice Accrues rewards for the user, then send all rewards tokens claimable
    * @param user address of user
    */
    function claim(address user) external lock override {
        // Accrue any claimable rewards for all the PalTokens for the user
        updateUserRewards(user);

        // Get current amount claimable for the user
        uint toClaim = accruedRewards[user];

        // If there is a claimable amount
        if(toClaim > 0){
            IERC20 token = IERC20(rewardToken());
            require(toClaim <= token.balanceOf(address(this)), Errors.REWARDS_CASH_TOO_LOW);

            // All rewards were accrued and sent to the user, reset the counter
            accruedRewards[user] = 0;

            // Transfer the tokens to the user
            token.safeTransfer(user, toClaim);

            emit ClaimRewards(user, toClaim);
        }
    }

    /**
    * @notice Returns the global Supply distribution speed
    * @return uint : Total Speed
    */
    function totalSupplyRewardSpeed() external view override returns(uint) {
        // Sum up the SupplySpeed for all the listed PalPools
        address[] memory _tokens = allPalTokens;
        uint totalSpeed = 0;
        for(uint i = 0; i < _tokens.length; i++){
            totalSpeed = totalSpeed.add(supplySpeeds[_tokens[i]]);
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
        require(proxy.acceptImplementation(), Errors.FAIL_BECOME_IMPLEMENTATION);
    }

    function updateRewardToken(address newRewardTokenAddress) external override adminOnly {
        rewardTokenAddress = newRewardTokenAddress;
    }


    function setPoolsNewController(address _newController) external adminOnly override returns(bool){
        address[] memory _pools = pools;
        for(uint i = 0; i < _pools.length; i++){
            IMultiPalPool _multiPool = IMultiPalPool(_pools[i]);
            _multiPool.setNewController(_newController);
        }
        return true;
    }


    function withdrawFromPool(address _pool, address _underlying, uint _amount, address _recipient) external adminOnly override returns(bool){
        IMultiPalPool _multiPool = IMultiPalPool(_pool);
        _multiPool.withdrawFees(_underlying, _amount, _recipient);
        return true;
    }

    // set a pool rewards values (admin)
    function updateTokenSupplySpeed(address multiPool, address palToken, uint newSupplySpeed) external override adminOnly {
        require(isPalTokenForPool(multiPool, palToken), Errors.POOL_NOT_LISTED);

        if(newSupplySpeed != supplySpeeds[palToken]){
            //Make sure it's updated before setting the new speed
            updateSupplyIndex(palToken);

            supplySpeeds[palToken] = newSupplySpeed;
        }

        emit SupplySpeedUpdated(multiPool, palToken, newSupplySpeed);
    }

    function updatePoolBorrowRatio(address multiPool, uint newBorrowRatio) external override adminOnly {
        require(isPalPool(multiPool), Errors.POOL_NOT_LISTED);

        if(newBorrowRatio != borrowRatios[multiPool]){
            borrowRatios[multiPool] = newBorrowRatio;
        }

        emit BorrowRatioUpdated(multiPool, newBorrowRatio);
    }

    // (admin) send all unclaimed/non-accrued rewards to other contract / to multisig / to admin ?




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