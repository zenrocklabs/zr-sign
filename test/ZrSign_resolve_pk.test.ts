import { IgnitionModuleResultsTToEthersContracts } from "@nomicfoundation/hardhat-ignition-ethers/dist/src/ethers-ignition-helper";
import { NamedArtifactContractDeploymentFuture, NamedArtifactContractAtFuture } from "@nomicfoundation/ignition-core";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/src/signers"
import { ZrSignProxyFixture } from "./shared/fixtures";
import hre, { ethers } from "hardhat";
import { expect } from "chai";
import * as helpers from "./shared/walletTypes";
import * as roles from "./shared/roles";

const abi = ethers.AbiCoder.defaultAbiCoder();

let instance: IgnitionModuleResultsTToEthersContracts<string, { 
    ZrSignImpl: NamedArtifactContractDeploymentFuture<"ZrSign">; 
    ZrProxy: NamedArtifactContractDeploymentFuture<"ZrProxy">; 
    ZrSignProxy: NamedArtifactContractAtFuture<"ZrSign">; 
}>;

describe("QSign key request", function() {

    const baseFee = ethers.parseUnits("80", "gwei");
    const networkFee = ethers.parseUnits("4", "wei");
    const supportedWalletType = helpers.EVM_CHAIN_TYPE_HASH;

    let accounts: Array<HardhatEthersSigner> | any;
    let ovm: HardhatEthersSigner;
    let tokenomicsAddress: HardhatEthersSigner;


    this.beforeAll(async() => {
        accounts = await ethers.getSigners();
        ovm = accounts[2];
        tokenomicsAddress = accounts[8];
    });

    this.beforeEach(async() => {
        const wt = helpers.EVM_CHAIN_TYPE;
        instance = await loadFixture(ZrSignProxyFixture);

        await instance.ZrSignProxy.grantRole(roles.TOKENOMICS_ROLE, tokenomicsAddress.address);
        await instance.ZrSignProxy.grantRole(roles.MPC_ROLE, ovm.address);
        
        await instance.ZrSignProxy.connect(tokenomicsAddress).setupBaseFee(baseFee);
        await instance.ZrSignProxy.connect(tokenomicsAddress).setupNetworkFee(networkFee);
        await instance.ZrSignProxy.walletTypeIdConfig(
            wt.purpose, wt.coinType, true
        );
    });

    it("shoud resolve public key for chain type", async () => {
        const user = accounts[1];
        const mpc = accounts[8];

        const wallets = await instance.ZrSignProxy.getZrKeys(
            supportedWalletType,
            user.address
        )

        const chainId = await instance.ZrSignProxy.SRC_CHAIN_ID();
        const walletIndex = wallets.length;
        const payload = abi.encode(
            ["bytes32", "bytes32", "address", "uint256", "string"], 
            [chainId, supportedWalletType, user.address, walletIndex, mpc.address]
        );

        const plBytes = ethers.toBeArray(payload);
        const payloadHash = ethers.keccak256(plBytes);
        const sig = await ovm.signMessage(ethers.toBeArray(payloadHash));

        const params = {
            walletTypeId: supportedWalletType,
            owner: user,
            walletIndex: walletIndex,
            publicKey: mpc.address,
            authSignature: sig
        };

        await expect(instance.ZrSignProxy.connect(ovm).zrKeyRes(params))
            .to.emit(instance.ZrSignProxy, "ZrKeyResolve")
            .withArgs(
                supportedWalletType,
                user.address,
                wallets.length,
                mpc.address
        );

        const updatedWallets = await instance.ZrSignProxy.getZrKeys(
            supportedWalletType,
            user.address
        )

        expect(updatedWallets.length).to.equal(walletIndex + 1);
    });

});
