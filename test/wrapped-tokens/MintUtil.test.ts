import {
  FiatTokenV21Instance,
  MintUtilTestInstance,
} from "../../@types/generated";
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const MintUtilTest = artifacts.require("MintUtilTest");
const FiatTokenV2_1 = artifacts.require("FiatTokenV2_1");

contract("MintUtil", (accounts) => {
  const fiatTokenOwner = accounts[0];
  const safeMintRecipient = accounts[1];
  const safeMintAmount = 60;
  const safeMinterAllowance = 1000;

  let minterUtil: MintUtilTestInstance;
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
    await fiatToken.initializeV2("Coinbase Eth2", { from: fiatTokenOwner });
  });

  describe("safeMint", () => {
    beforeEach(async () => {
      minterUtil = await MintUtilTest.new();
      await fiatToken.configureMinter(minterUtil.address, safeMinterAllowance, {
        from: fiatTokenOwner,
      });
    });

    it("success case", async () => {
      const expectedFiatTokenAllowance =
        (await fiatToken.minterAllowance(minterUtil.address)).toNumber() -
        safeMintAmount;
      const expectedFiatTokenTotalSupply =
        (await fiatToken.totalSupply()).toNumber() + safeMintAmount;

      await minterUtil.safeMint(
        safeMintRecipient,
        safeMintAmount,
        fiatToken.address
      );

      expect(
        (await fiatToken.minterAllowance(minterUtil.address)).toNumber()
      ).to.equal(expectedFiatTokenAllowance);
      expect((await fiatToken.totalSupply()).toNumber()).to.equal(
        expectedFiatTokenTotalSupply
      );
      expect(
        (await fiatToken.balanceOf(safeMintRecipient)).toNumber()
      ).to.equal(safeMintAmount);
    });

    it("fails if an invalid contract address is given", async () => {
      await expectRevert(
        minterUtil.safeMint(safeMintRecipient, safeMintAmount, ZERO_ADDRESS),
        "VM Exception while processing transaction: reverted with reason string 'Address: call to non-contract'"
      );
    });

    it("fails to mint when the amount is 0", async () => {
      await expectRevert(
        minterUtil.safeMint(safeMintRecipient, 0, fiatToken.address),
        "VM Exception while processing transaction: reverted with reason string 'FiatToken: mint amount not greater than 0'"
      );
    });

    it("fails to mint if the amount exceeds the minter's allowance on the downstream token", async () => {
      await expectRevert(
        minterUtil.safeMint(
          safeMintRecipient,
          safeMinterAllowance + 10,
          fiatToken.address
        ),
        "FiatToken: mint amount exceeds minterAllowance"
      );
    });
  });
});
