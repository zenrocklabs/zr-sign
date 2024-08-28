import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import ZrSignModule from "./zr-sign";

const btcWalletTypeId = "0xe03615811ae25b894de73e643038c13c37f602dc1e17ff1a02e5854893f3bd5e";
const btcTestnetChainId = 'bip122:000000000933ea01ad0ee984209779ba';

const evmWalletTypeId = "0xe146c2986893c43af5ff396310220be92058fb9f4ce76b929b80ef0d5307100a";
const chainIdSepolia = "eip155:11155111";
const chainIdAmoy = "eip155:80002";
const chainIdFuji = "eip155:43113";
const chainIdArbSepolia = "eip155:421614";
const chainIdBinanceTest = "eip155:97";
const chainIdBaseSepolia = "eip155:84532";
const chainIdOptimismSepolia = "eip155:11155420";

const mpcAddress = "0xC8bf26D92A218d47cC8e4d0D69759310c20605D3";

export default buildModule("ZrSignInit", (m) => {
    const { ZrSignTypes, ZrSignImpl, ZrSignProxy } = m.useModule(ZrSignModule);

    const callEVMWalletTypeIdConfig = m.call(ZrSignProxy, "walletTypeIdConfig", [44, 60, true]);

    // Chain setup
    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdSepolia, true], {
        id: "chainConfigSepolia",
        after: [callEVMWalletTypeIdConfig],
    });
    
    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdAmoy, true], {
        id: "chainConfigAmoy",
        after: [callEVMWalletTypeIdConfig],
    });

    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdFuji, true], {
        id: "chainConfigFuji",
        after: [callEVMWalletTypeIdConfig],
    });

    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdArbSepolia, true], {
        id: "chainConfigArbSepolia",
        after: [callEVMWalletTypeIdConfig],
    });

    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdBinanceTest, true], {
        id: "chainConfigBinanceTest",
        after: [callEVMWalletTypeIdConfig],
    });
    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdBaseSepolia, true], {
        id: "chainConfigBaseSepolia",
        after: [callEVMWalletTypeIdConfig],
    });
    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdOptimismSepolia, true], {
        id: "chainConfigOptimismSepolia",
        after: [callEVMWalletTypeIdConfig],
    });

    const callBTCWalletTypeIdConfig = m.call(ZrSignProxy, "walletTypeIdConfig", [44, 1, true], {
        id: "walletTypeIdConfigBTC",  // Unique ID assigned here
    });
    
    m.call(ZrSignProxy, "chainIdConfig", [btcWalletTypeId, btcTestnetChainId, true], {
        id: "chainConfigBtcTestnet",  // Make sure this ID is also unique
        after: [callBTCWalletTypeIdConfig],
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