//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity ^0.7.6;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "../../utils/SafeMath.sol";
import "./MultiPalPoolPSP.sol";
import "../../utils/IERC20.sol";
import "./interfaces/ISPSP.sol";



/** @title MultiPalPool Lens contract  */
/// @author Paladin
contract MultiPalPoolPSPLens {

    MultiPalPoolPSP public multiPool;

    constructor(
        address _multiPool
    ){
        multiPool = MultiPalPoolPSP(_multiPool);
    }

    struct BorrowOffer{
        address underlying;
        uint underlyingAmount;
        uint underlyingMinFeesAmount;
        uint pspMinFeesAmount;
    }

    function bestMinBorrowFees(uint _pspAmount) external view returns(BorrowOffer memory) {
        BorrowOffer memory _result;

        uint _underlyingCount = multiPool.underlyingCount();

        for(uint i = 0; i < _underlyingCount; i++){
            // Get the sPSP Pool
            ISPSP _spsp = ISPSP(multiPool.underlyings(i));
                
            // Convert the PSP amount (number of votes wanted) to the sPSP amount
            uint _spspBorrowAmount = _spsp.sPSPForPSP(_pspAmount);

            if(multiPool.underlyingBalance(address(_spsp)) >= _spspBorrowAmount){
                // Get the min borrow fees for that underlying
                uint _minBorrowFees = multiPool.minBorrowFees(address(_spsp), _spspBorrowAmount);

                // Convert it back to PSP
                uint _pspMinBorrowFees = _spsp.PSPForSPSP(_minBorrowFees);

                if(_result.pspMinFeesAmount == 0 || _pspMinBorrowFees < _result.pspMinFeesAmount){
                    _result.underlying = address(_spsp);
                    _result.underlyingAmount = _spspBorrowAmount;
                    _result.underlyingMinFeesAmount = _minBorrowFees;
                    _result.pspMinFeesAmount = _pspMinBorrowFees;
                }
            }
        }

        return _result;
    }

}