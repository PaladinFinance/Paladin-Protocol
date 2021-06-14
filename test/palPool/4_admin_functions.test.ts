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

let poolFactory: ContractFactory
let tokenFactory: ContractFactory
let controllerFactory: ContractFactory
let delegatorFactory: ContractFactory
let interestFactory: ContractFactory
let erc20Factory: ContractFactory

describe('PalPool : 4 - Admin functions tests', () => {
    let admin: SignerWithAddress
    let user1: SignerWithAddress
    let wrong_address: SignerWithAddress

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
        [admin, user1, wrong_address] = await ethers.getSigners();

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


    describe('setNewController', async () => {

        let new_controller: PaladinController


        beforeEach( async () => {
            new_controller = (await controllerFactory.connect(admin).deploy()) as PaladinController;
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
            ).to.be.revertedWith('1')

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

        let new_delegator: BasicDelegator


        beforeEach( async () => {
            new_delegator = (await delegatorFactory.connect(admin).deploy()) as BasicDelegator;
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


        it(' should add the given amount to the Pool reserve', async () => {

            await underlying.connect(admin).approve(pool.address, amount)

            const oldReserves = await pool.totalReserve()
            const oldCash = await pool._underlyingBalance()

            await pool.connect(admin).addReserve(amount)

            const newReserves = await pool.totalReserve()
            const newCash = await pool._underlyingBalance()

            expect(newReserves.sub(oldReserves)).to.be.eq(amount)
            expect(newCash.sub(oldCash)).to.be.eq(amount)
            
        });


        it(' should not be callable by non-admin', async () => {

            await expect(
                pool.connect(user1).addReserve(amount)
            ).to.be.revertedWith('1')
            
        });

    });


    describe('removeReserve', async () => {

        const deposit = ethers.utils.parseEther('1000')
        const amount = ethers.utils.parseEther('100')


        it(' should withdraw the given amount from the Pool reserve', async () => {

            await underlying.connect(admin).approve(pool.address, deposit)

            await pool.connect(admin).addReserve(deposit)

            const oldReserves = await pool.totalReserve()
            const oldCash = await pool._underlyingBalance()

            await pool.connect(admin).removeReserve(amount)

            const newReserves = await pool.totalReserve()
            const newCash = await pool._underlyingBalance()

            expect(oldReserves.sub(newReserves)).to.be.eq(amount)
            expect(oldCash.sub(newCash)).to.be.eq(amount)
            
        });


        it(' should fail if not enough cash in the Pool', async () => {

            await expect(
                pool.connect(admin).removeReserve(amount)
            ).to.be.revertedWith('19')
        });


        it(' should fail if not enough cash in the reserve', async () => {

            await underlying.connect(admin).transfer(pool.address, deposit)

            await expect(
                pool.connect(admin).removeReserve(amount)
            ).to.be.revertedWith('19')
        });


        it(' should not be callable by non-admin', async () => {

            await expect(
                pool.connect(user1).removeReserve(amount)
            ).to.be.revertedWith('1')
            
        });

    });

});