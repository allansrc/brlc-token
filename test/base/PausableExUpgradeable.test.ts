import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { TransactionResponse } from "@ethersproject/abstract-provider"

describe("Contract 'PausableExUpgradeable'", async () => {
  const REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER = "Ownable: caller is not the owner";
  const REVERT_MESSAGE_IF_CALLER_IS_NOT_PAUSER = "PausableEx: caller is not the pauser";
  const REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED = 'Initializable: contract is already initialized';

  let pausableExMock: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async () => {
    const PausableExMock: ContractFactory = await ethers.getContractFactory("PausableExMockUpgradeable");
    pausableExMock = await upgrades.deployProxy(PausableExMock);
    await pausableExMock.deployed();

    [deployer, user1] = await ethers.getSigners();
  });

  it("The initialize function can't be called more than once", async () => {
    await expect(pausableExMock.initialize())
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  it("The initialize unchained function can't be called more than once", async () => {
    await expect(pausableExMock.initialize_unchained())
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  describe("Function 'setPauser()'", async () => {
    it("Is reverted if is called not by the owner", async () => {
      await expect(pausableExMock.connect(user1).setPauser(user1.address))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER);
    });

    it("Executes successfully if is called by the owner", async () => {
      const expectedPauserAddress: string = user1.address;
      const tx_response: TransactionResponse = await pausableExMock.setPauser(expectedPauserAddress);
      await tx_response.wait();
      const actualPauserAddress: string = await pausableExMock.getPauser();
      expect(actualPauserAddress).to.equal(expectedPauserAddress);
    })

    it("Emits the correct event", async () => {
      const pauserAddress: string = user1.address;
      await expect(pausableExMock.setPauser(pauserAddress))
        .to.emit(pausableExMock, "PauserChanged")
        .withArgs(pauserAddress);
    });
  });

  describe("Function 'pause()'", async () => {
    beforeEach(async () => {
      const tx_response: TransactionResponse = await pausableExMock.setPauser(user1.address);
      await tx_response.wait();
    })

    it("Is reverted if is called not by the pauser", async () => {
      await expect(pausableExMock.pause())
        .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_PAUSER);
    });

    it("Executes successfully if is called by the pauser", async () => {
      const tx_response: TransactionResponse = await pausableExMock.connect(user1).pause();
      await tx_response.wait();
      expect(await pausableExMock.paused()).to.equal(true);
    });

    it("Emits the correct event", async () => {
      await expect(pausableExMock.connect(user1).pause())
        .to.emit(pausableExMock, "Paused")
        .withArgs(user1.address);
    });
  });

  describe("Function 'unpause()'", async () => {
    beforeEach(async () => {
      let tx_response: TransactionResponse = await pausableExMock.setPauser(user1.address);
      await tx_response.wait();
      tx_response = await pausableExMock.connect(user1).pause();
      await tx_response.wait();
    })

    it("Is reverted if is called not by the pauser", async () => {
      await expect(pausableExMock.unpause())
        .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_PAUSER);
    });

    it("Executes successfully if is called by the pauser", async () => {
      const tx_response: TransactionResponse = await pausableExMock.connect(user1).unpause();
      await tx_response.wait();
      expect(await pausableExMock.paused()).to.equal(false);
    });

    it("Emits the correct event", async () => {
      await expect(pausableExMock.connect(user1).unpause())
        .to.emit(pausableExMock, "Unpaused")
        .withArgs(user1.address);
    });
  });
});
