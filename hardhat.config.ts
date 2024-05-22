import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

let conf = {
  MNEMONIC: "mandate dance blood bag income element maid void install hungry quarter rack",
  INFURA_KEY: "2735c6483f3e4024b2862bbabe2edf19",
  QUICKNODE_ZK_POLYGON_KEY: "",
  ETHERSCAN_KEY: "",
  ARBITRUM_KEY: "",
  POLYGON_KEY: "",
  ZK_POLYGON_KEY: "",
  AVALANCHE_KEY: "",
  OPTIMISM_KEY: "",
};

const config: HardhatUserConfig = {
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
    }
  },
  etherscan: {
    apiKey: {
      sepolia: "QEWTQ1JEKQFT7I5E66NVU74D49VUTZH7N4",
      avalancheFujiTestnet: "TDDWRZ349N42TWHNPVPPAFZVCF9D97CV7G",
      polygonMumbai: "WZWUQZR5FVKNQ3TAWVRP8IZQIREHY43XZY",
      optimism: "YOUR_OPTIMISM_API_KEY",
      arbitrum: "YOUR_ARBISCAN_API_KEY"
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
    console.error("A valid INFURA_KEY must be provided in config.js");
    process.exit(1);
  }

  return `https://${network}.infura.io/v3/${conf.INFURA_KEY}`
}

function hdWallet() {
  if (!conf.MNEMONIC) {
    console.error("A valid MNEMONIC must be provided in config.js");
    process.exit(1);
  } 

  return {
      mnemonic: conf.MNEMONIC,
      path: "m/44'/60'/0'/0",
      initialIndex: 0,
      count: 20,
      passphrase: "",
  }
}

export default config;
