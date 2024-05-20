const SignTypes = artifacts.require("SignTypes");
const ZrSignTypes = artifacts.require("ZrSignTypes");
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
    console.log(`starting migration for ${network} network`);
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
      console.log("Deploying SignTypes library contract...");
      const SignTypesInstance = await deployer.deploy(SignTypes);
      console.log("Deployed SignTypes library contract at", SignTypesInstance.address);

      console.log("Linking SignTypes library contract...");
      deployer.link(SignTypes, [ZrSign]);

      console.log("Deploying ZrSignTypes library contract...");
      const ZrSignTypesInstance = await deployer.deploy(ZrSignTypes);
      console.log("Deployed ZrSignTypes library contract at", ZrSignTypesInstance.address);

      console.log("Linking ZrSignTypes library contract...");
      deployer.link(ZrSignTypes, [ZrSign]);

      console.log("Deploying ZrSign implementation contract...");
      const ZrSignInstance = await deployer.deploy(ZrSign);
      console.log("Deployed ZrSign implementation contract at", ZrSignInstance.address);

      console.log();
      console.log("Preparing proxy initialization data...");
      const ZrSignContract = new web3.eth.Contract(ZrSignInstance.abi);
      const data = ZrSignContract.methods.initializeV1().encodeABI();
      console.log("Prepared initialization data: ", data);

      console.log();
      console.log("Deploying ZrSign proxy contract...");
      const ZrSignProxyInstance = await deployer.deploy(ZrProxy, ZrSignInstance.address, proxyAdminAddress, data);
      console.log("Deployed ZrSign proxy contract at", ZrSignProxyInstance.address);
    } catch (error) {
      console.log(error);
    }
  });
};
