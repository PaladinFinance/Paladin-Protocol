pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

import "../utils/Clones.sol";
import "../IPalLoan.sol";

// Test : contract used to clone Delegator and get PalLoans
contract PalLoanFactory {

    uint256 public deployedCount;
    address[] public deployedLoans;

    function createPalLoan(
        address _template,
        address _motherPool,
        address _borrower,
        address _underlying,
        address _delegatee,
        uint _amount,
        uint _feesAmount
    ) external {

        IPalLoan newLoan = IPalLoan(Clones.clone(_template));

        newLoan.initiate(
            _motherPool,
            _borrower,
            _underlying,
            _delegatee,
            _amount,
            _feesAmount
        );

        deployedCount = deployedCount + 1;
        deployedLoans.push(address(newLoan));

    }
}