import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { countNumberArrayTotal } from "../../test-utils/misc";
import { TransactionResponse } from "@ethersproject/abstract-provider"

describe("Contract 'MultisendUpgradeable'", async () => {
  const REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED = 'Initializable: contract is already initialized';
  const REVERT_MESSAGE_IF_CONTRACT_IS_PAUSED = "Pausable: paused";
  const REVERT_MESSAGE_IF_ACCOUNT_IS_NOT_WHITELISTED = "Whitelistable: account is not whitelisted";
  const REVERT_MESSAGE_IF_TOKEN_TRANSFER_AMOUNT_EXCEEDS_BALANCE = "ERC20: transfer amount exceeds balance";
  const REVERT_MESSAGE_IF_TOKEN_IS_ZERO_ADDRESS = "Multisend: zero token address";
  const REVERT_MESSAGE_IF_RECIPIENTS_IS_AN_EMPTY_ARRAY = "Multisend: recipients array is empty";
  const REVERT_MESSAGE_IF_LENGTHS_OF_TWO_ARRAYS_DO_NOT_EQUAL =
    "Multisend: length of recipients and balances arrays must be equal";

  let multisend: Contract;
  let brlcMock: Contract;
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    // Deploy the BRLC mock contract
    const BRLCMock: ContractFactory = await ethers.getContractFactory("ERC20Mock");
    brlcMock = await BRLCMock.deploy("BRL Coin", "BRLC", 6);
    await brlcMock.deployed();

    // Deploy the being tested contract
    const Multisend: ContractFactory = await ethers.getContractFactory("MultisendUpgradeable");
    multisend = await upgrades.deployProxy(Multisend);
    await multisend.deployed();

    // Get user accounts
    [deployer, user] = await ethers.getSigners();
  });

  it("The initialize function can't be called more than once", async () => {
    await expect(multisend.initialize())
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  });

  describe("Function 'multisendToken()'", async () => {
    let recipientAddresses: string[];
    const balances: number[] = [10, 20];
    const balanceTotal: number = countNumberArrayTotal(balances);

    beforeEach(async () => {
      await multisend.setWhitelistEnabled(true);
      let txResponse: TransactionResponse = await multisend.setWhitelistAdmin(user.address);
      await txResponse.wait();
      txResponse = await multisend.connect(user).updateWhitelister(user.address, true);
      await txResponse.wait();
      txResponse = await multisend.connect(user).whitelist(user.address);
      await txResponse.wait();

      recipientAddresses = [deployer.address, user.address];
    });

    it("Is reverted if caller is not whitelisted", async () => {
      await expect(multisend.multisendToken(brlcMock.address, recipientAddresses, balances))
        .to.be.revertedWith(REVERT_MESSAGE_IF_ACCOUNT_IS_NOT_WHITELISTED);
    })

    it("Is reverted if the contract is paused", async () => {
      let txResponse: TransactionResponse = await multisend.setPauser(deployer.address);
      await txResponse.wait();
      txResponse = await multisend.pause();
      await txResponse.wait();
      await expect(multisend.connect(user).multisendToken(brlcMock.address, recipientAddresses, balances))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_PAUSED);
    })

    it("Is reverted if the token address is zero", async () => {
      await expect(multisend.connect(user).multisendToken(ethers.constants.AddressZero, recipientAddresses, balances))
        .to.be.revertedWith(REVERT_MESSAGE_IF_TOKEN_IS_ZERO_ADDRESS);
    })

    it("Is reverted if the recipients array length is zero", async () => {
      await expect(multisend.connect(user).multisendToken(brlcMock.address, [], balances))
        .to.be.revertedWith(REVERT_MESSAGE_IF_RECIPIENTS_IS_AN_EMPTY_ARRAY);
    })

    it("Is reverted if the recipients array differs in length from the balances array", async () => {
      await expect(multisend.connect(user).multisendToken(brlcMock.address, recipientAddresses, [10]))
        .to.be.revertedWith(REVERT_MESSAGE_IF_LENGTHS_OF_TWO_ARRAYS_DO_NOT_EQUAL);
    })

    it("Is reverted if the contract has not enough tokens to execute all transfers", async () => {
      await brlcMock.mint(multisend.address, balanceTotal - balances[0]);
      await expect(multisend.connect(user).multisendToken(brlcMock.address, recipientAddresses, balances))
        .to.be.revertedWith(REVERT_MESSAGE_IF_TOKEN_TRANSFER_AMOUNT_EXCEEDS_BALANCE);
    });

    it("Transfers correct amount of tokens if the total is enough", async () => {
      const txResponse: TransactionResponse = await brlcMock.connect(user).mint(multisend.address, balanceTotal);
      await txResponse.wait();

      await expect(async () => {
        const txResponse: TransactionResponse =
          await multisend.connect(user).multisendToken(brlcMock.address, recipientAddresses, balances);
        await txResponse.wait();
      }).to.changeTokenBalances(
        brlcMock,
        [multisend, deployer, user],
        [-balanceTotal, ...balances]
      );
    });

    it("Emits the correct event", async () => {
      const txResponse: TransactionResponse = await brlcMock.mint(multisend.address, balanceTotal);
      await txResponse.wait();
      await expect(multisend.connect(user).multisendToken(brlcMock.address, recipientAddresses, balances))
        .to.emit(multisend, "Multisend")
        .withArgs(brlcMock.address, balanceTotal);
    });
  });
});
