// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import {WhitelistableUpgradeable} from "../base/WhitelistableUpgradeable.sol";

/**
 * @title WhitelistableMockUpgradeable contract.
 * @notice For test purpose of the "WhitelistableUpgradeable" contract.
 */
contract WhitelistableMockUpgradeable is WhitelistableUpgradeable {

    bool private _isWhitelistEnabled;
    address private _stubWhitelister;

    //This function is intentionally deprived the "initializer" modifier to test that the ancestor contract has it
    function initialize() public {
        __Whitelistable_init();
    }

    //This function is intentionally deprived the "initializer" modifier to test that the ancestor contract has it
    function initialize_unchained() public {
        __Whitelistable_init_unchained();
    }

    function isWhitelistEnabled() public override view returns (bool) {
        return _isWhitelistEnabled;
    }

    function setWhitelistEnabled(bool enabled) external {
        _isWhitelistEnabled = enabled;
    }

    function testOnlyWhitelistedModifier() external onlyWhitelisted(_msgSender()) view returns (bool){
        return true;
    }

    function isWhitelister(address account) public override view returns (bool) {
        return (_stubWhitelister == account);
    }

    function setStubWhitelister(address account) external {
        _stubWhitelister = account;
    }

    function testOnlyWhitelistAdminModifier() external onlyWhitelistAdmin view returns (bool){
        return true;
    }
}
