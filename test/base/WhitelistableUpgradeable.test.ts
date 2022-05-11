import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { TransactionResponse } from "@ethersproject/abstract-provider"

describe("Contract 'WhitelistableUpgradeable'", async () => {
  const REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER = "Ownable: caller is not the owner";
  const REVERT_MESSAGE_IF_CALLER_IS_NOT_WHITELISTER = "Whitelistable: caller is not the whitelister";
  const REVERT_MESSAGE_IF_ACCOUNT_IS_NOT_WHITELISTED = 'Whitelistable: account is not whitelisted';
  const REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED = 'Initializable: contract is already initialized';
  const REVERT_MESSAGE_IF_CALLER_IS_NOT_WHITELIST_ADMIN = 'Whitelistable: caller is not the whitelist admin';

  let whitelistableMock: Contract;
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    const WhitelistableMock: ContractFactory = await ethers.getContractFactory("WhitelistableUpgradeableMock");
    whitelistableMock = await upgrades.deployProxy(WhitelistableMock);
    await whitelistableMock.deployed();

    [deployer, user] = await ethers.getSigners();
  });

  it("The initialize function can't be called more than once", async () => {
    await expect(whitelistableMock.initialize())
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  });

  it("The initialize unchained function can't be called more than once", async () => {
    await expect(whitelistableMock.initialize_unchained())
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  });

  describe("Function 'setWhitelistAdmin()'", async () => {
    it("Is reverted if is called not by the owner", async () => {
      await expect(whitelistableMock.connect(user).setWhitelistAdmin(deployer.address))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER);
    });

    it("Executes successfully if is called by the owner", async () => {
      const expectedWhitelistAdminAddress: string = user.address;
      let txResponse: TransactionResponse = await whitelistableMock.setWhitelistAdmin(expectedWhitelistAdminAddress);
      await txResponse.wait();
      const actualWhitelistAdminAddress: string = await whitelistableMock.getWhitelistAdmin();
      expect(actualWhitelistAdminAddress).to.equal(expectedWhitelistAdminAddress);
    })

    it("Emits the correct event", async () => {
      const whitelistAdminAddress: string = user.address;
      await expect(whitelistableMock.setWhitelistAdmin(whitelistAdminAddress))
        .to.emit(whitelistableMock, "WhitelistAdminChanged")
        .withArgs(whitelistAdminAddress);
    });
  });

  describe("Modifier 'onlyWhitelistAdmin'", async () => {
    it("Reverts the target function if the caller is not a whitelist admin", async () => {
      await expect(whitelistableMock.testOnlyWhitelistAdminModifier())
        .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_WHITELIST_ADMIN);
    });

    it("Does not revert the target function if the caller is the whitelist admin", async () => {
      const txResponse: TransactionResponse = await whitelistableMock.setWhitelistAdmin(user.address);
      await txResponse.wait();
      expect(await whitelistableMock.connect(user).testOnlyWhitelistAdminModifier()).to.equal(true);
    });
  });

  describe("Function 'isWhitelistEnabled()'", async () => {
    it("Returns an expected value", async () => {
      let valueOfWhitelistEnabling: boolean = true;
      let txResponse: TransactionResponse = await whitelistableMock.setWhitelistEnabled(valueOfWhitelistEnabling);
      await txResponse.wait();

      expect(await whitelistableMock.isWhitelistEnabled()).to.equal(valueOfWhitelistEnabling);

      valueOfWhitelistEnabling = false;
      txResponse = await whitelistableMock.setWhitelistEnabled(valueOfWhitelistEnabling);
      await txResponse.wait();

      expect(await whitelistableMock.isWhitelistEnabled()).to.equal(valueOfWhitelistEnabling);
    });
  });

  describe("Function 'whitelist()'", async () => {
    beforeEach(async () => {
      const txResponse: TransactionResponse = await whitelistableMock.setStubWhitelister(user.address);
      await txResponse.wait();
    })

    it("Is reverted if is called not by a whitelister", async () => {
      await expect(whitelistableMock.whitelist(user.address))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_WHITELISTER);
    });

    it("Executes successfully if is called by a whitelister", async () => {
      expect(await whitelistableMock.isWhitelisted(deployer.address)).to.equal(false);
      const txResponse: TransactionResponse = await whitelistableMock.connect(user).whitelist(deployer.address);
      await txResponse.wait();
      expect(await whitelistableMock.isWhitelisted(deployer.address)).to.equal(true);
    });

    it("Emits the correct event", async () => {
      await expect(whitelistableMock.connect(user).whitelist(deployer.address))
        .to.emit(whitelistableMock, "Whitelisted")
        .withArgs(deployer.address);
    });
  });

  describe("Function 'unWhitelist()'", async () => {
    beforeEach(async () => {
      let txResponse: TransactionResponse = await whitelistableMock.setStubWhitelister(user.address);
      await txResponse.wait();

      txResponse = await whitelistableMock.connect(user).whitelist(deployer.address);
      await txResponse.wait();
    })

    it("Is reverted if is called not by a whitelister", async () => {
      await expect(whitelistableMock.unWhitelist(user.address))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_WHITELISTER);
    });

    it("Executes successfully if is called by a whitelister", async () => {
      expect(await whitelistableMock.isWhitelisted(deployer.address)).to.equal(true);
      const txResponse: TransactionResponse = await whitelistableMock.connect(user).unWhitelist(deployer.address);
      await txResponse.wait();
      expect(await whitelistableMock.isWhitelisted(deployer.address)).to.equal(false);
    });

    it("Emits the correct event", async () => {
      await expect(whitelistableMock.connect(user).unWhitelist(user.address))
        .to.emit(whitelistableMock, "UnWhitelisted")
        .withArgs(user.address);
    });
  });

  describe("Modifier 'onlyWhitelisted'", async () => {
    beforeEach(async () => {
      await whitelistableMock.setWhitelistEnabled(true);
      const txResponse: TransactionResponse = await whitelistableMock.setStubWhitelister(user.address);
      await txResponse.wait();
    })

    it("Reverts the target function if the caller is not whitelisted", async () => {
      await expect(whitelistableMock.testOnlyWhitelistedModifier())
        .to.be.revertedWith(REVERT_MESSAGE_IF_ACCOUNT_IS_NOT_WHITELISTED);
    });

    it("Does not revert the target function if the caller is whitelisted", async () => {
      const txResponse: TransactionResponse = await whitelistableMock.connect(user).whitelist(deployer.address);
      await txResponse.wait();
      expect(await whitelistableMock.testOnlyWhitelistedModifier()).to.equal(true);
    });

    it("Does not revert the target function if whitelist is disabled", async () => {
      await whitelistableMock.connect(user).unWhitelist(deployer.address);
      const txResponse: TransactionResponse = await whitelistableMock.setWhitelistEnabled(false);
      await txResponse.wait();
      expect(await whitelistableMock.testOnlyWhitelistedModifier()).to.equal(true);
    });
  });
});
