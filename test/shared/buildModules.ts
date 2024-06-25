import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";

const ZrSignContract = require("../../artifacts/contracts/zr/ZrSign.sol/ZrSign.json");
const ZrSignInterface = new ethers.Interface(ZrSignContract.abi);

const ZrSignProxyModule = buildModule("ZrSignProxy", (m) => {
    const proxyAdmin = m.getAccount(9);

    const zrSignTypes = m.library("ZrSignTypes");

    const ZrSignImpl = m.contract("ZrSign", [], {
        libraries: {
            ZrSignTypes: zrSignTypes,
        }
    });

    const initData = ZrSignInterface.encodeFunctionData("initializeV1",[]);
    
    const ZrProxy = m.contract("ZrProxy", [
        ZrSignImpl,
        proxyAdmin,
        initData
    ], {});

    const ZrSignProxy = m.contractAt("ZrSign", ZrProxy, {id: "ZrSignProxied"});


    return { ZrSignImpl, ZrProxy, ZrSignProxy };
});

export {
    ZrSignProxyModule
}