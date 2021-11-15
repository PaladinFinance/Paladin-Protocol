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

const mantisaa = ethers.utils.parseEther('1')

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
            user3
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
            const pal_contract_address = "0xAB846Fb6C81370327e784Ae7CbB6d6a6af6Ff4BF";

            const pal_address = await controller.rewardToken();
            const initialIndex = await controller.initialRewardsIndex();

            expect(pal_address).to.be.eq(pal_contract_address)
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

        });
    
        it(' should allow admin to set rewards for PalPool', async () => {
            
            await expect(controller.connect(admin).updatePoolRewards(pool1.address, supplySpeed, borrowRatio))
                .to.emit(controller, 'PoolRewardsUpdated')
                .withArgs(pool1.address, supplySpeed, borrowRatio);

            expect(await controller.supplySpeeds(pool1.address)).to.be.eq(supplySpeed)
            expect(await controller.borrowRatios(pool1.address)).to.be.eq(borrowRatio)

            const new_supplySpeed = ethers.utils.parseEther("0.35")
            const new_borrowRatio = ethers.utils.parseEther("0.55")

            await controller.connect(admin).updatePoolRewards(pool1.address, new_supplySpeed, borrowRatio);

            expect(await controller.supplySpeeds(pool1.address)).to.be.eq(new_supplySpeed)
            expect(await controller.borrowRatios(pool1.address)).to.be.eq(borrowRatio)

            await controller.connect(admin).updatePoolRewards(pool1.address, new_supplySpeed, new_borrowRatio);

            expect(await controller.supplySpeeds(pool1.address)).to.be.eq(new_supplySpeed)
            expect(await controller.borrowRatios(pool1.address)).to.be.eq(new_borrowRatio)

        });
    
        it(' should not allow non-admin to set rewards for PalPool', async () => {
            
            await expect(
                controller.connect(user1).updatePoolRewards(pool1.address, supplySpeed, borrowRatio)
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
            
            await controller.connect(admin).updatePoolRewards(pool1.address, supplySpeed, 0);

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
            
            await controller.connect(admin).updatePoolRewards(pool1.address, supplySpeed1, 0);
            await controller.connect(admin).updatePoolRewards(pool2.address, supplySpeed2, 0);

            const controller_totalSpeed = await controller.totalSupplyRewardSpeed()

            expect(controller_totalSpeed).to.be.eq(supplySpeed1.add(supplySpeed2))

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
            
            await controller.connect(admin).updatePoolRewards(pool1.address, supplySpeed, 0);

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
    
        it(' should not accrue rewards if PalTokens are not deposited', async () => {
            
            

        });
    
        it(' should accrue rewards to depositor (& allow to claim it) + set the correct SupplyRewardStates', async () => {

            const initial_index = await controller.initialRewardsIndex()
            const user1_palToken_amount = await token1.balanceOf(user1.address)

            await token1.connect(user1).approve(controller.address, user1_palToken_amount)

            const deposit_tx = controller.connect(user1).deposit(token1.address, user1_palToken_amount)

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

            /*const old_balance = await rewardToken.balanceOf(user1.address)

            const claim_tx = await controller.connect(user1).claim(user1.address)
            const claim_block = (await claim_tx).blockNumber || 0

            const new_balance = await rewardToken.balanceOf(user1.address)

            const estimated_accrued_rewards_2 = supplySpeed.mul(claim_block - update_block)

            expect(await controller.claimable(user1.address)).to.be.eq(0)
            expect(new_balance.sub(old_balance)).to.be.eq(estimated_accrued_rewards.add(estimated_accrued_rewards_2))*/
            
        });
    
        it(' should accrue rewards with multiple depositors in the Pool + set the correct SupplyRewardStates', async () => {
            
        });
    
        it(' should not accrue rewards if no speed was set + set the correct SupplyRewardStates', async () => {
            
        });
    
        it(' should accrue the reward from 2 pools at the same time + set the correct SupplyRewardStates', async () => {
            
        });
    
        it(' should do a correct update when Supply Speed is updated', async () => {
            
        });
    
        it(' should stop accruing fees if the Pool speed is set back to 0', async () => {
            
        });
    
        it(' should stop accruing rewards if depositor withdraw palTokens', async () => {
            
        });

    });

/*
    describe('Borrow Rewards', async () => {

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
            
            await controller.connect(admin).updatePoolRewards(pool1.address, 0, borrowRatio);

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

            const expected_rewards = (loan_data._feesUsed).mul(borrowRatio).div(mantisaa)

            const user_claimable_rewards = await controller.claimable(user2.address)

            expect(expected_rewards).to.be.eq(user_claimable_rewards)

            const old_balance = await rewardToken.balanceOf(user2.address)

            await controller.connect(user2).claim(user2.address)

            const new_balance = await rewardToken.balanceOf(user2.address)

            expect(new_balance.sub(old_balance)).to.be.eq(user_claimable_rewards)

        });
    
        it(' should still use initial Loan ratio if BorrowRatio is changed', async () => {

            const new_BorrowRatio = ethers.utils.parseEther("0.55")
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            const loan_ratio = await controller.loansBorrowRatios(loan_address)

            expect(loan_ratio).to.be.eq(borrowRatio)

            await controller.connect(admin).updatePoolRewards(pool1.address, 0, new_BorrowRatio);
            
            await pool1.connect(user2).closeBorrow(loan_address)

            const loan_data = await pool1.getBorrowData(loan_address)

            const expected_rewards = (loan_data._feesUsed).mul(loan_ratio).div(mantisaa)

            const user_claimable_rewards = await controller.claimable(user2.address)

            expect(expected_rewards).to.be.eq(user_claimable_rewards)

        });
    
        it(' should update the ratio if Loan is Expanded', async () => {
            
            const new_BorrowRatio = ethers.utils.parseEther("0.55")
            
            await pool1.connect(user2).borrow(user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool1.getLoansByBorrower(user2.address)).slice(-1)[0]

            await controller.connect(admin).updatePoolRewards(pool1.address, 0, new_BorrowRatio);

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

    });
*/
});