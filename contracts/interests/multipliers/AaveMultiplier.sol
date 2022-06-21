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
import "./utils/AAVE/IProposalValidator.sol";
import "./utils/AAVE/IAaveGovernanceV2.sol";
import "./utils/AAVE/IGovernanceStrategy.sol";
import "../../utils/Admin.sol";
import {Errors} from  "../../utils/Errors.sol";

/** @title Multiplier Calculator for Aave Governance  */
/// @author Paladin
contract AaveMultiplier is IMultiplierCalculator, Admin {

    uint256 private UNIT = 1e18;

    // Aave Governance contracts
    IProposalValidator public executor;
    IAaveGovernanceV2 public governance;
    IGovernanceStrategy public strategy;

    address[] public pools;

    uint256 public activationThreshold;

    constructor(
        address _governance,
        address _executor,
        address[] memory _pools
    ){
        admin = msg.sender;

        executor = IProposalValidator(_executor);
        governance = IAaveGovernanceV2(_governance);
        strategy = IGovernanceStrategy(governance.getGovernanceStrategy());

        activationThreshold = 0.75e18;
        
        for(uint i = 0; i < _pools.length; i++){
            pools.push(_pools[i]);
        }
    }

    function getCurrentMultiplier() external override view returns(uint){
        uint totalBorrowed = getTotalBorrowedMultiPools();
        uint proposalThreshold = executor.getMinimumPropositionPowerNeeded(governance, block.number);

        if(totalBorrowed > (proposalThreshold * activationThreshold) / UNIT){
            uint quorumAmount = executor.getMinimumVotingPowerNeeded(
                strategy.getTotalVotingSupplyAt(block.number)
            );

            uint leftPart = ((totalBorrowed * UNIT) / ((proposalThreshold * activationThreshold) / UNIT)) - UNIT;
            uint rightPart = (quorumAmount * UNIT) / totalBorrowed;

            return uint(1e18) + ((leftPart * rightPart) / UNIT);
        }
        //default case
        return 1e18;
    }


    function getTotalBorrowedMultiPools() internal view returns(uint){
        uint total = 0;
        address[] memory _pools = pools;
        for(uint i = 0; i < _pools.length; i++){
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
        for(uint i; i < _pools.length; i++){
            if(_pools[i] == _pool){
                uint lastIndex = _pools.length - 1;
                if(i != lastIndex){
                    pools[i] = pools[lastIndex];
                }
                pools.pop();
            }
        }
    }

    function updateGovernance(address newGovernance) external adminOnly {
        governance = IAaveGovernanceV2(newGovernance);
    }

    function updateGovernanceStrategy() external adminOnly {
        strategy = IGovernanceStrategy(governance.getGovernanceStrategy());
    }


    function updateExecutor(address newExecutor) external adminOnly {
        executor = IProposalValidator(newExecutor);
    }


    function updateActivationThreshold(uint newThreshold) external adminOnly {
        if(newThreshold < 0.5e18) revert Errors.InvalidParameters();
        if(newThreshold >= 1e18) revert Errors.InvalidParameters();
        activationThreshold = newThreshold;
    }

}