# Paladin


Variants of some Paladin contracts


## Subdirectories

* [palStkAave](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/variants/*.sol) : PalPool for `stkAAVE`, with a custom method to claim `AAVE` rewards from the `Aave Safety Module`, and stake them to increase the PalPool's `stkAAVE` balance (to distribute the rewards to users)
* [DoomsdayController](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts/variants/DoomsdayController.sol) : Controller reverting most actions of the `PalPools`