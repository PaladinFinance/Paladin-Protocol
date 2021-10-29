//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "./utils/SafeMath.sol";
import "./IPaladinController.sol";
import "./ControllerProxy.sol";
import "./PalPool.sol";
import "./IPalPool.sol";
import "./IPalToken.sol";
import "./utils/IERC20.sol";
import "./utils/Admin.sol";
import "./utils/Errors.sol";  // -----------------> Set Controller Error codes

/** @title Paladin Controller contract  */
/// @author Paladin
contract PaladinController is IPaladinController, Admin {
    using SafeMath for uint;

    /** @notice Layout for the Proxy contract */
    address public currentIplementation;
    address public pendingImplementation;

    /** @notice List of current active palToken Pools */
    address[] public palTokens;
    address[] public palPools;

    bool private initialized = false;

    /** @notice Struct with current SupplyIndex for a Pool, and the block of the last update */
    struct PoolRewardsState {
        uint224 index;
        uint32 blockNumber;
    }

    /** @notice Address of the reward Token (PAL token) */
    address public constant rewardToken = address(0); //put PAL token address here

    /** @notice Initial index for Rewards */
    uint224 public constant initialRewardsIndex = 1e36;

    /** @notice State of the Rewards for each Pool */
    mapping(address => PoolRewardsState) public supplyRewardState;

    /** @notice Amount of reward tokens to disitribute each block */
    mapping(address => uint) public supplySpeeds;

    /** @notice Last reward index for each Pool for each user */
    // PalPool => User => Index
    mapping(address => mapping(address => uint)) public supplierRewardIndex;

    /** @notice Ratio to distribute Borrow Rewards */
    mapping(address => uint) public borrowRatios; // scaled 1e18

    /** @notice Amount of reward Tokens accrued by the user, and claimable */
    mapping(address => uint) public accruedRewards;

    /*
    !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    !!!!!!!!!!!!!!!!!! ALWAYS PUT NEW STORAGE AT THE BOTTOM !!!!!!!!!!!!!!!!!!
    !!!!!!!!! WE DON'T WANT COLLISION WHEN SWITCHING IMPLEMENTATIONS !!!!!!!!!
    !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    */


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
        require(!initialized, Errors.POOL_LIST_ALREADY_SET);
        require(_palTokens.length == _palPools.length, Errors.LIST_SIZES_NOT_EQUAL);
        palPools = _palPools;
        palTokens = _palTokens;
        initialized = true;
        return true;
    }
    
    /**
    * @notice Add a new PalPool/PalToken couple to the controller list
    * @param _palToken address of the PalToken contract
    * @param _palPool address of the PalPool contract
    * @return bool : Success
    */ 
    function addNewPool(address _palToken, address _palPool) external override adminOnly returns(bool){
        //Add a new address to the palToken & palPool list
        require(!isPalPool(_palPool), Errors.POOL_ALREADY_LISTED);

        palTokens.push(_palToken);
        palPools.push(_palPool);

        //Update the Reward State for the new Pool
        PoolRewardsState storage supplyState = supplyRewardState[_palPool];
        if(supplyState.index == 0){
            supplyState.index = initialRewardsIndex;
        }
        supplyState.blockNumber = safe32(block.number);

        //The other Reward values should already be set at 0 :
        //BorrowRatio : 0
        //SupplySpeed : 0
        //If not set as 0, we want ot use last values (or change them with the adequate function beforehand)
        emit NewPalPool(_palPool, _palToken);

        return true;
    }

    
    /**
    * @notice Remove a PalPool from the list (& the related PalToken)
    * @param _palPool address of the PalPool contract to remove
    * @return bool : Success
    */ 
    function removePool(address _palPool) external override adminOnly returns(bool){
        //Remove a palToken & palPool from the list
        require(isPalPool(_palPool), Errors.POOL_NOT_LISTED);

        address[] memory _pools = palPools;
        
        uint lastIndex = (_pools.length).sub(1);
        for(uint i = 0; i < _pools.length; i++){
            if(_pools[i] == _palPool){
                //get the address of the PalToken for the Event
                address _palToken = _pools[i];

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
    function withdrawPossible(address palPool, uint amount) external view override returns(bool){
        //Get the underlying balance of the palPool contract to check if the action is possible
        PalPool _palPool = PalPool(palPool);
        return(_palPool.underlyingBalance() >= amount);
    }
    

    /**
    * @notice Check if the given PalPool has enough cash to borrow
    * @param palPool address of PalPool
    * @param amount amount ot borrow
    * @return bool : true if possible
    */
    function borrowPossible(address palPool, uint amount) external view override returns(bool){
        //Get the underlying balance of the palPool contract to check if the action is possible
        PalPool _palPool = PalPool(palPool);
        return(_palPool.underlyingBalance() >= amount);
    }
    

    /**
    * @notice Check if Deposit was correctly done
    * @param palPool address of PalPool
    * @param dest address to send the minted palTokens
    * @param amount amount of palTokens minted
    * @return bool : Verification Success
    */
    function depositVerify(address palPool, address dest, uint amount) external override returns(bool){
        require(isPalPool(msg.sender), Errors.CALLER_NOT_POOL);

        //Update the Rewards
        updateSupplyIndex(palPool);
        accrueSupplyRewards(palPool, dest);
        
        //Check the amount sent isn't null 
        return amount > 0;
    }


    /**
    * @notice Check if Withdraw was correctly done
    * @param palPool address of PalPool
    * @param dest address to send the underlying tokens
    * @param amount amount of underlying token returned
    * @return bool : Verification Success
    */
    function withdrawVerify(address palPool, address dest, uint amount) external override returns(bool){
        require(isPalPool(msg.sender), Errors.CALLER_NOT_POOL);

        //Update the Rewards
        updateSupplyIndex(palPool);
        accrueSupplyRewards(palPool, dest);

        //Check the amount sent isn't null
        return amount > 0;
    }
    

    /**
    * @notice Check if Borrow was correctly done
    * @param palPool address of PalPool
    * @param borrower borrower's address 
    * @param amount amount of token borrowed
    * @param feesAmount amount of fees paid by the borrower
    * @param loanAddress address of the new deployed PalLoan
    * @return bool : Verification Success
    */
    function borrowVerify(address palPool, address borrower, address delegatee, uint amount, uint feesAmount, address loanAddress) external view override returns(bool){
        require(isPalPool(msg.sender), Errors.CALLER_NOT_POOL);
        
        palPool;
        borrower;
        delegatee;
        amount;
        feesAmount;
        loanAddress;
        
        //no method yet 
        return true;
    }

    /**
    * @notice Check if Expand Borrow was correctly done
    * @param loanAddress address of the PalLoan contract
    * @param newFeesAmount new amount of fees in the PalLoan
    * @return bool : Verification Success
    */
    function expandBorrowVerify(address palPool, address loanAddress, uint newFeesAmount) external view override returns(bool){
        require(isPalPool(msg.sender), Errors.CALLER_NOT_POOL);
        
        palPool;
        loanAddress;
        newFeesAmount;
        
        //no method yet 
        return true;
    }


    /**
    * @notice Check if Borrow Closing was correctly done
    * @param palPool address of PalPool
    * @param borrower borrower's address
    * @param loanAddress address of the PalLoan contract to close
    * @return bool : Verification Success
    */
    function closeBorrowVerify(address palPool, address borrower, address loanAddress) external override returns(bool){
        require(isPalPool(msg.sender), Errors.CALLER_NOT_POOL);
        
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
        require(isPalPool(msg.sender), Errors.CALLER_NOT_POOL);
        
        killer;

        //Accrue Rewards to the Loan's owner
        accrueBorrowRewards(palPool, loanAddress);
        
        //no method yet 
        return true;
    }


    // Rewards functions
    
    function updateSupplyIndex(address palPool) internal {
        PoolRewardsState storage state = supplyRewardState[palPool];
        uint currentBlock = block.number;
        uint supplySpeed = supplySpeeds[palPool];

        uint ellapsedBlocks = currentBlock.sub(uint(state.blockNumber));

        if(ellapsedBlocks > 0 && supplySpeed > 0){
            PalPool pool = PalPool(palPool);
            uint totalSupply = IPalToken(pool.palToken()).totalSupply();

            uint accruedAmount = ellapsedBlocks.mul(supplySpeed);

            uint ratio = totalSupply > 0 ? accruedAmount.mul(1e36).div(totalSupply) : 0;

            state.index = safe224(uint(state.index).add(ratio));
            state.blockNumber = safe32(currentBlock);
        }
        else if(ellapsedBlocks > 0){
            state.blockNumber = safe32(currentBlock);
        }

    }

    function accrueSupplyRewards(address palPool, address user) internal {
        PoolRewardsState storage state = supplyRewardState[palPool];

        uint currentSupplyIndex = state.index;
        uint userSupplyIndex = supplierRewardIndex[palPool][user];

        //Update the Index in the mapping, the local value is used after
        supplierRewardIndex[palPool][user] = currentSupplyIndex;

        if(userSupplyIndex == 0 && currentSupplyIndex >= initialRewardsIndex){
            //Set the initial Index for the user
            userSupplyIndex = initialRewardsIndex;
        }

        //Get the difference of index with the last one for user
        uint indexDiff = currentSupplyIndex.sub(userSupplyIndex);

        if(indexDiff > 0){
            //And using the user PalToken balance (its share in the Pool), we can get how much rewards where accrued
            uint userBalance = IPalPool(palPool).balanceOf(user);

            uint userAccruedRewards = userBalance.mul(userBalance).div(1e36);

            //Add the new amount of rewards to the user total claimable balance
            accruedRewards[user] = accruedRewards[user].add(userAccruedRewards);
        }

    }

    function accrueBorrowRewards(address palPool, address loanAddress) internal {
        uint poolBorrowRatio = borrowRatios[palPool];

        //Skip if no rewards set for the Pool
        if(poolBorrowRatio > 0){
            IPalPool pool = IPalPool(palPool);

            //Get the Borrower, and the amount of fees used by the Loan
            //And using the borrowRatio, accrue rewards for the borrower
            //The amount ot be accrued is calculated as feesUsed * borrowRatio
            address borrower;
            uint feesUsedAmount;

            (borrower,,,,,,,feesUsedAmount,,,,) = pool.getBorrowData(loanAddress);

            uint userAccruedRewards = feesUsedAmount.mul(feesUsedAmount).div(1e18);

            //Add the new amount of rewards to the user total claimable balance
            accruedRewards[borrower] = accruedRewards[borrower].add(userAccruedRewards);
        }

    }

    function claimable(address user) external view override returns(uint) {
        return accruedRewards[user];
    }

    function updateUserRewards(address user) external override {
        address[] memory _pools = palPools;
        for(uint i = 0; i < _pools.length; i++){
            //Need to update the Supply Index
            updateSupplyIndex(_pools[i]);
            //To then accrue the user rewards for that Pool
            accrueSupplyRewards(_pools[i], user);
            //No need to do it for the Borrower rewards
        }
    }

    function claim(address user) external override {
        address[] memory _pools = palPools;
        for(uint i = 0; i < _pools.length; i++){
            //Need to update the Supply Index
            updateSupplyIndex(_pools[i]);
            //To then accrue the user rewards for that Pool
            accrueSupplyRewards(_pools[i], user);
            //No need to do it for the Borrower rewards
        }

        uint toClaim = accruedRewards[user];

        if(toClaim > 0){
            IERC20 token = IERC20(rewardToken);
            require(toClaim <= token.balanceOf(address(this)), Errors.REWARDS_CASH_TOO_LOW);

            //All rewards were accrued and sent to the user, reset the counter
            accruedRewards[user] = 0;

            token.transfer(user, toClaim);

            emit ClaimRewards(user, toClaim);
        }
    }

    function totalSupplyRewardSpeed() external view override returns(uint) {
        address[] memory _pools = palPools;
        uint totalSpeed = 0;
        for(uint i = 0; i < _pools.length; i++){
            totalSpeed = totalSpeed.add(supplySpeeds[_pools[i]]);
        }
        return totalSpeed;
    }

    // set a pool rewards values (admin)
    function updatePoolRewards(address palPool, uint newSupplySpeed, uint newBorrowRatio) external override adminOnly {
        require(isPalPool(palPool), Errors.POOL_NOT_LISTED);

        if(newSupplySpeed != supplySpeeds[palPool]){
            //Make sure it's updated before setting the new speed
            updateSupplyIndex(palPool);

            supplySpeeds[palPool] = newSupplySpeed;
        }

        if(newBorrowRatio != borrowRatios[palPool]){
            borrowRatios[palPool] = newBorrowRatio;
        }

        emit PoolRewardsUpdated(palPool, newSupplySpeed, newBorrowRatio);
    }


    // (admin) send all rewards to other contract/admin ?

        
    
    //Admin function
    function becomeImplementation(ControllerProxy proxy) external override adminOnly {
        require(proxy.acceptImplementation(), Errors.FAIL_BECOME_IMPLEMENTATION);
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

    //Math utils

    function safe224(uint n) pure internal returns (uint224) {
        require(n < 2**224, "Number is over 224 bits");
        return uint224(n);
    }

    function safe32(uint n) pure internal returns (uint32) {
        require(n < 2**32, "Number is over 32 bits");
        return uint32(n);
    }


}