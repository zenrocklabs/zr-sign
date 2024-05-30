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
    let tokenomicsAcc: HardhatEthersSigner;

    this.beforeAll(async() => {
        accounts = await ethers.getSigners();
        tokenomicsAcc = accounts[8];
    });

    this.beforeEach(async() => {
        instance = await loadFixture(ZrSignProxyFixture);
        
        await instance.ZrSignProxy.grantRole(roles.TOKENOMICS_ROLE, tokenomicsAcc.address);
    });

    describe("Positive scenarios", async () => {
        it("should setup base fee", async () => {
            // Given
            let oldFee = await instance.ZrSignProxy.getBaseFee();
            let expectedFee = ethers.parseUnits("80", "gwei");

            // When
            let tx = await instance.ZrSignProxy.connect(tokenomicsAcc).setupBaseFee(expectedFee);
            let newFee = await instance.ZrSignProxy.getBaseFee();

            // Then
            expect(newFee).to.equal(expectedFee);
            await expect(tx)
                .to.emit(instance.ZrSignProxy, "BaseFeeUpdate")
                .withArgs(oldFee, newFee);
        });

        it("should setup network fee", async () => { 
            // Given
            let oldFee = await instance.ZrSignProxy.getNetworkFee();
            let expectedFee = ethers.parseUnits("4", "wei");

            // When
            let tx = await instance.ZrSignProxy.connect(tokenomicsAcc).setupNetworkFee(expectedFee);
            let newBaseFee = await instance.ZrSignProxy.getNetworkFee();

            // Then
            expect(newBaseFee).to.equal(expectedFee);
            await expect(tx)
                .to.emit(instance.ZrSignProxy, "NetworkFeeUpdate")
                .withArgs(oldFee, newBaseFee);
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
                .withArgs(regularAddress, roles.TOKENOMICS_ROLE);
        });

        it("should not setup network fee without role", async () => {
            // Given
            const regularAddress = accounts[1];
            let expectedFee = ethers.parseUnits("80", "gwei");

            // When
            await expect(instance.ZrSignProxy.connect(regularAddress).setupNetworkFee(expectedFee))
                .to.be.revertedWithCustomError(instance.ZrSignProxy, "AccessControlUnauthorizedAccount")
                .withArgs(regularAddress, roles.TOKENOMICS_ROLE);
        });
    });
});