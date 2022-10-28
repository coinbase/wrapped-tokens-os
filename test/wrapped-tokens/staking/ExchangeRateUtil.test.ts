import {
  StakedTokenV1Instance,
  ExchangeRateUtilTestInstance,
} from "../../../@types/generated";
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const ExchangeRateUtilTest = artifacts.require("ExchangeRateUtilTest");
const StakedTokenV1 = artifacts.require("StakedTokenV1");

contract("ExchangeRateUtil", (accounts) => {
  const stakedTokenOwner = accounts[0];
  const exchangeRate = 100;
  const newExchangeRate = 110;

  let exchangeRateUtil: ExchangeRateUtilTestInstance;
  let stakedToken: StakedTokenV1Instance;

  beforeEach(async () => {
    stakedToken = await StakedTokenV1.new();
    await stakedToken.initialize(
      "",
      "",
      "",
      0,
      stakedTokenOwner,
      stakedTokenOwner,
      stakedTokenOwner,
      stakedTokenOwner
    );
    exchangeRateUtil = await ExchangeRateUtilTest.new();
    await stakedToken.updateOracle(exchangeRateUtil.address, {
      from: stakedTokenOwner,
    });
    await exchangeRateUtil.safeUpdateExchangeRate(
      exchangeRate,
      stakedToken.address
    );
  });

  describe("safeGetExchangeRate", () => {
    describe("safeUpdateExchangeRate", () => {
      it("it updates the exchange rate for the given token address", async () => {
        await exchangeRateUtil.safeUpdateExchangeRate(
          newExchangeRate,
          stakedToken.address
        );
        expect(
          (
            await exchangeRateUtil.safeGetExchangeRate(stakedToken.address)
          ).toNumber()
        ).to.eq(newExchangeRate);
      });

      it("fails if caller isn't the oracle", async () => {
        await stakedToken.updateOracle(stakedTokenOwner, {
          from: stakedTokenOwner,
        });
        await expectRevert(
          exchangeRateUtil.safeUpdateExchangeRate(
            newExchangeRate,
            ZERO_ADDRESS
          ),
          "VM Exception while processing transaction: reverted with reason string 'Address: call to non-contract'"
        );
      });

      it("fails if an invalid contract address is given", async () => {
        await expectRevert(
          exchangeRateUtil.safeUpdateExchangeRate(
            newExchangeRate,
            ZERO_ADDRESS
          ),
          "VM Exception while processing transaction: reverted with reason string 'Address: call to non-contract'"
        );
      });

      it("fails if update exchange rate function doesn't exist", async () => {
        await expectRevert(
          exchangeRateUtil.safeUpdateExchangeRate(
            newExchangeRate,
            exchangeRateUtil.address
          ),
          "VM Exception while processing transaction: reverted with reason string 'ExchangeRateUtil: update exchange rate failed'"
        );
      });
    });
    it("it gets the exchange rate for given token address", async () => {
      const expectedExchangeRate = (
        await stakedToken.exchangeRate()
      ).toNumber();
      expect(
        (
          await exchangeRateUtil.safeGetExchangeRate(stakedToken.address)
        ).toNumber()
      ).to.eq(expectedExchangeRate);
    });

    it("fails if an invalid contract address is given", async () => {
      await expectRevert(
        exchangeRateUtil.safeGetExchangeRate(ZERO_ADDRESS),
        "VM Exception while processing transaction: reverted with reason string 'Address: static call to non-contract'"
      );
    });

    it("fails if get exchange rate function doesn't exist", async () => {
      await expectRevert(
        exchangeRateUtil.safeGetExchangeRate(exchangeRateUtil.address),
        "VM Exception while processing transaction: reverted with reason string 'ExchangeRateUtil: get exchange rate failed'"
      );
    });
  });
});
