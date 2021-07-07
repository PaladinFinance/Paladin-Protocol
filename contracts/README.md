# Paladin


All the contracts of Paladin


## Subdirectories

* [delegators](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/delegators) : Delegators contracts, hosting the logic used by PalLoans
* [mock](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/mock) : Contracts used for unit tests
* [tokens](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/tokens) : Contracts of governance Tokens with delegation methods
* [utils](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/utils) : Usefull Libraries or Interfaces (from OpenZeppelin or other sources)
* [variants](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/variants) : Customized version of some contracts


## Contracts

* [PalPool](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/PalPool.sol) : Contract of the Pool, holding the governance token, and controlling a PalToken contract.
* [PalToken](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/PalToken.sol) : ERC20 token, controlled by a PalPool (minting & burning), representing the user's share of the PalPool
* [PalLoan](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/PalLoan.sol) : Contract deployed by a PalPool when voting power is borrowed, holding the tokens, and delegating the voting power
* [PalLoanToken](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/PalLoanToken.sol) : ERC721 token representing ownership of a PalLoan
* [PaladinController](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/PaladinController.sol) : Controller contract for the Paladin system
* [InterestCalculator](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/InterestCalculator.sol) : Interest calculator Module
* [AddressRegistry](https://github.com/PaladinFinance/Paladin-Protocol/blob/main/contracts/AddressRegistry.sol) : Lists all the deployed PalPools & PalTokens, the current Paladin Controller  & the PalLoanToken contract

