pragma solidity ^0.7.6;
//SPDX-License-Identifier: MIT


/** @title Admin contract  */
/// @author Paladin
contract Admin {

    /** @dev Admin address for this Pool */
    address payable internal admin;
    
    modifier adminOnly() {
        //allows onyl the admin of this contract to call the function
        require(msg.sender == admin, '1');
        _;
    }

        /**
    * @notice Set a new Admin
    * @dev Changes the address for the admin parameter
    * @param _newAdmin address of the new Controller Admin
    */
    function setNewAdmin(address payable _newAdmin) external adminOnly {
        admin = _newAdmin;
    }
}