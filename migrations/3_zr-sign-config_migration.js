const ZrSign = artifacts.require("ZrSign");
const ZrProxy = artifacts.require("ZrProxy");
const fs = require("fs");
const path = require("path");

if (fs.existsSync(path.join(__dirname, "..", "config.js"))) {
    ({
        PROXY_ADMIN_ADDRESS: proxyAdminAddress,
    } = require("../config.js"));
}

module.exports = function (deployer, network, accounts) {
    deployer.then(async () => {
        console.log();
        console.log(`starting configuration for ${network} network`);
        console.log();

        if (deployer.network === "development") {
            proxyAdminAddress = accounts[1];
        }

        console.log(`Proxy Admin:     ${proxyAdminAddress}`);
        if (!proxyAdminAddress) {
            throw new Error("PROXY_ADMIN_ADDRESS must be provided in config.js");
        }

        if (proxyAdminAddress.toString().toLowerCase() === accounts[0].toString().toLowerCase()) {
            throw new Error("PROXY_ADMIN_ADDRESS must be different than deployer address. Please change PROXY_ADMIN_ADDRESS in config.js");
        }

        try {
            console.log();
            console.log("Configuring ZrSign proxy contract...");
            const ZrSignProxyInstance = await ZrProxy.deployed();
            const proxied = await ZrSign.at(ZrSignProxyInstance.address);

            console.log("Starting wallet type configuration for EVM...");
            let tx = await proxied.walletTypeIdConfig(44, 60, true);
            console.log("Wallet type configuration for EVM was successful ", tx.tx);

            console.log("Starting chain id configuration for Sepolia...");
            const evmWalletTypeId = "0xe146c2986893c43af5ff396310220be92058fb9f4ce76b929b80ef0d5307100a";
            tx = await proxied.chainIdConfig(evmWalletTypeId, "eip155:11155111", true);
            console.log("Chain id configuration for Sepolia was successful ", tx.tx);

            console.log("Starting chain id configuration for Amoy...");
            tx = await proxied.chainIdConfig(evmWalletTypeId, "eip155:80002", true);
            console.log("Chain id configuration for Amoy was successful ", tx.tx);

            const mpcAddress = "0x2bb9cB3c6a87e537Ba89b214004dC691d8a83eF1";
            console.log(`Assigning role to MPC wallet to ${mpcAddress} ...`);
            const mpcRole = await proxied.MPC_ROLE.call();
            tx = await proxied.grantRole(mpcRole, mpcAddress);
            console.log("Role was assigned successfully ", tx.tx);

            console.log(`Assigning role to TOKENOMICS wallet to ${accounts[3]} ...`);
            const tokenomicsAddress = accounts[3];
            const tokenomicsRole = await proxied.TOKENOMICS_ROLE.call();
            tx = await proxied.grantRole(tokenomicsRole, tokenomicsAddress);
            console.log("Role was assigned successfully ", tx.tx);

            console.log("Starting base fee setup to 21 000 wei ...");
            tx = await proxied.setupBaseFee(21000, {
                from: accounts[3],
            });
            console.log("Base fee setup transaction was successful ", tx.tx);

            console.log("Starting network fee setup to 4 wei ...");
            tx = await proxied.setupNetworkFee(4, {
                from: accounts[3],
            });
            console.log("Network fee setup transaction was successful ", tx.tx);
        } catch (error) {
            console.log(error);
        }
    });
};
