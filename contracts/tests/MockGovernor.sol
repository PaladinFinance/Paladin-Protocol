pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT


contract MockGovernor {
    
    uint public proposalThreshold;
    uint public quorumVotes;

    constructor(){
        proposalThreshold = 65000e18;
        quorumVotes = 400000e18;
    }

    function changeValues(uint propThreshold, uint quorum) public {
        proposalThreshold = propThreshold;
        quorumVotes = quorum;
    }
}