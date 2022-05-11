// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import {BlacklistableUpgradeable} from "../base/BlacklistableUpgradeable.sol";

/**
 * @title BlacklistableUpgradeableMock contract.
 * @notice For test purpose of the "BlacklistableUpgradeable" contract.
 */
contract BlacklistableUpgradeableMock is BlacklistableUpgradeable {

    //This function is intentionally deprived the "initializer" modifier to test that the ancestor contract has it
    function initialize() public {
        __Blacklistable_init();
    }

    //This function is intentionally deprived the "initializer" modifier to test that the ancestor contract has it
    function initialize_unchained() public {
        __Blacklistable_init_unchained();
    }

    function testNotBlacklistedModifier() external notBlacklisted(_msgSender()) {
    }
}
