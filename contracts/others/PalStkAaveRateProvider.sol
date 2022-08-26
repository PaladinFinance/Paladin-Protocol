//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                               

pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

interface IRateProvider {
    function getRate() external view returns (uint256);
}

// PalPool Minimal Interface
interface IPalPool {

    function exchangeRateStored() external view returns(uint);
    function exchangeRateCurrent() external returns(uint);

}

// Paladin Controller Minimal Interface
interface IPaladinController {
    
    function palTokenToPalPool(address palToken) external view returns(address);
}

/** @title RateProvider for palStkAave (used in Balancer's Metastable Pools) */
/// @author Paladin
contract PalStkAaveRateProvider is IRateProvider {

    /** @dev 1e18 mantissa used for calculations */
    uint256 internal constant MANTISSA_SCALE = 1e18;

    IPalPool public immutable palStkAavePool;

    constructor(IPalPool _palStkAavePool) {
        palStkAavePool = _palStkAavePool;
    }

    /**
     * @return the value of palStkAAVE in terms of stkAAVE (where 1 stkAAVE redeems 1 AAVE in the Aave Safety Module)
     *  !!! Uses the last stored exchange rate, not one calculated based on current block
     */
    function getRate() external view override returns (uint256) {
        uint256 exchangeRate = palStkAavePool.exchangeRateStored();

        return (1e18 * exchangeRate) / MANTISSA_SCALE;
    }

}