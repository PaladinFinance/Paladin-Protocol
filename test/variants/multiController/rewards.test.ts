import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { MultiPoolController } from "../../../typechain/MultiPoolController";
import { MultiPalPoolPSP } from "../../../typechain/MultiPalPoolPSP";
import { PalToken } from "../../../typechain/PalToken";
import { PalLoanToken } from "../../../typechain/PalLoanToken";
import { SnapshotDelegator } from "../../../typechain/SnapshotDelegator";
import { IERC20 } from "../../../typechain/IERC20";
import { ISPSP } from "../../../typechain/ISPSP";
import { Comp } from "../../../typechain/Comp";
import { InterestCalculator } from "../../../typechain/InterestCalculator";
import { IERC20__factory } from "../../../typechain/factories/IERC20__factory";
import { ISPSP__factory } from "../../../typechain/factories/ISPSP__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { getTokens } from "../../utils/getERC20";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

const mantissa = ethers.utils.parseEther('1')
const doubleMantissa = ethers.utils.parseEther('1000000000000000000')

let poolFactory: ContractFactory
let tokenFactory: ContractFactory
let palLoanTokenFactory: ContractFactory
let controllerFactory: ContractFactory
let delegatorFactory: ContractFactory
let interestFactory: ContractFactory
let erc20Factory: ContractFactory

const PSP_address = "0xcAfE001067cDEF266AfB7Eb5A286dCFD277f3dE5" //PSP contract on mainnet

const sPSP_1_address = "0x55A68016910A7Bcb0ed63775437e04d2bB70D570" //sPSP 1 contract on mainnet
const sPSP_3_address = "0xea02DF45f56A690071022c45c95c46E7F61d3eAb" //sPSP 3 contract on mainnet
const sPSP_4_address = "0x6b1D394Ca67fDB9C90BBd26FE692DdA4F4f53ECD" //sPSP 4 contract on mainnet

const sPSP_7_address = "0x37b1E4590638A266591a9C11d6f945fe7A1adAA7" //sPSP 7 contract on mainnet

const pool1_deposit_amount = ethers.utils.parseEther('20000')
const pool2_deposit_amount = ethers.utils.parseEther('15000')
const pool3_deposit_amount = ethers.utils.parseEther('3500')


describe('Paladin MultiPoolController - Rewards System tests', () => {
    let admin: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress

    let fake_loan: SignerWithAddress

    let pool: MultiPalPoolPSP
    let token1: PalToken
    let token2: PalToken
    let token3: PalToken
    let token4: PalToken
    let loanToken: PalLoanToken
    let controller: MultiPoolController
    let delegator: SnapshotDelegator
    let interest: InterestCalculator
    let psp_token: IERC20
    let rewardToken: Comp

    let spsp_token1: ISPSP
    let spsp_token2: ISPSP
    let spsp_token3: ISPSP
    let spsp_token4: ISPSP

    let name1: string = "Paladin MOCK 1"
    let symbol1: string = "palMOCK1"
    let name2: string = "Paladin MOCK 2"
    let symbol2: string = "palMOCK2"
    let name3: string = "Paladin MOCK 3"
    let symbol3: string = "palMOCK3"

    let name4: string = "Paladin MOCK 4"
    let symbol4: string = "palMOCK4"

    let tx_addPool: any

    const mineBlocks = async (n: number): Promise<any> => {
        for(let i = 0; i < n; i++){
            await ethers.provider.send("evm_mine", [])
        }
        return Promise.resolve()
    }

    before( async () => {
        tokenFactory = await ethers.getContractFactory("PalToken");
        palLoanTokenFactory = await ethers.getContractFactory("PalLoanToken");
        poolFactory = await ethers.getContractFactory("MultiPalPoolPSP");
        controllerFactory = await ethers.getContractFactory("MultiPoolController");
        delegatorFactory = await ethers.getContractFactory("SnapshotDelegator");
        interestFactory = await ethers.getContractFactory("InterestCalculator");
        erc20Factory = await ethers.getContractFactory("Comp");

        [admin, user1, user2, user3, fake_loan] = await ethers.getSigners();


        psp_token = IERC20__factory.connect(PSP_address, provider);

        spsp_token1 = ISPSP__factory.connect(sPSP_1_address, provider);
        spsp_token2 = ISPSP__factory.connect(sPSP_3_address, provider);
        spsp_token3 = ISPSP__factory.connect(sPSP_4_address, provider);
        spsp_token4 = ISPSP__factory.connect(sPSP_7_address, provider);


        const holder_amount = ethers.utils.parseEther('100000')
        const holder_address = "0x6455327f820edd69c4cd665b995e0fec679d7f9e"

        await getTokens(admin, psp_token, holder_address, admin.address, holder_amount);

        await psp_token.connect(admin).transfer(user1.address, ethers.utils.parseEther('50000'))

        await psp_token.connect(user1).approve(spsp_token1.address, pool1_deposit_amount)
        await psp_token.connect(user1).approve(spsp_token2.address, pool2_deposit_amount)
        await psp_token.connect(user1).approve(spsp_token3.address, pool3_deposit_amount)

        await spsp_token1.connect(user1).enter(pool1_deposit_amount)
        await spsp_token2.connect(user1).enter(pool2_deposit_amount)
        await spsp_token3.connect(user1).enter(pool3_deposit_amount)

        await psp_token.connect(admin).transfer(user2.address, ethers.utils.parseEther('12500'))
        await psp_token.connect(admin).transfer(user3.address, ethers.utils.parseEther('10000'))

        await psp_token.connect(user2).approve(spsp_token1.address, ethers.utils.parseEther('12500'))

        await psp_token.connect(user3).approve(spsp_token2.address, ethers.utils.parseEther('10000'))

        await spsp_token1.connect(user2).enter(ethers.utils.parseEther('12500'))

        await spsp_token2.connect(user3).enter(ethers.utils.parseEther('10000'))
    })

    beforeEach( async () => {
        token1 = (await tokenFactory.connect(admin).deploy(name1, symbol1)) as PalToken;
        await token1.deployed();
        token2 = (await tokenFactory.connect(admin).deploy(name2, symbol2)) as PalToken;
        await token2.deployed();
        token3 = (await tokenFactory.connect(admin).deploy(name3, symbol3)) as PalToken;
        await token3.deployed();
        token4 = (await tokenFactory.connect(admin).deploy(name4, symbol4)) as PalToken;
        await token4.deployed();

        rewardToken = (await erc20Factory.connect(admin).deploy(admin.address)) as Comp;
        await rewardToken.deployed();

        controller = (await controllerFactory.connect(admin).deploy()) as MultiPoolController;
        await controller.deployed();

        loanToken = (await palLoanTokenFactory.connect(admin).deploy(controller.address, "about:blank")) as PalLoanToken;
        await loanToken.deployed();

        interest = (await interestFactory.connect(admin).deploy()) as InterestCalculator;
        await interest.deployed();

        delegator = (await delegatorFactory.connect(admin).deploy()) as SnapshotDelegator;
        await delegator.deployed();

        pool = (await poolFactory.connect(admin).deploy(
            [token1.address, token2.address, token3.address],
            controller.address, 
            [spsp_token1.address,spsp_token2.address,spsp_token3.address],
            interest.address,
            delegator.address,
            loanToken.address
        )) as MultiPalPoolPSP;
        await pool.deployed();

        await token1.initiate(pool.address);
        await token2.initiate(pool.address);
        await token3.initiate(pool.address);

        tx_addPool = await controller.addNewPool(pool.address, [token1.address, token2.address, token3.address]);
    });


    it(' should be deployed', async () => {
        expect(controller.address).to.properAddress
    });


    describe('Rewards Values (Storage)', async () => {

        const supplySpeed1 = ethers.utils.parseEther("0.25")
        const supplySpeed2 = ethers.utils.parseEther("1.5")
        const borrowRatio = ethers.utils.parseEther("0.75")
    
        it(' should have the correct base values in storage', async () => {
            
            const expected_initial_index = ethers.utils.parseUnits("1", 36);

            const reward_token_address = await controller.rewardToken();
            const initialIndex = await controller.initialRewardsIndex();

            expect(reward_token_address).to.be.eq(ethers.constants.AddressZero)
            expect(initialIndex).to.be.eq(expected_initial_index)


            const setPools_block = (await tx_addPool).blockNumber || 0

            const supplyRewardState1 = await controller.supplyRewardState(token1.address)
            const supplyRewardState2 = await controller.supplyRewardState(token2.address)

            expect(await supplyRewardState1.index).to.be.eq(initialIndex)
            expect(await supplyRewardState2.index).to.be.eq(initialIndex)

            expect(await supplyRewardState1.blockNumber).to.be.eq(setPools_block)
            expect(await supplyRewardState2.blockNumber).to.be.eq(setPools_block)


            expect(await controller.supplySpeeds(token1.address)).to.be.eq(0)
            expect(await controller.supplySpeeds(token1.address)).to.be.eq(0)


            expect(await controller.supplierRewardIndex(token1.address, user1.address)).to.be.eq(0)
            expect(await controller.supplierRewardIndex(token2.address, user1.address)).to.be.eq(0)

            expect(await controller.supplierRewardIndex(token1.address, user2.address)).to.be.eq(0)
            expect(await controller.supplierRewardIndex(token2.address, user2.address)).to.be.eq(0)

            expect(await controller.supplierRewardIndex(token1.address, user3.address)).to.be.eq(0)
            expect(await controller.supplierRewardIndex(token2.address, user3.address)).to.be.eq(0)


            expect(await controller.borrowRatios(token1.address)).to.be.eq(0)
            expect(await controller.borrowRatios(token2.address)).to.be.eq(0)


            expect(await controller.accruedRewards(user1.address)).to.be.eq(0)
            expect(await controller.accruedRewards(user2.address)).to.be.eq(0)
            expect(await controller.accruedRewards(user3.address)).to.be.eq(0)

            expect(await controller.claimable(user1.address)).to.be.eq(0)
            expect(await controller.claimable(user2.address)).to.be.eq(0)
            expect(await controller.claimable(user3.address)).to.be.eq(0)

        });
    
        it(' should allow admin to set rewards for PalPool', async () => {

            const updateSupplySetting_tx = await controller.connect(admin).updateTokenSupplySpeed(pool.address, token1.address, supplySpeed1)
            const updateBorrowSetting_tx = await controller.connect(admin).updatePoolBorrowRatio(pool.address, borrowRatio)
            
            await expect(updateSupplySetting_tx)
                .to.emit(controller, 'SupplySpeedUpdated')
                .withArgs(pool.address, token1.address, supplySpeed1);

            await expect(updateBorrowSetting_tx)
                .to.emit(controller, 'BorrowRatioUpdated')
                .withArgs(pool.address, borrowRatio);

            expect(await controller.supplySpeeds(token1.address)).to.be.eq(supplySpeed1)
            expect(await controller.borrowRatios(pool.address)).to.be.eq(borrowRatio)

            const new_supplySpeed = ethers.utils.parseEther("0.35")
            const new_borrowRatio = ethers.utils.parseEther("0.55")

            await controller.connect(admin).updateTokenSupplySpeed(pool.address, token1.address, new_supplySpeed)

            expect(await controller.supplySpeeds(token1.address)).to.be.eq(new_supplySpeed)

            
            await controller.connect(admin).updatePoolBorrowRatio(pool.address, new_borrowRatio)

            expect(await controller.borrowRatios(pool.address)).to.be.eq(new_borrowRatio)

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
                controller.connect(user1).updateTokenSupplySpeed(pool.address, token1.address, supplySpeed1)
            ).to.be.revertedWith('1')

            await expect(
                controller.connect(user1).updatePoolBorrowRatio(pool.address, borrowRatio)
            ).to.be.revertedWith('1')

        });
    
        it(' should not reset supplyRewardState.index if a previous one is not null', async () => {

            const amount = ethers.utils.parseEther('500')
            await spsp_token1.connect(user1).approve(pool.address, amount)
            await pool.connect(user1).deposit(spsp_token1.address, amount)
            const user_palToken_amount = await token1.balanceOf(user1.address)
            await token1.connect(user1).approve(controller.address, user_palToken_amount)
            await controller.connect(user1).deposit(token1.address, user_palToken_amount)
            
            await controller.connect(admin).updateTokenSupplySpeed(pool.address, token1.address, supplySpeed1)

            await mineBlocks(75)

            await controller.connect(user1).updateUserRewards(user1.address)

            const supplyRewardState1 = await controller.supplyRewardState(pool.address)
            const initialIndex = await controller.initialRewardsIndex();
            expect(supplyRewardState1.index).not.to.be.eq(initialIndex)

            await controller.connect(admin).removePool(pool.address)
            await controller.addNewPool(pool.address, [token1.address, token2.address, token3.address])

            const supplyRewardState2 = await controller.supplyRewardState(pool.address)
            expect(supplyRewardState2.index).not.to.be.eq(initialIndex)
            expect(supplyRewardState2.index).to.be.eq(supplyRewardState1.index)

        });

        it(' should sum up supply speeds correctly', async () => {
            
            await controller.connect(admin).updateTokenSupplySpeed(pool.address, token1.address, supplySpeed1)
            await controller.connect(admin).updateTokenSupplySpeed(pool.address, token2.address, supplySpeed2)

            const controller_totalSpeed = await controller.totalSupplyRewardSpeed()

            expect(controller_totalSpeed).to.be.eq(supplySpeed1.add(supplySpeed2))

        });

    });


    describe('Supply Rewards', async () => {

        const supplySpeed1 = ethers.utils.parseEther("0.25")
        const supplySpeed2 = ethers.utils.parseEther("1.5")

        const reward_amount = ethers.utils.parseEther('100')

        const deposit_amount = ethers.utils.parseEther('500')
        const deposit_amount2 = ethers.utils.parseEther('350')

        beforeEach( async () => {
            await spsp_token1.connect(user1).approve(pool.address, deposit_amount)

            await pool.connect(user1).deposit(spsp_token1.address, deposit_amount)
            
            await controller.connect(admin).updateTokenSupplySpeed(pool.address, token1.address, supplySpeed1)

            await controller.connect(admin).updateRewardToken(rewardToken.address)

            await rewardToken.connect(admin).transfer(controller.address, reward_amount)

        });
    
        it(' should have the correct Supply Speeds', async () => {
            
            expect(await controller.supplySpeeds(token1.address)).to.be.eq(supplySpeed1)
            expect(await controller.supplySpeeds(token2.address)).to.be.eq(0)

        });
    
        it(' should allow to deposit correclty (& with correct Event)', async () => {
            
            const user_palToken_amount = await token1.balanceOf(user1.address)

            expect(await controller.supplierDeposits(token1.address, user1.address)).to.be.eq(0)
            expect(await controller.totalSupplierDeposits(token1.address)).to.be.eq(0)

            await token1.connect(user1).approve(controller.address, user_palToken_amount)

            await expect(controller.connect(user1).deposit(token1.address, user_palToken_amount))
                .to.emit(controller, 'Deposit')
                .withArgs(user1.address, token1.address, user_palToken_amount);

            expect(await controller.supplierDeposits(token1.address, user1.address)).to.be.eq(user_palToken_amount)
            expect(await controller.totalSupplierDeposits(token1.address)).to.be.eq(user_palToken_amount)

            await spsp_token1.connect(user2).approve(pool.address, deposit_amount2)

            await pool.connect(user2).deposit(spsp_token1.address, deposit_amount2)

            const user_palToken_amount2 = await token1.balanceOf(user2.address)

            await token1.connect(user2).approve(controller.address, user_palToken_amount2)

            await controller.connect(user2).deposit(token1.address, user_palToken_amount2)

            expect(await controller.supplierDeposits(token1.address, user2.address)).to.be.eq(user_palToken_amount2)
            expect(await controller.totalSupplierDeposits(token1.address)).to.be.eq(user_palToken_amount.add(user_palToken_amount2))


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

            expect(await controller.supplierDeposits(token1.address, user1.address)).to.be.eq(user_palToken_amount.sub(to_withdraw_amount))
            expect(await controller.totalSupplierDeposits(token1.address)).to.be.eq(user_palToken_amount.sub(to_withdraw_amount))

            await expect(
                controller.connect(user2).withdraw(token1.address, user_palToken_amount)
            ).to.be.revertedWith('43')

        });
    
        it(' should not accrue rewards if PalTokens are not deposited in the Controller', async () => {

            //user1 deposited in pool before, but not in the controller

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

            const supplyRewardState1 = await controller.supplyRewardState(token1.address)
            expect(await controller.supplierRewardIndex(token1.address, user1.address)).to.be.eq(supplyRewardState1.index)
            expect(await controller.supplierRewardIndex(token2.address, user1.address)).to.be.eq(0)

            const deposit_block = (await deposit_tx).blockNumber || 0
            expect(supplyRewardState1.blockNumber).to.be.eq(deposit_block)

            await mineBlocks(150)

            const update_tx = await controller.connect(user1).updateUserRewards(user1.address)
            const update_block = (await update_tx).blockNumber || 0

            const user_claimable = await controller.claimable(user1.address)

            const estimated_accrued_rewards = supplySpeed1.mul(update_block - deposit_block)

            const new_supplyRewardState1 = await controller.supplyRewardState(token1.address)
            expect(await controller.supplierRewardIndex(token1.address, user1.address)).to.be.eq(new_supplyRewardState1.index)
            expect(await controller.supplierRewardIndex(token2.address, user1.address)).to.be.eq(initial_index)
            expect(new_supplyRewardState1.blockNumber).to.be.eq(update_block)

            expect(user_claimable).to.be.eq(estimated_accrued_rewards)

            const old_balance = await rewardToken.balanceOf(user1.address)

            const claim_tx = await controller.connect(user1).claim(user1.address)
            const claim_block = (await claim_tx).blockNumber || 0

            const new_balance = await rewardToken.balanceOf(user1.address)

            const estimated_accrued_rewards_2 = supplySpeed1.mul(claim_block - update_block)

            expect(await controller.claimable(user1.address)).to.be.eq(0)
            expect(new_balance.sub(old_balance)).to.be.eq(estimated_accrued_rewards.add(estimated_accrued_rewards_2))
            
        });
    
        it(' should accrue rewards with multiple depositors in the Pool', async () => {

            await spsp_token1.connect(user2).approve(pool.address, deposit_amount2)
            await pool.connect(user2).deposit(spsp_token1.address, deposit_amount2)
            
            const user1_palToken_amount = await token1.balanceOf(user1.address)
            const user2_palToken_amount = await token1.balanceOf(user2.address)

            await token1.connect(user1).approve(controller.address, user1_palToken_amount)
            await token1.connect(user2).approve(controller.address, user2_palToken_amount)


            const deposit_tx1 = await controller.connect(user1).deposit(token1.address, user1_palToken_amount)

            const supplyRewardState1 = await controller.supplyRewardState(token1.address)
            expect(await controller.supplierRewardIndex(token1.address, user1.address)).to.be.eq(supplyRewardState1.index)
            const deposit_block1 = (await deposit_tx1).blockNumber || 0
            expect(supplyRewardState1.blockNumber).to.be.eq(deposit_block1)


            const deposit_tx2 = await controller.connect(user2).deposit(token1.address, user2_palToken_amount)

            const supplyRewardState2 = await controller.supplyRewardState(token1.address)
            expect(await controller.supplierRewardIndex(token1.address, user2.address)).to.be.eq(supplyRewardState2.index)
            const deposit_block2 = (await deposit_tx2).blockNumber || 0
            expect(supplyRewardState2.blockNumber).to.be.eq(deposit_block2)


            await mineBlocks(123)


            const totalDeposited = await controller.totalSupplierDeposits(token1.address)


            const update_tx1 = await controller.connect(user1).updateUserRewards(user1.address)
            const update_block1 = (await update_tx1).blockNumber || 0

            const user1_claimable = await controller.claimable(user1.address)

            const estimated_accrued_rewards_user1 = supplySpeed1.mul(deposit_block2 - deposit_block1).add(
                supplySpeed1.mul(update_block1 - deposit_block2).mul(
                    user1_palToken_amount.mul(doubleMantissa).div(totalDeposited)
                ).div(doubleMantissa)
            )

            
            const update_tx2 = await controller.connect(user2).updateUserRewards(user2.address)
            const update_block2 = (await update_tx2).blockNumber || 0

            const user2_claimable = await controller.claimable(user2.address)

            const estimated_accrued_rewards_user2 = supplySpeed1.mul(update_block2 - deposit_block2).mul(
                user2_palToken_amount.mul(doubleMantissa).div(totalDeposited)
            ).div(doubleMantissa)

            const new_supplyRewardState1 = await controller.supplyRewardState(token1.address)
            expect(await controller.supplierRewardIndex(token1.address, user2.address)).to.be.eq(new_supplyRewardState1.index)
            expect(new_supplyRewardState1.blockNumber).to.be.eq(update_block2)

            expect(user1_claimable).to.be.closeTo(estimated_accrued_rewards_user1, 10)
            expect(user2_claimable).to.be.closeTo(estimated_accrued_rewards_user2, 10)


            const old_balance1 = await rewardToken.balanceOf(user1.address)

            const claim1_tx = await controller.connect(user1).claim(user1.address)
            const claim1_block = (await claim1_tx).blockNumber || 0

            const new_balance1 = await rewardToken.balanceOf(user1.address)

            const estimated_accrued_rewards_user1_2 = supplySpeed1.mul(claim1_block - update_block1).mul(
                user1_palToken_amount.mul(doubleMantissa).div(totalDeposited)
            ).div(doubleMantissa)

            expect(await controller.claimable(user1.address)).to.be.eq(0)
            expect(new_balance1.sub(old_balance1)).to.be.closeTo(estimated_accrued_rewards_user1.add(estimated_accrued_rewards_user1_2), 10)


            const old_balance2 = await rewardToken.balanceOf(user2.address)

            const claim2_tx = await controller.connect(user2).claim(user2.address)
            const claim2_block = (await claim2_tx).blockNumber || 0

            const new_balance2 = await rewardToken.balanceOf(user2.address)

            const estimated_accrued_rewards_user2_2 = supplySpeed1.mul(claim1_block - update_block2).mul(
                user2_palToken_amount.mul(doubleMantissa).div(totalDeposited)
            ).div(doubleMantissa).add(
                supplySpeed1.mul(claim2_block - claim1_block).mul(
                    user2_palToken_amount.mul(doubleMantissa).div(totalDeposited)
                ).div(doubleMantissa)
            )

            expect(await controller.claimable(user2.address)).to.be.eq(0)
            expect(new_balance2.sub(old_balance2)).to.be.closeTo(estimated_accrued_rewards_user2.add(estimated_accrued_rewards_user2_2), 10)

        });
    
        it(' should not accrue rewards if no speed was set + set the correct SupplyRewardStates', async () => {
            
            await spsp_token2.connect(user3).approve(pool.address, deposit_amount)

            await pool.connect(user3).deposit(spsp_token2.address, deposit_amount)

            const user3_palToken_amount = await token2.balanceOf(user3.address)

            await token2.connect(user3).approve(controller.address, user3_palToken_amount)

            await controller.connect(user3).deposit(token2.address, user3_palToken_amount)

            await mineBlocks(180)

            expect(await controller.claimable(user3.address)).to.be.eq(0)

        });
    
        it(' should accrue the reward from 2 pools at the same time + set the correct SupplyRewardStates', async () => {
            
            await spsp_token2.connect(user1).approve(pool.address, deposit_amount)
            await pool.connect(user1).deposit(spsp_token2.address, deposit_amount)

            const supplySpeed2 = ethers.utils.parseEther("0.45")

            await controller.connect(admin).updateTokenSupplySpeed(pool.address, token2.address, supplySpeed2)

            const user1_palToken1_amount = await token1.balanceOf(user1.address)
            const user1_palToken2_amount = await token2.balanceOf(user1.address)

            await token1.connect(user1).approve(controller.address, user1_palToken1_amount)
            await token2.connect(user1).approve(controller.address, user1_palToken2_amount)

            const deposit1_tx = await controller.connect(user1).deposit(token1.address, user1_palToken1_amount)
            const deposit2_tx = await controller.connect(user1).deposit(token2.address, user1_palToken2_amount)

            const supplyRewardState1 = await controller.supplyRewardState(token1.address)
            const supplyRewardState2 = await controller.supplyRewardState(token2.address)
            expect(await controller.supplierRewardIndex(token1.address, user1.address)).to.be.eq(supplyRewardState1.index)
            expect(await controller.supplierRewardIndex(token2.address, user1.address)).to.be.eq(supplyRewardState2.index)

            const deposit1_block = (await deposit1_tx).blockNumber || 0
            const deposit2_block = (await deposit2_tx).blockNumber || 0
            expect(supplyRewardState1.blockNumber).to.be.eq(deposit1_block)
            expect(supplyRewardState2.blockNumber).to.be.eq(deposit2_block)

            await mineBlocks(180)

            const update_tx = await controller.connect(user1).updateUserRewards(user1.address)
            const update_block = (await update_tx).blockNumber || 0

            const user_claimable = await controller.claimable(user1.address)

            const estimated_accrued_rewards1 = supplySpeed1.mul(update_block - deposit1_block)
            const estimated_accrued_rewards2 = supplySpeed2.mul(update_block - deposit2_block)

            const new_supplyRewardState1 = await controller.supplyRewardState(token1.address)
            const new_supplyRewardState2 = await controller.supplyRewardState(token2.address)
            expect(await controller.supplierRewardIndex(token1.address, user1.address)).to.be.eq(new_supplyRewardState1.index)
            expect(await controller.supplierRewardIndex(token2.address, user1.address)).to.be.eq(new_supplyRewardState2.index)
            expect(new_supplyRewardState1.blockNumber).to.be.eq(update_block)
            expect(new_supplyRewardState2.blockNumber).to.be.eq(update_block)

            expect(user_claimable).to.be.eq(estimated_accrued_rewards1.add(estimated_accrued_rewards2))

        });
    
        it(' should show good estimateClaimable if Pool SupplyRewardState was updated but user rewards were not accrued', async () => {
            
            await spsp_token1.connect(user2).approve(pool.address, deposit_amount)
            await pool.connect(user2).deposit(spsp_token1.address, deposit_amount)

            const user1_palToken_amount = await token1.balanceOf(user1.address)

            await token1.connect(user1).approve(controller.address, user1_palToken_amount)

            const user2_palToken_amount = await token1.balanceOf(user2.address)

            await token1.connect(user2).approve(controller.address, user2_palToken_amount)

            const deposit_tx = await controller.connect(user1).deposit(token1.address, user1_palToken_amount)

            const supplyRewardState1 = await controller.supplyRewardState(token1.address)
            expect(await controller.supplierRewardIndex(token1.address, user1.address)).to.be.eq(supplyRewardState1.index)

            const deposit_block = (await deposit_tx).blockNumber || 0
            expect(supplyRewardState1.blockNumber).to.be.eq(deposit_block)

            await mineBlocks(150)

            const update_tx = await controller.connect(user2).deposit(token1.address, user2_palToken_amount) //use this method with the same values to update
            const update_block = (await update_tx).blockNumber || 0                                          //the Pool Supply Reward State

            const user_estimateClaimable = await controller.estimateClaimable(user1.address)

            const estimated_accrued_rewards = supplySpeed1.mul(update_block - deposit_block)

            const new_supplyRewardState1 = await controller.supplyRewardState(token1.address)
            expect(await controller.supplierRewardIndex(token1.address, user1.address)).to.be.eq(supplyRewardState1.index)
            expect(new_supplyRewardState1.blockNumber).to.be.eq(update_block)

            expect(user_estimateClaimable).to.be.eq(estimated_accrued_rewards)

            //Since user2 deposit was the last update, its estimation should be at 0
            expect(await controller.estimateClaimable(user2.address)).to.be.eq(0)

        });
    
        it(' should do a correct update when Supply Speed is updated', async () => {
            
            const new_supplySpeed = ethers.utils.parseEther("0.45")

            const update_tx = await controller.connect(admin).updateTokenSupplySpeed(pool.address, token1.address, new_supplySpeed)

            const update_block = (await update_tx).blockNumber || 0

            const supplyRewardState = await controller.supplyRewardState(token1.address)
            expect(supplyRewardState.blockNumber).to.be.eq(update_block)

        });
    
        it(' should stop accruing rewards if the Pool speed is set back to 0', async () => {
            
            const user1_palToken_amount = await token1.balanceOf(user1.address)

            await token1.connect(user1).approve(controller.address, user1_palToken_amount)

            await controller.connect(user1).deposit(token1.address, user1_palToken_amount)

            await mineBlocks(150)

            await controller.connect(admin).updateTokenSupplySpeed(pool.address, token1.address, 0)

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

        it(' should fail deposit if the given palToken is not listed', async () => {

            const pool4_deposit_amount = ethers.utils.parseEther('50')
            const deposit_amount4 = ethers.utils.parseEther('7')

            await token4.initiate(pool.address);
            await pool.connect(admin).addUnderlying(spsp_token4.address, token4.address)

            await psp_token.connect(user1).approve(spsp_token4.address, pool4_deposit_amount)

            await spsp_token4.connect(user1).enter(pool4_deposit_amount)

            await spsp_token4.connect(user1).approve(pool.address, deposit_amount4)

            await pool.connect(user1).deposit(spsp_token4.address, deposit_amount4)

            const user1_palToken_amount = await token4.balanceOf(user1.address)

            await token4.connect(user1).approve(controller.address, user1_palToken_amount)

            await expect(
                controller.connect(user1).deposit(token4.address, user1_palToken_amount)
            ).to.be.revertedWith('48')

        });

        it(' should fail withdraw if the given palToken is not listed', async () => {

            const user1_palToken_amount = await token2.balanceOf(user1.address)

            await token2.connect(user1).approve(controller.address, user1_palToken_amount)

            await controller.connect(user1).deposit(token2.address, user1_palToken_amount)

            await controller.connect(admin).removePool(pool.address)

            await expect(
                controller.connect(user1).withdraw(token2.address, user1_palToken_amount)
            ).to.be.revertedWith('48')

        });

    });


    describe('Borrow Rewards', async () => {

        const borrowRatio = ethers.utils.parseEther("0.75")

        const reward_amount = ethers.utils.parseEther('100')

        const deposit_amount = ethers.utils.parseEther('500')
        const borrow_amount = ethers.utils.parseEther('35')
        const borrow_fees = ethers.utils.parseEther('5')
        const expand_fees = ethers.utils.parseEther('1')

        beforeEach( async () => {
            await spsp_token1.connect(user1).approve(pool.address, deposit_amount)
            await pool.connect(user1).deposit(spsp_token1.address, deposit_amount)

            await spsp_token1.connect(user2).approve(pool.address, borrow_fees.add(expand_fees))
            
            await controller.connect(admin).updatePoolBorrowRatio(pool.address, borrowRatio)

            await controller.connect(admin).updateRewardToken(rewardToken.address)

            await rewardToken.connect(admin).transfer(controller.address, reward_amount)

        });
    
        it(' should set the right ratio when Borrow starts', async () => {

            await pool.connect(user2).borrow(spsp_token1.address, user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool.getLoansByBorrower(user2.address)).slice(-1)[0]

            const loan_ratio = await controller.loansBorrowRatios(loan_address)

            expect(loan_ratio).to.be.eq(borrowRatio)
            
        });
    
        it(' should accrue the right amount amount of rewards based on Loan ratio (& be claimable)', async () => {
            
            await pool.connect(user2).borrow(spsp_token1.address, user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool.getLoansByBorrower(user2.address)).slice(-1)[0]

            await pool.connect(user2).closeBorrow(loan_address)

            const loan_data = await pool.getBorrowData(loan_address)

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
            
            await pool.connect(user2).borrow(spsp_token1.address, user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool.getLoansByBorrower(user2.address)).slice(-1)[0]

            const loan_ratio = await controller.loansBorrowRatios(loan_address)

            expect(loan_ratio).to.be.eq(borrowRatio)

            await controller.connect(admin).updatePoolBorrowRatio(pool.address, new_BorrowRatio)
            
            await pool.connect(user2).closeBorrow(loan_address)

            const loan_data = await pool.getBorrowData(loan_address)

            const expected_rewards = (loan_data._feesUsed).mul(loan_ratio).div(mantissa)

            const user_claimable_rewards = await controller.claimable(user2.address)

            expect(expected_rewards).to.be.eq(user_claimable_rewards)

        });
    
        it(' should update the ratio if Loan is Expanded', async () => {
            
            const new_BorrowRatio = ethers.utils.parseEther("0.55")
            
            await pool.connect(user2).borrow(spsp_token1.address, user2.address, borrow_amount, borrow_fees)

            const loan_address = (await pool.getLoansByBorrower(user2.address)).slice(-1)[0]

            await controller.connect(admin).updatePoolBorrowRatio(pool.address, new_BorrowRatio)

            await pool.connect(user2).expandBorrow(loan_address, expand_fees)

            const loan_ratio = await controller.loansBorrowRatios(loan_address)

            expect(loan_ratio).to.be.eq(new_BorrowRatio)

        });
    
        it(' should not allow to claim if not enough Reward Tokens in the Controller', async () => {
            
            const bigger_deposit_amount = ethers.utils.parseEther('5000')
            const bigger_borrow_amount = ethers.utils.parseEther('350')
            const bigger_borrow_fees = ethers.utils.parseEther('150')
            const bigger_ratio = ethers.utils.parseEther('200')

            await controller.connect(admin).updatePoolBorrowRatio(pool.address, bigger_ratio)

            await spsp_token1.connect(user1).approve(pool.address, bigger_deposit_amount)
            await pool.connect(user1).deposit(spsp_token1.address, bigger_deposit_amount)

            await spsp_token1.connect(user2).approve(pool.address, bigger_borrow_fees)


            await pool.connect(user2).borrow(spsp_token1.address, user2.address, bigger_borrow_amount, bigger_borrow_fees)

            const loan_address = (await pool.getLoansByBorrower(user2.address)).slice(-1)[0]

            await pool.connect(user2).closeBorrow(loan_address)

            await expect(
                controller.connect(user2).claim(user2.address)
            ).to.be.revertedWith('41')

        });
    
        it(' should not give rewards if no BorrowRatio set for the Pool', async () => {

            await controller.connect(admin).updatePoolBorrowRatio(pool.address, 0)

            await spsp_token2.connect(user1).approve(pool.address, deposit_amount)
            await pool.connect(user1).deposit(spsp_token2.address, deposit_amount)

            await spsp_token2.connect(user3).approve(pool.address, borrow_fees)

            
            await pool.connect(user3).borrow(spsp_token2.address, user3.address, borrow_amount, borrow_fees)


            const loan_address = (await pool.getLoansByBorrower(user3.address)).slice(-1)[0]

            await pool.connect(user3).closeBorrow(loan_address)

            const user_claimable_rewards = await controller.claimable(user3.address)

            expect(user_claimable_rewards).to.be.eq(0)

        });

    });

});