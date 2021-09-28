import { HardhatUserConfig } from "hardhat/types";

import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "@nomiclabs/hardhat-etherscan";
import "solidity-coverage";
import "hardhat-gas-reporter"

require("dotenv").config();


const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            //runs: 99999,
            runs: 25000,
          },
        }
      }
    ],
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    disambiguatePaths: false,
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/" + (process.env.ALCHEMY_API_KEY || ''),
        blockNumber: 12908431
      }
    },
    kovan: {
      url: process.env.KOVAN_URI,
      accounts: [process.env.KOVAN_PRIVATE_KEY || ''],
      /*accounts: {
        mnemonic: process.env.KOVAN_MNEMONIC,
      },*/
    },
    rinkeby: {
      url: process.env.RINKEBY_URI,
      accounts: [process.env.RINKEBY_PRIVATE_KEY || ''],
    },
    mainnet: {
      url: process.env.MAINNET_URI,
      accounts: [process.env.MAINNET_PRIVATE_KEY || ''],
      /*accounts: {
        mnemonic: process.env.MAINNET_MNEMONIC,
      },*/
    },
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
    enabled: false
  }
};

export default config;
