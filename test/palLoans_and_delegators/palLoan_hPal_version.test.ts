import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { IPalLoan } from "../../typechain/IPalLoan";
import { IPalLoan__factory } from "../../typechain/factories/IPalLoan__factory";
import { IERC20 } from "../../typechain/utils/IERC20";
import { IhPAL } from "../../typechain/interfaces/IhPAL";
import { IERC20__factory } from "../../typechain/factories/utils/IERC20__factory";
import { IhPAL__factory } from "../../typechain/factories/interfaces/IhPAL__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PalDelegatorClaimer } from "../../typechain/delegators/PalDelegatorClaimer";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { getERC20 } from "../utils/getERC20";
import { PalLoanFactory } from "../../typechain/tests/PalLoanFactory";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let delegatorFactory: ContractFactory
let palLoanFactory: ContractFactory

const PAL_address = "0xAB846Fb6C81370327e784Ae7CbB6d6a6af6Ff4BF" //PAL contract on mainnet
const hPAL_address = "0x624D822934e87D3534E435b83ff5C19769Efd9f6" //hPAL contract on mainnet

const PAL_holder = "0x0792dCb7080466e4Bbc678Bdb873FE7D969832B8"

describe('PalLoan (Delegator clone) tests (Pal Delegator Claimer version for hPAL)', () => {
    let pool: SignerWithAddress
    let admin: SignerWithAddress
    let borrower: SignerWithAddress
    let delegatee: SignerWithAddress
    let newDelegatee: SignerWithAddress
    let killer: SignerWithAddress

    let loan: IPalLoan
    let delegator: PalDelegatorClaimer
    let pal: IERC20
    let hpal_erc20: IERC20
    let hpal: IhPAL
    let factory: PalLoanFactory


    const borrowAmount = ethers.utils.parseEther('100')
    const feesAmount = ethers.utils.parseEther('10')

    
    before( async () => {
        delegatorFactory = await ethers.getContractFactory("PalDelegatorClaimer");

        palLoanFactory = await ethers.getContractFactory("PalLoanFactory");

        [pool, admin, borrower, delegatee, newDelegatee, killer] = await ethers.getSigners();

        pal = IERC20__factory.connect(PAL_address, provider);
        hpal_erc20 = IERC20__factory.connect(hPAL_address, provider);
        hpal = IhPAL__factory.connect(hPAL_address, provider);

        const staking_amount = ethers.utils.parseEther('100000')

        await getERC20(admin, PAL_holder, pal, admin.address, staking_amount);

        await pal.connect(admin).approve(hPAL_address, staking_amount)

        await hpal.connect(admin).stake(staking_amount)
    })


    beforeEach( async () => {

        delegator = (await delegatorFactory.connect(admin).deploy()) as PalDelegatorClaimer;
        await delegator.deployed();

        factory = (await palLoanFactory.connect(admin).deploy()) as PalLoanFactory;
        await factory.deployed();

        // use PalLoanFactory to clone Delegator
        await factory.createPalLoan(
            delegator.address,
            pool.address,
            borrower.address,
            hpal.address,
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
            expect(loan_underlying).to.be.eq(hpal.address)
            expect(loan_borrower).to.be.eq(borrower.address)
            expect(loan_borrowAmount).to.be.eq(borrowAmount)
            expect(loan_feesAmount).to.be.eq(feesAmount)
            expect(loan_delegatee).to.be.eq(delegatee.address)
        });


        it(' should delegate the right amount of voting power', async () => {

            await hpal_erc20.connect(admin).transfer(loan.address, borrowAmount)
            await hpal_erc20.connect(admin).transfer(loan.address, feesAmount)

            const votes: BigNumber = await hpal.getCurrentVotes(delegatee.address)

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
            await hpal_erc20.connect(admin).transfer(loan.address, borrowAmount)
            await hpal_erc20.connect(admin).transfer(loan.address, feesAmount)

        });

        it(' should return the right amount of tokens to the Borrower', async () => {
            const oldBalance = await hpal_erc20.balanceOf(borrower.address)

            await loan.connect(pool).closeLoan(usedFees, borrower.address)

            const newBalance = await hpal_erc20.balanceOf(borrower.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(feesAmount.sub(usedFees))
        });

        it(' should return the right amount of tokens to the Pool', async () => {
            const oldBalance = await hpal_erc20.balanceOf(pool.address)

            await loan.connect(pool).closeLoan(usedFees, borrower.address)

            const newBalance = await hpal_erc20.balanceOf(pool.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(borrowAmount.add(usedFees))
        });

        it(' should remove the voting power given to the delegatee', async () => {
            await loan.connect(pool).closeLoan(usedFees, borrower.address)

            const votes: BigNumber = await hpal.getCurrentVotes(delegatee.address)

            expect(votes).to.be.eq(0)
        });

        it(' should claim PAL reward before closing', async () => {
            const previous_PAL_balance = await pal.balanceOf(pool.address)

            await loan.connect(pool).closeLoan(usedFees, borrower.address)

            const pendingRewards: BigNumber = await hpal.estimateClaimableRewards(loan.address)

            const new_PAL_balance = await pal.balanceOf(pool.address)

            expect(pendingRewards).to.be.eq(0)

            expect(new_PAL_balance).to.be.gt(previous_PAL_balance)
        });
    
    });


    describe('killLoan', async () => {

        const killerRatio = ethers.utils.parseEther('0.15')

        const killerAmount = ethers.utils.parseEther('1.5')

        beforeEach(async () => {
            await hpal_erc20.connect(admin).transfer(loan.address, borrowAmount)
            await hpal_erc20.connect(admin).transfer(loan.address, feesAmount)

        });

        it(' should reward the right amount of tokens to the Killer', async () => {
            const oldBalance = await hpal_erc20.balanceOf(killer.address)

            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const newBalance = await hpal_erc20.balanceOf(killer.address)

            expect(newBalance.sub(oldBalance)).to.be.eq(killerAmount)
        });

        it(' should return the right amount of tokens to the Pool', async () => {
            const oldBalance = await hpal_erc20.balanceOf(pool.address)

            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const newBalance = await hpal_erc20.balanceOf(pool.address)
                    
            expect(newBalance.sub(oldBalance)).to.be.eq(borrowAmount.add(feesAmount).sub(killerAmount))
        });

        it(' should remove the voting power given to the delegatee', async () => {
            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const votes: BigNumber = await hpal.getCurrentVotes(delegatee.address)

            expect(votes).to.be.eq(0)
        });

        it(' should claim PAL reward before killing', async () => {
            const previous_PAL_balance = await pal.balanceOf(pool.address)

            await loan.connect(pool).killLoan(killer.address, killerRatio)

            const pendingRewards: BigNumber = await hpal.estimateClaimableRewards(loan.address)

            const new_PAL_balance = await pal.balanceOf(pool.address)

            expect(pendingRewards).to.be.eq(0)

            expect(new_PAL_balance).to.be.gt(previous_PAL_balance)
        });
    
    });


    describe('changeDelegatee', async () => {

        beforeEach(async () => {
            await hpal_erc20.connect(admin).transfer(loan.address, borrowAmount)
            await hpal_erc20.connect(admin).transfer(loan.address, feesAmount)

        });


        it(' should move the voting power to the new delegatee', async () => {
            await loan.connect(pool).changeDelegatee(newDelegatee.address)

            const votes: BigNumber = await hpal.getCurrentVotes(newDelegatee.address)

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