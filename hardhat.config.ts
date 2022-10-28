import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-truffle5";
import "hardhat-contract-sizer";
import "solidity-coverage";
import "@typechain/hardhat";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000000,
          },
        },
      },
      {
        version: "0.8.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000000,
          },
        },
      },
    ],
  },
  typechain: {
    outDir: "@types/generated",
    target: "truffle-v5",
  },
  mocha: {
    timeout: 0,
  },
};
