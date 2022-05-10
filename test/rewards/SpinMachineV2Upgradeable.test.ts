//@ts-nocheck
import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { TransactionResponse } from "@ethersproject/abstract-provider";

describe("Contract 'SpinMachineV2Upgradeable'", async () => {
  const REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED = 'Initializable: contract is already initialized';

  let SpinMachine: ContractFactory;
  let spinMachine: Contract;
  let BRLCMock: ContractFactory;
  let brlcMock: Contract;
  let deployer: SignerWithAddress;

  beforeEach(async () => {
    // Deploy BRLC
    BRLCMock = await ethers.getContractFactory("ERC20Mock");
    brlcMock = await BRLCMock.deploy("BRL Coin", "BRLC", 6);
    await brlcMock.deployed();

    // Deploy RandomProvider
    const OnchainRandomProvider: ContractFactory = await ethers.getContractFactory(
      "OnchainRandomProvider"
    );
    const onchainRandomProvider: Contract = await OnchainRandomProvider.deploy();
    await onchainRandomProvider.deployed();

    // Deploy SpinMachine
    SpinMachine = await ethers.getContractFactory("SpinMachineV2Upgradeable");
    spinMachine = await upgrades.deployProxy(SpinMachine, [brlcMock.address]);
    await spinMachine.deployed();
    const txResponse: TransactionResponse = await spinMachine.setRandomProvider(onchainRandomProvider.address);
    await txResponse.wait();

    // Get user accounts
    [deployer] = await ethers.getSigners();
  });

  it("The initialize function can't be called more than once", async () => {
    await expect(spinMachine.initialize(brlcMock.address))
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  //All other checks are in the test files for the ancestor contracts
});
