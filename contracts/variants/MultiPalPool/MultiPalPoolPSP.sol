//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "../../utils/SafeMath.sol";
import "../../utils/SafeERC20.sol";
import "../../utils/Clones.sol";
import "./IMultiPalPool.sol";
import "./MultiPalPoolStorage.sol";
import "../../IPalLoan.sol";
import "../../IPalToken.sol";
import "../../IPaladinController.sol";
import "../../IPalLoanToken.sol";
import "../../interests/InterestInterface.sol";
import "../../utils/IERC20.sol";
import "../../utils/Admin.sol";
import "../../utils/ReentrancyGuard.sol";
import "./interfaces/ISPSP.sol";
import {Errors} from  "../../utils/Errors.sol";



/** @title MultiPalPool contract  */
/// @author Paladin
contract MultiPalPoolPSP is IMultiPalPool, MultiPalPoolStorage, Admin, ReentrancyGuard {
    using SafeMath for uint;
    using SafeERC20 for IERC20;


    modifier controllerOnly() {
        //allows only the Controller and the admin to call the function
        require(msg.sender == admin || msg.sender == address(controller), Errors.CALLER_NOT_CONTROLLER);
        _;
    }



    //Functions

    constructor(
        IPalToken[] memory _palTokens,
        address _controller, 
        address[] memory _underlyings,
        address _interestModule,
        address _delegator,
        address _palLoanToken
    ){
        require(_palTokens.length == _underlyings.length, Errors.INEQUAL_ARRAYS);

        //Set admin
        admin = msg.sender;

        //Set inital values & modules
        controller = IPaladinController(_controller);
        accrualBlockNumber = block.number;
        interestModule = InterestInterface(_interestModule);
        borrowIndex = 1e18;
        delegator = _delegator;
        palLoanToken = IPalLoanToken(_palLoanToken);


        underlyings = _underlyings;
        for(uint i = 0; i < _underlyings.length; i++){
            palTokens[_underlyings[i]] = _palTokens[i];
            palTokenToUnderlying[address(_palTokens[i])] = _underlyings[i];
        }
    }


    function isUnderlyingListed(address _underlying) internal view returns(bool) {
        return(address(palTokens[_underlying]) != address(0)); // Because if the underlying was added, a palToken was set for it
    }

    function isPalTokenListed(address _palToken) internal view returns(bool) {
        return(palTokenToUnderlying[_palToken] != address(0)); // Because if the palToken was added, an underlying token was set for it
    }

    function underlyingCount() public view returns(uint) {
        return underlyings.length;
    }

    /**
    * @notice Get the underlying balance for this Pool (in PSP)
    * @dev Get the underlying balance of this Pool (in PSP)
    * @return uint : balance of this pool (in PSP)
    */
    function underlyingBalance() public view override returns(uint){
        //Return the balance of this contract, for all sPSP underlyings, in PSP
        uint _total;

        for(uint i = 0; i < underlyings.length; i++){
            _total = _total.add(ISPSP(address(underlyings[i])).PSPBalance(address(this)));
        }

        return _total;
    }

    /**
    * @notice Get the underlying balance for this Pool for a given underlying
    * @dev Get the underlying balance of this Pool for a given underlying
    * @return uint : balance of this pool
    */
    function underlyingBalance(address _underlying) public view override returns(uint){
        //Return the balance of this contract, for the given sPSP underlying
        return ISPSP(_underlying).PSPBalance(address(this));
    }

    /**
    * @notice Deposit underlying in the Pool
    * @dev Deposit underlying, and mints palToken for the user
    * @param _amount Amount of underlying to deposit
    * @return bool : amount of minted palTokens
    */
    function deposit(address _underlying, uint _amount) public virtual override nonReentrant returns(uint){
        require(isUnderlyingListed(_underlying), Errors.UNDERLYING_NOT_LISTED);
        require(_updateInterest());

        //Retrieve the current exchange rate palToken:underlying
        IPalToken _palToken = palTokens[_underlying];
        uint _exchRate = _exchangeRate(address(_palToken));


        //Find the amount to mint depending on the amount to transfer
        uint _num = _amount.mul(mantissaScale);
        uint _toMint = _num.div(_exchRate);

        //Transfer the underlying to this contract
        //The amount of underlying needs to be approved before
        IERC20(_underlying).safeTransferFrom(msg.sender, address(this), _amount);

        //Mint the palToken
        require(_palToken.mint(msg.sender, _toMint), Errors.FAIL_MINT);

        //Emit the Deposit event
        emit Deposit(_underlying, msg.sender, _amount, address(this));

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
    function withdraw(address _palTokenAddress, uint _amount) public virtual override nonReentrant returns(uint){
        //Load the palToken if it exists.
        require(isPalTokenListed(_palTokenAddress), Errors.PALTOKEN_NOT_LISTED);

        IPalToken _palToken = IPalToken(_palTokenAddress);
        require(_palToken.balanceOf(msg.sender) >= _amount, Errors.INSUFFICIENT_BALANCE);
        require(_updateInterest());

        //Retrieve the current exchange rate palToken:underlying
        uint _exchRate = _exchangeRate(_palTokenAddress);

        //Find the amount to return depending on the amount of palToken to burn
        uint _num = _amount.mul(_exchRate);
        uint _toReturn = _num.div(mantissaScale);

        //Check if the pool has enough underlying to return
        address _underlying = palTokenToUnderlying[_palTokenAddress];
        require(_toReturn <= underlyingBalance(_underlying), Errors.INSUFFICIENT_CASH);

        //Burn the corresponding palToken amount
        require(_palToken.burn(msg.sender, _amount), Errors.FAIL_BURN);

        //Make the underlying transfer
        IERC20(_underlying).safeTransfer(msg.sender, _toReturn);

        //Use the controller to check if the burning was successfull
        require(controller.withdrawVerify(address(this), msg.sender, _toReturn), Errors.FAIL_WITHDRAW);

        //Emit the Withdraw event
        emit Withdraw(_underlying, msg.sender, _amount, address(this));

        return _toReturn;
    }

    /**
    * @dev Create a Borrow, deploy a Loan Pool and delegate voting power
    * @param _delegatee Address to delegate the voting power to
    * @param _amount Amount of underlying to borrow
    * @param _feeAmount Amount of fee to pay to start the loan
    * @return uint : new PalLoanToken Id
    */
    function borrow(address _underlying, address _delegatee, uint _amount, uint _feeAmount) public virtual override nonReentrant returns(uint){
        //Need the pool to have enough liquidity, and the interests to be up to date
        require(isUnderlyingListed(_underlying), Errors.UNDERLYING_NOT_LISTED);
        require(_amount <= underlyingBalance(_underlying), Errors.INSUFFICIENT_CASH);
        require(_delegatee != address(0), Errors.ZERO_ADDRESS);
        require(_amount > 0, Errors.ZERO_BORROW);
        require(_feeAmount >= minBorrowFees(_underlying, _amount), Errors.BORROW_INSUFFICIENT_FEES);
        require(_updateInterest());

        address _borrower = msg.sender;

        //Load the right Pool state
        PoolState storage _state = poolStates[_underlying];

        //Update Total Borrowed & number active Loans
        _state.numberActiveLoans = _state.numberActiveLoans.add(1);
        _state.totalBorrowed = _state.totalBorrowed.add(_amount);

        IPalLoan _newLoan = IPalLoan(Clones.clone(delegator));

        //Send the borrowed amount of underlying tokens to the Loan
        IERC20(_underlying).safeTransfer(address(_newLoan), _amount);

        //And transfer the fees from the Borrower to the Loan
        IERC20(_underlying).safeTransferFrom(_borrower, address(_newLoan), _feeAmount);

        //Start the Loan (and delegate voting power)
        require(_newLoan.initiate(
            address(this),
            _borrower,
            _underlying,
            _delegatee,
            _amount,
            _feeAmount
        ), Errors.FAIL_LOAN_INITIATE);

        //Add the new Loan to mappings
        loans.push(address(_newLoan));

        //Mint the palLoanToken linked to this new Loan
        uint256 _newTokenId = palLoanToken.mint(_borrower, address(this), address(_newLoan));

        //New Borrow struct for this Loan
        loanToBorrow[address(_newLoan)] = Borrow(
            _newTokenId,
            _delegatee,
            address(_newLoan),
            _amount,
            _underlying,
            _feeAmount,
            0,
            borrowIndex,
            block.number,
            0,
            false,
            false
        );

        //Check the borrow succeeded
        require(
            controller.borrowVerify(address(this), _borrower, _delegatee, _amount, _feeAmount, address(_newLoan)), 
            Errors.FAIL_BORROW
        );

        //Emit the NewLoan Event
        emit NewLoan(
            _borrower,
            _delegatee,
            _underlying,
            _amount,
            address(this),
            address(_newLoan),
            _newTokenId,
            block.number
        );

        //Return the PalLoanToken Id
        return _newTokenId;
    }

    /**
    * @notice Transfer the new fees to the Loan, and expand the Loan
    * @param _loan Address of the Loan
    * @param _feeAmount New amount of fees to pay
    * @return bool : Amount of fees paid
    */
    function expandBorrow(address _loan, uint _feeAmount) public virtual override nonReentrant returns(uint){
        //Fetch the corresponding Borrow
        //And check that the caller is the Borrower, and the Loan is still active
        Borrow storage _borrow = loanToBorrow[_loan];
        require(!_borrow.closed, Errors.LOAN_CLOSED);
        require(isLoanOwner(_loan, msg.sender), Errors.NOT_LOAN_OWNER);
        require(_feeAmount > 0);
        require(_updateInterest());
        
        //Load the Loan Pool contract & get Loan owner
        IPalLoan _palLoan = IPalLoan(_borrow.loan);

        address _loanOwner = palLoanToken.ownerOf(_borrow.tokenId);

        _borrow.feesAmount = _borrow.feesAmount.add(_feeAmount);

        //Transfer the new fees to the Loan
        //If success, call the expand function of the Loan
        IERC20 _underlying = IERC20(_borrow.underlying);
        _underlying.safeTransferFrom(_loanOwner, _borrow.loan, _feeAmount);

        require(_palLoan.expand(_feeAmount), Errors.FAIL_LOAN_EXPAND);

        require(
            controller.expandBorrowVerify(address(this), _loan, _feeAmount), 
            Errors.FAIL_LOAN_EXPAND
        );

        emit ExpandLoan(
            _loanOwner,
            _borrow.delegatee,
            _borrow.underlying,
            address(this),
            _borrow.feesAmount,
            _borrow.loan,
            _borrow.tokenId
        );

        return _feeAmount;
    }

    /**
    * @notice Close a Loan, and return the non-used fees to the Borrower.
    * If closed before the minimum required length, penalty fees are taken to the non-used fees
    * @dev Close a Loan, and return the non-used fees to the Borrower
    * @param _loan Address of the Loan
    */
    function closeBorrow(address _loan) public virtual override nonReentrant {
        //Fetch the corresponding Borrow
        //And check that the caller is the Borrower, and the Loan is still active
        Borrow storage _borrow = loanToBorrow[_loan];
        require(!_borrow.closed, Errors.LOAN_CLOSED);
        require(isLoanOwner(_loan, msg.sender), Errors.NOT_LOAN_OWNER);
        require(_updateInterest());

        //Get Loan owner from the ERC721 contract
        //address _loanOwner = palLoanToken.ownerOf(_borrow.tokenId);

        //Load the Loan contract
        IPalLoan _palLoan = IPalLoan(_borrow.loan);

        //Calculates the amount of fees used
        uint _feesUsed = (_borrow.amount.mul(borrowIndex).div(_borrow.borrowIndex)).sub(_borrow.amount);
        uint _penaltyFees = 0;
        uint _totalFees = _feesUsed;

        //If the Borrow is closed before the minimum length, calculates the penalty fees to pay
        // -> Number of block remaining to complete the minimum length * current Borrow Rate
        if(block.number < (_borrow.startBlock.add(minBorrowLength))){
            uint _currentBorrowRate = interestModule.getBorrowRate(address(this), underlyingBalance(), totalBorrowed(), totalReserve());
            uint _missingBlocks = (_borrow.startBlock.add(minBorrowLength)).sub(block.number);
            _penaltyFees = _missingBlocks.mul(_borrow.amount.mul(_currentBorrowRate)).div(mantissaScale);
            _totalFees = _totalFees.add(_penaltyFees);
        }
    
        //Security so the Borrow can be closed if there are no more fees
        //(if the Borrow wasn't Killed yet, or the loan is closed before minimum time, and already paid fees aren't enough)
        if(_totalFees > _borrow.feesAmount){
            _totalFees = _borrow.feesAmount;
        }

        //Set the Borrow as closed
        _borrow.closed = true;
        _borrow.feesUsed = _totalFees;
        _borrow.closeBlock = block.number;



        //Load the right Pool state
        PoolState storage _state = poolStates[_borrow.underlying];

        //Remove the borrowed tokens + fees from the TotalBorrowed
        //Add to the Reserve the reserveFactor of Penalty Fees (if there is Penalty Fees)
        //And add the fees counted as potential Killer Fees to the Accrued Fees, since no killing was necessary

        _state.numberActiveLoans = _state.numberActiveLoans.sub(1);

        _state.totalBorrowed = _state.numberActiveLoans == 0 ? 0 : _state.totalBorrowed.sub((_borrow.amount).add(_feesUsed)); //If not current active Loan, we can just reset the totalBorrowed to 0

        uint _realPenaltyFees = _totalFees.sub(_feesUsed);
        uint _killerFees = _feesUsed.mul(killerRatio).div(mantissaScale);
        _state.totalReserve = _state.totalReserve.add(reserveFactor.mul(_realPenaltyFees).div(mantissaScale));
        _state.accruedFees = _state.accruedFees.add(_killerFees).add(reserveFactor.mul(_realPenaltyFees).div(mantissaScale));
        
        //Close and destroy the loan
        //We use msg.sender as loanOwner since we confirmed earlier the caller was the owner
        _palLoan.closeLoan(_totalFees, msg.sender);

        //Burn the palLoanToken for this Loan
        require(palLoanToken.burn(_borrow.tokenId), Errors.FAIL_LOAN_TOKEN_BURN);

        require(controller.closeBorrowVerify(address(this), msg.sender, _borrow.loan), Errors.FAIL_CLOSE_BORROW);

        //Emit the CloseLoan Event
        emit CloseLoan(
            msg.sender,
            _borrow.delegatee,
            _borrow.underlying,
            _borrow.amount,
            address(this),
            _totalFees,
            _loan,
            _borrow.tokenId,
            false
        );
    }

    /**
    * @notice Kill a non-healthy Loan to collect rewards
    * @dev Kill a non-healthy Loan to collect rewards
    * @param _loan Address of the Loan
    */
    function killBorrow(address _loan) public virtual override nonReentrant {
        address killer = msg.sender;
        //Fetch the corresponding Borrow
        //And check that the killer is not the Borrower, and the Loan is still active
        Borrow storage _borrow = loanToBorrow[_loan];
        require(!_borrow.closed, Errors.LOAN_CLOSED);
        require(!isLoanOwner(_loan, killer), Errors.LOAN_OWNER);
        require(_updateInterest());

        //Get the owner of the Loan through the ERC721 contract
        //address _loanOwner = palLoanToken.ownerOf(_borrow.tokenId);

        //Calculate the amount of fee used, and check if the Loan is killable
        uint _feesUsed = (_borrow.amount.mul(borrowIndex).div(_borrow.borrowIndex)).sub(_borrow.amount);
        uint _loanHealthFactor = _feesUsed.mul(uint(1e18)).div(_borrow.feesAmount);
        require(_loanHealthFactor >= killFactor, Errors.NOT_KILLABLE);

        //Load the Loan
        IPalLoan _palLoan = IPalLoan(_borrow.loan);

        //Close the Loan, and update storage variables
        _borrow.closed = true;
        _borrow.killed = true;
        _borrow.feesUsed = _borrow.feesAmount;
        _borrow.closeBlock = block.number;

        //Remove the borrowed tokens + fees from the TotalBorrowed
        //Remove the amount paid as killer fees from the Reserve, and any over accrued interest in the Reserve & AccruedFees
        uint _overAccruedInterest = _loanHealthFactor <= mantissaScale ? 0 : _feesUsed.sub(_borrow.feesAmount);
        uint _killerFees = (_borrow.feesAmount).mul(killerRatio).div(mantissaScale);

        //Load the right Pool state
        PoolState storage _state = poolStates[_borrow.underlying];

        _state.numberActiveLoans = _state.numberActiveLoans.sub(1);

        _state.totalBorrowed = _state.numberActiveLoans == 0 ? 0 : _state.totalBorrowed.sub((_borrow.amount).add(_feesUsed)); //If not current active Loan, we can just reset the totalBorrowed to 0

        _state.totalReserve = _state.totalReserve.sub(_killerFees).sub(_overAccruedInterest.mul(reserveFactor).div(mantissaScale));
        _state.accruedFees = _state.accruedFees.sub(_overAccruedInterest.mul(reserveFactor.sub(killerRatio)).div(mantissaScale));

        //Kill the Loan
        _palLoan.killLoan(killer, killerRatio);

        //Burn the palLoanToken for this Loan
        require(palLoanToken.burn(_borrow.tokenId), Errors.FAIL_LOAN_TOKEN_BURN);

        require(controller.killBorrowVerify(address(this), killer, _borrow.loan), Errors.FAIL_KILL_BORROW);

        //Emit the CloseLoan Event
        emit CloseLoan(
            palLoanToken.allOwnerOf(_borrow.tokenId),
            _borrow.delegatee,
            _borrow.underlying,
            _borrow.amount,
            address(this),
            _borrow.feesAmount,
            _loan,
            _borrow.tokenId,
            true
        );
    }



    /**
    * @notice Change the delegatee of a Loan, and delegate him the voting power
    * @dev Change the delegatee in the Borrow struct and in the palLoan, then change the voting power delegation recipient
    * @param _loan Address of the Loan
    * @param _newDelegatee Address of the new voting power recipient
    */
    function changeBorrowDelegatee(address _loan, address _newDelegatee) public virtual override nonReentrant {
        //Fetch the corresponding Borrow
        //And check that the caller is the Borrower, and the Loan is still active
        Borrow storage _borrow = loanToBorrow[_loan];
        require(!_borrow.closed, Errors.LOAN_CLOSED);
        require(_newDelegatee != address(0), Errors.ZERO_ADDRESS);
        require(isLoanOwner(_loan, msg.sender), Errors.NOT_LOAN_OWNER);
        require(_updateInterest());

        //Load the Loan Pool contract
        IPalLoan _palLoan = IPalLoan(_borrow.loan);

        //Update storage data
        _borrow.delegatee = _newDelegatee;

        //Call the delegation logic in the palLoan to change the votong power recipient
        require(_palLoan.changeDelegatee(_newDelegatee), Errors.FAIL_LOAN_DELEGATEE_CHANGE);

        //Emit the Event
        emit ChangeLoanDelegatee(
            palLoanToken.ownerOf(_borrow.tokenId),
            _newDelegatee,
            _borrow.underlying,
            address(this),
            _borrow.loan,
            _borrow.tokenId
        );

    }


    /**
    * @notice Return the user's palToken balance
    * @dev Links the PalToken balanceOf() method
    * @param _palToken PalToken address
    * @param _account User address
    * @return uint256 : user palToken balance (in wei)
    */
    function balanceOf(address _palToken, address _account) public view override returns(uint){
        return IERC20(_palToken).balanceOf(_account);
    }


    /**
    * @notice Return the corresponding balance of the pool underlying tokens depending on the user's palToken balances
    * @param _account User address
    * @return uint256 : corresponding balance in the PSP token (in wei)
    */
    function underlyingBalanceOf(address _account) external view override returns(uint){
        uint _total;

        for(uint i = 0; i < underlyings.length; i++){
            _total = _total.add(_underlyingBalanceOf(underlyings[i], _account));
        }

        return _total;
    }


    function underlyingBalanceOf(address _underlying, address _account) external view override returns(uint){
        return _underlyingBalanceOf(_underlying, _account);
    }

    function _underlyingBalanceOf(address _underlying, address _account) internal view returns(uint){
        uint _balance = palTokens[_underlying].balanceOf(_account);
        if(_balance == 0){
            return 0;
        }
        uint _exchRate = _exchangeRate(address(palTokens[_underlying]));
        uint _num = _balance.mul(_exchRate);
        uint _sPSPBalance =  _num.div(mantissaScale);

        return ISPSP(address(_underlying)).PSPForSPSP(_sPSPBalance);
    }


    /**
    * @notice Return true is the given address is the owner of the palLoanToken for the given palLoan
    * @param _loanAddress Address of the Loan
    * @param _user User address
    * @return bool : true if owner
    */
    function isLoanOwner(address _loanAddress, address _user) public view override returns(bool){
        return palLoanToken.allOwnerOf(idOfLoan(_loanAddress)) == _user;
    }


    /**
    * @notice Return the token Id of the palLoanToken linked to this palLoan
    * @param _loanAddress Address of the Loan
    * @return uint256 : palLoanToken token Id
    */
    function idOfLoan(address _loanAddress) public view override returns(uint256){
        return loanToBorrow[_loanAddress].tokenId;
    }



    /**
    * @notice Return the list of all Loans for this Pool (closed and active)
    * @return address[] : list of Loans
    */
    function getLoansPools() external view override returns(address [] memory){
        //Return the addresses of all loans (old ones and active ones)
        return loans;
    }
    
    /**
    * @notice Return all the Loans for a given address
    * @param _borrower Address of the user
    * @return address : list of Loans
    */
    function getLoansByBorrower(address _borrower) external view override returns(address [] memory){
        return palLoanToken.allLoansOfForPool(_borrower, address(this));
    }

    
    /**
    * @notice Return the stored Borrow data for a given Loan
    * @dev Return the Borrow data for a given Loan
    * @param _loanAddress Address of the palLoan
    * Composants of a Borrow struct
    */
    function getBorrowData(address _loanAddress) external view override returns(
        address _borrower,
        address _delegatee,
        address _loan,
        uint256 _palLoanTokenId,
        uint _amount,
        address _underlying,
        uint _feesAmount,
        uint _feesUsed,
        uint _startBlock,
        uint _closeBlock,
        bool _closed,
        bool _killed
    ){
        //Return the data inside a Borrow struct
        Borrow memory _borrow = loanToBorrow[_loanAddress];
        return (
            //Get the Loan owner through the ERC721 contract
            palLoanToken.allOwnerOf(_borrow.tokenId),
            _borrow.delegatee,
            _borrow.loan,
            _borrow.tokenId,
            _borrow.amount,
            _borrow.underlying,
            _borrow.feesAmount,
            //Calculate amount of fees used
            _borrow.closed ? _borrow.feesUsed : (_borrow.amount.mul(borrowIndex).div(_borrow.borrowIndex)).sub(_borrow.amount),
            _borrow.startBlock,
            _borrow.closeBlock,
            _borrow.closed,
            _borrow.killed
        );

    }

    function totalBorrowed() public view override returns (uint){ //value counted in PSP
        address[] memory _underlyings = underlyings;
        uint _total;
        for(uint i = 0; i < _underlyings.length; i++){
            uint _sPSP_amount = poolStates[_underlyings[i]].totalBorrowed;
            _total = _total.add(ISPSP(address(_underlyings[i])).PSPForSPSP(_sPSP_amount));
        }
        return _total;
    }

    function totalReserve() public view override returns (uint){ //value counted in PSP
        address[] memory _underlyings = underlyings;
        uint _total;
        for(uint i = 0; i < _underlyings.length; i++){
            uint _sPSP_amount = poolStates[_underlyings[i]].totalReserve;
            _total = _total.add(ISPSP(address(_underlyings[i])).PSPForSPSP(_sPSP_amount));
        }
        return _total;
    }

    function accruedFees() public view override returns (uint){ //value counted in PSP
        address[] memory _underlyings = underlyings;
        uint _total;
        for(uint i = 0; i < _underlyings.length; i++){
            uint _sPSP_amount = poolStates[_underlyings[i]].accruedFees;
            _total = _total.add(ISPSP(address(_underlyings[i])).PSPForSPSP(_sPSP_amount));
        }
        return _total;
    }

    function numberActiveLoans() public view override returns (uint){
        address[] memory _underlyings = underlyings;
        uint _total;
        for(uint i = 0; i < _underlyings.length; i++){
            _total = _total.add(poolStates[_underlyings[i]].numberActiveLoans);
        }
        return _total;
    }


    
    /**
    * @notice Get the Borrow Rate for this Pool
    * @dev Get the Borrow Rate from the Interest Module
    * @return uint : Borrow Rate (scale 1e18)
    */
    function borrowRatePerBlock() external view override returns (uint){
        return interestModule.getBorrowRate(address(this), underlyingBalance(), totalBorrowed(), totalReserve());
    }
    
    /**
    * @notice Get the Supply Rate for this Pool
    * @dev Get the Supply Rate from the Interest Module
    * @return uint : Supply Rate (scale 1e18)
    */
    function supplyRatePerBlock(address _underlying) external view override returns (uint){
        return interestModule.getSupplyRate(
            address(this),
            IERC20(_underlying).balanceOf(address(this)),
            poolStates[_underlying].totalBorrowed,
            poolStates[_underlying].totalReserve,
            reserveFactor
        );
    }

    
    /**
    * @dev Calculates the current exchange rate
    * @return uint : current exchange rate (scale 1e18)
    */
    function _exchangeRate(address _palToken) internal view returns (uint){
        uint _totalSupply = IERC20(_palToken).totalSupply();
        //If no palTokens where minted, use the initial exchange rate
        if(_totalSupply == 0){
            return initialExchangeRate;
        }
        else{
            address _underlying = palTokenToUnderlying[_palToken];
            // Exchange Rate = (Cash + Borrows - Reserve) / Supply
            uint _cash = IERC20(_underlying).balanceOf(address(this));
            uint _availableCash = _cash.add(poolStates[_underlying].totalBorrowed).sub(poolStates[_underlying].totalReserve);
            return _availableCash.mul(1e18).div(_totalSupply);
        }
    }

    /**
    * @notice Get the current exchange rate for the palToken
    * @dev Updates interest & Calls internal function _exchangeRate
    * @return uint : current exchange rate (scale 1e18)
    */
    function exchangeRateCurrent(address _palToken) external override returns (uint){
        _updateInterest();
        return _exchangeRate(_palToken);
    }
    
    /**
    * @notice Get the stored exchange rate for the palToken
    * @dev Calls internal function _exchangeRate
    * @return uint : current exchange rate (scale 1e18)
    */
    function exchangeRateStored(address _palToken) external view override returns (uint){
        return _exchangeRate(_palToken);
    }

    /**
    * @notice Return the minimum of fees to pay to borrow
    * @dev Fees to pay for a Borrow (for the minimum borrow length)
    * @return uint : minimum amount (in wei)
    */
    function minBorrowFees(address _underlying, uint _amount) public view override returns (uint){
        ISPSP _underlyingToken = ISPSP(_underlying);
        require(_amount <= underlyingBalance(_underlying), Errors.INSUFFICIENT_CASH);
        uint _amountConverted = _underlyingToken.PSPForSPSP(_amount); // in PSP
        //Future Borrow Rate with the amount to borrow counted as already borrowed
        uint _borrowRate = interestModule.getBorrowRate(address(this), underlyingBalance().sub(_amountConverted), totalBorrowed().add(_amountConverted), totalReserve());
        uint _minFees = minBorrowLength.mul(_amount.mul(_borrowRate)).div(mantissaScale); //in the underlying sPSP
        return _minFees > 0 ? _minFees : 1;
    }

    function isKillable(address _loan) external view override returns(bool){
        Borrow memory __borrow = loanToBorrow[_loan];
        if(__borrow.closed){
            return false;
        }

        //Calculate the amount of fee used, and check if the Loan is killable
        uint _feesUsed = (__borrow.amount.mul(borrowIndex).div(__borrow.borrowIndex)).sub(__borrow.amount);
        uint _loanHealthFactor = _feesUsed.mul(uint(1e18)).div(__borrow.feesAmount);
        return _loanHealthFactor >= killFactor;
    }

    /**
    * @dev Updates Interest and variables for all underlyings of this Pool
    * @return bool : Update success
    */
    function _updateInterest() public returns (bool){
        //Get the current block
        //Check if the Pool has already been updated this block
        uint _currentBlock = block.number;
        if(_currentBlock == accrualBlockNumber){
            return true;
        }

        //Get Pool variables from Storage
        uint _cash = underlyingBalance();
        uint _borrows = totalBorrowed();
        uint _reserves = totalReserve();
        uint _oldBorrowIndex = borrowIndex;

        //Get the Borrow Rate from the Interest Module
        uint _borrowRate = interestModule.getBorrowRate(address(this), _cash, _borrows, _reserves);

        //Delta of blocks since the last update
        uint _ellapsedBlocks = _currentBlock.sub(accrualBlockNumber);

        /*
        Interest Factor = Borrow Rate * Ellapsed Blocks
        Accumulated Interests = Interest Factor * Borrows
        Total Borrows = Borrows + Accumulated Interests
        Total Reserve = Reserve + Accumulated Interests * Reserve Factor
        Accrued Fees = Accrued Fees + Accumulated Interests * (Reserve Factor - Killer Ratio) -> (available fees should not count potential fees to send to killers)
        Borrow Index = old Borrow Index + old Borrow Index * Interest Factor 
        */
        uint _interestFactor = _borrowRate.mul(_ellapsedBlocks);

        //Update each underlying PoolState
        address[] memory _underlyings = underlyings;
        for(uint i = 0; i < _underlyings.length; i++){
            PoolState storage _state = poolStates[_underlyings[i]];

            uint _accumulatedInterest = _interestFactor.mul(_state.totalBorrowed).div(mantissaScale);
            uint _newBorrows = _state.totalBorrowed.add(_accumulatedInterest);
            uint _newReserve = _state.totalReserve.add(reserveFactor.mul(_accumulatedInterest).div(mantissaScale));
            uint _newAccruedFees = _state.accruedFees.add((reserveFactor.sub(killerRatio)).mul(_accumulatedInterest).div(mantissaScale));

            //Update storage
            _state.totalBorrowed = _newBorrows;
            _state.totalReserve = _newReserve;
            _state.accruedFees = _newAccruedFees;
        }

        uint _newBorrowIndex = _oldBorrowIndex.add(_interestFactor.mul(_oldBorrowIndex).div(1e18));
        accrualBlockNumber = _currentBlock;
        borrowIndex = _newBorrowIndex;

        return true;
    }

    


    // Admin Functions

    /**
    * @notice Set a new Controller
    * @dev Loads the new Controller for the Pool
    * @param  _newController address of the new Controller
    */
    function setNewController(address _newController) external override controllerOnly {
        controller = IPaladinController(_newController);
    }

    /**
    * @notice Set a new Interest Module
    * @dev Load a new Interest Module
    * @param _interestModule address of the new Interest Module
    */
    function setNewInterestModule(address _interestModule) external override adminOnly {
        interestModule = InterestInterface(_interestModule);
    }

    /**
    * @notice Set a new Delegator
    * @dev Change Delegator address
    * @param _delegator address of the new Delegator
    */
    function setNewDelegator(address _delegator) external override adminOnly {
        delegator = _delegator;
    }


    /**
    * @notice Set a new Minimum Borrow Length
    * @dev Change Minimum Borrow Length value
    * @param _length new Minimum Borrow Length
    */
    function updateMinBorrowLength(uint _length) external override adminOnly {
        require(_length > 0, Errors.INVALID_PARAMETERS);
        minBorrowLength = _length;
    }


    /**
    * @notice Update the Pool Reserve Factor & Killer Ratio
    * @dev Change Reserve Factor value & Killer Ratio value
    * @param _reserveFactor new % of fees to set as Reserve
    * @param _killerRatio new Ratio of Fees to pay the killer
    */
    function updatePoolFactors(uint _reserveFactor, uint _killerRatio) external override adminOnly {
        require(_reserveFactor > 0 && _killerRatio > 0 && _reserveFactor >= _killerRatio, 
            Errors.INVALID_PARAMETERS
        );
        reserveFactor = _reserveFactor;
        killerRatio = _killerRatio;
    }


    /**
    * @notice Add a new underlying & PalToken couple to the MultiPool
    * @dev Add new underlying & palToken to the contract listing
    * @param _underlying Address of the underlying
    * @param _palToken Address of the PalToken
    */
    function addUnderlying(address _underlying, address _palToken) external override adminOnly {
        require(_underlying != address(0));
        require(_palToken != address(0));
        require(!isUnderlyingListed(_underlying));

        underlyings.push(_underlying);

        palTokens[_underlying] = IPalToken(_palToken);
        palTokenToUnderlying[_palToken] = _underlying;

        emit AddUnderlying(_underlying, _palToken);
    }


    /**
    * @notice Add underlying in the Pool Reserve
    * @dev Transfer underlying token from the admin to the Pool
    * @param _underlying Address of the underlying
    * @param _amount Amount of underlying to transfer
    */
    function addReserve(address _underlying, uint _amount) external override adminOnly {
        require(isUnderlyingListed(_underlying));
        require(_updateInterest());

        //Load the right Pool state
        PoolState storage _state = poolStates[_underlying];

        _state.totalReserve = _state.totalReserve.add(_amount);

        //Transfer from the admin to the Pool
        IERC20(_underlying).safeTransferFrom(admin, address(this), _amount);

        emit AddReserve(_underlying, _amount);
    }

    /**
    * @notice Remove underlying from the Pool Reserve
    * @dev Transfer underlying token from the Pool to the admin
    * @param _underlying Address of the underlying
    * @param _amount Amount of underlying to transfer
    */
    function removeReserve(address _underlying, uint _amount) external override adminOnly {
        require(isUnderlyingListed(_underlying));
        //Check if there is enough in the reserve
        require(_updateInterest());

        //Load the right Pool state
        PoolState storage _state = poolStates[_underlying];
        require(_amount <= underlyingBalance(_underlying) && _amount <= _state.totalReserve, Errors.RESERVE_FUNDS_INSUFFICIENT);

        _state.totalReserve = _state.totalReserve.sub(_amount);

        //Transfer underlying to the admin
        IERC20(_underlying).safeTransfer(admin, _amount);

        emit RemoveReserve(_underlying, _amount);
    }

    /**
    * @notice Method to allow the Controller (or admin) to withdraw protocol fees
    * @dev Transfer underlying token from the Pool to the controller (or admin)
    * @param _underlying Address of the underlying
    * @param _amount Amount of underlying to transfer
    * @param _recipient Address to receive the token
    */
    function withdrawFees(address _underlying, uint _amount, address _recipient) external override controllerOnly {
        require(isUnderlyingListed(_underlying));
        //Check if there is enough in the reserve
        require(_updateInterest());

        //Load the right Pool state
        PoolState storage _state = poolStates[_underlying];
        require(_amount<= _state.accruedFees, Errors.FEES_ACCRUED_INSUFFICIENT);
        require(_amount <= underlyingBalance(_underlying) && _amount <= _state.totalReserve, Errors.RESERVE_FUNDS_INSUFFICIENT);

        //Substract from accruedFees (to track how much fees the Controller can withdraw since last time)
        //And also from the REserve, since the fees are part of the Reserve
        _state.accruedFees = _state.accruedFees.sub(_amount);
        _state.totalReserve = _state.totalReserve.sub(_amount);

        //Transfer fees to the recipient
        IERC20(_underlying).safeTransfer(_recipient, _amount);

        emit WithdrawFees(_underlying, _amount);
    }

}