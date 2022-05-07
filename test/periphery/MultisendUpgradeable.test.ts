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

  it("Contains functions inherited from the 'RescuableUpgradeable' contract", () => {
    expect(multisend.functions['getRescuer()']).to.exist
    expect(multisend.functions['setRescuer(address)']).to.exist
    expect(multisend.functions['rescueERC20(address,address,uint256)']).to.exist
  })

  it("Contains functions inherited from the 'PausableExUpgradeable' contract", () => {
    expect(multisend.functions['getPauser()']).to.exist
    expect(multisend.functions['setPauser(address)']).to.exist
    expect(multisend.functions['pause()']).to.exist
    expect(multisend.functions['unpause()']).to.exist
    expect(multisend.functions['paused()']).to.exist
  })

  it("Contains functions inherited from the 'WhitelistableExUpgradeable' contract", () => {
    expect(multisend.functions['isWhitelister(address)']).to.exist
    expect(multisend.functions['isWhitelistEnabled()']).to.exist
    expect(multisend.functions['updateWhitelister(address,bool)']).to.exist
    expect(multisend.functions['setWhitelistEnabled(bool)']).to.exist
    expect(multisend.functions['getWhitelistAdmin()']).to.exist
    expect(multisend.functions['isWhitelisted(address)']).to.exist
    expect(multisend.functions['whitelist(address)']).to.exist
    expect(multisend.functions['unWhitelist(address)']).to.exist
    expect(multisend.functions['setWhitelistAdmin(address)']).to.exist
  })

  it("The initialize function can't be called more than once", async () => {
    await expect(multisend.initialize())
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  describe("Function 'multisendToken()'", async () => {
    let recipientAddresses: string[];
    const balances: number[] = [10, 20];
    const balanceTotal: number = countNumberArrayTotal(balances);

    beforeEach(async () => {
      //Configure the tested contract
      await multisend.setPauser(deployer.address);
      await multisend.setWhitelistEnabled(true);
      let tx_response: TransactionResponse = await multisend.setWhitelistAdmin(user.address);
      await tx_response.wait();
      tx_response = await multisend.connect(user).updateWhitelister(user.address, true);
      await tx_response.wait();
      tx_response = await multisend.connect(user).whitelist(user.address);
      await tx_response.wait();

      recipientAddresses = [deployer.address, user.address];
    })

    it("Is reverted if caller is not whitelisted", async () => {
      await expect(multisend.multisendToken(brlcMock.address, recipientAddresses, balances))
        .to.be.revertedWith(REVERT_MESSAGE_IF_ACCOUNT_IS_NOT_WHITELISTED);
    })

    it("Is reverted if the contract is paused", async () => {
      const tx_response: TransactionResponse = await multisend.pause();
      await tx_response.wait();
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
      const tx_response: TransactionResponse = await brlcMock.connect(user).mint(multisend.address, balanceTotal);
      await tx_response.wait();

      await expect(async () => {
        const tx_response: TransactionResponse =
          await multisend.connect(user).multisendToken(brlcMock.address, recipientAddresses, balances);
        await tx_response.wait();
      }).to.changeTokenBalances(
        brlcMock,
        [multisend, deployer, user],
        [-balanceTotal, ...balances]
      );
    });

    it("Emits the correct event", async () => {
      const tx_response: TransactionResponse = await brlcMock.mint(multisend.address, balanceTotal);
      await tx_response.wait();
      await expect(multisend.connect(user).multisendToken(brlcMock.address, recipientAddresses, balances))
        .to.emit(multisend, "Multisend")
        .withArgs(brlcMock.address, balanceTotal);
    });
  });
});
