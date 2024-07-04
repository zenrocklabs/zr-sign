import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import hre from "hardhat";

const ZrSignContract = require("../../artifacts/contracts/zr/ZrSign.sol/ZrSign.json");
const ZrSignInterface = new hre.ethers.Interface(ZrSignContract.abi);

export default buildModule("ZrSign", (m) => {
    console.log("Starting ZrSign module deployment...");

    // TODO: Use [1] only on dev networks
    let proxyAdminAddress = m.getAccount(1);
    console.log("Retrieved proxy admin address:", proxyAdminAddress);

    if (proxyAdminAddress === m.getAccount(0)) {
        throw Error("proxy admin should not be contract deployer");
    }

    // Deploy libraries
    console.log("Deploying ZrSignTypes library...");
    const zrSignTypes = m.library("ZrSignTypes");
    console.log("ZrSignTypes library deployed successfully.");

    // Deploy implementation
    console.log("Deploying ZrSign implementation contract...");
    const ZrSignImpl = m.contract("ZrSign", [], {
        libraries: {
            ZrSignTypes: zrSignTypes,
        }
    });
    console.log("ZrSign implementation contract deployed successfully.");

    // Prepare Proxy
    console.log("Encoding initialization data for ZrSign...");
    const initData = ZrSignInterface.encodeFunctionData("initializeV1", []);

    // Deploy Proxy
    console.log("Deploying ZrSign proxy contract...");
    const ZrProxy = m.contract("ZrProxy", [
        ZrSignImpl,
        proxyAdminAddress,
        initData
    ], {});
    console.log("ZrSign proxy contract deployed successfully.");

    // Deploy proxy instance
    console.log("Creating instance of ZrSignProxy...");
    const ZrSignProxy = m.contractAt("ZrSign", ZrProxy, { id: "ZrSignProxied" });
    console.log("ZrSignProxy instance created successfully.");

    console.log("ZrSign module deployment completed.");

    // Return relevant objects
    return { ZrSignTypes: zrSignTypes, ZrSignImpl: ZrSignImpl, ZrSignProxy: ZrSignProxy };
});