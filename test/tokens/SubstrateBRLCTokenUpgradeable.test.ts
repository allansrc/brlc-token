import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Contract } from "ethers";

describe("Contract 'SubstrateBRLCTokenUpgradeable'", async () => {
  const TOKEN_CONTRACT_NAME = "BRL Coin";
  const TOKEN_SYMBOL = "BRLC";
  const TOKEN_DECIMALS = 6;

  const REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED = 'Initializable: contract is already initialized';

  let brlcToken: Contract;

  beforeEach(async () => {
    // Deploy the contract under test
    const BrlcToken: ContractFactory = await ethers.getContractFactory("SubstrateBRLCTokenUpgradeable");
    brlcToken = await upgrades.deployProxy(BrlcToken, [TOKEN_CONTRACT_NAME, TOKEN_SYMBOL, TOKEN_DECIMALS]);
    await brlcToken.deployed();
  });

  it("The initialize function can't be called more than once", async () => {
    await expect(brlcToken.initialize(TOKEN_CONTRACT_NAME, TOKEN_SYMBOL, TOKEN_DECIMALS))
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  });

  //All other checks are in the test files for the ancestor contracts
});
