import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PalLoan } from "../../typechain/PalLoan";
import { IERC20 } from "../../typechain/IERC20";
import { IGovernancePowerDelegationToken } from "../../typechain/IGovernancePowerDelegationToken";
import { IERC20__factory } from "../../typechain/factories/IERC20__factory";
import { IGovernancePowerDelegationToken__factory } from "../../typechain/factories/IGovernancePowerDelegationToken__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { AaveDelegator } from "../../typechain/AaveDelegator";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { getAAVE } from "../utils/getERC20";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let delegatorFactory: ContractFactory
let loanFactory: ContractFactory

const AAVE_address = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" //AAVE contract on mainnet

describe('PalLoan contract tests (using the Aave Delegator)', () => {
    let pool: SignerWithAddress
    let admin: SignerWithAddress
    let borrower: SignerWithAddress
    let delegatee: SignerWithAddress
    let newDelegatee: SignerWithAddress
    let killer: SignerWithAddress

    let loan: PalLoan
    let delegator: AaveDelegator
    let aave: IERC20
    let aavePower: IGovernancePowerDelegationToken

    
    before( async () => {
        delegatorFactory = await ethers.getContractFactory("AaveDelegator");

        loanFactory = await ethers.getContractFactory("PalLoan");

        [pool, admin, borrower, delegatee, newDelegatee, killer] = await ethers.getSigners();

        aave = IERC20__factory.connect(AAVE_address, provider);
        aavePower = IGovernancePowerDelegationToken__factory.connect(AAVE_address, provider);

        await getAAVE(admin, aave, admin.address, ethers.utils.parseEther('100000'));
    })


    beforeEach( async () => {

        delegator = (await delegatorFactory.connect(admin).deploy()) as AaveDelegator;
        await delegator.deployed();

        loan = (await loanFactory.connect(pool).deploy(pool.address, borrower.address, aave.address, delegator.address)) as PalLoan;
        await loan.deployed();

    });


    it(' should be deployed & have correct parameters', async () => {
        expect(loan.address).to.properAddress

        const loan_pool: string = await loan.motherPool()
        const loan_underlying: string = await loan.underlying()
        const loan_borrower: string = await loan.borrower()
        const loan_delegator: string = await loan.delegator()

        expect(loan_pool).to.be.eq(pool.address)
        expect(loan_underlying).to.be.eq(aave.address)
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


        it(' should delegate the right amount of voting power', async () => {

            await aave.connect(admin).transfer(loan.address, borrowAmount)
            await aave.connect(admin).transfer(loan.address, feesAmount)

            await loan.connect(pool).initiate(delegatee.address, borrowAmount, feesAmount)

            const votes: BigNumber = await aavePower.getPowerCurrent(delegatee.address, 0)

            expect(votes).to.be.eq(borrowAmount.add(feesAmount))
        });

        after( async () => {
            await loan.connect(pool).closeLoan(ethers.utils.parseEther('5'))
        })

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
            await aave.connect(admin).transfer(loan.address, borrowAmount)
            await aave.connect(admin).transfer(loan.address, feesAmount)

            await loan.connect(pool).initiate(delegatee.address, borrowAmount, feesAmount)

        });

        it(' should return the right amount of tokens to the Borrower', async () => {
            const oldBalance = await aave.balanceOf(borrower.address)

            await loan.connect(pool).closeLoan(usedFees)

            const newBalance = await aave.balanceOf(borrower.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(feesAmount.sub(usedFees))
        });

        it(' should return the right amount of tokens to the Pool', async () => {
            const oldBalance = await aave.balanceOf(pool.address)

            await loan.connect(pool).closeLoan(usedFees)

            const newBalance = await aave.balanceOf(pool.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(borrowAmount.add(usedFees))
        });

        it(' should remove the voting power given to the delegatee', async () => {
            await loan.connect(pool).closeLoan(usedFees)

            const votes: BigNumber = await aavePower.getPowerCurrent(delegatee.address, 0)

            expect(votes).to.be.eq(0)
        });
    
    });


    describe('killLoan', async () => {

        const borrowAmount = ethers.utils.parseEther('100')
        const feesAmount = ethers.utils.parseEther('10')

        const killerRatio = ethers.utils.parseEther('0.15')

        const killerAmount = ethers.utils.parseEther('1.5')

        beforeEach(async () => {
            await aave.connect(admin).transfer(loan.address, borrowAmount)
            await aave.connect(admin).transfer(loan.address, feesAmount)

            await loan.connect(pool).initiate(delegatee.address, borrowAmount, feesAmount)

        });

        it(' should reward the right amount of tokens to the Killer', async () => {
            const oldBalance = await aave.balanceOf(killer.address)

            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const newBalance = await aave.balanceOf(killer.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(killerAmount)
        });

        it(' should return the right amount of tokens to the Pool', async () => {
            const oldBalance = await aave.balanceOf(pool.address)

            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const newBalance = await aave.balanceOf(pool.address)
                    
            expect(newBalance.sub(oldBalance)).to.be.eq(borrowAmount.add(feesAmount).sub(killerAmount))
        });

        it(' should remove the voting power given to the delegatee', async () => {
            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const votes: BigNumber = await aavePower.getPowerCurrent(delegatee.address, 0)

            expect(votes).to.be.eq(0)
        });
    
    });


    describe('changeDelegatee', async () => {

        let borrowAmount = ethers.utils.parseEther('100')
        let feesAmount = ethers.utils.parseEther('10')

        beforeEach(async () => {
            await aave.connect(admin).transfer(loan.address, borrowAmount)
            await aave.connect(admin).transfer(loan.address, feesAmount)

            await loan.connect(pool).initiate(delegatee.address, borrowAmount, feesAmount)
        });


        it(' should move the voting power to the new delegatee', async () => {
            await loan.changeDelegatee(newDelegatee.address)

            const votes: BigNumber = await aavePower.getPowerCurrent(newDelegatee.address, 0)

            expect(votes).to.be.eq(borrowAmount.add(feesAmount))
        });

        
        it(' should update the delegatee', async () => {
            await loan.changeDelegatee(newDelegatee.address)

            const loan_delegatee: string = await loan.delegatee()

            expect(loan_delegatee).to.be.eq(newDelegatee.address)
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