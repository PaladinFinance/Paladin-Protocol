//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
                                                     

pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

import "./utils/IERC20.sol";
import "./utils/Admin.sol";
import {Errors} from  "./utils/Errors.sol";

/** @title palToken ERC20 contract  */
/// @author Paladin
contract PalToken is IERC20, Admin {

    //ERC20 Variables & Mappings :

    /** @notice ERC20 token Name */
    string public name;
    /** @notice ERC20 token Symbol */
    string public symbol;
    /** @notice ERC20 token Decimals */
    uint public decimals;

    // ERC20 total Supply
    uint private _totalSupply;


    //don't want to initiate the contract twice
    bool private initialized;


    /** @notice PalPool contract that can Mint/Burn this token */
    address public palPool;


    /** @dev Balances for this ERC20 token */
    mapping(address => uint) internal balances;
    /** @dev Allowances for this ERC20 token, sorted by user */
    mapping(address => mapping (address => uint)) internal transferAllowances;


    /** @dev Modifier so only the PalPool linked to this contract can Mint/Burn tokens */
    modifier onlyPool() {
        if(msg.sender != palPool) revert Errors.CallerNotAllowedPool();
        _;
    }


    //Functions : 


    constructor (string memory name_, string memory symbol_) {
        admin = msg.sender;

        name = name_;
        symbol = symbol_;
        decimals = 18;
        initialized = false;
    }


    function initiate(address _palPool) external adminOnly returns (bool){
        if(initialized) revert Errors.AlreadyInitialized();

        initialized = true;
        palPool = _palPool;

        return true;
    }


    function totalSupply() external override view returns (uint256){
        return _totalSupply;
    }


    function transfer(address dest, uint amount) external override returns(bool){
        return _transfer(msg.sender, dest, amount);
    }


    function transferFrom(address src, address dest, uint amount) external override returns(bool){
        if(transferAllowances[src][msg.sender] < amount) revert Errors.AllowanceTooLow();

        unchecked {
            // Safe, value was checked before
            transferAllowances[src][msg.sender] -= amount;
        }

        _transfer(src, dest, amount);

        return true;
    }


    function _transfer(address src, address dest, uint amount) internal returns(bool){
        //Check if the transfer is possible
        if(balances[src] < amount) revert Errors.BalanceTooLow();
        if(dest == src) revert Errors.SelfTransfer();
        if(src == address(0) || dest == address(0)) revert Errors.ZeroAddress();

        //Update balances
        unchecked {
            // No underflow, checked before
            balances[src] -= amount;
            // No overflow since should always be <= totalSupply
            balances[dest] += amount;
        }

        //emit the Transfer Event
        emit Transfer(src,dest,amount);
        return true;
    }

    function approve(address spender, uint amount) external override returns(bool){
        return _approve(msg.sender, spender, amount);
    }

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        return _approve(msg.sender, spender, transferAllowances[msg.sender][spender] + addedValue);
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        uint256 currentAllowance = transferAllowances[msg.sender][spender];
        if(currentAllowance < subtractedValue) revert Errors.AllowanceUnderflow();
        return _approve(msg.sender, spender, currentAllowance - subtractedValue);
    }


    function _approve(address owner, address spender, uint amount) internal returns(bool){
        if(spender == address(0)) revert Errors.ZeroAddress();

        //Update allowance and emit the Approval event
        transferAllowances[owner][spender] = amount;

        emit Approval(owner, spender, amount);

        return true;
    }


    function allowance(address owner, address spender) external view override returns(uint){
        return transferAllowances[owner][spender];
    }


    function balanceOf(address owner) external view override returns(uint){
        return balances[owner];
    }


    function mint(address _user, uint _toMint) external onlyPool returns(bool){
        if(_user == address(0)) revert Errors.ZeroAddress();

        _totalSupply += _toMint;
        unchecked {
            // Safe because balance should always be <= totalSupply
            balances[_user] += _toMint;
        }

        emit Transfer(address(0),_user,_toMint);

        return true;
    }


    function burn(address _user, uint _toBurn) external onlyPool returns(bool){
        if(_user == address(0)) revert Errors.ZeroAddress();
        if(balances[_user] < _toBurn) revert Errors.InsufficientBalance();

        _totalSupply -= _toBurn;
        unchecked {
            // Safe, value was checked before
            balances[_user] -= _toBurn;
        }

        emit Transfer(_user,address(0),_toBurn);

        return true;
    }

}