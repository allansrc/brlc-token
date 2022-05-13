import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { TransactionResponse } from "@ethersproject/abstract-provider"

describe("Contract 'OnhainRandomProvider'", async () => {
  let onchainRandomProvider: Contract;
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    const OnchainRandomProvider: ContractFactory = await ethers.getContractFactory("OnchainRandomProvider");
    onchainRandomProvider = await OnchainRandomProvider.deploy();
    await onchainRandomProvider.deployed();

    [deployer, user] = await ethers.getSigners();
  });

  it("Returns random numbers", async () => {
    const randomNumber1: BigNumber = await onchainRandomProvider.getRandomness();

    // Wait for the next block
    let txResponse: TransactionResponse = await deployer.sendTransaction({ to: user.address, value: 100 });
    await txResponse.wait();

    const randomNumber2: BigNumber = await onchainRandomProvider.getRandomness();

    // Wait for the next block
    txResponse = await deployer.sendTransaction({ to: user.address, value: 100 });
    await txResponse.wait();

    const randomNumber3: BigNumber = await onchainRandomProvider.getRandomness();

    // Compare different number for each request
    expect(randomNumber1).to.not.equal(randomNumber2);
    expect(randomNumber1).to.not.equal(randomNumber3);
    expect(randomNumber2).to.not.equal(randomNumber3);
  });
});
