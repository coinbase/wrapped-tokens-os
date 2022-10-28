import {
  FiatTokenV21Instance,
  MintForwarderInstance,
} from "../../@types/generated";
import { Mint } from "../../@types/generated/MintForwarder";
import { AllowanceReplenished } from "../../@types/generated/RateLimitTest";
import { OwnershipTransferred } from "../../@types/generated/Ownable";
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const time = require("@openzeppelin/test-helpers/src/time");

const MintForwarder = artifacts.require("MintForwarder");
const FiatTokenV2_1 = artifacts.require("FiatTokenV2_1");

contract("MintForwarder", (accounts) => {
  const fiatTokenOwner = accounts[0];
  const mintForwarderOwner = accounts[1];
  const caller = accounts[2];
  const nonCaller = accounts[3];

  const forwarderAllowanceAmount = 1000;
  const mintAmount = 100;
  const interval = 3600; // seconds

  let mintForwarder: MintForwarderInstance;
  let fiatToken: FiatTokenV21Instance;

  beforeEach(async () => {
    fiatToken = await FiatTokenV2_1.new();
    await fiatToken.initialize(
      "Coinbase Eth2",
      "CBETH2",
      "ETH",
      6,
      fiatTokenOwner,
      fiatTokenOwner,
      fiatTokenOwner,
      fiatTokenOwner
    );
    await fiatToken.initializeV2("Coinbase Eth2");
    mintForwarder = await MintForwarder.new();
    await fiatToken.configureMinter(
      mintForwarder.address,
      forwarderAllowanceAmount,
      {
        from: fiatTokenOwner,
      }
    );
  });

  describe("initialize", () => {
    it("should fail to initialize when call is not the owner", async () => {
      await expectRevert(
        mintForwarder.initialize(mintForwarderOwner, fiatToken.address, {
          from: nonCaller,
        }),
        "Ownable: caller is not the owner"
      );
    });
    it("should fail to initialize when newOwner is the zero address", async () => {
      await expectRevert(
        mintForwarder.initialize(ZERO_ADDRESS, fiatToken.address),
        "MintForwarder: owner is the zero address"
      );
    });

    it("should fail to initialize when newTokenContract is the zero address", async () => {
      await expectRevert(
        mintForwarder.initialize(mintForwarderOwner, ZERO_ADDRESS),
        "MintForwarder: tokenContract is the zero address"
      );
    });

    it("should fail to initialize twice", async () => {
      await mintForwarder.initialize(mintForwarderOwner, fiatToken.address);

      await expectRevert(
        mintForwarder.initialize(mintForwarderOwner, fiatToken.address, {
          from: mintForwarderOwner,
        }),
        "MintForwarder: contract is already initialized"
      );
    });

    it("should initialize successfully", async () => {
      expect(await mintForwarder.owner()).to.equal(fiatTokenOwner);
      expect(await mintForwarder.tokenContract()).to.equal(ZERO_ADDRESS);

      const result = await mintForwarder.initialize(
        mintForwarderOwner,
        fiatToken.address
      );
      const log = result.logs[0] as Truffle.TransactionLog<
        OwnershipTransferred
      >;
      expect(log.event).to.equal("OwnershipTransferred");
      expect(log.args[0]).to.equal(fiatTokenOwner);
      expect(log.args[1]).to.equal(mintForwarderOwner);

      expect(await mintForwarder.owner()).to.equal(mintForwarderOwner);
      expect(await mintForwarder.tokenContract()).to.equal(fiatToken.address);
    });
  });

  describe("mint", () => {
    beforeEach(async () => {
      await mintForwarder.initialize(mintForwarderOwner, fiatToken.address);
      await mintForwarder.configureCaller(caller, mintAmount, interval, {
        from: mintForwarderOwner,
      });
    });

    it("should fail to mint when msg.sender is not a caller", async () => {
      await expectRevert(
        mintForwarder.mint(nonCaller, mintAmount, {
          from: nonCaller,
        }),
        "RateLimit: caller is not whitelisted"
      );
    });

    it("should fail to mint to the zero address address", async () => {
      await expectRevert(
        mintForwarder.mint(ZERO_ADDRESS, mintAmount, {
          from: caller,
        }),
        "MintForwarder: cannot mint to the zero address"
      );
    });

    it("should fail to mint when amount is 0", async () => {
      await expectRevert(
        mintForwarder.mint(nonCaller, 0, {
          from: caller,
        }),
        "MintForwarder: mint amount not greater than 0"
      );
    });

    it("should fail to mint when the mint amount is greater than the caller's mint allowance", async () => {
      const overCallerAllowance = mintAmount + 1;
      await expectRevert(
        mintForwarder.mint(nonCaller, overCallerAllowance, {
          from: caller,
        }),
        "MintForwarder: mint amount exceeds caller allowance"
      );
    });

    it("should fail to mint when the mint amount is greater than the mint forwarder contract's mint allowance", async () => {
      const overforwarderAllowance = forwarderAllowanceAmount + 1;
      await mintForwarder.configureCaller(
        caller,
        overforwarderAllowance,
        interval,
        {
          from: mintForwarderOwner,
        }
      );
      await expectRevert(
        mintForwarder.mint(nonCaller, overforwarderAllowance, {
          from: caller,
        }),
        "FiatToken: mint amount exceeds minterAllowance"
      );
    });
    it("should mint the amount, increasing balance of recipient by amount, increasing total supply by amount, and decreasing allowance by amount", async () => {
      const expectedAllowance =
        (await fiatToken.minterAllowance(mintForwarder.address)).toNumber() -
        mintAmount;
      const expectedTotalSupply =
        (await fiatToken.totalSupply()).toNumber() + mintAmount;
      const expectedCallerAllowance =
        (await mintForwarder.allowances(caller)).toNumber() - mintAmount;
      const halfInterval = interval / 2;
      const halfMintAmount = mintAmount / 2;

      let result = await mintForwarder.mint(nonCaller, mintAmount, {
        from: caller,
      });

      // Mint event emmited by FiatToken
      let mintLog = result.logs[0] as Truffle.TransactionLog<Mint>;
      expect(mintLog.event).to.equal("Mint");
      expect(mintLog.args[0]).to.equal(mintForwarder.address);
      expect(mintLog.args[1]).to.equal(nonCaller);
      expect(mintLog.args[2].toNumber()).to.equal(mintAmount);

      // Mint event emmited by MintForwarder
      mintLog = result.logs[1] as Truffle.TransactionLog<Mint>;
      expect(mintLog.event).to.equal("Mint");
      expect(mintLog.args[0]).to.equal(caller);
      expect(mintLog.args[1]).to.equal(nonCaller);
      expect(mintLog.args[2].toNumber()).to.equal(mintAmount);

      expect(
        (await fiatToken.minterAllowance(mintForwarder.address)).toNumber()
      ).to.equal(expectedAllowance);
      expect((await fiatToken.balanceOf(nonCaller)).toNumber()).to.equal(
        mintAmount
      );
      expect((await fiatToken.totalSupply()).toNumber()).to.equal(
        expectedTotalSupply
      );
      expect((await mintForwarder.allowances(caller)).toNumber()).to.equal(
        expectedCallerAllowance
      );

      await time.increase(halfInterval);

      expect(
        (await mintForwarder.estimatedAllowance(caller)).toNumber()
      ).to.equal(halfMintAmount);

      result = await mintForwarder.mint(nonCaller, halfMintAmount, {
        from: caller,
      });

      // AllowanceReplenished emitted by RateLimit
      const allowanceReplenishedLog = result.logs[0] as Truffle.TransactionLog<
        AllowanceReplenished
      >;
      expect(allowanceReplenishedLog.event).to.equal("AllowanceReplenished");
      expect(allowanceReplenishedLog.args[0]).to.equal(caller);
      expect(allowanceReplenishedLog.args[1].toNumber()).to.equal(
        halfMintAmount
      );
      expect(allowanceReplenishedLog.args[2].toNumber()).to.equal(
        halfMintAmount
      );

      // Mint event emmited by MintForwarder
      mintLog = result.logs[2] as Truffle.TransactionLog<Mint>;
      expect(mintLog.event).to.equal("Mint");
      expect(mintLog.args[0]).to.equal(caller);
      expect(mintLog.args[1]).to.equal(nonCaller);
      expect(mintLog.args[2].toNumber()).to.equal(halfMintAmount);

      expect(
        (await mintForwarder.estimatedAllowance(caller)).toNumber()
      ).to.equal(0);

      await time.increase(interval + 1);

      expect(
        (await mintForwarder.estimatedAllowance(caller)).toNumber()
      ).to.equal(mintAmount);
    });
  });
});
