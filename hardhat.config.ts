import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

const hardhatConfig: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      initialBaseFeePerGas: 1000000000, // 1 Gwei
      gasPrice: 1000000000,             // 1 Gwei
      blockGasLimit: 30000000,
      accounts: {
        mnemonic: "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat", // ganache deterministic mnemonic
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        passphrase: "",
      }
    },
    sepolia: {
      url: infuraProvider("sepolia"),
      accounts: hdWallet(),
    },
    polygon_amoy: {
      url: infuraProvider("polygon-amoy"),
      accounts: hdWallet(),
    },
    avalanche_fuji: {
      url: infuraProvider("avalanche-fuji"),
      accounts: hdWallet(),
    },
    arb_sepolia: {
      url: infuraProvider("arbitrum-sepolia"),
      accounts: hdWallet(),
    },
    binance_testnet: {
      url: `https://young-falling-diagram.bsc-testnet.quiknode.pro/${process.env.BINANCE_RPC_KEY || ""}/`,
      accounts: hdWallet(),
    },
    base_sepolia: {
      url: `https://frosty-bold-owl.base-sepolia.quiknode.pro/${process.env.BASE_RPC_KEY || ""}/`,
      accounts: hdWallet(),
    },
    optimism_sepolia: {
      url: infuraProvider("optimism-sepolia"),
      accounts: hdWallet(),
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_KEY || "",
      avalancheFujiTestnet: process.env.AVALANCHE_KEY || "",
      polygonMumbai: process.env.POLYGON_KEY || "",
      polygonAmoy: process.env.POLYGON_KEY || "",
      optimism_sepolia: process.env.OPTIMISM_KEY || "",
      arbitrumSepolia: process.env.ARBITRUM_KEY || "",
      bscTestnet: process.env.BINANCE_KEY || "",
      baseSepolia: process.env.BASE_KEY || "",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};

function infuraProvider(network: string) {
  return `https://${network}.infura.io/v3/${process.env.INFURA_KEY || ""}`;
}

function hdWallet() {
  return {
    mnemonic: process.env.MNEMONIC || "",
    path: "m/44'/60'/0'/0",
    initialIndex: 0,
    count: 20,
    passphrase: "",
  };
}

export default hardhatConfig;