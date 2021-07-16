import { HardhatUserConfig } from "hardhat/types";

import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "@nomiclabs/hardhat-etherscan";
import "solidity-coverage";

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
            //runs: 9999,
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
      chainId: 1337,
      allowUnlimitedContractSize: false,
      blockGasLimit: 25000000
    },
    localhost: {},
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
    coverage: {
      url: 'http://127.0.0.1:8555' // Coverage launches its own ganache-cli client
    }
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY || ''
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5"
  }
};

export default config;
