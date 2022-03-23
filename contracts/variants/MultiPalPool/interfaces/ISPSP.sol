pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT


import "../../../utils/IERC20.sol";

interface ISPSP is IERC20 {
    function PSPBalance(address _account) external view returns (uint256 pspAmount_);
    function sPSPForPSP(uint256 _pspAmount) external view returns (uint256 sPSPAmount_);
    function PSPForSPSP(uint256 _sPSPAmount) external view returns (uint256 pspAmount_);

    // for tests only
    function enter(uint256 _pspAmount) external;
}
