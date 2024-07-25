import hre from "hardhat";
import ZrSignInitModule from "../ignition/modules/zr-sign-init";
import fs from "fs";

async function main() {
    const networkName = hre.network.name;
    const logFile = `deploy_${networkName}.txt`;

    // Function to log messages to a file
    function logToFile(message: string) {
        fs.appendFileSync(logFile, message + '\n', 'utf8');
    }

    logToFile(`Deploying on ${networkName} network...`);

    try {
        // Deploy the module
        const result = await hre.ignition.deploy(ZrSignInitModule);
        logToFile("Deployment successful.");

        // Fetch the deployed contract addresses
        const ZrSignTypes = result.ZrSignTypes;
        const ZrSignImpl = result.ZrSignImpl;
        const ZrSignProxy = result.ZrSignProxy;

        logToFile("Verifying contracts...");

        // Verify ZrSignTypes contract
        await hre.run("verify:verify", {
            address: await ZrSignTypes.getAddress(),
            constructorArguments: [],
        });
        logToFile("ZrSignTypes contract verified");

        // Verify ZrSignImpl contract
        await hre.run("verify:verify", {
            address: await ZrSignImpl.getAddress(),
            constructorArguments: [],
            libraries: {
                ZrSignTypes: await ZrSignTypes.getAddress(),
            },
        });
        logToFile("ZrSign implementation contract verified");

        // Verify ZrSignProxy contract
        const ZrSignContract = require("../artifacts/contracts/zr/ZrSign.sol/ZrSign.json");
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
        logToFile("ZrSign proxy contract verified");

    } catch (err) {
        logToFile(`Verification failed: ${err}`);
        console.error("Verification failed", err);
    }
}

main().catch((error) => {
    const networkName = hre.network.name;
    const logFile = `deploy_${networkName}.txt`;
    fs.appendFileSync(logFile, `Error: ${error.message}\n`, 'utf8');
    console.error(error);
    process.exitCode = 1;
});