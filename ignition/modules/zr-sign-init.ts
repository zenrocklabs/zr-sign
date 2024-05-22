import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import ZrSignModule from "./zr-sign"

const evmWalletTypeId = "0xe146c2986893c43af5ff396310220be92058fb9f4ce76b929b80ef0d5307100a"; 
const chainIdSepolia = "eip155:11155111";
const chainIdAmoy = "eip155:80002";

const mpcAddress = "0x2bb9cB3c6a87e537Ba89b214004dC691d8a83eF1";

export default buildModule("ZrSignInit", (m) => {
    const { ZrSignImpl, ZrSignProxy } = m.useModule(ZrSignModule);

    const callWalletTypeIdConfig = m.call(ZrSignProxy, "walletTypeIdConfig", [44, 60, true]);

    // ~ Chain setup ~
    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdSepolia, true], {
        id: "chainConfigSepolia",
        after: [callWalletTypeIdConfig],
    });
    
    m.call(ZrSignProxy, "chainIdConfig", [evmWalletTypeId, chainIdAmoy, true], {
        id: "chainConfigAmoy",
        after: [callWalletTypeIdConfig],
    });

    // ~ Role setup ~
    const mpcRole = m.staticCall(ZrSignProxy, "MPC_ROLE");
    m.call(ZrSignProxy, "grantRole",[mpcRole, mpcAddress])

    const tokenomicsRole = m.staticCall(ZrSignProxy, "TOKENOMICS_ROLE");
    const grantRoleTokenomics = m.call(ZrSignProxy, "grantRole",[tokenomicsRole, m.getAccount(3)], {
        id: "grantRole_tokenomics"
    });

    m.call(ZrSignProxy, "setupBaseFee", [21000], {
        from: m.getAccount(3),
        after: [grantRoleTokenomics],
    });

    m.call(ZrSignProxy, "setupNetworkFee", [4], {
        from: m.getAccount(3),
        after: [grantRoleTokenomics],
    });

    return { ZrSignImpl: ZrSignImpl, ZrSignProxy: ZrSignProxy }
});