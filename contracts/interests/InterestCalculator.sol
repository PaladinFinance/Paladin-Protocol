//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT

import "./InterestInterface.sol";

import "../utils/SafeMath.sol";

/** @title Interest Module for Paladin PalPools  */
/// @author Paladin
contract InterestCalculator is InterestInterface {
    using SafeMath for uint;

    /** @notice admin address (contract creator) */
    address public admin;

    uint public multiplierPerBlock;
    /** @notice base borrow rate */
    uint public baseRatePerBlock;
    /** @notice mulitplier for borrow rate for the kink */
    uint public kinkMultiplierPerBlock;
    /** @notice borrow rate for the kink */
    uint public kinkBaseRatePerBlock;
    /** @notice  ratio of utilization rate at wihich we use kink_ values*/
    uint public constant kink = 0.8e18;
    

    constructor(){
        admin = msg.sender;

        uint blocksPerYear = 2336000;
        //Target yearly values for Borrow Rate
        multiplierPerBlock = uint(0.7e18).div(blocksPerYear);
        baseRatePerBlock = uint(0.57e18).div(blocksPerYear);
        kinkMultiplierPerBlock = uint(12.6e18).div(blocksPerYear);
        kinkBaseRatePerBlock = uint(1.13e18).div(blocksPerYear);
    }

    /**
    * @notice Calculates the Utilization Rate of a PalPool
    * @dev Calculates the Utilization Rate of a PalPool depending of Cash, Borrows & Reserves
    * @param cash Cash amount of the calling PalPool
    * @param borrows Total Borrowed amount of the calling PalPool
    * @param reserves Total Reserves amount of the calling PalPool
    * @return uint : Utilisation Rate of the Pool (scale 1e18)
    */
    function utilizationRate(uint cash, uint borrows, uint reserves) public pure returns(uint){
        //If no funds are borrowed, the Pool is not used
        if(borrows == 0){
            return 0;
        }
        // Utilization Rate = Borrows / (Cash + Borrows - Reserves)
        return borrows.mul(1e18).div(cash.add(borrows).sub(reserves));
    }

    /**
    * @notice Calculates the Supply Rate for the calling PalPool
    * @dev Calculates the Supply Rate depending on the Pool Borrow Rate & Reserve Factor
    * @param palPool Address of the PalPool calling the function
    * @param cash Cash amount of the calling PalPool
    * @param borrows Total Borrowed amount of the calling PalPool
    * @param reserves Total Reserves amount of the calling PalPool
    * @param reserveFactor Reserve Factor of the calling PalPool
    * @return uint : Supply Rate for the Pool (scale 1e18)
    */
    function getSupplyRate(address palPool, uint cash, uint borrows, uint reserves, uint reserveFactor) external view override returns(uint){
        palPool; //Useless, needed to match the Interface
        
        //Fetch the Pool Utilisation Rate & Borrow Rate
        uint _utilRate = utilizationRate(cash, borrows, reserves);
        uint _bRate = _borrowRate(cash, borrows, reserves);

        //Supply Rate = Utilization Rate * (Borrow Rate - Reserve Factor)
        uint _tempRate = _bRate.mul(uint(1e18).sub(reserveFactor)).div(1e18);
        return _utilRate.mul(_tempRate).div(1e18);
    }
    
    /**
    * @notice Get the Borrow Rate for a PalPool depending on the given parameters
    * @dev Calls the internal fucntion _borrowRate
    * @param palPool Address of the PalPool calling the function
    * @param cash Cash amount of the calling PalPool
    * @param borrows Total Borrowed amount of the calling PalPool
    * @param reserves Total Reserves amount of the calling PalPool
    * @return uint : Borrow Rate for the Pool (scale 1e18)
    */
    function getBorrowRate(address palPool, uint cash, uint borrows, uint reserves) external view override returns(uint){
        palPool; //Useless, needed to match the Interface
        
        //Internal call
        return _borrowRate(cash, borrows, reserves);
    }

    /**
    * @dev Calculates the Borrow Rate for the PalPool, depending on the utilisation rate & the kink value.
    * @param cash Cash amount of the calling PalPool
    * @param borrows Total Borrowed amount of the calling PalPool
    * @param reserves Total Reserves amount of the calling PalPool
    * @return uint : Borrow Rate for the Pool (scale 1e18)
    */
    function _borrowRate(uint cash, uint borrows, uint reserves) internal view returns(uint){
        //Fetch the utilisation rate
        uint _utilRate = utilizationRate(cash, borrows, reserves);
        //If the Utilization Rate is less than the Kink value
        // Borrow Rate = Multiplier * Utilization Rate + Base Rate
        if(_utilRate < kink) {
            return _utilRate.mul(multiplierPerBlock).div(1e18).add(baseRatePerBlock);
        }
        //If the Utilization Rate is more than the Kink value
        // Borrow Rate = Kink Multiplier * (Utilization Rate - 0.8) + Kink Rate
        else {
            uint _temp = _utilRate.sub(0.8e18);
            return kinkMultiplierPerBlock.mul(_temp).div(1e18).add(kinkBaseRatePerBlock);
        }
    }
}