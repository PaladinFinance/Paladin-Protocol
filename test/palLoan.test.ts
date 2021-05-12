import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PalLoan } from "../typechain/PalLoan";
import { Comp } from "../typechain/Comp"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BasicDelegator } from "../typechain/BasicDelegator";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";

chai.use(solidity);
const { expect } = chai;

let delegatorFactory: ContractFactory
let compFactory: ContractFactory
let loanFactory: ContractFactory

describe('PalLoan contract tests', () => {
    let pool: SignerWithAddress
    let admin: SignerWithAddress
    let borrower: SignerWithAddress
    let killer: SignerWithAddress

    let loan: PalLoan
    let delegator: BasicDelegator
    let comp: Comp

    
    before( async () => {
        delegatorFactory = await ethers.getContractFactory("BasicDelegator");

        compFactory = await ethers.getContractFactory("Comp");

        loanFactory = await ethers.getContractFactory("PalLoan");
    })


    beforeEach( async () => {
        [pool, admin, borrower, killer] = await ethers.getSigners();

        delegator = (await delegatorFactory.connect(admin).deploy()) as BasicDelegator;
        await delegator.deployed();

        comp = (await compFactory.connect(admin).deploy(admin.address)) as Comp;
        await comp.deployed();

        loan = (await loanFactory.connect(pool).deploy(pool.address, borrower.address, comp.address, delegator.address)) as PalLoan;
        await loan.deployed();
    });


    it(' should be deployed & have correct parameters', async () => {
        expect(loan.address).to.properAddress

        const loan_pool: string = await loan.motherPool()
        const loan_underlying: string = await loan.underlying()
        const loan_borrower: string = await loan.borrower()
        const loan_delegator: string = await loan.delegator()

        expect(loan_pool).to.be.eq(pool.address)
        expect(loan_underlying).to.be.eq(comp.address)
        expect(loan_borrower).to.be.eq(borrower.address)
        expect(loan_delegator).to.be.eq(delegator.address)
    });

    describe('intitiate', async () => {

        let borrowAmount = ethers.utils.parseEther('100')
        let feesAmount = ethers.utils.parseEther('10')

        beforeEach(async () => {
            await loan.connect(pool).initiate(borrowAmount, feesAmount)
        });

        it(' should delegate the right parameters', async () => {

            const loan_borrowAmount: BigNumber = await loan.amount()
            const loan_feesAmount: BigNumber = await loan.feesAmount()

            expect(loan_borrowAmount).to.be.eq(borrowAmount)
            expect(loan_feesAmount).to.be.eq(feesAmount)
        });


        it(' should delegate the right amount of voting power', async () => {

            await comp.connect(admin).transfer(loan.address, borrowAmount)
            await comp.connect(admin).transfer(loan.address, feesAmount)

            const votes: BigNumber = await comp.getCurrentVotes(borrower.address)

            expect(votes).to.be.eq(borrowAmount.add(feesAmount))
        });

    });


    describe('expand', async () => {

        let feesAmount = ethers.utils.parseEther('5')

        it(' should update the feesAmount parameter', async () => {

            const oldFeesAmount = await loan.feesAmount()

            await loan.expand(feesAmount)

            const newFeesAmount = await loan.feesAmount()

            expect(newFeesAmount.sub(oldFeesAmount)).to.be.eq(feesAmount)
        });
    
    });


    describe('closeLoan', async () => {

        const borrowAmount = ethers.utils.parseEther('100')
        const feesAmount = ethers.utils.parseEther('10')

        const usedFees = ethers.utils.parseEther('5')

        beforeEach(async () => {
            await comp.connect(admin).transfer(loan.address, borrowAmount)
            await comp.connect(admin).transfer(loan.address, feesAmount)

            await loan.connect(pool).initiate(borrowAmount, feesAmount)

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
    
    });


    describe('killLoan', async () => {

        const borrowAmount = ethers.utils.parseEther('100')
        const feesAmount = ethers.utils.parseEther('10')

        const killerRatio = ethers.utils.parseEther('0.15')

        const killerAmount = ethers.utils.parseEther('1.5')

        beforeEach(async () => {
            await comp.connect(admin).transfer(loan.address, borrowAmount)
            await comp.connect(admin).transfer(loan.address, feesAmount)

            await loan.connect(pool).initiate(borrowAmount, feesAmount)

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
    
    });
    

    describe('motherPoolOnly modifier', async () => {

        it(' should block non-pool calls', async () => {
            await expect(
                loan.connect(borrower).initiate(0, 0)
            ).to.be.reverted
    
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


    /*describe('wrong Delegator', async () => {

        let loan2: PalLoan

        before(async () => {
            loan2 = (await loanFactory.connect(pool).deploy(pool.address, borrower.address, comp.address, borrower.address)) as PalLoan;
            await loan2.deployed();
        });

        it(' should fail delegateCall', async () => {
            await expect(
                loan2.connect(pool).initiate(0, 0)
            ).to.be.reverted
    
            await expect(
                loan2.connect(pool).expand(0)
            ).to.be.reverted
    
            await expect(
                loan2.connect(pool).closeLoan(0)
            ).to.be.reverted
    
            await expect(
                loan2.connect(pool).killLoan(killer.address, 0)
            ).to.be.reverted
        });

    });*/

});