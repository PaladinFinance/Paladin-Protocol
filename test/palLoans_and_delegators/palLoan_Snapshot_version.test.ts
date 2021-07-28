import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PalLoan } from "../../typechain/PalLoan";
import { Comp } from "../../typechain/Comp";
import { DelegateRegistry } from "../../typechain/DelegateRegistry";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SnapshotDelegator } from "../../typechain/SnapshotDelegator";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";

chai.use(solidity);
const { expect } = chai;

let delegatorFactory: ContractFactory
let compFactory: ContractFactory
let loanFactory: ContractFactory
let delegateRegistryFactory: ContractFactory

const delegateRegistryAddress = "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446"

const delegateRegistry_id = ethers.utils.formatBytes32String("")

describe('PalLoan contract tests (using the Snapshot Delegator)', () => {
    let pool: SignerWithAddress
    let admin: SignerWithAddress
    let borrower: SignerWithAddress
    let delegatee: SignerWithAddress
    let newDelegatee: SignerWithAddress
    let killer: SignerWithAddress

    let loan: PalLoan
    let delegator: SnapshotDelegator
    let comp: Comp
    let delegateRegistry: DelegateRegistry


    before(async () => {
        delegatorFactory = await ethers.getContractFactory("SnapshotDelegator");

        compFactory = await ethers.getContractFactory("Comp");

        loanFactory = await ethers.getContractFactory("PalLoan");

        delegateRegistryFactory = await ethers.getContractFactory("DelegateRegistry");
    })


    beforeEach(async () => {
        [pool, admin, borrower, delegatee, newDelegatee, killer] = await ethers.getSigners();

        delegator = (await delegatorFactory.connect(admin).deploy()) as SnapshotDelegator;
        await delegator.deployed();

        comp = (await compFactory.connect(admin).deploy(admin.address)) as Comp;
        await comp.deployed();

        delegateRegistry = delegateRegistryFactory.attach(delegateRegistryAddress) as DelegateRegistry;

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

        it(' should delegate the right parameters', async () => {

            await loan.connect(pool).initiate(delegatee.address, borrowAmount, feesAmount)

            const loan_borrowAmount: BigNumber = await loan.amount()
            const loan_feesAmount: BigNumber = await loan.feesAmount()
            const loan_delegatee: string = await loan.delegatee()

            expect(loan_borrowAmount).to.be.eq(borrowAmount)
            expect(loan_feesAmount).to.be.eq(feesAmount)
            expect(loan_delegatee).to.be.eq(delegatee.address)
        });


        it(' should delegate to the right address', async () => {

            await comp.connect(admin).transfer(loan.address, borrowAmount)
            await comp.connect(admin).transfer(loan.address, feesAmount)

            const tx = await loan.connect(pool).initiate(delegatee.address, borrowAmount, feesAmount)

            expect(await delegateRegistry.delegation(loan.address, delegateRegistry_id)).to.be.eq(delegatee.address)

            await expect(tx)
                .to.emit(delegateRegistry, 'SetDelegate')
                .withArgs(loan.address, delegateRegistry_id, delegatee.address);
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

            await loan.connect(pool).initiate(delegatee.address, borrowAmount, feesAmount)

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


        it(' should clear the DelegateRegistry', async () => {

            const tx = await loan.connect(pool).closeLoan(usedFees)

            expect(await delegateRegistry.delegation(loan.address, delegateRegistry_id)).to.be.eq(ethers.constants.AddressZero)

            await expect(tx)
                .to.emit(delegateRegistry, 'ClearDelegate')
                .withArgs(loan.address, delegateRegistry_id, delegatee.address);
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

            await loan.connect(pool).initiate(delegatee.address, borrowAmount, feesAmount)

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

        it(' should clear the DelegateRegistry', async () => {

            const tx = await loan.connect(pool).killLoan(killer.address, killerRatio)

            expect(await delegateRegistry.delegation(loan.address, delegateRegistry_id)).to.be.eq(ethers.constants.AddressZero)

            await expect(tx)
                .to.emit(delegateRegistry, 'ClearDelegate')
                .withArgs(loan.address, delegateRegistry_id, delegatee.address);
        });

    });


    describe('changeDelegatee', async () => {

        let borrowAmount = ethers.utils.parseEther('100')
        let feesAmount = ethers.utils.parseEther('10')

        beforeEach(async () => {
            await comp.connect(admin).transfer(loan.address, borrowAmount)
            await comp.connect(admin).transfer(loan.address, feesAmount)

            await loan.connect(pool).initiate(delegatee.address, borrowAmount, feesAmount)
        });

        it(' should update the delegatee', async () => {
            await loan.changeDelegatee(newDelegatee.address)

            const loan_delegatee: string = await loan.delegatee()

            expect(loan_delegatee).to.be.eq(newDelegatee.address)
        });


        it(' should update the DelegateRegistry with the new delegatee', async () => {
            const tx = await loan.changeDelegatee(newDelegatee.address)

            expect(await delegateRegistry.delegation(loan.address, delegateRegistry_id)).to.be.eq(newDelegatee.address)

            await expect(tx)
                .to.emit(delegateRegistry, 'SetDelegate')
                .withArgs(loan.address, delegateRegistry_id, newDelegatee.address);
        });


        it(' should not change the other values', async () => {

            const old_loan_pool: string = await loan.motherPool()
            const old_loan_underlying: string = await loan.underlying()
            const old_loan_borrower: string = await loan.borrower()
            const old_loan_delegator: string = await loan.delegator()
            const old_loan_borrowAmount: BigNumber = await loan.amount()
            const old_loan_feesAmount: BigNumber = await loan.feesAmount()

            await loan.changeDelegatee(newDelegatee.address)

            const loan_pool: string = await loan.motherPool()
            const loan_underlying: string = await loan.underlying()
            const loan_borrower: string = await loan.borrower()
            const loan_delegator: string = await loan.delegator()
            const loan_borrowAmount: BigNumber = await loan.amount()
            const loan_feesAmount: BigNumber = await loan.feesAmount()

            expect(loan_borrowAmount).to.be.eq(old_loan_borrowAmount)
            expect(loan_feesAmount).to.be.eq(old_loan_feesAmount)
            expect(loan_pool).to.be.eq(old_loan_pool)
            expect(loan_underlying).to.be.eq(old_loan_underlying)
            expect(loan_borrower).to.be.eq(old_loan_borrower)
            expect(loan_delegator).to.be.eq(old_loan_delegator)
        });

    });


    describe('motherPoolOnly modifier', async () => {

        it(' should block non-pool calls', async () => {
            await expect(
                loan.connect(borrower).initiate(delegatee.address, 0, 0)
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

});