import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ZrSignProxyFixture } from "./shared/fixtures";
import * as roles from "./shared/roles";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IgnitionModuleResultsTToEthersContracts } from "@nomicfoundation/hardhat-ignition-ethers/dist/src/ethers-ignition-helper";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/src/signers"
import { NamedArtifactContractDeploymentFuture, NamedArtifactContractAtFuture } from "@nomicfoundation/ignition-core";

describe("ZrSign Fees", function () {

    let instance: IgnitionModuleResultsTToEthersContracts<string, { 
        ZrSignImpl: NamedArtifactContractDeploymentFuture<"ZrSign">; 
        ZrProxy: NamedArtifactContractDeploymentFuture<"ZrProxy">; 
        ZrSignProxy: NamedArtifactContractAtFuture<"ZrSign">; 
    }>;

    let accounts: Array<HardhatEthersSigner> | any;
    let feeAccount: HardhatEthersSigner;

    this.beforeAll(async() => {
        accounts = await ethers.getSigners();
        feeAccount = accounts[8];
    });

    this.beforeEach(async() => {
        instance = await loadFixture(ZrSignProxyFixture);
        
        await instance.ZrSignProxy.grantRole(roles.FEE_ROLE, feeAccount.address);
    });

    describe("Positive scenarios", async () => {
        it("should setup base fee", async () => {
            // Given
            let oldFee = await instance.ZrSignProxy.getBaseFee();
            let expectedFee = ethers.parseUnits("80", "gwei");

            // When
            let tx = await instance.ZrSignProxy.connect(feeAccount).setupBaseFee(expectedFee);
            let newFee = await instance.ZrSignProxy.getBaseFee();

            // Then
            expect(newFee).to.equal(expectedFee);
            await expect(tx)
                .to.emit(instance.ZrSignProxy, "BaseFeeUpdate")
                .withArgs(oldFee, newFee);
        });
    });

    describe("Negative scenarios", async () => { 
        it("should not setup base fee without role", async () => {
            // Given
            const regularAddress = accounts[1];
            let expectedFee = ethers.parseUnits("80", "gwei");

            // When
            await expect(instance.ZrSignProxy.connect(regularAddress).setupBaseFee(expectedFee))
                .to.be.revertedWithCustomError(instance.ZrSignProxy, "AccessControlUnauthorizedAccount")
                .withArgs(regularAddress, roles.FEE_ROLE);
        });
    });
});