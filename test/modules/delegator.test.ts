import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BasicDelegator } from "../../typechain/BasicDelegator";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);
const { expect } = chai;


describe('Delegator implementation contract tests', () => {
    let admin: SignerWithAddress
    let pool: SignerWithAddress
    let borrower: SignerWithAddress
    let delegatee: SignerWithAddress
    let underlying: SignerWithAddress

    let delegator: BasicDelegator

    beforeEach( async () => {
        [admin, pool, borrower, delegatee, underlying] = await ethers.getSigners();

        const delegatorFactory = await ethers.getContractFactory(
            "BasicDelegator",
            admin
        );
        delegator = (await delegatorFactory.deploy()) as BasicDelegator;
        await delegator.deployed();

    });

    it(' should be deployed', async () => {
        expect(delegator.address).to.properAddress
    });

    it(' should not allow initialization on template contracts', async () => {
        await expect(
            delegator.connect(admin).initiate(pool.address, borrower.address, underlying.address, delegatee.address, 0, 0)
        ).to.be.reverted
    });

    it(' should fail all function calls', async () => {
        await expect(
            delegator.connect(admin).expand(0)
        ).to.be.reverted

        await expect(
            delegator.connect(admin).closeLoan(0)
        ).to.be.reverted

        await expect(
            delegator.connect(admin).killLoan(admin.address, 0)
        ).to.be.reverted
    });
});