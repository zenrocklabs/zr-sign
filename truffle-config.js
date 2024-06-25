const HDWalletProvider = require("@truffle/hdwallet-provider");
const fs = require("fs");
const path = require("path");

// Read config file if it exists
let config = {
  MNEMONIC: "",
  INFURA_KEY: "",
  QUICKNODE_ZK_POLYGON_KEY: "",
  ETHERSCAN_KEY: "",
  ARBITRUM_KEY: "",
  POLYGON_KEY: "",
  ZK_POLYGON_KEY: "",
  AVALANCHE_KEY: "",
  OPTIMISM_KEY: "",
};
if (fs.existsSync(path.join(__dirname, "config.js"))) {
  config = require("./config.js");
}

module.exports = {
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        // viaIR: true
      },
    },
  },
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // Match any network id
    },
    mainnet: {
      provider: infuraProvider("mainnet"),
      network_id: 1,
      gas: 5000000, // Ropsten has a lower block limit than mainnet
      gasPrice: 30000000000, // 50 gwei (in wei) (default: 100 gwei)
      networkCheckTimeout: 120000,
      skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
    },
    goerli: {
      provider: infuraProvider("goerli"),
      network_id: 5,
      gas: 5000000, // Ropsten has a lower block limit than mainnet
      // gasPrice: 80000000000, // 50 gwei (in wei) (default: 100 gwei)
      networkCheckTimeout: 120000,
      skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
    },
    sepolia: {
      provider: infuraProvider("sepolia"),
      network_id: 11155111,
      gas: 5000000,
      gasPrice: 80000000000, // 50 gwei (in wei) (default: 100 gwei)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      networkCheckTimeout: 1000000, // Increase timeout to 1000 seconds (or as needed)
      skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
    },
    fuji: {
      provider: infuraProvider("avalanche-fuji"),
      network_id: 43113,
      gas: 5000000,
      // gasPrice: 80000000000, // 50 gwei (in wei) (default: 100 gwei)
      networkCheckTimeout: 120000,
      skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
    },
    polygon_amoy: {
      provider: infuraProvider("polygon-amoy"),
      network_id: 80002,
      gas: 5000000,
      gasPrice: 80000000000, // 50 gwei (in wei) (default: 100 gwei)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      networkCheckTimeout: 1000000, // Increase timeout to 1000 seconds (or as needed)
      skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
      verify: {
        apiUrl: 'https://api-amoy.polygonscan.com/api',
        apiKey: "VAGSVX86YDSKD6NSK2X5MYUXG7PYHNNT28",
        explorerUrl: 'https://amoy.polygonscan.com/address',
      },
    },
    blast_sepolia: {
      provider: infuraProvider("blast-sepolia"),
      network_id: "*",
      gas: 5000000,
      gasPrice: 80000000000, // 50 gwei (in wei) (default: 100 gwei)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      networkCheckTimeout: 1000000, // Increase timeout to 1000 seconds (or as needed)
      skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
      verify: {
        apiUrl: 'https://api-sepolia.blastscan.io/api',
        apiKey: "BZ7A3UUJ36X7IY9M35D2SXVNDI7ZTYIFSA",
        explorerUrl: 'https://sepolia.blastscan.io/address',
      },
    },
    scroll: {
      provider: quickNodeProvider("scroll"),
      network_id: "*",
      gas: 5000000,
      gasPrice: 80000000000, // 50 gwei (in wei) (default: 100 gwei)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      networkCheckTimeout: 1000000, // Increase timeout to 1000 seconds (or as needed)
      skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
      verify: {
        apiUrl: 'https://api-sepolia.scrollscan.com/api',
        apiKey: "A83PABHVYZDTVWNTNYF5ZGRPB8ZZ2NARZ3",
        explorerUrl: 'https://sepolia.scrollscan.com/address',
      },
    },
    sepolia_zksync: {
      provider: quickNodeProvider("sepolia_zksync"),
      network_id: "*",
      gas: 5000000,
      gasPrice: 80000000000, // 50 gwei (in wei) (default: 100 gwei)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      networkCheckTimeout: 1000000, // Increase timeout to 1000 seconds (or as needed)
      skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
      // verify: {
      //   apiUrl: 'https://api-sepolia.scrollscan.com/api',
      //   apiKey: "A83PABHVYZDTVWNTNYF5ZGRPB8ZZ2NARZ3",
      //   explorerUrl: 'https://sepolia.scrollscan.com/address',
      // },
    },
    // polygonZkEvm: {
    //   provider: new HDWalletProvider(
    //     config.MNEMONIC,
    //     config.QUICKNODE_ZK_POLYGON_KEY
    //   ),
    //   network_id: "*",
    //   gas: 5000000,
    //   // gasPrice: 80000000000, // 50 gwei (in wei) (default: 100 gwei)
    //   networkCheckTimeout: 120000,
    //   skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
    //   verify: {
    //     apiUrl: 'https://api-testnet-zkevm.polygonscan.com/api',
    //     apiKey: config.ZK_POLYGON_KEY,
    //     explorerUrl: 'https://testnet-zkevm.polygonscan.com/address',
    //   },
    // },
    arbitrum_goerli: {
      provider: infuraProvider("arbitrum-goerli"),
      network_id: 421613,
      gas: 5000000,
      // gasPrice: 80000000000, // 50 gwei (in wei) (default: 100 gwei)
      networkCheckTimeout: 120000,
      skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
    },
    optimism_goerli: {
      provider: infuraProvider("optimism-goerli"),
      network_id: 420,
      gas: 5000000,
      // gasPrice: 80000000000, // 50 gwei (in wei) (default: 100 gwei)
      networkCheckTimeout: 120000,
      skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
    },
  },
  // mocha: {
  //   timeout: 60000, // prevents tests from failing when pc is under heavy load
  //   reporter: "eth-gas-reporter",
  //   reporterOptions: {
  //     currency: "USD",
  //   },
  // },
  plugins: ["solidity-coverage", "truffle-plugin-verify"],
  api_keys: {
    etherscan: config.ETHERSCAN_KEY,
    optimistic_etherscan: config.OPTIMISM_KEY,
    polygonscan: config.POLYGON_KEY,
    zkevm_polygonscan: config.ZK_POLYGON_KEY,
    arbiscan: config.ARBITRUM_KEY,
    snowtrace: config.AVALANCHE_KEY,
  },
};

function quickNodeProvider(network) {
  return () => {
    if (!config.MNEMONIC) {
      console.error("A valid MNEMONIC must be provided in config.js");
      process.exit(1);
    }
    if (!config.INFURA_KEY) {
      console.error("A valid INFURA_KEY must be provided in config.js");
      process.exit(1);
    }
    return new HDWalletProvider(
      config.MNEMONIC,
      `https://methodical-morning-film.scroll-testnet.quiknode.pro/f4b980e2ee4a99adff547114a46d277751601b4c/`,
    );
  };
}

function infuraProvider(network) {
  return () => {
    if (!config.MNEMONIC) {
      console.error("A valid MNEMONIC must be provided in config.js");
      process.exit(1);
    }
    if (!config.INFURA_KEY) {
      console.error("A valid INFURA_KEY must be provided in config.js");
      process.exit(1);
    }
    return new HDWalletProvider(
      config.MNEMONIC,
      `https://${network}.infura.io/v3/${config.INFURA_KEY}`,
    );
  };
}
