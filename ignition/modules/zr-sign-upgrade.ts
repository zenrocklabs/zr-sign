import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import hre from "hardhat";

export default buildModule("ZrSignUpgrade", (m) => {
  console.log("Deploying ZrSignTypes library...");
  const ZrSignTypes = m.library("ZrSignTypes");
  console.log("ZrSignTypes library deployed successfully.");

  console.log("Deploying ZrSign implementation contract...");
  const ZrSignImpl = m.contract("ZrSign", [], {
    libraries: {
      ZrSignTypes: ZrSignTypes,
    }
  });
  console.log("ZrSign implementation contract deployed successfully.");

  console.log("Deploying ZrSignUpgrader implementation contract...");
  const ZrSignUpgrader = m.contract("ZrSignUpgrader", [
    "0x821980CB2Ee9Fb4FdF72FBc0bF5E4a728976D515",  // Proxy address
    ZrSignImpl,
    "0x38322F1b884FF097E953f2eE68d2059416D7Caf2"  // New proxy admin address
  ], {
    libraries: {
      ZrSignTypes: ZrSignTypes,
    }
  });
  console.log("ZrSignUpgrader implementation contract deployed successfully.");

  return { ZrSignTypes, ZrSignImpl, ZrSignUpgrader };
});