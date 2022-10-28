import {
  FiatTokenV21Instance,
  RateLimitTestInstance,
} from "../../@types/generated";
import {
  CallerConfigured,
  CallerRemoved,
  AllowanceReplenished,
} from "../../@types/generated/RateLimitTest";
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const time = require("@openzeppelin/test-helpers/src/time");

const RateLimit = artifacts.require("RateLimitTest");
const FiatTokenV2_1 = artifacts.require("FiatTokenV2_1");

contract("RateLimit", (accounts) => {
  const fiatTokenOwner = accounts[0];
  const rateLimitOwner = accounts[1];
  const caller = accounts[2];

  const interval = 3600; // seconds
  const newInterval = interval * 2;
  const amount = 100;
  const newAmount = amount * 2;

  let rateLimit: RateLimitTestInstance;
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
    rateLimit = await RateLimit.new({ from: rateLimitOwner });
    await fiatToken.configureMinter(rateLimit.address, 1000, {
      from: fiatTokenOwner,
    });
  });

  describe("configureCaller", () => {
    it("should fail to configure caller when sender is not the owner", async () => {
      await expectRevert(
        rateLimit.configureCaller(caller, newAmount, newInterval, {
          from: caller,
        }),
        "Ownable: caller is not the owner"
      );
    });

    it("should fail to configure caller when caller is the zero address", async () => {
      await expectRevert(
        rateLimit.configureCaller(ZERO_ADDRESS, newAmount, newInterval, {
          from: rateLimitOwner,
        }),
        "RateLimit: caller is the zero address"
      );
    });

    it("should fail to configure caller when amount is zero", async () => {
      await expectRevert(
        rateLimit.configureCaller(caller, 0, newInterval, {
          from: rateLimitOwner,
        }),
        "RateLimit: amount is zero"
      );
    });

    it("should fail to configure caller when interval is zero", async () => {
      await expectRevert(
        rateLimit.configureCaller(caller, newAmount, 0, {
          from: rateLimitOwner,
        }),
        "RateLimit: interval is zero"
      );
    });

    it("should configure non-caller", async () => {
      expect(await rateLimit.callers(caller)).to.equal(false);
      const result = await rateLimit.configureCaller(caller, amount, interval, {
        from: rateLimitOwner,
      });
      expect(await rateLimit.callers(caller)).to.equal(true);
      expect(await rateLimit.callers(caller)).to.equal(true);
      expect((await rateLimit.allowances(caller)).toNumber()).to.equal(amount);
      expect(await rateLimit.maxAllowances(caller)).to.not.equal(0);
      expect(await rateLimit.allowancesLastSet(caller)).to.not.equal(0);

      const log = result.logs[0] as Truffle.TransactionLog<CallerConfigured>;
      expect(log.event).to.equal("CallerConfigured");
      expect(log.args[0]).to.equal(caller);
      expect(log.args[1].toNumber()).to.equal(amount);
      expect(log.args[2].toNumber()).to.equal(interval);
    });

    it("should configure caller", async () => {
      await rateLimit.configureCaller(caller, amount, interval, {
        from: rateLimitOwner,
      });
      const result = await rateLimit.configureCaller(
        caller,
        newAmount,
        newInterval,
        {
          from: rateLimitOwner,
        }
      );
      expect(await rateLimit.callers(caller)).to.equal(true);
      expect(await rateLimit.callers(caller)).to.equal(true);
      expect((await rateLimit.allowances(caller)).toNumber()).to.equal(
        newAmount
      );
      expect(await rateLimit.maxAllowances(caller)).to.not.equal(0);
      expect(await rateLimit.allowancesLastSet(caller)).to.not.equal(0);

      const log = result.logs[0] as Truffle.TransactionLog<CallerConfigured>;
      expect(log.event).to.equal("CallerConfigured");
      expect(log.args[0]).to.equal(caller);
      expect(log.args[1].toNumber()).to.equal(newAmount);
      expect(log.args[2].toNumber()).to.equal(newInterval);
    });
  });

  describe("removeCaller", () => {
    beforeEach(async () => {
      await rateLimit.configureCaller(caller, amount, interval, {
        from: rateLimitOwner,
      });
    });

    it("should fail to remove caller when sender is not the owner", async () => {
      await expectRevert(
        rateLimit.removeCaller(caller, {
          from: caller,
        }),
        "Ownable: caller is not the owner"
      );
    });

    it("should remove the caller and set the caller's interval, allowance last set, max allowance, and allowance to zero", async () => {
      const result = await rateLimit.removeCaller(caller, {
        from: rateLimitOwner,
      });

      const log = result.logs[0] as Truffle.TransactionLog<CallerRemoved>;
      expect(log.event).to.equal("CallerRemoved");
      expect(log.args[0]).to.equal(caller);

      expect(await rateLimit.callers(caller)).to.equal(false);
      expect((await rateLimit.intervals(caller)).toNumber()).to.equal(0);
      expect((await rateLimit.allowancesLastSet(caller)).toNumber()).to.equal(
        0
      );
      expect((await rateLimit.maxAllowances(caller)).toNumber()).to.equal(0);
      expect((await rateLimit.allowances(caller)).toNumber()).to.equal(0);
    });

    describe("_replenishAllowance", () => {
      beforeEach(async () => {
        await rateLimit.configureCaller(caller, amount, interval, {
          from: rateLimitOwner,
        });
        // Sets the caller's allowance last set to now
        await rateLimit._replenishAllowanceTest(caller);
        // Sets the caller's allowance to 0
        await rateLimit.useRateLimitTest(amount, { from: caller });
      });

      it("should increase the callers's allowance by the proportion of the interval that has elapsed since the allowance was last set, multiplied by their maximum allowance for the interval", async () => {
        const timePassed = Math.floor(interval / 2);
        const expectedFinalCallerAllowance = Math.floor(
          (timePassed / interval) * amount
        );

        expect((await rateLimit.allowances(caller)).toNumber()).to.equal(0);

        await time.increase(timePassed);

        expect(
          (await rateLimit.estimatedAllowance(caller)).toNumber()
        ).to.equal(expectedFinalCallerAllowance);

        const beforeRefreshTime = (
          await rateLimit.allowancesLastSet(caller)
        ).toNumber();
        const result = await rateLimit._replenishAllowanceTest(caller);
        const afterRefreshTime = (
          await rateLimit.allowancesLastSet(caller)
        ).toNumber();

        const log = result.logs[0] as Truffle.TransactionLog<
          AllowanceReplenished
        >;
        expect(log.event).to.equal("AllowanceReplenished");
        expect(log.args[0]).to.equal(caller);
        expect(log.args[1].toNumber()).to.equal(expectedFinalCallerAllowance);
        expect(log.args[2].toNumber()).to.equal(expectedFinalCallerAllowance);

        expect((await rateLimit.allowances(caller)).toNumber()).to.equal(
          expectedFinalCallerAllowance
        );
        expect(beforeRefreshTime + timePassed).to.be.within(
          afterRefreshTime - 3,
          afterRefreshTime + 1
        );
      });

      it("should not increase the callers's allowance more than the caller's maximum allowance", async () => {
        const timePassed = interval * 2;

        expect((await rateLimit.allowances(caller)).toNumber()).to.equal(0);

        await time.increase(timePassed);

        expect(
          (await rateLimit.estimatedAllowance(caller)).toNumber()
        ).to.equal(amount);

        const result = await rateLimit._replenishAllowanceTest(caller);

        const log = result.logs[0] as Truffle.TransactionLog<
          AllowanceReplenished
        >;
        expect(log.event).to.equal("AllowanceReplenished");
        expect(log.args[0]).to.equal(caller);
        expect(log.args[1].toNumber()).to.equal(amount);
        expect(log.args[2].toNumber()).to.equal(amount);

        expect((await rateLimit.allowances(caller)).toNumber()).to.equal(
          amount
        );
      });
      it("should not increase the callers's allowance if not time has passed since replenish allowance was last called", async () => {
        const timePassed = Math.floor(interval / 2);
        const expectedFinalCallerAllowance = Math.floor(
          (timePassed / interval) * amount
        );

        await time.increase(timePassed);

        await rateLimit._replenishAllowanceTest(caller);
        expect((await rateLimit.allowances(caller)).toNumber()).to.equal(
          expectedFinalCallerAllowance
        );
        await rateLimit._replenishAllowanceTest(caller);
        expect((await rateLimit.allowances(caller)).toNumber()).to.equal(
          expectedFinalCallerAllowance
        );
      });
    });
  });
  describe("currentAllowance", () => {
    beforeEach(async () => {
      await rateLimit.configureCaller(caller, amount, interval, {
        from: rateLimitOwner,
      });
      // Sets the caller's allowance last set to now
      await rateLimit._replenishAllowanceTest(caller);
      // Sets the caller's allowance to 0
      await rateLimit.useRateLimitTest(amount, { from: caller });
    });

    it("should call _replenishAllowance and return updated allowance", async () => {
      const timePassed = Math.floor(interval / 2);
      const expectedFinalCallerAllowance = Math.floor(
        (timePassed / interval) * amount
      );

      await time.increase(timePassed);

      expect(
        (await rateLimit.currentAllowance.call(caller)).toNumber()
      ).to.equal(expectedFinalCallerAllowance);

      const result = await rateLimit.currentAllowance(caller);

      const log = result.logs[0] as Truffle.TransactionLog<
        AllowanceReplenished
      >;
      expect(log.event).to.equal("AllowanceReplenished");
      expect(log.args[1].toNumber()).to.equal(expectedFinalCallerAllowance);
      expect(log.args[2].toNumber()).to.equal(expectedFinalCallerAllowance);

      expect((await rateLimit.allowances(caller)).toNumber()).to.equal(
        expectedFinalCallerAllowance
      );
    });
  });
});
