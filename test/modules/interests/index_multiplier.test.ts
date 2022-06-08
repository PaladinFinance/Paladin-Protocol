import { ethers, waffle } from "hardhat";
import chai, { use } from "chai";
import { solidity } from "ethereum-waffle";
import { IndexMultiplier } from "../../../typechain/IndexMultiplier";
import { MockPoolBorrowsOnly } from "../../../typechain/MockPoolBorrowsOnly";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";


chai.use(solidity);
const { expect } = chai;


let multiplierFactory: ContractFactory
let mockPoolFactory: ContractFactory

const current_quorum = ethers.utils.parseEther('250000')

describe('IndexMultiplier contract tests', () => {
    let admin: SignerWithAddress
    let nonAdmin: SignerWithAddress

    let multiplier: IndexMultiplier
    let pool1: MockPoolBorrowsOnly
    let pool2: MockPoolBorrowsOnly

    
    before( async () => {
        multiplierFactory = await ethers.getContractFactory("IndexMultiplier");
        mockPoolFactory = await ethers.getContractFactory("MockPoolBorrowsOnly");
    })


    beforeEach( async () => {
        [admin, nonAdmin] = await ethers.getSigners();

        pool1 = (await mockPoolFactory.connect(admin).deploy()) as MockPoolBorrowsOnly;
        await pool1.deployed();

        pool2 = (await mockPoolFactory.connect(admin).deploy()) as MockPoolBorrowsOnly;
        await pool2.deployed();

        multiplier = (await multiplierFactory.connect(admin).deploy(
            current_quorum,
            [pool1.address]
        )) as IndexMultiplier;
        await multiplier.deployed();
    });


    it(' should be deployed & have correct parameters', async () => {
        expect(multiplier.address).to.properAddress;

        expect(await multiplier.activationFactor()).to.be.eq(1000);
        expect(await multiplier.currentQuorum()).to.be.eq(current_quorum);
        expect(await multiplier.baseMultiplier()).to.be.eq(ethers.utils.parseEther('10'));

        expect(await multiplier.activationThreshold()).to.be.eq(current_quorum.mul(1000).div(10000));

        expect((await multiplier.pools(0))).to.be.eq(pool1.address);

    });

    describe('getCurrentMultiplier', async () => {

        const expectedMultiplier = async (totalBorrowed: BigNumber) => {
            const activationThreshold = await multiplier.activationThreshold();
            const quorumAmount = await multiplier.currentQuorum();

            if(totalBorrowed.lte(activationThreshold)) return ethers.utils.parseEther('1')

            const result = (ethers.utils.parseEther('10')).mul(totalBorrowed).div(quorumAmount)
            
            return result;
        }

        const getRandomTotalBorrowed = () => {
            return ethers.utils.parseEther(
                (Math.floor(Math.random() * 300) + 10).toString()
            )
        }

        it(' should return 1 if activationThreshold not reached', async () => {

            const value = await multiplier.getCurrentMultiplier();

            expect(value).to.be.eq(ethers.utils.parseEther('1'));

        });


        it(' should return the expected multiplier', async () => {
            const quorumAmount = await multiplier.currentQuorum();

            // activation threshold
            const neededAmount0 = await multiplier.activationThreshold();
            await pool1.changeTotalBorrowed(neededAmount0);

            const multiplier0 = await multiplier.getCurrentMultiplier();

            expect(multiplier0).to.be.eq(ethers.utils.parseEther('1'))

            // to get 1.1
            const neededAmount1 = quorumAmount.mul(1100).div(10000)
            await pool1.changeTotalBorrowed(neededAmount1);

            const multiplier1 = await multiplier.getCurrentMultiplier();

            expect(multiplier1).to.be.eq(ethers.utils.parseEther('1.1'))


            // to get 2
            const neededAmount2 = quorumAmount.mul(2000).div(10000)
            await pool1.changeTotalBorrowed(neededAmount2);

            const multiplier2 = await multiplier.getCurrentMultiplier();

            expect(multiplier2).to.be.eq(ethers.utils.parseEther('2'))


            // at quorum
            await pool1.changeTotalBorrowed(quorumAmount);

            const multiplierQuorum = await multiplier.getCurrentMultiplier();

            expect(multiplierQuorum).to.be.eq(ethers.utils.parseEther('10'))
            
        });


        it(' should return the expected multiplier - random values', async () => {

            const totalBorrowedAmount1 = getRandomTotalBorrowed()
            await pool1.changeTotalBorrowed(totalBorrowedAmount1);

            const multiplier1 = await multiplier.getCurrentMultiplier();

            expect(multiplier1).to.be.eq(await expectedMultiplier(totalBorrowedAmount1))

            const totalBorrowedAmount2 = getRandomTotalBorrowed()
            await pool1.changeTotalBorrowed(totalBorrowedAmount2);

            const multiplier2 = await multiplier.getCurrentMultiplier();

            expect(multiplier2).to.be.eq(await expectedMultiplier(totalBorrowedAmount2))

            const totalBorrowedAmount3 = getRandomTotalBorrowed()
            await pool1.changeTotalBorrowed(totalBorrowedAmount3);

            const multiplier3 = await multiplier.getCurrentMultiplier();

            expect(multiplier3).to.be.eq(await expectedMultiplier(totalBorrowedAmount3))

            
        });


        it(' should work with multiple pools', async () => {
            const quorumAmount = await multiplier.currentQuorum();

            await multiplier.connect(admin).addPool(pool2.address);

            const neededAmount1 = await quorumAmount.mul(1100).div(10000)

            const pool1Amount = neededAmount1.div(2);
            const pool2Amount = neededAmount1.div(2);
            await pool1.changeTotalBorrowed(pool1Amount);
            await pool2.changeTotalBorrowed(pool2Amount);

            const multiplier1 = await multiplier.getCurrentMultiplier();

            expect(multiplier1).to.be.eq(ethers.utils.parseEther('1.1'))


            const neededAmount2 = await quorumAmount.mul(2000).div(10000)
            const diffAmount = neededAmount2.sub(neededAmount1);
            await pool2.changeTotalBorrowed(pool2Amount.add(diffAmount));

            const multiplier2 = await multiplier.getCurrentMultiplier();

            expect(multiplier2).to.be.eq(ethers.utils.parseEther('2'))
            
        });


        it(' should work with updated parameters', async () => {

            const new_quorum = ethers.utils.parseEther('350000')

            await multiplier.connect(admin).updateQuorum(new_quorum)
            
            await pool1.changeTotalBorrowed(ethers.utils.parseEther('50'))

            const value = await multiplier.getCurrentMultiplier();
            expect(value).to.be.eq(ethers.utils.parseEther('1'));

            
            const neededAmount1 = await new_quorum.mul(1100).div(10000)
            await pool1.changeTotalBorrowed(neededAmount1);

            const multiplier1 = await multiplier.getCurrentMultiplier();

            expect(multiplier1).to.be.eq(ethers.utils.parseEther('1.1'))
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


        it(' can update updateActivationFactor', async () => {

            await multiplier.connect(admin).updateActivationFactor(2500)

            const multActivationFactor = await multiplier.activationFactor();
            expect(multActivationFactor).to.be.eq(2500);

            const multActivationThreshold = await multiplier.activationThreshold();
            const expected_activationThreshold = current_quorum.mul(multActivationFactor).div(10000)
            expect(expected_activationThreshold).to.be.eq(multActivationThreshold);
            

            await expect(
                multiplier.connect(admin).updateActivationFactor(25000)
            ).to.be.reverted

            await expect(
                multiplier.connect(admin).updateActivationFactor(0)
            ).to.be.reverted
        });


        it(' can update updateBaseMultiplier', async () => {

            const new_baseMultiplier = ethers.utils.parseEther('15')

            await multiplier.connect(admin).updateBaseMultiplier(new_baseMultiplier)

            const multBaseMultiplier = await multiplier.baseMultiplier();
            expect(multBaseMultiplier).to.be.eq(new_baseMultiplier);
            

            await expect(
                multiplier.connect(admin).updateBaseMultiplier(0)
            ).to.be.reverted

        });


        it(' can update updateQuorum', async () => {

            const new_quorum = ethers.utils.parseEther('350000')

            await multiplier.connect(admin).updateQuorum(new_quorum)

            const multQuorum = await multiplier.currentQuorum();
            expect(multQuorum).to.be.eq(new_quorum);

            const multActivationFactor = await multiplier.activationFactor();
            const multActivationThreshold = await multiplier.activationThreshold();
            const expectedActivationThreshold = multQuorum.mul(multActivationFactor).div(10000)
            expect(expectedActivationThreshold).to.be.eq(multActivationThreshold);
            

            await expect(
                multiplier.connect(admin).updateQuorum(0)
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
                multiplier.connect(nonAdmin).updateBaseMultiplier(ethers.utils.parseEther('15'))
            ).to.be.revertedWith('1')

            await expect(
                multiplier.connect(nonAdmin).updateQuorum(ethers.utils.parseEther('350000'))
            ).to.be.revertedWith('1')

            await expect(
                multiplier.connect(nonAdmin).updateActivationFactor(2500)
            ).to.be.revertedWith('1')
            
        });

    });

});