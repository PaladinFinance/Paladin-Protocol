import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PaladinController } from "../../typechain/PaladinController";
import { Comp } from "../../typechain/Comp";
import { PalToken } from "../../typechain/PalToken";
import { PalPool } from "../../typechain/PalPool";
import { PalLoanToken } from "../../typechain/PalLoanToken";
import { InterestCalculator } from "../../typechain/InterestCalculator";
import { BasicDelegator } from "../../typechain/BasicDelegator";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

chai.use(solidity);
const { expect } = chai;

const mantissa = ethers.utils.parseEther('1')
const doubleMantissa = ethers.utils.parseEther('1000000000000000000')

let controllerFactory: ContractFactory
let erc20Factory: ContractFactory

let poolFactory: ContractFactory
let tokenFactory: ContractFactory
let delegatorFactory: ContractFactory
let interestFactory: ContractFactory
let palLoanTokenFactory: ContractFactory


describe('Paladin Controller - Rewards System tests', () => {
    let admin: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress

    let controller: PaladinController

    let pool1: PalPool
    let token1: PalToken
    let pool2: PalPool
    let token2: PalToken
    let loanToken: PalLoanToken
    let delegator: BasicDelegator
    let interest: InterestCalculator
    let underlying: Comp
    let rewardToken: Comp

    let fakeLoan: SignerWithAddress

    let name1: string = "Paladin MOCK 1"
    let symbol1: string = "palMOCK1"
    let name2: string = "Paladin MOCK 2"
    let symbol2: string = "palMOCK2"

    let tx_setPools: any

    const mineBlocks = async (n: number): Promise<any> => {
        for(let i = 0; i < n; i++){
            await ethers.provider.send("evm_mine", [])
        }
        return Promise.resolve()
    }

    before( async () => {
        controllerFactory = await ethers.getContractFactory("PaladinController");
        erc20Factory = await ethers.getContractFactory("Comp");
        tokenFactory = await ethers.getContractFactory("PalToken");
        palLoanTokenFactory = await ethers.getContractFactory("PalLoanToken");
        poolFactory = await ethers.getContractFactory("PalPool");
        delegatorFactory = await ethers.getContractFactory("BasicDelegator");
        interestFactory = await ethers.getContractFactory("InterestCalculator");
    })

    beforeEach( async () => {
        [
            admin,
            user1,
            user2,
            user3,
            fakeLoan
        ] = await ethers.getSigners();

        controller = (await controllerFactory.deploy()) as PaladinController;

        underlying = (await erc20Factory.connect(admin).deploy(admin.address)) as Comp;
        await underlying.deployed();

        rewardToken = (await erc20Factory.connect(admin).deploy(admin.address)) as Comp;
        await rewardToken.deployed();

        //2 pools with 2 tokens
        token1 = (await tokenFactory.connect(admin).deploy(name1, symbol1)) as PalToken;
        await token1.deployed();

        token2 = (await tokenFactory.connect(admin).deploy(name2, symbol2)) as PalToken;
        await token2.deployed();

        loanToken = (await palLoanTokenFactory.connect(admin).deploy(controller.address, "about:blank")) as PalLoanToken;
        await loanToken.deployed();

        interest = (await interestFactory.connect(admin).deploy()) as InterestCalculator;
        await interest.deployed();

        delegator = (await delegatorFactory.connect(admin).deploy()) as BasicDelegator;
        await delegator.deployed();

        pool1 = (await poolFactory.connect(admin).deploy(
            token1.address,
            controller.address, 
            underlying.address,
            interest.address,
            delegator.address,
            loanToken.address
        )) as PalPool;
        await pool1.deployed();

        await token1.initiate(pool1.address);

        pool2 = (await poolFactory.connect(admin).deploy(
            token2.address,
            controller.address, 
            underlying.address,
            interest.address,
            delegator.address,
            loanToken.address
        )) as PalPool;
        await pool2.deployed();

        await token2.initiate(pool2.address);

        const pools_list = [pool1.address, pool2.address]
        const tokens_list = [token1.address, token2.address]

        tx_setPools = await controller.connect(admin).setInitialPools(tokens_list, pools_list);

    });


    it(' should be deployed', async () => {
        expect(controller.address).to.properAddress
    });


    describe('Rewards Values (Storage)', async () => {

        const supplySpeed = ethers.utils.parseEther("0.25")
        const borrowRatio = ethers.utils.parseEther("0.75")
    
        it(' should have the correct base values in storage', async () => {
            
            const expected_initial_index = ethers.utils.parseUnits("1", 36);

            const reward_token_address = await controller.rewardToken();
            const initialIndex = await controller.initialRewardsIndex();

            expect(reward_token_address).to.be.eq(ethers.constants.AddressZero)
            expect(initialIndex).to.be.eq(expected_initial_index)


            const setPools_block = (await tx_setPools).blockNumber || 0

            const supplyRewardState1 = await controller.supplyRewardState(pool1.address)
            const supplyRewardState2 = await controller.supplyRewardState(pool1.address)

            expect(await supplyRewardState1.index).to.be.eq(initialIndex)
            expect(await supplyRewardState2.index).to.be.eq(initialIndex)

            expect(await supplyRewardState1.blockNumber).to.be.eq(setPools_block)
            expect(await supplyRewardState2.blockNumber).to.be.eq(setPools_block)


            expect(await controller.supplySpeeds(pool1.address)).to.be.eq(0)
            expect(await controller.supplySpeeds(pool2.address)).to.be.eq(0)


            expect(await controller.supplierRewardIndex(pool1.address, user1.address)).to.be.eq(0)
            expect(await controller.supplierRewardIndex(pool2.address, user1.address)).to.be.eq(0)

            expect(await controller.supplierRewardIndex(pool1.address, user2.address)).to.be.eq(0)
            expect(await controller.supplierRewardIndex(pool2.address, user2.address)).to.be.eq(0)

            expect(await controller.supplierRewardIndex(pool1.address, user3.address)).to.be.eq(0)
            expect(await controller.supplierRewardIndex(pool2.address, user3.address)).to.be.eq(0)


            expect(await controller.borrowRatios(pool1.address)).to.be.eq(0)
            expect(await controller.borrowRatios(pool2.address)).to.be.eq(0)


            expect(await controller.accruedRewards(user1.address)).to.be.eq(0)
            expect(await controller.accruedRewards(user2.address)).to.be.eq(0)
            expect(await controller.accruedRewards(user3.address)).to.be.eq(0)

            expect(await controller.claimable(user1.address)).to.be.eq(0)
            expect(await controller.claimable(user2.address)).to.be.eq(0)
            expect(await controller.claimable(user3.address)).to.be.eq(0)

            expect(await controller.borrowRewardsStartBlock(pool1.address)).to.be.eq(0)
            expect(await controller.borrowRewardsStartBlock(pool2.address)).to.be.eq(0)

        });
    
        it(' should allow admin to set rewards for PalPool', async () => {

            const updateSetting_tx = await controller.connect(admin).updatePoolRewards(pool1.address, supplySpeed, borrowRatio, true)
            
            await expect(updateSetting_tx)
                .to.emit(controller, 'PoolRewardsUpdated')
                .withArgs(pool1.address, supplySpeed, borrowRatio, true);

            expect(await controller.supplySpeeds(pool1.address)).to.be.eq(supplySpeed)
            expect(await controller.borrowRatios(pool1.address)).to.be.eq(borrowRatio)
            expect(await controller.autoBorrowRewards(pool1.address)).to.be.eq(true)
            expect(await controller.borrowRewardsStartBlock(pool1.address)).to.be.eq((await updateSetting_tx).blockNumber)

            const new_supplySpeed = ethers.utils.parseEther("0.35")
            const new_borrowRatio = ethers.utils.parseEther("0.55")

            await controller.connect(admin).updatePoolRewards(pool1.address, new_supplySpeed, borrowRatio, false);

            expect(await controller.supplySpeeds(pool1.address)).to.be.eq(new_supplySpeed)
            expect(await controller.borrowRatios(pool1.address)).to.be.eq(borrowRatio)
            expect(await controller.autoBorrowRewards(pool1.address)).to.be.eq(false)
            expect(await controller.borrowRewardsStartBlock(pool1.address)).to.be.eq((await updateSetting_tx).blockNumber)

            await controller.connect(admin).updatePoolRewards(pool1.address, new_supplySpeed, new_borrowRatio, true);

            expect(await controller.supplySpeeds(pool1.address)).to.be.eq(new_supplySpeed)
            expect(await controller.borrowRatios(pool1.address)).to.be.eq(new_borrowRatio)
            expect(await controller.autoBorrowRewards(pool1.address)).to.be.eq(true)
            expect(await controller.borrowRewardsStartBlock(pool1.address)).to.be.eq((await updateSetting_tx).blockNumber)

        });
    
        it(' should allow admin to set reward token', async () => {

            const pal_contract_address = "0xAB846Fb6C81370327e784Ae7CbB6d6a6af6Ff4BF";
            
            await controller.connect(admin).updateRewardToken(pal_contract_address)

            const reward_token_address = await controller.rewardToken();

            expect(reward_token_address).to.be.eq(pal_contract_address)

            await expect(
                controller.connect(user1).updateRewardToken(rewardToken.address)
            ).to.be.revertedWith('1')

        });
    
        it(' should not allow non-admin to set rewards for PalPool', async () => {
            
            await expect(
                controller.connect(user1).updatePoolRewards(pool1.address, supplySpeed, borrowRatio, true)
            ).to.be.revertedWith('1')

        });
    
        it(' should not reset supplyRewardState.index if a previous one is not null', async () => {

            const amount = ethers.utils.parseEther('500')
            await underlying.connect(admin).transfer(user1.address, amount)
            await underlying.connect(user1).approve(pool1.address, amount)
            await pool1.connect(user1).deposit(amount)
            const user_palToken_amount = await token1.balanceOf(user1.address)
            await token1.connect(user1).approve(controller.address, user_palToken_amount)
            await controller.connect(user1).deposit(token1.address, user_palToken_amount)
            
            await controller.connect(admin).updatePoolRewards(pool1.address, supplySpeed, 0, true);

            await mineBlocks(75)

            await controller.connect(user1).updateUserRewards(user1.address)

            const supplyRewardState1 = await controller.supplyRewardState(pool1.address)
            const initialIndex = await controller.initialRewardsIndex();
            expect(supplyRewardState1.index).not.to.be.eq(initialIndex)

            await controller.connect(admin).removePool(pool1.address)
            await controller.connect(admin).addNewPool(token1.address, pool1.address)

            const supplyRewardState2 = await controller.supplyRewardState(pool1.address)
            expect(supplyRewardState2.index).not.to.be.eq(initialIndex)
            expect(supplyRewardState2.index).to.be.eq(supplyRewardState1.index)

        });

        it(' should sum up supply speeds correctly', async () => {

            const supplySpeed1 = ethers.utils.parseEther("0.3")
            const supplySpeed2 = ethers.utils.parseEther("0.55")
            
            await controller.connect(admin).updatePoolRewards(pool1.address, supplySpeed1, 0, true);
            await controller.connect(admin).updatePoolRewards(pool2.address, supplySpeed2, 0, true);

            const controller_totalSpeed = await controller.totalSupplyRewardSpeed()

            expect(controller_totalSpeed).to.be.eq(supplySpeed1.add(supplySpeed2))

        });

        it(' should reset borrowRewardsStartBlock when Borrow Rewards Ratio is set back to 0', async () => {

            const updateSetting_tx = await controller.connect(admin).updatePoolRewards(pool1.address, supplySpeed, borrowRatio, false)

            expect(await controller.borrowRewardsStartBlock(pool1.address)).to.be.eq((await updateSetting_tx).blockNumber)

            await controller.connect(admin).updatePoolRewards(pool1.address, supplySpeed, 0, false)

            expect(await controller.borrowRewardsStartBlock(pool1.address)).to.be.eq(0)

        });

    });


    describe('Supply Rewards', async () => {

        const supplySpeed = ethers.utils.parseEther("0.25")

        const reward_amount = ethers.utils.parseEther('100')

        const deposit_amount = ethers.utils.parseEther('500')
        const deposit_amount2 = ethers.utils.parseEther('350')

        beforeEach( async () => {
            await underlying.connect(admin).transfer(user1.address, deposit_amount)
            await underlying.connect(user1).approve(pool1.address, deposit_amount)

            await pool1.connect(user1).deposit(deposit_amount)
            
            await controller.connect(admin).updatePoolRewards(pool1.address, supplySpeed, 0, true);

            await controller.connect(admin).updateRewardToken(rewardToken.address)

            await rewardToken.connect(admin).transfer(controller.address, reward_amount)

        });
    
        it(' should have the correct Supply Speeds', async () => {
            
            expect(await controller.supplySpeeds(pool1.address)).to.be.eq(supplySpeed)
            expect(await controller.supplySpeeds(pool2.address)).to.be.eq(0)

        });
    
        it(' should allow to deposit correclty (& with correct Event)', async () => {
            
            const user_palToken_amount = await token1.balanceOf(user1.address)

            expect(await controller.supplierDeposits(pool1.address, user1.address)).to.be.eq(0)
            expect(await controller.totalSupplierDeposits(pool1.address)).to.be.eq(0)

            await token1.connect(user1).approve(controller.address, user_palToken_amount)

            await expect(controller.connect(user1).deposit(token1.address, user_palToken_amount))
                .to.emit(controller, 'Deposit')
                .withArgs(user1.address, token1.address, user_palToken_amount);

            expect(await controller.supplierDeposits(pool1.address, user1.address)).to.be.eq(user_palToken_amount)
            expect(await controller.totalSupplierDeposits(pool1.address)).to.be.eq(user_palToken_amount)

            await underlying.connect(admin).transfer(user2.address, deposit_amount2)
            await underlying.connect(user2).approve(pool1.address, deposit_amount2)

            await pool1.connect(user2).deposit(deposit_amount2)

            const user_palToken_amount2 = await token1.balanceOf(user2.address)

            await token1.connect(user2).approve(controller.address, user_palToken_amount2)

            await controller.connect(user2).deposit(token1.address, user_palToken_amount2)

            expect(await controller.supplierDeposits(pool1.address, user2.address)).to.be.eq(user_palToken_amount2)
            expect(await controller.totalSupplierDeposits(pool1.address)).to.be.eq(user_palToken_amount.add(user_palToken_amount2))


            await token1.connect(user1).approve(controller.address, user_palToken_amount)
            await expect(
                controller.connect(user1).deposit(token1.address, user_palToken_amount)
            ).to.be.revertedWith('10')

        });
    
        it(' should allow to withdraw correctly (& with correct Event)', async () => {
            
            const user_palToken_amount = await token1.balanceOf(user1.address)
            await token1.connect(user1).approve(controller.address, user_palToken_amount)
            await controller.connect(user1).deposit(token1.address, user_palToken_amount)

            const to_withdraw_amount = user_palToken_amount.div(2)

            await expect(controller.connect(user1).withdraw(token1.address, to_withdraw_amount))
                .to.emit(controller, 'Withdraw')
                .withArgs(user1.address, token1.address, to_withdraw_amount);

            expect(await controller.supplierDeposits(pool1.address, user1.address)).to.be.eq(user_palToken_amount.sub(to_withdraw_amount))
            expect(await controller.totalSupplierDeposits(pool1.address)).to.be.eq(user_palToken_amount.sub(to_withdraw_amount))

            await expect(
                controller.connect(user2).withdraw(token1.address, user_palToken_amount)
            ).to.be.revertedWith('43')

        });
    
        it(' should not accrue rewards if PalTokens are not deposited in the Controller', async () => {

            //user1 deposited in pool1 before, but not in the controller

            expect(await controller.claimable(user1.address)).to.be.eq(0)

            await mineBlocks(150)

            await controller.connect(user1).updateUserRewards(user1.address)

            expect(await controller.claimable(user1.address)).to.be.eq(0)

        });
    
        it(' should accrue rewards to depositor (& allow to claim it) + set the correct SupplyRewardStates', async () => {

            const initial_index = await controller.initialRewardsIndex()
            const user1_palToken_amount = await token1.balanceOf(user1.address)

            await token1.connect(user1).approve(controller.address, user1_palToken_amount)

            const deposit_tx = await controller.connect(user1).deposit(token1.address, user1_palToken_amount)

            const supplyRewardState1 = await controller.supplyRewardState(pool1.address)
            expect(await controller.supplierRewardIndex(pool1.address, user1.address)).to.be.eq(supplyRewardState1.index)
            expect(await controller.supplierRewardIndex(pool2.address, user1.address)).to.be.eq(0)

            const deposit_block = (await deposit_tx).blockNumber || 0
            expect(supplyRewardState1.blockNumber).to.be.eq(deposit_block)

            await mineBlocks(150)

            const update_tx = await controller.connect(user1).updateUserRewards(user1.address)
            const update_block = (await update_tx).blockNumber || 0

            const user_claimable = await controller.claimable(user1.address)

            const estimated_accrued_rewards = supplySpeed.mul(update_block - deposit_block)

            const new_supplyRewardState1 = await controller.supplyRewardState(pool1.address)
            expect(await controller.supplierRewardIndex(pool1.address, user1.address)).to.be.eq(new_supplyRewardState1.index)
            expect(await controller.supplierRewardIndex(pool2.address, user1.address)).to.be.eq(initial_index)
            expect(new_supplyRewardState1.blockNumber).to.be.eq(update_block)

            expect(user_claimable).to.be.eq(estimated_accrued_rewards)

            const old_balance = await rewardToken.balanceOf(user1.address)

            const claim_tx = await controller.connect(user1).claim(user1.address)
            const claim_block = (await claim_tx).blockNumber || 0

            const new_balance = await rewardToken.balanceOf(user1.address)

            const estimated_accrued_rewards_2 = supplySpeed.mul(claim_block - update_block)

            expect(await controller.claimable(user1.address)).to.be.eq(0)
            expect(new_balance.sub(old_balance)).to.be.eq(estimated_accrued_rewards.add(estimated_accrued_rewards_2))
            
        });
    
        it(' should accrue rewards with multiple depositors in the Pool', async () => {

            await underlying.connect(admin).transfer(user2.address, deposit_amount2)
            await underlying.connect(user2).approve(pool1.address, deposit_amount2)
            await pool1.connect(user2).deposit(deposit_amount2)
            
            const user1_palToken_amount = await token1.balanceOf(user1.address)
            const user2_palToken_amount = await token1.balanceOf(user2.address)

            await token1.connect(user1).approve(controller.address, user1_palToken_amount)
            await token1.connect(user2).approve(controller.address, user2_palToken_amount)


            const deposit_tx1 = await controller.connect(user1).deposit(token1.address, user1_palToken_amount)

            const supplyRewardState1 = await controller.supplyRewardState(pool1.address)
            expect(await controller.supplierRewardIndex(pool1.address, user1.address)).to.be.eq(supplyRewardState1.index)
            const deposit_block1 = (await deposit_tx1).blockNumber || 0
            expect(supplyRewardState1.blockNumber).to.be.eq(deposit_block1)


            const deposit_tx2 = await controller.connect(user2).deposit(token1.address, user2_palToken_amount)

            const supplyRewardState2 = await controller.supplyRewardState(pool1.address)
            expect(await controller.supplierRewardIndex(pool1.address, user2.address)).to.be.eq(supplyRewardState2.index)
            const deposit_block2 = (await deposit_tx2).blockNumber || 0
            expect(supplyRewardState2.blockNumber).to.be.eq(deposit_block2)


            await mineBlocks(123)


            const totalDeposited = await controller.totalSupplierDeposits(pool1.address)


            const update_tx1 = await controller.connect(user1).updateUserRewards(user1.address)
            const update_block1 = (await update_tx1).blockNumber || 0

            const user1_claimable = await controller.claimable(user1.address)

            const estimated_accrued_rewards_user1 = supplySpeed.mul(deposit_block2 - deposit_block1).add(
                supplySpeed.mul(update_block1 - deposit_block2).mul(
                    user1_palToken_amount.mul(doubleMantissa).div(totalDeposited)
                ).div(doubleMantissa)
            )

            
            const update_tx2 = await controller.connect(user2).updateUserRewards(user2.address)
            const update_block2 = (await update_tx2).blockNumber || 0

            const user2_claimable = await controller.claimable(user2.address)

            const estimated_accrued_rewards_user2 = supplySpeed.mul(update_block2 - deposit_block2).mul(
                user2_palToken_amount.mul(doubleMantissa).div(totalDeposited)
            ).div(doubleMantissa)

            const new_supplyRewardState1 = await controller.supplyRewardState(pool1.address)
            expect(await controller.supplierRewardIndex(pool1.address, user2.address)).to.be.eq(new_supplyRewardState1.index)
            expect(new_supplyRewardState1.blockNumber).to.be.eq(update_block2)

            expect(user1_claimable).to.be.closeTo(estimated_accrued_rewards_user1, 10)
            expect(user2_claimable).to.be.closeTo(estimated_accrued_rewards_user2, 10)


            const old_balance1 = await rewardToken.balanceOf(user1.address)

            const claim1_tx = await controller.connect(user1).claim(user1.address)
            const claim1_block = (await claim1_tx).blockNumber || 0

            const new_balance1 = await rewardToken.balanceOf(user1.address)

            const estimated_accrued_rewards_user1_2 = supplySpeed.mul(claim1_block - update_block1).mul(
                user1_palToken_amount.mul(doubleMantissa).div(totalDeposited)
            ).div(doubleMantissa)

            expect(await controller.claimable(user1.address)).to.be.eq(0)
            expect(new_balance1.sub(old_balance1)).to.be.closeTo(estimated_accrued_rewards_user1.add(estimated_accrued_rewards_user1_2), 10)


            const old_balance2 = await rewardToken.balanceOf(user2.address)

            const claim2_tx = await controller.connect(user2).claim(user2.address)
            const claim2_block = (await claim2_tx).blockNumber || 0

            const new_balance2 = await rewardToken.balanceOf(user2.address)

            const estimated_accrued_rewards_user2_2 = supplySpeed.mul(claim1_block - update_block2).mul(
                user2_palToken_amount.mul(doubleMantissa).div(totalDeposited)
            ).div(doubleMantissa).add(
                supplySpeed.mul(claim2_block - claim1_block).mul(
                    user2_palToken_amount.mul(doubleMantissa).div(totalDeposited)
                ).div(doubleMantissa)
            )

            expect(await controller.claimable(user2.address)).to.be.eq(0)
            expect(new_balance2.sub(old_balance2)).to.be.closeTo(estimated_accrued_rewards_user2.add(estimated_accrued_rewards_user2_2), 10)

        });
    
        it(' should not accrue rewards if no speed was set + set the correct SupplyRewardStates', async () => {
            
            await underlying.connect(admin).transfer(user2.address, deposit_amount)
            await underlying.connect(user2).approve(pool2.address, deposit_amount)

            await pool2.connect(user2).deposit(deposit_amount)

            const user2_palToken_amount = await token2.balanceOf(user2.address)

            await token2.connect(user2).approve(controller.address, user2_palToken_amount)

            await controller.connect(user2).deposit(token2.address, user2_palToken_amount)

            await mineBlocks(180)

            expect(await controller.claimable(user2.address)).to.be.eq(0)

        });
    
        it(' should accrue the reward from 2 pools at the same time + set the correct SupplyRewardStates', async () => {
            
            await underlying.connect(admin).transfer(user1.address, deposit_amount)
            await underlying.connect(user1).approve(pool2.address, deposit_amount)
            await pool2.connect(user1).deposit(deposit_amount)

            const supplySpeed2 = ethers.utils.parseEther("0.45")

            await controller.connect(admin).updatePoolRewards(pool2.address, supplySpeed2, 0, true);

            const user1_palToken1_amount = await token1.balanceOf(user1.address)
            const user1_palToken2_amount = await token2.balanceOf(user1.address)

            await token1.connect(user1).approve(controller.address, user1_palToken1_amount)
            await token2.connect(user1).approve(controller.address, user1_palToken2_amount)

            const deposit1_tx = await controller.connect(user1).deposit(token1.address, user1_palToken1_amount)
            const deposit2_tx = await controller.connect(user1).deposit(token2.address, user1_palToken2_amount)

            const supplyRewardState1 = await controller.supplyRewardState(pool1.address)
            const supplyRewardState2 = await controller.supplyRewardState(pool2.address)
            expect(await controller.supplierRewardIndex(pool1.address, user1.address)).to.be.eq(supplyRewardState1.index)
            expect(await controller.supplierRewardIndex(pool2.address, user1.address)).to.be.eq(supplyRewardState2.index)

            const deposit1_block = (await deposit1_tx).blockNumber || 0
            const deposit2_block = (await deposit2_tx).blockNumber || 0
            expect(supplyRewardState1.blockNumber).to.be.eq(deposit1_block)
            expect(supplyRewardState2.blockNumber).to.be.eq(deposit2_block)

            await mineBlocks(180)

            const update_tx = await controller.connect(user1).updateUserRewards(user1.address)
            const update_block = (await update_tx).blockNumber || 0

            const user_claimable = await controller.claimable(user1.address)

            const estimated_accrued_rewards1 = supplySpeed.mul(update_block - deposit1_block)
            const estimated_accrued_rewards2 = supplySpeed2.mul(update_block - deposit2_block)

            const new_supplyRewardState1 = await controller.supplyRewardState(pool1.address)
            const new_supplyRewardState2 = await controller.supplyRewardState(pool2.address)
            expect(await controller.supplierRewardIndex(pool1.address, user1.address)).to.be.eq(new_supplyRewardState1.index)
            expect(await controller.supplierRewardIndex(pool2.address, user1.address)).to.be.eq(new_supplyRewardState2.index)
            expect(new_supplyRewardState1.blockNumber).to.be.eq(update_block)
            expect(new_supplyRewardState2.blockNumber).to.be.eq(update_block)

            expect(user_claimable).to.be.eq(estimated_accrued_rewards1.add(estimated_accrued_rewards2))

        });
    
        it(' should show good estimateClaimable if Pool SupplyRewardState was updated but user rewards were not accrued', async () => {
            
            await underlying.connect(admin).transfer(user2.address, deposit_amount)
            await underlying.connect(user2).approve(pool1.address, deposit_amount)
            await pool1.connect(user2).deposit(deposit_amount)

            const user1_palToken_amount = await token1.balanceOf(user1.address)

            await token1.connect(user1).approve(controller.address, user1_palToken_amount)

            const user2_palToken_amount = await token1.balanceOf(user2.address)

            await token1.connect(user2).approve(controller.address, user2_palToken_amount)



            const deposit_tx = await controller.connect(user1).deposit(token1.address, user1_palToken_amount)

            const supplyRewardState1 = await controller.supplyRewardState(pool1.address)
            expect(await controller.supplierRewardIndex(pool1.address, user1.address)).to.be.eq(supplyRewardState1.index)

            const deposit_block = (await deposit_tx).blockNumber || 0
            expect(supplyRewardState1.blockNumber).to.be.eq(deposit_block)

            await mineBlocks(150)

            const update_tx = await controller.connect(user2).deposit(token1.address, user2_palToken_amount) //use this method with the same values to update
            const update_block = (await update_tx).blockNumber || 0                                          //the Pool Supply Reward State

            const user_estimateClaimable = await controller.estimateClaimable(user1.address)

            const estimated_accrued_rewards = supplySpeed.mul(update_block - deposit_block)

            const new_supplyRewardState1 = await controller.supplyRewardState(pool1.address)
            expect(await controller.supplierRewardIndex(pool1.address, user1.address)).to.be.eq(supplyRewardState1.index)
            expect(new_supplyRewardState1.blockNumber).to.be.eq(update_block)

            expect(user_estimateClaimable).to.be.eq(estimated_accrued_rewards)

            //Since user2 deposit was the last update, its estimation should be at 0
            expect(await controller.estimateClaimable(user2.address)).to.be.eq(0)

        });
    
        it(' should do a correct update when Supply Speed is updated', async () => {
            
            const new_supplySpeed = ethers.utils.parseEther("0.45")

            const update_tx = await controller.connect(admin).updatePoolRewards(pool1.address, new_supplySpeed, 0, true);

            const update_block = (await update_tx).blockNumber || 0

            const supplyRewardState = await controller.supplyRewardState(pool1.address)
            expect(supplyRewardState.blockNumber).to.be.eq(update_block)

        });
    
        it(' should stop accruing rewards if the Pool speed is set back to 0', async () => {
            
            const user1_palToken_amount = await token1.balanceOf(user1.address)

            await token1.connect(user1).approve(controller.address, user1_palToken_amount)

            await controller.connect(user1).deposit(token1.address, user1_palToken_amount)

            await mineBlocks(150)

            await controller.connect(admin).updatePoolRewards(pool1.address, 0, 0, true);

            const old_claimable_amount = await controller.claimable(user1.address)

            await mineBlocks(200)

            const new_claimable_amount = await controller.claimable(user1.address)

            expect(new_claimable_amount).to.be.eq(old_claimable_amount)

        });
    
        it(' should stop accruing rewards if depositor withdraw palTokens', async () => {
            
            const user1_palToken_amount = await token1.balanceOf(user1.address)

            await token1.connect(user1).approve(controller.address, user1_palToken_amount)

            await controller.connect(user1).deposit(token1.address, user1_palToken_amount)

            await mineBlocks(150)

            await controller.connect(user1).withdraw(token1.address, user1_palToken_amount)

            const old_claimable_amount = await controller.claimable(user1.address)

            await mineBlocks(200)

            const new_claimable_amount = await controller.claimable(user1.address)

            expect(new_claimable_amount).to.be.eq(old_claimable_amount)

        });

    });


    describe('Borrow Rewards - auto accruing', async () => {

        const borrowRatio = ethers.utils.parseEther("0.75")

        const reward_amount = ethers.utils.parseEther('100')

        const deposit_amount = ethers.utils.parseEther('500')
        const borrow_amount = ethers.utils.parseEther('35')
        const borrow_fees = ethers.utils.parseEther('5')
        const expand_fees = ethers.utils.parseEther('1')

        beforeEach( async () => {
            await underlying.connect(admin).transfer(user1.address, deposit_amount)
            await underlying.connect(user1).approve(pool1.address, deposit_amount)
            await pool1.connect(user1).deposit(deposit_amount)

            await underlying.connect(admin).transfer(user2.address, borrow_fees.add(expand_fees))
            await underlying.connect(user2).approve(pool1.address, borrow_fees.add(expand_fees))
            
            await controller.connect(admin).updatePoolRewards(pool1.address, 0, borrowRatio, true);

            await controller.connect(admin).updateRewardToken(rewardToken.address)

            await rewardToken.connect(admin).transfer(controller.address, reward_amount)

        });
    
        it(' should set the right ratio when Borrow starts', async () => {

            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            const loan_ratio = await controller.loansBorrowRatios(loan_address)

            expect(loan_ratio).to.be.eq(borrowRatio)
            
        });
    
        it(' should accrue the right amount amount of rewards based on Loan ratio (& be claimable)', async () => {
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            await pool1.connect(user2).closeBorrow(loan_address)

            const loan_data = await pool1.getBorrowData(loan_address)

            const expected_rewards = (loan_data._feesUsed).mul(borrowRatio).div(mantissa)

            const user_claimable_rewards = await controller.claimable(user2.address)

            expect(expected_rewards).to.be.eq(user_claimable_rewards)

            const old_balance = await rewardToken.balanceOf(user2.address)

            await expect(controller.connect(user2).claim(user2.address))
                .to.emit(controller, 'ClaimRewards')
                .withArgs(user2.address, expected_rewards);

            const new_balance = await rewardToken.balanceOf(user2.address)

            expect(new_balance.sub(old_balance)).to.be.eq(user_claimable_rewards)

            expect(await controller.isLoanRewardClaimed(loan_address)).to.be.true

        });
    
        it(' should still use initial Loan ratio if BorrowRatio is changed', async () => {

            const new_BorrowRatio = ethers.utils.parseEther("0.55")
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            const loan_ratio = await controller.loansBorrowRatios(loan_address)

            expect(loan_ratio).to.be.eq(borrowRatio)

            await controller.connect(admin).updatePoolRewards(pool1.address, 0, new_BorrowRatio, true);
            
            await pool1.connect(user2).closeBorrow(loan_address)

            const loan_data = await pool1.getBorrowData(loan_address)

            const expected_rewards = (loan_data._feesUsed).mul(loan_ratio).div(mantissa)

            const user_claimable_rewards = await controller.claimable(user2.address)

            expect(expected_rewards).to.be.eq(user_claimable_rewards)

        });
    
        it(' should update the ratio if Loan is Expanded', async () => {
            
            const new_BorrowRatio = ethers.utils.parseEther("0.55")
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            await controller.connect(admin).updatePoolRewards(pool1.address, 0, new_BorrowRatio, true);

            await pool1.connect(user2).expandBorrow(loan_address, expand_fees)

            const loan_ratio = await controller.loansBorrowRatios(loan_address)

            expect(loan_ratio).to.be.eq(new_BorrowRatio)

        });
    
        it(' should not allow to claim if not enough Reward Tokens in the Controller', async () => {
            
            const bigger_deposit_amount = ethers.utils.parseEther('5000000')
            const bigger_borrow_amount = ethers.utils.parseEther('35000')
            const bigger_borrow_fees = ethers.utils.parseEther('1500')

            await underlying.connect(admin).transfer(user1.address, bigger_deposit_amount)
            await underlying.connect(user1).approve(pool1.address, bigger_deposit_amount)
            await pool1.connect(user1).deposit(bigger_deposit_amount)

            await underlying.connect(admin).transfer(user2.address, bigger_borrow_fees)
            await underlying.connect(user2).approve(pool1.address, bigger_borrow_fees)


            await pool1.connect(user2).borrow(user2.address, bigger_borrow_amount, bigger_borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            await pool1.connect(user2).closeBorrow(loan_address)

            await expect(
                controller.connect(user2).claim(user2.address)
            ).to.be.revertedWith('41')

        });
    
        it(' should not give rewards if no BorrowRatio set for the Pool', async () => {

            await underlying.connect(admin).transfer(user1.address, deposit_amount)
            await underlying.connect(user1).approve(pool2.address, deposit_amount)
            await pool2.connect(user1).deposit(deposit_amount)

            await underlying.connect(admin).transfer(user2.address, borrow_fees)
            await underlying.connect(user2).approve(pool2.address, borrow_fees)

            
            await pool2.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)


            const loan_address = (await pool2.getLoansByBorrower(user2.address)).slice(-1)[0]

            await pool2.connect(user2).closeBorrow(loan_address)

            const user_claimable_rewards = await controller.claimable(user2.address)

            expect(user_claimable_rewards).to.be.eq(0)

        });
    
        it(' should not allow claiming through claimLoanRewards', async () => {
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            await pool1.connect(user2).closeBorrow(loan_address)

            expect(await controller.claimableLoanRewards(pool1.address, loan_address)).to.be.eq(0)

            await expect(
                controller.connect(user2).claimLoanRewards(pool1.address, loan_address)
            ).to.be.revertedWith('44')

        });

    });

    describe('Borrow Rewards - non-auto accruing', async () => {

        const borrowRatio = ethers.utils.parseEther("0.75")

        const reward_amount = ethers.utils.parseEther('100')

        const deposit_amount = ethers.utils.parseEther('500')
        const borrow_amount = ethers.utils.parseEther('35')
        const borrow_fees = ethers.utils.parseEther('5')

        beforeEach( async () => {
            await underlying.connect(admin).transfer(user1.address, deposit_amount)
            await underlying.connect(user1).approve(pool1.address, deposit_amount)
            await pool1.connect(user1).deposit(deposit_amount)

            await underlying.connect(admin).transfer(user2.address, borrow_fees)
            await underlying.connect(user2).approve(pool1.address, borrow_fees)
            
            await controller.connect(admin).updatePoolRewards(pool1.address, 0, borrowRatio, false);

            await controller.connect(admin).updateRewardToken(rewardToken.address)

            await rewardToken.connect(admin).transfer(controller.address, reward_amount)

        });

        it(' should not set a LoanRatio when Borrowing', async () => {
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            const loan_ratio = await controller.loansBorrowRatios(loan_address)

            expect(loan_ratio).to.be.eq(0)

        });

        it(' should not accrue rewards when Closing the Loan', async () => {

            const old_user_claimable_rewards = await controller.claimable(user2.address)
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            await pool1.connect(user2).closeBorrow(loan_address)

            const new_user_claimable_rewards = await controller.claimable(user2.address)

            expect(new_user_claimable_rewards).to.be.eq(old_user_claimable_rewards)

            expect(await controller.isLoanRewardClaimed(loan_address)).to.be.false

        });

        it(' should not allow to claim rewards on an active Loan', async () => {
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            expect(await controller.claimableLoanRewards(pool1.address, loan_address)).to.be.eq(0)

            await expect(
                controller.connect(user2).claimLoanRewards(pool1.address, loan_address)
            ).to.be.revertedWith('44')

        });

        it(' should have the correct amount of claimable rewards when Loan is closed', async () => {
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            await pool1.connect(user2).closeBorrow(loan_address)

            const loan_data = await pool1.getBorrowData(loan_address)

            const expected_rewards = (loan_data._feesUsed).mul(borrowRatio).div(mantissa)

            expect(await controller.claimableLoanRewards(pool1.address, loan_address)).to.be.eq(expected_rewards)

        });

        it(' should allow to claim the rewards when Loan is closed', async () => {
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            await pool1.connect(user2).closeBorrow(loan_address)

            const claimable_rewards = await controller.claimableLoanRewards(pool1.address, loan_address)

            const old_balance = await rewardToken.balanceOf(user2.address)

            await expect(controller.connect(user2).claimLoanRewards(pool1.address, loan_address))
                .to.emit(controller, 'ClaimRewards')
                .withArgs(user2.address, claimable_rewards);

            const new_balance = await rewardToken.balanceOf(user2.address)

            expect(new_balance.sub(old_balance)).to.be.eq(claimable_rewards)

            expect(await controller.isLoanRewardClaimed(loan_address)).to.be.true

        });

        it(' should not allow to claim the rewards twice', async () => {
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            await pool1.connect(user2).closeBorrow(loan_address)

            await controller.connect(user2).claimLoanRewards(pool1.address, loan_address)

            await expect(
                controller.connect(user2).claimLoanRewards(pool1.address, loan_address)
            ).to.be.revertedWith('44')

        });

        it(' should only allow the borrower to claim the rewards', async () => {
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            await pool1.connect(user2).closeBorrow(loan_address)

            await expect(
                controller.connect(user1).claimLoanRewards(pool1.address, loan_address)
            ).to.be.revertedWith('15')

        });

        it(' should always use the current Pool Borrow Ratio', async () => {

            const new_borrowRatio = ethers.utils.parseEther("0.75")
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]
            
            await controller.connect(admin).updatePoolRewards(pool1.address, 0, new_borrowRatio, false);

            await pool1.connect(user2).closeBorrow(loan_address)

            const loan_data = await pool1.getBorrowData(loan_address)

            const expected_rewards = (loan_data._feesUsed).mul(new_borrowRatio).div(mantissa)

            expect(await controller.claimableLoanRewards(pool1.address, loan_address)).to.be.eq(expected_rewards)

        });

        it(' should allow to claim is rewards are set as non-auto before Loan is closed (& use the Loan ratio)', async () => {
            
            const new_borrowRatio = ethers.utils.parseEther("0.75")
            
            await controller.connect(admin).updatePoolRewards(pool1.address, 0, borrowRatio, true);
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]
            
            await controller.connect(admin).updatePoolRewards(pool1.address, 0, new_borrowRatio, false);

            const loan_borrowRatio = await controller.loansBorrowRatios(loan_address)

            await pool1.connect(user2).closeBorrow(loan_address)

            const loan_data = await pool1.getBorrowData(loan_address)

            const expected_rewards = (loan_data._feesUsed).mul(loan_borrowRatio).div(mantissa)

            expect(loan_borrowRatio).to.be.eq(borrowRatio)

            expect(await controller.claimableLoanRewards(pool1.address, loan_address)).to.be.eq(expected_rewards)

            const old_balance = await rewardToken.balanceOf(user2.address)

            await expect(controller.connect(user2).claimLoanRewards(pool1.address, loan_address))
                .to.emit(controller, 'ClaimRewards')
                .withArgs(user2.address, expected_rewards);

            const new_balance = await rewardToken.balanceOf(user2.address)

            expect(new_balance.sub(old_balance)).to.be.eq(expected_rewards)

            expect(await controller.isLoanRewardClaimed(loan_address)).to.be.true

        });

        it(' should not give rewards to a PalLoan taken before rewards were set', async () => {

            await underlying.connect(admin).transfer(user1.address, deposit_amount)
            await underlying.connect(user1).approve(pool2.address, deposit_amount)
            await pool2.connect(user1).deposit(deposit_amount)

            await underlying.connect(admin).transfer(user2.address, borrow_fees)
            await underlying.connect(user2).approve(pool2.address, borrow_fees)

            await pool2.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool2.getLoansByBorrower(user2.address)).slice(-1)[0]
            
            await controller.connect(admin).updatePoolRewards(pool2.address, 0, borrowRatio, false);

            await pool2.connect(user2).closeBorrow(loan_address)

            await expect(
                controller.connect(user2).claimLoanRewards(pool2.address, loan_address)
            ).to.be.revertedWith('44')

        });

        it(' should fail if not correct PalPool for PalLoan', async () => {
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            await pool1.connect(user2).closeBorrow(loan_address)

            await expect(
                controller.connect(user2).claimLoanRewards(pool2.address, loan_address)
            ).to.be.reverted

        });

        it(' should fail if not a PalLoan', async () => {

            await expect(
                controller.connect(user2).claimLoanRewards(pool1.address, fakeLoan.address)
            ).to.be.reverted

        });

    });

});