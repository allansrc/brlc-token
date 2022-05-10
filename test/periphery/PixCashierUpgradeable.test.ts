import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { TransactionResponse } from "@ethersproject/abstract-provider"

describe("Contract 'PixCashierUpgradeable'", async () => {
  const REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED = 'Initializable: contract is already initialized';
  const REVERT_MESSAGE_IF_CONTRACT_IS_PAUSED = "Pausable: paused";
  const REVERT_MESSAGE_IF_ACCOUNT_IS_NOT_WHITELISTED = "Whitelistable: account is not whitelisted";
  const REVERT_MESSAGE_IF_TOKEN_TRANSFER_AMOUNT_EXCEEDS_BALANCE = "ERC20: transfer amount exceeds balance";
  const REVERT_MESSAGE_IF_ADDRESS_IS_ZERO = "ERC20: mint to the zero address"
  const REVERT_MESSAGE_IF_CASH_OUT_BALANCE_IS_NOT_ENOUGH_TO_CONFIRM =
    "PixCashier: cash-out confirm amount exceeds balance";
  const REVERT_MESSAGE_IF_CASH_OUT_BALANCE_IS_NOT_ENOUGH_TO_REVERSE =
    "PixCashier: cash-out reverse amount exceeds balance";

  let pixCashier: Contract;
  let brlcMock: Contract;
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    // Deploy the BRLC mock contract
    const BRLCMock: ContractFactory = await ethers.getContractFactory("ERC20Mock");
    brlcMock = await BRLCMock.deploy("BRL Coin", "BRLC", 6);
    await brlcMock.deployed();

    // Deploy the being tested contract
    const PixCashier: ContractFactory = await ethers.getContractFactory("PixCashierUpgradeable");
    pixCashier = await upgrades.deployProxy(PixCashier, [brlcMock.address]);
    await pixCashier.deployed();

    // Get user accounts
    [deployer, user] = await ethers.getSigners();
  });

  it("The initialize function can't be called more than once", async () => {
    await expect(pixCashier.initialize(brlcMock.address))
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  describe("Function 'cashIn()'", async () => {
    const tokenAmount: number = 100;
    let cashierClient: SignerWithAddress;

    beforeEach(async () => {
      cashierClient = deployer;
      await pixCashier.setPauser(deployer.address);
      await pixCashier.setWhitelistEnabled(true);
      let txResponse: TransactionResponse = await pixCashier.setWhitelistAdmin(user.address);
      await txResponse.wait();
      txResponse = await pixCashier.connect(user).updateWhitelister(user.address, true);
      await txResponse.wait();
      txResponse = await pixCashier.connect(user).whitelist(user.address);
      await txResponse.wait();
    })

    it("Is reverted if caller is not whitelisted", async () => {
      await expect(pixCashier.cashIn(user.address, tokenAmount))
        .to.be.revertedWith(REVERT_MESSAGE_IF_ACCOUNT_IS_NOT_WHITELISTED);
    })

    it("Is reverted if the contract is paused", async () => {
      const txResponse: TransactionResponse = await pixCashier.pause();
      await txResponse.wait();
      await expect(pixCashier.connect(user).cashIn(cashierClient.address, tokenAmount))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_PAUSED);
    })

    it("Is reverted if the account address is zero", async () => {
      await expect(pixCashier.connect(user).cashIn(ethers.constants.AddressZero, tokenAmount))
        .to.be.revertedWith(REVERT_MESSAGE_IF_ADDRESS_IS_ZERO);
    })

    it("Mints correct amount of tokens", async () => {
      await expect(async () => {
        const txResponse: TransactionResponse =
          await pixCashier.connect(user).cashIn(cashierClient.address, tokenAmount);
        await txResponse.wait();
      }).to.changeTokenBalances(
        brlcMock,
        [cashierClient],
        [tokenAmount]
      );
    });

    it("Emits the correct event", async () => {
      await expect(pixCashier.connect(user).cashIn(cashierClient.address, tokenAmount))
        .to.emit(pixCashier, "CashIn")
        .withArgs(cashierClient.address, tokenAmount);
    });
  });

  describe("Function 'cashOut()'", async () => {
    const tokenAmount: number = 100;
    let cashierClient: SignerWithAddress;

    beforeEach(async () => {
      cashierClient = deployer;
      await brlcMock.connect(cashierClient).approve(pixCashier.address, ethers.constants.MaxUint256);
      const txResponse: TransactionResponse = await pixCashier.setPauser(deployer.address);
      await txResponse.wait();
    })

    it("Is reverted if the contract is paused", async () => {
      const txResponse: TransactionResponse = await pixCashier.pause();
      await txResponse.wait();
      await expect(pixCashier.connect(cashierClient).cashOut(tokenAmount))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_PAUSED);
    })

    it("Is reverted if the user has not enough tokens", async () => {
      const txResponse: TransactionResponse = await brlcMock.mint(cashierClient.address, tokenAmount - 1);
      await txResponse.wait();
      await expect(pixCashier.connect(cashierClient).cashOut(tokenAmount))
        .to.be.revertedWith(REVERT_MESSAGE_IF_TOKEN_TRANSFER_AMOUNT_EXCEEDS_BALANCE);
    });

    it("Transfers correct amount of tokens and changes cash-out balances accordingly", async () => {
      const txResponse: TransactionResponse = await brlcMock.mint(cashierClient.address, tokenAmount);
      await txResponse.wait();
      const cashOutBalanceBefore: number = await pixCashier.cashOutBalanceOf(cashierClient.address);
      await expect(async () => {
        const txResponse: TransactionResponse = await pixCashier.connect(cashierClient).cashOut(tokenAmount);
        await txResponse.wait();
      }).to.changeTokenBalances(
        brlcMock,
        [cashierClient, pixCashier],
        [-tokenAmount, +tokenAmount]
      );
      const cashOutBalanceAfter: number = await pixCashier.cashOutBalanceOf(cashierClient.address);
      expect(cashOutBalanceAfter - cashOutBalanceBefore).to.equal(tokenAmount);
    });

    it("Emits the correct event", async () => {
      const txResponse: TransactionResponse = await brlcMock.mint(cashierClient.address, tokenAmount);
      await txResponse.wait();
      await expect(pixCashier.connect(cashierClient).cashOut(tokenAmount))
        .to.emit(pixCashier, "CashOut")
        .withArgs(cashierClient.address, tokenAmount, tokenAmount);
    });
  });

  describe("Function 'cashOutConfirm()'", async () => {
    const tokenAmount: number = 100;
    let cashierClient: SignerWithAddress;

    beforeEach(async () => {
      cashierClient = deployer;
      await brlcMock.connect(cashierClient).approve(pixCashier.address, ethers.constants.MaxUint256);
      await brlcMock.mint(cashierClient.address, tokenAmount);
      const txResponse: TransactionResponse = await pixCashier.setPauser(deployer.address);
      await txResponse.wait();
    })

    it("Is reverted if the contract is paused", async () => {
      const txResponse: TransactionResponse = await pixCashier.pause();
      await txResponse.wait();
      await expect(pixCashier.connect(cashierClient).cashOutConfirm(tokenAmount))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_PAUSED);
    })

    it("Is reverted if the user's cash-out balance has not enough tokens", async () => {
      const txResponse: TransactionResponse = await pixCashier.connect(cashierClient).cashOut(tokenAmount - 1);
      await txResponse.wait();
      await expect(pixCashier.connect(cashierClient).cashOutConfirm(tokenAmount))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CASH_OUT_BALANCE_IS_NOT_ENOUGH_TO_CONFIRM);
    });

    it("Burns correct amount of tokens and changes cash-out balances accordingly", async () => {
      const txResponse: TransactionResponse = await pixCashier.connect(cashierClient).cashOut(tokenAmount);
      await txResponse.wait();
      const cashOutBalanceBefore: number = await pixCashier.cashOutBalanceOf(cashierClient.address);
      await expect(async () => {
        const txResponse: TransactionResponse = await pixCashier.connect(cashierClient).cashOutConfirm(tokenAmount);
        await txResponse.wait();
      }).to.changeTokenBalances(
        brlcMock,
        [pixCashier],
        [-tokenAmount]
      );
      const cashOutBalanceAfter: number = await pixCashier.cashOutBalanceOf(cashierClient.address);
      expect(cashOutBalanceAfter - cashOutBalanceBefore).to.equal(-tokenAmount);
    });

    it("Emits the correct event", async () => {
      const txResponse: TransactionResponse = await pixCashier.connect(cashierClient).cashOut(tokenAmount);
      await txResponse.wait();
      await expect(pixCashier.connect(cashierClient).cashOutConfirm(tokenAmount))
        .to.emit(pixCashier, "CashOutConfirm")
        .withArgs(cashierClient.address, tokenAmount, 0);
    });
  });

  describe("Function 'cashOutReverse()'", async () => {
    const tokenAmount: number = 100;
    let cashierClient: SignerWithAddress;

    beforeEach(async () => {
      cashierClient = deployer;
      await brlcMock.connect(cashierClient).approve(pixCashier.address, ethers.constants.MaxUint256);
      await brlcMock.mint(cashierClient.address, tokenAmount);
      const txResponse: TransactionResponse = await pixCashier.setPauser(deployer.address);
      await txResponse.wait();
    })

    it("Is reverted if the contract is paused", async () => {
      const txResponse: TransactionResponse = await pixCashier.pause();
      await txResponse.wait();
      await expect(pixCashier.connect(cashierClient).cashOutReverse(tokenAmount))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_PAUSED);
    })

    it("Is reverted if the user's cash-out balance has not enough tokens", async () => {
      const txResponse: TransactionResponse = await pixCashier.connect(cashierClient).cashOut(tokenAmount - 1);
      await txResponse.wait();
      await expect(pixCashier.connect(cashierClient).cashOutReverse(tokenAmount))
        .to.be.revertedWith(REVERT_MESSAGE_IF_CASH_OUT_BALANCE_IS_NOT_ENOUGH_TO_REVERSE);
    });

    it("Transfers correct amount of tokens and changes cash-out balances accordingly", async () => {
      const txResponse: TransactionResponse = await pixCashier.connect(cashierClient).cashOut(tokenAmount);
      await txResponse.wait();
      const cashOutBalanceBefore: number = await pixCashier.cashOutBalanceOf(cashierClient.address);
      await expect(async () => {
        const txResponse: TransactionResponse = await pixCashier.connect(cashierClient).cashOutReverse(tokenAmount);
        await txResponse.wait();
      }).to.changeTokenBalances(
        brlcMock,
        [cashierClient, pixCashier],
        [+tokenAmount, -tokenAmount]
      );
      const cashOutBalanceAfter: number = await pixCashier.cashOutBalanceOf(cashierClient.address);
      expect(cashOutBalanceAfter - cashOutBalanceBefore).to.equal(-tokenAmount);
    });

    it("Emits the correct event", async () => {
      const txResponse: TransactionResponse = await pixCashier.connect(cashierClient).cashOut(tokenAmount);
      await txResponse.wait();
      await expect(pixCashier.connect(cashierClient).cashOutReverse(tokenAmount))
        .to.emit(pixCashier, "CashOutReverse")
        .withArgs(cashierClient.address, tokenAmount, 0);
    });
  });

  describe("Complex scenario", async () => {
    const cashInTokenAmount: number = 100;
    const cashOutTokenAmount: number = 80;
    const cashOutReverseTokenAmount: number = 20;
    const cashOutConfirmTokenAmount: number = 50;

    let cashierClient: SignerWithAddress;
    let cashierClientFinalTokenBalance: number;
    let cashierClientFinalCashOutBalance: number;

    beforeEach(async () => {
      cashierClient = deployer;
      cashierClientFinalTokenBalance = cashInTokenAmount - cashOutTokenAmount + cashOutReverseTokenAmount;
      cashierClientFinalCashOutBalance = cashOutTokenAmount - cashOutReverseTokenAmount - cashOutConfirmTokenAmount;
      await brlcMock.connect(cashierClient).approve(pixCashier.address, ethers.constants.MaxUint256);
    })

    it("Leads to correct balances when using several functions", async () => {
      let txResponse: TransactionResponse =
        await pixCashier.connect(user).cashIn(cashierClient.address, cashInTokenAmount);
      await txResponse.wait();
      txResponse = await pixCashier.connect(cashierClient).cashOut(cashOutTokenAmount);
      await txResponse.wait();
      txResponse = await pixCashier.connect(cashierClient).cashOutReverse(cashOutReverseTokenAmount);
      await txResponse.wait();
      txResponse = await pixCashier.connect(cashierClient).cashOutConfirm(cashOutConfirmTokenAmount);
      await txResponse.wait();
      expect(await brlcMock.balanceOf(cashierClient.address)).to.equal(cashierClientFinalTokenBalance);
      expect(await pixCashier.cashOutBalanceOf(cashierClient.address)).to.equal(cashierClientFinalCashOutBalance);
      expect(await brlcMock.balanceOf(pixCashier.address)).to.equal(cashierClientFinalCashOutBalance);
    });
  });
});
