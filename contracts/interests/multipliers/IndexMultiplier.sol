//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

import "./IMultiplierCalculator.sol";
import "./utils/IPalPoolSimplified.sol";
import "../../utils/Admin.sol";
import {Errors} from  "../../utils/Errors.sol";

/** @title Multiplier Calculator for Index Coop Governance  */
/// @author Paladin
contract IndexMultiplier is IMultiplierCalculator, Admin {

    address[] public pools;

    uint256 public activationThreshold;
    uint256 public activationFactor = 1000; //BPS

    uint256 public currentQuorum;

    uint256 public baseMultiplier = 10e18;

    constructor(
        uint256 _currentQuorum,
        address[] memory _pools
    ){
        admin = msg.sender;

        currentQuorum = _currentQuorum;

        activationThreshold = (_currentQuorum * activationFactor) / 10000;
        
        for(uint256 i = 0; i < _pools.length; i++){
            pools.push(_pools[i]);
        }
    }

    function getCurrentMultiplier() external override view returns(uint256){
        uint256 totalBorrowed = getTotalBorrowedMultiPools();

        if(totalBorrowed > activationThreshold){

            return (baseMultiplier * totalBorrowed) / currentQuorum;
        }
        //default case
        return 1e18;
    }


    function getTotalBorrowedMultiPools() internal view returns(uint256){
        uint256 total;
        address[] memory _pools = pools;
        uint256 length = _pools.length;
        for(uint256 i; i < length; i++){
            total += IPalPoolSimplified(_pools[i]).totalBorrowed();
        }
        return total;
    }



    //Admin functions

    function addPool(address _pool) external adminOnly {
        pools.push(_pool);
    }

    function removePool(address _pool) external adminOnly {
        address[] memory _pools = pools;
        uint256 length = _pools.length;
        for(uint256 i; i < length; i++){
            if(_pools[i] == _pool){
                uint256 lastIndex = length - 1;
                if(i != lastIndex){
                    pools[i] = pools[lastIndex];
                }
                pools.pop();
            }
        }
    }

    function updateBaseMultiplier(uint256 newBaseMultiplier) external adminOnly {
        if(newBaseMultiplier == 0) revert Errors.InvalidParameters();
        baseMultiplier = newBaseMultiplier;
    }

    function updateQuorum(uint256 newQuorum) external adminOnly {
        if(newQuorum == 0) revert Errors.InvalidParameters();
        currentQuorum = newQuorum;

        //Update activationThreshold
        activationThreshold = (newQuorum * activationFactor) / 10000;
    }

    function updateActivationFactor(uint256 newFactor) external adminOnly {
        if(newFactor > 10000) revert Errors.InvalidParameters();
        if(newFactor == 0) revert Errors.InvalidParameters();
        activationFactor = newFactor;

        //Update activationThreshold
        activationThreshold = (currentQuorum * newFactor) / 10000;
    }

}