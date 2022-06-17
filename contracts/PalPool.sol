//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

import "./utils/SafeERC20.sol";
import "./utils/Clones.sol";
import "./IPalPool.sol";
import "./PalPoolStorage.sol";
import "./IPalLoan.sol";
import "./IPalToken.sol";
import "./IPaladinController.sol";
import "./IPalLoanToken.sol";
import "./interests/InterestInterface.sol";
import "./utils/IERC20.sol";
import "./utils/Admin.sol";
import "./utils/ReentrancyGuard.sol";
import {Errors} from  "./utils/Errors.sol";



/** @title PalPool contract  */
/// @author Paladin
contract PalPool is IPalPool, PalPoolStorage, Admin, ReentrancyGuard {
    using SafeERC20 for IERC20;


    modifier controllerOnly() {
        //allows only the Controller and the admin to call the function
        if(msg.sender != admin && msg.sender != address(controller)) revert Errors.CallerNotController();
        _;
    }



    //Functions

    constructor(
        address _palToken,
        address _controller, 
        address _underlying,
        address _interestModule,
        address _delegator,
        address _palLoanToken
    ){
        //Set admin
        admin = msg.sender;

        //Set inital values & modules
        palToken = IPalToken(_palToken);
        controller = IPaladinController(_controller);
        underlying = IERC20(_underlying);
        accrualBlockNumber = block.number;
        interestModule = InterestInterface(_interestModule);
        borrowIndex = 1e18;
        delegator = _delegator;
        palLoanToken = IPalLoanToken(_palLoanToken);
    }

    /**
    * @notice Get the underlying balance for this Pool
    * @dev Get the underlying balance of this Pool
    * @return uint : balance of this pool in the underlying token
    */
    function underlyingBalance() public view returns(uint){
        //Return the balance of this contract for the underlying asset
        return underlying.balanceOf(address(this));
    }

    /**
    * @notice Deposit underlying in the Pool
    * @dev Deposit underlying, and mints palToken for the user
    * @param _amount Amount of underlying to deposit
    * @return bool : amount of minted palTokens
    */
    function deposit(uint _amount) public virtual override nonReentrant returns(uint){
        if(!_updateInterest()) revert Errors.FailUpdateInterest();

        //Retrieve the current exchange rate palToken:underlying
        uint _exchRate = _exchangeRate();


        //Find the amount to mint depending on the amount to transfer
        uint _toMint = (_amount * mantissaScale) / _exchRate;

        //Transfer the underlying to this contract
        //The amount of underlying needs to be approved before
        underlying.safeTransferFrom(msg.sender, address(this), _amount);

        //Mint the palToken
        if(!palToken.mint(msg.sender, _toMint)) revert Errors.FailMint();

        //Emit the Deposit event
        emit Deposit(msg.sender, _amount, address(this));

        //Use the controller to check if the minting was successfull
        if(!controller.depositVerify(address(this), msg.sender, _toMint)) revert Errors.FailDeposit();

        return _toMint;
    }

    /**
    * @notice Withdraw underliyng token from the Pool
    * @dev Transfer underlying token to the user, and burn the corresponding palToken amount
    * @param _amount Amount of palToken to return
    * @return uint : amount of underlying returned
    */
    function withdraw(uint _amount) public virtual override nonReentrant returns(uint){
        if(!_updateInterest()) revert Errors.FailUpdateInterest();
        if(balanceOf(msg.sender) < _amount) revert Errors.InsufficientBalance();

        //Retrieve the current exchange rate palToken:underlying
        uint _exchRate = _exchangeRate();

        //Find the amount to return depending on the amount of palToken to burn
        uint _toReturn = (_amount * _exchRate) / mantissaScale;

        //Check if the pool has enough underlying to return
        if(_toReturn > underlyingBalance()) revert Errors.InsufficientCash();

        //Burn the corresponding palToken amount
        if(!palToken.burn(msg.sender, _amount)) revert Errors.FailBurn();

        //Make the underlying transfer
        underlying.safeTransfer(msg.sender, _toReturn);

        //Use the controller to check if the burning was successfull
        if(!controller.withdrawVerify(address(this), msg.sender, _toReturn)) revert Errors.FailWithdraw();

        //Emit the Withdraw event
        emit Withdraw(msg.sender, _amount, address(this));

        return _toReturn;
    }

    /**
    * @dev Create a Borrow, deploy a Loan Pool and delegate voting power
    * @param _delegatee Address to delegate the voting power to
    * @param _amount Amount of underlying to borrow
    * @param _feeAmount Amount of fee to pay to start the loan
    * @return uint : new PalLoanToken Id
    */
    function borrow(address _delegatee, uint _amount, uint _feeAmount) public virtual override nonReentrant returns(uint){
        //Need the pool to have enough liquidity, and the interests to be up to date
        if(_amount > underlyingBalance()) revert Errors.InsufficientCash();
        if(_delegatee == address(0)) revert Errors.ZeroAddress();
        if(_amount == 0) revert Errors.ZeroBorrow();
        if(_feeAmount < minBorrowFees(_amount)) revert Errors.BorrowInsufficientFees();
        if(!_updateInterest()) revert Errors.FailUpdateInterest();

        address _borrower = msg.sender;

        //Update Total Borrowed & number active Loans
        numberActiveLoans += 1;
        totalBorrowed += _amount;

        IPalLoan _newLoan = IPalLoan(Clones.clone(delegator));

        //Send the borrowed amount of underlying tokens to the Loan
        underlying.safeTransfer(address(_newLoan), _amount);

        //And transfer the fees from the Borrower to the Loan
        underlying.safeTransferFrom(_borrower, address(_newLoan), _feeAmount);

        //Start the Loan (and delegate voting power)
        if(!_newLoan.initiate(
            address(this),
            _borrower,
            address(underlying),
            _delegatee,
            _amount,
            _feeAmount
        )) revert Errors.FailLoanInitiate();

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
            address(underlying),
            _feeAmount,
            0,
            borrowIndex,
            block.number,
            0,
            false,
            false
        );

        //Check the borrow succeeded
        if(
            !controller.borrowVerify(address(this), _borrower, _delegatee, _amount, _feeAmount, address(_newLoan))
        ) revert Errors.FailBorrow();

        //Emit the NewLoan Event
        emit NewLoan(
            _borrower,
            _delegatee,
            address(underlying),
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
        if(_borrow.closed) revert Errors.LoanClosed();
        if(!isLoanOwner(_loan, msg.sender)) revert Errors.NotLoanOwner();
        if(_feeAmount == 0) revert Errors.BorrowInsufficientFees();
        if(!_updateInterest()) revert Errors.FailUpdateInterest();
        
        //Load the Loan Pool contract & get Loan owner
        IPalLoan _palLoan = IPalLoan(_borrow.loan);

        address _loanOwner = palLoanToken.ownerOf(_borrow.tokenId);

        _borrow.feesAmount += _feeAmount;

        //Transfer the new fees to the Loan
        //If success, call the expand function of the Loan
        underlying.safeTransferFrom(_loanOwner, _borrow.loan, _feeAmount);

        if(!_palLoan.expand(_feeAmount)) revert Errors.FailLoanExpand();

        if(
            !controller.expandBorrowVerify(address(this), _loan, _feeAmount)
        ) revert Errors.FailLoanExpand();

        emit ExpandLoan(
            _loanOwner,
            _borrow.delegatee,
            address(underlying),
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
        if(_borrow.closed) revert Errors.LoanClosed();
        if(!isLoanOwner(_loan, msg.sender)) revert Errors.NotLoanOwner();
        if(!_updateInterest()) revert Errors.FailUpdateInterest();

        //Get Loan owner from the ERC721 contract
        address _loanOwner = palLoanToken.ownerOf(_borrow.tokenId);

        //Load the Loan contract
        IPalLoan _palLoan = IPalLoan(_borrow.loan);

        //Calculates the amount of fees used
        uint _feesUsed = ((_borrow.amount * borrowIndex) / _borrow.borrowIndex) - _borrow.amount;
        uint _penaltyFees;
        uint _totalFees = _feesUsed;

        //If the Borrow is closed before the minimum length, calculates the penalty fees to pay
        // -> Number of block remaining to complete the minimum length * current Borrow Rate
        if(block.number < (_borrow.startBlock + minBorrowLength)){
            uint _currentBorrowRate = interestModule.getBorrowRate(address(this), underlyingBalance(), totalBorrowed, totalReserve);
            uint _missingBlocks = (_borrow.startBlock + minBorrowLength) - block.number;
            _penaltyFees = _missingBlocks * ((_borrow.amount * _currentBorrowRate) / mantissaScale);
            _totalFees += _penaltyFees;
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

        //Remove the borrowed tokens + fees from the TotalBorrowed
        //Add to the Reserve the reserveFactor of Penalty Fees (if there is Penalty Fees)
        //And add the fees counted as potential Killer Fees to the Accrued Fees, since no killing was necessary

        numberActiveLoans -= 1;

        totalBorrowed = numberActiveLoans == 0 ? 0 : totalBorrowed - (_borrow.amount + _feesUsed); //If not current active Loan, we can just reset the totalBorrowed to 0

        uint _realPenaltyFees = _totalFees - _feesUsed;
        uint _killerFees = (_feesUsed * killerRatio) / mantissaScale;
        totalReserve += (reserveFactor * _realPenaltyFees) / mantissaScale;
        accruedFees += _killerFees + ((reserveFactor * _realPenaltyFees) / mantissaScale);
        
        //Close and destroy the loan
        _palLoan.closeLoan(_totalFees, _loanOwner);

        //Burn the palLoanToken for this Loan
        if(!palLoanToken.burn(_borrow.tokenId)) revert Errors.FailLoanTokenBurn();

        if(!controller.closeBorrowVerify(address(this), _loanOwner, _borrow.loan)) revert Errors.FailCloseBorrow();

        //Emit the CloseLoan Event
        emit CloseLoan(
            _loanOwner,
            _borrow.delegatee,
            address(underlying),
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
        if(_borrow.closed) revert Errors.LoanClosed();
        if(isLoanOwner(_loan, killer)) revert Errors.LoanOwner();
        if(!_updateInterest()) revert Errors.FailUpdateInterest();

        //Get the owner of the Loan through the ERC721 contract
        address _loanOwner = palLoanToken.ownerOf(_borrow.tokenId);

        //Calculate the amount of fee used, and check if the Loan is killable
        uint _feesUsed = ((_borrow.amount * borrowIndex) / _borrow.borrowIndex) - _borrow.amount;
        uint _loanHealthFactor = (_feesUsed * uint(1e18)) / _borrow.feesAmount;
        if(_loanHealthFactor < killFactor) revert Errors.NotKillable();

        //Load the Loan
        IPalLoan _palLoan = IPalLoan(_borrow.loan);

        //Close the Loan, and update storage variables
        _borrow.closed = true;
        _borrow.killed = true;
        _borrow.feesUsed = _borrow.feesAmount;
        _borrow.closeBlock = block.number;

        //Remove the borrowed tokens + fees from the TotalBorrowed
        //Remove the amount paid as killer fees from the Reserve, and any over accrued interest in the Reserve & AccruedFees
        uint _overAccruedInterest = _loanHealthFactor <= mantissaScale ? 0 : _feesUsed - _borrow.feesAmount;
        uint _killerFees = (_borrow.feesAmount * killerRatio) / mantissaScale;

        numberActiveLoans -= 1;

        totalBorrowed = numberActiveLoans == 0 ? 0 : totalBorrowed - (_borrow.amount + _feesUsed); //If not current active Loan, we can just reset the totalBorrowed to 0

        totalReserve = totalReserve - _killerFees - ((_overAccruedInterest * reserveFactor) / mantissaScale);
        accruedFees -= (_overAccruedInterest * (reserveFactor - killerRatio)) / mantissaScale;

        //Kill the Loan
        _palLoan.killLoan(killer, killerRatio);

        //Burn the palLoanToken for this Loan
        if(!palLoanToken.burn(_borrow.tokenId)) revert Errors.FailLoanTokenBurn();

        if(!controller.killBorrowVerify(address(this), killer, _borrow.loan)) revert Errors.FailKillBorrow();

        //Emit the CloseLoan Event
        emit CloseLoan(
            _loanOwner,
            _borrow.delegatee,
            address(underlying),
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
        if(_borrow.closed) revert Errors.LoanClosed();
        if(_newDelegatee == address(0)) revert Errors.ZeroAddress();
        if(!isLoanOwner(_loan, msg.sender)) revert Errors.NotLoanOwner();
        if(!_updateInterest()) revert Errors.FailUpdateInterest();

        //Load the Loan Pool contract
        IPalLoan _palLoan = IPalLoan(_borrow.loan);

        //Update storage data
        _borrow.delegatee = _newDelegatee;

        //Call the delegation logic in the palLoan to change the votong power recipient
        if(!_palLoan.changeDelegatee(_newDelegatee)) revert Errors.FailLoanDelegateeChange();

        //Emit the Event
        emit ChangeLoanDelegatee(
            palLoanToken.ownerOf(_borrow.tokenId),
            _newDelegatee,
            address(underlying),
            address(this),
            _borrow.loan,
            _borrow.tokenId
        );

    }


    /**
    * @notice Return the user's palToken balance
    * @dev Links the PalToken balanceOf() method
    * @param _account User address
    * @return uint256 : user palToken balance (in wei)
    */
    function balanceOf(address _account) public view override returns(uint){
        return palToken.balanceOf(_account);
    }


    /**
    * @notice Return the corresponding balance of the pool underlying token depending on the user's palToken balance
    * @param _account User address
    * @return uint256 : corresponding balance in the underlying token (in wei)
    */
    function underlyingBalanceOf(address _account) external view override returns(uint){
        uint _balance = palToken.balanceOf(_account);
        if(_balance == 0){
            return 0;
        }
        uint _exchRate = _exchangeRate();
        return (_balance * _exchRate) / mantissaScale;
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
            _borrow.closed ? _borrow.feesUsed : ((_borrow.amount * borrowIndex) / _borrow.borrowIndex) - _borrow.amount,
            _borrow.startBlock,
            _borrow.closeBlock,
            _borrow.closed,
            _borrow.killed
        );

    }
    
    /**
    * @notice Get the Borrow Rate for this Pool
    * @dev Get the Borrow Rate from the Interest Module
    * @return uint : Borrow Rate (scale 1e18)
    */
    function borrowRatePerBlock() external view override returns (uint){
        return interestModule.getBorrowRate(address(this), underlyingBalance(), totalBorrowed, totalReserve);
    }
    
    /**
    * @notice Get the Supply Rate for this Pool
    * @dev Get the Supply Rate from the Interest Module
    * @return uint : Supply Rate (scale 1e18)
    */
    function supplyRatePerBlock() external view override returns (uint){
        return interestModule.getSupplyRate(address(this), underlyingBalance(), totalBorrowed, totalReserve, reserveFactor);
    }

    
    /**
    * @dev Calculates the current exchange rate
    * @return uint : current exchange rate (scale 1e18)
    */
    function _exchangeRate() internal view returns (uint){
        uint _totalSupply = palToken.totalSupply();
        //If no palTokens where minted, use the initial exchange rate
        if(_totalSupply == 0){
            return initialExchangeRate;
        }
        else{
            // Exchange Rate = (Cash + Borrows - Reserve) / Supply
            uint _cash = underlyingBalance();
            uint _availableCash = _cash + totalBorrowed - totalReserve;
            return (_availableCash * mantissaScale) / _totalSupply;
        }
    }

    /**
    * @notice Get the current exchange rate for the palToken
    * @dev Updates interest & Calls internal function _exchangeRate
    * @return uint : current exchange rate (scale 1e18)
    */
    function exchangeRateCurrent() external override returns (uint){
        _updateInterest();
        return _exchangeRate();
    }
    
    /**
    * @notice Get the stored exchange rate for the palToken
    * @dev Calls internal function _exchangeRate
    * @return uint : current exchange rate (scale 1e18)
    */
    function exchangeRateStored() external view override returns (uint){
        return _exchangeRate();
    }

    /**
    * @notice Return the minimum of fees to pay to borrow
    * @dev Fees to pay for a Borrow (for the minimum borrow length)
    * @return uint : minimum amount (in wei)
    */
    function minBorrowFees(uint _amount) public view override returns (uint){
        if(_amount > underlyingBalance()) revert Errors.InsufficientCash();
        //Future Borrow Rate with the amount to borrow counted as already borrowed
        uint _borrowRate = interestModule.getBorrowRate(address(this), underlyingBalance() - _amount, totalBorrowed + _amount, totalReserve);
        uint _minFees = (minBorrowLength * (_amount * _borrowRate)) / mantissaScale;
        return _minFees > 0 ? _minFees : 1;
    }

    function isKillable(address _loan) external view override returns(bool){
        Borrow memory __borrow = loanToBorrow[_loan];
        if(__borrow.closed){
            return false;
        }

        //Calculate the amount of fee used, and check if the Loan is killable
        uint _feesUsed = ((__borrow.amount * borrowIndex) / __borrow.borrowIndex) - __borrow.amount;
        uint _loanHealthFactor = (_feesUsed * mantissaScale) / __borrow.feesAmount;
        return _loanHealthFactor >= killFactor;
    }

    /**
    * @dev Updates Inetrest and variables for this Pool
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
        uint _borrows = totalBorrowed;
        uint _reserves = totalReserve;
        uint _accruedFees = accruedFees;
        uint _oldBorrowIndex = borrowIndex;

        //Get the Borrow Rate from the Interest Module
        uint _borrowRate = interestModule.getBorrowRate(address(this), _cash, _borrows, _reserves);

        //Delta of blocks since the last update
        uint _ellapsedBlocks = _currentBlock - accrualBlockNumber;

        /*
        Interest Factor = Borrow Rate * Ellapsed Blocks
        Accumulated Interests = Interest Factor * Borrows
        Total Borrows = Borrows + Accumulated Interests
        Total Reserve = Reserve + Accumulated Interests * Reserve Factor
        Accrued Fees = Accrued Fees + Accumulated Interests * (Reserve Factor - Killer Ratio) -> (available fees should not count potential fees to send to killers)
        Borrow Index = old Borrow Index + old Borrow Index * Interest Factor 
        */
        uint _interestFactor = _borrowRate * _ellapsedBlocks;
        uint _accumulatedInterest = (_interestFactor * _borrows) / mantissaScale;
        uint _newBorrows = _borrows + _accumulatedInterest;
        uint _newReserve = _reserves + ((reserveFactor * _accumulatedInterest) / mantissaScale);
        uint _newAccruedFees = _accruedFees + (((reserveFactor - killerRatio) * _accumulatedInterest) / mantissaScale);
        uint _newBorrowIndex = _oldBorrowIndex + ((_interestFactor * _oldBorrowIndex) / mantissaScale);

        //Update storage
        totalBorrowed = _newBorrows;
        totalReserve = _newReserve;
        accruedFees = _newAccruedFees;
        borrowIndex = _newBorrowIndex;
        accrualBlockNumber = _currentBlock;

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
        if(_length == 0) revert Errors.InvalidParameters();
        minBorrowLength = _length;
    }


    /**
    * @notice Update the Pool Reserve Factor & Killer Ratio
    * @dev Change Reserve Factor value & Killer Ratio value
    * @param _reserveFactor new % of fees to set as Reserve
    * @param _killerRatio new Ratio of Fees to pay the killer
    */
    function updatePoolFactors(uint _reserveFactor, uint _killerRatio) external override adminOnly {
        if(_reserveFactor == 0 || _killerRatio == 0 || _reserveFactor < _killerRatio) revert Errors.InvalidParameters();
        reserveFactor = _reserveFactor;
        killerRatio = _killerRatio;
    }


    /**
    * @notice Add underlying in the Pool Reserve
    * @dev Transfer underlying token from the admin to the Pool
    * @param _amount Amount of underlying to transfer
    */
    function addReserve(uint _amount) external override adminOnly {
        if(!_updateInterest()) revert Errors.FailUpdateInterest();

        totalReserve += _amount;

        //Transfer from the admin to the Pool
        underlying.safeTransferFrom(admin, address(this), _amount);

        emit AddReserve(_amount);
    }

    /**
    * @notice Remove underlying from the Pool Reserve
    * @dev Transfer underlying token from the Pool to the admin
    * @param _amount Amount of underlying to transfer
    */
    function removeReserve(uint _amount) external override adminOnly {
        //Check if there is enough in the reserve
        if(!_updateInterest()) revert Errors.FailUpdateInterest();
        if(_amount > underlyingBalance() || _amount > totalReserve) revert Errors.ReserveFundsInsufficient();

        totalReserve -= _amount;

        //Transfer underlying to the admin
        underlying.safeTransfer(admin, _amount);

        emit RemoveReserve(_amount);
    }

    /**
    * @notice Method to allow the Controller (or admin) to withdraw protocol fees
    * @dev Transfer underlying token from the Pool to the controller (or admin)
    * @param _amount Amount of underlying to transfer
    * @param _recipient Address to receive the token
    */
    function withdrawFees(uint _amount, address _recipient) external override controllerOnly {
        //Check if there is enough in the reserve
        if(!_updateInterest()) revert Errors.FailUpdateInterest();
        if(_amount > accruedFees || _amount > totalReserve) revert Errors.FeesAccruedInsufficient();

        //Substract from accruedFees (to track how much fees the Controller can withdraw since last time)
        //And also from the REserve, since the fees are part of the Reserve
        accruedFees -= _amount;
        totalReserve -= _amount;

        //Transfer fees to the recipient
        underlying.safeTransfer(_recipient, _amount);

        emit WithdrawFees(_amount);
    }

    /**
     * @dev Recover either a lost ERC20 token sent to the contract (expect the underlying)
     * @param token ERC20 token to withdraw
     * @param amount Amount to transfer
     */
    function recoverERC20(address token, uint256 amount) external adminOnly virtual returns(bool) {
        if(token == address(underlying) || token == address(0)) revert Errors.InvalidToken();
        if(amount == 0 || amount > IERC20(token).balanceOf(address(this))) revert Errors.InvalidAmount();
        IERC20(token).safeTransfer(admin, amount);

        return true;
    }

}