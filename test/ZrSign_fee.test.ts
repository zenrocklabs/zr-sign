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
            let oldFee = await instance.ZrSignProxy.getMPCFee();
            let expectedFee = ethers.parseUnits("80", "gwei");

            // When
            let tx = await instance.ZrSignProxy.connect(feeAccount).updateMPCFee(expectedFee);
            let newFee = await instance.ZrSignProxy.getMPCFee();

            // Then
            expect(newFee).to.equal(expectedFee);
            await expect(tx)
                .to.emit(instance.ZrSignProxy, "MPCFeeUpdate")
                .withArgs(oldFee, expectedFee);
        });

        it("should setup response gas", async () => {
            // Given
            let oldRespGas = await instance.ZrSignProxy.getRespGas();
            let expectedRespGas = ethers.parseUnits("200000", "wei");

            // When
            let tx = await instance.ZrSignProxy.connect(feeAccount).updateRespGas(expectedRespGas);
            let newRespGas = await instance.ZrSignProxy.getRespGas();

            // Then
            expect(newRespGas).to.equal(expectedRespGas);
            await expect(tx)
                .to.emit(instance.ZrSignProxy, "RespGasUpdate")
                .withArgs(oldRespGas, expectedRespGas);
        });

        it("should setup response gas price buffer", async () => {
            // Given
            let oldRespGasPriceBuffer = await instance.ZrSignProxy.getRespGasPriceBuffer();
            let expectedRespGasPriceBuffer = 150;

            // When
            let tx = await instance.ZrSignProxy.connect(feeAccount).updateRespGasBuffer(expectedRespGasPriceBuffer);
            let newRespGasPriceBuffer = await instance.ZrSignProxy.getRespGasPriceBuffer();

            // Then
            expect(newRespGasPriceBuffer).to.equal(expectedRespGasPriceBuffer);
            await expect(tx)
                .to.emit(instance.ZrSignProxy, "RespGasPriceBufferUpdate")
                .withArgs(oldRespGasPriceBuffer, expectedRespGasPriceBuffer);
        });
    });

    describe("Negative scenarios", async () => { 
        it("should not setup base fee without role", async () => {
            // Given
            const regularAddress = accounts[1];
            let expectedFee = ethers.parseUnits("80", "gwei");

            // When
            await expect(instance.ZrSignProxy.connect(regularAddress).updateMPCFee(expectedFee))
                .to.be.revertedWithCustomError(instance.ZrSignProxy, "AccessControlUnauthorizedAccount")
                .withArgs(regularAddress.address, roles.FEE_ROLE);
        });

        it("should not setup response gas without role", async () => {
            // Given
            const regularAddress = accounts[1];
            let expectedRespGas = ethers.parseUnits("200000", "wei");

            // When
            await expect(instance.ZrSignProxy.connect(regularAddress).updateRespGas(expectedRespGas))
                .to.be.revertedWithCustomError(instance.ZrSignProxy, "AccessControlUnauthorizedAccount")
                .withArgs(regularAddress.address, roles.FEE_ROLE);
        });

        it("should not setup response gas price buffer without role", async () => {
            // Given
            const regularAddress = accounts[1];
            let expectedRespGasPriceBuffer = 150;

            // When
            await expect(instance.ZrSignProxy.connect(regularAddress).updateRespGasBuffer(expectedRespGasPriceBuffer))
                .to.be.revertedWithCustomError(instance.ZrSignProxy, "AccessControlUnauthorizedAccount")
                .withArgs(regularAddress.address, roles.FEE_ROLE);
        });
    });
});