import { IgnitionModuleResultsTToEthersContracts } from "@nomicfoundation/hardhat-ignition-ethers/dist/src/ethers-ignition-helper";
import { NamedArtifactContractDeploymentFuture, NamedArtifactContractAtFuture } from "@nomicfoundation/ignition-core";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/src/signers"
import { ZrSignProxyFixture } from "./shared/fixtures";
import { ethers } from "hardhat";
import { expect } from "chai";
import * as helpers from "./shared/walletTypes";
import * as roles from "./shared/roles";

const abi = ethers.AbiCoder.defaultAbiCoder();

let instance: IgnitionModuleResultsTToEthersContracts<string, {
    ZrSignImpl: NamedArtifactContractDeploymentFuture<"ZrSign">;
    ZrProxy: NamedArtifactContractDeploymentFuture<"ZrProxy">;
    ZrSignProxy: NamedArtifactContractAtFuture<"ZrSign">;
}>;

type TestCase = {
    testName: string;
    walletTypeId: string;
    walletIndexIncrement: number;
    options: number,
    owner: string;
    mpcAddress: string;
    caller: HardhatEthersSigner;
    rerun: boolean;
    customError: {
        name: string;
        params: any;
    } | null;
}

describe("ZrSign key resolve", function () {

    const mpcFee = ethers.parseUnits("1000000000000000", "wei");
    const respGas = ethers.parseUnits("2000000", "wei");
    const gasBuff = 120;
    const gasTotalFee = ethers.parseUnits("100000000000000000", "wei");
    const supportedWalletType = helpers.EVM_CHAIN_TYPE_HASH;
    const unsupportedWalletType = helpers.UNSUPPORTED_CHAIN_TYPE_HASH;
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    let accounts: Array<HardhatEthersSigner> | any;
    let owner: HardhatEthersSigner;
    let user: HardhatEthersSigner;
    let ovm: HardhatEthersSigner;
    let feeAddress: HardhatEthersSigner;
    let mockMPC: HardhatEthersSigner;

    let testCases: Array<TestCase>;

    this.beforeAll(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        user = accounts[1];
        ovm = accounts[2];
        mockMPC = accounts[7];
        feeAddress = accounts[8];
    });

    it(`Key resolve scenarios`, function () {
        describe("key resolve - data driven test", function () {

            this.beforeEach(async () => {
                const wt = helpers.EVM_CHAIN_TYPE;
                instance = await loadFixture(ZrSignProxyFixture);

                await instance.ZrSignProxy.grantRole(roles.FEE_ROLE, feeAddress.address);
                await instance.ZrSignProxy.grantRole(roles.MPC_ROLE, ovm.address);
                await instance.ZrSignProxy.connect(feeAddress).updateMPCFee(mpcFee);
                await instance.ZrSignProxy.connect(feeAddress).updateRespGas(respGas);
                await instance.ZrSignProxy.connect(feeAddress).updateRespGasBuffer(gasBuff);
                await instance.ZrSignProxy.walletTypeIdConfig(
                    wt.purpose, wt.coinType, true
                );
            });

            testCases = [
                {
                    testName: "resolve public key for chain type",
                    walletTypeId: supportedWalletType,
                    walletIndexIncrement: 0,
                    options: 1,
                    owner: user.address,
                    mpcAddress: mockMPC.address,
                    caller: ovm,
                    rerun: false,
                    customError: null
                },
                {
                    testName: "not resolve public key twice",
                    walletTypeId: supportedWalletType,
                    walletIndexIncrement: 0,
                    options: 1,
                    owner: user.address,
                    mpcAddress: mockMPC.address,
                    caller: ovm,
                    rerun: true,
                    customError: {
                        name: "WalletNotRequested",
                        params: [mockMPC.address]
                    }
                },
                {
                    testName: "not resolve unsupported wallet type",
                    walletTypeId: unsupportedWalletType,
                    walletIndexIncrement: 0,
                    options: 1,
                    owner: user.address,
                    mpcAddress: mockMPC.address,
                    caller: ovm,
                    rerun: false,
                    customError: {
                        name: "WalletTypeNotSupported",
                        params: [unsupportedWalletType],
                    }
                },
                {
                    testName: "not resolve zero address",
                    walletTypeId: supportedWalletType,
                    walletIndexIncrement: 0,
                    options: 1,
                    owner: zeroAddress,
                    mpcAddress: mockMPC.address,
                    caller: ovm,
                    rerun: false,
                    customError: {
                        name: "OwnableInvalidOwner",
                        params: [zeroAddress],
                    },
                },
                {
                    testName: "not resolve with incorrect public key",
                    walletTypeId: supportedWalletType,
                    walletIndexIncrement: 0,
                    options: 1,
                    owner: user.address,
                    mpcAddress: "",
                    caller: ovm,
                    rerun: false,
                    customError: {
                        name: "InvalidAddressLength",
                        params: [5, 0],
                    },
                },
                {
                    testName: "not resolve without mpc role",
                    walletTypeId: supportedWalletType,
                    walletIndexIncrement: 0,
                    options: 1,
                    owner: user.address,
                    mpcAddress: mockMPC.address,
                    caller: owner,
                    rerun: false,
                    customError: {
                        name: "AccessControlUnauthorizedAccount",
                        params: [owner.address, roles.MPC_ROLE], // Updated to use correct address
                    },
                },
                {
                    testName: "not resolve public key for chain type with wrong public key index",
                    walletTypeId: supportedWalletType,
                    walletIndexIncrement: 1,
                    options: 1,
                    owner: user.address,
                    mpcAddress: mockMPC.address,
                    caller: ovm,
                    rerun: false,
                    customError: {
                        name: "IncorrectWalletIndex",
                        params: [0, 1]
                    }
                },
            ]

            for (let c of testCases) {
                it(`should ${c.testName}`, async () => {
                    // Perform the key request
                    const keyReqParams = {
                        owner: c.owner,
                        walletTypeId: supportedWalletType,
                        options: c.options,
                    };

                    await instance.ZrSignProxy.connect(user).zrKeyReq(keyReqParams, { value: gasTotalFee });

                    const wallets = await instance.ZrSignProxy.getZrKeys(
                        supportedWalletType,
                        c.owner
                    )

                    const chainId = await instance.ZrSignProxy.SRC_CHAIN_ID();
                    const walletIndex = wallets.length + c.walletIndexIncrement;
                    const payload = abi.encode(
                        ["bytes32", "bytes32", "address", "uint256", "string", "uint256"],
                        [chainId, supportedWalletType, c.owner, walletIndex, c.mpcAddress, c.options]
                    );

                    const payloadHash = ethers.keccak256(ethers.toBeArray(payload));
                    const sig = await c.caller.signMessage(ethers.toBeArray(payloadHash));

                    const params = {
                        walletTypeId: c.walletTypeId,
                        owner: c.owner,
                        walletIndex: walletIndex,
                        options: c.options,
                        wallet: c.mpcAddress,
                        authSignature: sig
                    };
                    const gasLimit = await instance.ZrSignProxy.getRespGas();
                    let tx = instance.ZrSignProxy.connect(c.caller).zrKeyRes(params, { gasLimit: gasLimit });

                    if (c.rerun) {
                        const payload = abi.encode(
                            ["bytes32", "bytes32", "address", "uint256", "string", "uint256"],
                            [chainId, supportedWalletType, c.owner, walletIndex + 1, c.mpcAddress, c.options]
                        );

                        const payloadHash = ethers.keccak256(ethers.toBeArray(payload));
                        const sig = await c.caller.signMessage(ethers.toBeArray(payloadHash));

                        params.walletIndex++;
                        params.authSignature = sig;
                        const gasLimit = await instance.ZrSignProxy.getRespGas();
                        tx = instance.ZrSignProxy.connect(c.caller).zrKeyRes(params, { gasLimit: gasLimit });
                    }

                    if (c.customError != null) {
                        await expect(tx)
                            .to.revertedWithCustomError(instance.ZrSignProxy, c.customError.name)
                            .withArgs(...c.customError.params);
                    } else {
                        await expect(tx)
                            .to.emit(instance.ZrSignProxy, "ZrKeyResolve")
                            .withArgs(
                                c.walletTypeId,
                                user.address,
                                wallets.length,
                                c.mpcAddress,
                            );
                    }
                });
            }
        });
    });
});