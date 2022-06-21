import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PalToken } from "../typechain/PalToken";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";

chai.use(solidity);
const { expect } = chai;

let tokenFactory: ContractFactory

describe('PalToken contract tests', () => {
    let pool: SignerWithAddress
    let admin: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress

    let token: PalToken

    let name: string = "Paladin MOCK"
    let symbol: string = "palMOCK"

    
    before( async () => {
        tokenFactory = await ethers.getContractFactory("PalToken");
    })


    beforeEach( async () => {
        [pool, admin, user1, user2] = await ethers.getSigners();

        token = (await tokenFactory.connect(admin).deploy(name, symbol)) as PalToken;
        await token.deployed();
    });


    it(' should be deployed & have correct parameters', async () => {
        expect(token.address).to.properAddress

        const tokenName = await token.name()
        const tokenSymbol = await token.symbol()
        const tokenDecimals = await token.decimals()

        expect(tokenName).to.be.eq(name)
        expect(tokenSymbol).to.be.eq(symbol)
        expect(tokenDecimals).to.be.eq(18)
    });

    describe('intitiate', async () => {

        it(' should set the correct parameters', async () => {

            await token.initiate(pool.address)

            const tokenPool = await token.palPool()

            expect(tokenPool).to.be.eq(pool.address)
        });

        it(' should not be initizable again', async () => {

            await token.initiate(pool.address)

            await expect(
                token.initiate(pool.address)
            ).to.be.reverted
        });

    });


    describe('mint', async () => {

        const amount = ethers.utils.parseEther('1000')
        
        beforeEach(async () => {
            await token.initiate(pool.address)
        });

        it(' should mint the right amount', async () => {

            let oldBalance = await token.connect(pool).balanceOf(user1.address)

            await token.connect(pool).mint(user1.address, amount)

            let newBalance = await token.connect(pool).balanceOf(user1.address)

            expect(amount).to.be.eq(newBalance.sub(oldBalance))
            
        });

        it(' should emit the correct Event', async () => {

            await expect(token.connect(pool).mint(user1.address, amount))
                .to.emit(token, 'Transfer')
                .withArgs(ethers.constants.AddressZero, user1.address, amount);
            
        });

        it(' should update the totalSupply', async () => {

            let oldSupply = await token.connect(pool).totalSupply()

            await token.connect(pool).mint(user1.address, amount)

            let newSupply = await token.connect(pool).totalSupply()

            expect(amount).to.be.eq(newSupply.sub(oldSupply))
            
        });

        it(' should not mint to 0x0 address', async () => {

            await expect(
                token.connect(pool).mint(ethers.constants.AddressZero, amount)
            ).to.be.revertedWith('ZeroAddress()')
            
        });

        it(' should block mint from non-pool transaction', async () => {

            await expect(
                token.connect(user1).mint(user1.address, amount)
            ).to.be.reverted
            
        });

    });


    describe('transfer', async () => {

        const amount = ethers.utils.parseEther('100')
        
        beforeEach(async () => {
            await token.initiate(pool.address)

            await token.connect(pool).mint(user1.address, ethers.utils.parseEther('1000'))
        });

        it(' should transfer the amount', async () => {

            let oldBalance = await token.connect(user2).balanceOf(user2.address)

            await token.connect(user1).transfer(user2.address, amount)

            let newBalance = await token.connect(user2).balanceOf(user2.address)

            expect(amount).to.be.eq(newBalance.sub(oldBalance))
            
        });

        it(' should emit the correct Event', async () => {

            await expect(token.connect(user1).transfer(user2.address, amount))
                .to.emit(token, 'Transfer')
                .withArgs(user1.address, user2.address, amount);
            
        });

        it(' should not allow transfer if balance too low', async () => {

            await expect(
                token.connect(user2).transfer(user1.address, amount)
            ).to.be.revertedWith('BalanceTooLow()')
            
        });

        it(' should block self-transfer & address(0x0) transfer', async () => {

            await expect(
                token.connect(user1).transfer(user1.address, amount)
            ).to.be.revertedWith('SelfTransfer()')

            await expect(
                token.connect(user1).transfer(ethers.constants.AddressZero, amount)
            ).to.be.revertedWith('ZeroAddress()')
            
        });

    });


    describe('approve', async () => {

        const allowance = ethers.utils.parseEther('150')
        const change_allowance = ethers.utils.parseEther('50')
        const over_allowance = ethers.utils.parseEther('200')
        
        beforeEach(async () => {
            await token.initiate(pool.address)

            await token.connect(pool).mint(user1.address, ethers.utils.parseEther('1000'))
        });

        it(' should update allowance correctly', async () => {

            await token.connect(user1).approve(user2.address, allowance)

            let newAllowance = await token.connect(user1).allowance(user1.address, user2.address)

            expect(newAllowance).to.be.eq(allowance)
            
        });

        it(' should increase allowance correctly', async () => {

            await token.connect(user1).approve(user2.address, allowance)

            let oldAllowance = await token.connect(user1).allowance(user1.address, user2.address)

            await token.connect(user1).increaseAllowance(user2.address, change_allowance)

            let newAllowance = await token.connect(user1).allowance(user1.address, user2.address)

            expect(newAllowance.sub(oldAllowance)).to.be.eq(change_allowance)
            
        });

        it(' should decrease allowance correctly', async () => {

            await token.connect(user1).approve(user2.address, allowance)

            let oldAllowance = await token.connect(user1).allowance(user1.address, user2.address)

            await token.connect(user1).decreaseAllowance(user2.address, change_allowance)

            let newAllowance = await token.connect(user1).allowance(user1.address, user2.address)

            expect(oldAllowance.sub(newAllowance)).to.be.eq(change_allowance)
            
        });

        it(' should emit the correct Event', async () => {

            await expect(token.connect(user1).approve(user2.address, allowance))
                .to.emit(token, 'Approval')
                .withArgs(user1.address, user2.address, allowance);
            
        });

        it(' should block address(0x0) approvals', async () => {

            await expect(
                token.connect(user1).approve(ethers.constants.AddressZero, allowance)
            ).to.be.revertedWith('ZeroAddress()')
            
        });
        
        it(' should fail to decrease allowance under 0', async () => {

            await token.connect(user1).approve(user2.address, allowance)

            await expect(
                token.connect(user1).decreaseAllowance(user2.address, over_allowance)
            ).to.be.revertedWith('AllowanceUnderflow()')
            
        });

    });


    describe('transferFrom', async () => {

        const amount = ethers.utils.parseEther('100')
        const allowance = ethers.utils.parseEther('150')
        
        beforeEach(async () => {
            await token.initiate(pool.address)

            await token.connect(pool).mint(user1.address, ethers.utils.parseEther('1000'))
        });

        it(' should transfer the amount', async () => {

            let oldBalance = await token.connect(user2).balanceOf(user2.address)

            await token.connect(user1).approve(user2.address, allowance)

            await token.connect(user2).transferFrom(user1.address, user2.address, amount)

            let newBalance = await token.connect(user2).balanceOf(user2.address)

            expect(amount).to.be.eq(newBalance.sub(oldBalance))
            
        });

        it(' should emit the correct Event', async () => {

            await token.connect(user1).approve(user2.address, allowance)

            await expect(token.connect(user2).transferFrom(user1.address, user2.address, amount))
                .to.emit(token, 'Transfer')
                .withArgs(user1.address, user2.address, amount);
            
        });

        it(' should update the allowance correctly', async () => {

            await token.connect(user1).approve(user2.address, allowance)

            await token.connect(user2).transferFrom(user1.address, user2.address, amount)

            let newAllowance = await token.connect(user1).allowance(user1.address, user2.address)

            expect(allowance.sub(amount)).to.be.eq(newAllowance)
            
        });

        it(' should not allow transfer if balance too low', async () => {

            await token.connect(user2).approve(user1.address, allowance)

            await expect(
                token.connect(user1).transferFrom(user2.address, user1.address, amount)
            ).to.be.revertedWith('BalanceTooLow()')
            
        });

        it(' should not allow transfer if allowance too low', async () => {

            await token.connect(user1).approve(user2.address, ethers.utils.parseEther('10'))

            await expect(
                token.connect(user2).transferFrom(user1.address, user2.address, amount)
            ).to.be.revertedWith('AllowanceTooLow()')
            
        });

        it(' should not allow transfer if no allowance', async () => {

            await expect(
                token.connect(user2).transferFrom(user1.address, user2.address, amount)
            ).to.be.revertedWith('AllowanceTooLow()')
            
        });

        it(' should block self-transfer & address(0x0) transfer', async () => {

            await token.connect(user1).approve(user1.address, allowance)

            await expect(
                token.connect(user1).transferFrom(user1.address, user1.address, amount)
            ).to.be.revertedWith('SelfTransfer()')

            await expect(
                token.connect(user1).transferFrom(user1.address, ethers.constants.AddressZero, amount)
            ).to.be.revertedWith('ZeroAddress()')
            
        });


    });


    describe('burn', async () => {

        const amount = ethers.utils.parseEther('100')
        
        beforeEach(async () => {
            await token.initiate(pool.address)

            await token.connect(pool).mint(user1.address, ethers.utils.parseEther('1000'))
        });

        it(' should burn the right amount', async () => {

            let oldBalance = await token.connect(pool).balanceOf(user1.address)

            await token.connect(pool).burn(user1.address, amount)

            let newBalance = await token.connect(pool).balanceOf(user1.address)

            expect(amount).to.be.eq(oldBalance.sub(newBalance))
            
        });

        it(' should emit the correct Event', async () => {

            await expect(token.connect(pool).burn(user1.address, amount))
                .to.emit(token, 'Transfer')
                .withArgs(user1.address, ethers.constants.AddressZero, amount);
            
        });

        it(' should update the totalSupply', async () => {

            let oldSupply = await token.connect(pool).totalSupply()

            await token.connect(pool).burn(user1.address, amount)

            let newSupply = await token.connect(pool).totalSupply()

            expect(amount).to.be.eq(oldSupply.sub(newSupply))
            
        });

        it(' should not burn if balance too low', async () => {

            await expect(
                token.connect(pool).burn(user2.address, amount)
            ).to.be.revertedWith('InsufficientBalance()')
            
        });

        it(' should not burn from 0x0 address', async () => {

            await expect(
                token.connect(pool).burn(ethers.constants.AddressZero, amount)
            ).to.be.revertedWith('ZeroAddress()')
            
        });

        it(' should block burn from non-pool transaction', async () => {

            await expect(
                token.connect(user1).burn(user1.address, amount)
            ).to.be.reverted
            
        });

    });


});