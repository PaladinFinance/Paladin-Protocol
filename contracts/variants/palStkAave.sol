pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "../PalPool.sol";
import "../utils/SafeMath.sol";
import "../utils/IERC20.sol";
import "../tokens/AAVE/IStakedAave.sol";
import {Errors} from  "../utils/Errors.sol";



/** @title palStkAave Pool contract  */
/// @author Paladin
contract PalStkAave is PalPool {
    using SafeMath for uint;

    address private stkAaveAddress;
    address private aaveAddress;

    uint public claimBlockNumber = 0;

    constructor( 
        address _palToken,
        address _controller, 
        address _underlying,
        address _interestModule,
        address _delegator,
        address _aaveAddress
    ) PalPool(
            _palToken, 
            _controller,
            _underlying,
            _interestModule,
            _delegator
        )
    {
        stkAaveAddress = _underlying;
        aaveAddress = _aaveAddress;
    }

    function claimFromAave() internal returns(bool) {
        IERC20 aave = IERC20(aaveAddress);
        IStakedAave stkAave = IStakedAave(stkAaveAddress);
        uint pendingRewards = stkAave.getTotalRewardsBalance(address(this));
        if(pendingRewards > 0 && claimBlockNumber != block.number){
            stkAave.claimRewards(address(this), pendingRewards);
            aave.approve(stkAaveAddress, pendingRewards);
            stkAave.stake(address(this), pendingRewards);
            claimBlockNumber = block.number;
            return true;
        }
        return true;
    }


    /**
    * @notice Deposit underlying in the Pool
    * @dev Deposit underlying, and mints palToken for the user
    * @param amount Amount of underlying to deposit
    * @return bool : amount of minted palTokens
    */
    function deposit(uint amount) external override(PalPool) preventReentry returns(uint){
        require(claimFromAave());
        require(_updateInterest());

        //Retrieve the current exchange rate palToken:underlying
        uint _exchRate = _exchangeRate();

        //Transfer the underlying to this contract
        //The amount of underlying needs to be approved before
        require(underlying.transferFrom(msg.sender, address(this), amount));


        //Find the amount to mint depending of the previous transfer
        uint _num = amount.mul(mantissaScale);
        uint _toMint = _num.div(_exchRate);

        //Mint the palToken : update balances and Supply
        palToken.mint(msg.sender, _toMint);

        //Emit the Deposit event
        emit Deposit(msg.sender, amount, address(this));

        //Use the controller to check if the minting was successfull
        require(controller.depositVerify(address(this), msg.sender, _toMint), Errors.FAIL_DEPOSIT);

        return _toMint;
    }

    /**
    * @notice Withdraw underliyng token from the Pool
    * @dev Transfer underlying token to the user, and burn the corresponding palToken amount
    * @param amount Amount of palToken to return
    * @return uint : amount of underlying returned
    */
    function withdraw(uint amount) external override(PalPool) preventReentry returns(uint){
        require(claimFromAave());
        require(_updateInterest());
        require(balanceOf(msg.sender) >= amount, Errors.INSUFFICIENT_BALANCE);

        //Retrieve the current exchange rate palToken:underlying
        uint _exchRate = _exchangeRate();

        //Find the amount to return depending on the amount of palToken to burn
        uint _num = amount.mul(_exchRate);
        uint _toReturn = _num.div(mantissaScale);

        //Check if the pool has enough underlying to return
        require(_toReturn < _underlyingBalance(), Errors.INSUFFICIENT_CASH);

        //Update the palToken balance & Supply
        palToken.burn(msg.sender, amount);

        //Make the underlying transfer
        require(underlying.transfer(msg.sender, _toReturn));

        //Emit the Withdraw event
        emit Withdraw(msg.sender, amount, address(this));

        return _toReturn;
    }

    /**
    * @dev Create a Borrow, deploy a Loan Pool and delegate voting power
    * @param _amount Amount of underlying to borrow
    * @param _feeAmount Amount of fee to pay to start the loan
    * @return uint : amount of paid fees
    */
    function borrow(uint _amount, uint _feeAmount) external override(PalPool) preventReentry returns(uint){
        require(claimFromAave());
        //Need the pool to have enough liquidity, and the interests to be up to date
        require(_amount < _underlyingBalance(), Errors.INSUFFICIENT_CASH);
        require(_updateInterest());

        address _dest = msg.sender;

        //Deploy a new Loan Pool contract
        PalLoan _newLoan = new PalLoan(
            address(this),
            _dest,
            address(underlying),
            delegator
        );

        //Create a new Borrow struct for this new Loan
        Borrow memory _newBorrow = Borrow(
            _dest,
            address(_newLoan),
            _amount,
            address(underlying),
            _feeAmount,
            borrowIndex,
            false
        );


        //Send the borrowed amount of underlying tokens to the Loan
        require(underlying.transfer(address(_newLoan), _amount));

        //And transfer the fees from the Borrower to the Loan
        require(underlying.transferFrom(_dest, address(_newLoan), _feeAmount));

        //Start the Loan (and delegate voting power)
        require(_newLoan.initiate(_amount, _feeAmount));

        //Update Total Borrowed, and add the new Loan to mappings
        totalBorrowed = totalBorrowed.add(_amount);
        borrows.push(address(_newLoan));
        loanToBorrow[address(_newLoan)] = _newBorrow;
        borrowsByUser[_dest].push(address(_newLoan));

        //Check the borrow succeeded
        require(controller.borrowVerify(address(this), _dest, _amount, _feeAmount, address(_newLoan)), Errors.FAIL_BORROW);

        //Emit the NewLoan Event
        emit NewLoan(_dest, _amount, address(this), address(_newLoan), block.number);

        //Return the borrowed amount
        return _amount;
    }

    /**
    * @notice Transfer the new fees to the Loan, and expand the Loan
    * @param loan Address of the Loan
    * @param feeAmount New amount of fees to pay
    * @return bool : Amount of fees paid
    */
    function expandBorrow(address loan, uint feeAmount) external override(PalPool) preventReentry returns(uint){
        require(claimFromAave());
        //Fetch the corresponding Borrow
        //And check that the caller is the Borrower, and the Loan is still active
        Borrow memory __borrow = loanToBorrow[loan];
        require(!__borrow.closed, Errors.LOAN_CLOSED);
        require(__borrow.borrower == msg.sender, Errors.NOT_LOAN_OWNER);
        require(_updateInterest());
        
        //Load the Loan Pool contract
        PalLoanInterface _loan = PalLoanInterface(__borrow.loan);

        //Transfer the new fees to the Loan
        //If success, update the Borrow data, and call the expand fucntion of the Loan
        require(underlying.transferFrom(__borrow.borrower, __borrow.loan, feeAmount));

        require(_loan.expand(feeAmount), Errors.FAIL_LOAN_EXPAND);

        __borrow.feesAmount = __borrow.feesAmount.add(feeAmount);

        loanToBorrow[loan]= __borrow;

        emit ExpandLoan(__borrow.borrower, address(underlying), __borrow.feesAmount, __borrow.loan);

        return feeAmount;
    }

    /**
    * @dev Close a Loan, and return the non-used fees to the Borrower
    * @param loan Address of the Loan
    */
    function closeBorrow(address loan) external override(PalPool) preventReentry {
        require(claimFromAave());
        //Fetch the corresponding Borrow
        //And check that the caller is the Borrower, and the Loan is still active
        Borrow memory __borrow = loanToBorrow[loan];
        require(!__borrow.closed, Errors.LOAN_CLOSED);
        require(__borrow.borrower == msg.sender, Errors.NOT_LOAN_OWNER);
        require(_updateInterest());

        //Load the Loan contract
        PalLoanInterface _loan = PalLoanInterface(__borrow.loan);

        //Calculates the amount of fees used
        uint _feesUsed = __borrow.amount.sub(__borrow.amount.mul(__borrow.borrowIndex).div(borrowIndex));
        
        //Close and destroy the loan
        _loan.closeLoan(_feesUsed);

        //Set the Borrow as closed
        __borrow.closed = true;

        //Update the storage varaibles
        totalBorrowed = totalBorrowed.sub(__borrow.amount);

        loanToBorrow[loan]= __borrow;

        //Emit the CloseLoan Event
        emit CloseLoan(__borrow.borrower, __borrow.amount, address(this), false);
    }

    /**
    * @dev Kill a non-healthy Loan to collect rewards
    * @param loan Address of the Loan
    */
    function killBorrow(address loan) external override(PalPool) preventReentry {
        require(claimFromAave());
        address killer = msg.sender;
        //Fetch the corresponding Borrow
        //And check that the killer is not the Borrower, and the Loan is still active
        Borrow memory __borrow = loanToBorrow[loan];
        require(!__borrow.closed, Errors.LOAN_CLOSED);
        require(__borrow.borrower != killer, Errors.LOAN_OWNER);
        require(_updateInterest());

        //Calculate the amount of fee used, and check if the Loan is killable
        uint _feesUsed = __borrow.amount.sub(__borrow.amount.mul(__borrow.borrowIndex).div(borrowIndex));
        uint _loanHealthFactor = uint(1e18) - _feesUsed.mul(uint(1e18)).div(__borrow.feesAmount);
        require(_loanHealthFactor <= killFactor, Errors.NOT_KILLABLE);

        //Load the Loan
        PalLoanInterface _loan = PalLoanInterface(__borrow.loan);

        //Kill the Loan
        _loan.killLoan(killer, killerRatio);

        //Close the Loan, and update storage variables
        __borrow.closed = true;

        totalBorrowed = totalBorrowed.sub(__borrow.amount);

        loanToBorrow[loan]= __borrow;

        //Emit the CloseLoan Event
        emit CloseLoan(__borrow.borrower, __borrow.amount, address(this), true);
    }
}