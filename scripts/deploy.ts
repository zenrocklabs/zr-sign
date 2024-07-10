import hre from "hardhat";
import ZrSignInitModule from "../ignition/modules/zr-sign-init";

async function main() {
    // Deploy the module
    const result = await hre.ignition.deploy(ZrSignInitModule);

    // Fetch the deployed contract addresses
    const ZrSignTypes = result.ZrSignTypes;
    const ZrSignImpl = result.ZrSignImpl;
    const ZrSignProxy = result.ZrSignProxy;
    console.log()
    console.log("Verifying contracts...");

    try {
        // Verify ZrSignTypes contract
        await hre.run("verify:verify", {
            address: await ZrSignTypes.getAddress(),
            constructorArguments: [],
        });
        console.log("ZrSignTypes contract verified");

        // Verify ZrSignImpl contract
        await hre.run("verify:verify", {
            address: await ZrSignImpl.getAddress(),
            constructorArguments: [],
            libraries: {
                ZrSignTypes: await ZrSignTypes.getAddress(),
            },
        });
        console.log("ZrSign implementation contract verified");

        // Verify ZrProxy contract
        const ZrSignContract = require("../artifacts/contracts//zr/ZrSign.sol/ZrSign.json");
        const ZrSignInterface = new hre.ethers.Interface(ZrSignContract.abi);
        const initData = ZrSignInterface.encodeFunctionData("initializeV1", []);

        const accounts = await hre.ethers.getSigners();
        const proxyAdminAddress = await accounts[1].getAddress();

        await hre.run("verify:verify", {
            address: await ZrSignProxy.getAddress(),
            constructorArguments: [
                await ZrSignImpl.getAddress(),
                proxyAdminAddress,
                initData,
            ],
        });
        console.log("ZrSign proxy contract verified");
    } catch (err) {
        console.error("Verification failed", err);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});