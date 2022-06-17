import { ethers, waffle } from "hardhat";
import chai, { use } from "chai";
import { solidity } from "ethereum-waffle";
import { GovernorMultiplier } from "../../../typechain/interests/multipliers/GovernorMultiplier";
import { MockGovernor } from "../../../typechain/tests/MockGovernor";
import { MockPoolBorrowsOnly } from "../../../typechain/tests/MockPoolBorrowsOnly";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";


chai.use(solidity);
const { expect } = chai;


let multiplierFactory: ContractFactory
let mockGovernorFactory: ContractFactory
let mockPoolFactory: ContractFactory


const closeEnough = (valueA: BigNumber, valueB :BigNumber, diff :BigNumber) => {
    return valueA.sub(valueB).abs().lt(diff);
}

describe('GovernorMultiplier contract tests', () => {
    let admin: SignerWithAddress
    let nonAdmin: SignerWithAddress

    let multiplier: GovernorMultiplier
    let governor: MockGovernor
    let pool1: MockPoolBorrowsOnly
    let pool2: MockPoolBorrowsOnly

    
    before( async () => {
        multiplierFactory = await ethers.getContractFactory("GovernorMultiplier");
        mockGovernorFactory = await ethers.getContractFactory("MockGovernor");
        mockPoolFactory = await ethers.getContractFactory("MockPoolBorrowsOnly");
    })


    beforeEach( async () => {
        [admin, nonAdmin] = await ethers.getSigners();

        governor = (await mockGovernorFactory.connect(admin).deploy()) as MockGovernor;
        await governor.deployed();

        pool1 = (await mockPoolFactory.connect(admin).deploy()) as MockPoolBorrowsOnly;
        await pool1.deployed();

        pool2 = (await mockPoolFactory.connect(admin).deploy()) as MockPoolBorrowsOnly;
        await pool2.deployed();

        multiplier = (await multiplierFactory.connect(admin).deploy(governor.address, [pool1.address])) as GovernorMultiplier;
        await multiplier.deployed();
    });


    it(' should be deployed & have correct parameters', async () => {
        expect(multiplier.address).to.properAddress;

        const multGovernor = await multiplier.governor();
        const multActivationThreshold = await multiplier.activationThreshold();

        expect(multGovernor).to.be.eq(governor.address);
        expect(multActivationThreshold).to.be.eq(ethers.utils.parseEther('0.75'));

        expect((await multiplier.pools(0))).to.be.eq(pool1.address);

    });

    describe('getCurrentMultiplier', async () => {

        const neededTotalBorrow = async (expectedMultiplier: number) => {
            const activationThreshold = parseFloat(ethers.utils.formatEther(await multiplier.activationThreshold()));
            const proposalThreshold = parseFloat(ethers.utils.formatEther(await governor.proposalThreshold()));
            const quorumAmount = parseFloat(ethers.utils.formatEther(await governor.quorumVotes()));

            const result = quorumAmount / ( (quorumAmount / (activationThreshold * proposalThreshold)) - expectedMultiplier + 1 )
            
            return ethers.utils.parseEther(result.toString());
        }

        const expectedMultiplier = async (totalBorrowed: number) => {
            const activationThreshold = parseFloat(ethers.utils.formatEther(await multiplier.activationThreshold()));
            const proposalThreshold = parseFloat(ethers.utils.formatEther(await governor.proposalThreshold()));
            const quorumAmount = parseFloat(ethers.utils.formatEther(await governor.quorumVotes()));

            const result = 1 + (((totalBorrowed / (proposalThreshold * activationThreshold)) - 1) * (quorumAmount / totalBorrowed))
            
            return ethers.utils.parseEther(result.toString());
        }

        it(' should return 1 if activationThreshold not reached', async () => {

            const value = await multiplier.getCurrentMultiplier();

            expect(value).to.be.eq(ethers.utils.parseEther('1'));

        });


        it(' should return the expected multiplier', async () => {

            const proposalThreshold = await governor.proposalThreshold();
            const quorumAmount = await governor.quorumVotes();

            // to get 1.1
            const neededAmount1 = await neededTotalBorrow(1.1);
            await pool1.changeTotalBorrowed(neededAmount1);

            const multiplier1 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier1, ethers.utils.parseEther('1.1'), BigNumber.from('1000000'))).to.be.true;


            // to get 2
            const neededAmount2 = await neededTotalBorrow(2);
            await pool1.changeTotalBorrowed(neededAmount2);

            const multiplier2 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier2, ethers.utils.parseEther('2'), BigNumber.from('1000000'))).to.be.true;


            // at proposal threshold
            await pool1.changeTotalBorrowed(proposalThreshold);

            const expectedMultiplerProposal = await expectedMultiplier(parseFloat(ethers.utils.formatEther(proposalThreshold)))

            const multiplierProposal = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplierProposal, expectedMultiplerProposal, BigNumber.from('1000000'))).to.be.true;


            // at quorum
            await pool1.changeTotalBorrowed(quorumAmount);

            const expectedMultiplerQuorum = await expectedMultiplier(parseFloat(ethers.utils.formatEther(quorumAmount)));

            const multiplierQuorum = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplierQuorum, expectedMultiplerQuorum, BigNumber.from('1000000'))).to.be.true;
            
        });


        it(' should work with multiple pools', async () => {

            await multiplier.connect(admin).addPool(pool2.address);

            const neededAmount1 = await neededTotalBorrow(1.1);

            const pool1Amount = neededAmount1.div(2);
            const pool2Amount = neededAmount1.div(2);
            await pool1.changeTotalBorrowed(pool1Amount);
            await pool2.changeTotalBorrowed(pool2Amount);

            const multiplier1 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier1, ethers.utils.parseEther('1.1'), BigNumber.from('1000000'))).to.be.true;


            const neededAmount2 = await neededTotalBorrow(2);
            const diffAmount = neededAmount2.sub(neededAmount1);
            await pool2.changeTotalBorrowed(pool2Amount.add(diffAmount));

            const multiplier2 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier2, ethers.utils.parseEther('2'), BigNumber.from('1000000'))).to.be.true;
            
        });


        it(' should work with updated parameters', async () => {

            await multiplier.connect(admin).updateActivationThreshold(ethers.utils.parseEther('0.8'))
            
            await pool1.changeTotalBorrowed(ethers.utils.parseEther('50'))

            const value = await multiplier.getCurrentMultiplier();
            expect(value).to.be.eq(ethers.utils.parseEther('1'));

            
            
            const neededAmount1 = await neededTotalBorrow(1.1);
            await pool1.changeTotalBorrowed(neededAmount1);

            const multiplier1 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier1, ethers.utils.parseEther('1.1'), BigNumber.from('1000000'))).to.be.true;
        });

    });


    describe('admin functions', async () => {

        it(' can add a new PalPool', async () => {

            await multiplier.connect(admin).addPool(pool2.address);
            
            expect((await multiplier.pools(0))).to.be.eq(pool1.address);
            expect((await multiplier.pools(1))).to.be.eq(pool2.address);
        });


        it(' can remove a PalPool', async () => {

            await multiplier.connect(admin).addPool(pool2.address);

            await multiplier.connect(admin).removePool(pool1.address)
            
            expect((await multiplier.pools(0))).to.be.eq(pool2.address);

            await expect(
                multiplier.pools(1)
            ).to.be.reverted
            
        });


        it(' can update Governor address', async () => {

            const newGovernor = (await mockGovernorFactory.connect(admin).deploy()) as MockGovernor;
            await newGovernor.deployed();

            await multiplier.connect(admin).updateGovernor(newGovernor.address)

            const multGovernor = await multiplier.governor();
            expect(multGovernor).to.be.eq(newGovernor.address);

        });


        it(' can update activationThreshold', async () => {

            await multiplier.connect(admin).updateActivationThreshold(ethers.utils.parseEther('0.65'))

            const multActivationThreshold = await multiplier.activationThreshold();
            expect(multActivationThreshold).to.be.eq(ethers.utils.parseEther('0.65'));
            

            await expect(
                multiplier.connect(admin).updateActivationThreshold(ethers.utils.parseEther('0.45'))
            ).to.be.reverted

            await expect(
                multiplier.connect(admin).updateActivationThreshold(ethers.utils.parseEther('1'))
            ).to.be.reverted
        });


        it(' block any call from non-admin', async () => {

            await expect(
                multiplier.connect(nonAdmin).addPool(pool2.address)
            ).to.be.revertedWith('1')

            await expect(
                multiplier.connect(nonAdmin).removePool(pool1.address)
            ).to.be.revertedWith('1')

            await expect(
                multiplier.connect(nonAdmin).updateGovernor(governor.address)
            ).to.be.revertedWith('1')

            await expect(
                multiplier.connect(nonAdmin).updateActivationThreshold(ethers.utils.parseEther('0.65'))
            ).to.be.revertedWith('1')
            
        });

    });

});