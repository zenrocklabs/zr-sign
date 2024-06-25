import hre from "hardhat";
import ZrSignInitModule from "../ignition/modules/zr-sign-init";

async function main() {
    await hre.ignition.deploy(ZrSignInitModule);
}

main().catch(console.error);