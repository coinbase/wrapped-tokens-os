import { ExchangeRateUpdaterInstance } from "../../../@types/generated";
import { StakedTokenV1Instance } from "../../../@types/generated";
import { ExchangeRateUpdated } from "../../../@types/generated/ExchangeRateUpdater";
import { AllowanceReplenished } from "../../../@types/generated/RateLimitTest";
import { OwnershipTransferred } from "../../../@types/generated/Ownable";
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const time = require("@openzeppelin/test-helpers/src/time");

const ExchangeRateUpdater = artifacts.require("ExchangeRateUpdater");
const StakedTokenV1 = artifacts.require("StakedTokenV1");

contract("StakedTokenV1", (accounts) => {
  const stakedTokenOwner = accounts[0];
  const exchangeRateUpdaterOwner = accounts[1];
  const caller = accounts[2];
  const nonCaller = accounts[3];

  const exchangeRateUpdateAllowance = 10;
  const exchangeRate = 100;
  const newExchangeRate = 110;
  const interval = 3600; // seconds

  let exchangeRateUpdater: ExchangeRateUpdaterInstance;
  let stakedToken: StakedTokenV1Instance;

  beforeEach(async () => {
    stakedToken = await StakedTokenV1.new();
    await stakedToken.initialize(
      "Coinbase Eth2",
      "CBETH2",
      "ETH",
      6,
      stakedTokenOwner,
      stakedTokenOwner,
      stakedTokenOwner,
      stakedTokenOwner
    );
    await stakedToken.initializeV2("Coinbase Eth2");
    exchangeRateUpdater = await ExchangeRateUpdater.new();
    await stakedToken.updateOracle(stakedTokenOwner);
    await stakedToken.updateExchangeRate(exchangeRate);
    await stakedToken.updateOracle(exchangeRateUpdater.address);
  });

  describe("initialize", () => {
    it("should fail to initialize when caller is not the owner", async () => {
      await expectRevert(
        exchangeRateUpdater.initialize(
          exchangeRateUpdaterOwner,
          stakedToken.address,
          { from: nonCaller }
        ),
        "Ownable: caller is not the owner"
      );
    });
    it("should fail to initialize when newOwner is the zero address", async () => {
      await expectRevert(
        exchangeRateUpdater.initialize(ZERO_ADDRESS, stakedToken.address),
        "ExchangeRateUpdater: owner is the zero address"
      );
    });

    it("should fail to initialize when newTokenContract is the zero address", async () => {
      await expectRevert(
        exchangeRateUpdater.initialize(exchangeRateUpdaterOwner, ZERO_ADDRESS),
        "ExchangeRateUpdater: tokenContract is the zero address"
      );
    });

    it("should fail to initialize twice", async () => {
      await exchangeRateUpdater.initialize(
        exchangeRateUpdaterOwner,
        stakedToken.address
      );

      await expectRevert(
        exchangeRateUpdater.initialize(
          exchangeRateUpdaterOwner,
          stakedToken.address,
          { from: exchangeRateUpdaterOwner }
        ),
        "ExchangeRateUpdater: contract is already initialized"
      );
    });

    it("should initialize successfully", async () => {
      expect(await exchangeRateUpdater.owner()).to.equal(stakedTokenOwner);
      expect(await exchangeRateUpdater.tokenContract()).to.equal(ZERO_ADDRESS);

      const result = await exchangeRateUpdater.initialize(
        exchangeRateUpdaterOwner,
        stakedToken.address
      );
      const log = result.logs[0] as Truffle.TransactionLog<
        OwnershipTransferred
      >;
      expect(log.event).to.equal("OwnershipTransferred");
      expect(log.args[0]).to.equal(stakedTokenOwner);
      expect(log.args[1]).to.equal(exchangeRateUpdaterOwner);

      expect(await exchangeRateUpdater.owner()).to.equal(
        exchangeRateUpdaterOwner
      );
      expect(await exchangeRateUpdater.tokenContract()).to.equal(
        stakedToken.address
      );
    });
  });

  describe("updateExchangeRate", () => {
    beforeEach(async () => {
      await exchangeRateUpdater.initialize(
        exchangeRateUpdaterOwner,
        stakedToken.address
      );
      await exchangeRateUpdater.configureCaller(
        caller,
        exchangeRateUpdateAllowance,
        interval,
        {
          from: exchangeRateUpdaterOwner,
        }
      );
    });

    it("should fail to update exchange rate when msg.sender is not a caller", async () => {
      await expectRevert(
        exchangeRateUpdater.updateExchangeRate(newExchangeRate, {
          from: nonCaller,
        }),
        "RateLimit: caller is not whitelisted"
      );
    });

    it("should fail to update exchange rate to 0", async () => {
      await expectRevert(
        exchangeRateUpdater.updateExchangeRate(0, {
          from: caller,
        }),
        "ExchangeRateUpdater: new exchange rate must be greater than 0"
      );
    });

    it("should fail to update exchange rate when the update difference is 0", async () => {
      await expectRevert(
        exchangeRateUpdater.updateExchangeRate(exchangeRate, {
          from: caller,
        }),
        "ExchangeRateUpdater: exchange rate isn't new"
      );
    });

    it("should fail to update exchange rate when the update difference is greater than the caller's update allowance", async () => {
      const overCallerAllowance = newExchangeRate + 1;
      await expectRevert(
        exchangeRateUpdater.updateExchangeRate(overCallerAllowance, {
          from: caller,
        }),
        "ExchangeRateUpdater: exchange rate update exceeds allowance"
      );
    });

    it("should update the exchange rate when the new exchange rate is greater than the current exchange rate, decreasing allowance by the exchange rate update difference", async () => {
      const exchangeRateUpdateDifference = newExchangeRate - exchangeRate;
      const expectedCallerAllowance =
        (await exchangeRateUpdater.allowances(caller)).toNumber() -
        exchangeRateUpdateDifference;
      const halfInterval = interval / 2;
      const halfExchangeRateUpdateDifference = exchangeRateUpdateDifference / 2;
      const newExchangeRate2 = exchangeRate + halfExchangeRateUpdateDifference;

      let result = await exchangeRateUpdater.updateExchangeRate(
        newExchangeRate,
        {
          from: caller,
        }
      );

      // ExchangeRateUpdated event emitted by StakedToken
      let exchangeRateUpdatedLog = result.logs[0] as Truffle.TransactionLog<
        ExchangeRateUpdated
      >;
      expect(exchangeRateUpdatedLog.event).to.equal("ExchangeRateUpdated");
      expect(exchangeRateUpdatedLog.args[0]).to.equal(
        exchangeRateUpdater.address
      );
      expect(exchangeRateUpdatedLog.args[1].toNumber()).to.equal(
        newExchangeRate
      );

      // ExchangeRateUpdated event emitted by ExchangeRateUpdated
      exchangeRateUpdatedLog = result.logs[1] as Truffle.TransactionLog<
        ExchangeRateUpdated
      >;
      expect(exchangeRateUpdatedLog.event).to.equal("ExchangeRateUpdated");
      expect(exchangeRateUpdatedLog.args[0]).to.equal(caller);
      expect(exchangeRateUpdatedLog.args[1].toNumber()).to.equal(
        newExchangeRate
      );

      expect(
        (await exchangeRateUpdater.allowances(caller)).toNumber()
      ).to.equal(expectedCallerAllowance);

      await time.increase(halfInterval);

      expect(
        (await exchangeRateUpdater.estimatedAllowance(caller)).toNumber()
      ).to.equal(halfExchangeRateUpdateDifference);

      result = await exchangeRateUpdater.updateExchangeRate(newExchangeRate2, {
        from: caller,
      });

      // AllowanceReplenished emitted by RateLimit
      const allowanceReplenishedLog = result.logs[0] as Truffle.TransactionLog<
        AllowanceReplenished
      >;
      expect(allowanceReplenishedLog.event).to.equal("AllowanceReplenished");
      expect(allowanceReplenishedLog.args[0]).to.equal(caller);
      expect(allowanceReplenishedLog.args[1].toNumber()).to.equal(
        halfExchangeRateUpdateDifference
      );
      expect(allowanceReplenishedLog.args[2].toNumber()).to.equal(
        halfExchangeRateUpdateDifference
      );

      // ExchangeRateUpdated event emitted by ExchangeRateUpdated
      exchangeRateUpdatedLog = result.logs[2] as Truffle.TransactionLog<
        ExchangeRateUpdated
      >;
      expect(exchangeRateUpdatedLog.event).to.equal("ExchangeRateUpdated");
      expect(exchangeRateUpdatedLog.args[0]).to.equal(caller);
      expect(exchangeRateUpdatedLog.args[1].toNumber()).to.equal(
        newExchangeRate2
      );

      expect(
        (await exchangeRateUpdater.estimatedAllowance(caller)).toNumber()
      ).to.equal(0);

      await time.increase(interval + 1);

      expect(
        (await exchangeRateUpdater.estimatedAllowance(caller)).toNumber()
      ).to.equal(exchangeRateUpdateAllowance);
    });

    it("should update the exchange rate when the new exchange rate is less than the current exchange rate", async () => {
      const lesserExchangeRate = exchangeRate - 10;
      await exchangeRateUpdater.updateExchangeRate(lesserExchangeRate, {
        from: caller,
      });

      expect((await stakedToken.exchangeRate()).toNumber()).to.equal(
        lesserExchangeRate
      );
      expect(
        (await exchangeRateUpdater.estimatedAllowance(caller)).toNumber()
      ).to.equal(0);
    });
  });
});
