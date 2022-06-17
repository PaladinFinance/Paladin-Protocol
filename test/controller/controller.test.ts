import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PaladinController } from "../../typechain/PaladinController";
import { ControllerProxy } from "../../typechain/ControllerProxy";
import { Comp } from "../../typechain/tests/Comp";
import { MockPalPool } from "../../typechain/tests/MockPalPool";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

chai.use(solidity);
const { expect } = chai;

let controllerFactory: ContractFactory
let controllerProxyFactory: ContractFactory
let mockPoolFactory: ContractFactory
let erc20Factory: ContractFactory


describe('Paladin Controller contract tests', () => {
    let admin: SignerWithAddress
    let user1: SignerWithAddress

    let controller: PaladinController
    let proxy: ControllerProxy

    let mockPool: MockPalPool
    let underlying: Comp

    let fakePool: SignerWithAddress
    let fakePool2: SignerWithAddress
    let fakePool3: SignerWithAddress
    let fakeToken: SignerWithAddress
    let fakeToken2: SignerWithAddress
    let fakeToken3: SignerWithAddress
    let fakeLoan: SignerWithAddress

    before( async () => {
        controllerFactory = await ethers.getContractFactory("PaladinController");
        controllerProxyFactory = await ethers.getContractFactory("ControllerProxy");
        mockPoolFactory = await ethers.getContractFactory("MockPalPool");
        erc20Factory = await ethers.getContractFactory("Comp");
    })

    beforeEach( async () => {
        [
            admin,
            user1,
            fakePool,
            fakePool2,
            fakePool3,
            fakeToken,
            fakeToken2,
            fakeToken3,
            fakeLoan
        ] = await ethers.getSigners();

        controller = (await controllerFactory.deploy()) as PaladinController;
        await controller.deployed();

        proxy = (await controllerProxyFactory.deploy()) as ControllerProxy;
        await proxy.deployed();

        await proxy.proposeImplementation(controller.address);
        await controller.becomeImplementation(proxy.address);

        underlying = (await erc20Factory.connect(admin).deploy(admin.address)) as Comp;
        await underlying.deployed();

    });


    it(' should be deployed', async () => {
        expect(controller.address).to.properAddress
    });


    describe('Initialization', async () => {
    
        it(' should add & find correct PalPools & PalTokens', async () => {
            const pools_list = [fakePool.address, fakePool2.address]
            const tokens_list = [fakeToken.address, fakeToken2.address]
            await controller.connect(admin).setInitialPools(tokens_list, pools_list);
    
            const tokens = await controller.getPalTokens();
            const pools = await controller.getPalPools();
    
            expect(pools).to.contain(fakePool.address)
            expect(tokens).to.contain(fakeToken.address)
            expect(pools).to.contain(fakePool2.address)
            expect(tokens).to.contain(fakeToken2.address)

            expect(pools).not.to.contain(fakePool3.address)
            expect(tokens).not.to.contain(fakeToken3.address)

            expect(await controller.palTokenToPalPool(fakeToken.address)).to.be.eq(fakePool.address)
            expect(await controller.palTokenToPalPool(fakeToken2.address)).to.be.eq(fakePool2.address)
            expect(await controller.palTokenToPalPool(fakeToken3.address)).to.be.eq(ethers.constants.AddressZero)

            expect(await controller.isPalPool(fakePool.address)).to.be.true;
            expect(await controller.isPalPool(fakePool2.address)).to.be.true;
            expect(await controller.isPalPool(fakePool3.address)).to.be.false;
        });

        it(' should block non-admin to initialize', async () => {
            await expect(
                controller.connect(user1).setInitialPools([fakeToken.address], [fakePool.address])
            ).to.be.revertedWith('1')
        });
    
        it(' should block 2nd initialize', async () => {
            await controller.connect(admin).setInitialPools([fakeToken.address], [fakePool.address]);
    
            await expect(
                controller.connect(admin).setInitialPools([fakeToken.address], [fakePool.address])
            ).to.be.revertedWith('37')
        });

    });


    describe('Add/Remove Pools', async () => {

        it(' should add a PalPool (& PalToken)', async () => {
            const pools_list = [fakePool.address, fakePool2.address]
            const tokens_list = [fakeToken.address, fakeToken2.address]
            await controller.connect(admin).setInitialPools(tokens_list, pools_list);

            await controller.connect(admin).addNewPool(fakeToken3.address, fakePool3.address)
    
            const tokens = await controller.getPalTokens();
            const pools = await controller.getPalPools();
    
            expect(pools).to.contain(fakePool.address)
            expect(tokens).to.contain(fakeToken.address)
            expect(pools).to.contain(fakePool2.address)
            expect(tokens).to.contain(fakeToken2.address)
            expect(pools).to.contain(fakePool3.address)
            expect(tokens).to.contain(fakeToken3.address)

            expect(await controller.isPalPool(fakePool.address)).to.be.true;
            expect(await controller.isPalPool(fakePool2.address)).to.be.true;
            expect(await controller.isPalPool(fakePool3.address)).to.be.true;

            expect(await controller.palTokenToPalPool(fakeToken.address)).to.be.eq(fakePool.address)
            expect(await controller.palTokenToPalPool(fakeToken2.address)).to.be.eq(fakePool2.address)
            expect(await controller.palTokenToPalPool(fakeToken3.address)).to.be.eq(fakePool3.address)
        });

        it(' should not add same PalPool (& PalToken) twice', async () => {
            await controller.connect(admin).addNewPool(fakeToken.address, fakePool.address)
    
            await expect(
                controller.connect(admin).addNewPool(fakeToken.address, fakePool.address)
            ).to.be.revertedWith('38')
        });
    
        it(' should block non-admin to add PalPool', async () => {
            await expect(
                controller.connect(user1).addNewPool(fakeToken.address, fakePool.address),
                '1'
            ).to.be.revertedWith('1')
        });
    
        it(' should remove PalPool (& PalToken)', async () => {
            const pools_list = [fakePool.address, fakePool2.address, fakePool3.address]
            const tokens_list = [fakeToken.address, fakeToken2.address, fakeToken3.address]
            await controller.connect(admin).setInitialPools(tokens_list, pools_list);
    
            await controller.connect(admin).removePool(fakePool2.address)
    
            const tokens = await controller.getPalTokens();
            const pools = await controller.getPalPools();
    
            expect(pools).to.contain(fakePool.address)
            expect(tokens).to.contain(fakeToken.address)
            expect(pools).to.contain(fakePool3.address)
            expect(tokens).to.contain(fakeToken3.address)
    
            expect(pools).not.to.contain(fakePool2.address)
            expect(tokens).not.to.contain(fakeToken2.address)


            expect(await controller.isPalPool(fakePool.address)).to.be.true;
            expect(await controller.isPalPool(fakePool2.address)).to.be.false;
            expect(await controller.isPalPool(fakePool3.address)).to.be.true;

            expect(await controller.palTokenToPalPool(fakeToken.address)).to.be.eq(fakePool.address)
            expect(await controller.palTokenToPalPool(fakeToken2.address)).to.be.eq(ethers.constants.AddressZero)
            expect(await controller.palTokenToPalPool(fakeToken3.address)).to.be.eq(fakePool3.address)
        });
    
        it(' should not remove not-listed PalPool', async () => {
            const pools_list = [fakePool.address, fakePool2.address]
            const tokens_list = [fakeToken.address, fakeToken2.address]
            await controller.connect(admin).setInitialPools(tokens_list, pools_list);
    
            await expect(
                controller.connect(admin).removePool(fakePool3.address),
                '39'
            ).to.be.revertedWith('39')
        });
    
        it(' should not remove a PalPool twice', async () => {
            const pools_list = [fakePool.address, fakePool2.address, fakePool3.address]
            const tokens_list = [fakeToken.address, fakeToken2.address, fakeToken3.address]
            await controller.connect(admin).setInitialPools(tokens_list, pools_list);
    
            await controller.connect(admin).removePool(fakePool2.address)
            await expect(
                controller.connect(admin).removePool(fakePool2.address),
                '39'
            ).to.be.revertedWith('39')
        });
    
        it(' should block non-admin to remove PalPool', async () => {
            await expect(
                controller.connect(user1).removePool(fakePool.address),
                '1'
            ).to.be.revertedWith('1')
        });

    });


    describe('PalPool functions', async () => {

        let reserveAmount = ethers.utils.parseEther('1');
        let accruedFeesAmount = ethers.utils.parseEther('0.75');
        let invalidAmount = ethers.utils.parseEther('1000');

        beforeEach( async () => {

            mockPool = (await mockPoolFactory.deploy(controller.address, underlying.address, reserveAmount, accruedFeesAmount)) as MockPalPool;
            await mockPool.deployed();

            const pools_list = [fakePool.address, mockPool.address]
            const tokens_list = [fakeToken.address, fakeToken2.address]
            await controller.connect(admin).setInitialPools(tokens_list, pools_list);

        });


        it(' should return the good booleans to the PalPool', async () => {

            await underlying.connect(admin).transfer(mockPool.address, 1000000);

            expect(
                await controller.connect(admin).withdrawPossible(mockPool.address, 10)
            ).to.be.true

            expect(
                await controller.connect(admin).withdrawPossible(mockPool.address, invalidAmount)
            ).to.be.false

            expect(
                await controller.connect(admin).borrowPossible(mockPool.address, 10)
            ).to.be.true

            expect(
                await controller.connect(admin).borrowPossible(mockPool.address, invalidAmount)
            ).to.be.false


            await mockPool.testDepositVerify(fakePool.address, user1.address, 10)
            expect(
                await mockPool.lastControllerCallResult()
            ).to.be.true

            await mockPool.testWithdrawVerify(fakePool.address, user1.address, 10)
            expect(
                await mockPool.lastControllerCallResult()
            ).to.be.true

            await mockPool.testDepositVerify(fakePool.address, user1.address, 0)
            expect(
                await mockPool.lastControllerCallResult()
            ).to.be.false

            await mockPool.testWithdrawVerify(fakePool.address, user1.address, 0)
            expect(
                await mockPool.lastControllerCallResult()
            ).to.be.false

            await mockPool.testBorrowVerify(fakePool.address, user1.address, user1.address, 10, 5, fakeLoan.address)
            expect(
                await mockPool.lastControllerCallResult()
            ).to.be.true

            await mockPool.testExpandBorrowVerify(fakePool.address, fakeLoan.address, 5)
            expect(
                await mockPool.lastControllerCallResult()
            ).to.be.true

            await mockPool.testCloseBorrowVerify(fakePool.address, user1.address, fakeLoan.address)
            expect(
                await mockPool.lastControllerCallResult()
            ).to.be.true

            await mockPool.testKillBorrowVerify(fakePool.address, user1.address, fakeLoan.address)
            expect(
                await mockPool.lastControllerCallResult()
            ).to.be.true

        });


        it(' should block PalPool functions to be called', async () => {
            await expect(
                controller.depositVerify(fakePool.address, user1.address, 10)
            ).to.be.revertedWith('40')
    
            await expect(
                controller.withdrawVerify(fakePool.address, user1.address, 10)
            ).to.be.revertedWith('40')
    
            await expect(
                controller.borrowVerify(fakePool.address, user1.address, user1.address, 10, 5, fakeLoan.address)
            ).to.be.revertedWith('40')

            await expect(
                controller.expandBorrowVerify(fakePool.address, fakeLoan.address, 5)
            ).to.be.revertedWith('40')
    
            await expect(
                controller.closeBorrowVerify(fakePool.address, user1.address, fakeLoan.address)
            ).to.be.revertedWith('40')
    
            await expect(
                controller.killBorrowVerify(fakePool.address, user1.address, fakeLoan.address)
            ).to.be.revertedWith('40')
        });

    });


    describe('Admin functions', async () => {

        let reserveAmount = ethers.utils.parseEther('1');
        let accruedFeesAmount = ethers.utils.parseEther('0.75');
        let removeAmount = ethers.utils.parseEther('0.5');

        beforeEach( async () => {

            mockPool = (await mockPoolFactory.deploy(controller.address, underlying.address, reserveAmount, accruedFeesAmount)) as MockPalPool;
            await mockPool.deployed();

            const pools_list = [mockPool.address]
            const tokens_list = [fakeToken2.address]
            await controller.connect(admin).setInitialPools(tokens_list, pools_list);

        });


        it(' should change the admin', async () => {
            await controller.connect(admin).addNewPool(fakeToken.address, fakePool.address)
            await controller.connect(admin).transferAdmin(user1.address)
            await controller.connect(user1).acceptAdmin()
    
            await expect(
                controller.connect(admin).addNewPool(fakeToken.address, fakePool.address)
            ).to.be.revertedWith('1')
    
            await controller.connect(user1).addNewPool(fakeToken2.address, fakePool2.address);
    
            const tokens = await controller.getPalTokens();
            const pools = await controller.getPalPools();
    
            expect(pools).to.contain(fakePool2.address)
            expect(tokens).to.contain(fakeToken2.address)
        });

        it(' should update the PalPool controller address', async ()=> {
            await controller.connect(admin).setPoolsNewController(admin.address);

            expect(await mockPool.controller()).to.be.eq(admin.address);
        });

        it(' should allow the controller to withdraw the fees', async ()=> {
            await underlying.connect(admin).transfer(mockPool.address, reserveAmount);

            const old_admin_balance = await underlying.balanceOf(admin.address);
            const old_pool_balance = await underlying.balanceOf(mockPool.address);

            await controller.connect(admin).withdrawFromPool(mockPool.address, removeAmount, admin.address)

            const new_admin_balance = await underlying.balanceOf(admin.address);
            const new_pool_balance = await underlying.balanceOf(mockPool.address);

            expect(new_admin_balance.sub(old_admin_balance)).to.be.eq(removeAmount)
            expect(old_pool_balance.sub(new_pool_balance)).to.be.eq(removeAmount)

        });
    
        it(' should block non-admin to change the admin', async ()=> {
            await expect(
                controller.connect(user1).transferAdmin(user1.address)
            ).to.be.revertedWith('1')
        });
    
        it(' should block non-admin to change PalPools controller', async ()=> {
            await expect(
                controller.connect(user1).setPoolsNewController(user1.address)
            ).to.be.revertedWith('1')
        });
    
        it(' should block non-admin to remove from PalPool Reserve', async ()=> {
            await expect(
                controller.connect(user1).withdrawFromPool(fakePool.address, ethers.utils.parseEther('1'), user1.address)
            ).to.be.revertedWith('1')
        });

    });

});