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

const pool1_deposit_amount = ethers.utils.parseEther('20000')
const pool2_deposit_amount = ethers.utils.parseEther('15000')
const pool3_deposit_amount = ethers.utils.parseEther('3500')

describe('MultiPalPool - PSP : 1 - constructor and storage tests', () => {
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

        [admin, user1, user2] = await ethers.getSigners();


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


    describe('constructor', async () => {

        it(' should deploy and set the correct parameters', async () => {

            expect(pool.address).to.properAddress

            const pool_controller: string = await pool.controller()
            const pool_loanToken: string = await pool.palLoanToken()

            expect(pool_controller).to.be.eq(controller.address)
            expect(pool_loanToken).to.be.eq(loanToken.address)
            
        });

        it(' should fail if inequal arrays', async () => {

            await expect(
                poolFactory.connect(admin).deploy(
                    [token1.address, token2.address],
                    controller.address, 
                    [spsp_token1.address,spsp_token2.address,spsp_token3.address],
                    interest.address,
                    delegator.address,
                    loanToken.address
                )
            ).to.be.revertedWith('46')

            await expect(
                poolFactory.connect(admin).deploy(
                    [token1.address, token2.address, token3.address],
                    controller.address, 
                    [spsp_token1.address,spsp_token3.address],
                    interest.address,
                    delegator.address,
                    loanToken.address
                )
            ).to.be.revertedWith('46')
            
        });

    });


    describe('storage values', async () => {

        it(' should have the correct values', async () => {

            expect(await pool.underlyings(0)).to.be.eq(spsp_token1.address)
            expect(await pool.underlyings(1)).to.be.eq(spsp_token2.address)
            expect(await pool.underlyings(2)).to.be.eq(spsp_token3.address)

            expect(await pool.palTokens(spsp_token1.address)).to.be.eq(token1.address)
            expect(await pool.palTokens(spsp_token2.address)).to.be.eq(token2.address)
            expect(await pool.palTokens(spsp_token3.address)).to.be.eq(token3.address)

            expect(await pool.palTokenToUnderlying(token1.address)).to.be.eq(spsp_token1.address)
            expect(await pool.palTokenToUnderlying(token2.address)).to.be.eq(spsp_token2.address)
            expect(await pool.palTokenToUnderlying(token3.address)).to.be.eq(spsp_token3.address)


            const pool_minBorrowLength: BigNumber = await pool.minBorrowLength()

            expect(pool_minBorrowLength).to.be.eq(45290)


            const pool_reserveFactor: BigNumber = await pool.reserveFactor()
            const expected_reserveFactor = ethers.utils.parseEther('0.2')
            
            expect(pool_reserveFactor).to.be.eq(expected_reserveFactor)


            const pool_killFactor: BigNumber = await pool.killFactor()
            const pool_killerRatio: BigNumber = await pool.killerRatio()
            const expected_killFactor = ethers.utils.parseEther('0.95')
            const expected_killerRatio = ethers.utils.parseEther('0.1')
            
            expect(pool_killFactor).to.be.eq(expected_killFactor)
            expect(pool_killerRatio).to.be.eq(expected_killerRatio)


            const pool_general_borrows: BigNumber = await pool.totalBorrowed()
            const pool_general_reserves: BigNumber = await pool.totalReserve()

            expect(pool_general_borrows).to.be.eq(0)
            expect(pool_general_reserves).to.be.eq(0)

            const pool_borrowIndex: BigNumber = await pool.borrowIndex()
            const expected_borrowIndex: BigNumber = ethers.utils.parseEther('1')

            expect(pool_borrowIndex).to.be.eq(expected_borrowIndex)

            const pool_general_numberActiveLoans: BigNumber = await pool.numberActiveLoans()

            expect(pool_general_numberActiveLoans).to.be.eq(0)


            const pool_poolState1 = await pool.poolStates(spsp_token1.address)

            expect(pool_poolState1.totalReserve).to.be.eq(0)
            expect(pool_poolState1.totalBorrowed).to.be.eq(0)
            expect(pool_poolState1.accruedFees).to.be.eq(0)
            expect(pool_poolState1.numberActiveLoans).to.be.eq(0)


            const pool_poolState2 = await pool.poolStates(spsp_token2.address)

            expect(pool_poolState2.totalReserve).to.be.eq(0)
            expect(pool_poolState2.totalBorrowed).to.be.eq(0)
            expect(pool_poolState2.accruedFees).to.be.eq(0)
            expect(pool_poolState2.numberActiveLoans).to.be.eq(0)


            const pool_poolState3 = await pool.poolStates(spsp_token3.address)

            expect(pool_poolState3.totalReserve).to.be.eq(0)
            expect(pool_poolState3.totalBorrowed).to.be.eq(0)
            expect(pool_poolState3.accruedFees).to.be.eq(0)
            expect(pool_poolState3.numberActiveLoans).to.be.eq(0)
            

        });

    });

    describe('data fetching functions', async () => {

        describe('underlyingBalance', async () => {

            it(' should return the correct cash amount (0)', async () => {
    
                const pool_cash: BigNumber = await pool['underlyingBalance()']()

                expect(pool_cash).to.be.eq(0)
                
            });
    
        });


        describe('borrowRatePerBlock', async () => {

            it(' should have the same value as the Interest module', async () => {
    
                const pool_borrows: BigNumber = await pool.totalBorrowed()
                const pool_reserves: BigNumber = await pool.totalReserve()
                const pool_cash: BigNumber = await pool['underlyingBalance()']()

                expect(await pool.borrowRatePerBlock()).to.be.eq(await interest.getBorrowRate(pool.address, pool_cash, pool_borrows, pool_reserves))
                
            });
    
        });


        describe('supplyRatePerBlock', async () => {

            it(' should have the same value as the Interest module', async () => {

                const pool_poolState1 = await pool.poolStates(spsp_token1.address)
    
                const pool_borrows: BigNumber = pool_poolState1.totalBorrowed
                const pool_reserves: BigNumber = pool_poolState1.totalReserve
                const pool_cash: BigNumber = await pool['underlyingBalance(address)'](spsp_token1.address)
                const pool_reserveFactor: BigNumber = await pool.reserveFactor()

                expect(await pool.supplyRatePerBlock(spsp_token1.address)).to.be.eq(await interest.getSupplyRate(pool.address, pool_cash, pool_borrows, pool_reserves, pool_reserveFactor))
                
            });
    
        });


        describe('exchangeRateStored', async () => {

            it(' should have the correct base value', async () => {
    
                const pool_exchRate1: BigNumber = await pool.exchangeRateStored(token1.address)
                const expected_exchRate1: BigNumber = ethers.utils.parseEther('1')

                expect(pool_exchRate1).to.be.eq(expected_exchRate1)

                const pool_exchRate2: BigNumber = await pool.exchangeRateStored(token2.address)
                const expected_exchRate2: BigNumber = ethers.utils.parseEther('1')

                expect(pool_exchRate2).to.be.eq(expected_exchRate2)

                const pool_exchRate3: BigNumber = await pool.exchangeRateStored(token3.address)
                const expected_exchRate3: BigNumber = ethers.utils.parseEther('1')

                expect(pool_exchRate3).to.be.eq(expected_exchRate3)
                
            });
    
        });


        describe('exchangeRateCurrent', async () => {

            it(' should have the correct base value', async () => {

                const pool_exchRate1: BigNumber = await pool.callStatic.exchangeRateCurrent(token1.address)
                const expected_exchRate1: BigNumber = ethers.utils.parseEther('1')

                expect(pool_exchRate1).to.be.eq(expected_exchRate1)

                const pool_exchRate2: BigNumber = await pool.callStatic.exchangeRateCurrent(token2.address)
                const expected_exchRate2: BigNumber = ethers.utils.parseEther('1')

                expect(pool_exchRate2).to.be.eq(expected_exchRate2)

                const pool_exchRate3: BigNumber = await pool.callStatic.exchangeRateCurrent(token3.address)
                const expected_exchRate3: BigNumber = ethers.utils.parseEther('1')

                expect(pool_exchRate3).to.be.eq(expected_exchRate3)
                
            });
    
        });


        describe('balanceOf & underlyingBalanceOf', async () => {

            it(' should have null balances for users', async () => {
    
                expect(
                    await pool.connect(user1).balanceOf(token1.address, user1.address)
                ).to.be.eq(0)
                expect(
                    await pool.connect(user1).balanceOf(token2.address, user1.address)
                ).to.be.eq(0)
                expect(
                    await pool.connect(user1).balanceOf(token2.address, user1.address)
                ).to.be.eq(0)

                expect(
                    await pool.connect(user2).balanceOf(token1.address, user2.address)
                ).to.be.eq(0)

                expect(
                    await pool['underlyingBalanceOf(address)'](user1.address)
                ).to.be.eq(0)
                expect(
                    await pool['underlyingBalanceOf(address)'](user2.address)
                ).to.be.eq(0)

                expect(
                    await pool['underlyingBalanceOf(address,address)'](spsp_token1.address, user1.address)
                ).to.be.eq(0)
                expect(
                    await pool['underlyingBalanceOf(address,address)'](spsp_token2.address, user1.address)
                ).to.be.eq(0)
                expect(
                    await pool['underlyingBalanceOf(address,address)'](spsp_token3.address, user1.address)
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