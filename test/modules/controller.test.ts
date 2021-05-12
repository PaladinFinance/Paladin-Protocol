import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PaladinController } from "../../typechain/PaladinController";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);
const { expect } = chai;


describe('Paladin Controller contract tests', () => {
    let admin: SignerWithAddress
    let user1: SignerWithAddress

    let controller: PaladinController

    const fakePoolAddress = ethers.utils.getAddress("0xac0afd1b1365cd5796642BaA1741fcfF65A38035");
    const fakePoolAddress2 = ethers.utils.getAddress("0x9d0790355b0d3f4b5f78df3553d88c5a30991261");

    const fakeTokenAddress = ethers.utils.getAddress("0x39294e759f88250456d2Bb53567682951b362Da0");
    const fakeTokenAddress2 = ethers.utils.getAddress("0x3ec20DD2dD5de4e29C1BF83B24F5C2255DA39d27");

    beforeEach( async () => {
        [admin, user1] = await ethers.getSigners();

        const controllerFactory = await ethers.getContractFactory(
            "PaladinController",
            admin
        );
        controller = (await controllerFactory.deploy()) as PaladinController;
        await controller.deployed();

    });


    it(' should be deployed', async () => {
        expect(controller.address).to.properAddress
    });

    it(' should add & find correct Pool & Token', async () => {
        await controller.connect(admin).addNewPalToken(fakeTokenAddress, fakePoolAddress);

        const tokens = await controller.getPalTokens();
        const pools = await controller.getPalPools();

        expect(pools).to.contain(fakePoolAddress)
        expect(tokens).to.contain(fakeTokenAddress)

        expect(pools).not.to.contain(fakePoolAddress2)
        expect(tokens).not.to.contain(fakeTokenAddress2)
    });

    it(' should not add same Pool (& Token) twice', async () => {
        await controller.connect(admin).addNewPalToken(fakeTokenAddress, fakePoolAddress)

        await expect(
            controller.connect(admin).addNewPalToken(fakeTokenAddress, fakePoolAddress)
        ).to.be.revertedWith('Already added')
    });

    it(' should block non-admin to add Pool', async () => {
        await expect(
            controller.connect(user1).addNewPalToken(fakeTokenAddress, fakePoolAddress),
            'Admin function'
        ).to.be.revertedWith('Admin function')
    });

    it(' should block Pool functions to be called', async () => {
        await expect(
            controller.depositVerify(fakePoolAddress, user1.address, 10)
        ).to.be.revertedWith('Call not allowed')

        await expect(
            controller.borrowVerify(fakePoolAddress, user1.address, 10, 5, fakePoolAddress)
        ).to.be.revertedWith('Call not allowed')
    });

    it(' should change the admin', async () => {
        await controller.connect(admin).addNewPalToken(fakeTokenAddress, fakePoolAddress)
        await controller.connect(admin).setNewAdmin(user1.address)

        await expect(
            controller.connect(admin).addNewPalToken(fakeTokenAddress, fakePoolAddress)
        ).to.be.revertedWith('Admin function')

        await controller.connect(user1).addNewPalToken(fakeTokenAddress2, fakePoolAddress2);

        const tokens = await controller.getPalTokens();
        const pools = await controller.getPalPools();

        expect(pools).to.contain(fakePoolAddress2)
        expect(tokens).to.contain(fakeTokenAddress2)
    });

    it(' should block non-admin to change the admin', async ()=> {
        await expect(
            controller.connect(user1).setNewAdmin(user1.address)
        ).to.be.revertedWith('Admin function')
    })
});