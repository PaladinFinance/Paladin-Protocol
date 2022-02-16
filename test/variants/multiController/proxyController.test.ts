import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { MultiPoolController } from "../../../typechain/MultiPoolController";
import { MultiControllerProxy } from "../../../typechain/MultiControllerProxy";
import { MultiPoolController__factory } from "../../../typechain/factories/MultiPoolController__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;



let controllerFactory: ContractFactory
let controllerProxyFactory: ContractFactory


describe('MultiControllerProxy contract tests', () => {
    let admin: SignerWithAddress
    let user: SignerWithAddress
    let fakeImplementation: SignerWithAddress

    let fakePool: SignerWithAddress
    let fakePool2: SignerWithAddress
    let fakeToken: SignerWithAddress
    let fakeToken2: SignerWithAddress
    let fakeToken3: SignerWithAddress

    let controller: MultiPoolController
    let proxy: MultiControllerProxy
    let proxyWithImpl: MultiPoolController
    let other_controller: MultiPoolController

    before( async () => {
        controllerFactory = await ethers.getContractFactory("MultiPoolController");
        controllerProxyFactory = await ethers.getContractFactory("MultiControllerProxy");
    })

    beforeEach( async () => {
        [
            admin,
            user,
            fakePool,
            fakePool2,
            fakeToken,
            fakeToken2,
            fakeToken3,
            fakeImplementation
        ] = await ethers.getSigners();

        controller = (await controllerFactory.deploy()) as MultiPoolController;
        await controller.deployed();

        proxy = (await controllerProxyFactory.deploy()) as MultiControllerProxy;
        await proxy.deployed();

    });


    it(' should be deployed', async () => {
        expect(controller.address).to.properAddress
        expect(proxy.address).to.properAddress
    });

    
    describe('Propose Implementation', async () => {
    
        it(' should set the correct address as pendingImplementation (& with correct Event)', async () => {

            await expect(proxy.connect(admin).proposeImplementation(controller.address))
                .to.emit(proxy, 'NewPendingImplementation')
                .withArgs(ethers.constants.AddressZero, controller.address);

            expect(await proxy.pendingImplementation()).to.be.eq(controller.address)

        });
    
        it(' should only be callable by admin', async () => {

            await expect(
                proxy.connect(user).proposeImplementation(fakeImplementation.address)
            ).to.be.revertedWith('1')

        });

    });

    
    describe('Accept Implementation', async () => {

        beforeEach( async () => {

            other_controller = (await controllerFactory.deploy()) as MultiPoolController;
            await other_controller.deployed();

        });
    
        it(' should be able to become Implementation (& with correct Events)', async () => {

            await proxy.connect(admin).proposeImplementation(controller.address)

            const become_tx = controller.connect(admin).becomeImplementation(proxy.address)

            await expect(become_tx)
                .to.emit(proxy, 'NewImplementation')
                .withArgs(ethers.constants.AddressZero, controller.address);

            await expect(become_tx)
                .to.emit(proxy, 'NewPendingImplementation')
                .withArgs(controller.address, ethers.constants.AddressZero);

            expect(await proxy.currentImplementation()).to.be.eq(controller.address)
            expect(await proxy.pendingImplementation()).to.be.eq(ethers.constants.AddressZero)

        });
    
        it(' should only accept pending implementations', async () => {

            await proxy.connect(admin).proposeImplementation(controller.address)

            await expect(
                proxy.connect(fakeImplementation).acceptImplementation()
            ).to.be.revertedWith('35')

            await expect(
                other_controller.connect(admin).becomeImplementation(proxy.address)
            ).to.be.revertedWith('35')

        });
    
        it(' should only allow admin to call becomeImplementation', async () => {

            await proxy.connect(admin).proposeImplementation(controller.address)

            await expect(
                controller.connect(user).becomeImplementation(proxy.address)
            ).to.be.revertedWith('1')

        });


        it(' should not be callable by non-implementation', async () => {

            await expect(
                proxy.connect(user).acceptImplementation()
            ).to.be.revertedWith('35')

        })

    });

    
    describe('Act as a Proxy', async () => {

        beforeEach( async () => {

            await proxy.connect(admin).proposeImplementation(controller.address)

            await controller.connect(admin).becomeImplementation(proxy.address)

            proxyWithImpl = MultiPoolController__factory.connect(proxy.address, provider) as MultiPoolController

        });
    
        it(' should be able to initialize using Controller method', async () => {

            const tokens_list = [fakeToken.address, fakeToken2.address]

            await proxyWithImpl.connect(admin).addNewPool(fakePool.address, tokens_list);
    
            const tokens = await proxyWithImpl['getPalTokens()']();
            const pools = await proxyWithImpl.getPools();
    
            expect(pools).to.contain(fakePool.address)
            expect(tokens).to.contain(fakeToken.address)
            expect(tokens).to.contain(fakeToken2.address)

            expect(tokens).not.to.contain(fakeToken3.address)

            expect(await proxyWithImpl.isPalPool(fakePool.address)).to.be.true;
            expect(await proxyWithImpl.isPalPool(fakePool2.address)).to.be.false;

        });
    
        it(' should have correct Storage', async () => {

            const expected_initial_index = ethers.utils.parseUnits("1", 36);

            const initialIndex = await proxyWithImpl.initialRewardsIndex();

            expect(initialIndex).to.be.eq(expected_initial_index)

        });
    
        it(' should delegate function calls through fallback', async () => {

            const tokens_list = [fakeToken.address, fakeToken2.address]

            await proxyWithImpl.connect(admin).addNewPool(fakePool.address, tokens_list);

            await proxyWithImpl.connect(admin).addNewPool(fakePool2.address, [fakeToken3.address]);
    
            let tokens = await proxyWithImpl['getPalTokens()']();
            let pools = await proxyWithImpl.getPools();
    
            expect(pools).to.contain(fakePool.address)
            expect(pools).to.contain(fakePool2.address)
            expect(tokens).to.contain(fakeToken.address)
            expect(tokens).to.contain(fakeToken2.address)
            expect(tokens).to.contain(fakeToken3.address)

            expect(await proxyWithImpl.isPalPool(fakePool.address)).to.be.true;
            expect(await proxyWithImpl.isPalPool(fakePool2.address)).to.be.true;

            expect(await proxyWithImpl.isPalToken(fakeToken.address)).to.be.true;
            expect(await proxyWithImpl.isPalToken(fakeToken2.address)).to.be.true;
            expect(await proxyWithImpl.isPalToken(fakeToken3.address)).to.be.true;

            await proxyWithImpl.connect(admin).removePool(fakePool.address)
    
            tokens = await proxyWithImpl['getPalTokens()']();
            pools = await proxyWithImpl.getPools();
    
            expect(pools).not.to.contain(fakePool.address)
            expect(pools).to.contain(fakePool2.address)
            expect(tokens).not.to.contain(fakeToken.address)
            expect(tokens).not.to.contain(fakeToken2.address)
            expect(tokens).to.contain(fakeToken3.address)
    

            expect(await proxyWithImpl.isPalPool(fakePool.address)).to.be.false;
            expect(await proxyWithImpl.isPalPool(fakePool2.address)).to.be.true;

            expect(await proxyWithImpl.isPalToken(fakeToken.address)).to.be.false;
            expect(await proxyWithImpl.isPalToken(fakeToken2.address)).to.be.false;
            expect(await proxyWithImpl.isPalToken(fakeToken3.address)).to.be.true;

        });

    });

});