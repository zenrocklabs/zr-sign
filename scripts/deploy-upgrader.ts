// import hre from "hardhat";
// import ZrSignUpgrade from "../ignition/modules/zr-sign-upgrade";
// import fs from "fs";

// async function main() {
//     const networkName = hre.network.name;
//     const logFile = `deploy_upgrader_${networkName}.txt`;

//     // Function to log messages to a file
//     function logToFile(message: string) {
//         fs.appendFileSync(logFile, message + '\n', 'utf8');
//     }

//     logToFile(`Deploying on ${networkName} network...`);

//     try {
//         // Deploy the module
//         const result = await hre.ignition.deploy(ZrSignUpgrade);
//         logToFile("Deployment successful.");

//         // Fetch the deployed contract addresses
//         const ZrSignTypes = result.ZrSignTypes;
//         const ZrSignImpl = result.ZrSignImpl;
//         const ZrSignUpgrader = result.ZrSignUpgrader;

//         logToFile("Verifying contracts...");

//         // Verify ZrSignTypes contract
//         await hre.run("verify:verify", {
//             address: await ZrSignTypes.getAddress(),
//             constructorArguments: [],
//         });
//         logToFile("ZrSignTypes contract verified");

//         // Verify ZrSignImpl contract
//         await hre.run("verify:verify", {
//             address: await ZrSignImpl.getAddress(),
//             constructorArguments: [],
//             libraries: {
//                 ZrSignTypes: await ZrSignTypes.getAddress(),
//             },
//         });
//         logToFile("ZrSign implementation contract verified");

//         // Verify ZrSignProxy contract
//         await hre.run("verify:verify", {
//             address: await ZrSignUpgrader.getAddress(),
//             constructorArguments: [
//                 "0xA7AdF06a1D3a2CA827D4EddA96a1520054713E1c",
//                 await ZrSignImpl.getAddress(),
//                 "0xBAd71b1C8A807Cf8f9EC050B18b69C3f34076f0b",
//             ],
//         });
//         logToFile("ZrSign proxy contract verified");

//     } catch (err) {
//         logToFile(`Verification failed: ${err}`);
//         console.error("Verification failed", err);
//     }
// }

// main().catch((error) => {
//     const networkName = hre.network.name;
//     const logFile = `deploy_${networkName}.txt`;
//     fs.appendFileSync(logFile, `Error: ${error.message}\n`, 'utf8');
//     console.error(error);
//     process.exitCode = 1;
// });