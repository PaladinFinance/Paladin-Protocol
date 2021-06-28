//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "./PaladinControllerInterface.sol";
import "./PalLoanTokenInterface.sol";
import "./InterestInterface.sol";
import "./PalPoolInterface.sol";
import "./PalToken.sol";
import "./utils/IERC20.sol";

/** @title palPool Storage contract  */
/// @author Paladin
contract PalPoolStorage {

    /** @notice Struct of a Borrow */
    struct Borrow {
        //id of the palLoanToken
        uint256 tokenId;
        //address of the delegatee
        address delegatee;
        //address of the Loan Pool contract holding the loan
        address loan;
        //amount of the loan
        uint amount;
        //address of the underlying for this loan
        address underlying;
        //amount of fees (in the underlying token) paid by the borrower
        uint feesAmount;
        //amount of fees (in the underlying token) already used
        uint feesUsed;
        //borrow index at the loan creation
        uint borrowIndex;
        //start block for the Borrow
        uint startBlock;
        //block where the Borrow was closed
        uint closeBlock;
        //false if the loan is active, true if loan was closed or killed
        bool closed;
        //false when the loan is active, true if the loan was killed
        bool killed;
    }

    //palPool variables & Mappings

    /** @notice ERC721 palLoanToken */
    PalLoanTokenInterface public palLoanToken;

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

    /** @notice Minimum duration of a Borrow (in blocks) */
    uint public minBorrowLength = 45290;
    

    /** @dev Health Factor to kill a loan */
    uint public constant killFactor = 0.96e18;
    /** @dev Ratio of the borrow fees to pay the killer of a loan */
    uint public killerRatio = 0.15e18;

    /** @dev Base value to mint palTokens */
    uint internal constant initialExchangeRate = 1e18;
    /** @notice Part of the borrows interest to set as Reserves */
    uint public reserveFactor = 0.2e18;
    /** @notice Last block where the interest where updated for this pool */
    uint public accrualBlockNumber;
    /** @notice Borrow Index : increase at each interest update to represent borrows interests increasing (scaled 1e36) */
    uint public borrowIndex;

    /** @dev Scale used to represent decimal values */
    uint constant internal mantissaScale = 1e18;

    /** @dev Mapping of Loan Pool contract address to Borrow struct */
    mapping (address => Borrow) internal loanToBorrow;
    /** @dev List of all loans (current & closed) */
    address[] internal loans;


    //Modules

    /** @notice Paladin Controller contract */
    PaladinControllerInterface public controller;
    /** @dev Current Inetrest Module */
    InterestInterface internal interestModule;

    /** @dev Delegator for the underlying governance token */
    address internal delegator;
    
}