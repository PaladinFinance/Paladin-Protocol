import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PalToken } from "../../typechain/PalToken";
import { PalPool } from "../../typechain/PalPool";
import { PalLoan } from "../../typechain/PalLoan";
import { PaladinController } from "../../typechain/PaladinController";
import { InterestCalculator } from "../../typechain/InterestCalculator";
import { Comp } from "../../typechain/Comp";
import { BasicDelegator } from "../../typechain/BasicDelegator";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";

chai.use(solidity);
const { expect } = chai;

const mantissaScale = ethers.utils.parseEther('1')

let poolFactory: ContractFactory
let tokenFactory: ContractFactory
let controllerFactory: ContractFactory
let delegatorFactory: ContractFactory
let interestFactory: ContractFactory
let erc20Factory: ContractFactory
let loanFactory: ContractFactory

describe('PalPool : 3 - Borrows tests', () => {
    let admin: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let fake_loan: SignerWithAddress

    let pool: PalPool
    let token: PalToken
    let controller: PaladinController
    let delegator: BasicDelegator
    let interest: InterestCalculator
    let underlying: Comp

    let name: string = "Paladin MOCK"
    let symbol: string = "palMOCK"

    
    before( async () => {
        tokenFactory = await ethers.getContractFactory("PalToken");
        poolFactory = await ethers.getContractFactory("PalPool");
        controllerFactory = await ethers.getContractFactory("PaladinController");
        delegatorFactory = await ethers.getContractFactory("BasicDelegator");
        interestFactory = await ethers.getContractFactory("InterestCalculator");
        erc20Factory = await ethers.getContractFactory("Comp");
        loanFactory = await ethers.getContractFactory("PalLoan");
    })


    beforeEach( async () => {
        [admin, user1, user2, fake_loan] = await ethers.getSigners();

        token = (await tokenFactory.connect(admin).deploy(name, symbol)) as PalToken;
        await token.deployed();

        underlying = (await erc20Factory.connect(admin).deploy(admin.address)) as Comp;
        await underlying.deployed();

        controller = (await controllerFactory.connect(admin).deploy()) as PaladinController;
        await controller.deployed();

        interest = (await interestFactory.connect(admin).deploy()) as InterestCalculator;
        await interest.deployed();

        delegator = (await delegatorFactory.connect(admin).deploy()) as BasicDelegator;
        await delegator.deployed();

        pool = (await poolFactory.connect(admin).deploy(
            token.address,
            controller.address, 
            underlying.address,
            interest.address,
            delegator.address
        )) as PalPool;
        await pool.deployed();

        await token.initiate(pool.address);

        await controller.addNewPalToken(token.address, pool.address);
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

            const borrow_call = pool.connect(user1).borrow(borrow_amount, fees_amount)

            await borrow_call

            const new_loan_address = (await pool.getLoansPools())[0]

            await expect(borrow_call)
            .to.emit(pool, 'NewLoan')
            .withArgs(
                user1.address,
                underlying.address,
                borrow_amount,
                pool.address,
                new_loan_address,
                (await borrow_call).blockNumber
            )

            const pool_totalBorrowed = await pool.totalBorrowed()

            expect(pool_totalBorrowed).to.be.eq(borrow_amount)
            
        });


        it(' should deploy a palLoan with the correct parameters', async () => {

            await pool.connect(user1).borrow(borrow_amount, fees_amount)

            const new_loan_address = (await pool.getLoansPools())[0]

            expect(new_loan_address).to.properAddress

            const loan = loanFactory.attach(new_loan_address)

            const loan_pool: string = await loan.motherPool()
            const loan_underlying: string = await loan.underlying()
            const loan_borrower: string = await loan.borrower()
            const loan_delegator: string = await loan.delegator()
            const loan_borrowAmount: BigNumber = await loan.amount()
            const loan_feesAmount: BigNumber = await loan.feesAmount()

            expect(loan_pool).to.be.eq(pool.address)
            expect(loan_underlying).to.be.eq(underlying.address)
            expect(loan_borrower).to.be.eq(user1.address)
            expect(loan_delegator).to.be.eq(delegator.address)
            expect(loan_borrowAmount).to.be.eq(borrow_amount)
            expect(loan_feesAmount).to.be.eq(fees_amount)

            const loan_balance = await underlying.balanceOf(new_loan_address)

            expect(loan_balance).to.be.eq(borrow_amount.add(fees_amount))
            
        });


        it(' should create the Borrow object, with correct values', async () => {

            const borrow_tx = await pool.connect(user1).borrow(borrow_amount, fees_amount)

            const new_loan_address = (await pool.getLoansPools())[0]

            const borrower_loans = await pool.getLoansByBorrower(user1.address)

            expect(new_loan_address).to.be.eq(borrower_loans[0])

            const loan_data = await pool.getBorrowDataStored(new_loan_address)

            expect(loan_data._borrower).to.be.eq(user1.address)
            expect(loan_data._loan).to.be.eq(new_loan_address)
            expect(loan_data._amount).to.be.eq(borrow_amount)
            expect(loan_data._underlying).to.be.eq(underlying.address)
            expect(loan_data._feesAmount).to.be.eq(fees_amount)
            expect(loan_data._feesUsed).to.be.eq(0)
            expect(loan_data._startBlock).to.be.eq(borrow_tx.blockNumber)
            expect(loan_data._closed).to.be.false

        });


        it(' should delegate the votes correctly', async () => {

            await pool.connect(user1).borrow(borrow_amount, fees_amount)

            const delegated_votes = await underlying.getCurrentVotes(user1.address)

            expect(delegated_votes).to.be.eq(borrow_amount.add(fees_amount))
            
        });


        it(' should fail if not enough cash in the pool', async () => {

            await expect(
                pool.connect(user2).borrow(ethers.utils.parseEther('5000'), fees_amount)
            ).to.be.revertedWith('9')
            
        });


        it(' should fail if not enough fees', async () => {

            await expect(
                pool.connect(user2).borrow(borrow_amount, ethers.utils.parseEther('0.001'))
            ).to.be.revertedWith('23')
            
        });


        it(' should fail if balance too low to pay for fees', async () => {

            await expect(
                pool.connect(user2).borrow(borrow_amount, fees_amount)
            ).to.be.reverted
            
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

            await pool.connect(user1).borrow(borrow_amount, fees_amount)
        });
        

        it(' should expand the Borrow (with the correct Event)', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await expect(pool.connect(user1).expandBorrow(loan_address, expand_fees_amount))
            .to.emit(pool, 'ExpandLoan')
            .withArgs(
                user1.address,
                underlying.address,
                pool.address,
                fees_amount.add(expand_fees_amount),
                loan_address
            )
            
        });


        it(' should update the Borrow data parameter', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).expandBorrow(loan_address, expand_fees_amount)

            const loan_data = await pool.getBorrowDataStored(loan_address)

            expect(loan_data._borrower).to.be.eq(user1.address)
            expect(loan_data._feesAmount).to.be.eq(fees_amount.add(expand_fees_amount))
            
        });


        it(' should update the palLoan parameter', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).expandBorrow(loan_address, expand_fees_amount)

            const loan = loanFactory.attach(loan_address)

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

            await pool.connect(user1).borrow(borrow_amount, fees_amount)
        });


        it(' should close the Borrow (with the correct Event)', async () => {

            const loan_address = (await pool.getLoansPools())[0]
            const minBorrowLength = await pool.minBorrowLength()

            await mineBlocks(minBorrowLength.toNumber() + 1)

            const close_tx = pool.connect(user1).closeBorrow(loan_address)

            await close_tx

            const loan_data = await pool.getBorrowDataStored(loan_address)

            await expect(close_tx)
            .to.emit(pool, 'CloseLoan')
            .withArgs(
                user1.address,
                underlying.address,
                borrow_amount,
                pool.address,
                loan_data._feesUsed,
                loan_address,
                false
            )

            expect(loan_data._closed).to.be.true
            expect(loan_data._feesUsed).not.to.be.eq(0)
            
        });


        it(' should empty the palLoan balance & return the unused fees to the borrower', async () => {

            const loan_address = (await pool.getLoansPools())[0]
            const minBorrowLength = await pool.minBorrowLength()

            const old_borrower_balance = await underlying.balanceOf(user1.address)

            await mineBlocks(minBorrowLength.toNumber() + 1)
            
            await pool.connect(user1).closeBorrow(loan_address)

            const loan_data = await pool.getBorrowDataStored(loan_address)

            const palLoan_balance = await underlying.balanceOf(loan_address)
            const new_borrower_balance = await underlying.balanceOf(user1.address)

            expect(palLoan_balance).to.be.eq(0)
            expect(new_borrower_balance.sub(old_borrower_balance)).to.be.eq(fees_amount.sub(loan_data._feesUsed))

        });


        it(' should take penalty fees if the loan is closed before the minimum time period', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            const estimated_fees: number = +((await pool.minBorrowFees(borrow_amount)).toString())

            await pool.connect(user1).closeBorrow(loan_address)

            const loan_data = await pool.getBorrowDataStored(loan_address)

            const delta: number = 1e11

            const loan_fees: number = +(loan_data._feesUsed.toString())

            expect(loan_fees).to.be.closeTo(estimated_fees, delta)

        });


        it(' should fail if already closed', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).closeBorrow(loan_address)

            await expect(
                pool.connect(user1).closeBorrow(loan_address)
            ).to.be.revertedWith('14')
            
        });


        it(' should fail if not palLoan borrower', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await expect(
                pool.connect(user2).closeBorrow(loan_address)
            ).to.be.revertedWith('15')
            
        });


        it(' should fail is address is not a palLoan', async () => {

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

            await pool.connect(user1).borrow(borrow_amount, fees_amount)
        });


        it(' should kill the Borrow and pay the killer', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            const oldBalance = await underlying.balanceOf(user2.address)

            await mineBlocks(170)

            await pool._updateInterest()
            expect(await pool.isKillable(loan_address)).to.be.true

            const kill_tx = await pool.connect(user2).killBorrow(loan_address)

            const loan_data = await pool.getBorrowDataStored(loan_address)

            await expect(kill_tx)
            .to.emit(pool, 'CloseLoan')
            .withArgs(
                user1.address,
                underlying.address,
                borrow_amount,
                pool.address,
                loan_data._feesUsed,
                loan_address,
                true
            )

            const newBalance = await underlying.balanceOf(user2.address)

            const killerFees = loan_data._feesAmount.mul(killerRatio).div(mantissaScale)

            expect(loan_data._closed).to.be.true

            expect(newBalance.sub(oldBalance)).to.be.eq(killerFees)
            
        });


        it(' should return the funds to the pool', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            const oldBalance = await underlying.balanceOf(pool.address)

            await mineBlocks(170)

            pool.connect(user2).killBorrow(loan_address)

            const loan_data = await pool.getBorrowDataStored(loan_address)

            const newBalance = await underlying.balanceOf(pool.address)

            const killerFees = loan_data._feesAmount.mul(killerRatio).div(mantissaScale)

            const poolFees = fees_amount.sub(killerFees)

            expect(newBalance.sub(oldBalance)).to.be.eq(borrow_amount.add(poolFees))
            
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

});