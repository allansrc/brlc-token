import { ethers } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { TransactionResponse } from "@ethersproject/abstract-provider"

describe("Contract 'OnhainRandomProvider'", async () => {
  let OnchainRandomProvider: ContractFactory;
  let onchainRandomProvider: Contract;
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    OnchainRandomProvider = await ethers.getContractFactory("OnchainRandomProvider");
    onchainRandomProvider = await OnchainRandomProvider.deploy();
    await onchainRandomProvider.deployed();
    [deployer, user] = await ethers.getSigners();
  });

  it("Returns random numbers", async () => {
    const randomNumber1 = await onchainRandomProvider.getRandomness();

    // Wait for the next block
    let tx_response: TransactionResponse = await deployer.sendTransaction({ to: user.address, value: 100 });
    await tx_response.wait();

    const randomNumber2 = await onchainRandomProvider.getRandomness();

    // Wait for the next block
    tx_response = await deployer.sendTransaction({ to: user.address, value: 100 });
    await tx_response.wait();

    const randomNumber3 = await onchainRandomProvider.getRandomness();

    // Compare different number for each request
    expect(randomNumber1).to.not.equal(randomNumber2);
    expect(randomNumber1).to.not.equal(randomNumber3);
    expect(randomNumber2).to.not.equal(randomNumber3);
  });
});
