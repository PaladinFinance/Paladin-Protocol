import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PalToken } from "../../typechain/PalToken";
import { PalPool } from "../../typechain/PalPool";
import { PalLoanToken } from "../../typechain/PalLoanToken";
import { IPalLoan } from "../../typechain/IPalLoan";
import { IPalLoan__factory } from "../../typechain/factories/IPalLoan__factory";
import { PaladinController } from "../../typechain/PaladinController";
import { InterestCalculator } from "../../typechain/InterestCalculator";
import { Comp } from "../../typechain/Comp";
import { BasicDelegator } from "../../typechain/BasicDelegator";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

const mantissaScale = ethers.utils.parseEther('1')

const mineBlocks = async (n: number): Promise<any> => {
    for(let i = 0; i < n; i++){
        await ethers.provider.send("evm_mine", [])
    }
    return Promise.resolve()
}

let poolFactory: ContractFactory
let tokenFactory: ContractFactory
let controllerFactory: ContractFactory
let delegatorFactory: ContractFactory
let interestFactory: ContractFactory
let erc20Factory: ContractFactory
let palLoanTokenFactory: ContractFactory

describe('PalPool : 3 - Borrows tests', () => {
    let admin: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress
    let fake_loan: SignerWithAddress

    let pool: PalPool
    let token: PalToken
    let loanToken: PalLoanToken
    let controller: PaladinController
    let delegator: BasicDelegator
    let interest: InterestCalculator
    let underlying: Comp

    let name: string = "Paladin MOCK"
    let symbol: string = "palMOCK"

    
    before( async () => {
        tokenFactory = await ethers.getContractFactory("PalToken");
        palLoanTokenFactory = await ethers.getContractFactory("PalLoanToken");
        poolFactory = await ethers.getContractFactory("PalPool");
        controllerFactory = await ethers.getContractFactory("PaladinController");
        delegatorFactory = await ethers.getContractFactory("BasicDelegator");
        interestFactory = await ethers.getContractFactory("InterestCalculator");
        erc20Factory = await ethers.getContractFactory("Comp");
    })


    beforeEach( async () => {
        [admin, user1, user2, user3, fake_loan] = await ethers.getSigners();

        token = (await tokenFactory.connect(admin).deploy(name, symbol)) as PalToken;
        await token.deployed();

        underlying = (await erc20Factory.connect(admin).deploy(admin.address)) as Comp;
        await underlying.deployed();

        controller = (await controllerFactory.connect(admin).deploy()) as PaladinController;
        await controller.deployed();

        loanToken = (await palLoanTokenFactory.connect(admin).deploy(controller.address, "about:blank")) as PalLoanToken;
        await loanToken.deployed();

        interest = (await interestFactory.connect(admin).deploy()) as InterestCalculator;
        await interest.deployed();

        delegator = (await delegatorFactory.connect(admin).deploy()) as BasicDelegator;
        await delegator.deployed();

        pool = (await poolFactory.connect(admin).deploy(
            token.address,
            controller.address, 
            underlying.address,
            interest.address,
            delegator.address,
            loanToken.address
        )) as PalPool;
        await pool.deployed();

        await token.initiate(pool.address);

        await controller.addNewPool(token.address, pool.address);
    });



    describe('borrow', async () => {

        const deposit = ethers.utils.parseEther('1000')

        const borrow_amount = ethers.utils.parseEther('100')

        const fees_amount = ethers.utils.parseEther('5')

        beforeEach(async () => {
            await underlying.connect(admin).transfer(user2.address, deposit)
            await underlying.connect(admin).transfer(user1.address, fees_amount)

            await underlying.connect(user1).approve(pool.address, fees_amount)
            await underlying.connect(user2).approve(pool.address, deposit)

            await pool.connect(user2).deposit(deposit)
        });


        it(' should execute correctly (with correct Event)', async () => {

            const borrow_call = pool.connect(user1).borrow(user2.address, borrow_amount, fees_amount)

            await borrow_call

            const new_loan_address = (await pool.getLoansPools())[0]

            await expect(borrow_call)
            .to.emit(pool, 'NewLoan')
            .withArgs(
                user1.address,
                user2.address,
                underlying.address,
                borrow_amount,
                pool.address,
                new_loan_address,
                0,
                (await borrow_call).blockNumber
            )

            const pool_totalBorrowed = await pool.totalBorrowed()

            expect(pool_totalBorrowed).to.be.eq(borrow_amount)
            
        });


        it(' should mint the palLoanToken (with the correct Event & correct data)', async () => {

            const borrow_call = await pool.connect(user1).borrow(user2.address, borrow_amount, fees_amount)

            const new_loan_address = (await pool.getLoansPools())[0]

            const new_loan_token_id = 0

            await expect(borrow_call)
                .to.emit(loanToken, 'NewLoanToken')
                .withArgs(
                    pool.address,
                    user1.address,
                    new_loan_address,
                    new_loan_token_id
                )

            expect(await pool.idOfLoan(new_loan_address)).to.be.eq(new_loan_token_id)

            expect(await loanToken.loanOf(new_loan_token_id)).to.be.eq(new_loan_address)
            expect(await loanToken.poolOf(new_loan_token_id)).to.be.eq(pool.address)
            expect(await loanToken.balanceOf(user1.address)).to.be.eq(1)
            
        });


        it(' should list the correct address as owner', async () => {

            await pool.connect(user1).borrow(user2.address, borrow_amount, fees_amount)

            const new_loan_address = (await pool.getLoansPools())[0]

            expect(await pool.isLoanOwner(new_loan_address, user1.address)).to.be.true

            await loanToken.connect(user1).transferFrom(user1.address, user2.address, 0)

            expect(await pool.isLoanOwner(new_loan_address, user1.address)).to.be.false
            expect(await pool.isLoanOwner(new_loan_address, user2.address)).to.be.true
            
        });


        it(' should deploy a palLoan with the correct parameters', async () => {

            await pool.connect(user1).borrow(user2.address, borrow_amount, fees_amount)

            const new_loan_address = (await pool.getLoansPools())[0]

            expect(new_loan_address).to.properAddress

            const loan = IPalLoan__factory.connect(new_loan_address, provider);

            const loan_pool: string = await loan.motherPool()
            const loan_underlying: string = await loan.underlying()
            const loan_borrower: string = await loan.borrower()
            const loan_delegatee: string = await loan.delegatee()
            const loan_borrowAmount: BigNumber = await loan.amount()
            const loan_feesAmount: BigNumber = await loan.feesAmount()

            expect(loan_pool).to.be.eq(pool.address)
            expect(loan_underlying).to.be.eq(underlying.address)
            expect(loan_borrower).to.be.eq(user1.address)
            expect(loan_delegatee).to.be.eq(user2.address)
            expect(loan_borrowAmount).to.be.eq(borrow_amount)
            expect(loan_feesAmount).to.be.eq(fees_amount)

            const loan_balance = await underlying.balanceOf(new_loan_address)

            expect(loan_balance).to.be.eq(borrow_amount.add(fees_amount))
            
        });


        it(' should create the Borrow object, with correct values', async () => {

            const borrow_tx = await pool.connect(user1).borrow(user2.address, borrow_amount, fees_amount)

            const new_loan_address = (await pool.getLoansPools())[0]

            const borrower_loans = await pool.getLoansByBorrower(user1.address)

            expect(new_loan_address).to.be.eq(borrower_loans[0])

            const loan_data = await pool.getBorrowData(new_loan_address)

            expect(loan_data._borrower).to.be.eq(user1.address)
            expect(loan_data._delegatee).to.be.eq(user2.address)
            expect(loan_data._loan).to.be.eq(new_loan_address)
            expect(loan_data._amount).to.be.eq(borrow_amount)
            expect(loan_data._underlying).to.be.eq(underlying.address)
            expect(loan_data._feesAmount).to.be.eq(fees_amount)
            expect(loan_data._feesUsed).to.be.eq(0)
            expect(loan_data._startBlock).to.be.eq(borrow_tx.blockNumber)
            expect(loan_data._closeBlock).to.be.eq(0)
            expect(loan_data._closed).to.be.false

        });


        it(' should delegate the votes correctly', async () => {

            await pool.connect(user1).borrow(user2.address, borrow_amount, fees_amount)

            const delegated_votes = await underlying.getCurrentVotes(user2.address)

            expect(delegated_votes).to.be.eq(borrow_amount.add(fees_amount))
            
        });


        it(' should allow borrower to also be delegatee', async () => {

            await pool.connect(user1).borrow(user1.address, borrow_amount, fees_amount)

            const new_loan_address = (await pool.getLoansPools())[0]

            const loan_data = await pool.getBorrowData(new_loan_address)

            expect(loan_data._delegatee).to.be.eq(loan_data._borrower)
            expect(loan_data._delegatee).to.be.eq(user1.address)
            
        });


        it(' should fail if not enough cash in the pool', async () => {

            await expect(
                pool.connect(user2).borrow(user1.address, ethers.utils.parseEther('5000'), fees_amount)
            ).to.be.revertedWith('9')
            
        });


        it(' should fail if delegatee address is address 0x0', async () => {

            await expect(
                pool.connect(user1).borrow(ethers.constants.AddressZero, borrow_amount, fees_amount)
            ).to.be.revertedWith('22')
            
        });


        it(' should fail if not enough fees', async () => {

            await expect(
                pool.connect(user2).borrow(user1.address, borrow_amount, ethers.utils.parseEther('0.001'))
            ).to.be.revertedWith('23')
            
        });


        it(' should fail if balance too low to pay for fees', async () => {

            await expect(
                pool.connect(user2).borrow(user2.address, borrow_amount, fees_amount)
            ).to.be.reverted
            
        });


        it(' should fail if amount is 0', async () => {

            await expect(
                pool.connect(user1).borrow(user2.address, 0, fees_amount)
            ).to.be.revertedWith('27')
            
        });


        it(' should fail if no fees provided', async () => {

            await expect(
                pool.connect(user1).borrow(user2.address, 1, 0)
            ).to.be.revertedWith('23')
            
        });

    });


    describe('expandBorrow', async () => {

        const deposit = ethers.utils.parseEther('1000')

        const borrow_amount = ethers.utils.parseEther('100')

        const fees_amount = ethers.utils.parseEther('5')

        const expand_fees_amount = ethers.utils.parseEther('2')


        beforeEach(async () => {
            await underlying.connect(admin).transfer(user2.address, deposit)
            await underlying.connect(admin).transfer(user1.address, fees_amount.add(expand_fees_amount))

            await underlying.connect(user1).approve(pool.address, fees_amount.add(expand_fees_amount))
            await underlying.connect(user2).approve(pool.address, deposit)

            await pool.connect(user2).deposit(deposit)

            await pool.connect(user1).borrow(user1.address, borrow_amount, fees_amount)
        });
        

        it(' should expand the Borrow (with the correct Event)', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            const loan_id = await pool.idOfLoan(loan_address)

            await expect(pool.connect(user1).expandBorrow(loan_address, expand_fees_amount))
            .to.emit(pool, 'ExpandLoan')
            .withArgs(
                user1.address,
                user1.address,
                underlying.address,
                pool.address,
                fees_amount.add(expand_fees_amount),
                loan_address,
                loan_id
            )
            
        });


        it(' should update the Borrow data parameter', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).expandBorrow(loan_address, expand_fees_amount)

            const loan_data = await pool.getBorrowData(loan_address)

            expect(loan_data._borrower).to.be.eq(user1.address)
            expect(loan_data._feesAmount).to.be.eq(fees_amount.add(expand_fees_amount))
            
        });


        it(' should update the palLoan parameter', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).expandBorrow(loan_address, expand_fees_amount)

            const loan = IPalLoan__factory.connect(loan_address, provider);

            const loan_feesAmount: BigNumber = await loan.feesAmount()

            expect(loan_feesAmount).to.be.eq(fees_amount.add(expand_fees_amount))
            
        });

        
        it(' should fail if the address is not a loan', async () => {

            const fake_loan_address = fake_loan.address

            await expect(
                pool.connect(user1).expandBorrow(fake_loan_address, expand_fees_amount)
            ).to.be.reverted
            
            
        });

        
        it(' should fail if the Borrow is closed', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).closeBorrow(loan_address)

            await expect(
                pool.connect(user1).expandBorrow(loan_address, expand_fees_amount)
            ).to.be.revertedWith('14')
            
        });

        
        it(' should fail if not palLoan borrower', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await expect(
                pool.connect(user2).expandBorrow(loan_address, expand_fees_amount)
            ).to.be.revertedWith('15')
            
        });

        
        it(' should fail if the user balance is too low', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await expect(
                pool.connect(user1).expandBorrow(loan_address, fees_amount)
            ).to.be.reverted
            
        });

    });

    describe('closeBorrow', async () => {

        const deposit = ethers.utils.parseEther('1000')

        const borrow_amount = ethers.utils.parseEther('100')

        const fees_amount = ethers.utils.parseEther('5')


        const mineBlocks = async (n: number): Promise<any> => {
            for(let i = 0; i < n; i++){
                await ethers.provider.send("evm_mine", [])
            }
            return Promise.resolve()
        }


        beforeEach(async () => {
            await underlying.connect(admin).transfer(user2.address, deposit)
            await underlying.connect(admin).transfer(user1.address, fees_amount)

            await underlying.connect(user1).approve(pool.address, fees_amount)
            await underlying.connect(user2).approve(pool.address, deposit)

            await pool.connect(admin).updateMinBorrowLength(100)

            await pool.connect(user2).deposit(deposit)
        });


        it(' should close the Borrow (with the correct Event)', async () => {

            await pool.connect(user1).borrow(user1.address, borrow_amount, fees_amount)

            const loan_address = (await pool.getLoansPools())[0]
            const minBorrowLength = await pool.minBorrowLength()

            await mineBlocks(minBorrowLength.toNumber() + 1)

            const close_tx = await pool.connect(user1).closeBorrow(loan_address)

            const loan_data = await pool.getBorrowData(loan_address)

            await expect(close_tx)
            .to.emit(pool, 'CloseLoan')
            .withArgs(
                user1.address,
                user1.address,
                underlying.address,
                borrow_amount,
                pool.address,
                loan_data._feesUsed,
                loan_address,
                loan_data._palLoanTokenId,
                false
            )

            expect(loan_data._closed).to.be.true
            expect(loan_data._feesUsed).not.to.be.eq(0)
            expect(loan_data._closeBlock).to.be.eq(close_tx.blockNumber)
            
        });


        it(' should burn the palLoanToken (with the correct Event)', async () => {

            await pool.connect(user1).borrow(user1.address, borrow_amount, fees_amount)

            const loan_address = (await pool.getLoansPools())[0]
            const loan_token_id = await pool.idOfLoan(loan_address)
            const minBorrowLength = await pool.minBorrowLength()

            await mineBlocks(minBorrowLength.toNumber() + 1)

            const close_tx = await pool.connect(user1).closeBorrow(loan_address)

            await expect(close_tx)
                .to.emit(loanToken, 'BurnLoanToken')
                .withArgs(
                    pool.address,
                    user1.address,
                    loan_address,
                    loan_token_id
                )

            expect(await pool.isLoanOwner(loan_address, user1.address)).to.be.true

            expect(await loanToken.isBurned(loan_token_id)).to.be.true

            expect(await loanToken.allLoansOfForPool(user1.address, pool.address)).to.contain(loan_address)
            
        });


        it(' should empty the palLoan balance & return the unused fees to the borrower', async () => {

            await pool.connect(user1).borrow(user1.address, borrow_amount, fees_amount)

            const loan_address = (await pool.getLoansPools())[0]
            const minBorrowLength = await pool.minBorrowLength()

            const old_borrower_balance = await underlying.balanceOf(user1.address)

            await mineBlocks(minBorrowLength.toNumber() + 1)
            
            await pool.connect(user1).closeBorrow(loan_address)

            const loan_data = await pool.getBorrowData(loan_address)

            const palLoan_balance = await underlying.balanceOf(loan_address)
            const new_borrower_balance = await underlying.balanceOf(user1.address)

            expect(palLoan_balance).to.be.eq(0)
            expect(new_borrower_balance.sub(old_borrower_balance)).to.be.eq(fees_amount.sub(loan_data._feesUsed))

        });


        it(' should take penalty fees if the loan is closed before the minimum time period', async () => {

            const estimated_fees: number = +((await pool.minBorrowFees(borrow_amount)).toString())

            await pool.connect(user1).borrow(user1.address, borrow_amount, fees_amount)

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).closeBorrow(loan_address)

            const loan_data = await pool.getBorrowData(loan_address)

            const delta: number = 1e11

            const loan_fees: number = +(loan_data._feesUsed.toString())

            expect(loan_fees).to.be.closeTo(estimated_fees, delta)

        });


        it(' should update totalBorrowed, totalReserve & accruedFees correctly', async () => {

            const reserveFactor = await pool.reserveFactor()

            await pool.connect(user1).borrow(user1.address, borrow_amount, fees_amount)
            
            const old_totalReserve = await pool.totalReserve()
            const old_accruedFees = await pool.accruedFees()

            const loan_address = (await pool.getLoansPools())[0]
            const minBorrowLength = await pool.minBorrowLength()

            await mineBlocks(minBorrowLength.toNumber() + 1)

            await pool.connect(user1).closeBorrow(loan_address)

            const new_totalBorrowed = await pool.totalBorrowed()
            const new_totalReserve = await pool.totalReserve()
            const new_accruedFees = await pool.accruedFees()

            const loan_data = await pool.getBorrowData(loan_address)

            const expected_totalReserve = loan_data._feesUsed.mul(reserveFactor).div(mantissaScale)
            const expected_accruedFees = loan_data._feesUsed.mul(reserveFactor).div(mantissaScale)

            expect(+(new_totalBorrowed.toString())).to.be.closeTo(0,10) //case where 1 wei is remaining
            expect(new_totalReserve).to.be.closeTo(old_totalReserve.add(expected_totalReserve), 10)
            expect(new_accruedFees).to.be.closeTo(old_accruedFees.add(expected_accruedFees), 10)

        });


        it(' should fail if already closed', async () => {

            await pool.connect(user1).borrow(user1.address, borrow_amount, fees_amount)

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).closeBorrow(loan_address)

            await expect(
                pool.connect(user1).closeBorrow(loan_address)
            ).to.be.revertedWith('14')
            
        });


        it(' should fail if not palLoan borrower', async () => {

            await pool.connect(user1).borrow(user1.address, borrow_amount, fees_amount)

            const loan_address = (await pool.getLoansPools())[0]

            await expect(
                pool.connect(user2).closeBorrow(loan_address)
            ).to.be.revertedWith('15')
            
        });


        it(' should fail is address is not a palLoan', async () => {

            await pool.connect(user1).borrow(user1.address, borrow_amount, fees_amount)

            const loan_address = fake_loan.address

            await expect(
                pool.connect(user1).closeBorrow(loan_address)
            ).to.be.reverted
            
        });

    });

    describe('killBorrow', async () => {

        const deposit = ethers.utils.parseEther('1000')

        const borrow_amount = ethers.utils.parseEther('100')

        const fees_amount = ethers.utils.parseEther('0.004')

        const killerRatio = ethers.utils.parseEther('0.15')


        beforeEach(async () => {
            await underlying.connect(admin).transfer(user2.address, deposit)
            await underlying.connect(admin).transfer(user1.address, fees_amount)

            await underlying.connect(user1).approve(pool.address, fees_amount)
            await underlying.connect(user2).approve(pool.address, deposit)

            await pool.connect(admin).updateMinBorrowLength(100)

            await pool.connect(user2).deposit(deposit)

            await pool.connect(user1).borrow(user1.address, borrow_amount, fees_amount)
        });


        it(' should kill the Borrow and pay the killer (with the correct Event)', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            const oldBalance = await underlying.balanceOf(user2.address)

            await mineBlocks(170)

            await pool._updateInterest()
            expect(await pool.isKillable(loan_address)).to.be.true

            const kill_tx = await pool.connect(user2).killBorrow(loan_address)

            const loan_data = await pool.getBorrowData(loan_address)

            await expect(kill_tx)
            .to.emit(pool, 'CloseLoan')
            .withArgs(
                user1.address,
                user1.address,
                underlying.address,
                borrow_amount,
                pool.address,
                loan_data._feesUsed,
                loan_address,
                loan_data._palLoanTokenId,
                true
            )

            const newBalance = await underlying.balanceOf(user2.address)

            const killerFees = loan_data._feesAmount.mul(killerRatio).div(mantissaScale)

            expect(loan_data._closed).to.be.true
            expect(loan_data._closeBlock).to.be.eq(kill_tx.blockNumber)

            expect(newBalance.sub(oldBalance)).to.be.eq(killerFees)
            
        });


        it(' should update totalBorrowed, totalReserve & accruedFees correctly', async () => {

            const reserveFactor = await pool.reserveFactor()
            
            const old_totalReserve = await pool.totalReserve()
            const old_accruedFees = await pool.accruedFees()

            const loan_address = (await pool.getLoansPools())[0]

            await mineBlocks(170)

            await pool.connect(user2).killBorrow(loan_address)

            const new_totalBorrowed = await pool.totalBorrowed()
            const new_totalReserve = await pool.totalReserve()
            const new_accruedFees = await pool.accruedFees()

            const loan_data = await pool.getBorrowData(loan_address)

            const expected_totalReserve = loan_data._feesUsed.mul(reserveFactor.sub(killerRatio)).div(mantissaScale)
            const expected_accruedFees = loan_data._feesUsed.mul(reserveFactor.sub(killerRatio)).div(mantissaScale)

            expect(new_totalBorrowed).to.be.closeTo(BigNumber.from('0'),10) //case where 1 wei is remaining
            expect(new_totalReserve).to.be.closeTo(old_totalReserve.add(expected_totalReserve), 10)
            expect(new_accruedFees).to.be.closeTo(old_accruedFees.add(expected_accruedFees), 10)

        });


        it(' should burn the palLoanToken (with the correct Event)', async () => {

            const loan_address = (await pool.getLoansPools())[0]
            const loan_token_id = await pool.idOfLoan(loan_address)

            await mineBlocks(170)

            await pool._updateInterest()
            expect(await pool.isKillable(loan_address)).to.be.true

            const kill_tx = await pool.connect(user2).killBorrow(loan_address)

            await expect(kill_tx)
                .to.emit(loanToken, 'BurnLoanToken')
                .withArgs(
                    pool.address,
                    user1.address,
                    loan_address,
                    loan_token_id
                )

            expect(await pool.isLoanOwner(loan_address, user1.address)).to.be.true

            expect(await loanToken.isBurned(loan_token_id)).to.be.true

            expect(await loanToken.allLoansOfForPool(user1.address, pool.address)).to.contain(loan_address)
            
        });


        it(' should return the funds to the pool', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            const oldBalance = await underlying.balanceOf(pool.address)

            await mineBlocks(170)

            pool.connect(user2).killBorrow(loan_address)

            const loan_data = await pool.getBorrowData(loan_address)

            const newBalance = await underlying.balanceOf(pool.address)

            const killerFees = loan_data._feesAmount.mul(killerRatio).div(mantissaScale)

            const poolFees = fees_amount.sub(killerFees)

            expect(newBalance.sub(oldBalance)).to.be.eq(borrow_amount.add(poolFees))
            
        });


        it(' should set the "killed" flag in the Borrow object', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await mineBlocks(170)

            await pool.connect(user2).killBorrow(loan_address)

            const loan_data = await pool.getBorrowData(loan_address)

            expect(loan_data._killed).to.be.true;

            expect(await pool.isKillable(loan_address)).to.be.false;
            
        });


        it(' should fail if the Borrow is healthy', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await expect(
                pool.connect(user2).killBorrow(loan_address)
            ).to.be.revertedWith('18')
            
        });


        it(' should fail if borrower kills its own borrow', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await expect(
                pool.connect(user1).killBorrow(loan_address)
            ).to.be.revertedWith('16')
            
        });


        it(' should fail if already closed', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).closeBorrow(loan_address)

            await expect(
                pool.connect(user2).killBorrow(loan_address)
            ).to.be.revertedWith('14')
            
        });

    });

    describe('changeBorrowDelegatee', async () => {

        const deposit = ethers.utils.parseEther('1000')

        const borrow_amount = ethers.utils.parseEther('100')

        const fees_amount = ethers.utils.parseEther('5')

        beforeEach(async () => {
            await underlying.connect(admin).transfer(user2.address, deposit)
            await underlying.connect(admin).transfer(user1.address, fees_amount)

            await underlying.connect(user1).approve(pool.address, fees_amount)
            await underlying.connect(user2).approve(pool.address, deposit)

            await pool.connect(user2).deposit(deposit)

            await pool.connect(user1).borrow(user2.address, borrow_amount, fees_amount)
        });


        it(' should change correctly (with correct Event)', async () => {


            const loan_address = (await pool.getLoansPools())[0]

            const loan_id = await pool.idOfLoan(loan_address)

            await expect(pool.connect(user1).changeBorrowDelegatee(loan_address, user3.address))
            .to.emit(pool, 'ChangeLoanDelegatee')
            .withArgs(
                user1.address,
                user3.address,
                underlying.address,
                pool.address,
                loan_address,
                loan_id
            )
            
        });


        it(' should change deelgatee in the PalLoan', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).changeBorrowDelegatee(loan_address, user3.address)

            const loan = IPalLoan__factory.connect(loan_address, provider);

            const loan_delegatee: string = await loan.delegatee()

            expect(loan_delegatee).to.be.eq(user3.address)
            
        });


        it(' should delegate the votes to the new Delegatee', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).changeBorrowDelegatee(loan_address, user3.address)

            const delegated_votes = await underlying.getCurrentVotes(user3.address)

            expect(delegated_votes).to.be.eq(borrow_amount.add(fees_amount))
            
        });


        it(' should fail if delegatee address is address 0x0', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await expect(
                pool.connect(user1).changeBorrowDelegatee(loan_address, ethers.constants.AddressZero)
            ).to.be.revertedWith('22')
            
        });

    });

    describe('minBorrowFees', async () => {

        const deposit = ethers.utils.parseEther('1000')

        const borrow_amount = ethers.utils.parseEther('100')


        beforeEach(async () => {
            await underlying.connect(admin).transfer(user2.address, deposit)
            await underlying.connect(user2).approve(pool.address, deposit)
            await pool.connect(user2).deposit(deposit)
        });


        it(' should return the right amount', async () => {

            const pool_cash: BigNumber = await pool.underlyingBalance()
            const pool_borrowed: BigNumber = await pool.totalBorrowed()
            const pool_reserves: BigNumber = await pool.totalReserve()

            const pool_min_borrow_length: BigNumber = await pool.minBorrowLength()

            const pool_borrow_rate: BigNumber = await interest.getBorrowRate(
                pool.address,
                pool_cash.sub(borrow_amount),
                pool_borrowed.add(borrow_amount),
                pool_reserves
            )

            const estimated_borrow_fees: BigNumber = pool_min_borrow_length.mul(borrow_amount.mul(pool_borrow_rate).div(mantissaScale))
            
            const pool_min_borrow_fees = await pool.minBorrowFees(borrow_amount)

            expect(estimated_borrow_fees).to.be.eq(pool_min_borrow_fees)
            
        });


        it(' should return at least 1', async () => {

            const pool_min_borrow_fees = await pool.minBorrowFees(1)

            expect(pool_min_borrow_fees).not.to.be.null
            
        });

    });

    describe("_updateInterest", async () => {

        const deposit = ethers.utils.parseEther('1000')

        const borrow_amount = ethers.utils.parseEther('100')

        const fees_amount = ethers.utils.parseEther('5')

        const mantissaScale = ethers.utils.parseEther('1')


        beforeEach(async () => {
            await underlying.connect(admin).transfer(user2.address, deposit)
            await underlying.connect(admin).transfer(user1.address, fees_amount)

            await underlying.connect(user1).approve(pool.address, fees_amount)
            await underlying.connect(user2).approve(pool.address, deposit)

            await pool.connect(user2).deposit(deposit)

            
        });

        it(' should accrue interest correctly', async () => {

            const reserveFactor = await pool.reserveFactor()
            const killerRatio = await pool.killerRatio()

            const borrow_tx = await pool.connect(user1).borrow(user1.address, borrow_amount, fees_amount)

            const old_borrowIndex = await pool.borrowIndex()
            const old_totalBorrowed = await pool.totalBorrowed()
            const old_totalReserve = await pool.totalReserve()
            const old_accruedFees = await pool.accruedFees()

            const current_borrowRate = await pool.borrowRatePerBlock()

            await mineBlocks(100)

            const accrue_tx = await pool.connect(user1)._updateInterest()

            const new_borrowIndex = await pool.borrowIndex()
            const new_totalBorrowed = await pool.totalBorrowed()
            const new_totalReserve = await pool.totalReserve()
            const new_accruedFees = await pool.accruedFees()
            
            const block_delta = (accrue_tx.blockNumber || 0) - (borrow_tx.blockNumber || 0)

            const expected_interestFactor = current_borrowRate.mul(block_delta)
            const expected_accumulatedInterest = old_totalBorrowed.mul(expected_interestFactor).div(mantissaScale)
            const expected_accruedReserve = expected_accumulatedInterest.mul(reserveFactor).div(mantissaScale)
            const expected_accruedFees = expected_accumulatedInterest.mul(reserveFactor.sub(killerRatio)).div(mantissaScale)
            const expected_borrowIndex = old_borrowIndex.add(old_borrowIndex.mul(expected_interestFactor).div(mantissaScale))
            const expected_totalBorrowed = old_totalBorrowed.add(expected_accumulatedInterest)
            
            expect(await pool.accrualBlockNumber()).to.be.eq(accrue_tx.blockNumber)
            expect(new_borrowIndex).to.be.eq(expected_borrowIndex)
            expect(new_totalBorrowed).to.be.eq(expected_totalBorrowed)
            expect(new_totalReserve).to.be.eq(old_totalReserve.add(expected_accruedReserve))
            expect(new_accruedFees).to.be.eq(old_accruedFees.add(expected_accruedFees))

        });

    })

});