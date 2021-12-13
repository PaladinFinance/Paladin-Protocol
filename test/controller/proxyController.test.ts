import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PaladinController } from "../../typechain/PaladinController";
import { ControllerProxy } from "../../typechain/ControllerProxy";
import { PaladinController__factory } from "../../typechain/factories/PaladinController__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;



let controllerFactory: ContractFactory
let controllerProxyFactory: ContractFactory


describe('Controller Proxy contract tests', () => {
    let admin: SignerWithAddress
    let user: SignerWithAddress
    let fakeImplementation: SignerWithAddress

    let fakePool: SignerWithAddress
    let fakePool2: SignerWithAddress
    let fakePool3: SignerWithAddress
    let fakeToken: SignerWithAddress
    let fakeToken2: SignerWithAddress
    let fakeToken3: SignerWithAddress

    let controller: PaladinController
    let proxy: ControllerProxy
    let proxyWithImpl: PaladinController
    let other_controller: PaladinController

    before( async () => {
        controllerFactory = await ethers.getContractFactory("PaladinController");
        controllerProxyFactory = await ethers.getContractFactory("ControllerProxy");
    })

    beforeEach( async () => {
        [
            admin,
            user,
            fakePool,
            fakePool2,
            fakePool3,
            fakeToken,
            fakeToken2,
            fakeToken3,
            fakeImplementation
        ] = await ethers.getSigners();

        controller = (await controllerFactory.deploy()) as PaladinController;
        await controller.deployed();

        proxy = (await controllerProxyFactory.deploy()) as ControllerProxy;
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

            other_controller = (await controllerFactory.deploy()) as PaladinController;
            await other_controller.deployed();

            await proxy.connect(admin).proposeImplementation(controller.address)

        });
    
        it(' should be able to become Implementation (& with correct Events)', async () => {

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

            await expect(
                proxy.connect(fakeImplementation).acceptImplementation()
            ).to.be.revertedWith('35')

            await expect(
                other_controller.connect(admin).becomeImplementation(proxy.address)
            ).to.be.revertedWith('35')

        });
    
        it(' should only allow admin to call becomeImplementation', async () => {

            await expect(
                controller.connect(user).becomeImplementation(proxy.address)
            ).to.be.revertedWith('1')

        });

    });

    
    describe('Act as a Proxy', async () => {

        beforeEach( async () => {

            await proxy.connect(admin).proposeImplementation(controller.address)

            await controller.connect(admin).becomeImplementation(proxy.address)

            proxyWithImpl = PaladinController__factory.connect(proxy.address, provider) as PaladinController

        });
    
        it(' should be able to initialize using Controller method', async () => {

            const pools_list = [fakePool.address, fakePool2.address]
            const tokens_list = [fakeToken.address, fakeToken2.address]

            await proxyWithImpl.connect(admin).setInitialPools(tokens_list, pools_list);
    
            const tokens = await proxyWithImpl.getPalTokens();
            const pools = await proxyWithImpl.getPalPools();
    
            expect(pools).to.contain(fakePool.address)
            expect(tokens).to.contain(fakeToken.address)
            expect(pools).to.contain(fakePool2.address)
            expect(tokens).to.contain(fakeToken2.address)

            expect(pools).not.to.contain(fakePool3.address)
            expect(tokens).not.to.contain(fakeToken3.address)

            expect(await proxyWithImpl.isPalPool(fakePool.address)).to.be.true;
            expect(await proxyWithImpl.isPalPool(fakePool2.address)).to.be.true;
            expect(await proxyWithImpl.isPalPool(fakePool3.address)).to.be.false;

            await expect(
                proxyWithImpl.connect(admin).setInitialPools([fakeToken.address], [fakePool.address])
            ).to.be.revertedWith('37')

        });
    
        it(' should have correct Storage', async () => {

            const expected_initial_index = ethers.utils.parseUnits("1", 36);

            const initialIndex = await proxyWithImpl.initialRewardsIndex();

            expect(initialIndex).to.be.eq(expected_initial_index)

        });
    
        it(' should delegate function calls through fallback', async () => {

            const pools_list = [fakePool.address, fakePool2.address]
            const tokens_list = [fakeToken.address, fakeToken2.address]

            await proxyWithImpl.connect(admin).setInitialPools(tokens_list, pools_list);

            await proxyWithImpl.connect(admin).addNewPool(fakeToken3.address, fakePool3.address)
    
            let tokens = await proxyWithImpl.getPalTokens();
            let pools = await proxyWithImpl.getPalPools();
    
            expect(pools).to.contain(fakePool.address)
            expect(tokens).to.contain(fakeToken.address)
            expect(pools).to.contain(fakePool2.address)
            expect(tokens).to.contain(fakeToken2.address)
            expect(pools).to.contain(fakePool3.address)
            expect(tokens).to.contain(fakeToken3.address)

            expect(await proxyWithImpl.isPalPool(fakePool.address)).to.be.true;
            expect(await proxyWithImpl.isPalPool(fakePool2.address)).to.be.true;
            expect(await proxyWithImpl.isPalPool(fakePool3.address)).to.be.true;

            await proxyWithImpl.connect(admin).removePool(fakePool2.address)
    
            tokens = await proxyWithImpl.getPalTokens();
            pools = await proxyWithImpl.getPalPools();
    
            expect(pools).to.contain(fakePool.address)
            expect(tokens).to.contain(fakeToken.address)
            expect(pools).to.contain(fakePool3.address)
            expect(tokens).to.contain(fakeToken3.address)
    
            expect(pools).not.to.contain(fakePool2.address)
            expect(tokens).not.to.contain(fakeToken2.address)


            expect(await proxyWithImpl.isPalPool(fakePool.address)).to.be.true;
            expect(await proxyWithImpl.isPalPool(fakePool2.address)).to.be.false;
            expect(await proxyWithImpl.isPalPool(fakePool3.address)).to.be.true;

        });

    });

    
    describe('Drop Implementation', async () => {
    
        it(' should accept address 0x000...000 as pending implementation', async () => {

            await proxy.connect(admin).proposeImplementation(ethers.constants.AddressZero)

            expect(await proxy.pendingImplementation()).to.be.eq(ethers.constants.AddressZero)

        });
    
        it(' should set address 0x000...000 as current implementation', async () => {

            await proxy.connect(admin).acceptImplementation()

            expect(await proxy.currentImplementation()).to.be.eq(ethers.constants.AddressZero)

        });

    });

});