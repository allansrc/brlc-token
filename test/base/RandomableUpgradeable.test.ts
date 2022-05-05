import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { TransactionResponse } from "@ethersproject/abstract-provider"

describe("Contract 'RandomableUpgradeable'", async () => {
  const REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER: string = "Ownable: caller is not the owner";
  const REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED: string = 'Initializable: contract is already initialized';

  let randomableMock: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async () => {
    const RandomableMock: ContractFactory = await ethers.getContractFactory("RandomableMockUpgradeable");
    randomableMock = await upgrades.deployProxy(RandomableMock);
    await randomableMock.deployed();

    [deployer, user1] = await ethers.getSigners();
  });

  it("The initialize function can't be called more than once", async () => {
    await expect(randomableMock.initialize())
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  it("The initialize unchained function can't be called more than once", async () => {
    await expect(randomableMock.initialize_unchained())
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  describe("Function 'setRandomProvider()'", async () => {
    it("Is reverted if is called not by the owner", async () => {
      await expect(randomableMock.connect(user1).setRandomProvider(user1.address))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER);
    });

    it("Executes successfully if is called by the owner", async () => {
      const expectedRandomProviderAddress: string = user1.address;
      const tx_response: TransactionResponse = await randomableMock.setRandomProvider(expectedRandomProviderAddress);
      await tx_response.wait();
      const actualRandomProviderAddress: string = await randomableMock.getRandomProvider();
      expect(actualRandomProviderAddress).to.equal(expectedRandomProviderAddress);
    })

    it("Emits the correct event", async () => {
      const randomProviderAddress: string = user1.address;
      await expect(randomableMock.setRandomProvider(randomProviderAddress))
        .to.emit(randomableMock, "RandomProviderChanged")
        .withArgs(randomProviderAddress);
    });
  });

  describe("Function 'getRandomness()'", async () => {
    let randomProviderMock: Contract;

    beforeEach(async () => {
      //Deploy an out of chain RandomProvider
      const RandomProviderMock: ContractFactory = await ethers.getContractFactory("RandomProviderMock");
      randomProviderMock = await RandomProviderMock.deploy();
      await randomProviderMock.deployed();

      const tx_response: TransactionResponse = await randomableMock.setRandomProvider(randomProviderMock.address);
      await tx_response.wait();
    });

    it("Returns the value from the random provider", async () => {
      const expectedRandomValue: number = 123;
      const tx_response: TransactionResponse = await randomProviderMock.setRandomNumber(expectedRandomValue);
      await tx_response.wait();
      const actualRandomValue: number = await randomableMock.getRandomness();
      expect(actualRandomValue).to.equal(expectedRandomValue);
    });
  });
});
