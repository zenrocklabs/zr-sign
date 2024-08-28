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
    hardhat: {
      initialBaseFeePerGas: 1000000000, // 1 Gwei
      gasPrice: 1000000000
    },
    sepolia: {
      url: infuraProvider("sepolia"),
      accounts: hdWallet()
    },
    polygon_amoy: {
      url: infuraProvider("polygon-amoy"),
      accounts: hdWallet()
    },
    avalanche_fuji: {
      url: infuraProvider("avalanche-fuji"),
      accounts: hdWallet()
    },
    arb_sepolia: {
      url: infuraProvider("arbitrum-sepolia"),
      accounts: hdWallet()
    },
    binance_testnet: {
      url: `https://young-falling-diagram.bsc-testnet.quiknode.pro/${conf.BINANCE_RPC_KEY}/`,
      accounts: hdWallet()
    },
    base_sepolia: {
      url: `https://frosty-bold-owl.base-sepolia.quiknode.pro/${conf.BASE_RPC_KEY}/`,
      accounts: hdWallet()
    },
    optimism_sepolia: {
      url: infuraProvider("optimism-sepolia"),
      accounts: hdWallet()
    }
  },
  etherscan: {
    apiKey: {
      sepolia: conf.ETHERSCAN_KEY,
      avalancheFujiTestnet: conf.AVALANCHE_KEY,
      polygonMumbai: conf.POLYGON_KEY,
      polygonAmoy: conf.POLYGON_KEY,
      optimism_sepolia: conf.OPTIMISM_KEY,
      arbitrumSepolia: conf.ARBITRUM_KEY,
      bscTestnet: conf.BINANCE_KEY,
      baseSepolia: conf.BASE_KEY
    },
    customChains: [
      {
        network: "optimism_sepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io"
        }
      }
    ]
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