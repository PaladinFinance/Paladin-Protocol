import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PalToken } from "../../../typechain/PalToken";
import { PalLoanToken } from "../../../typechain/PalLoanToken";
import { MultiPalPoolPSP } from "../../../typechain/MultiPalPoolPSP";
import { MultiPoolController } from "../../../typechain/MultiPoolController";
import { InterestCalculator } from "../../../typechain/InterestCalculator";
import { SnapshotDelegator } from "../../../typechain/SnapshotDelegator";
import { IERC20 } from "../../../typechain/IERC20";
import { ISPSP } from "../../../typechain/ISPSP";
import { IERC20__factory } from "../../../typechain/factories/IERC20__factory";
import { ISPSP__factory } from "../../../typechain/factories/ISPSP__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { getTokens } from "../../utils/getERC20";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

const mantissaScale = ethers.utils.parseEther('1')

let poolFactory: ContractFactory
let tokenFactory: ContractFactory
let palLoanTokenFactory: ContractFactory
let controllerFactory: ContractFactory
let delegatorFactory: ContractFactory
let interestFactory: ContractFactory

const PSP_address = "0xcAfE001067cDEF266AfB7Eb5A286dCFD277f3dE5" //PSP contract on mainnet

const sPSP_1_address = "0x55A68016910A7Bcb0ed63775437e04d2bB70D570" //sPSP 1 contract on mainnet
const sPSP_3_address = "0xea02DF45f56A690071022c45c95c46E7F61d3eAb" //sPSP 3 contract on mainnet
const sPSP_4_address = "0x6b1D394Ca67fDB9C90BBd26FE692DdA4F4f53ECD" //sPSP 4 contract on mainnet

const sPSP_7_address = "0x37b1E4590638A266591a9C11d6f945fe7A1adAA7" //sPSP 7 contract on mainnet

const pool1_deposit_amount = ethers.utils.parseEther('20000')
const pool2_deposit_amount = ethers.utils.parseEther('15000')
const pool3_deposit_amount = ethers.utils.parseEther('3500')

describe('MultiPalPool - PSP : 2 - Deposit & Withdraw tests', () => {
    let admin: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress

    let pool: MultiPalPoolPSP
    let token1: PalToken
    let token2: PalToken
    let token3: PalToken
    let loanToken: PalLoanToken
    let controller: MultiPoolController
    let delegator: SnapshotDelegator
    let interest: InterestCalculator
    let psp_token: IERC20

    let fakePalToken: SignerWithAddress

    let spsp_token1: ISPSP
    let spsp_token2: ISPSP
    let spsp_token3: ISPSP

    let name1: string = "Paladin MOCK 1"
    let symbol1: string = "palMOCK1"
    let name2: string = "Paladin MOCK 2"
    let symbol2: string = "palMOCK2"
    let name3: string = "Paladin MOCK 3"
    let symbol3: string = "palMOCK3"

    
    before( async () => {
        tokenFactory = await ethers.getContractFactory("PalToken");
        palLoanTokenFactory = await ethers.getContractFactory("PalLoanToken");
        poolFactory = await ethers.getContractFactory("MultiPalPoolPSP");
        controllerFactory = await ethers.getContractFactory("MultiPoolController");
        delegatorFactory = await ethers.getContractFactory("SnapshotDelegator");
        interestFactory = await ethers.getContractFactory("InterestCalculator");

        [admin, user1, user2, fakePalToken] = await ethers.getSigners();


        psp_token = IERC20__factory.connect(PSP_address, provider);

        spsp_token1 = ISPSP__factory.connect(sPSP_1_address, provider);
        spsp_token2 = ISPSP__factory.connect(sPSP_3_address, provider);
        spsp_token3 = ISPSP__factory.connect(sPSP_4_address, provider);


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

        await psp_token.connect(admin).transfer(user2.address, ethers.utils.parseEther('25000'))

        await psp_token.connect(user2).approve(spsp_token1.address, ethers.utils.parseEther('2500'))
        await psp_token.connect(user2).approve(spsp_token3.address, ethers.utils.parseEther('10000'))

        await spsp_token1.connect(user2).enter(ethers.utils.parseEther('2500'))
        await spsp_token3.connect(user2).enter(ethers.utils.parseEther('10000'))
    })


    beforeEach( async () => {
        token1 = (await tokenFactory.connect(admin).deploy(name1, symbol1)) as PalToken;
        await token1.deployed();
        token2 = (await tokenFactory.connect(admin).deploy(name2, symbol2)) as PalToken;
        await token2.deployed();
        token3 = (await tokenFactory.connect(admin).deploy(name3, symbol3)) as PalToken;
        await token3.deployed();

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

        await controller.addNewPool(pool.address, [token1.address, token2.address, token3.address]);
    });


    describe('deposit', async () => {

        const amount = ethers.utils.parseEther('500')

        beforeEach(async () => {

            await spsp_token1.connect(user1).approve(pool.address, amount)

        });


        it(' should do the transfer correctly (& emit correct Event)', async () => {

            const old_poolBalance = await pool['underlyingBalance(address)'](spsp_token1.address)
            const old_balance_fromERC20 = await spsp_token1.balanceOf(pool.address)

            await expect(pool.connect(user1).deposit(spsp_token1.address, amount))
                .to.emit(pool, 'Deposit')
                .withArgs(spsp_token1.address, user1.address, amount, pool.address);

            const new_poolBalance = await pool['underlyingBalance(address)'](spsp_token1.address)
            const new_balance_fromERC20 = await spsp_token1.balanceOf(pool.address)

            expect(new_poolBalance.sub(old_poolBalance)).to.be.eq(amount)
            expect(new_balance_fromERC20.sub(old_balance_fromERC20)).to.be.eq(amount)
            expect(new_poolBalance).to.be.eq(new_balance_fromERC20)
            
        });


        it(' should mint the right amount of palToken', async () => {

            const exchRate = await pool.exchangeRateStored(token1.address)
            const expectedBalance = amount.mul(mantissaScale).div(exchRate)
            const old_Supply = await token1.totalSupply()

            await pool.connect(user1).deposit(spsp_token1.address, amount)

            const user_balance = await pool.connect(user1).balanceOf(token1.address, user1.address)
            const new_Supply = await token1.totalSupply()

            expect(user_balance).to.be.eq(expectedBalance)
            expect(new_Supply.sub(old_Supply)).to.be.eq(expectedBalance)

            expect(await pool.connect(user1).balanceOf(token2.address, user1.address)).to.be.eq(0)
            expect(await pool.connect(user1).balanceOf(token3.address, user1.address)).to.be.eq(0)
            
        });


        it(' should give the correct underlyingBalance for the user for the right underlying', async () => {

            await pool.connect(user1).deposit(spsp_token1.address, amount)

            const user_underlyingBalance = await pool.connect(user1)['underlyingBalanceOf(address,address)'](spsp_token1.address, user1.address)

            expect(user_underlyingBalance).to.be.eq(amount)

            expect(await pool.connect(user1)['underlyingBalanceOf(address,address)'](spsp_token2.address, user1.address)).to.be.eq(0)
            expect(await pool.connect(user1)['underlyingBalanceOf(address,address)'](spsp_token2.address, user1.address)).to.be.eq(0)

        });


        it(' should allow another user to deposit same underlying', async () => {

            const amount2 = ethers.utils.parseEther('750')

            await pool.connect(user1).deposit(spsp_token1.address, amount)

            const old_user1_balance = await pool.connect(user1).balanceOf(token1.address, user1.address)

            const exchRate = await pool.exchangeRateStored(token1.address)
            const expectedBalance = amount2.mul(mantissaScale).div(exchRate)
            const old_Supply = await token1.totalSupply()

            await spsp_token1.connect(user2).approve(pool.address, amount2)

            await pool.connect(user2).deposit(spsp_token1.address, amount2)

            const user2_balance = await pool.connect(user2).balanceOf(token1.address, user2.address)
            const new_Supply = await token1.totalSupply()

            const new_user1_balance = await pool.connect(user1).balanceOf(token1.address, user1.address)

            expect(user2_balance).to.be.eq(expectedBalance)
            expect(new_Supply.sub(old_Supply)).to.be.eq(expectedBalance)
            expect(old_user1_balance).to.be.eq(new_user1_balance)

            expect(await pool.connect(user2).balanceOf(token2.address, user2.address)).to.be.eq(0)
            expect(await pool.connect(user2).balanceOf(token3.address, user2.address)).to.be.eq(0)

        });


        it(' should allow user to deposit multiple underlyings', async () => {

            const amount2 = ethers.utils.parseEther('750')

            await pool.connect(user1).deposit(spsp_token1.address, amount)

            const old_user1_balance1 = await pool.connect(user1).balanceOf(token1.address, user1.address)

            const exchRate = await pool.exchangeRateStored(token1.address)
            const expectedBalance2 = amount2.mul(mantissaScale).div(exchRate)

            await spsp_token2.connect(user1).approve(pool.address, amount2)

            await pool.connect(user1).deposit(spsp_token2.address, amount2)

            const user1_balance2 = await pool.connect(user1).balanceOf(token2.address, user1.address)

            const new_user1_balance1 = await pool.connect(user1).balanceOf(token1.address, user1.address)

            expect(user1_balance2).to.be.eq(expectedBalance2)
            expect(old_user1_balance1).to.be.eq(new_user1_balance1)

            expect(await pool['underlyingBalanceOf(address,address)'](spsp_token1.address, user1.address)).to.be.eq(amount)
            expect(await pool['underlyingBalanceOf(address,address)'](spsp_token2.address, user1.address)).to.be.eq(amount2)
            expect(await pool['underlyingBalanceOf(address,address)'](spsp_token3.address, user1.address)).to.be.eq(0)

            expect(await pool.connect(user1).balanceOf(token3.address, user1.address)).to.be.eq(0)

        });


        it(' should not change the exchangeRate for underlyings', async () => {

            const old_exchRate1 = await pool.exchangeRateStored(token1.address)
            const old_exchRate2 = await pool.exchangeRateStored(token2.address)
            const old_exchRate3 = await pool.exchangeRateStored(token3.address)

            await pool.connect(user1).deposit(spsp_token1.address, amount)

            const new_exchRate1 = await pool.exchangeRateStored(token1.address)
            const new_exchRate2 = await pool.exchangeRateStored(token2.address)
            const new_exchRate3 = await pool.exchangeRateStored(token3.address)

            expect(old_exchRate1).to.be.eq(new_exchRate1)
            expect(old_exchRate2).to.be.eq(new_exchRate2)
            expect(old_exchRate3).to.be.eq(new_exchRate3)

            await spsp_token2.connect(user1).approve(pool.address, ethers.utils.parseEther('800'))
            await pool.connect(user1).deposit(spsp_token2.address, ethers.utils.parseEther('800'))

            const newest_exchRate1 = await pool.exchangeRateStored(token1.address)
            const newest_exchRate2 = await pool.exchangeRateStored(token2.address)
            const newest_exchRate3 = await pool.exchangeRateStored(token3.address)

            expect(newest_exchRate1).to.be.eq(old_exchRate1)
            expect(newest_exchRate2).to.be.eq(old_exchRate2)
            expect(newest_exchRate3).to.be.eq(old_exchRate3)
            
        });


        it(' should fail if underlying is not listed', async () => {

            const enter_amount = ethers.utils.parseEther('1000')
            const deposit_amount = ethers.utils.parseEther('800')

            const spsp_token7 = ISPSP__factory.connect(sPSP_7_address, provider);

            await psp_token.connect(user1).approve(spsp_token7.address, enter_amount)

            await spsp_token7.connect(user1).enter(enter_amount)

            await spsp_token7.connect(user1).approve(pool.address, deposit_amount)

            await expect(
                pool.connect(user1).deposit(spsp_token7.address, deposit_amount)
            ).to.be.reverted
            
        });


        it(' should fail if no allowance', async () => {

            await expect(
                pool.connect(user1).deposit(spsp_token2.address, amount)
            ).to.be.reverted
            
        });


        it(' should fail if the user does not have the funds', async () => {

            await spsp_token2.connect(user2).approve(pool.address, amount)

            await expect(
                pool.connect(user2).deposit(spsp_token2.address, amount)
            ).to.be.reverted
            
        });

    });


    describe('withdraw', async () => {

        const deposit = ethers.utils.parseEther('1000')
        //calculated with exhcangeRate = 1e18
        const amount = ethers.utils.parseEther('500')
        const paltoken_amount = ethers.utils.parseEther('500')

        beforeEach(async () => {

            await spsp_token1.connect(user1).approve(pool.address, deposit)

            await pool.connect(user1).deposit(spsp_token1.address, deposit)

        });


        it(' should withdraw funds correctly (& emit the correct Event)', async () => {

            const old_poolBalance = await pool['underlyingBalance(address)'](spsp_token1.address)
            const old_balance_fromERC20 = await spsp_token1.balanceOf(pool.address)

            await expect(pool.connect(user1).withdraw(token1.address, paltoken_amount))
                .to.emit(pool, 'Withdraw')
                .withArgs(spsp_token1.address, user1.address, paltoken_amount, pool.address);

            const new_poolBalance = await pool['underlyingBalance(address)'](spsp_token1.address)
            const new_balance_fromERC20 = await spsp_token1.balanceOf(pool.address)

            expect(old_poolBalance.sub(new_poolBalance)).to.be.eq(amount)
            expect(old_balance_fromERC20.sub(new_balance_fromERC20)).to.be.eq(amount)
            expect(new_poolBalance).to.be.eq(new_balance_fromERC20)
            
        });


        it(' should return the expected amount & burn the right amount of palToken', async () => {

            const exchRate = await pool.exchangeRateStored(token1.address)
            const expectedAmount = paltoken_amount.mul(exchRate).div(mantissaScale)
            
            const old_Supply = await token1.totalSupply()
            const oldBalance = await spsp_token1.connect(user1).balanceOf(user1.address)

            await pool.connect(user1).withdraw(token1.address, paltoken_amount)

            const newBalance = await spsp_token1.connect(user1).balanceOf(user1.address)
            const new_Supply = await token1.totalSupply()

            expect(old_Supply.sub(new_Supply)).to.be.eq(paltoken_amount)
            expect(newBalance.sub(oldBalance)).to.be.eq(expectedAmount)
            
        });


        it(' should update users balance & underlying balance correctly', async () => {

            const oldBalance = await pool.connect(user1).balanceOf(token1.address, user1.address)
            const oldunderlyingBalance = await pool['underlyingBalanceOf(address,address)'](spsp_token1.address, user1.address)

            await pool.connect(user1).withdraw(token1.address, paltoken_amount)

            const newBalance = await pool.connect(user1).balanceOf(token1.address, user1.address)
            const newunderlyingBalance = await pool['underlyingBalanceOf(address,address)'](spsp_token1.address, user1.address)

            expect(oldBalance.sub(newBalance)).to.be.eq(paltoken_amount)
            expect(oldunderlyingBalance.sub(newunderlyingBalance)).to.be.eq(amount)
            
        });


        it(' should not change exchangeRate value', async () => {

            const old_exchRate1 = await pool.exchangeRateStored(token1.address)
            const old_exchRate2 = await pool.exchangeRateStored(token2.address)
            const old_exchRate3 = await pool.exchangeRateStored(token3.address)

            await pool.connect(user1).withdraw(token1.address, paltoken_amount)

            const new_exchRate1 = await pool.exchangeRateStored(token1.address)
            const new_exchRate2 = await pool.exchangeRateStored(token2.address)
            const new_exchRate3 = await pool.exchangeRateStored(token3.address)

            expect(old_exchRate1).to.be.eq(new_exchRate1)
            expect(old_exchRate2).to.be.eq(new_exchRate2)
            expect(old_exchRate3).to.be.eq(new_exchRate3)
            
        });

        
        it(' should fail if user balance is too low', async () => {

            await expect(
                pool.connect(user2).withdraw(token1.address, paltoken_amount)
            ).to.be.revertedWith('10')
            
        });

        
        it(' should fail if no balance for this underlying', async () => {

            await expect(
                pool.connect(user1).withdraw(token2.address, paltoken_amount)
            ).to.be.revertedWith('10')
            
        });

        
        it(' should fail if incorrect palToken', async () => {

            await expect(
                pool.connect(user1).withdraw(fakePalToken.address, paltoken_amount)
            ).to.be.revertedWith('48')
            
        });

        
        it(' should fail if pool cash is too low', async () => {

            const fees = ethers.utils.parseEther('70')
            await spsp_token1.connect(user1).transfer(user2.address, fees)

            await spsp_token1.connect(user2).approve(pool.address, fees)

            await pool.connect(user2).borrow(spsp_token1.address, user2.address, ethers.utils.parseEther('700'), fees)

            await expect(
                pool.connect(user1).withdraw(token1.address, paltoken_amount)
            ).to.be.revertedWith('9')
            
        });

    });

    describe('withdraw - scenario with interests', async () => {

        const deposit = ethers.utils.parseEther('1000')

        const borrow = ethers.utils.parseEther('100')
        const borrowFees = ethers.utils.parseEther('5')

        const paltoken_amount = ethers.utils.parseEther('1000')

        beforeEach(async () => {

            await spsp_token1.connect(user1).approve(pool.address, deposit)
            await spsp_token1.connect(user2).approve(pool.address, borrowFees)

            await spsp_token3.connect(user2).approve(pool.address, deposit)

            
        });


        it(' should increase exhangeRate and return the correct amount', async () => {

            await pool.connect(user1).deposit(spsp_token1.address, deposit)

            await pool.connect(user2).deposit(spsp_token3.address, deposit)

            const oldBalance = await spsp_token1.connect(user1).balanceOf(user1.address)

            const old_exchRate = await pool.exchangeRateStored(token1.address)
            const old_exchRate2 = await pool.exchangeRateStored(token2.address)
            const old_exchRate3 = await pool.exchangeRateStored(token3.address)

            const oldBalance2 = await pool.balanceOf(token3.address, user2.address)
            const old_underlyingBalance2 = await pool['underlyingBalanceOf(address,address)'](spsp_token3.address, user2.address)

            await pool.connect(user2).borrow(spsp_token1.address, user2.address, borrow, borrowFees)

            const loan_address = (await pool.getLoansByBorrower(user2.address))[0]

            await pool.connect(user2).closeBorrow(loan_address)

            const new_exchRate = await pool.exchangeRateStored(token1.address)
            const new_exchRate2 = await pool.exchangeRateStored(token2.address)
            const new_exchRate3 = await pool.exchangeRateStored(token3.address)

            const newBalance2 = await pool.balanceOf(token3.address, user2.address)
            const new_underlyingBalance2 = await pool['underlyingBalanceOf(address,address)'](spsp_token3.address, user2.address)

            expect(new_exchRate).to.be.above(old_exchRate)

            await pool.connect(user1).withdraw(token1.address, paltoken_amount)

            const expected_amount_plus_interests = paltoken_amount.mul(new_exchRate).div(mantissaScale)

            const newBalance = await spsp_token1.connect(user1).balanceOf(user1.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(expected_amount_plus_interests)

            //check that it doesn't change other underlyings deposit/exchangeRates/underlyingBalance
            expect(old_exchRate2).to.be.eq(new_exchRate2)
            expect(old_exchRate3).to.be.eq(new_exchRate3)

            expect(oldBalance2).to.be.eq(newBalance2)

            expect(old_underlyingBalance2).to.be.eq(new_underlyingBalance2)
            
        });
        
    });

});