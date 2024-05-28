import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ZrSignProxyFixture } from "./shared/fixtures";

const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"

describe("ZrSign Proxy", function () {

    it("should have correct proxy admin", async function () { 
        const signers = await ethers.getSigners();
        const { ZrSignProxy } = await loadFixture(ZrSignProxyFixture);

        const admin = await ethers.provider.getStorage(ZrSignProxy, ADMIN_SLOT);
        
        expect(ethers.getAddress(admin.slice(26))).to.equal(signers[9].address);
    });
});