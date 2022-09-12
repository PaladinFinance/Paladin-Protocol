import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { IPalLoan } from "../../typechain/IPalLoan";
import { IPalLoan__factory } from "../../typechain/factories/IPalLoan__factory";
import { IERC20 } from "../../typechain/IERC20";
import { IStakedAave } from "../../typechain/IStakedAave";
import { IGovernancePowerDelegationToken } from "../../typechain/IGovernancePowerDelegationToken";
import { IERC20__factory } from "../../typechain/factories/IERC20__factory";
import { IStakedAave__factory } from "../../typechain/factories/IStakedAave__factory";
import { IGovernancePowerDelegationToken__factory } from "../../typechain/factories/IGovernancePowerDelegationToken__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { AaveDelegatorClaimer } from "../../typechain/AaveDelegatorClaimer";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { getAAVE } from "../utils/getERC20";
import { PalLoanFactory } from "../../typechain/PalLoanFactory";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let delegatorFactory: ContractFactory
let palLoanFactory: ContractFactory

const AAVE_address = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" //AAVE contract on mainnet
const stkAAVE_address = "0x4da27a545c0c5B758a6BA100e3a049001de870f5" //AAVE contract on mainnet

describe('PalLoan (Delegator clone) tests (Aave Delegator Claimer version for stkAave)', () => {
    let pool: SignerWithAddress
    let admin: SignerWithAddress
    let borrower: SignerWithAddress
    let delegatee: SignerWithAddress
    let newDelegatee: SignerWithAddress
    let killer: SignerWithAddress

    let loan: IPalLoan
    let delegator: AaveDelegatorClaimer
    let aave: IERC20
    let stkAave: IERC20
    let stkAaveDeposit: IStakedAave
    let stkAavePower: IGovernancePowerDelegationToken
    let factory: PalLoanFactory


    const borrowAmount = ethers.utils.parseEther('100')
    const feesAmount = ethers.utils.parseEther('10')

    
    before( async () => {
        delegatorFactory = await ethers.getContractFactory("AaveDelegatorClaimer");

        palLoanFactory = await ethers.getContractFactory("PalLoanFactory");

        [pool, admin, borrower, delegatee, newDelegatee, killer] = await ethers.getSigners();

        aave = IERC20__factory.connect(AAVE_address, provider);
        stkAave = IERC20__factory.connect(stkAAVE_address, provider);
        stkAavePower = IGovernancePowerDelegationToken__factory.connect(stkAAVE_address, provider);
        stkAaveDeposit = IStakedAave__factory.connect(stkAAVE_address, provider);

        const staking_amount = ethers.utils.parseEther('100000')

        await getAAVE(admin, aave, admin.address, staking_amount);

        await aave.connect(admin).approve(stkAAVE_address, staking_amount)

        await stkAaveDeposit.connect(admin).stake(admin.address, staking_amount)
    })


    beforeEach( async () => {

        delegator = (await delegatorFactory.connect(admin).deploy()) as AaveDelegatorClaimer;
        await delegator.deployed();

        factory = (await palLoanFactory.connect(admin).deploy()) as PalLoanFactory;
        await factory.deployed();

        // use PalLoanFactory to clone Delegator
        await factory.createPalLoan(
            delegator.address,
            pool.address,
            borrower.address,
            stkAave.address,
            delegatee.address,
            borrowAmount,
            feesAmount
        );

        let loan_index = (await factory.deployedCount()).sub(1)
        let loan_address = await factory.deployedLoans(loan_index)

        loan = IPalLoan__factory.connect(loan_address, provider);

    });


    describe('cloning & intitialization', async () => {

        it(' should be deployed & have correct parameters', async () => {
            expect(loan.address).to.properAddress
    
            const loan_pool: string = await loan.motherPool()
            const loan_underlying: string = await loan.underlying()
            const loan_borrower: string = await loan.borrower()
            const loan_borrowAmount: BigNumber = await loan.amount()
            const loan_feesAmount: BigNumber = await loan.feesAmount()
            const loan_delegatee: string = await loan.delegatee()
    
            expect(loan_pool).to.be.eq(pool.address)
            expect(loan_underlying).to.be.eq(stkAave.address)
            expect(loan_borrower).to.be.eq(borrower.address)
            expect(loan_borrowAmount).to.be.eq(borrowAmount)
            expect(loan_feesAmount).to.be.eq(feesAmount)
            expect(loan_delegatee).to.be.eq(delegatee.address)
        });


        it(' should delegate the right amount of voting power', async () => {

            await stkAave.connect(admin).transfer(loan.address, borrowAmount)
            await stkAave.connect(admin).transfer(loan.address, feesAmount)

            const votes: BigNumber = await stkAavePower.getPowerCurrent(delegatee.address, 0)

            expect(votes).to.be.eq(borrowAmount.add(feesAmount))
        });

        after( async () => {
            await loan.connect(pool).closeLoan(ethers.utils.parseEther('5'), borrower.address)
        })

    });


    describe('expand', async () => {

        let feesAmount = ethers.utils.parseEther('5')

        it(' should update the feesAmount parameter', async () => {

            const oldFeesAmount = await loan.feesAmount()

            await loan.connect(pool).expand(feesAmount)

            const newFeesAmount = await loan.feesAmount()

            expect(newFeesAmount.sub(oldFeesAmount)).to.be.eq(feesAmount)
        });
    
    });


    describe('closeLoan', async () => {

        const usedFees = ethers.utils.parseEther('5')

        beforeEach(async () => {
            await stkAave.connect(admin).transfer(loan.address, borrowAmount)
            await stkAave.connect(admin).transfer(loan.address, feesAmount)

        });

        it(' should return the right amount of tokens to the Borrower', async () => {
            const oldBalance = await stkAave.balanceOf(borrower.address)

            await loan.connect(pool).closeLoan(usedFees, borrower.address)

            const newBalance = await stkAave.balanceOf(borrower.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(feesAmount.sub(usedFees))
        });

        it(' should return the right amount of tokens to the Pool', async () => {
            const oldBalance = await stkAave.balanceOf(pool.address)

            await loan.connect(pool).closeLoan(usedFees, borrower.address)

            const newBalance = await stkAave.balanceOf(pool.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(borrowAmount.add(usedFees))
        });

        it(' should remove the voting power given to the delegatee', async () => {
            await loan.connect(pool).closeLoan(usedFees, borrower.address)

            const votes: BigNumber = await stkAavePower.getPowerCurrent(delegatee.address, 0)

            expect(votes).to.be.eq(0)
        });

        it(' should claim stkAave reward before closing', async () => {
            await loan.connect(pool).closeLoan(usedFees, borrower.address)

            const pendingRewards: BigNumber = await stkAaveDeposit.getTotalRewardsBalance(loan.address)

            expect(pendingRewards).to.be.eq(0)
        });
    
    });


    describe('killLoan', async () => {

        const killerRatio = ethers.utils.parseEther('0.15')

        const killerAmount = ethers.utils.parseEther('1.5')

        beforeEach(async () => {
            await stkAave.connect(admin).transfer(loan.address, borrowAmount)
            await stkAave.connect(admin).transfer(loan.address, feesAmount)

        });

        it(' should reward the right amount of tokens to the Killer', async () => {
            const oldBalance = await stkAave.balanceOf(killer.address)

            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const newBalance = await stkAave.balanceOf(killer.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(killerAmount)
        });

        it(' should return the right amount of tokens to the Pool', async () => {
            const oldBalance = await stkAave.balanceOf(pool.address)

            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const newBalance = await stkAave.balanceOf(pool.address)
                    
            expect(newBalance.sub(oldBalance)).to.be.eq(borrowAmount.add(feesAmount).sub(killerAmount))
        });

        it(' should remove the voting power given to the delegatee', async () => {
            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const votes: BigNumber = await stkAavePower.getPowerCurrent(delegatee.address, 0)

            expect(votes).to.be.eq(0)
        });

        it(' should claim stkAave reward before killing', async () => {
            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const pendingRewards: BigNumber = await stkAaveDeposit.getTotalRewardsBalance(loan.address)

            expect(pendingRewards).to.be.eq(0)
        });
    
    });


    describe('changeDelegatee', async () => {

        beforeEach(async () => {
            await stkAave.connect(admin).transfer(loan.address, borrowAmount)
            await stkAave.connect(admin).transfer(loan.address, feesAmount)

        });


        it(' should move the voting power to the new delegatee', async () => {
            await loan.connect(pool).changeDelegatee(newDelegatee.address)

            const votes: BigNumber = await stkAavePower.getPowerCurrent(newDelegatee.address, 0)

            expect(votes).to.be.eq(borrowAmount.add(feesAmount))
        });

        
        it(' should update the delegatee', async () => {
            await loan.connect(pool).changeDelegatee(newDelegatee.address)

            const loan_delegatee: string = await loan.delegatee()

            expect(loan_delegatee).to.be.eq(newDelegatee.address)
        });


        it(' should not change the other values', async () => {

            const old_loan_pool: string = await loan.motherPool()
            const old_loan_underlying: string = await loan.underlying()
            const old_loan_borrower: string = await loan.borrower()
            const old_loan_borrowAmount: BigNumber = await loan.amount()
            const old_loan_feesAmount: BigNumber = await loan.feesAmount()

            await loan.connect(pool).changeDelegatee(newDelegatee.address)

            const loan_pool: string = await loan.motherPool()
            const loan_underlying: string = await loan.underlying()
            const loan_borrower: string = await loan.borrower()
            const loan_borrowAmount: BigNumber = await loan.amount()
            const loan_feesAmount: BigNumber = await loan.feesAmount()

            expect(loan_borrowAmount).to.be.eq(old_loan_borrowAmount)
            expect(loan_feesAmount).to.be.eq(old_loan_feesAmount)
            expect(loan_pool).to.be.eq(old_loan_pool)
            expect(loan_underlying).to.be.eq(old_loan_underlying)
            expect(loan_borrower).to.be.eq(old_loan_borrower)
        });

    });
    

    describe('motherPoolOnly modifier', async () => {

        it(' should block non-pool calls', async () => {
            await expect(
                loan.connect(borrower).expand(0)
            ).to.be.reverted
    
            await expect(
                loan.connect(borrower).closeLoan(0, borrower.address)
            ).to.be.reverted
    
            await expect(
                loan.connect(borrower).killLoan(killer.address, 0)
            ).to.be.reverted
        });

    });

});