// import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
// import hre from "hardhat";

// export default buildModule("ZrSignUpgrade", (m) => {
//   console.log("Deploying ZrSignTypes library...");
//   const ZrSignTypes = m.library("ZrSignTypes");
//   console.log("ZrSignTypes library deployed successfully.");

//   console.log("Deploying ZrSign implementation contract...");
//   const ZrSignImpl = m.contract("ZrSign", [], {
//     libraries: {
//       ZrSignTypes: ZrSignTypes,
//     }
//   });
//   console.log("ZrSign implementation contract deployed successfully.");

//   console.log("Deploying ZrSignUpgrader implementation contract...");
//   const ZrSignUpgrader = m.contract("ZrSignUpgrader", [
//     "0xA7AdF06a1D3a2CA827D4EddA96a1520054713E1c",  // Proxy address
//     ZrSignImpl,
//     "0xBAd71b1C8A807Cf8f9EC050B18b69C3f34076f0b"  // New proxy admin address
//   ], {
//     after: [ZrSignImpl]
//   });

//   console.log("ZrSignUpgrader implementation contract deployed successfully.");

//   return { ZrSignTypes, ZrSignImpl, ZrSignUpgrader };
// });