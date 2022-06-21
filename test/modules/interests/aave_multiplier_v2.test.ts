import { ethers, waffle } from "hardhat";
import chai, { use } from "chai";
import { solidity } from "ethereum-waffle";
import { AaveMultiplierV2 } from "../../../typechain/interests/multipliers/AaveMultiplierV2";
import { MockPoolBorrowsOnly } from "../../../typechain/tests/MockPoolBorrowsOnly";
import { IProposalValidator } from "../../../typechain/interests/multipliers/utils/AAVE/IProposalValidator";
import { IAaveGovernanceV2 } from "../../../typechain/interests/multipliers/utils/AAVE/IAaveGovernanceV2";
import { IGovernanceStrategy } from "../../../typechain/interests/multipliers/utils/AAVE/IGovernanceStrategy";
import { IProposalValidator__factory } from "../../../typechain/factories/interests/multipliers/utils/AAVE/IProposalValidator__factory";
import { IAaveGovernanceV2__factory } from "../../../typechain/factories/interests/multipliers/utils/AAVE/IAaveGovernanceV2__factory";
import { IGovernanceStrategy__factory } from "../../../typechain/factories/interests/multipliers/utils/AAVE/IGovernanceStrategy__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";


chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;


const short_Executor_address = "0xEE56e2B3D491590B5b31738cC34d5232F378a8D5"
const AAVE_Governance_address = "0xEC568fffba86c094cf06b22134B23074DFE2252c"

let multiplierFactory: ContractFactory
let mockPoolFactory: ContractFactory

describe('AaveMultiplierV2 contract tests', () => {
    let admin: SignerWithAddress
    let nonAdmin: SignerWithAddress

    let multiplier: AaveMultiplierV2
    let governance: IAaveGovernanceV2
    let executor: IProposalValidator
    let strategy: IGovernanceStrategy
    let pool1: MockPoolBorrowsOnly
    let pool2: MockPoolBorrowsOnly
    
    before( async () => {
        multiplierFactory = await ethers.getContractFactory("AaveMultiplierV2");
        mockPoolFactory = await ethers.getContractFactory("MockPoolBorrowsOnly");

        governance = IAaveGovernanceV2__factory.connect(AAVE_Governance_address, provider);
        executor = IProposalValidator__factory.connect(short_Executor_address, provider);

        strategy = IGovernanceStrategy__factory.connect(await governance.getGovernanceStrategy(), provider);
    })


    beforeEach( async () => {
        [admin, nonAdmin] = await ethers.getSigners();

        pool1 = (await mockPoolFactory.connect(admin).deploy()) as MockPoolBorrowsOnly;
        await pool1.deployed();

        pool2 = (await mockPoolFactory.connect(admin).deploy()) as MockPoolBorrowsOnly;
        await pool2.deployed();

        multiplier = (await multiplierFactory.connect(admin).deploy(
            governance.address,
            executor.address,
            [pool1.address]
        )) as AaveMultiplierV2;
        await multiplier.deployed();
    });


    it(' should be deployed & have correct parameters', async () => {
        expect(multiplier.address).to.properAddress;

        expect(await multiplier.activationFactor()).to.be.eq(1000);
        expect(await multiplier.baseMultiplier()).to.be.eq(ethers.utils.parseEther('10'));

        expect((await multiplier.pools(0))).to.be.eq(pool1.address);

        const multGovernor = await multiplier.governance();
        const multExecutor = await multiplier.executor();
        const multStrategy = await multiplier.strategy();

        expect(multGovernor).to.be.eq(governance.address);
        expect(multExecutor).to.be.eq(executor.address);
        expect(multStrategy).to.be.eq(await governance.getGovernanceStrategy());

    });

    describe('getCurrentMultiplier', async () => {

        it(' should return the correct Quorum', async () => {

            const quorumAmount = await multiplier.getCurrentQuorum();

            const expectedQuorum = await executor.getMinimumVotingPowerNeeded(
                await strategy.getTotalVotingSupplyAt(provider.blockNumber)
            )

            expect(quorumAmount).to.be.eq(expectedQuorum);

        });

    });

    describe('getCurrentMultiplier', async () => {

        const ten_wei = BigNumber.from(10)

        const expectedMultiplier = async (totalBorrowed: BigNumber) => {
            const quorumAmount = await multiplier.getCurrentQuorum();

            const activationFactor = await multiplier.activationFactor()

            const activationThreshold = quorumAmount.mul(activationFactor).div(10000)

            if(totalBorrowed.lte(activationThreshold)) return ethers.utils.parseEther('1')

            const result = (ethers.utils.parseEther('10')).mul(totalBorrowed).div(quorumAmount)
            
            return result;
        }

        const getRandomTotalBorrowed = () => {
            return ethers.utils.parseEther(
                (Math.floor(Math.random() * 2500) + 10).toString()
            )
        }

        const closeEnough = (valueA: BigNumber, valueB :BigNumber, diff :BigNumber) => {
            return valueA.sub(valueB).abs().lt(diff);
        }

        it(' should return 1 if activationThreshold not reached', async () => {

            const value = await multiplier.getCurrentMultiplier();

            expect(value).to.be.eq(ethers.utils.parseEther('1'));

        });


        it(' should return the expected multiplier', async () => {
            const quorumAmount = await multiplier.getCurrentQuorum();

            // activation threshold
            const activationThreshold = quorumAmount.mul(await multiplier.activationFactor()).div(10000)
            const neededAmount0 = activationThreshold
            await pool1.changeTotalBorrowed(neededAmount0);

            const multiplier0 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier0,ethers.utils.parseEther('1'),ten_wei)).to.be.true

            // to get 1.1
            const neededAmount1 = quorumAmount.mul(1100).div(10000)
            await pool1.changeTotalBorrowed(neededAmount1);

            const multiplier1 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier1,ethers.utils.parseEther('1.1'),ten_wei)).to.be.true


            // to get 2
            const neededAmount2 = quorumAmount.mul(2000).div(10000)
            await pool1.changeTotalBorrowed(neededAmount2);

            const multiplier2 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier2,ethers.utils.parseEther('2'),ten_wei)).to.be.true


            // at quorum
            await pool1.changeTotalBorrowed(quorumAmount);

            const multiplierQuorum = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplierQuorum,ethers.utils.parseEther('10'),ten_wei)).to.be.true
            
        });


        it(' should return the expected multiplier - random values', async () => {

            const totalBorrowedAmount1 = getRandomTotalBorrowed()
            await pool1.changeTotalBorrowed(totalBorrowedAmount1);

            const multiplier1 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier1,(await expectedMultiplier(totalBorrowedAmount1)),ten_wei)).to.be.true

            const totalBorrowedAmount2 = getRandomTotalBorrowed()
            await pool1.changeTotalBorrowed(totalBorrowedAmount2);

            const multiplier2 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier2,(await expectedMultiplier(totalBorrowedAmount2)),ten_wei)).to.be.true

            const totalBorrowedAmount3 = getRandomTotalBorrowed()
            await pool1.changeTotalBorrowed(totalBorrowedAmount3);

            const multiplier3 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier3,(await expectedMultiplier(totalBorrowedAmount3)),ten_wei)).to.be.true

            
        });


        it(' should work with multiple pools', async () => {
            const quorumAmount = await multiplier.getCurrentQuorum();

            await multiplier.connect(admin).addPool(pool2.address);

            const neededAmount1 = await quorumAmount.mul(1100).div(10000)

            const pool1Amount = neededAmount1.div(2);
            const pool2Amount = neededAmount1.div(2);
            await pool1.changeTotalBorrowed(pool1Amount);
            await pool2.changeTotalBorrowed(pool2Amount);

            const multiplier1 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier1,ethers.utils.parseEther('1.1'),ten_wei)).to.be.true


            const neededAmount2 = await quorumAmount.mul(2000).div(10000)
            const diffAmount = neededAmount2.sub(neededAmount1);
            await pool2.changeTotalBorrowed(pool2Amount.add(diffAmount));

            const multiplier2 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier2,ethers.utils.parseEther('2'),ten_wei)).to.be.true
            
        });


        it(' should work with updated parameters', async () => {

            const AAVE_Long_Executor_address = "0x61910EcD7e8e942136CE7Fe7943f956cea1CC2f7"

            await multiplier.connect(admin).updateExecutor(AAVE_Long_Executor_address)
            
            await pool1.changeTotalBorrowed(ethers.utils.parseEther('50'))

            const value = await multiplier.getCurrentMultiplier();
            expect(value).to.be.eq(ethers.utils.parseEther('1'));

            const new_quorum = await multiplier.getCurrentQuorum()
            const neededAmount1 = await new_quorum.mul(1100).div(10000)
            await pool1.changeTotalBorrowed(neededAmount1);

            const multiplier1 = await multiplier.getCurrentMultiplier();

            expect(closeEnough(multiplier1,ethers.utils.parseEther('1.1'),ten_wei)).to.be.true
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


        it(' can update Executor', async () => {

            const AAVE_Long_Executor_address = "0x61910EcD7e8e942136CE7Fe7943f956cea1CC2f7"

            await multiplier.connect(admin).updateExecutor(AAVE_Long_Executor_address)

            expect(await multiplier.executor()).to.be.eq(AAVE_Long_Executor_address);
            

            await expect(
                multiplier.connect(admin).updateBaseMultiplier(ethers.constants.AddressZero)
            ).to.be.reverted

        });


        it(' block any call from non-admin', async () => {

            await expect(
                multiplier.connect(nonAdmin).addPool(pool2.address)
            ).to.be.revertedWith('CallerNotAdmin()')

            await expect(
                multiplier.connect(nonAdmin).removePool(pool1.address)
            ).to.be.revertedWith('CallerNotAdmin()')

            await expect(
                multiplier.connect(nonAdmin).updateBaseMultiplier(ethers.utils.parseEther('15'))
            ).to.be.revertedWith('CallerNotAdmin()')

            await expect(
                multiplier.connect(nonAdmin).updateActivationFactor(2500)
            ).to.be.revertedWith('CallerNotAdmin()')
            
        });

    });

});