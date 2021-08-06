import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PalToken } from "../../typechain/PalToken";
import { PalLoanToken } from "../../typechain/PalLoanToken";
import { PalPool } from "../../typechain/PalPool";
import { PaladinController } from "../../typechain/PaladinController";
import { InterestCalculator } from "../../typechain/InterestCalculator";
import { Comp } from "../../typechain/Comp";
import { BasicDelegator } from "../../typechain/BasicDelegator";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";

chai.use(solidity);
const { expect } = chai;

let poolFactory: ContractFactory
let tokenFactory: ContractFactory
let palLoanTokenFactory: ContractFactory
let controllerFactory: ContractFactory
let delegatorFactory: ContractFactory
let interestFactory: ContractFactory
let erc20Factory: ContractFactory

describe('PalPool : 1 - constructor and storage tests', () => {
    let admin: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress

    let pool: PalPool
    let token: PalToken
    let loanToken: PalLoanToken
    let controller: PaladinController
    let delegator: BasicDelegator
    let interest: InterestCalculator
    let underlying: Comp

    let name: string = "Paladin MOCK"
    let symbol: string = "palMOCK"

    
    before( async () => {
        tokenFactory = await ethers.getContractFactory("PalToken");
        palLoanTokenFactory = await ethers.getContractFactory("PalLoanToken");
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

        loanToken = (await palLoanTokenFactory.connect(admin).deploy(controller.address, "about:blank")) as PalLoanToken;
        await loanToken.deployed();

        interest = (await interestFactory.connect(admin).deploy()) as InterestCalculator;
        await interest.deployed();

        delegator = (await delegatorFactory.connect(admin).deploy()) as BasicDelegator;
        await delegator.deployed();

        pool = (await poolFactory.connect(admin).deploy(
            token.address,
            controller.address, 
            underlying.address,
            interest.address,
            delegator.address,
            loanToken.address
        )) as PalPool;
        await pool.deployed();

        await token.initiate(pool.address);

        await controller.addNewPool(token.address, pool.address);
    });


    describe('constructor', async () => {

        it(' should deploy and set the correct parameters', async () => {

            expect(pool.address).to.properAddress

            const pool_token: string = await pool.palToken()
            const pool_underlying: string = await pool.underlying()
            const pool_controller: string = await pool.controller()
            const pool_loanToken: string = await pool.palLoanToken()

            expect(pool_token).to.be.eq(token.address)
            expect(pool_underlying).to.be.eq(underlying.address)
            expect(pool_controller).to.be.eq(controller.address)
            expect(pool_loanToken).to.be.eq(loanToken.address)
            
        });

    });


    describe('storage values', async () => {

        it(' should have the correct values', async () => {

            const pool_borrows: BigNumber = await pool.totalBorrowed()
            const pool_reserves: BigNumber = await pool.totalReserve()

            expect(pool_borrows).to.be.eq(0)
            expect(pool_reserves).to.be.eq(0)


            const pool_minBorrowLength: BigNumber = await pool.minBorrowLength()

            expect(pool_minBorrowLength).to.be.eq(45290)


            const pool_reserveFactor: BigNumber = await pool.reserveFactor()
            const expected_reserveFactor = ethers.utils.parseEther('0.2')
            
            expect(pool_reserveFactor).to.be.eq(expected_reserveFactor)


            const pool_killFactor: BigNumber = await pool.killFactor()
            const pool_killerRatio: BigNumber = await pool.killerRatio()
            const expected_killFactor = ethers.utils.parseEther('0.96')
            const expected_killerRatio = ethers.utils.parseEther('0.15')
            
            expect(pool_killFactor).to.be.eq(expected_killFactor)
            expect(pool_killerRatio).to.be.eq(expected_killerRatio)

            
            const pool_borrowIndex: BigNumber = await pool.borrowIndex()
            const expected_borrowIndex: BigNumber = ethers.utils.parseEther('1000000000000000000')

            expect(pool_borrowIndex).to.be.eq(expected_borrowIndex)

        });

    });

    describe('data fetching functions', async () => {

        describe('underlyingBalance', async () => {

            it(' should return the correct cash amount (0)', async () => {
    
                const pool_cash: BigNumber = await pool.underlyingBalance()

                expect(pool_cash).to.be.eq(0)
                
            });
    
        });


        describe('borrowRatePerBlock', async () => {

            it(' should have the same value as the Interest module', async () => {
    
                const pool_borrows: BigNumber = await pool.totalBorrowed()
                const pool_reserves: BigNumber = await pool.totalReserve()
                const pool_cash: BigNumber = await pool.underlyingBalance()

                expect(await pool.borrowRatePerBlock()).to.be.eq(await interest.getBorrowRate(pool.address, pool_cash, pool_borrows, pool_reserves))
                
            });
    
        });


        describe('supplyRatePerBlock', async () => {

            it(' should have the same value as the Interest module', async () => {
    
                const pool_borrows: BigNumber = await pool.totalBorrowed()
                const pool_reserves: BigNumber = await pool.totalReserve()
                const pool_cash: BigNumber = await pool.underlyingBalance()
                const pool_reserveFactor: BigNumber = await pool.reserveFactor()

                expect(await pool.supplyRatePerBlock()).to.be.eq(await interest.getSupplyRate(pool.address, pool_cash, pool_borrows, pool_reserves, pool_reserveFactor))
                
            });
    
        });


        describe('exchangeRateStored', async () => {

            it(' should have the correct base value', async () => {
    
                const pool_exchRate: BigNumber = await pool.exchangeRateStored()
                const expected_exchRate: BigNumber = ethers.utils.parseEther('1')

                expect(pool_exchRate).to.be.eq(expected_exchRate)
                
            });
    
        });


        describe('exchangeRateCurrent', async () => {

            it(' should have the correct base value', async () => {
    
                const pool_exchRate: BigNumber = await pool.callStatic.exchangeRateCurrent()
                const expected_exchRate: BigNumber = ethers.utils.parseEther('1')

                expect(pool_exchRate).to.be.eq(expected_exchRate)
                
            });
    
        });


        describe('balanceof & underlyingBalanceOf', async () => {

            it(' should not null balances for users', async () => {
    
                expect(
                    await pool.connect(user1).balanceOf(user1.address)
                ).to.be.eq(0)

                expect(
                    await pool.connect(user2).balanceOf(user2.address)
                ).to.be.eq(0)

                expect(
                    await pool.connect(user1).underlyingBalanceOf(user1.address)
                ).to.be.eq(0)

                expect(
                    await pool.connect(user2).underlyingBalanceOf(user2.address)
                ).to.be.eq(0)
                
            });
    
        });


        describe('getLoanPools', async () => {

            it(' should not have any palLoan', async () => {
    
                const pool_loans: string[] = await pool.getLoansPools()

                expect(pool_loans).to.be.empty
                
            });
    
        });

    });

});