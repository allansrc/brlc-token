import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { TransactionResponse } from "@ethersproject/abstract-provider"

describe("Contract 'WhitelistableExUpgradeable'", async () => {
  const REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER = "Ownable: caller is not the owner";
  const REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED = 'Initializable: contract is already initialized';
  const REVERT_MESSAGE_IF_CALLER_IS_NOT_WHITELIST_ADMIN = 'Whitelistable: caller is not the whitelist admin';

  let whitelistableExMock: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async () => {
    const WhitelistableExMock: ContractFactory = await ethers.getContractFactory("WhitelistableExMockUpgradeable");
    whitelistableExMock = await upgrades.deployProxy(WhitelistableExMock);
    await whitelistableExMock.deployed();

    [deployer, user1, user2] = await ethers.getSigners();
  });

  it("The initialize function can't be called more than once", async () => {
    await expect(whitelistableExMock.initialize())
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  it("The initialize unchained function can't be called more than once", async () => {
    await expect(whitelistableExMock.initialize_unchained())
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  describe("Function 'setWhitelistEnabled()'", async () => {
    it("Is reverted if is called not by the owner", async () => {
      await expect(whitelistableExMock.connect(user1).setWhitelistEnabled(deployer.address))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER);
    });

    it("Executes successfully if is called by the owner", async () => {
      expect(await whitelistableExMock.isWhitelistEnabled()).to.equal(false);
      const tx_response: TransactionResponse = await whitelistableExMock.setWhitelistEnabled(true);
      await tx_response.wait();
      expect(await whitelistableExMock.isWhitelistEnabled()).to.equal(true);
    })

    it("Emits the correct event", async () => {
      await expect(whitelistableExMock.setWhitelistEnabled(true))
        .to.emit(whitelistableExMock, "WhitelistEnabled")
        .withArgs(true);
    });
  });

  describe("Function 'updateWhitelister()'", async () => {
    beforeEach(async () => {
      const tx_response: TransactionResponse = await whitelistableExMock.setWhitelistAdmin(user1.address);
      await tx_response.wait();
    });

    it("Is reverted if is called not by the whitelist admin", async () => {
      await expect(whitelistableExMock.updateWhitelister(deployer.address, true))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_WHITELIST_ADMIN);
    });

    it("Executes successfully if is called by the whitelist admin", async () => {
      expect(await whitelistableExMock.isWhitelister(deployer.address)).to.equal(false);
      expect(await whitelistableExMock.isWhitelister(user2.address)).to.equal(false);

      await whitelistableExMock.connect(user1).updateWhitelister(deployer.address, true);
      let tx_response: TransactionResponse =
        await whitelistableExMock.connect(user1).updateWhitelister(user2.address, true);
      await tx_response.wait();
      expect(await whitelistableExMock.isWhitelister(deployer.address)).to.equal(true);
      expect(await whitelistableExMock.isWhitelister(user2.address)).to.equal(true);

      tx_response = await whitelistableExMock.connect(user1).updateWhitelister(user2.address, false);
      await tx_response.wait();
      expect(await whitelistableExMock.isWhitelister(user2.address)).to.equal(false);
    })

    it("Emits the correct event", async () => {
      await expect(whitelistableExMock.connect(user1).updateWhitelister(user2.address, true))
        .to.emit(whitelistableExMock, "WhitelisterChanged")
        .withArgs(user2.address, true);
    });
  });
});
