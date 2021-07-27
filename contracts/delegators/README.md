# Paladin


Delegators modules


## Contracts

* [BasicDelegator](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/delegators/BasicDelegator.sol) : Delegation logic based on Compound Governor Alpha model (`COMP` & COMP-like tokens : `UNI`, ...)
* [AaveDelegator](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/delegators/AaveDelegator.sol) : Delegation logic based on the Aave Governance system : `AAVE` token.
* [AaveDelegatorClaimer](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/delegators/AaveDelegatorClaimer.sol) : Version of the `AaveDelegator` that claims rewards for the `stkAAVE` token.
* [SnapshotDelegator](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/delegators/SnapshotDelegator.sol) : Delegation logic based on the Gnosis Delegation Registry used in the Snapshot `delegation` strategy