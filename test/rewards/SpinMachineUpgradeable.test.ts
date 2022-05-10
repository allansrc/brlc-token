import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Contract, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { countNumberArrayTotal } from "../../test-utils/misc";
import { Block, TransactionReceipt, TransactionResponse } from "@ethersproject/abstract-provider";

describe("Contract 'SpinMachineUpgradeable'", async () => {
  const REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED = 'Initializable: contract is already initialized';
  const REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER = "Ownable: caller is not the owner";
  const REVERT_MESSAGE_IF_SPIN_OWNER_IS_ZERO_ADDRESS = "SpinMachine: spinOwner is the zero address";
  const REVERT_MESSAGE_IF_CONTRACT_IS_PAUSED = "Pausable: paused";
  const REVERT_MESSAGE_IF_ACCOUNT_IS_NOT_WHITELISTED = "Whitelistable: account is not whitelisted";
  const REVERT_MESSAGE_IF_SPIN_COUNT_IS_NOT_GREATER_THAN_0 = "SpinMachine: spins count must be greater than 0";
  const REVERT_MESSAGE_IF_PRIZES_ARRAY_IS_EMPTY = "SpinMachineV1: prizes array cannot be empty";
  const REVERT_MESSAGE_IF_TOKEN_TRANSFER_AMOUNT_EXCEEDS_BALANCE = "ERC20: transfer amount exceeds balance";

  let spinMachine: Contract;
  let brlcMock: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async () => {
    // Deploy BRLC
    const BRLCMock: ContractFactory = await ethers.getContractFactory("ERC20Mock");
    brlcMock = await BRLCMock.deploy("BRL Coin", "BRLC", 6);
    await brlcMock.deployed();

    // Deploy RandomProvider
    const OnchainRandomProvider: ContractFactory = await ethers.getContractFactory(
      "OnchainRandomProvider"
    );
    const onchainRandomProvider: Contract = await OnchainRandomProvider.deploy();
    await onchainRandomProvider.deployed();

    // Deploy SpinMachine
    const SpinMachine: ContractFactory = await ethers.getContractFactory("SpinMachineUpgradeableMock");
    spinMachine = await upgrades.deployProxy(SpinMachine, [brlcMock.address]);
    await spinMachine.deployed();
    const txResponse: TransactionResponse = await spinMachine.setRandomProvider(onchainRandomProvider.address);
    await txResponse.wait();

    // Get user accounts
    [deployer, user1, user2] = await ethers.getSigners();
  });

  it("The initialize function can't be called more than once", async () => {
    await expect(spinMachine.initialize(brlcMock.address))
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  it("The initialize unchained function can't be called more than once", async () => {
    await expect(spinMachine.initialize_unchained(brlcMock.address))
      .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
  })

  describe("Configurations", async () => {
    describe("Function 'setPrizes()'", async () => {
      const prizes: number[] = [10, 20, 30];

      it("Is reverted if is called not by the owner", async () => {
        await expect(spinMachine.connect(user1).setPrizes(prizes))
          .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER);
      });

      it("Is reverted if is called with an empty prizes array", async () => {
        await expect(spinMachine.setPrizes([]))
          .to.be.revertedWith(REVERT_MESSAGE_IF_PRIZES_ARRAY_IS_EMPTY);
      });

      it("Updates the prizes array correctly if is called by the owner", async () => {
        const txResponse: TransactionResponse = await spinMachine.setPrizes(prizes);
        await txResponse.wait();
        const newPrizes: number[] = await spinMachine.getPrizes();
        expect(newPrizes.length).to.equal(prizes.length);
        prizes.forEach((expectedValue: number, index: number) => {
          expect(newPrizes[index]).to.equal(expectedValue);
        });
      });

      it("Emits the correct event", async () => {
        await expect(spinMachine.setPrizes(prizes))
          .to.emit(spinMachine, "PrizesDistributionChanged")
          .withArgs(prizes);
      });
    });

    describe("Function 'setFreeSpinDelay()'", async () => {
      const freeSpinDelay: number = 10;

      it("Is reverted if is called not by the owner", async () => {
        await expect(spinMachine.connect(user1).setFreeSpinDelay(freeSpinDelay))
          .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER);
      });

      it("Updates the free spin delay correctly if is called by the owner", async () => {
        const oldFreeSpinDelay: BigNumber = await spinMachine.freeSpinDelay();
        const txResponse: TransactionResponse = await spinMachine.setFreeSpinDelay(freeSpinDelay);
        await txResponse.wait();
        const newFreeSpinDelay: BigNumber = await spinMachine.freeSpinDelay();
        expect(oldFreeSpinDelay).to.not.equal(freeSpinDelay);
        expect(newFreeSpinDelay).to.equal(freeSpinDelay);
      });

      it("Emits the correct event", async () => {
        const oldFreeSpinDelay: BigNumber = await spinMachine.freeSpinDelay();
        await expect(spinMachine.setFreeSpinDelay(freeSpinDelay))
          .to.emit(spinMachine, "FreeSpinDelayChanged")
          .withArgs(freeSpinDelay, oldFreeSpinDelay);
      });
    });

    describe("Function 'setExtraSpinPrice()'", async () => {
      const extraSpinPrice: number = 10;

      it("Is reverted if is called not by the owner", async () => {
        await expect(spinMachine.connect(user1).setExtraSpinPrice(extraSpinPrice))
          .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER);
      });

      it("Updates the extra spin price correctly if is called by the owner", async () => {
        const oldExtraSpinPrice: BigNumber = await spinMachine.extraSpinPrice();
        const txResponse: TransactionResponse = await spinMachine.setExtraSpinPrice(extraSpinPrice);
        await txResponse.wait();
        const newExtraSpinPrice: BigNumber = await spinMachine.extraSpinPrice();
        expect(oldExtraSpinPrice).to.not.equal(extraSpinPrice);
        expect(newExtraSpinPrice).to.equal(extraSpinPrice);
      });

      it("Emits the correct event", async () => {
        const oldExtraSpinPrice: BigNumber = await spinMachine.extraSpinPrice();
        const txResponse: TransactionResponse = spinMachine.setExtraSpinPrice(extraSpinPrice);
        await expect(txResponse)
          .to.emit(spinMachine, "ExtraSpinPriceChanged")
          .withArgs(extraSpinPrice, oldExtraSpinPrice);
      });
    });

    describe("Function 'grantExtraSpin()'", async () => {
      const extraSpinCount: number = 10;
      let spinOwner: SignerWithAddress;

      beforeEach(() => {
        spinOwner = user1;
      })

      it("Is reverted if is called not by the owner", async () => {
        await expect(spinMachine.connect(user1).grantExtraSpin(spinOwner.address, extraSpinCount))
          .to.be.revertedWith(REVERT_MESSAGE_IF_CALLER_IS_NOT_OWNER);
      });

      it("Is reverted if the 'spinOwner' parameter is zero address", async () => {
        await expect(spinMachine.grantExtraSpin(ethers.constants.AddressZero, extraSpinCount))
          .to.be.revertedWith(REVERT_MESSAGE_IF_SPIN_OWNER_IS_ZERO_ADDRESS);
      });

      it("Is reverted if the 'count' parameter is zero", async () => {
        await expect(spinMachine.grantExtraSpin(spinOwner.address, 0))
          .to.be.revertedWith(REVERT_MESSAGE_IF_SPIN_COUNT_IS_NOT_GREATER_THAN_0);
      });

      it("Updates the extra spins count correctly if is called by the owner", async () => {
        const oldSpinsCount: BigNumber = await spinMachine.extraSpins(spinOwner.address);
        const txResponse: TransactionResponse = await spinMachine.grantExtraSpin(spinOwner.address, extraSpinCount);
        await txResponse.wait();
        const newSpinsCount: BigNumber = await spinMachine.extraSpins(spinOwner.address);
        expect(newSpinsCount).to.equal(oldSpinsCount.add(BigNumber.from(extraSpinCount)));
      });

      it("Emits the correct event", async () => {
        await expect(spinMachine.grantExtraSpin(spinOwner.address, extraSpinCount))
          .to.emit(spinMachine, "ExtraSpinGranted")
          .withArgs(deployer.address, user1.address, extraSpinCount);
      });
    });
  });

  describe("Interactions", async () => {
    const prize: number = 100;
    const prizes: number[] = [prize];
    const freeSpinDelay: number = 1000;
    const extraSpinPrice: number = prize;

    beforeEach(async () => {
      // Configure the spin machine contract
      await spinMachine.setExtraSpinPrice(extraSpinPrice);
      await spinMachine.setFreeSpinDelay(freeSpinDelay);
      await spinMachine.setPrizes(prizes);
      await spinMachine.setPauser(deployer.address);
      await spinMachine.setWhitelistEnabled(false);

      // Required approvals
      await brlcMock.connect(user1).approve(spinMachine.address, 1000);
      let txResponse: TransactionResponse = await brlcMock.connect(user2).approve(spinMachine.address, 1000);

      //Wait for all previous transactions to be minted
      await txResponse.wait();
    });

    it("Be sure that SpinMachine has initially zero token balance", async () => {
      expect(await brlcMock.balanceOf(spinMachine.address)).to.equal(0);
    })

    describe("Function 'buyExtraSpin()'", async () => {
      const purchasedSpinCount: number = 10;

      it("Is reverted if the contract is paused", async () => {
        const txResponse: TransactionResponse = await spinMachine.pause();
        await txResponse.wait();
        await expect(spinMachine.connect(user1).buyExtraSpin(user1.address, purchasedSpinCount))
          .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_PAUSED);
      });

      it("Is reverted if the 'spinOwner' parameter is zero address", async () => {
        await expect(spinMachine.connect(user1).buyExtraSpin(ethers.constants.AddressZero, purchasedSpinCount))
          .to.be.revertedWith(REVERT_MESSAGE_IF_SPIN_OWNER_IS_ZERO_ADDRESS);
      });

      it("Is reverted if the 'count' parameter is zero", async () => {
        await expect(spinMachine.connect(user1).buyExtraSpin(user1.address, 0))
          .to.be.revertedWith(REVERT_MESSAGE_IF_SPIN_COUNT_IS_NOT_GREATER_THAN_0);
      });

      it("Is reverted if the user has not enough token balance", async () => {
        const tokenAmount: number = extraSpinPrice * purchasedSpinCount - 1;
        const txResponse: TransactionResponse = await brlcMock.mint(user1.address, tokenAmount);
        await txResponse.wait();
        await expect(spinMachine.connect(user1).buyExtraSpin(user1.address, purchasedSpinCount))
          .to.be.revertedWith(REVERT_MESSAGE_IF_TOKEN_TRANSFER_AMOUNT_EXCEEDS_BALANCE);
      });

      it("Increases the extra spins count correctly", async () => {
        const tokenAmount: number = extraSpinPrice * purchasedSpinCount;
        let txResponse: TransactionResponse = await brlcMock.mint(user1.address, tokenAmount);
        await txResponse.wait();
        const oldSpinCount: BigNumber = await spinMachine.extraSpins(user2.address);
        txResponse = await spinMachine.connect(user1).buyExtraSpin(user2.address, purchasedSpinCount);
        await txResponse.wait();
        const newSpinCount: BigNumber = await spinMachine.extraSpins(user2.address);
        expect(newSpinCount).to.equal(oldSpinCount.add(BigNumber.from(purchasedSpinCount)));
      });

      it("Transfers the correct amount of tokens", async () => {
        const tokenAmount: number = purchasedSpinCount * extraSpinPrice;
        const txResponse: TransactionResponse = await brlcMock.mint(user1.address, tokenAmount);
        await txResponse.wait();
        expect(await brlcMock.balanceOf(user1.address))
          .to.equal(tokenAmount);
        await expect(async () => {
          const txResponse: TransactionResponse =
            await spinMachine.connect(user1).buyExtraSpin(user2.address, purchasedSpinCount);
          await txResponse.wait();
        }).to.changeTokenBalances(
          brlcMock,
          [user1, spinMachine],
          [-tokenAmount, tokenAmount]
        );
      });

      it("Emits the correct event", async () => {
        const tokenAmount: number = extraSpinPrice * purchasedSpinCount;
        const txResponse: TransactionResponse = await brlcMock.mint(user1.address, tokenAmount);
        await txResponse.wait();
        await expect(spinMachine.connect(user1).buyExtraSpin(user2.address, purchasedSpinCount))
          .to.emit(spinMachine, "ExtraSpinPurchased")
          .withArgs(user1.address, user2.address, purchasedSpinCount);
      });
    });

    describe("Free spin scenarios", async () => {
      it("Be sure that there is a free spin and no extra spin", async () => {
        expect(await spinMachine.canFreeSpin(user1.address)).to.equal(true);
        expect(await spinMachine.extraSpins(user1.address)).to.equal(0);
      })

      describe("Function 'spin()' when SpinMachine has zero token balance", async () => {
        it("Does not transfer any tokens", async () => {
          await expect(async () => {
            const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
            await txResponse.wait();
          }).to.changeTokenBalances(
            brlcMock,
            [spinMachine, user1],
            [0, 0]
          );
        });

        it("Does not spend free spin", async () => {
          const oldLastFreeSpin: BigNumber = await spinMachine.lastFreeSpin(user1.address);
          const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
          await txResponse.wait();
          expect(await spinMachine.lastFreeSpin(user1.address)).to.equal(
            oldLastFreeSpin
          );
        });
      });

      describe("Function 'spin()' when SpinMachine has some but not enough token balance", async () => {
        const tokenBalanceNotEnough: number = prize - 1;

        beforeEach(async () => {
          const txResponse: TransactionResponse = await brlcMock.mint(spinMachine.address, tokenBalanceNotEnough);
          await txResponse.wait();
        });

        it("Transfers the correct amount of tokens", async () => {
          await expect(async () => {
            const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
            await txResponse.wait();
          }).to.changeTokenBalances(
            brlcMock,
            [spinMachine, user1],
            [-tokenBalanceNotEnough, tokenBalanceNotEnough]
          );
        });

        it("Spends the free spin and update the delay period", async () => {
          const oldLastFreeSpin: BigNumber = await spinMachine.lastFreeSpin(user1.address);
          const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
          const txReceipt: TransactionReceipt = await txResponse.wait();
          const block: Block = await ethers.provider.getBlock(txReceipt.blockNumber);
          const newLastFreeSpin: BigNumber = await spinMachine.lastFreeSpin(user1.address);
          expect(await spinMachine.canSpin(user1.address)).to.equal(false);
          expect(newLastFreeSpin).to.not.equal(oldLastFreeSpin);
          expect(newLastFreeSpin).to.equal(block.timestamp);
        });

        it("Emits the correct event", async () => {
          await expect(spinMachine.connect(user1).spin())
            .to.emit(spinMachine, "Spin")
            .withArgs(user1.address, prize, tokenBalanceNotEnough, false);
        });
      });

      describe("Function 'spin()' when SpinMachine has normal (enough) token balance", async () => {
        const tokenBalanceEnough: number = prize + 1;

        beforeEach(async () => {
          const txResponse: TransactionResponse = await brlcMock.mint(spinMachine.address, tokenBalanceEnough);
          await txResponse.wait();
        });

        it("Is reverted if the contract is paused", async () => {
          const txResponse: TransactionResponse = await spinMachine.pause();
          await txResponse.wait();
          expect(await spinMachine.paused()).to.equal(true);
          await expect(spinMachine.connect(user1).spin())
            .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_PAUSED);
        });

        it("Transfers correct amount of tokens", async () => {
          await expect(async () => {
            const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
            await txResponse.wait();
          }).to.changeTokenBalances(
            brlcMock,
            [spinMachine, user1],
            [-prize, prize]
          );
        });

        it("Spends the free spin and update the delay period", async () => {
          const oldLastFreeSpin: BigNumber = await spinMachine.lastFreeSpin(user1.address);
          const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
          const txReceipt: TransactionReceipt = await txResponse.wait();
          const block: Block = await ethers.provider.getBlock(txReceipt.blockNumber);
          const newLastFreeSpin: BigNumber = await spinMachine.lastFreeSpin(user1.address);
          expect(await spinMachine.canSpin(user1.address)).to.equal(false);
          expect(newLastFreeSpin).to.not.equal(oldLastFreeSpin);
          expect(newLastFreeSpin).to.equal(block.timestamp);
        });

        it("Emits the correct event", async () => {
          await expect(spinMachine.connect(user1).spin())
            .to.emit(spinMachine, "Spin")
            .withArgs(user1.address, prize, prize, false);
        });

        it("Does not allow the second free spin in a row", async () => {
          // First spin
          let txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
          await txResponse.wait();
          expect(await spinMachine.canFreeSpin(user1.address)).to.equal(false);
          expect(await brlcMock.balanceOf(spinMachine.address)).to.gt(0);

          // Second spin
          const oldLastFreeSpin: BigNumber = await spinMachine.lastFreeSpin(user1.address);
          await expect(async () => {
            const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
            await txResponse.wait();
          }).to.changeTokenBalances(
            brlcMock,
            [spinMachine, user1],
            [0, 0]
          );
          const newLastFreeSpin: BigNumber = await spinMachine.lastFreeSpin(user1.address);
          expect(newLastFreeSpin).to.equal(oldLastFreeSpin);
        });
      });
    });

    describe("Extra spin scenarios", async () => {
      const extraSpinCount: number = 1;

      beforeEach(async () => {
        // Grant extra spin
        await spinMachine.grantExtraSpin(user1.address, extraSpinCount);

        // Block free spins
        let txResponse: TransactionResponse = await spinMachine.setFreeSpinDelay(ethers.constants.MaxInt256);
        await txResponse.wait();
      });

      it("Be sure that no free spin is available, but there is an extra spin", async () => {
        expect(await spinMachine.canFreeSpin(user1.address)).to.equal(false);
        expect(await spinMachine.extraSpins(user1.address)).to.equal(extraSpinCount);
      });

      describe("Function 'spin()' when SpinMachine has zero token balance", async () => {
        it("Does not transfer any tokens", async () => {
          await expect(async () => {
            const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
            await txResponse.wait();
          }).to.changeTokenBalances(
            brlcMock,
            [spinMachine, user1],
            [0, 0]
          );
        });

        it("Does not spend extra spins", async () => {
          const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
          await txResponse.wait();
          expect(await spinMachine.extraSpins(user1.address)).to.equal(extraSpinCount);
        });
      });

      describe("Function 'spin()' when SpinMachine has some but not enough token balance", async () => {
        const tokenBalanceNotEnough: number = prize - 1;

        beforeEach(async () => {
          // Spin machine has 'not enough' token balance
          const txResponse: TransactionResponse = await brlcMock.mint(spinMachine.address, tokenBalanceNotEnough);
          await txResponse.wait();
          expect(await brlcMock.balanceOf(spinMachine.address)).to.equal(tokenBalanceNotEnough);
        });

        it("Transfers correct amount of tokens", async () => {
          await expect(async () => {
            const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
            await txResponse.wait();
          }).to.changeTokenBalances(
            brlcMock,
            [spinMachine, user1],
            [-tokenBalanceNotEnough, tokenBalanceNotEnough]
          );
        });

        it("Spends extra spins correctly", async () => {
          const oldExtraSpinCount: BigNumber = await spinMachine.extraSpins(user1.address);
          const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
          await txResponse.wait();
          const newExtraSpinCount: BigNumber = await spinMachine.extraSpins(user1.address);
          expect(await spinMachine.canSpin(user1.address)).to.equal(false);
          expect(newExtraSpinCount).to.equal(oldExtraSpinCount.sub(BigNumber.from(1)));
        });

        it("Emits the correct event", async () => {
          const txResponse: TransactionResponse = spinMachine.connect(user1).spin();
          await expect(txResponse)
            .to.emit(spinMachine, "Spin")
            .withArgs(user1.address, prize, tokenBalanceNotEnough, true);
        });
      });

      describe("Function 'spin()' when SpinMachine has normal (enough) token balance", async () => {
        const tokenBalanceEnough: number = prize + 1;

        beforeEach(async () => {
          const txResponse: TransactionResponse = await brlcMock.mint(spinMachine.address, tokenBalanceEnough);
          await txResponse.wait();
        });

        it("Is reverted if the contract is paused", async () => {
          const txResponse: TransactionResponse = await spinMachine.pause();
          await txResponse.wait();
          expect(await spinMachine.paused()).to.equal(true);
          await expect(spinMachine.connect(user1).spin())
            .to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_PAUSED);
        });

        it("Transfers correct amount of tokens during the first call", async () => {
          await expect(async () => {
            const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
            await txResponse.wait();
          }).to.changeTokenBalances(
            brlcMock,
            [spinMachine, user1],
            [-prize, prize]
          );
        });

        it("Transfers no tokens during the second call", async () => {
          // First spin
          const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
          await txResponse.wait();
          expect(await spinMachine.extraSpins(user1.address)).to.equal(0);
          expect(await brlcMock.balanceOf(spinMachine.address)).to.gt(0);

          // Second spin
          await expect(async () => {
            const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
            await txResponse.wait();
          }).to.changeTokenBalances(
            brlcMock,
            [spinMachine, user1],
            [0, 0]
          );
        });

        it("Spends the extra spins correctly", async () => {
          const oldExtraSpinCount: BigNumber = await spinMachine.extraSpins(user1.address);
          const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
          await txResponse.wait();
          const newExtraSpinCount: BigNumber = await spinMachine.extraSpins(user1.address);
          expect(await spinMachine.canSpin(user1.address)).to.equal(false);
          expect(newExtraSpinCount).to.equal(oldExtraSpinCount.sub(BigNumber.from(1)));
        });

        it("Emits the correct event", async () => {
          await expect(spinMachine.connect(user1).spin())
            .to.emit(spinMachine, "Spin")
            .withArgs(user1.address, prize, prize, true);
        });
      });
    });

    describe("Spin scenarios with the user is in/out of the whitelist", async () => {
      const extraSpinCount: number = 1;
      const tokenBalanceEnough: number = prize * 2 + 1;

      beforeEach(async () => {
        await spinMachine.setWhitelistEnabled(true);
        let txResponse: TransactionResponse = await spinMachine.setWhitelistAdmin(deployer.address);
        await txResponse.wait();

        await spinMachine.setStubWhitelister(deployer.address);
        await spinMachine.grantExtraSpin(user1.address, extraSpinCount);
        txResponse = await brlcMock.mint(spinMachine.address, tokenBalanceEnough);
        await txResponse.wait();
      });

      it("Be sure that the SpinMachine configuration is correct for the following tests", async () => {
        expect(await spinMachine.isWhitelistEnabled()).to.equal(true);
        expect(await spinMachine.getWhitelistAdmin()).to.equal(deployer.address);
        expect(await spinMachine.isWhitelister(deployer.address)).to.equal(true);
        expect(await spinMachine.extraSpins(user1.address)).to.equal(extraSpinCount);
        expect(await brlcMock.balanceOf(spinMachine.address)).to.equal(tokenBalanceEnough);
      })

      it("Function 'spin()' is reverted if the user is not whitelisted", async () => {
        expect(await spinMachine.isWhitelisted(user1.address)).to.equal(false);
        await expect(spinMachine.connect(user1).spin())
          .to.be.revertedWith(REVERT_MESSAGE_IF_ACCOUNT_IS_NOT_WHITELISTED);
      });

      it("Function 'spin()' executes successfully if the user is whitelisted", async () => {
        const txResponse: TransactionResponse = await spinMachine.whitelist(user1.address);
        await txResponse.wait();
        expect(await spinMachine.isWhitelisted(user1.address)).to.equal(true);
        await expect(spinMachine.connect(user1).spin())
          .to.emit(spinMachine, "Spin")
          .withArgs(user1.address, prize, prize, false);
      });

      it("Function 'spin()' executes as expected with a complex scenario", async () => {
        //The user is not in the whitelist
        expect(await spinMachine.isWhitelisted(user1.address)).to.equal(false);
        await expect(spinMachine.connect(user1).spin())
          .to.be.revertedWith(REVERT_MESSAGE_IF_ACCOUNT_IS_NOT_WHITELISTED);

        //The user is added to the whitelist, free spin
        let txResponse: TransactionResponse = await spinMachine.whitelist(user1.address);
        await txResponse.wait();
        expect(await spinMachine.isWhitelisted(user1.address)).to.equal(true);
        txResponse = spinMachine.connect(user1).spin();
        await expect(txResponse)
          .to.emit(spinMachine, "Spin")
          .withArgs(user1.address, prize, prize, false);

        //The user is removed from the list again
        txResponse = await spinMachine.unWhitelist(user1.address);
        await txResponse.wait();
        await expect(spinMachine.connect(user1).spin())
          .to.be.revertedWith(REVERT_MESSAGE_IF_ACCOUNT_IS_NOT_WHITELISTED);

        //The user is added to the whitelist again, extra spin
        txResponse = await spinMachine.whitelist(user1.address);
        await txResponse.wait();
        expect(await spinMachine.isWhitelisted(user1.address)).to.equal(true);
        txResponse = spinMachine.connect(user1).spin();
        await expect(txResponse)
          .to.emit(spinMachine, "Spin")
          .withArgs(user1.address, prize, prize, true);

        //All spins should be exhausted
        expect(await spinMachine.canSpin(user1.address)).to.equal(false);
      });
    });

    describe("Spin scenarios with a faucet to refund the transaction fees", async () => {
      const tokenBalanceEnough: number = prize + 1;
      let faucetMock: Contract;

      beforeEach(async () => {
        // Deploy mocked faucet
        const FaucetMock: ContractFactory = await ethers.getContractFactory("FaucetMock");
        faucetMock = await FaucetMock.deploy();
        await faucetMock.deployed();

        const txResponse: TransactionResponse = await brlcMock.mint(spinMachine.address, tokenBalanceEnough);
        await txResponse.wait();
      });

      it("Function 'spin()' does not use the faucet to refunding if the faucet address is zero", async () => {
        expect(await spinMachine.getFaucet()).to.equal(ethers.constants.AddressZero);
        const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
        await txResponse.wait();
        expect(await faucetMock.lastWithdrawAddress()).to.equal(ethers.constants.AddressZero);
      });

      it("Function 'spin()' uses the faucet to refunding if the faucet address is non-zero", async () => {
        let txResponse: TransactionResponse = await spinMachine.setFaucet(faucetMock.address);
        await txResponse.wait();
        expect(await spinMachine.getFaucet()).to.equal(faucetMock.address);
        txResponse = await spinMachine.connect(user1).spin();
        await txResponse.wait();
        expect(await faucetMock.lastWithdrawAddress()).to.equal(user1.address);
      });
    });

    describe("Spin scenarios with zero prize", async () => {
      const extraSpinsCount: number = 1;
      const tokenBalanceEnough: number = 1;
      const zeroPrizes: number[] = [0];

      beforeEach(async () => {
        await brlcMock.mint(spinMachine.address, tokenBalanceEnough);
        await spinMachine.grantExtraSpin(user1.address, extraSpinsCount);
        const txResponse: TransactionResponse = await spinMachine.setPrizes(zeroPrizes);
        await txResponse.wait();
      });

      it("Function 'spin()' transfers zero tokens both during the free spin and extra spin", async () => {
        //The free spin
        await expect(async () => {
          const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
          await txResponse.wait();
        }).to.changeTokenBalances(
          brlcMock,
          [spinMachine, user1],
          [0, 0]
        );

        //The extra spin
        await expect(async () => {
          const txResponse: TransactionResponse = await spinMachine.connect(user1).spin();
          await txResponse.wait();
        }).to.changeTokenBalances(
          brlcMock,
          [spinMachine, user1],
          [0, 0]
        );
      });

      it("Function 'spin()' emits the correct events both during the free spin and extra spin", async () => {
        //The free spin
        await expect(spinMachine.connect(user1).spin())
          .to.emit(spinMachine, "Spin")
          .withArgs(user1.address, 0, 0, false);

        //The extra spin
        await expect(spinMachine.connect(user1).spin())
          .to.emit(spinMachine, "Spin")
          .withArgs(user1.address, 0, 0, true);

      });
    });

    describe("Prize distribution", async () => {
      const prizes: number[] = [10, 20, 30];
      const numberOfPrizes: number = prizes.length;
      const prizeTotal: number = countNumberArrayTotal(prizes);
      let mockRandomProvider: Contract;

      beforeEach(async () => {
        //Deploy an out of chain RandomProvider
        const RandomProviderMock: ContractFactory = await ethers.getContractFactory("RandomProviderMock");
        mockRandomProvider = await RandomProviderMock.deploy();
        await mockRandomProvider.deployed();

        await spinMachine.setRandomProvider(mockRandomProvider.address);
        await spinMachine.setPrizes(prizes);
        await spinMachine.grantExtraSpin(user1.address, numberOfPrizes);
        let txResponse: TransactionResponse =
          await brlcMock.mint(spinMachine.address, prizes[0] + prizeTotal); //free spin + extra spins
        await txResponse.wait();

        //Spend the free spin, only extra spins should stay
        txResponse = await spinMachine.connect(user1).spin();
        await txResponse.wait();
      });

      it("Performs according to numbers from random provider", async () => {
        for (let i: number = 0; i < numberOfPrizes; ++i) {
          let prize: number = prizes[i];
          const txResponse: TransactionResponse = await mockRandomProvider.setRandomNumber(i);
          await txResponse.wait();
          await expect(spinMachine.connect(user1).spin())
            .to.emit(spinMachine, "Spin")
            .withArgs(user1.address, prize, prize, true);
        }
      });
    });
  });
});
