//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "../PalPool.sol";
import "../utils/SafeMath.sol";
import "../utils/SafeERC20.sol";
import "../utils/IERC20.sol";
import "../tokens/AAVE/IStakedAave.sol";
import {Errors} from  "../utils/Errors.sol";



/** @title palStkAave Pool contract  */
/// @author Paladin
contract PalStkAave is PalPool {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    /** @dev stkAAVE token address */
    address private stkAaveAddress;
    /** @dev AAVE token address */
    address private aaveAddress;
    /** @dev Block number of the last reward claim */
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


    /**
    * @dev Claim AAVE tokens from the AAVE Safety Module and stake them back in the Module
    * @return bool : Success
    */
    function claimFromAave() internal returns(bool) {
        //Load contracts
        IERC20 _aave = IERC20(aaveAddress);
        IStakedAave _stkAave = IStakedAave(stkAaveAddress);

        //Get pending rewards amount
        uint _pendingRewards = _stkAave.getTotalRewardsBalance(address(this));

        //If there is reward to claim
        if(_pendingRewards > 0 && claimBlockNumber != block.number){

            //claim the AAVE tokens
            _stkAave.claimRewards(address(this), _pendingRewards);

            //Stake the AAVE tokens to get stkAAVE tokens
            _aave.safeApprove(stkAaveAddress, _pendingRewards);
            _stkAave.stake(address(this), _pendingRewards);

            //update the block number
            claimBlockNumber = block.number;

            return true;
        }
        return true;
    }


    /**
    * @notice Deposit underlying in the Pool
    * @dev Deposit underlying, and mints palToken for the user
    * @param _amount Amount of underlying to deposit
    * @return bool : amount of minted palTokens
    */
    function deposit(uint _amount) external override(PalPool) preventReentry returns(uint){
        require(claimFromAave());
        require(_updateInterest());

        //Retrieve the current exchange rate palToken:underlying
        uint _exchRate = _exchangeRate();

        //Transfer the underlying to this contract
        //The amount of underlying needs to be approved before
        underlying.safeTransferFrom(msg.sender, address(this), _amount);


        //Find the amount to mint depending of the previous transfer
        uint _num = _amount.mul(mantissaScale);
        uint _toMint = _num.div(_exchRate);

        //Mint the palToken
        require(palToken.mint(msg.sender, _toMint), Errors.FAIL_MINT);

        //Emit the Deposit event
        emit Deposit(msg.sender, _amount, address(this));

        //Use the controller to check if the minting was successfull
        require(controller.depositVerify(address(this), msg.sender, _toMint), Errors.FAIL_DEPOSIT);

        return _toMint;
    }

    /**
    * @notice Withdraw underliyng token from the Pool
    * @dev Transfer underlying token to the user, and burn the corresponding palToken amount
    * @param _amount Amount of palToken to return
    * @return uint : amount of underlying returned
    */
    function withdraw(uint _amount) external override(PalPool) preventReentry returns(uint){
        require(claimFromAave());
        require(_updateInterest());
        require(balanceOf(msg.sender) >= _amount, Errors.INSUFFICIENT_BALANCE);

        //Retrieve the current exchange rate palToken:underlying
        uint _exchRate = _exchangeRate();

        //Find the amount to return depending on the amount of palToken to burn
        uint _num = _amount.mul(_exchRate);
        uint _toReturn = _num.div(mantissaScale);

        //Check if the pool has enough underlying to return
        require(_toReturn < _underlyingBalance(), Errors.INSUFFICIENT_CASH);

        //Burn the corresponding palToken amount
        require(palToken.burn(msg.sender, _amount), Errors.FAIL_BURN);

        //Make the underlying transfer
        underlying.safeTransfer(msg.sender, _toReturn);

        //Use the controller to check if the burning was successfull
        require(controller.depositVerify(address(this), msg.sender, _amount), Errors.FAIL_DEPOSIT);

        //Emit the Withdraw event
        emit Withdraw(msg.sender, _amount, address(this));

        return _toReturn;
    }

    /**
    * @dev Create a Borrow, deploy a Loan Pool and delegate voting power
    * @param _delegatee Address to delegate the voting power to
    * @param _amount Amount of underlying to borrow
    * @param _feeAmount Amount of fee to pay to start the loan
    * @return uint : amount of paid fees
    */
    function borrow(address _delegatee, uint _amount, uint _feeAmount) external override(PalPool) preventReentry returns(uint){
        require(claimFromAave());
        //Need the pool to have enough liquidity, and the interests to be up to date
        require(_amount < _underlyingBalance(), Errors.INSUFFICIENT_CASH);
        require(_amount > 0, Errors.ZERO_BORROW);
        require(_feeAmount >= minBorrowFees(_amount), Errors.BORROW_INSUFFICIENT_FEES);
        require(_updateInterest());

        address _borrower = msg.sender;

        //Deploy a new Loan Pool contract
        PalLoan _newLoan = new PalLoan(
            address(this),
            _borrower,
            address(underlying),
            delegator
        );

        //Create a new Borrow struct for this new Loan
        Borrow memory _newBorrow = Borrow(
            _borrower,
            _delegatee,
            address(_newLoan),
            _amount,
            address(underlying),
            _feeAmount,
            0,
            borrowIndex,
            block.number,
            0,
            false,
            false
        );


        //Send the borrowed amount of underlying tokens to the Loan
        underlying.safeTransfer(address(_newLoan), _amount);

        //And transfer the fees from the Borrower to the Loan
        underlying.safeTransferFrom(_borrower, address(_newLoan), _feeAmount);

        //Start the Loan (and delegate voting power)
        require(_newLoan.initiate(_delegatee, _amount, _feeAmount), Errors.FAIL_LOAN_INITIATE);

        //Update Total Borrowed, and add the new Loan to mappings
        totalBorrowed = totalBorrowed.add(_amount);
        borrows.push(address(_newLoan));
        loanToBorrow[address(_newLoan)] = _newBorrow;
        borrowsByUser[_borrower].push(address(_newLoan));

        //Check the borrow succeeded
        require(controller.borrowVerify(address(this), _borrower, _delegatee, _amount, _feeAmount, address(_newLoan)), Errors.FAIL_BORROW);

        //Emit the NewLoan Event
        emit NewLoan(_borrower, _delegatee, address(underlying), _amount, address(this), address(_newLoan), block.number);

        //Return the borrowed amount
        return _amount;
    }

    /**
    * @notice Transfer the new fees to the Loan, and expand the Loan
    * @param _loan Address of the Loan
    * @param _feeAmount New amount of fees to pay
    * @return bool : Amount of fees paid
    */
    function expandBorrow(address _loan, uint _feeAmount) external override(PalPool) preventReentry returns(uint){
        require(claimFromAave());
        //Fetch the corresponding Borrow
        //And check that the caller is the Borrower, and the Loan is still active
        Borrow memory _borrow = loanToBorrow[_loan];
        require(!_borrow.closed, Errors.LOAN_CLOSED);
        require(_borrow.borrower == msg.sender, Errors.NOT_LOAN_OWNER);
        require(_updateInterest());
        
        //Load the Loan Pool contract
        PalLoanInterface _palLoan = PalLoanInterface(_borrow.loan);

        //Transfer the new fees to the Loan
        //If success, update the Borrow data, and call the expand fucntion of the Loan
        underlying.safeTransferFrom(_borrow.borrower, _borrow.loan, _feeAmount);

        require(_palLoan.expand(_feeAmount), Errors.FAIL_LOAN_EXPAND);

        _borrow.feesAmount = _borrow.feesAmount.add(_feeAmount);

        loanToBorrow[_loan]= _borrow;

        emit ExpandLoan(_borrow.borrower, _borrow.delegatee, address(underlying), address(this), _borrow.feesAmount, _borrow.loan);

        return _feeAmount;
    }

    /**
    * @notice Close a Loan, and return the non-used fees to the Borrower.
    * If closed before the minimum required length, penalty fees are taken to the non-used fees
    * @dev Close a Loan, and return the non-used fees to the Borrower
    * @param _loan Address of the Loan
    */
    function closeBorrow(address _loan) external override(PalPool) preventReentry {
        require(claimFromAave());
        //Fetch the corresponding Borrow
        //And check that the caller is the Borrower, and the Loan is still active
        Borrow memory _borrow = loanToBorrow[_loan];
        require(!_borrow.closed, Errors.LOAN_CLOSED);
        require(_borrow.borrower == msg.sender, Errors.NOT_LOAN_OWNER);
        require(_updateInterest());

        //Load the Loan contract
        PalLoanInterface _palLoan = PalLoanInterface(_borrow.loan);

        //Calculates the amount of fees used
        uint _feesUsed = (_borrow.amount.mul(borrowIndex).div(_borrow.borrowIndex)).sub(_borrow.amount);
        uint _penaltyFees = 0;
        uint _totalFees = _feesUsed;

        //If the Borrow is closed before the minimum length, calculates the penalty fees to pay
        // -> Number of block remaining to complete the minimum length * current Borrow Rate
        if(block.number < (_borrow.startBlock.add(minBorrowLength))){
            uint _currentBorrowRate = interestModule.getBorrowRate(_underlyingBalance(), totalBorrowed, totalReserve);
            uint _missingBlocks = (_borrow.startBlock.add(minBorrowLength)).sub(block.number);
            _penaltyFees = _missingBlocks.mul(_borrow.amount.mul(_currentBorrowRate)).div(mantissaScale);
            _totalFees = _totalFees.add(_penaltyFees);
        }
    
        //Security so the Borrow can be closed if there are no more fees
        //(if the Borrow wasn't Killed yet, or the loan is closed before minimum time, and already paid fees aren't enough)
        if(_totalFees > _borrow.feesAmount){
            _totalFees = _borrow.feesAmount;
        }
        
        //Close and destroy the loan
        _palLoan.closeLoan(_totalFees);

        //Set the Borrow as closed
        _borrow.closed = true;
        _borrow.feesUsed = _totalFees;
        _borrow.closeBlock = block.number;

        //Update the storage variables
        totalBorrowed = totalBorrowed.sub((_borrow.amount).add(_feesUsed));
        uint _realPenaltyFees = _totalFees.sub(_feesUsed);
        totalReserve = totalReserve.add(reserveFactor.mul(_realPenaltyFees).div(mantissaScale));

        loanToBorrow[_loan]= _borrow;
        _borrow.feesUsed = _borrow.feesAmount;

        require(controller.closeBorrowVerify(address(this), _borrow.borrower, _borrow.loan), Errors.FAIL_CLOSE_BORROW);

        //Emit the CloseLoan Event
        emit CloseLoan(_borrow.borrower, _borrow.delegatee, address(underlying), _borrow.amount, address(this), _totalFees, _loan, false);
    }

    /**
    * @notice Kill a non-healthy Loan to collect rewards
    * @dev Kill a non-healthy Loan to collect rewards
    * @param _loan Address of the Loan
    */
    function killBorrow(address _loan) external override(PalPool) preventReentry {
        require(claimFromAave());
        address killer = msg.sender;
        //Fetch the corresponding Borrow
        //And check that the killer is not the Borrower, and the Loan is still active
        Borrow memory _borrow = loanToBorrow[_loan];
        require(!_borrow.closed, Errors.LOAN_CLOSED);
        require(_borrow.borrower != killer, Errors.LOAN_OWNER);
        require(_updateInterest());

        //Calculate the amount of fee used, and check if the Loan is killable
        uint _feesUsed = (_borrow.amount.mul(borrowIndex).div(_borrow.borrowIndex)).sub(_borrow.amount);
        uint _loanHealthFactor = _feesUsed.mul(uint(1e18)).div(_borrow.feesAmount);
        require(_loanHealthFactor >= killFactor, Errors.NOT_KILLABLE);

        //Load the Loan
        PalLoanInterface _palLoan = PalLoanInterface(_borrow.loan);

        //Kill the Loan
        _palLoan.killLoan(killer, killerRatio);

        //Close the Loan, and update storage variables
        _borrow.closed = true;
        _borrow.killed = true;
        _borrow.feesUsed = _borrow.feesAmount;
        _borrow.closeBlock = block.number;

        uint _killerFees = (_borrow.feesAmount).mul(killerRatio).div(uint(1e18));
        totalBorrowed = totalBorrowed.sub((_borrow.amount).add(_feesUsed));
        totalReserve = totalReserve.sub(_killerFees);

        loanToBorrow[_loan]= _borrow;

        require(controller.killBorrowVerify(address(this), killer, _borrow.loan), Errors.FAIL_KILL_BORROW);

        //Emit the CloseLoan Event
        emit CloseLoan(_borrow.borrower, _borrow.delegatee, address(underlying), _borrow.amount, address(this), _borrow.feesAmount, _loan, true);
    }
}