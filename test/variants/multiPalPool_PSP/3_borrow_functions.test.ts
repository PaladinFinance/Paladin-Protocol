import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PalToken } from "../../../typechain/PalToken";
import { PalLoanToken } from "../../../typechain/PalLoanToken";
import { MultiPalPoolPSP } from "../../../typechain/MultiPalPoolPSP";
import { MultiPoolController } from "../../../typechain/MultiPoolController";
import { InterestCalculator } from "../../../typechain/InterestCalculator";
import { SnapshotDelegator } from "../../../typechain/SnapshotDelegator";
import { IERC20 } from "../../../typechain/IERC20";
import { ISPSP } from "../../../typechain/ISPSP";
import { IERC20__factory } from "../../../typechain/factories/IERC20__factory";
import { ISPSP__factory } from "../../../typechain/factories/ISPSP__factory";
import { IPalLoan__factory } from "../../../typechain/factories/IPalLoan__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { getTokens } from "../../utils/getERC20";

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
let palLoanTokenFactory: ContractFactory
let controllerFactory: ContractFactory
let delegatorFactory: ContractFactory
let interestFactory: ContractFactory

const PSP_address = "0xcAfE001067cDEF266AfB7Eb5A286dCFD277f3dE5" //PSP contract on mainnet

const sPSP_1_address = "0x55A68016910A7Bcb0ed63775437e04d2bB70D570" //sPSP 1 contract on mainnet
const sPSP_3_address = "0xea02DF45f56A690071022c45c95c46E7F61d3eAb" //sPSP 3 contract on mainnet
const sPSP_4_address = "0x6b1D394Ca67fDB9C90BBd26FE692DdA4F4f53ECD" //sPSP 4 contract on mainnet

const sPSP_7_address = "0x37b1E4590638A266591a9C11d6f945fe7A1adAA7" //sPSP 7 contract on mainnet

const pool1_deposit_amount = ethers.utils.parseEther('20000')
const pool2_deposit_amount = ethers.utils.parseEther('15000')
const pool3_deposit_amount = ethers.utils.parseEther('3500')

describe('MultiPalPool - PSP : 3 - Borrows tests', () => {
    let admin: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress

    let fake_loan: SignerWithAddress

    let pool: MultiPalPoolPSP
    let token1: PalToken
    let token2: PalToken
    let token3: PalToken
    let loanToken: PalLoanToken
    let controller: MultiPoolController
    let delegator: SnapshotDelegator
    let interest: InterestCalculator
    let psp_token: IERC20

    let spsp_token1: ISPSP
    let spsp_token2: ISPSP
    let spsp_token3: ISPSP

    let name1: string = "Paladin MOCK 1"
    let symbol1: string = "palMOCK1"
    let name2: string = "Paladin MOCK 2"
    let symbol2: string = "palMOCK2"
    let name3: string = "Paladin MOCK 3"
    let symbol3: string = "palMOCK3"

    
    before( async () => {
        tokenFactory = await ethers.getContractFactory("PalToken");
        palLoanTokenFactory = await ethers.getContractFactory("PalLoanToken");
        poolFactory = await ethers.getContractFactory("MultiPalPoolPSP");
        controllerFactory = await ethers.getContractFactory("MultiPoolController");
        delegatorFactory = await ethers.getContractFactory("SnapshotDelegator");
        interestFactory = await ethers.getContractFactory("InterestCalculator");

        [admin, user1, user2, user3, fake_loan] = await ethers.getSigners();


        psp_token = IERC20__factory.connect(PSP_address, provider);

        spsp_token1 = ISPSP__factory.connect(sPSP_1_address, provider);
        spsp_token2 = ISPSP__factory.connect(sPSP_3_address, provider);
        spsp_token3 = ISPSP__factory.connect(sPSP_4_address, provider);


        const holder_amount = ethers.utils.parseEther('100000')
        const holder_address = "0x6455327f820edd69c4cd665b995e0fec679d7f9e"

        await getTokens(admin, psp_token, holder_address, admin.address, holder_amount);

        await psp_token.connect(admin).transfer(user1.address, ethers.utils.parseEther('50000'))

        await psp_token.connect(user1).approve(spsp_token1.address, pool1_deposit_amount)
        await psp_token.connect(user1).approve(spsp_token2.address, pool2_deposit_amount)
        await psp_token.connect(user1).approve(spsp_token3.address, pool3_deposit_amount)

        await spsp_token1.connect(user1).enter(pool1_deposit_amount)
        await spsp_token2.connect(user1).enter(pool2_deposit_amount)
        await spsp_token3.connect(user1).enter(pool3_deposit_amount)

        await psp_token.connect(admin).transfer(user2.address, ethers.utils.parseEther('25000'))

        await psp_token.connect(user2).approve(spsp_token1.address, ethers.utils.parseEther('12500'))
        await psp_token.connect(user2).approve(spsp_token2.address, ethers.utils.parseEther('10000'))

        await spsp_token1.connect(user2).enter(ethers.utils.parseEther('12500'))
        await spsp_token2.connect(user2).enter(ethers.utils.parseEther('10000'))
    })


    beforeEach( async () => {
        token1 = (await tokenFactory.connect(admin).deploy(name1, symbol1)) as PalToken;
        await token1.deployed();
        token2 = (await tokenFactory.connect(admin).deploy(name2, symbol2)) as PalToken;
        await token2.deployed();
        token3 = (await tokenFactory.connect(admin).deploy(name3, symbol3)) as PalToken;
        await token3.deployed();

        controller = (await controllerFactory.connect(admin).deploy()) as MultiPoolController;
        await controller.deployed();

        loanToken = (await palLoanTokenFactory.connect(admin).deploy(controller.address, "about:blank")) as PalLoanToken;
        await loanToken.deployed();

        interest = (await interestFactory.connect(admin).deploy()) as InterestCalculator;
        await interest.deployed();

        delegator = (await delegatorFactory.connect(admin).deploy()) as SnapshotDelegator;
        await delegator.deployed();

        pool = (await poolFactory.connect(admin).deploy(
            [token1.address, token2.address, token3.address],
            controller.address, 
            [spsp_token1.address,spsp_token2.address,spsp_token3.address],
            interest.address,
            delegator.address,
            loanToken.address
        )) as MultiPalPoolPSP;
        await pool.deployed();

        await token1.initiate(pool.address);
        await token2.initiate(pool.address);
        await token3.initiate(pool.address);

        await controller.addNewPool(pool.address, [token1.address, token2.address, token3.address]);
    });



    describe('borrow', async () => {

        const deposit = ethers.utils.parseEther('100')

        const borrow_amount = ethers.utils.parseEther('10')

        const fees_amount = ethers.utils.parseEther('0.5')

        beforeEach(async () => {
            await spsp_token1.connect(user1).approve(pool.address, fees_amount)
            await spsp_token1.connect(user2).approve(pool.address, deposit)

            await pool.connect(user2).deposit(spsp_token1.address, deposit)
        });


        it(' should execute correctly (with correct Event)', async () => {

            const borrow_count_before = await pool.numberActiveLoans()

            const borrow_call = pool.connect(user1).borrow(spsp_token1.address, user2.address, borrow_amount, fees_amount)

            await borrow_call

            const new_loan_address = (await pool.getLoansPools())[0]

            await expect(borrow_call)
            .to.emit(pool, 'NewLoan')
            .withArgs(
                user1.address,
                user2.address,
                spsp_token1.address,
                borrow_amount,
                pool.address,
                new_loan_address,
                0,
                (await borrow_call).blockNumber
            )

            const poolState1 = await pool.poolStates(spsp_token1.address)

            const pool_totalBorrowed = poolState1.totalBorrowed

            const borrow_count_after = poolState1.numberActiveLoans

            expect(pool_totalBorrowed).to.be.eq(borrow_amount)
            expect(borrow_count_before.add(1)).to.be.eq(borrow_count_after)
            
        });


        it(' should mint the palLoanToken (with the correct Event & correct data)', async () => {

            const borrow_call = await pool.connect(user1).borrow(spsp_token1.address, user2.address, borrow_amount, fees_amount)

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

            await pool.connect(user1).borrow(spsp_token1.address, user2.address, borrow_amount, fees_amount)

            const new_loan_address = (await pool.getLoansPools())[0]

            expect(await pool.isLoanOwner(new_loan_address, user1.address)).to.be.true

            await loanToken.connect(user1).transferFrom(user1.address, user2.address, 0)

            expect(await pool.isLoanOwner(new_loan_address, user1.address)).to.be.false
            expect(await pool.isLoanOwner(new_loan_address, user2.address)).to.be.true
            
        });


        it(' should deploy a palLoan with the correct parameters', async () => {

            await pool.connect(user1).borrow(spsp_token1.address, user2.address, borrow_amount, fees_amount)

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
            expect(loan_underlying).to.be.eq(spsp_token1.address)
            expect(loan_borrower).to.be.eq(user1.address)
            expect(loan_delegatee).to.be.eq(user2.address)
            expect(loan_borrowAmount).to.be.eq(borrow_amount)
            expect(loan_feesAmount).to.be.eq(fees_amount)

            const loan_balance = await spsp_token1.balanceOf(new_loan_address)

            expect(loan_balance).to.be.eq(borrow_amount.add(fees_amount))
            
        });


        it(' should create the Borrow object, with correct values', async () => {

            const borrow_tx = await pool.connect(user1).borrow(spsp_token1.address, user2.address, borrow_amount, fees_amount)

            const new_loan_address = (await pool.getLoansPools())[0]

            const borrower_loans = await pool.getLoansByBorrower(user1.address)

            expect(new_loan_address).to.be.eq(borrower_loans[0])

            const loan_data = await pool.getBorrowData(new_loan_address)

            expect(loan_data._borrower).to.be.eq(user1.address)
            expect(loan_data._delegatee).to.be.eq(user2.address)
            expect(loan_data._loan).to.be.eq(new_loan_address)
            expect(loan_data._amount).to.be.eq(borrow_amount)
            expect(loan_data._underlying).to.be.eq(spsp_token1.address)
            expect(loan_data._feesAmount).to.be.eq(fees_amount)
            expect(loan_data._feesUsed).to.be.eq(0)
            expect(loan_data._startBlock).to.be.eq(borrow_tx.blockNumber)
            expect(loan_data._closeBlock).to.be.eq(0)
            expect(loan_data._closed).to.be.false

        });


        it(' should allow borrower to also be delegatee', async () => {

            await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)

            const new_loan_address = (await pool.getLoansPools())[0]

            const loan_data = await pool.getBorrowData(new_loan_address)

            expect(loan_data._delegatee).to.be.eq(loan_data._borrower)
            expect(loan_data._delegatee).to.be.eq(user1.address)
            
        });


        it(' should fail if underlying to borrow not listed', async () => {

            const spsp_token7 = ISPSP__factory.connect(sPSP_7_address, provider);

            await expect(
                pool.connect(user2).borrow(spsp_token7.address, user1.address, borrow_amount, fees_amount)
            ).to.be.revertedWith('36')
            
        });


        it(' should fail if not enough cash in the pool', async () => {

            await expect(
                pool.connect(user2).borrow(spsp_token1.address, user1.address, ethers.utils.parseEther('5000'), fees_amount)
            ).to.be.revertedWith('9')
            
        });


        it(' should fail if delegatee address is address 0x0', async () => {

            await expect(
                pool.connect(user1).borrow(spsp_token1.address, ethers.constants.AddressZero, borrow_amount, fees_amount)
            ).to.be.revertedWith('22')
            
        });


        it(' should fail if not enough fees', async () => {

            await expect(
                pool.connect(user2).borrow(spsp_token1.address, user1.address, borrow_amount, ethers.utils.parseEther('0.001'))
            ).to.be.revertedWith('23')
            
        });


        it(' should fail if balance too low to pay for fees', async () => {

            await expect(
                pool.connect(user3).borrow(spsp_token1.address, user2.address, borrow_amount, fees_amount)
            ).to.be.reverted
            
        });


        it(' should fail if amount is 0', async () => {

            await expect(
                pool.connect(user1).borrow(spsp_token1.address, user2.address, 0, fees_amount)
            ).to.be.revertedWith('27')
            
        });


        it(' should fail if no fees provided', async () => {

            await expect(
                pool.connect(user1).borrow(spsp_token1.address, user2.address, 1, 0)
            ).to.be.revertedWith('23')
            
        });

    });


    describe('expandBorrow', async () => {

        const deposit = ethers.utils.parseEther('100')

        const borrow_amount = ethers.utils.parseEther('10')

        const fees_amount = ethers.utils.parseEther('0.5')

        const expand_fees_amount = ethers.utils.parseEther('0.2')


        beforeEach(async () => {

            await spsp_token1.connect(user1).approve(pool.address, fees_amount.add(expand_fees_amount))
            await spsp_token1.connect(user2).approve(pool.address, deposit)

            await pool.connect(user2).deposit(spsp_token1.address, deposit)

            await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)
        });
        

        it(' should expand the Borrow (with the correct Event)', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            const loan_id = await pool.idOfLoan(loan_address)

            await expect(pool.connect(user1).expandBorrow(loan_address, expand_fees_amount))
            .to.emit(pool, 'ExpandLoan')
            .withArgs(
                user1.address,
                user1.address,
                spsp_token1.address,
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
                pool.connect(user3).expandBorrow(loan_address, fees_amount)
            ).to.be.reverted
            
        });

    });

    describe('closeBorrow', async () => {

        const deposit = ethers.utils.parseEther('100')

        const borrow_amount = ethers.utils.parseEther('10')

        const fees_amount = ethers.utils.parseEther('0.5')


        const mineBlocks = async (n: number): Promise<any> => {
            for(let i = 0; i < n; i++){
                await ethers.provider.send("evm_mine", [])
            }
            return Promise.resolve()
        }


        beforeEach(async () => {

            await spsp_token1.connect(user1).approve(pool.address, fees_amount)
            await spsp_token1.connect(user2).approve(pool.address, deposit)

            await pool.connect(admin).updateMinBorrowLength(100)

            await pool.connect(user2).deposit(spsp_token1.address, deposit)
        });


        it(' should close the Borrow (with the correct Event)', async () => {

            await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)

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
                spsp_token1.address,
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

            await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)

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

            await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)

            const loan_address = (await pool.getLoansPools())[0]
            const minBorrowLength = await pool.minBorrowLength()

            const old_borrower_balance = await spsp_token1.balanceOf(user1.address)

            await mineBlocks(minBorrowLength.toNumber() + 1)
            
            await pool.connect(user1).closeBorrow(loan_address)

            const loan_data = await pool.getBorrowData(loan_address)

            const palLoan_balance = await spsp_token1.balanceOf(loan_address)
            const new_borrower_balance = await spsp_token1.balanceOf(user1.address)

            expect(palLoan_balance).to.be.eq(0)
            expect(new_borrower_balance.sub(old_borrower_balance)).to.be.eq(fees_amount.sub(loan_data._feesUsed))

        });


        it(' should take penalty fees if the loan is closed before the minimum time period', async () => {

            const estimated_fees: number = +((await pool.minBorrowFees(spsp_token1.address, borrow_amount)).toString())

            await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).closeBorrow(loan_address)

            const loan_data = await pool.getBorrowData(loan_address)

            const delta: number = 1e11

            const loan_fees: number = +(loan_data._feesUsed.toString())

            expect(loan_fees).to.be.closeTo(estimated_fees, delta)

        });


        it(' should update numberActiveLoans, totalBorrowed, totalReserve & accruedFees correctly', async () => {

            const reserveFactor = await pool.reserveFactor()

            await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)
            
            const old_totalReserve = await (await pool.poolStates(spsp_token1.address)).totalReserve
            const old_accruedFees = await (await pool.poolStates(spsp_token1.address)).accruedFees
            const old_numberActiveLoans = await (await pool.poolStates(spsp_token1.address)).numberActiveLoans

            const global_borrow_count_before = await pool.numberActiveLoans()

            const loan_address = (await pool.getLoansPools())[0]
            const minBorrowLength = await pool.minBorrowLength()

            await mineBlocks(minBorrowLength.toNumber() + 1)

            await pool.connect(user1).closeBorrow(loan_address)

            const new_totalBorrowed = await (await pool.poolStates(spsp_token1.address)).totalBorrowed
            const new_totalReserve = await (await pool.poolStates(spsp_token1.address)).totalReserve
            const new_accruedFees = await (await pool.poolStates(spsp_token1.address)).accruedFees
            const new_numberActiveLoans = await (await pool.poolStates(spsp_token1.address)).numberActiveLoans

            const global_borrow_count_after = await pool.numberActiveLoans()

            const loan_data = await pool.getBorrowData(loan_address)

            const expected_totalReserve = loan_data._feesUsed.mul(reserveFactor).div(mantissaScale)
            const expected_accruedFees = loan_data._feesUsed.mul(reserveFactor).div(mantissaScale)

            expect(+(new_totalBorrowed.toString())).to.be.closeTo(0,10) //case where 1 wei is remaining
            expect(new_totalReserve).to.be.closeTo(old_totalReserve.add(expected_totalReserve), 10)
            expect(new_accruedFees).to.be.closeTo(old_accruedFees.add(expected_accruedFees), 10)
            expect(new_numberActiveLoans).to.be.eq(old_numberActiveLoans.sub(1))
            expect(global_borrow_count_after).to.be.eq(global_borrow_count_before.sub(1))

        });


        it(' should fail if already closed', async () => {

            await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).closeBorrow(loan_address)

            await expect(
                pool.connect(user1).closeBorrow(loan_address)
            ).to.be.revertedWith('14')
            
        });


        it(' should fail if not palLoan borrower', async () => {

            await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)

            const loan_address = (await pool.getLoansPools())[0]

            await expect(
                pool.connect(user2).closeBorrow(loan_address)
            ).to.be.revertedWith('15')
            
        });


        it(' should fail is address is not a palLoan', async () => {

            await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)

            const loan_address = fake_loan.address

            await expect(
                pool.connect(user1).closeBorrow(loan_address)
            ).to.be.reverted
            
        });

    });

    describe('killBorrow', async () => {

        const deposit = ethers.utils.parseEther('100')

        const borrow_amount = ethers.utils.parseEther('10')

        const fees_amount = ethers.utils.parseEther('0.0004')

        const killerRatio = ethers.utils.parseEther('0.1')


        beforeEach(async () => {
            await spsp_token1.connect(user1).approve(pool.address, fees_amount)
            await spsp_token1.connect(user2).approve(pool.address, deposit)

            await pool.connect(admin).updateMinBorrowLength(100)

            await pool.connect(user2).deposit(spsp_token1.address, deposit)

            await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)
        });


        it(' should kill the Borrow and pay the killer (with the correct Event)', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            const oldBalance = await spsp_token1.balanceOf(user2.address)

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
                spsp_token1.address,
                borrow_amount,
                pool.address,
                loan_data._feesUsed,
                loan_address,
                loan_data._palLoanTokenId,
                true
            )

            const newBalance = await spsp_token1.balanceOf(user2.address)

            const killerFees = loan_data._feesAmount.mul(killerRatio).div(mantissaScale)

            expect(loan_data._closed).to.be.true
            expect(loan_data._closeBlock).to.be.eq(kill_tx.blockNumber)

            expect(newBalance.sub(oldBalance)).to.be.eq(killerFees)
            
        });


        it(' should update numberActiveLoans, totalBorrowed, totalReserve & accruedFees correctly', async () => {

            const reserveFactor = await pool.reserveFactor()
            
            const old_totalReserve = await (await pool.poolStates(spsp_token1.address)).totalReserve
            const old_accruedFees = await (await pool.poolStates(spsp_token1.address)).accruedFees
            const old_numberActiveLoans = await (await pool.poolStates(spsp_token1.address)).numberActiveLoans

            const global_borrow_count_before = await pool.numberActiveLoans()

            const loan_address = (await pool.getLoansPools())[0]

            await mineBlocks(170)

            await pool.connect(user2).killBorrow(loan_address)

            const new_totalBorrowed = await (await pool.poolStates(spsp_token1.address)).totalBorrowed
            const new_totalReserve = await (await pool.poolStates(spsp_token1.address)).totalReserve
            const new_accruedFees = await (await pool.poolStates(spsp_token1.address)).accruedFees
            const new_numberActiveLoans = await (await pool.poolStates(spsp_token1.address)).numberActiveLoans

            const global_borrow_count_after = await pool.numberActiveLoans()

            const loan_data = await pool.getBorrowData(loan_address)

            const expected_totalReserve = loan_data._feesUsed.mul(reserveFactor.sub(killerRatio)).div(mantissaScale)
            const expected_accruedFees = loan_data._feesUsed.mul(reserveFactor.sub(killerRatio)).div(mantissaScale)

            expect(+(new_totalBorrowed.toString())).to.be.closeTo(0,10) //case where 1 wei is remaining
            expect(new_totalReserve).to.be.closeTo(old_totalReserve.add(expected_totalReserve), 10)
            expect(new_accruedFees).to.be.closeTo(old_accruedFees.add(expected_accruedFees), 10)
            expect(new_numberActiveLoans).to.be.eq(old_numberActiveLoans.sub(1))
            expect(global_borrow_count_after).to.be.eq(global_borrow_count_before.sub(1))

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

            const oldBalance = await spsp_token1.balanceOf(pool.address)

            await mineBlocks(170)

            pool.connect(user2).killBorrow(loan_address)

            const loan_data = await pool.getBorrowData(loan_address)

            const newBalance = await spsp_token1.balanceOf(pool.address)

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

        const deposit = ethers.utils.parseEther('100')

        const borrow_amount = ethers.utils.parseEther('10')

        const fees_amount = ethers.utils.parseEther('0.5')

        beforeEach(async () => {

            await spsp_token1.connect(user1).approve(pool.address, fees_amount)
            await spsp_token1.connect(user2).approve(pool.address, deposit)

            await pool.connect(user2).deposit(spsp_token1.address, deposit)

            await pool.connect(user1).borrow(spsp_token1.address, user2.address, borrow_amount, fees_amount)
        });


        it(' should change correctly (with correct Event)', async () => {


            const loan_address = (await pool.getLoansPools())[0]

            const loan_id = await pool.idOfLoan(loan_address)

            await expect(pool.connect(user1).changeBorrowDelegatee(loan_address, user3.address))
            .to.emit(pool, 'ChangeLoanDelegatee')
            .withArgs(
                user1.address,
                user3.address,
                spsp_token1.address,
                pool.address,
                loan_address,
                loan_id
            )
            
        });


        it(' should change delegatee in the PalLoan', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await pool.connect(user1).changeBorrowDelegatee(loan_address, user3.address)

            const loan = IPalLoan__factory.connect(loan_address, provider);

            const loan_delegatee: string = await loan.delegatee()

            expect(loan_delegatee).to.be.eq(user3.address)
            
        });


        it(' should fail if delegatee address is address 0x0', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await expect(
                pool.connect(user1).changeBorrowDelegatee(loan_address, ethers.constants.AddressZero)
            ).to.be.revertedWith('22')
            
        });


        it(' should fail if not borrower calling', async () => {

            const loan_address = (await pool.getLoansPools())[0]

            await expect(
                pool.connect(user3).changeBorrowDelegatee(loan_address, user3.address)
            ).to.be.revertedWith('15')
            
        });

    });

    describe('minBorrowFees', async () => {

        const deposit = ethers.utils.parseEther('1000')

        const borrow_amount = ethers.utils.parseEther('100')


        beforeEach(async () => {
            await spsp_token1.connect(user2).approve(pool.address, deposit)
            await pool.connect(user2).deposit(spsp_token1.address, deposit)
        });


        it(' should return the right amount', async () => {

            const pool_cash: BigNumber = await pool['underlyingBalance()']()
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
            
            const pool_min_borrow_fees = await pool.minBorrowFees(spsp_token1.address, borrow_amount)

            expect(estimated_borrow_fees).to.be.eq(pool_min_borrow_fees)
            
        });


        it(' should return at least 1', async () => {

            const pool_min_borrow_fees = await pool.minBorrowFees(spsp_token1.address, 1)

            expect(pool_min_borrow_fees).not.to.be.null
            
        });

    });

    describe("_updateInterest", async () => {

        const deposit = ethers.utils.parseEther('100')
        const deposit2 = ethers.utils.parseEther('150')

        const borrow_amount = ethers.utils.parseEther('10')

        const fees_amount = ethers.utils.parseEther('0.5')

        const borrow_amount2 = ethers.utils.parseEther('12')

        const mantissaScale = ethers.utils.parseEther('1')


        beforeEach(async () => {

            await spsp_token1.connect(user1).approve(pool.address, fees_amount)
            await spsp_token1.connect(user2).approve(pool.address, deposit)

            await pool.connect(user2).deposit(spsp_token1.address, deposit)

            await spsp_token2.connect(user2).approve(pool.address, fees_amount)
            await spsp_token2.connect(user1).approve(pool.address, deposit2)

            await pool.connect(user1).deposit(spsp_token2.address, deposit2)

            
        });

        it(' should accrue interest correctly', async () => {

            const reserveFactor = await pool.reserveFactor()
            const killerRatio = await pool.killerRatio()

            const borrow_tx = await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)

            const old_borrowIndex = await pool.borrowIndex()
            const old_totalBorrowed = await pool.totalBorrowed()
            const old_totalReserve = await pool.totalReserve()
            const old_accruedFees = await pool.accruedFees()

            const old_poolState1 = await pool.poolStates(spsp_token1.address)

            const current_borrowRate = await pool.borrowRatePerBlock()

            await mineBlocks(100)

            const accrue_tx = await pool.connect(user1)._updateInterest()

            const new_borrowIndex = await pool.borrowIndex()
            const new_totalBorrowed = await pool.totalBorrowed()
            const new_totalReserve = await pool.totalReserve()
            const new_accruedFees = await pool.accruedFees()

            const new_poolState1 = await pool.poolStates(spsp_token1.address)
            const new_poolState2 = await pool.poolStates(spsp_token2.address)
            const new_poolState3 = await pool.poolStates(spsp_token3.address)
            
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

            // + do the check for the current underlying borrowed
            const expected_accumulatedInterest_underlying1 = old_totalBorrowed.mul(expected_interestFactor).div(mantissaScale)
            const expected_accruedReserve_underlying1 = expected_accumulatedInterest_underlying1.mul(reserveFactor).div(mantissaScale)
            const expected_accruedFees_underlying1 = expected_accumulatedInterest_underlying1.mul(reserveFactor.sub(killerRatio)).div(mantissaScale)
            const expected_totalBorrowed_underlying1 = old_totalBorrowed.add(expected_accumulatedInterest_underlying1)
            
            expect(new_poolState1.totalBorrowed).to.be.eq(expected_totalBorrowed_underlying1)
            expect(new_poolState1.totalReserve).to.be.eq(old_poolState1.totalReserve.add(expected_accruedReserve_underlying1))
            expect(new_poolState1.accruedFees).to.be.eq(old_poolState1.accruedFees.add(expected_accruedFees_underlying1))

            // + check that other underlying did not change
            expect(new_poolState2.totalBorrowed).to.be.eq(0)
            expect(new_poolState2.totalReserve).to.be.eq(0)
            expect(new_poolState2.accruedFees).to.be.eq(0)

            expect(new_poolState3.totalBorrowed).to.be.eq(0)
            expect(new_poolState3.totalReserve).to.be.eq(0)
            expect(new_poolState3.accruedFees).to.be.eq(0)

        });


        it(' should accrue interest correctly with 2 underlying borrowed', async () => {

            const reserveFactor = await pool.reserveFactor()
            const killerRatio = await pool.killerRatio()

            await pool.connect(user2).borrow(spsp_token2.address, user2.address, borrow_amount2, fees_amount)

            const borrow_tx = await pool.connect(user1).borrow(spsp_token1.address, user1.address, borrow_amount, fees_amount)

            const old_borrowIndex = await pool.borrowIndex()
            const old_totalBorrowed = await pool.totalBorrowed()
            const old_totalReserve = await pool.totalReserve()
            const old_accruedFees = await pool.accruedFees()

            const old_poolState1 = await pool.poolStates(spsp_token1.address)
            const old_poolState2 = await pool.poolStates(spsp_token2.address)

            const current_borrowRate = await pool.borrowRatePerBlock()

            await mineBlocks(125)

            const accrue_tx = await pool.connect(user1)._updateInterest()

            const new_borrowIndex = await pool.borrowIndex()
            const new_totalBorrowed = await pool.totalBorrowed()
            const new_totalReserve = await pool.totalReserve()
            const new_accruedFees = await pool.accruedFees()

            const new_poolState1 = await pool.poolStates(spsp_token1.address)
            const new_poolState2 = await pool.poolStates(spsp_token2.address)
            const new_poolState3 = await pool.poolStates(spsp_token3.address)
            
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

            // + do the check for the current underlying borrowed
            const expected_accumulatedInterest_underlying1 = old_poolState1.totalBorrowed.mul(expected_interestFactor).div(mantissaScale)
            const expected_accruedReserve_underlying1 = expected_accumulatedInterest_underlying1.mul(reserveFactor).div(mantissaScale)
            const expected_accruedFees_underlying1 = expected_accumulatedInterest_underlying1.mul(reserveFactor.sub(killerRatio)).div(mantissaScale)
            const expected_totalBorrowed_underlying1 = old_poolState1.totalBorrowed.add(expected_accumulatedInterest_underlying1)
            
            expect(new_poolState1.totalBorrowed).to.be.eq(expected_totalBorrowed_underlying1)
            expect(new_poolState1.totalReserve).to.be.eq(old_poolState1.totalReserve.add(expected_accruedReserve_underlying1))
            expect(new_poolState1.accruedFees).to.be.eq(old_poolState1.accruedFees.add(expected_accruedFees_underlying1))

            // + for the other borrowed underlying
            const expected_accumulatedInterest_underlying2 = old_poolState2.totalBorrowed.mul(expected_interestFactor).div(mantissaScale)
            const expected_accruedReserve_underlying2 = expected_accumulatedInterest_underlying2.mul(reserveFactor).div(mantissaScale)
            const expected_accruedFees_underlying2 = expected_accumulatedInterest_underlying2.mul(reserveFactor.sub(killerRatio)).div(mantissaScale)
            const expected_totalBorrowed_underlying2 = old_poolState2.totalBorrowed.add(expected_accumulatedInterest_underlying2)
            
            expect(new_poolState2.totalBorrowed).to.be.eq(expected_totalBorrowed_underlying2)
            expect(new_poolState2.totalReserve).to.be.eq(old_poolState2.totalReserve.add(expected_accruedReserve_underlying2))
            expect(new_poolState2.accruedFees).to.be.eq(old_poolState2.accruedFees.add(expected_accruedFees_underlying2))

            // + check that other underlying did not change
            expect(new_poolState3.totalBorrowed).to.be.eq(0)
            expect(new_poolState3.totalReserve).to.be.eq(0)
            expect(new_poolState3.accruedFees).to.be.eq(0)

        });

    })

});