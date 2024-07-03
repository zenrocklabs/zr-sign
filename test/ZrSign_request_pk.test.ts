import { IgnitionModuleResultsTToEthersContracts } from "@nomicfoundation/hardhat-ignition-ethers/dist/src/ethers-ignition-helper";
import { NamedArtifactContractDeploymentFuture, NamedArtifactContractAtFuture } from "@nomicfoundation/ignition-core";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/src/signers"
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ZrSignProxyFixture } from "./shared/fixtures";
import { ethers } from "hardhat";
import { expect } from "chai";
import * as roles from "./shared/roles";
import * as helpers from "./shared/walletTypes";

let instance: IgnitionModuleResultsTToEthersContracts<string, { 
    ZrSignImpl: NamedArtifactContractDeploymentFuture<"ZrSign">; 
    ZrProxy: NamedArtifactContractDeploymentFuture<"ZrProxy">; 
    ZrSignProxy: NamedArtifactContractAtFuture<"ZrSign">; 
}>;

describe("ZrSign key request", function() {
    
    const baseFee = ethers.parseUnits("80", "gwei");
    const supportedWalletType = helpers.EVM_CHAIN_TYPE_HASH;

    let accounts: Array<HardhatEthersSigner> | any;
    let regularAddress: HardhatEthersSigner;
    let feeAddress: HardhatEthersSigner;

    this.beforeAll(async() => {
        accounts = await ethers.getSigners();
        regularAddress = accounts[1];
        feeAddress = accounts[8];
    });

    this.beforeEach(async() => {
        const wt = helpers.EVM_CHAIN_TYPE;
        instance = await loadFixture(ZrSignProxyFixture);

        await instance.ZrSignProxy.grantRole(roles.FEE_ROLE, feeAddress.address);
        
        await instance.ZrSignProxy.connect(feeAddress).setupBaseFee(baseFee);
        await instance.ZrSignProxy.walletTypeIdConfig(
            wt.purpose, wt.coinType, true
        );
    });

    it("shoud request public key", async () => {
        const wallets = await instance.ZrSignProxy.getZrKeys(
            supportedWalletType,
            regularAddress
        );

        await expect(instance.ZrSignProxy.connect(regularAddress).zrKeyReq(
            { walletTypeId: supportedWalletType, monitoring: false },
            {value: baseFee }
        )).to.emit(instance.ZrSignProxy,"ZrKeyRequest").withArgs(
            supportedWalletType,
            regularAddress.address,
            wallets.length,
            false
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
                params: [ethers.parseUnits("80", "gwei"), ethers.parseUnits("30", "gwei")],
            }
        },
    ];

    for (let c of negativeTests) {
        it(`shoud not ${c.testName}`, async () => {
            await expect(instance.ZrSignProxy.connect(regularAddress).zrKeyReq(
                { walletTypeId: c.walletTypeId, monitoring: false },
                {value: c.fee}
            )).to.revertedWithCustomError(instance.ZrSignProxy, c.customError.name)
                .withArgs(...c.customError.params);
        });
    };
  
});