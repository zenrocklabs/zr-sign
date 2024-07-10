import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import ZrSignModule from "./zr-sign";

const evmWalletTypeId = "0xe146c2986893c43af5ff396310220be92058fb9f4ce76b929b80ef0d5307100a";
const chainIdSepolia = "eip155:11155111";
const chainIdAmoy = "eip155:80002";
const chainIdFuji = "eip155:43113";
const chainIdArbSepolia = "eip155:421614";
const chainIdBinanceTest = "eip155:97";
const chainIdBaseSepolia = "eip155:84532";
const chainIdOptimismSepolia = "eip155:11155420";

const mpcAddress = "0xF9F59E34fe863918be62EE585364Eb46ed7142DD";

export default buildModule("ZrSignInit", (m) => {
    const { ZrSignTypes, ZrSignImpl, ZrSignProxy } = m.useModule(ZrSignModule);

    const callWalletTypeIdConfig = m.call(ZrSignProxy, "walletTypeIdConfig", [44, 60, true]);

    // Chain setup
    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdSepolia, true], {
        id: "chainConfigSepolia",
        after: [callWalletTypeIdConfig],
    });
    
    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdAmoy, true], {
        id: "chainConfigAmoy",
        after: [callWalletTypeIdConfig],
    });

    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdFuji, true], {
        id: "chainConfigFuji",
        after: [callWalletTypeIdConfig],
    });

    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdArbSepolia, true], {
        id: "chainConfigArbSepolia",
        after: [callWalletTypeIdConfig],
    });

    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdBinanceTest, true], {
        id: "chainConfigBinanceTest",
        after: [callWalletTypeIdConfig],
    });
    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdBaseSepolia, true], {
        id: "chainConfigBaseSepolia",
        after: [callWalletTypeIdConfig],
    });
    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdOptimismSepolia, true], {
        id: "chainConfigOptimismSepolia",
        after: [callWalletTypeIdConfig],
    });

    // Role setup
    const mpcRole = m.staticCall(ZrSignProxy, "MPC_ROLE");
    m.call(ZrSignProxy, "grantRole", [mpcRole, mpcAddress]);
    console.log("MPC role granted.");

    const tokenomicsRole = m.staticCall(ZrSignProxy, "FEE_ROLE");
    const grantRoleTokenomics = m.call(ZrSignProxy, "grantRole", [tokenomicsRole, m.getAccount(3)], {
        id: "grantRole_tokenomics"
    });

    m.call(ZrSignProxy, "updateMPCFee", [500000000000000], {
        from: m.getAccount(3),
        after: [grantRoleTokenomics],
    });
    m.call(ZrSignProxy, "updateRespGas", [200000], {
        from: m.getAccount(3),
        after: [grantRoleTokenomics],
    });
    m.call(ZrSignProxy, "updateRespGasBuffer", [120], { //120 = 20%
        from: m.getAccount(3),
        after: [grantRoleTokenomics],
    });
    console.log("ZrSignInit module initialization completed.");

    return { ZrSignTypes: ZrSignTypes, ZrSignImpl: ZrSignImpl, ZrSignProxy: ZrSignProxy };
});