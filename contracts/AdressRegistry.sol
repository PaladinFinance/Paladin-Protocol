pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT


import "./utils/Admin.sol";

/** @title Paladin AddressRegistry  */
/// @author Paladin
contract AddressRegistry is Admin {

    address private controller;

    //underlying -> palToken
    mapping(address => address) private palPools;

    //underlying -> palToken
    mapping(address => address) private palTokens;

    //palPool -> palToken
    mapping(address => address) private palTokensByPool;



    constructor() {
        admin = msg.sender;
    }



    function getController() public view returns(address){
        return controller;
    }

    function getPool(address _underlying) public view returns(address){
        return palPools[_underlying];
    }

    function getToken(address _underlying) public view returns(address){
        return palTokens[_underlying];
    }

    function getTokenByPool(address _pool) public view returns(address){
        return palTokensByPool[_pool];
    }


    function _setController(address _newAddress) external adminOnly {
        controller = _newAddress;
    }

    function _setPool(address _underlying, address _pool, address _token) external adminOnly {
        palPools[_underlying] = _pool;
        palTokens[_underlying] = _token;
        palTokensByPool[_pool] = _token;
    }

}