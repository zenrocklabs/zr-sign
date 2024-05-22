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
    // CONFIG ----

    // // Configure wallet types
    // const callWalletTypeIdConfig = m.call(ZrSignProxy, "walletTypeIdConfig", [44, 60, true]);

    // // chain config: Sepolia
    // const callChainConfigSepolia = m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdSepolia, true], {
    //     id: "chainConfigSepolia",
    //     after: [callWalletTypeIdConfig],
    // });
    
    // // chain config: Amoy
    // const callChainConfigAmoy = m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdAmoy, true], {
    //     id: "chainConfigAmoy",
    //     after: [callChainConfigSepolia]
    // });

    return { ZrSignImpl: ZrSignImpl, ZrSignProxy: ZrSignProxy }
}); 