import { IgnitionModuleResultsTToEthersContracts } from "@nomicfoundation/hardhat-ignition-ethers/dist/src/ethers-ignition-helper";
import { NamedArtifactContractDeploymentFuture, NamedArtifactContractAtFuture } from "@nomicfoundation/ignition-core";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/src/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ZrSignProxyFixture } from "./shared/fixtures";
import { ethers } from "hardhat";
import hre from "hardhat";
import { expect } from "chai";
import * as roles from "./shared/roles";
import * as helpers from "./shared/walletTypes";

let instance: IgnitionModuleResultsTToEthersContracts<string, {
    ZrSignImpl: NamedArtifactContractDeploymentFuture<"ZrSign">;
    ZrProxy: NamedArtifactContractDeploymentFuture<"ZrProxy">;
    ZrSignProxy: NamedArtifactContractAtFuture<"ZrSign">;
}>;

describe("ZrSign key request", function () {
    const supportedWalletType = helpers.EVM_CHAIN_TYPE_HASH;
    const mpcFee = ethers.parseUnits("1000000000000000", "wei");
    const respGas = ethers.parseUnits("2000000", "wei");
    const gasBuff = BigInt(120);
    const gasTotalFee = ethers.parseUnits("100000000000000000", "wei");
    const defaultOptions = BigInt(1);
    let accounts: Array<HardhatEthersSigner> | any;
    let regularAddress: HardhatEthersSigner;
    let feeAddress: HardhatEthersSigner;

    this.beforeAll(async () => {
        accounts = await ethers.getSigners();
        regularAddress = accounts[1];
        feeAddress = accounts[8];
    });

    this.beforeEach(async () => {
        const wt = helpers.EVM_CHAIN_TYPE;
        instance = await loadFixture(ZrSignProxyFixture);

        await instance.ZrSignProxy.grantRole(roles.FEE_ROLE, feeAddress.address);
        await instance.ZrSignProxy.connect(feeAddress).updateMPCFee(mpcFee);
        await instance.ZrSignProxy.connect(feeAddress).updateRespGas(respGas);
        await instance.ZrSignProxy.connect(feeAddress).updateRespGasBuffer(gasBuff);
        await instance.ZrSignProxy.walletTypeIdConfig(
            wt.purpose, wt.coinType, true
        );
    });

    it("should request public key", async () => {
        const wallets = await instance.ZrSignProxy.getZrKeys(
            supportedWalletType,
            regularAddress.address
        );

        await expect(instance.ZrSignProxy.connect(regularAddress).zrKeyReq(
            { owner: regularAddress.address, walletTypeId: supportedWalletType, options: defaultOptions },
            { value: gasTotalFee }
        )).to.emit(instance.ZrSignProxy, "ZrKeyRequest").withArgs(
            supportedWalletType,
            regularAddress.address,
            wallets.length,
            1,
            gasTotalFee
        );
    });

    let negativeTests = [
        {
            testName: "be able to request for unsupported wallet type",
            fee: ethers.parseUnits("80", "gwei"),
            walletTypeId: helpers.UNSUPPORTED_CHAIN_TYPE_HASH,
            customError: {
                name: "WalletTypeNotSupported",
                params: [helpers.UNSUPPORTED_CHAIN_TYPE_HASH],
            }
        },
        {
            testName: "be able to request with less fee",
            fee: ethers.parseUnits("30", "gwei"),
            walletTypeId: helpers.EVM_CHAIN_TYPE_HASH,
            customError: {
                name: "InsufficientFee",
                params: [ethers.toBigInt("1752547048000000"), ethers.parseUnits("30", "gwei")],
            }
        },
    ];

    for (let c of negativeTests) {
        it(`should not ${c.testName}`, async () => {
            if (c.customError.name === "InsufficientFee") {
                await expect(instance.ZrSignProxy.connect(regularAddress).zrKeyReq(
                    { owner: regularAddress.address, walletTypeId: c.walletTypeId, options: defaultOptions },
                    { value: c.fee }
                )).to.be.revertedWithCustomError(instance.ZrSignProxy, c.customError.name)
            } else {
                await expect(instance.ZrSignProxy.connect(regularAddress).zrKeyReq(
                    { owner: regularAddress.address, walletTypeId: c.walletTypeId, options: defaultOptions },
                    { value: c.fee }
                )).to.be.revertedWithCustomError(instance.ZrSignProxy, c.customError.name)
                    .withArgs(...c.customError.params);

            }
        });
    };

});