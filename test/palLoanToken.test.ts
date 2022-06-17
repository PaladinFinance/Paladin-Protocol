import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PalLoanToken } from "../typechain/PalLoanToken";
import { BurnedPalLoanToken } from "../typechain/BurnedPalLoanToken";
import { PaladinController } from "../typechain/PaladinController";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";

chai.use(solidity);
const { expect } = chai;

let tokenFactory: ContractFactory
let burnedTokenFactory: ContractFactory
let controllerFactory: ContractFactory

describe('PalLoanToken contract tests', () => {
    let pool1: SignerWithAddress
    let pool2: SignerWithAddress
    let admin: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let loan1: SignerWithAddress
    let loan2: SignerWithAddress
    let loan3: SignerWithAddress
    let loan4: SignerWithAddress

    let token: PalLoanToken
    let controller: PaladinController

    let name: string = "PalLoan Token"
    let symbol: string = "PLT"

    
    before( async () => {
        tokenFactory = await ethers.getContractFactory("PalLoanToken");
        burnedTokenFactory = await ethers.getContractFactory("BurnedPalLoanToken");
        controllerFactory = await ethers.getContractFactory("PaladinController");
    })


    beforeEach( async () => {
        [pool1, pool2, admin, user1, user2, loan1, loan2, loan3, loan4] = await ethers.getSigners();

        controller = (await controllerFactory.connect(admin).deploy()) as PaladinController;
        await controller.deployed();

        //let's put the same address for palPool & palToken for the controller
        await controller.connect(admin).setInitialPools([pool1.address, pool2.address], [pool1.address, pool2.address]);

        token = (await tokenFactory.connect(admin).deploy(controller.address, "about:blank")) as PalLoanToken;
        await token.deployed();
    });


    it(' should be deployed & have correct parameters', async () => {
        expect(token.address).to.properAddress

        const tokenName = await token.name()
        const tokenSymbol = await token.symbol()

        expect(tokenName).to.be.eq(name)
        expect(tokenSymbol).to.be.eq(symbol)

        const tokenSupply = await token.totalSupply()

        expect(tokenSupply).to.be.eq(0)

        const tokenController = await token.controller()

        expect(tokenController).to.be.eq(controller.address)

        //check that burned Token deployed too
        const deployed_burnedToken_address = await token.burnedToken()
        const deployed_burnedToken = burnedTokenFactory.attach(deployed_burnedToken_address)

        expect(deployed_burnedToken.address).to.properAddress

        const burned_name = await deployed_burnedToken.name()
        const burned_symbol = await deployed_burnedToken.symbol()
        const burned_supply = await deployed_burnedToken.totalSupply()
        const burned_minter = await deployed_burnedToken.minter()

        expect(burned_name).to.be.eq("burnedPalLoan Token")
        expect(burned_symbol).to.be.eq("bPLT")
        expect(burned_supply).to.be.eq(0)
        expect(burned_minter).to.be.eq(token.address)

    });

    describe('mint', async () => {

        it(' should mint the token correctly (& with the correct Event)', async () => {

            const expected_id = 0

            const old_supply = await token.totalSupply()

            await expect(token.connect(pool1).mint(user1.address, pool1.address, loan1.address))
                .to.emit(token, 'NewLoanToken')
                .withArgs(pool1.address, user1.address, loan1.address, expected_id);

            const new_supply = await token.totalSupply()

            expect(await token.ownerOf(expected_id)).to.be.eq(user1.address)

            expect(await token.balanceOf(user1.address)).to.be.eq(1)

            expect(new_supply.sub(old_supply)).to.be.eq(1)
        });


        it(' should have the correct data for the token', async () => {

            await token.connect(pool1).mint(user1.address, pool1.address, loan1.address)

            const expected_id = 0

            expect(await token.poolOf(expected_id)).to.be.eq(pool1.address)
            expect(await token.loanOf(expected_id)).to.be.eq(loan1.address)
        });


        it(' should increase the index (for token Ids) correctly', async () => {

            await token.connect(pool1).mint(user1.address, pool1.address, loan1.address)
            await token.connect(pool1).mint(user1.address, pool1.address, loan2.address)

            const expected_id = 1

            expect(await token.ownerOf(expected_id)).to.be.eq(user1.address)
            expect(await token.balanceOf(user1.address)).to.be.eq(2)

            const user_tokens = await token.tokensOf(user1.address);
            
            expect(user_tokens[0]).to.be.eq(0)
            expect(user_tokens[1]).to.be.eq(1)
        });


        it(' should revert with incorrect parameters', async () => {

            await expect(
                token.connect(pool1).mint(user1.address, pool1.address, ethers.constants.AddressZero)
            ).to.be.revertedWith('ZeroAddress()')

            await expect(
                token.connect(pool1).mint(ethers.constants.AddressZero, pool1.address, loan1.address)
            ).to.be.reverted

        });


        it(' should not be allowed for non-palPool addresses', async () => {

            await expect(
                token.connect(user1).mint(user1.address, pool1.address, loan1.address)
            ).to.be.revertedWith('CallerNotAllowedPool()')

        });

    });

    describe('Approval functions', async () => {
        
        beforeEach(async () => {

            await token.connect(pool1).mint(user1.address, pool1.address, loan1.address)
            await token.connect(pool1).mint(user1.address, pool1.address, loan2.address)

        });

        it(' should approve only 1 token (& with the correct Event)', async () => {
            
            await expect(token.connect(user1).approve(user2.address, 0))
                .to.emit(token, 'Approval')
                .withArgs(user1.address, user2.address, 0);

            expect(await token.getApproved(0)).to.be.eq(user2.address)
        });


        it(' should set approval for all (& with the correct Event)', async () => {

            await expect(await token.connect(user1).setApprovalForAll(user2.address, true))
                .to.emit(token, 'ApprovalForAll')
                .withArgs(user1.address, user2.address, true);

            expect(await token.isApprovedForAll(user1.address, user2.address)).to.be.true
        });


        it(' should remove approval for all', async () => {

            await token.connect(user1).setApprovalForAll(user2.address, true);

            await token.connect(user1).setApprovalForAll(user2.address, false);

            expect(await token.connect(user2).isApprovedForAll(user1.address, user2.address)).to.be.false
        });


        it(' should revert on incorrect parameters', async () => {

            await expect(
                token.connect(user1).approve(user2.address, 10)
            ).to.be.reverted

        });


        it(' should revert if not called by the owner or approved user', async () => {

            await expect(
                token.connect(user2).approve(user2.address, 0)
            ).to.be.reverted

        });


        it(' should allow approved operator to approve', async () => {

            await token.connect(user1).setApprovalForAll(user2.address, true);

            await token.connect(user2).approve(user2.address, 0);

            expect(await token.getApproved(0)).to.be.eq(user2.address)

        });


        it(' should revert if trying to approve self', async () => {

            await expect(
                token.connect(user1).approve(user1.address, 0)
            ).to.be.reverted

        });

    });

    describe('transferFrom', async () => {
        
        beforeEach(async () => {

            await token.connect(pool1).mint(user1.address, pool1.address, loan1.address)
            await token.connect(pool1).mint(user1.address, pool1.address, loan2.address)

            await token.connect(user1).approve(user2.address, 0)
        });


        it(' should transfer (with the correct Event) & update balances/ownership', async () => {

            await expect(token.connect(user1).transferFrom(user1.address, user2.address, 0))
            .to.emit(token, 'Transfer')
            .withArgs(user1.address, user2.address, 0);

            expect(await token.ownerOf(0)).to.be.eq(user2.address)
            expect(await token.balanceOf(user1.address)).to.be.eq(1)
            expect(await token.balanceOf(user2.address)).to.be.eq(1)

        });


        it(' should fail if not approved', async () => {

            await expect(
                token.connect(user2).transferFrom(user1.address, user2.address, 1)
            ).to.be.reverted

        });


        it(' should transfer if operator is approvedForAll', async () => {

            await token.connect(user1).setApprovalForAll(user2.address, true);

            await token.connect(user2).transferFrom(user1.address, user2.address, 1)
            
            expect(await token.ownerOf(1)).to.be.eq(user2.address)

        });


        it(' should reset the approval after transfer', async () => {

            await token.connect(user2).transferFrom(user1.address, user2.address, 0)

            expect(await token.getApproved(0)).to.be.eq(ethers.constants.AddressZero)

        });


        it(' should revert if the token is not owned', async () => {

            await expect(
                token.connect(user2).transferFrom(user2.address, user1.address, 1)
            ).to.be.reverted

        });


        it(' should revert if incorrect parameters', async () => {

            await expect(
                token.connect(user1).transferFrom(user1.address, ethers.constants.AddressZero, 0)
            ).to.be.reverted

        });

    });

    describe('burn', async () => {
        
        beforeEach(async () => {
            await token.connect(pool1).mint(user1.address, pool1.address, loan1.address)
            await token.connect(pool1).mint(user1.address, pool1.address, loan2.address)
        });


        it(' should burn (with correct Event) & update balances/ownership', async () => {

            const old_supply = await token.totalSupply()

            await expect(token.connect(pool1).burn(0))
                .to.emit(token, 'BurnLoanToken')
                .withArgs(pool1.address, user1.address, loan1.address, 0);

            await expect(
                token.ownerOf(0)
            ).to.be.reverted

            expect(await token.balanceOf(user1.address)).to.be.eq(1)

            const new_supply = await token.totalSupply()

            expect(old_supply.sub(new_supply)).to.be.eq(1)

        });


        it(' should mint in the Burned Token contract', async () => {
            
            const deployed_burnedToken_address = await token.burnedToken()
            const deployed_burnedToken = burnedTokenFactory.attach(deployed_burnedToken_address)

            await expect(token.connect(pool1).burn(0))
                .to.emit(deployed_burnedToken, 'NewBurnedLoanToken')
                .withArgs(user1.address, 0);

        });


        it(' should reset approval for the token', async () => {
            await token.connect(pool1).burn(0)

            expect(await token.getApproved(0)).to.be.eq(ethers.constants.AddressZero)
        });


        it(' isBurned should return true', async () => {

            await token.connect(pool1).burn(0)
            
            expect(await token.isBurned(0)).to.be.true
        });


        it(' should have the correct balances/ownership in the Burned Token contract', async () => {

            const deployed_burnedToken_address = await token.burnedToken()
            const deployed_burnedToken = burnedTokenFactory.attach(deployed_burnedToken_address)

            await token.connect(pool1).burn(0)

            expect(await deployed_burnedToken.ownerOf(0)).to.be.eq(user1.address)
            expect(await deployed_burnedToken.balanceOf(user1.address)).to.be.eq(1)
        });


        it(' should not burn already burned token', async () => {

            await token.connect(pool1).burn(0)

            await expect(
                token.connect(pool1).burn(0)
            ).to.be.reverted

        });


        it(' should only be called by a palPool', async () => {

            await expect(
                token.connect(user1).burn(0)
            ).to.be.revertedWith('CallerNotAllowedPool()')

        });

    });

    describe('Data fetching functions', async () => {
        
        beforeEach(async () => {
            await token.connect(pool1).mint(user1.address, pool1.address, loan1.address)
            await token.connect(pool1).mint(user1.address, pool1.address, loan2.address)

            await token.connect(pool2).mint(user1.address, pool2.address, loan3.address)

            await token.connect(pool1).mint(user2.address, pool1.address, loan4.address)
        });


        it(' loans of user', async () => {
            const loans_list = await token.loansOf(user1.address)

            expect(loans_list).to.contain(loan1.address)
            expect(loans_list).to.contain(loan2.address)
            expect(loans_list).to.contain(loan3.address)

            expect(loans_list).not.to.contain(loan4.address)

            await token.connect(pool1).burn(0)

            const loans_list2 = await token.loansOf(user1.address)

            expect(loans_list2).not.to.contain(loan1.address)

            expect(loans_list2).to.contain(loan2.address)
            expect(loans_list2).to.contain(loan3.address)

            expect(loans_list2).not.to.contain(loan4.address)
        });


        it(' tokens of user', async () => {
            const tokens_list = await token.tokensOf(user1.address)

            expect(tokens_list[0]).to.be.eq(0)
            expect(tokens_list[1]).to.be.eq(1)
            expect(tokens_list[2]).to.be.eq(2)


            const tokens_list2 = await token.tokensOf(user2.address)

            expect(tokens_list2[0]).to.be.eq(3)

        });


        it(' loans of user by palPool', async () => {
            const loans_list_pool1 = await token.loansOfForPool(user1.address, pool1.address)
            const loans_list_pool2 = await token.loansOfForPool(user1.address, pool2.address)

            expect(loans_list_pool1).to.contain(loan1.address)
            expect(loans_list_pool1).to.contain(loan2.address)

            expect(loans_list_pool1).not.to.contain(loan3.address)

            expect(loans_list_pool2).to.contain(loan3.address)

            expect(loans_list_pool2).not.to.contain(loan1.address)


            const loans_list2_pool1 = await token.loansOfForPool(user2.address, pool1.address)

            expect(loans_list2_pool1).to.contain(loan4.address)
        });


        it(' correct palPool for id', async () => {

            expect(await token.poolOf(0)).to.be.eq(pool1.address)
            expect(await token.poolOf(1)).to.be.eq(pool1.address)
            expect(await token.poolOf(2)).to.be.eq(pool2.address)
            expect(await token.poolOf(3)).to.be.eq(pool1.address)

        });


        it(' all loans of user (active + burned)', async () => {
            await token.connect(pool1).burn(1)

            const loans_list = await token.allLoansOf(user1.address)

            expect(loans_list).to.contain(loan1.address)
            expect(loans_list).to.contain(loan2.address)
            expect(loans_list).to.contain(loan3.address)

            expect(loans_list).not.to.contain(loan4.address)
        });


        it(' all tokens of user (active + burned)', async () => {
            await token.connect(pool1).burn(1)

            const tokens_list = await token.allTokensOf(user1.address)

            expect(tokens_list[0]).to.be.eq(0)
            expect(tokens_list[1]).to.be.eq(2)
            expect(tokens_list[2]).to.be.eq(1) //because order is active, then burned
        });


        it(' all loans of user by palPool (active + burned)', async () => {
            await token.connect(pool1).burn(1)

            const loans_list = await token.allLoansOfForPool(user1.address, pool1.address)

            expect(loans_list).to.contain(loan1.address)
            expect(loans_list).to.contain(loan2.address)
            
            expect(loans_list).not.to.contain(loan3.address)
            expect(loans_list).not.to.contain(loan4.address)
        });


        it(' isBurned', async () => {
            await token.connect(pool1).burn(0)

            expect(await token.isBurned(0)).to.be.true
            expect(await token.isBurned(1)).to.be.false
        });

    });

    describe('Admin functions', async () => {

        it(' should update the controller correctly', async () => {

            const newController = user2.address;

            await token.connect(admin).setNewController(newController);

            expect(await token.controller()).to.be.eq(newController);
        });


        it(' should block non-admin', async () => {

            const newController = user2.address;

            await expect(
                token.connect(user1).setNewController(newController)
            ).to.be.reverted
        });


        it(' should block minting of burned tokens if not the Minter', async () => {

            const deployed_burnedToken_address = await token.burnedToken()
            const deployed_burnedToken = burnedTokenFactory.attach(deployed_burnedToken_address)

            await expect(
                deployed_burnedToken.connect(user1).mint(0)
            ).to.be.reverted
        });

    });

});