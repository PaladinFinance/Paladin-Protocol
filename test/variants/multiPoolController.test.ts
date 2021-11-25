import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { MultiPoolController } from "../../typechain/MultiPoolController";
import { Comp } from "../../typechain/Comp";
import { MockMultiPool } from "../../typechain/MockMultiPool";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

chai.use(solidity);
const { expect } = chai;

let controllerFactory: ContractFactory
let mockPoolFactory: ContractFactory
let erc20Factory: ContractFactory


describe('Paladin MultiPoolController contract tests', () => {
    let admin: SignerWithAddress
    let user1: SignerWithAddress

    let controller: MultiPoolController

    let mockPool: MockMultiPool

    let underlying1: Comp
    let underlying2: Comp

    let fakePool: SignerWithAddress
    let fakePool2: SignerWithAddress
    let fakeToken: SignerWithAddress
    let fakeToken2: SignerWithAddress
    let fakeToken3: SignerWithAddress
    let fakeToken4: SignerWithAddress
    let fakeToken5: SignerWithAddress
    let fakeLoan: SignerWithAddress

    before( async () => {
        controllerFactory = await ethers.getContractFactory("MultiPoolController");
        mockPoolFactory = await ethers.getContractFactory("MockMultiPool");
        erc20Factory = await ethers.getContractFactory("Comp");
    })

    beforeEach( async () => {
        [
            admin,
            user1,
            fakePool,
            fakePool2,
            fakeToken,
            fakeToken2,
            fakeToken3,
            fakeToken4,
            fakeToken5,
            fakeLoan
        ] = await ethers.getSigners();

        controller = (await controllerFactory.deploy()) as MultiPoolController;
        await controller.deployed();

        underlying1 = (await erc20Factory.connect(admin).deploy(admin.address)) as Comp;
        await underlying1.deployed();

        underlying2 = (await erc20Factory.connect(admin).deploy(admin.address)) as Comp;
        await underlying2.deployed();

    });


    it(' should be deployed', async () => {
        expect(controller.address).to.properAddress
    });


    describe('addNewPool / removePool', async () => {

        it(' should add a MultiPool & PalTokens', async () => {

            const tokens_list1 = [fakeToken.address, fakeToken2.address]
            const tokens_list2 = [fakeToken3.address, fakeToken4.address, fakeToken5.address]

            await controller.connect(admin).addNewPool(fakePool.address, tokens_list1)
    
            const tokens = await controller.getPalTokens(fakePool.address);
            const pools = await controller.getPalPools();
    
            expect(pools).to.contain(fakePool.address)
            expect(tokens).to.contain(fakeToken.address)
            expect(tokens).to.contain(fakeToken2.address)

            expect(pools).not.to.contain(fakePool2.address)
            expect(tokens).not.to.contain(fakeToken4.address)

            expect(await controller.isPalPool(fakePool.address)).to.be.true;
            expect(await controller.isPalPool(fakePool2.address)).to.be.false;

            expect(await controller.isPalTokenForPool(fakePool.address, fakeToken.address)).to.be.true;
            expect(await controller.isPalTokenForPool(fakePool.address, fakeToken2.address)).to.be.true;

            expect(await controller.palTokenToPalPool(fakeToken.address)).to.be.eq(fakePool.address);
            expect(await controller.palTokenToPalPool(fakeToken2.address)).to.be.eq(fakePool.address);
            expect(await controller.palTokenToPalPool(fakeToken3.address)).to.be.eq(ethers.constants.AddressZero);
        });

        it(' should not add same MultiPool (& PalTokens) twice', async () => {

            const tokens_list1 = [fakeToken.address, fakeToken2.address]

            await controller.connect(admin).addNewPool(fakePool.address, tokens_list1)
    
            await expect(
                controller.connect(admin).addNewPool(fakePool.address, tokens_list1)
            ).to.be.revertedWith('Already added')
        });
    
        it(' should block non-admin to add MultiPool', async () => {

            const tokens_list1 = [fakeToken.address, fakeToken2.address]

            await expect(
                controller.connect(user1).addNewPool(fakeToken.address, tokens_list1),
                '1'
            ).to.be.revertedWith('1')
        });
    
        it(' should remove MultiPool (& PalTokens)', async () => {

            const tokens_list1 = [fakeToken.address, fakeToken2.address]
            const tokens_list2 = [fakeToken3.address, fakeToken4.address, fakeToken5.address]

            await controller.connect(admin).addNewPool(fakePool.address, tokens_list1)
            await controller.connect(admin).addNewPool(fakePool2.address, tokens_list2)
    
            await controller.connect(admin).removePool(fakePool2.address)
    
            const tokens1 = await controller.getPalTokens(fakePool.address);
            const tokens2 = await controller.getPalTokens(fakePool2.address);
            const pools = await controller.getPalPools();
    
            expect(pools).to.contain(fakePool.address)
            expect(tokens1).to.contain(fakeToken.address)
            expect(tokens1).to.contain(fakeToken2.address)
    
            expect(pools).not.to.contain(fakePool2.address)
            expect(tokens2).not.to.contain(fakeToken3.address)
            expect(tokens2).not.to.contain(fakeToken4.address)

            expect(tokens2).to.be.empty; //since it was deleted

            expect(await controller.isPalTokenForPool(fakePool2.address, fakeToken3.address)).to.be.false;
            expect(await controller.isPalTokenForPool(fakePool2.address, fakeToken4.address)).to.be.false;


            expect(await controller.isPalPool(fakePool.address)).to.be.true;
            expect(await controller.isPalPool(fakePool2.address)).to.be.false;

            expect(await controller.palTokenToPalPool(fakeToken.address)).to.be.eq(fakePool.address);
            expect(await controller.palTokenToPalPool(fakeToken2.address)).to.be.eq(fakePool.address);
            expect(await controller.palTokenToPalPool(fakeToken3.address)).to.be.eq(ethers.constants.AddressZero);
        });
    
        it(' should not remove not-listed MultiPool', async () => {

            const tokens_list1 = [fakeToken.address, fakeToken2.address]
           
            await controller.connect(admin).addNewPool(fakePool.address, tokens_list1)
    
            await expect(
                controller.connect(admin).removePool(fakePool2.address),
                'Not listed'
            ).to.be.revertedWith('Not listed')
        });
    
        it(' should not remove a MultiPool twice', async () => {

            const tokens_list1 = [fakeToken.address, fakeToken2.address]
            const tokens_list2 = [fakeToken3.address, fakeToken4.address, fakeToken5.address]
            
            await controller.connect(admin).addNewPool(fakePool.address, tokens_list1)
            await controller.connect(admin).addNewPool(fakePool2.address, tokens_list2)
    
            await controller.connect(admin).removePool(fakePool.address)
            await expect(
                controller.connect(admin).removePool(fakePool.address),
                'Not listed'
            ).to.be.revertedWith('Not listed')
        });
    
        it(' should block non-admin to remove MultiPool', async () => {
            await expect(
                controller.connect(user1).removePool(fakePool.address),
                '1'
            ).to.be.revertedWith('1')
        });

    });


    describe('addNewPalToken', async () => {

        it(' should add a PalToken to the MultiPool list', async () => {

            const tokens_list1 = [fakeToken.address, fakeToken2.address]

            await controller.connect(admin).addNewPool(fakePool.address, tokens_list1)

            await controller.connect(admin).addNewPalToken(fakePool.address, fakeToken5.address)

            const tokens1 = await controller.getPalTokens(fakePool.address);
            expect(tokens1).to.contain(fakeToken5.address)

            expect(await controller.palTokenToPalPool(fakeToken.address)).to.be.eq(fakePool.address);

            expect(await controller.isPalTokenForPool(fakePool.address, fakeToken5.address)).to.be.true;
            
        });

        it(' should not add same PalToken twice', async () => {

            const tokens_list1 = [fakeToken.address, fakeToken2.address]

            await controller.connect(admin).addNewPool(fakePool.address, tokens_list1)

            await controller.connect(admin).addNewPalToken(fakePool.address, fakeToken5.address)
    
            await expect(
                controller.connect(admin).addNewPalToken(fakePool.address, fakeToken5.address)
            ).to.be.revertedWith('Already added')
        });
    
        it(' should not add if the Pool is not listed', async () => {
            await expect(
                controller.connect(admin).addNewPalToken(fakePool2.address, fakeToken5.address)
            ).to.be.revertedWith('Not listed')
        });
    
        it(' should block non-admin to add PalToken', async () => {
            await expect(
                controller.connect(user1).addNewPalToken(fakePool2.address, fakeToken5.address),
                '1'
            ).to.be.revertedWith('1')
        });

    });


    describe('MultiPool functions', async () => {

        let reserveAmount = ethers.utils.parseEther('1');
        let accruedFeesAmount = ethers.utils.parseEther('0.75');
        let invalidAmount = ethers.utils.parseEther('1000');

        beforeEach( async () => {

            mockPool = (await mockPoolFactory.deploy(
                controller.address,
                [underlying1.address, underlying2.address],
                [reserveAmount, 0],
                [accruedFeesAmount, 0]
            )) as MockMultiPool;
            await mockPool.deployed();

            const tokens_list = [fakeToken.address, fakeToken2.address]
            const tokens_list2 = [fakeToken.address, fakeToken2.address]

            await controller.connect(admin).addNewPool(mockPool.address, tokens_list);
            await controller.connect(admin).addNewPool(fakePool.address, tokens_list2);

        });


        it(' should return the good booleans to the PalPool', async () => {

            await underlying1.connect(admin).transfer(mockPool.address, 1000000);

            expect(
                await controller.connect(admin).withdrawPossible(mockPool.address, underlying1.address, 10)
            ).to.be.true

            expect(
                await controller.connect(admin).withdrawPossible(mockPool.address, underlying1.address, invalidAmount)
            ).to.be.false

            expect(
                await controller.connect(admin).borrowPossible(mockPool.address, underlying1.address, 10)
            ).to.be.true

            expect(
                await controller.connect(admin).borrowPossible(mockPool.address, underlying1.address, invalidAmount)
            ).to.be.false

            expect(
                await controller.connect(fakePool.address).depositVerify(fakePool.address, user1.address, 10)
            ).to.be.true

            expect(
                await controller.connect(fakePool.address).withdrawVerify(fakePool.address, user1.address, 10)
            ).to.be.true

            expect(
                await controller.connect(fakePool.address).depositVerify(fakePool.address, user1.address, 0)
            ).to.be.false

            expect(
                await controller.connect(fakePool.address).withdrawVerify(fakePool.address, user1.address, 0)
            ).to.be.false

            expect(
                await controller.connect(fakePool.address).borrowVerify(fakePool.address, user1.address, user1.address, 10, 5, fakeLoan.address)
            ).to.be.true

            expect(
                await controller.connect(fakePool.address).expandBorrowVerify(fakePool.address, fakeLoan.address, 5)
            ).to.be.true

            expect(
                await controller.connect(fakePool.address).closeBorrowVerify(fakePool.address, user1.address, fakeLoan.address)
            ).to.be.true

            expect(
                await controller.connect(fakePool.address).killBorrowVerify(fakePool.address, user1.address, fakeLoan.address)
            ).to.be.true

        });


        it(' should block PalPool functions to be called', async () => {
            await expect(
                controller.depositVerify(fakePool.address, user1.address, 10)
            ).to.be.revertedWith('Call not allowed')
    
            await expect(
                controller.withdrawVerify(fakePool.address, user1.address, 10)
            ).to.be.revertedWith('Call not allowed')
    
            await expect(
                controller.borrowVerify(fakePool.address, user1.address, user1.address, 10, 5, fakeLoan.address)
            ).to.be.revertedWith('Call not allowed')

            await expect(
                controller.expandBorrowVerify(fakePool.address, fakeLoan.address, 5)
            ).to.be.revertedWith('Call not allowed')
    
            await expect(
                controller.closeBorrowVerify(fakePool.address, user1.address, fakeLoan.address)
            ).to.be.revertedWith('Call not allowed')
    
            await expect(
                controller.killBorrowVerify(fakePool.address, user1.address, fakeLoan.address)
            ).to.be.revertedWith('Call not allowed')
        });

    });


    describe('Admin functions', async () => {

        let reserveAmount = ethers.utils.parseEther('1');
        let accruedFeesAmount = ethers.utils.parseEther('0.75');
        let removeAmount = ethers.utils.parseEther('0.5');

        beforeEach( async () => {

            mockPool = (await mockPoolFactory.deploy(
                controller.address,
                [underlying1.address, underlying2.address],
                [reserveAmount, 0],
                [accruedFeesAmount, 0]
            )) as MockMultiPool;
            await mockPool.deployed();

            const tokens_list = [fakeToken2.address, fakeToken3.address]

            await controller.connect(admin).addNewPool(mockPool.address, tokens_list);

        });


        it(' should change the admin', async () => {
            await controller.connect(admin).addNewPool(fakePool.address, [fakeToken.address])
            await controller.connect(admin).setNewAdmin(user1.address)
    
            await expect(
                controller.connect(admin).addNewPool(fakePool.address, [fakeToken.address])
            ).to.be.revertedWith('1')
    
            await controller.connect(user1).addNewPool(fakePool2.address, [fakeToken4.address, fakeToken5.address]);
    
            const pools = await controller.getPalPools();
            const tokens_of_pool = await controller.getPalTokens(fakePool2.address)
    
            expect(pools).to.contain(fakePool2.address)
            expect(tokens_of_pool).to.contain(fakeToken4.address)
        });

        it(' should update the PalPool controller address', async ()=> {
            await controller.connect(admin).setPoolsNewController(admin.address);

            expect(await mockPool.controller()).to.be.eq(admin.address);
        });

        it(' should allow the controller to withdraw the fees', async ()=> {
            await underlying1.connect(admin).transfer(mockPool.address, reserveAmount);

            const old_admin_balance = await underlying1.balanceOf(admin.address);
            const old_pool_balance = await underlying1.balanceOf(mockPool.address);

            await controller.connect(admin).withdrawFromPool(mockPool.address, underlying1.address, removeAmount, admin.address)

            const new_admin_balance = await underlying1.balanceOf(admin.address);
            const new_pool_balance = await underlying1.balanceOf(mockPool.address);

            expect(new_admin_balance.sub(old_admin_balance)).to.be.eq(removeAmount)
            expect(old_pool_balance.sub(new_pool_balance)).to.be.eq(removeAmount)

        });
    
        it(' should block non-admin to change the admin', async ()=> {
            await expect(
                controller.connect(user1).setNewAdmin(user1.address)
            ).to.be.revertedWith('1')
        });
    
        it(' should block non-admin to change PalPools controller', async ()=> {
            await expect(
                controller.connect(user1).setPoolsNewController(user1.address)
            ).to.be.revertedWith('1')
        });
    
        it(' should block non-admin to remove from PalPool Reserve', async ()=> {
            await expect(
                controller.connect(user1).withdrawFromPool(fakePool.address, underlying1.address, ethers.utils.parseEther('1'), user1.address)
            ).to.be.revertedWith('1')
        });

    });

});