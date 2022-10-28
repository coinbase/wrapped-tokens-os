import { ethers } from "hardhat";
import { StakedTokenV1Instance } from "../../../@types/generated";
import {
  OracleUpdated,
  ExchangeRateUpdated,
} from "../../../@types/generated/StakedTokenV1";
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const StakedTokenV1 = artifacts.require("StakedTokenV1");

contract("StakedTokenV1", (accounts) => {
  const stakedTokenOwner = accounts[0];
  const nonOwner = accounts[1];
  const oraclePosition = ethers.utils.id(
    "org.coinbase.stakedToken.exchangeRateOracle"
  );
  const exchangeRatePosition = ethers.utils.id(
    "org.coinbase.stakedToken.exchangeRate"
  );

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
  });

  describe("updateOracle", () => {
    it("should fail to update oracle when caller is not the owner", async () => {
      await expectRevert(
        stakedToken.updateOracle(stakedTokenOwner, { from: nonOwner }),
        "Ownable: caller is not the owner"
      );
    });
    it("should fail to update oracle when the new oracle is the zero address", async () => {
      await expectRevert(
        stakedToken.updateOracle(ZERO_ADDRESS),
        "StakedTokenV1: oracle is the zero address"
      );
    });
    it("should fail to update oracle when the new oracle is already the oracled", async () => {
      await stakedToken.updateOracle(stakedTokenOwner);
      await expectRevert(
        stakedToken.updateOracle(stakedTokenOwner),
        "StakedTokenV1: new oracle is already the oracle"
      );
    });
    it("should successfully update the oracle", async () => {
      expect(await stakedToken.oracle()).to.equal(ZERO_ADDRESS);
      let oracleStorage = await ethers.provider.getStorageAt(
        stakedToken.address,
        oraclePosition
      );
      expect(ethers.utils.hexDataSlice(oracleStorage, 12)).to.equal(
        ZERO_ADDRESS
      );
      const result = await stakedToken.updateOracle(stakedTokenOwner);
      const log = result.logs[0] as Truffle.TransactionLog<OracleUpdated>;
      expect(log.event).to.equal("OracleUpdated");
      expect(log.args[0]).to.equal(stakedTokenOwner);

      expect(await stakedToken.oracle()).to.equal(stakedTokenOwner);
      oracleStorage = await ethers.provider.getStorageAt(
        stakedToken.address,
        oraclePosition
      );
      expect(ethers.utils.hexDataSlice(oracleStorage, 12)).to.equal(
        stakedTokenOwner.toLowerCase()
      );
    });
  });
  describe("updateExchangeRate", () => {
    beforeEach(async () => {
      await stakedToken.updateOracle(stakedTokenOwner);
    });
    it("should fail to update exchange rate when the caller is not the oracle", async () => {
      await expectRevert(
        stakedToken.updateExchangeRate(stakedTokenOwner, { from: nonOwner }),
        "StakedTokenV1: caller is not the oracle"
      );
    });
    it("should fail to update the exchange rate when the new exchange rate is zero", async () => {
      await expectRevert(
        stakedToken.updateExchangeRate(0),
        "StakedTokenV1: new exchange rate cannot be 0"
      );
    });
    it("should successfully update the exchange rate", async () => {
      const newExchangeRate = 1;
      expect((await stakedToken.exchangeRate()).toNumber()).to.equal(0);
      let exchangeRateStorage = await ethers.provider.getStorageAt(
        stakedToken.address,
        exchangeRatePosition
      );
      expect(exchangeRateStorage).to.equal(ethers.constants.HashZero);
      const result = await stakedToken.updateExchangeRate(newExchangeRate);
      const log = result.logs[0] as Truffle.TransactionLog<ExchangeRateUpdated>;
      expect(log.event).to.equal("ExchangeRateUpdated");
      expect(log.args[0]).to.equal(stakedTokenOwner);
      expect(log.args[1].toNumber()).to.equal(newExchangeRate);

      expect((await stakedToken.exchangeRate()).toNumber()).to.equal(
        newExchangeRate
      );
      exchangeRateStorage = await ethers.provider.getStorageAt(
        stakedToken.address,
        exchangeRatePosition
      );
      expect(ethers.BigNumber.from(exchangeRateStorage).toNumber()).to.equal(
        newExchangeRate
      );
    });
  });
});
