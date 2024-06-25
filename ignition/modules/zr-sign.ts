import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import hre from "hardhat";

const ZrSignContract = require("../../artifacts/contracts//zr/ZrSign.sol/ZrSign.json");
const ZrSignInterface = new hre.ethers.Interface(ZrSignContract.abi);

export default buildModule("ZrSign", (m) => {
    // TODO: Use [1] only on dev networks
    let proxyAdminAddress = m.getAccount(1);

    if (proxyAdminAddress === m.getAccount(0)) {
        throw Error("proxy admin should not be contract deployer");
    }

    // Deploy libraries
    const zrSignTypes = m.library("ZrSignTypes");

    const ZrSignImpl = m.contract("ZrSign", [], {
        libraries: {
            ZrSignTypes: zrSignTypes,
        }
    })
    
    // Prepare Proxy
    const initData = ZrSignInterface.encodeFunctionData("initializeV1",[]);

    // Deploy implementation
    const ZrProxy = m.contract("ZrProxy", [
        ZrSignImpl,
        proxyAdminAddress,
        initData
    ], {});

    // Deploy proxy
    const ZrSignProxy = m.contractAt("ZrSign", ZrProxy, {id: "ZrSignProxied"});

    return { ZrSignImpl: ZrSignImpl, ZrSignProxy: ZrSignProxy }
}); 