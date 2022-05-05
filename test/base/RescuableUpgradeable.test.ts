import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { TransactionResponse } from "@ethersproject/abstract-provider"

describe("Contract 'RescuableUpgradeable'", async () => {
  const REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER = "Ownable: caller is not the owner";
  const REVERT_MESSAGE_IF_CALLER_IS_NOT_RESCUER = "Rescuable: caller is not the rescuer";
  const REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED = 'Initializable: contract is already initialized';

  let rescuableMock: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async () => {
    const RescuableMock: ContractFactory = await ethers.getContractFactory("RescuableMockUpgradeable");
    rescuableMock = await upgrades.deployProxy(RescuableMock);
    await rescuableMock.deployed();

    [deployer, user1] = await ethers.getSigners();
  });

  it("The initialize function can't be called more than once", async () => {
    await expect(rescuableMock.initialize())
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  it("The initialize unchained function can't be called more than once", async () => {
    await expect(rescuableMock.initialize_unchained())
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  describe("Function 'setRescuer()'", async () => {
    it("Is reverted if is called not by the owner", async () => {
      await expect(rescuableMock.connect(user1).setRescuer(user1.address))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER);
    });

    it("Executes successfully if is called by the owner", async () => {
      const expectedRescuerAddress: string = user1.address;
      const tx_response: TransactionResponse = await rescuableMock.setRescuer(expectedRescuerAddress);
      await tx_response.wait();
      const actualRescuerAddress: string = await rescuableMock.getRescuer();
      expect(actualRescuerAddress).to.equal(expectedRescuerAddress);
    })

    it("Emits the correct event", async () => {
      const rescuerAddress: string = user1.address;
      await expect(rescuableMock.setRescuer(rescuerAddress))
        .to.emit(rescuableMock, "RescuerChanged")
        .withArgs(rescuerAddress);
    });
  });

  describe("Function 'rescueERC20()'", async () => {
    const tokenBalance: number = 123;
    let brlcMock: Contract;
    beforeEach(async () => {
      const BRLCMock: ContractFactory = await ethers.getContractFactory("ERC20Mock");
      brlcMock = await BRLCMock.deploy("BRL Coin", "BRLC", 6);
      await brlcMock.deployed();
      await brlcMock.mintTo(rescuableMock.address, tokenBalance);
      const tx_response: TransactionResponse = await rescuableMock.setRescuer(user1.address);
      await tx_response.wait();
    })

    it("Is reverted if is called not by the rescuer", async () => {
      await expect(rescuableMock.rescueERC20(brlcMock.address, user1.address, tokenBalance))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_RESCUER);
    });

    it("Transfers the correct amount of tokens", async () => {
      await expect(async () => {
        const tx_response: TransactionResponse =
          await rescuableMock.connect(user1).rescueERC20(brlcMock.address, deployer.address, tokenBalance);
        await tx_response.wait();
      }).to.changeTokenBalances(
        brlcMock,
        [rescuableMock, deployer],
        [-tokenBalance, tokenBalance]
      );
    });
  });
});
