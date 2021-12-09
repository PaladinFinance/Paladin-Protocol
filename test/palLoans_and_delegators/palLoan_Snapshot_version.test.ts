import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { IPalLoan } from "../../typechain/IPalLoan";
import { IPalLoan__factory } from "../../typechain/factories/IPalLoan__factory";
import { Comp } from "../../typechain/Comp";
import { DelegateRegistry } from "../../typechain/DelegateRegistry";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SnapshotDelegator } from "../../typechain/SnapshotDelegator";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { PalLoanFactory } from "../../typechain/PalLoanFactory";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let delegatorFactory: ContractFactory
let compFactory: ContractFactory
let delegateRegistryFactory: ContractFactory
let palLoanFactory: ContractFactory

const delegateRegistryAddress = "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446"

const delegateRegistry_id = ethers.utils.formatBytes32String("")

describe('PalLoan (Delegator clone) tests (Snapshot Delegator version)', () => {
    let pool: SignerWithAddress
    let admin: SignerWithAddress
    let borrower: SignerWithAddress
    let delegatee: SignerWithAddress
    let newDelegatee: SignerWithAddress
    let killer: SignerWithAddress

    let loan: IPalLoan
    let delegator: SnapshotDelegator
    let comp: Comp
    let delegateRegistry: DelegateRegistry
    let factory: PalLoanFactory


    const borrowAmount = ethers.utils.parseEther('100')
    const feesAmount = ethers.utils.parseEther('10')


    before(async () => {
        delegatorFactory = await ethers.getContractFactory("SnapshotDelegator");

        compFactory = await ethers.getContractFactory("Comp");

        delegateRegistryFactory = await ethers.getContractFactory("DelegateRegistry");
    
        palLoanFactory = await ethers.getContractFactory("PalLoanFactory");
    })


    beforeEach(async () => {
        [pool, admin, borrower, delegatee, newDelegatee, killer] = await ethers.getSigners();

        delegator = (await delegatorFactory.connect(admin).deploy()) as SnapshotDelegator;
        await delegator.deployed();

        comp = (await compFactory.connect(admin).deploy(admin.address)) as Comp;
        await comp.deployed();

        delegateRegistry = delegateRegistryFactory.attach(delegateRegistryAddress) as DelegateRegistry;

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

        it(' should delegate to the right address', async () => {

            await comp.connect(admin).transfer(loan.address, borrowAmount)
            await comp.connect(admin).transfer(loan.address, feesAmount)

            expect(await delegateRegistry.delegation(loan.address, delegateRegistry_id)).to.be.eq(delegatee.address)

            /*await expect(tx)
                .to.emit(delegateRegistry, 'SetDelegate')
                .withArgs(loan.address, delegateRegistry_id, delegatee.address);*/
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

            await loan.connect(pool).closeLoan(usedFees, borrower.address)

            const newBalance = await comp.balanceOf(borrower.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(feesAmount.sub(usedFees))
        });

        it(' should return the right amount of tokens to the Pool', async () => {
            const oldBalance = await comp.balanceOf(pool.address)

            await loan.connect(pool).closeLoan(usedFees, borrower.address)

            const newBalance = await comp.balanceOf(pool.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(borrowAmount.add(usedFees))
        });


        it(' should clear the DelegateRegistry', async () => {

            const tx = await loan.connect(pool).closeLoan(usedFees, borrower.address)

            expect(await delegateRegistry.delegation(loan.address, delegateRegistry_id)).to.be.eq(ethers.constants.AddressZero)

            await expect(tx)
                .to.emit(delegateRegistry, 'ClearDelegate')
                .withArgs(loan.address, delegateRegistry_id, delegatee.address);
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

        it(' should clear the DelegateRegistry', async () => {

            const tx = await loan.connect(pool).killLoan(killer.address, killerRatio)

            expect(await delegateRegistry.delegation(loan.address, delegateRegistry_id)).to.be.eq(ethers.constants.AddressZero)

            await expect(tx)
                .to.emit(delegateRegistry, 'ClearDelegate')
                .withArgs(loan.address, delegateRegistry_id, delegatee.address);
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


        it(' should update the DelegateRegistry with the new delegatee', async () => {
            const tx = await loan.connect(pool).changeDelegatee(newDelegatee.address)

            expect(await delegateRegistry.delegation(loan.address, delegateRegistry_id)).to.be.eq(newDelegatee.address)

            await expect(tx)
                .to.emit(delegateRegistry, 'SetDelegate')
                .withArgs(loan.address, delegateRegistry_id, newDelegatee.address);
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