import { HardhatUserConfig } from "hardhat/types";

import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "@nomiclabs/hardhat-etherscan";
import "solidity-coverage";
import "hardhat-gas-reporter";

require("dotenv").config();


const TEST_MNEMONIC = "test test test test test test test test test test test junk";
const TEST_ACCOUNT = { mnemonic: TEST_MNEMONIC, }


const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    compilers: [
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        }
      }
    ],
    overrides: {
      "contracts/tests/DelegateRegistry.sol" : {
        version: "0.7.2",
        settings: {
          optimizer: {
            enabled: false,
            runs: 200,
          }
        }
      },
      "contracts/tests/Comp.sol" : {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          }
        }
      },
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/" + (process.env.ALCHEMY_API_KEY || ''),
        blockNumber: 14741400
      }
    },
    kovan: {
      url: process.env.KOVAN_URI || '',
      accounts: process.env.KOVAN_PRIVATE_KEY ? [process.env.KOVAN_PRIVATE_KEY] : TEST_ACCOUNT,
      /*accounts: {
        mnemonic: process.env.KOVAN_MNEMONIC,
      },*/
    },
    mainnet: {
      url: process.env.MAINNET_URI || '',
      accounts: process.env.MAINNET_PRIVATE_KEY ? [process.env.MAINNET_PRIVATE_KEY] : TEST_ACCOUNT,
      /*accounts: {
        mnemonic: process.env.MAINNET_MNEMONIC,
      },*/
    },
  },
  mocha: {
    timeout: 0
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY || ''
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5"
  },
  gasReporter: {
    enabled: true
  }
};

export default config;
