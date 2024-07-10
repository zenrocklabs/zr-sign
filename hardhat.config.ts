import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import { config as conf } from "./config";

const hardhatConfig: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: infuraProvider("sepolia"),
      accounts: hdWallet()
    },
    polygon: {
      url: infuraProvider("polygon-amoy"),
      accounts: hdWallet()
    },
    avalancheFuji: {
      url: infuraProvider("avalanche-fuji"),
      accounts: hdWallet()
    }
  },
  etherscan: {
    apiKey: {
      sepolia: conf.ETHERSCAN_KEY,
      avalancheFujiTestnet: conf.AVALANCHE_KEY,
      polygonMumbai: conf.POLYGON_KEY,
      polygon: conf.POLYGON_KEY,
      optimism: conf.OPTIMISM_KEY,
      arbitrum: conf.ARBITRUM_KEY
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
};

function infuraProvider(network: string) {
  if (!conf.INFURA_KEY) {
    console.error("A valid INFURA_KEY must be provided in config.ts");
    process.exit(1);
  }
  return `https://${network}.infura.io/v3/${conf.INFURA_KEY}`;
}

function hdWallet() {
  if (!conf.MNEMONIC) {
    console.error("A valid MNEMONIC must be provided in config.ts");
    process.exit(1);
  }
  return {
    mnemonic: conf.MNEMONIC,
    path: "m/44'/60'/0'/0",
    initialIndex: 0,
    count: 20,
    passphrase: ""
  };
}

export default hardhatConfig;