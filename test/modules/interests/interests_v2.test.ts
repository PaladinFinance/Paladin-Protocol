import { ethers, waffle } from "hardhat";
import chai, { use } from "chai";
import { solidity } from "ethereum-waffle";
import { InterestCalculatorV2 } from "../../../typechain/InterestCalculatorV2";
import { GovernorMultiplier } from "../../../typechain/GovernorMultiplier";
import { MockGovernor } from "../../../typechain/MockGovernor";
import { MockPoolBorrowsOnly } from "../../../typechain/MockPoolBorrowsOnly";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";


chai.use(solidity);
const { expect } = chai;

let interestFactory: ContractFactory
let multiplierFactory: ContractFactory
let mockGovernorFactory: ContractFactory
let mockPoolFactory: ContractFactory

const multiplierPerYear = ethers.utils.parseEther('0.9375');
const baseRatePerYear = ethers.utils.parseEther('0.25');
const jumpMultiplierPerYear = ethers.utils.parseEther('13.25');

const blocksPerYear = BigNumber.from('2336000')

const reserveFactor = ethers.utils.parseEther('0.2');

describe('InterestCalculator V2 contract tests', () => {
    let admin: SignerWithAddress
    let nonAdmin: SignerWithAddress

    let interest: InterestCalculatorV2
    let governorMultiplier: GovernorMultiplier
    let governor: MockGovernor
    let pool: MockPoolBorrowsOnly

    
    before( async () => {
        interestFactory = await ethers.getContractFactory("InterestCalculatorV2");
        multiplierFactory = await ethers.getContractFactory("GovernorMultiplier");
        mockGovernorFactory = await ethers.getContractFactory("MockGovernor");
        mockPoolFactory = await ethers.getContractFactory("MockPoolBorrowsOnly");
    })


    beforeEach( async () => {
        [admin, nonAdmin] = await ethers.getSigners();

        interest = (await interestFactory.connect(admin).deploy()) as InterestCalculatorV2;
        await interest.deployed();

        governor = (await mockGovernorFactory.connect(admin).deploy()) as MockGovernor;
        await governor.deployed();

        pool = (await mockPoolFactory.connect(admin).deploy()) as MockPoolBorrowsOnly;
        await pool.deployed();

        governorMultiplier = (await multiplierFactory.connect(admin).deploy(governor.address, [pool.address])) as GovernorMultiplier;
        await governorMultiplier.deployed();
    });


    describe('initiate', async () => {

        it(' should initiate correctly & set correct values', async () => {

            await interest.connect(admin).initiate(
                multiplierPerYear,
                baseRatePerYear,
                jumpMultiplierPerYear,
                [pool.address],
                [governorMultiplier.address]
            );
            
            const interest_multiplierPerBlock = await interest.multiplierPerBlock();
            const interest_baseRatePerBlock = await interest.baseRatePerBlock();
            const interest_jumpMultiplierPerBlock = await interest.jumpMultiplierPerBlock();

            expect(multiplierPerYear.div(blocksPerYear)).to.be.eq(interest_multiplierPerBlock);
            expect(baseRatePerYear.div(blocksPerYear)).to.be.eq(interest_baseRatePerBlock);
            expect(jumpMultiplierPerYear.div(blocksPerYear)).to.be.eq(interest_jumpMultiplierPerBlock);

            expect(await interest.multiplierForPool(pool.address)).to.be.eq(governorMultiplier.address);
            expect(await interest.useMultiplier(pool.address)).to.be.false;

        });


        it(' should not be initiable twice', async () => {

            await interest.connect(admin).initiate(
                multiplierPerYear,
                baseRatePerYear,
                jumpMultiplierPerYear,
                [pool.address],
                [governorMultiplier.address]
            );

            await expect(
                interest.connect(admin).initiate(
                    multiplierPerYear,
                    baseRatePerYear,
                    jumpMultiplierPerYear,
                    [pool.address],
                    [governorMultiplier.address]
                )
            ).to.be.revertedWith('AlreadyInitialized()')

        });


        it(' should only be initiable by the admin address', async () => {

            await expect(
                interest.connect(nonAdmin).initiate(
                    multiplierPerYear,
                    baseRatePerYear,
                    jumpMultiplierPerYear,
                    [pool.address],
                    [governorMultiplier.address]
                )
            ).to.be.revertedWith('CallerNotAdmin()')

        });


        it(' should fail if PalPools & Multipliers list sizes does not match', async () => {

            await expect(
                interest.connect(admin).initiate(
                    multiplierPerYear,
                    baseRatePerYear,
                    jumpMultiplierPerYear,
                    [pool.address, pool.address],
                    [governorMultiplier.address]
                )
            ).to.be.reverted

        });

    });


    describe('utilizationRate', async () => {

        beforeEach(async () => {
            await interest.connect(admin).initiate(
                multiplierPerYear,
                baseRatePerYear,
                jumpMultiplierPerYear,
                [pool.address],
                [governorMultiplier.address]
            );
        });

        it('0%', async () => {

            const utilRate = await interest.utilizationRate(500,0,0);

            expect(utilRate).to.be.eq(0);

        });

        it('50%', async () => {

            const utilRate = await interest.utilizationRate(500,500,0);

            expect(utilRate).to.be.eq(ethers.utils.parseEther('0.5'));

        });

        it('75%', async () => {

            const utilRate = await interest.utilizationRate(500,750,250);

            expect(utilRate).to.be.eq(ethers.utils.parseEther('0.75'));

        });

        it('100%', async () => {

            const utilRate = await interest.utilizationRate(250,700,250);

            expect(utilRate).to.be.eq(ethers.utils.parseEther('1'));

        });

    });


    describe('getBorrowRate', async () => {

        const one = ethers.utils.parseEther('1')

        const multiplierPerBlock = multiplierPerYear.div(blocksPerYear)
        const baseRatePerBlock = baseRatePerYear.div(blocksPerYear)
        const jumpMultiplierPerBlock = jumpMultiplierPerYear.div(blocksPerYear)

        const expectedBorrowRate = async (
            cash: BigNumber,
            borrowed: BigNumber,
            reserve: BigNumber,
            useGovMultiplier: boolean = false,
            govMultiplier: BigNumber = one
        ) => {
            let utilRate = await interest.utilizationRate(cash, borrowed, reserve);

            if(useGovMultiplier){
                return (utilRate.mul(multiplierPerBlock).div(one).add(baseRatePerBlock)).mul(govMultiplier).div(one)
            }
            else if(utilRate.gt(ethers.utils.parseEther('0.8'))){
                return  utilRate.sub(ethers.utils.parseEther('0.8'))
                    .mul(jumpMultiplierPerBlock).div(one)
                    .add((ethers.utils.parseEther('0.8')).mul(multiplierPerBlock).div(one).add(baseRatePerBlock))
            }
            else{
                return utilRate.mul(multiplierPerBlock).div(one).add(baseRatePerBlock);
            }
        }

        beforeEach(async () => {
            await interest.connect(admin).initiate(
                multiplierPerYear,
                baseRatePerYear,
                jumpMultiplierPerYear,
                [pool.address],
                [governorMultiplier.address]
            );
        });

        it(' JumpRate model', async () => {

            const cash1 = ethers.utils.parseEther('50')
            const borrow1 = ethers.utils.parseEther('25')
            const reserve1 = ethers.utils.parseEther('0')

            const expectedRate1 = await expectedBorrowRate(cash1, borrow1, reserve1)
            
            const borrowRate1 = await interest.getBorrowRate(pool.address, cash1, borrow1, reserve1)

            expect(borrowRate1).to.be.eq(expectedRate1)

            const cash2 = ethers.utils.parseEther('50')
            const borrow2 = ethers.utils.parseEther('75')
            const reserve2 = ethers.utils.parseEther('25')

            const expectedRate2 = await expectedBorrowRate(cash2, borrow2, reserve2)

            const borrowRate2 = await interest.getBorrowRate(pool.address, cash2, borrow2, reserve2)

            expect(borrowRate2).to.be.eq(expectedRate2)
        });


        it(' Governance Multiplier model', async () => {

            await interest.connect(admin).activateMultiplier(pool.address)

            const cash1 = ethers.utils.parseEther('500')
            const borrow1 = ethers.utils.parseEther('250')
            const reserve1 = ethers.utils.parseEther('0')

            await pool.changeTotalBorrowed(borrow1);
            const mult1 = await governorMultiplier.getCurrentMultiplier();

            const expectedRate1 = await expectedBorrowRate(cash1, borrow1, reserve1, true, mult1)
            
            const borrowRate1 = await interest.getBorrowRate(pool.address, cash1, borrow1, reserve1)

            expect(borrowRate1).to.be.eq(expectedRate1)

            const cash2 = ethers.utils.parseEther('50000')
            const borrow2 = ethers.utils.parseEther('75000')
            const reserve2 = ethers.utils.parseEther('25000')

            await pool.changeTotalBorrowed(borrow2);
            const mult2 = await governorMultiplier.getCurrentMultiplier();

            const expectedRate2 = await expectedBorrowRate(cash2, borrow2, reserve2, true, mult2)

            const borrowRate2 = await interest.getBorrowRate(pool.address, cash2, borrow2, reserve2)

            expect(borrowRate2).to.be.eq(expectedRate2)

        });

    });


    describe('getSupplyRate', async () => {

        beforeEach(async () => {
            await interest.connect(admin).initiate(
                multiplierPerYear,
                baseRatePerYear,
                jumpMultiplierPerYear,
                [pool.address],
                [governorMultiplier.address]
            );
        });

        it(' should return the correct Supply Rate', async () => {

            const utilRate = await interest.utilizationRate(50000,60000,25000);
            const borrowRate = await interest.getBorrowRate(pool.address,50000,60000,25000);

            const one = ethers.utils.parseEther('1')
            const expectedSupplyRate = utilRate.mul(borrowRate.mul(one.sub(reserveFactor)).div(one)).div(one);

            const supplyRate = await interest.getSupplyRate(pool.address,50000,60000,25000,reserveFactor)

            expect(expectedSupplyRate).to.be.eq(supplyRate)

        });

    });


    describe('admin functions', async () => {

        beforeEach(async () => {
            await interest.connect(admin).initiate(
                multiplierPerYear,
                baseRatePerYear,
                jumpMultiplierPerYear,
                [pool.address],
                [governorMultiplier.address]
            );
        });

        describe('activate/stop Governance Multipliers', async () => {

            it(' should activate a Multiplier', async () => {
                await interest.connect(admin).activateMultiplier(pool.address)
            
                expect(await interest.useMultiplier(pool.address)).to.be.true;
            });


            it(' should deactivate a Multiplier', async () => {
                await interest.connect(admin).activateMultiplier(pool.address)

                await interest.connect(admin).stopMultiplier(pool.address)
            
                expect(await interest.useMultiplier(pool.address)).to.be.false;
            });

        });

        describe('add/update Governance Multiplier for PalPool', async () => {

            let newPool: MockPoolBorrowsOnly
            let newGovernorMultiplier: GovernorMultiplier

            beforeEach(async () => {
                newPool = (await mockPoolFactory.connect(admin).deploy()) as MockPoolBorrowsOnly;
                await newPool.deployed();

                newGovernorMultiplier = (await multiplierFactory.connect(admin).deploy(governor.address, [newPool.address])) as GovernorMultiplier;
                await newGovernorMultiplier.deployed();
            })

            it(' can update Multiplier for a given pool (not listed : adding)', async () => {
                await interest.connect(admin).updatePoolMultiplierCalculator(newPool.address, newGovernorMultiplier.address)
            
                expect(await interest.multiplierForPool(newPool.address)).to.be.eq(newGovernorMultiplier.address);
                expect(await interest.useMultiplier(newPool.address)).to.be.false;
            });
    
            it(' can update Multiplier for a given pool (listed : update)', async () => {
                await interest.connect(admin).updatePoolMultiplierCalculator(pool.address, newGovernorMultiplier.address)
            
                expect(await interest.multiplierForPool(pool.address)).to.be.eq(newGovernorMultiplier.address);
            });

        });


        it(' can update base values', async () => {
            const new_multiplierPerYear = ethers.utils.parseEther('2');
            const new_baseRatePerYear = ethers.utils.parseEther('0.75');
            const new_jumpMultiplierPerYear = ethers.utils.parseEther('22.75'); 

            await interest.connect(admin).updateBaseValues(
                new_multiplierPerYear,
                new_baseRatePerYear,
                new_jumpMultiplierPerYear
            );

            const interest_multiplierPerBlock = await interest.multiplierPerBlock();
            const interest_baseRatePerBlock = await interest.baseRatePerBlock();
            const interest_jumpMultiplierPerBlock = await interest.jumpMultiplierPerBlock();

            expect(new_multiplierPerYear.div(blocksPerYear)).to.be.eq(interest_multiplierPerBlock);
            expect(new_baseRatePerYear.div(blocksPerYear)).to.be.eq(interest_baseRatePerBlock);
            expect(new_jumpMultiplierPerYear.div(blocksPerYear)).to.be.eq(interest_jumpMultiplierPerBlock);
            
        });

        it(' can update blocksPerYear', async () => {
            const new_blocksPerYear = BigNumber.from('500')

            await interest.connect(admin).updateBlocksPerYear(new_blocksPerYear)
            
            const interest_blocksPerYear = await interest.blocksPerYear();

            expect(interest_blocksPerYear).to.be.eq(new_blocksPerYear);
        });


        it(' block any call from non-admin', async () => {

            await expect(
                interest.connect(nonAdmin).activateMultiplier(pool.address)
            ).to.be.revertedWith('CallerNotAdmin()');

            await expect(
                interest.connect(nonAdmin).stopMultiplier(pool.address)
            ).to.be.revertedWith('CallerNotAdmin()');

            await expect(
                interest.connect(nonAdmin).updateBaseValues(1,1,1)
            ).to.be.revertedWith('CallerNotAdmin()');

            await expect(
                interest.connect(nonAdmin).updateBlocksPerYear(4)
            ).to.be.revertedWith('CallerNotAdmin()');

            await expect(
                interest.connect(nonAdmin).updatePoolMultiplierCalculator(pool.address, governorMultiplier.address)
            ).to.be.revertedWith('CallerNotAdmin()');
            
        });

    });

});