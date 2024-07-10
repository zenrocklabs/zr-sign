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
    console.log("Starting ZrSignInit module initialization...");

    const { ZrSignTypes, ZrSignImpl, ZrSignProxy } = m.useModule(ZrSignModule);
    console.log("Retrieved ZrSign module components.");

    console.log("Configuring wallet type ID...");
    const callWalletTypeIdConfig = m.call(ZrSignProxy, "walletTypeIdConfig", [44, 60, true]);
    console.log("Wallet type ID configured.");

    // Chain setup
    console.log("Configuring chain IDs...");
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
    console.log("Chain IDs configured.");

    // Role setup
    console.log("Granting MPC role...");
    const mpcRole = m.staticCall(ZrSignProxy, "MPC_ROLE");
    m.call(ZrSignProxy, "grantRole", [mpcRole, mpcAddress]);
    console.log("MPC role granted.");

    console.log("Granting tokenomics role...");
    const tokenomicsRole = m.staticCall(ZrSignProxy, "FEE_ROLE");
    const grantRoleTokenomics = m.call(ZrSignProxy, "grantRole", [tokenomicsRole, m.getAccount(3)], {
        id: "grantRole_tokenomics"
    });

    console.log("Setting up base fee...");
    m.call(ZrSignProxy, "updateMPCFee", [500000000000000], {
        from: m.getAccount(3),
        after: [grantRoleTokenomics],
    });
    console.log("Base fee set up.");

    console.log("Setting up response gas...");
    m.call(ZrSignProxy, "updateRespGas", [200000], {
        from: m.getAccount(3),
        after: [grantRoleTokenomics],
    });
    console.log("Response gas set up.");

    console.log("Setting up response gas buffer...");
    m.call(ZrSignProxy, "updateRespGasBuffer", [120], { //120 = 20%
        from: m.getAccount(3),
        after: [grantRoleTokenomics],
    });
    console.log("Response gas buffer set up.");

    console.log("ZrSignInit module initialization completed.");

    return { ZrSignTypes: ZrSignTypes, ZrSignImpl: ZrSignImpl, ZrSignProxy: ZrSignProxy };
});