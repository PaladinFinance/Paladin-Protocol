import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PalToken } from "../../typechain/PalToken";
import { PalPool } from "../../typechain/PalPool";
import { PaladinController } from "../../typechain/PaladinController";
import { InterestCalculator } from "../../typechain/InterestCalculator";
import { Comp } from "../../typechain/Comp";
import { BasicDelegator } from "../../typechain/BasicDelegator";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { poll } from "@ethersproject/web";

chai.use(solidity);
const { expect } = chai;

const mantissaScale = ethers.utils.parseEther('1')

let poolFactory: ContractFactory
let tokenFactory: ContractFactory
let controllerFactory: ContractFactory
let delegatorFactory: ContractFactory
let interestFactory: ContractFactory
let erc20Factory: ContractFactory

describe('PalPool : 2 - Deposit & Withdraw tests', () => {
    let admin: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress

    let pool: PalPool
    let token: PalToken
    let controller: PaladinController
    let delegator: BasicDelegator
    let interest: InterestCalculator
    let underlying: Comp

    let name: string = "Paladin MOCK"
    let symbol: string = "palMOCK"

    
    before( async () => {
        tokenFactory = await ethers.getContractFactory("PalToken");
        poolFactory = await ethers.getContractFactory("PalPool");
        controllerFactory = await ethers.getContractFactory("PaladinController");
        delegatorFactory = await ethers.getContractFactory("BasicDelegator");
        interestFactory = await ethers.getContractFactory("InterestCalculator");
        erc20Factory = await ethers.getContractFactory("Comp");
    })


    beforeEach( async () => {
        [admin, user1, user2] = await ethers.getSigners();

        token = (await tokenFactory.connect(admin).deploy(name, symbol)) as PalToken;
        await token.deployed();

        underlying = (await erc20Factory.connect(admin).deploy(admin.address)) as Comp;
        await underlying.deployed();

        controller = (await controllerFactory.connect(admin).deploy()) as PaladinController;
        await controller.deployed();

        interest = (await interestFactory.connect(admin).deploy()) as InterestCalculator;
        await interest.deployed();

        delegator = (await delegatorFactory.connect(admin).deploy()) as BasicDelegator;
        await delegator.deployed();

        pool = (await poolFactory.connect(admin).deploy(
            token.address,
            controller.address, 
            underlying.address,
            interest.address,
            delegator.address
        )) as PalPool;
        await pool.deployed();

        await token.initiate(pool.address);

        await controller.addNewPool(token.address, pool.address);
    });


    describe('deposit', async () => {

        const amount = ethers.utils.parseEther('500')

        beforeEach(async () => {
            await underlying.connect(admin).transfer(user1.address, amount)

            await underlying.connect(user1).approve(pool.address, amount)
        });


        it(' should do the transfer correctly (& emit correct Event)', async () => {

            const old_poolBalance = await pool._underlyingBalance()
            const old_balance_fromERC20 = await underlying.balanceOf(pool.address)

            await expect(pool.connect(user1).deposit(amount))
                .to.emit(pool, 'Deposit')
                .withArgs(user1.address, amount, pool.address);

            const new_poolBalance = await pool._underlyingBalance()
            const new_balance_fromERC20 = await underlying.balanceOf(pool.address)

            expect(new_poolBalance.sub(old_poolBalance)).to.be.eq(amount)
            expect(new_balance_fromERC20.sub(old_balance_fromERC20)).to.be.eq(amount)
            expect(new_poolBalance).to.be.eq(new_balance_fromERC20)
            
        });


        it(' should mint the right amount of palToken', async () => {

            const exchRate = await pool.exchangeRateStored()
            const expectedBalance = amount.mul(mantissaScale).div(exchRate)
            const old_Supply = await token.totalSupply()

            await pool.connect(user1).deposit(amount)

            const user_balance = await pool.connect(user1).balanceOf(user1.address)
            const new_Supply = await token.totalSupply()

            expect(user_balance).to.be.eq(expectedBalance)
            expect(new_Supply.sub(old_Supply)).to.be.eq(expectedBalance)
            
        });


        it(' should give the correct underlyingBalance for the user', async () => {

            await pool.connect(user1).deposit(amount)

            const user_underlyingBalance = await pool.connect(user1).underlyingBalanceOf(user1.address)

            expect(user_underlyingBalance).to.be.eq(amount)
        });


        it(' should not change the exchangeRate', async () => {

            const old_exchRate = await pool.exchangeRateStored()

            await pool.connect(user1).deposit(amount)

            const new_exchRate = await pool.exchangeRateStored()

            expect(old_exchRate).to.be.eq(new_exchRate)
            
        });


        it(' should fail of no allowance', async () => {
            await underlying.connect(admin).transfer(user2.address, amount)

            await expect(
                pool.connect(user2).deposit(amount)
            ).to.be.reverted
            
        });


        it(' should fail if the user does not have the funds', async () => {

            await expect(
                pool.connect(user2).deposit(amount)
            ).to.be.reverted
            
        });

    });


    describe('withdraw', async () => {

        const deposit = ethers.utils.parseEther('1000')
        //calculated with exhcangeRate = 0.02e18
        const amount = ethers.utils.parseEther('500')
        const paltoken_amount = ethers.utils.parseEther('500')

        beforeEach(async () => {
            await underlying.connect(admin).transfer(user1.address, deposit)

            await underlying.connect(user1).approve(pool.address, deposit)

            await pool.connect(user1).deposit(deposit)
        });


        it(' should withdraw funds correctly (& emit the correct Event)', async () => {

            const old_poolBalance = await pool._underlyingBalance()
            const old_balance_fromERC20 = await underlying.balanceOf(pool.address)

            await expect(pool.connect(user1).withdraw(paltoken_amount))
                .to.emit(pool, 'Withdraw')
                .withArgs(user1.address, paltoken_amount, pool.address);

            const new_poolBalance = await pool._underlyingBalance()
            const new_balance_fromERC20 = await underlying.balanceOf(pool.address)

            expect(old_poolBalance.sub(new_poolBalance)).to.be.eq(amount)
            expect(old_balance_fromERC20.sub(new_balance_fromERC20)).to.be.eq(amount)
            expect(new_poolBalance).to.be.eq(new_balance_fromERC20)
            
        });


        it(' should return the expected amount & burn the right amount of palToken', async () => {

            const exchRate = await pool.exchangeRateStored()
            const expectedAmount = paltoken_amount.mul(exchRate).div(mantissaScale)
            
            const old_Supply = await token.totalSupply()
            const oldBalance = await underlying.connect(user1).balanceOf(user1.address)

            await pool.connect(user1).withdraw(paltoken_amount)

            const newBalance = await underlying.connect(user1).balanceOf(user1.address)
            const new_Supply = await token.totalSupply()

            expect(old_Supply.sub(new_Supply)).to.be.eq(paltoken_amount)
            expect(newBalance.sub(oldBalance)).to.be.eq(expectedAmount)
            
        });


        it(' should update users balance & underlying balance correctly', async () => {

            const oldBalance = await pool.connect(user1).balanceOf(user1.address)
            const oldunderlyingBalance = await pool.connect(user1).underlyingBalanceOf(user1.address)

            await pool.connect(user1).withdraw(paltoken_amount)

            const newBalance = await pool.connect(user1).balanceOf(user1.address)
            const newunderlyingBalance = await pool.connect(user1).underlyingBalanceOf(user1.address)

            expect(oldBalance.sub(newBalance)).to.be.eq(paltoken_amount)
            expect(oldunderlyingBalance.sub(newunderlyingBalance)).to.be.eq(amount)
            
        });


        it(' should not change exchangeRate value', async () => {

            const old_exchRate = await pool.exchangeRateStored()

            await pool.connect(user1).withdraw(paltoken_amount)

            const new_exchRate = await pool.exchangeRateStored()

            expect(old_exchRate).to.be.eq(new_exchRate)
            
        });

        
        it(' should fail if user balance is too low', async () => {

            await expect(
                pool.connect(user2).withdraw(paltoken_amount)
            ).to.be.revertedWith('10')
            
        });

        
        it(' should fail if pool cash is too low', async () => {

            const fees = ethers.utils.parseEther('70')
            await underlying.connect(admin).transfer(user2.address, fees)

            await underlying.connect(user2).approve(pool.address, fees)

            await pool.connect(user2).borrow(ethers.utils.parseEther('700'), fees)

            await expect(
                pool.connect(user1).withdraw(paltoken_amount)
            ).to.be.revertedWith('9')
            
        });

    });

    describe('withdraw - scenario with interests', async () => {

        const deposit = ethers.utils.parseEther('1000')

        const borrow = ethers.utils.parseEther('100')
        const borrowFees = ethers.utils.parseEther('5')

        const paltoken_amount = ethers.utils.parseEther('1000')

        beforeEach(async () => {
            await underlying.connect(admin).transfer(user1.address, deposit)
            await underlying.connect(admin).transfer(user2.address, borrowFees)

            await underlying.connect(user1).approve(pool.address, deposit)
            await underlying.connect(user2).approve(pool.address, borrowFees)

            
        });


        it(' should increase exhangeRate and return the correct amount', async () => {

            await pool.connect(user1).deposit(deposit)

            const old_exchRate = await pool.exchangeRateStored()

            await pool.connect(user2).borrow(borrow, borrowFees)

            const loan_address = (await pool.getLoansByBorrower(user2.address))[0]

            await pool.connect(user2).closeBorrow(loan_address)

            const new_exchRate = await pool.exchangeRateStored()

            expect(new_exchRate).to.be.above(old_exchRate)

            await pool.connect(user1).withdraw(paltoken_amount)

            const expected_amount_plus_interests = paltoken_amount.mul(new_exchRate).div(mantissaScale)

            const newBalance = await underlying.connect(user1).balanceOf(user1.address)

            expect(newBalance).to.be.eq(expected_amount_plus_interests)
            
        });
        
    });

});