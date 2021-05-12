pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "./PaladinControllerInterface.sol";
import "./InterestInterface.sol";
import "./PalPoolInterface.sol";
import "./PalToken.sol";
import "./delegators/BasicDelegator.sol";
import "./utils/IERC20.sol";

/** @title palPool Storage contract  */
/// @author Paladin
contract PalPoolStorage {

    /** @notice Struct of a Borrow */
    struct Borrow {
        //address of the borrower
        address borrower;
        //address of the Loan Pool contract holding the loan
        address loan;
        //amount of the loan
        uint amount;
        //address of the underlying for this loan
        address underlying;
        //amount of fees (in the underlying token) paid by the borrower
        uint feesAmount;
        //borrow index at the loan creation
        uint borrowIndex;
        //true if the loan is active, false is loan was closed or killed
        bool closed;
    }

    //palPool variables & Mappings

    /** @notice Underlying ERC20 token of this Pool */
    IERC20 public underlying;

    /** @notice ERC20 palToken for this Pool */
    PalToken public palToken;

    /** @dev Boolean to prevent reentry in some functions */
    bool internal entered = false;

    /** @notice Total of the current Reserve */
    uint public totalReserve;
    /** @notice Total of underlying tokens "borrowed" (in Loan Pool contracts) */
    uint public totalBorrowed;


    /** @dev Maximum Borrow Rate to update interest */
    uint internal constant maxBorrowRate = 0.0002e18;

    /** @dev Healt Factor to kill a loan */
    uint internal constant killFactor = 0.98e18;
    /** @dev Ratio of the borrow fees to pay the killer of a loan */
    uint internal constant killerRatio = 0.15e18;

    /** @dev Base value to mint palTokens */
    uint internal initialExchangeRate = 0.02e18;
    /** @notice Part of the borrows interest to set as Reserves */
    uint public reserveFactor = 0.2e18;
    /** @notice Last block where the interest where updated for this pool */
    uint public accrualBlockNumber;
    /** @notice Borrow Index : increase at each interest update to represent borrows interests increasing */
    uint public borrowIndex;

    /** @dev Scale used to represent decimal values */
    uint constant internal mantissaScale = 1e18;

    /** @dev Mapping of all borrow contract address for each user */
    mapping (address => address[]) internal borrowsByUser;
    /** @dev Mapping of Loan Pool contract address to Borrow struct */
    mapping (address => Borrow) internal loanToBorrow;
    /** @dev List of all borrows (current & closed) */
    address[] internal borrows;


    //Modules

    /** @notice Paladin Controller contract */
    PaladinControllerInterface public controller;
    /** @dev Current Inetrest Module */
    InterestInterface internal interestModule;

    /** @dev Delegator for the underlying governance token */
    address internal delegator;
    
}