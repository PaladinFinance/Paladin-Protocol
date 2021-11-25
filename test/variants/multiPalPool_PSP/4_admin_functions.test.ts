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

const sPSP_7_address = "0x37b1E4590638A266591a9C11d6f945fe7A1adAA7" //sPSP 7 contract on mainnet

const pool1_deposit_amount = ethers.utils.parseEther('20000')
const pool2_deposit_amount = ethers.utils.parseEther('15000')
const pool3_deposit_amount = ethers.utils.parseEther('3500')


describe('MultiPalPool - PSP : 4 - Admin functions tests', () => {
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


    describe('addUnderlying', async () => {

        let new_underlying: ISPSP
        let new_palToken: PalToken


        beforeEach( async () => {
            new_underlying = ISPSP__factory.connect(sPSP_7_address, provider);

            new_palToken = (await tokenFactory.connect(admin).deploy("Paladin MOCK 4", "palMOCK4")) as PalToken;
            await new_palToken.deployed();
        });


        it(' should list the new underlying & palToken (& with the correct event)', async () => {

            await expect(pool.connect(admin).addUnderlying(new_underlying.address, new_palToken.address))
                .to.emit(pool, 'AddUnderlying')
                .withArgs(new_underlying.address, new_palToken.address);

            const underlying_count = await pool.underlyingCount()

            expect(await pool.underlyings(underlying_count.sub(1))).to.be.eq(new_underlying.address)

            expect(await pool.palTokens(new_underlying.address)).to.be.eq(new_palToken.address)

            expect(await pool.palTokenToUnderlying(new_palToken.address)).to.be.eq(new_underlying.address)
            
        });


        it(' should not add an underlying already listed', async () => {

            await pool.connect(admin).addUnderlying(new_underlying.address, new_palToken.address)

            await expect(
                pool.connect(admin).addUnderlying(new_underlying.address, new_palToken.address)
            ).to.be.reverted
            
        });


        it(' should set the PoolState correctly', async () => {

            await pool.connect(admin).addUnderlying(new_underlying.address, new_palToken.address)
            
            const new_poolState = await pool.poolStates(new_underlying.address)

            expect(new_poolState.totalReserve).to.be.eq(0)
            expect(new_poolState.totalBorrowed).to.be.eq(0)
            expect(new_poolState.accruedFees).to.be.eq(0)
            expect(new_poolState.numberActiveLoans).to.be.eq(0)

        });


        it(' should fail if incorrect parameters given', async () => {

            await expect(
                pool.connect(admin).addUnderlying(ethers.constants.AddressZero, new_palToken.address)
            ).to.be.reverted

            await expect(
                pool.connect(admin).addUnderlying(new_underlying.address, ethers.constants.AddressZero)
            ).to.be.reverted
            
        });


        it(' should only be callable by admin', async () => {

            await expect(
                pool.connect(user1).addUnderlying(new_underlying.address, new_palToken.address)
            ).to.be.revertedWith('1')
            
        });

    });



    describe('setNewController', async () => {

        let new_controller: MultiPoolController


        beforeEach( async () => {
            new_controller = (await controllerFactory.connect(admin).deploy()) as MultiPoolController;
            await new_controller.deployed();
        });


        it(' should update the Controller', async () => {

            await pool.connect(admin).setNewController(new_controller.address)

            const pool_controller: string = await pool.controller()
            expect(pool_controller).to.be.eq(new_controller.address)
            
        });


        it(' should not be callable by non-admin', async () => {

            await expect(
                pool.connect(user1).setNewController(new_controller.address)
            ).to.be.revertedWith('29')

        });

    });


    describe('setNewInterestModule', async () => {

        let new_interest: InterestCalculator


        beforeEach( async () => {
            new_interest = (await interestFactory.connect(admin).deploy()) as InterestCalculator;
            await new_interest.deployed();
        });


        it(' should update the interest module', async () => {

            await pool.connect(admin).setNewInterestModule(new_interest.address)
            
        });


        it(' should not be callable by non-admin', async () => {

            await expect(
                pool.connect(user1).setNewInterestModule(new_interest.address)
            ).to.be.revertedWith('1')
            
        });

    });


    describe('setNewDelegator', async () => {

        let new_delegator: SnapshotDelegator


        beforeEach( async () => {
            new_delegator = (await delegatorFactory.connect(admin).deploy()) as SnapshotDelegator;
            await new_delegator.deployed();
        });


        it(' should update the delegator', async () => {

            await pool.connect(admin).setNewDelegator(new_delegator.address)

        });


        it(' should not be callable by non-admin', async () => {

            await expect(
                pool.connect(user1).setNewDelegator(new_delegator.address)
            ).to.be.revertedWith('1')
            
        });

    });


    describe('updateMinBorrowLength', async () => {

        const newMinValue = 500


        it(' should update the value correctly', async () => {

            await pool.connect(admin).updateMinBorrowLength(newMinValue)

            const pool_minBorrowLength: BigNumber = await pool.minBorrowLength()

            expect(pool_minBorrowLength).to.be.eq(newMinValue)
            
        });


        it(' should not be callable by non-admin', async () => {

            await expect(
                pool.connect(user1).updateMinBorrowLength(newMinValue)
            ).to.be.revertedWith('1')
            
        });

    });

    describe('updatePoolFactors', async () => {

        const newReserveFactor = ethers.utils.parseEther('0.1');
        const newKillerRatio = ethers.utils.parseEther('0.05');
        const wrongKillerRatio = ethers.utils.parseEther('0.2');


        it(' should update the  correctly', async () => {

            await pool.connect(admin).updatePoolFactors(newReserveFactor, newKillerRatio)

            const pool_reserveFactor: BigNumber = await pool.reserveFactor()
            const pool_killerRatio: BigNumber = await pool.killerRatio()

            expect(pool_reserveFactor).to.be.eq(newReserveFactor)
            expect(pool_killerRatio).to.be.eq(newKillerRatio)
            
        });

        it(' should fail with invalid parameters', async () => {

            await expect(
                pool.connect(admin).updatePoolFactors(0, 0)
            ).to.be.revertedWith('28')

            await expect(
                pool.connect(admin).updatePoolFactors(newReserveFactor, wrongKillerRatio)
            ).to.be.revertedWith('28')
            
        });


        it(' should not be callable by non-admin', async () => {

            await expect(
                pool.connect(user1).updatePoolFactors(newReserveFactor, newKillerRatio)
            ).to.be.revertedWith('1')
            
        });

    });


    describe('addReserve', async () => {

        const amount = ethers.utils.parseEther('100')

        beforeEach( async () => {

            await psp_token.connect(admin).approve(spsp_token1.address, ethers.utils.parseEther('1500'))

            await spsp_token1.connect(admin).enter(ethers.utils.parseEther('1500'))

        });


        it(' should add the given amount to the Pool reserve', async () => {

            await spsp_token1.connect(admin).approve(pool.address, amount)

            const oldReserves = await (await pool.poolStates(spsp_token1.address)).totalReserve
            const oldCash = await pool['underlyingBalance(address)'](spsp_token1.address)

            await pool.connect(admin).addReserve(spsp_token1.address, amount)

            const newReserves = await (await pool.poolStates(spsp_token1.address)).totalReserve
            const newCash = await pool['underlyingBalance(address)'](spsp_token1.address)

            expect(newReserves.sub(oldReserves)).to.be.eq(amount)
            expect(newCash.sub(oldCash)).to.be.eq(amount)
            
        });


        it(' should not change other assets reserves', async () => {

            await spsp_token1.connect(admin).approve(pool.address, amount)

            const oldReserves_2 = await (await pool.poolStates(spsp_token2.address)).totalReserve
            const oldCash_2 = await pool['underlyingBalance(address)'](spsp_token2.address)
            const oldReserves_3 = await (await pool.poolStates(spsp_token3.address)).totalReserve
            const oldCash_3 = await pool['underlyingBalance(address)'](spsp_token3.address)

            await pool.connect(admin).addReserve(spsp_token1.address, amount)

            const newReserves_2 = await (await pool.poolStates(spsp_token2.address)).totalReserve
            const newCash_2 = await pool['underlyingBalance(address)'](spsp_token2.address)
            const newReserves_3 = await (await pool.poolStates(spsp_token3.address)).totalReserve
            const newCash_3 = await pool['underlyingBalance(address)'](spsp_token3.address)

            expect(newReserves_2).to.be.eq(oldReserves_2)
            expect(newCash_2).to.be.eq(oldCash_2)

            expect(newReserves_3).to.be.eq(oldReserves_3)
            expect(newCash_3).to.be.eq(oldCash_3)
            
        });


        it(' should not be callable by non-admin', async () => {

            await expect(
                pool.connect(user1).addReserve(spsp_token1.address, amount)
            ).to.be.revertedWith('1')
            
        });


        it(' should not be callable by non-admin', async () => {

            await expect(
                pool.connect(user1).addReserve(spsp_token1.address, amount)
            ).to.be.revertedWith('1')
            
        });

    });


    describe('removeReserve', async () => {

        const deposit = ethers.utils.parseEther('1000')
        const amount = ethers.utils.parseEther('100')

        beforeEach( async () => {

            await psp_token.connect(admin).approve(spsp_token1.address, ethers.utils.parseEther('1500'))

            await spsp_token1.connect(admin).enter(ethers.utils.parseEther('1500'))

        });


        it(' should withdraw the given amount from the Pool reserve', async () => {

            await spsp_token1.connect(admin).approve(pool.address, deposit)

            await pool.connect(admin).addReserve(spsp_token1.address, deposit)

            const oldReserves = await (await pool.poolStates(spsp_token1.address)).totalReserve
            const oldCash = await pool['underlyingBalance(address)'](spsp_token1.address)

            await pool.connect(admin).removeReserve(spsp_token1.address, amount)

            const newReserves = await (await pool.poolStates(spsp_token1.address)).totalReserve
            const newCash = await pool['underlyingBalance(address)'](spsp_token1.address)

            expect(oldReserves.sub(newReserves)).to.be.eq(amount)
            expect(oldCash.sub(newCash)).to.be.eq(amount)
            
        });


        it(' should fail if not enough cash in the Pool', async () => {

            await expect(
                pool.connect(admin).removeReserve(spsp_token1.address, amount)
            ).to.be.revertedWith('19')
        });


        it(' should fail if not enough cash in the reserve', async () => {

            await spsp_token1.connect(admin).transfer(pool.address, deposit)

            await expect(
                pool.connect(admin).removeReserve(spsp_token1.address, amount)
            ).to.be.revertedWith('19')
        });


        it(' should not be callable by non-admin', async () => {

            await expect(
                pool.connect(user1).removeReserve(spsp_token1.address, amount)
            ).to.be.revertedWith('1')
            
        });

    });


    describe('withdrawFees', async () => {

        const deposit = ethers.utils.parseEther('1000')
        const borrowAmount = ethers.utils.parseEther('100')
        const feesAmount = ethers.utils.parseEther('10')

        beforeEach( async () => {
            await psp_token.connect(admin).approve(spsp_token1.address, ethers.utils.parseEther('1500'))

            await spsp_token1.connect(admin).enter(ethers.utils.parseEther('1500'))

            await spsp_token1.connect(admin).transfer(user1.address, deposit.add(feesAmount))

            await spsp_token1.connect(user1).approve(pool.address, deposit.add(feesAmount))

            await pool.connect(user1).deposit(spsp_token1.address, deposit)

            await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrowAmount, feesAmount)

            const loan_pools = await pool.getLoansPools()
            const loan_address = loan_pools[loan_pools.length - 1]

            await pool.connect(user1).closeBorrow(loan_address)

        })


        it(' should withdraw the given amount of fees from the Pool', async () => {

            const oldReserves = await (await pool.poolStates(spsp_token1.address)).totalReserve
            const oldCash = await pool['underlyingBalance(address)'](spsp_token1.address)

            const accruedFeesAmount = await (await pool.poolStates(spsp_token1.address)).accruedFees

            await pool.connect(admin).withdrawFees(spsp_token1.address, accruedFeesAmount, admin.address)

            const newReserves = await (await pool.poolStates(spsp_token1.address)).totalReserve
            const newCash = await pool['underlyingBalance(address)'](spsp_token1.address)

            expect(await pool.accruedFees()).to.be.eq(0)
            expect(oldReserves.sub(newReserves)).to.be.eq(accruedFeesAmount)
            expect(oldCash.sub(newCash)).to.be.eq(accruedFeesAmount)
            
        });


        it(' should fail if not enough fees to withdraw', async () => {

            await expect(
                pool.connect(admin).withdrawFees(spsp_token1.address, ethers.utils.parseEther('50'), admin.address)
            ).to.be.revertedWith('34')

        });


        it(' should only be callable by admin & controller', async () => {

            await expect(
                pool.connect(user1).withdrawFees(spsp_token1.address, ethers.utils.parseEther('2'), admin.address)
            ).to.be.revertedWith('29')
            
        });

    });


});