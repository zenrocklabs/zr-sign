import { ignition } from "hardhat";
import { ZrSignProxyModule } from "./buildModules";

export async function ZrSignProxyFixture() {
    return ignition.deploy(ZrSignProxyModule);
}