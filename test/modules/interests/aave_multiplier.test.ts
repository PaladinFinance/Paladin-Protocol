import { ethers, waffle } from "hardhat";
import chai, { use } from "chai";
import { solidity } from "ethereum-waffle";
import { AaveMultiplier } from "../../../typechain/interests/multipliers/AaveMultiplier";
import { IProposalValidator } from "../../../typechain/interests/multipliers/utils/AAVE/IProposalValidator";
import { IAaveGovernanceV2 } from "../../../typechain/interests/multipliers/utils/AAVE/IAaveGovernanceV2";
import { IProposalValidator__factory } from "../../../typechain/factories/interests/multipliers/utils/AAVE/IProposalValidator__factory";
import { IAaveGovernanceV2__factory } from "../../../typechain/factories/interests/multipliers/utils/AAVE/IAaveGovernanceV2__factory";
import { IGovernanceStrategy__factory } from "../../../typechain/factories/interests/multipliers/utils/AAVE/IGovernanceStrategy__factory";
import { MockPoolBorrowsOnly } from "../../../typechain/tests/MockPoolBorrowsOnly";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";


chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;


let multiplierFactory: ContractFactory
let mockGovernorFactory: ContractFactory
let mockPoolFactory: ContractFactory

const short_Executor_address = "0xEE56e2B3D491590B5b31738cC34d5232F378a8D5"
const AAVE_Governance_address = "0xEC568fffba86c094cf06b22134B23074DFE2252c"


const closeEnough = (valueA: BigNumber, valueB :BigNumber, diff :BigNumber) => {
    return valueA.sub(valueB).abs().lt(diff);
}

describe('AaveMultiplier contract tests', () => {
    let admin: SignerWithAddress
    let nonAdmin: SignerWithAddress

    let multiplier: AaveMultiplier
    let governance: IAaveGovernanceV2
    let executor: IProposalValidator
    let pool1: MockPoolBorrowsOnly
    let pool2: MockPoolBorrowsOnly

    
    before( async () => {
        multiplierFactory = await ethers.getContractFactory("AaveMultiplier");
        mockGovernorFactory = await ethers.getContractFactory("MockGovernor");
        mockPoolFactory = await ethers.getContractFactory("MockPoolBorrowsOnly");

        governance = IAaveGovernanceV2__factory.connect(AAVE_Governance_address, provider);
        executor = IProposalValidator__factory.connect(short_Executor_address, provider);
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
        )) as AaveMultiplier;
        await multiplier.deployed();
    });


    it(' should be deployed & have correct parameters', async () => {
        expect(multiplier.address).to.properAddress;

        const multGovernor = await multiplier.governance();
        const multExecutor = await multiplier.executor();
        const multStrategy = await multiplier.strategy();
        const multActivationThreshold = await multiplier.activationThreshold();

        expect(multGovernor).to.be.eq(governance.address);
        expect(multExecutor).to.be.eq(executor.address);
        expect(multStrategy).to.be.eq(await governance.getGovernanceStrategy());
        expect(multActivationThreshold).to.be.eq(ethers.utils.parseEther('0.75'));

        expect((await multiplier.pools(0))).to.be.eq(pool1.address);

    });

    describe('getCurrentMultiplier', async () => {

        const neededTotalBorrow = async (expectedMultiplier: number) => {
            const strategy = IGovernanceStrategy__factory.connect(await governance.getGovernanceStrategy(), provider);

            const activationThreshold = parseFloat(ethers.utils.formatEther(await multiplier.activationThreshold()));
            const proposalThreshold = parseFloat(ethers.utils.formatEther(
                await executor.getMinimumPropositionPowerNeeded(governance.address, provider.blockNumber)
            ));
            const quorumAmount = parseFloat(ethers.utils.formatEther(
                await executor.getMinimumVotingPowerNeeded(
                    await strategy.getTotalVotingSupplyAt(provider.blockNumber)
                )
            ));

            const result = quorumAmount / ( (quorumAmount / (activationThreshold * proposalThreshold)) - expectedMultiplier + 1 )
            
            return ethers.utils.parseEther(result.toString());
        }

        const expectedMultiplier = async (totalBorrowed: number) => {
            const strategy = IGovernanceStrategy__factory.connect(await governance.getGovernanceStrategy(), provider);

            const activationThreshold = parseFloat(ethers.utils.formatEther(await multiplier.activationThreshold()));
            const proposalThreshold = parseFloat(ethers.utils.formatEther(
                await executor.getMinimumPropositionPowerNeeded(governance.address, provider.blockNumber)
            ));
            const quorumAmount = parseFloat(ethers.utils.formatEther(
                await executor.getMinimumVotingPowerNeeded(
                    await strategy.getTotalVotingSupplyAt(provider.blockNumber)
                )
            ));

            const result = 1 + (((totalBorrowed / (proposalThreshold * activationThreshold)) - 1) * (quorumAmount / totalBorrowed))
            
            return ethers.utils.parseEther(result.toString());
        }

        it(' should return 1 if activationThreshold not reached', async () => {

            const value = await multiplier.getCurrentMultiplier();

            expect(value).to.be.eq(ethers.utils.parseEther('1'));

        });


        it(' should return the expected multiplier', async () => {

            const strategy = IGovernanceStrategy__factory.connect(await governance.getGovernanceStrategy(), provider);
            const proposalThreshold = await executor.getMinimumPropositionPowerNeeded(governance.address, provider.blockNumber);
            const quorumAmount = await executor.getMinimumVotingPowerNeeded(
                await strategy.getTotalVotingSupplyAt(provider.blockNumber)
            );
            

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


        it(' can update Governance address', async () => {

            await multiplier.connect(admin).updateGovernance(AAVE_Governance_address);

            const multGovernor = await multiplier.governance();
            const multStrategy = await multiplier.strategy();

            expect(multGovernor).to.be.eq(governance.address);
            expect(multStrategy).to.be.eq(await governance.getGovernanceStrategy());

        });


        it(' can update Governance address', async () => {

            await multiplier.connect(admin).updateGovernanceStrategy();

            const multStrategy = await multiplier.strategy();

            expect(multStrategy).to.be.eq(await governance.getGovernanceStrategy());

        });


        it(' can update Executor address', async () => {

            const long_Executor_address = "0x61910EcD7e8e942136CE7Fe7943f956cea1CC2f7";

            await multiplier.connect(admin).updateExecutor(long_Executor_address);

            const multExecutor = await multiplier.executor();
            
            expect(multExecutor).to.be.eq(long_Executor_address);

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
                multiplier.connect(nonAdmin).updateGovernance(governance.address)
            ).to.be.revertedWith('1')

            await expect(
                multiplier.connect(nonAdmin).updateGovernanceStrategy()
            ).to.be.revertedWith('1')

            await expect(
                multiplier.connect(nonAdmin).updateExecutor(executor.address)
            ).to.be.revertedWith('1')

            await expect(
                multiplier.connect(nonAdmin).updateActivationThreshold(ethers.utils.parseEther('0.65'))
            ).to.be.revertedWith('1')
            
        });

    });

});