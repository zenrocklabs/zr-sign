const SignTypes = artifacts.require("SignTypes");
const ZrSignTypes = artifacts.require("ZrSignTypes");
const ZrSign = artifacts.require("ZrSign");
const ZrProxy = artifacts.require("ZrProxy");
const fs = require("fs");
const path = require("path");
const helpers = require("../test/helpers");

if (fs.existsSync(path.join(__dirname, "..", "config.js"))) {
  ({
    PROXY_ADMIN_ADDRESS: proxyAdminAddress,
    // Q_SIGN_TYPES: zrSignTypesLibAddress,
  } = require("../config.js"));
}

module.exports = function (deployer, network, accounts) {
  deployer.then(async () => {
    console.log();

    console.log(`starting migration for ${network} network`);

    console.log();

    if (deployer.network === "development") {
      proxyAdminAddress = accounts[1];
    }

    console.log(`Proxy Admin:     ${proxyAdminAddress}`);
    if (!proxyAdminAddress) {
      throw new Error("PROXY_ADMIN_ADDRESS  must be provided in config.js");
    }

    if (
      proxyAdminAddress.toString().toLowerCase() ===
      accounts[0].toString().toLowerCase()
    ) {
      throw new Error(
        "PROXY_ADMIN_ADDRESS  must be different than deployer address please change PROXY_ADMIN_ADDRESS in config.js"
      );
    }

    console.log();
    console.log("Deploying SignTypes library contract...");
    let SignTypesInstance = await deployer.deploy(SignTypes);
    console.log(
      "Deployed SignTypes library contract at",
      SignTypesInstance.address
    );

    console.log("link sign-types library contract...");
    deployer.link(SignTypes, [ZrSign]);

    console.log("Deploying ZrSignTypes library contract...");
    let ZrSignTypesInstance = await deployer.deploy(ZrSignTypes);
    console.log(
      "Deployed ZrSignTypes library contract at",
      ZrSignTypesInstance.address
    );

    console.log("link zr-sign-types library contract...");
    deployer.link(ZrSignTypes, [ZrSign]);

    console.log("Deploying zr-sign implementation contract...");
    let ZrSignInstance = await deployer.deploy(ZrSign);
    console.log(
      "Deployed zr-sign implementation contract at",
      ZrSignInstance.address
    );

    console.log();

    console.log("Preparing proxy initialization data... ");
    const ZrSignContract = new web3.eth.Contract(ZrSignInstance.abi);

    const data = ZrSignContract.methods.initializeV1().encodeABI();
    console.log("Prepared initialization data: ", data);

    console.log();

    console.log("Deploying  zr-sign proxy contract...");
    let ZrSignProxyInstance = await deployer.deploy(
      ZrProxy,
      ZrSignInstance.address,
      proxyAdminAddress,
      data
    );
    console.log(
      "Deployed zr-sign proxy contract at",
      ZrSignProxyInstance.address
    );

    console.log();
    console.log("Starting configuration ...");
    let proxied = await ZrSign.at(ZrSignProxyInstance.address);

    console.log("Starting wallet type configuration for EVM...");
    let tx = await proxied.walletTypeIdConfig(44, 60, true);
    console.log("Wallet type configuration for EVM was successful ", tx.tx);

    console.log("Starting chain id configuration for Sepolia...");
    const evmWalletTypeId =
      "0xe146c2986893c43af5ff396310220be92058fb9f4ce76b929b80ef0d5307100a";
    tx = await proxied.chainIdConfig(evmWalletTypeId, "eip155:11155111", true);
    console.log("Chain id configuration for Sepolia was successful ", tx.tx);

    console.log("Starting chain id configuration for Mumbai...");
    tx = await proxied.chainIdConfig(evmWalletTypeId, "eip155:80001", true);
    console.log("Chain id configuration for Mumbai was successful ", tx.tx);

    console.log(
      `Asigning role to MPC wallet to ${accounts[8]} ...`
    );
    const mpcAddress = accounts[8];
    const mpcRole = await proxied.MPC_ROLE.call();
    tx = await proxied.grantRole(mpcRole, mpcAddress);
    console.log("Role was assigned successfully ", tx.tx);

    console.log(
      `Asigning role to TOKENOMICS wallet to ${accounts[7]} ...`
    );
    const tokenomicsAddress = accounts[7];
    const tokenomicsRole = await proxied.TOKENOMICS_ROLE.call();
    tx = await proxied.grantRole(tokenomicsRole, tokenomicsAddress);
    console.log("Role was assigned successfully ", tx.tx);

    console.log("Starting base fee setup to 21 000 wei ...");
    tx = await proxied.setupBaseFee(21000, { from: tokenomicsAddress });
    console.log("Base fee setup transaction was successful ", tx.tx);
    
    console.log("Starting network fee setup to 4 wei ...");
    tx = await proxied.setupNetworkFee(4, { from: tokenomicsAddress });
    console.log("Network fee setup transaction was successful ", tx.tx);
  });
};
