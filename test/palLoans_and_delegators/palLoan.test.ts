import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { IPalLoan } from "../../typechain/IPalLoan";
import { IPalLoan__factory } from "../../typechain/factories/IPalLoan__factory";
import { Comp } from "../../typechain/Comp";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BasicDelegator } from "../../typechain/BasicDelegator";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { PalLoanFactory } from "../../typechain/PalLoanFactory";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let delegatorFactory: ContractFactory
let compFactory: ContractFactory
let palLoanFactory: ContractFactory

describe('PalLoan (Delegator clone) tests (Basic Delegator version)', () => {
    let pool: SignerWithAddress
    let admin: SignerWithAddress
    let borrower: SignerWithAddress
    let delegatee: SignerWithAddress
    let newDelegatee: SignerWithAddress
    let killer: SignerWithAddress

    let loan: IPalLoan
    let delegator: BasicDelegator
    let comp: Comp
    let factory: PalLoanFactory


    const borrowAmount = ethers.utils.parseEther('100')
    const feesAmount = ethers.utils.parseEther('10')

    
    before( async () => {
        delegatorFactory = await ethers.getContractFactory("BasicDelegator");

        compFactory = await ethers.getContractFactory("Comp");

        palLoanFactory = await ethers.getContractFactory("PalLoanFactory");
    })


    beforeEach( async () => {
        [pool, admin, borrower, delegatee, newDelegatee, killer] = await ethers.getSigners();

        delegator = (await delegatorFactory.connect(admin).deploy()) as BasicDelegator;
        await delegator.deployed();

        comp = (await compFactory.connect(admin).deploy(admin.address)) as Comp;
        await comp.deployed();

        factory = (await palLoanFactory.connect(admin).deploy()) as PalLoanFactory;
        await factory.deployed();

        // use PalLoanFactory to clone Delegator
        await factory.createPalLoan(
            delegator.address,
            pool.address,
            borrower.address,
            comp.address,
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
            expect(loan_underlying).to.be.eq(comp.address)
            expect(loan_borrower).to.be.eq(borrower.address)
            expect(loan_borrowAmount).to.be.eq(borrowAmount)
            expect(loan_feesAmount).to.be.eq(feesAmount)
            expect(loan_delegatee).to.be.eq(delegatee.address)

        });

        it(' should delegate the right amount of voting power', async () => {

            await comp.connect(admin).transfer(loan.address, borrowAmount)
            await comp.connect(admin).transfer(loan.address, feesAmount)

            const votes: BigNumber = await comp.getCurrentVotes(delegatee.address)

            expect(votes).to.be.eq(borrowAmount.add(feesAmount))
        });

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
            await comp.connect(admin).transfer(loan.address, borrowAmount)
            await comp.connect(admin).transfer(loan.address, feesAmount)

        });

        it(' should return the right amount of tokens to the Borrower', async () => {
            const oldBalance = await comp.balanceOf(borrower.address)

            await loan.connect(pool).closeLoan(usedFees)

            const newBalance = await comp.balanceOf(borrower.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(feesAmount.sub(usedFees))
        });

        it(' should return the right amount of tokens to the Pool', async () => {
            const oldBalance = await comp.balanceOf(pool.address)

            await loan.connect(pool).closeLoan(usedFees)

            const newBalance = await comp.balanceOf(pool.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(borrowAmount.add(usedFees))
        });

        it(' should remove the voting power given to the delegatee', async () => {
            await loan.connect(pool).closeLoan(usedFees)

            const votes: BigNumber = await comp.getCurrentVotes(delegatee.address)

            expect(votes).to.be.eq(0)
        });
    
    });


    describe('killLoan', async () => {

        const killerRatio = ethers.utils.parseEther('0.15')

        const killerAmount = ethers.utils.parseEther('1.5')

        beforeEach(async () => {
            await comp.connect(admin).transfer(loan.address, borrowAmount)
            await comp.connect(admin).transfer(loan.address, feesAmount)

        });

        it(' should reward the right amount of tokens to the Killer', async () => {
            const oldBalance = await comp.balanceOf(killer.address)

            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const newBalance = await comp.balanceOf(killer.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(killerAmount)
        });

        it(' should return the right amount of tokens to the Pool', async () => {
            const oldBalance = await comp.balanceOf(pool.address)

            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const newBalance = await comp.balanceOf(pool.address)
                    
            expect(newBalance.sub(oldBalance)).to.be.eq(borrowAmount.add(feesAmount).sub(killerAmount))
        });

        it(' should remove the voting power given to the delegatee', async () => {
            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const votes: BigNumber = await comp.getCurrentVotes(delegatee.address)

            expect(votes).to.be.eq(0)
        });
    
    });


    describe('changeDelegatee', async () => {

        beforeEach(async () => {
            await comp.connect(admin).transfer(loan.address, borrowAmount)
            await comp.connect(admin).transfer(loan.address, feesAmount)
        });

        it(' should update the delegatee', async () => {
            await loan.connect(pool).changeDelegatee(newDelegatee.address)

            const loan_delegatee: string = await loan.delegatee()

            expect(loan_delegatee).to.be.eq(newDelegatee.address)
        });


        it(' should move the voting power to the new delegatee', async () => {
            await loan.connect(pool).changeDelegatee(newDelegatee.address)

            const votes: BigNumber = await comp.getCurrentVotes(newDelegatee.address)

            expect(votes).to.be.eq(borrowAmount.add(feesAmount))
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
                loan.connect(borrower).closeLoan(0)
            ).to.be.reverted
    
            await expect(
                loan.connect(borrower).killLoan(killer.address, 0)
            ).to.be.reverted
        });

    });

    describe('access control', async () => {

        it(' should block initiate calls to existing loans', async () => {
            await expect(
                loan.connect(borrower).initiate(
                    pool.address,
                    borrower.address,
                    comp.address,
                    delegatee.address,
                    borrowAmount,
                    feesAmount)
            ).to.be.reverted
        });

    });

});