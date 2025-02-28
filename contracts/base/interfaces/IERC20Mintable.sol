// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

/**
 * @title IERC20Mintable interface
 * @author CloudWalk Inc.
 * @notice The interface of a token that supports mint and burn operations
 */
interface IERC20Mintable {
    /**
     * @notice Emitted when the master minter is changed
     *
     * @param newMasterMinter The address of a new master minter
     */
    event MasterMinterChanged(address indexed newMasterMinter);

    /**
     * @notice Emitted when a minter account is configured
     *
     * @param minter The address of the minter to configure
     * @param mintAllowance The mint allowance
     */
    event MinterConfigured(address indexed minter, uint256 mintAllowance);

    /**
     * @notice Emitted when a minter account is removed
     *
     * @param oldMinter The address of the minter to remove
     */
    event MinterRemoved(address indexed oldMinter);

    /**
     * @notice Emitted when tokens are minted
     *
     * @param minter The address of the minter
     * @param to The address of the tokens recipient
     * @param amount The amount of tokens being minted
     */
    event Mint(address indexed minter, address indexed to, uint256 amount);

    /**
     * @notice Emitted when tokens are burned
     *
     * @param burner The address of the tokens burner
     * @param amount The amount of tokens being burned
     */
    event Burn(address indexed burner, uint256 amount);

    /**
     * @notice Returns the master minter address
     */
    function masterMinter() external view returns (address);

    /**
     * @notice Checks if the account is configured as a minter
     *
     * @param account The address to check
     * @return True if the account is a minter
     */
    function isMinter(address account) external view returns (bool);

    /**
     * @notice Returns the mint allowance of a minter
     *
     * @param minter The minter to check
     * @return The mint allowance of the minter
     */
    function minterAllowance(address minter) external view returns (uint256);

    /**
     * @notice Updates the master minter address
     *
     * Emits a {MasterMinterChanged} event
     *
     * @param newMasterMinter The address of a new master minter
     */
    function updateMasterMinter(address newMasterMinter) external;

    /**
     * @notice Configures a minter
     *
     * Emits a {MinterConfigured} event
     *
     * @param minter The address of the minter to configure
     * @param mintAllowance The mint allowance
     * @return True if the operation was successful
     */
    function configureMinter(address minter, uint256 mintAllowance) external returns (bool);

    /**
     * @notice Removes a minter
     *
     * Emits a {MinterRemoved} event
     *
     * @param minter The address of the minter to remove
     * @return True if the operation was successful
     */
    function removeMinter(address minter) external returns (bool);

    /**
     * @notice Mints tokens
     *
     * Emits a {Mint} event
     *
     * @param account The address of a tokens recipient
     * @param amount The amount of tokens to mint
     * @return True if the operation was successful
     */
    function mint(address account, uint256 amount) external returns (bool);

    /**
     * @notice Burns tokens
     *
     * Emits a {Burn} event
     *
     * @param amount The amount of tokens to burn
     */
    function burn(uint256 amount) external;
}
