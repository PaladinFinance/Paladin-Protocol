const hre = require("hardhat");
import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { InterestCalculatorV2 } from "../../typechain/interests/InterestCalculatorV2";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";


chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let moduleFactory: ContractFactory

describe('Admin contract tests', () => {
    let admin: SignerWithAddress
    let newAdmin: SignerWithAddress
    let otherAdmin: SignerWithAddress

    let module: InterestCalculatorV2

    before(async () => {
        [admin, newAdmin, otherAdmin] = await ethers.getSigners();

        moduleFactory = await ethers.getContractFactory("InterestCalculatorV2");

    })

    beforeEach(async () => {

        module = (await moduleFactory.connect(admin).deploy()) as InterestCalculatorV2;
        await module.deployed();

    });


    it(' should be deployed & have correct owner', async () => {

        expect(await module.admin()).to.be.eq(admin.address)

    });


    describe('transferOwnership', async () => {

        it(' should set the correct _pendingOwner', async () => {

            const tx = await module.connect(admin).transferAdmin(newAdmin.address)

            await expect(
                tx
            ).to.emit(module, "NewPendingAdmin")
            .withArgs(ethers.constants.AddressZero, newAdmin.address);

            expect(await module.pendingAdmin()).to.be.eq(newAdmin.address)

        });

        it(' should fail if address 0 is given', async () => {

            await expect(
                module.connect(admin).transferAdmin(ethers.constants.AddressZero)
            ).to.be.revertedWith('AdminZeroAddress')

        });

        it(' should fail if not called by owner', async () => {

            await expect(
                module.connect(newAdmin).transferAdmin(newAdmin.address)
            ).to.be.revertedWith('1')

        });

        it(' should fail if giving the current owner as parameter', async () => {

            await expect(
                module.connect(admin).transferAdmin(admin.address)
            ).to.be.revertedWith('CannotBeAdmin')

        });

    });


    describe('acceptOwnership', async () => {

        beforeEach(async () => {

            await module.connect(admin).transferAdmin(newAdmin.address)

        });

        it(' should update the owner correctly', async () => {

            const tx = await module.connect(newAdmin).acceptAdmin()

            await expect(
                tx
            ).to.emit(module, "NewAdmin")
            .withArgs(admin.address, newAdmin.address);

            await expect(
                tx
            ).to.emit(module, "NewPendingAdmin")
            .withArgs(newAdmin.address, ethers.constants.AddressZero);

            expect(await module.admin()).to.be.eq(newAdmin.address)

        });

        it(' should fail if not called by the pending owner', async () => {

            await expect(
                module.connect(admin).acceptAdmin()
            ).to.be.revertedWith('CallerNotpendingAdmin')

            await expect(
                module.connect(otherAdmin).acceptAdmin()
            ).to.be.revertedWith('CallerNotpendingAdmin')

        });

    });

});