import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ZrSignProxyFixture } from "./shared/fixtures";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IgnitionModuleResultsTToEthersContracts } from "@nomicfoundation/hardhat-ignition-ethers/dist/src/ethers-ignition-helper";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/src/signers"
import { NamedArtifactContractDeploymentFuture, NamedArtifactContractAtFuture } from "@nomicfoundation/ignition-core";
import * as roles from "./shared/roles";
import * as helpers from "./shared/walletTypes";
import * as chains from "./shared/chainIds";
import RLP from "rlp";

type TestCase = {
    testName: string;
    walletTypeId: string;
    walletIndex: number;
    caller: HardhatEthersSigner;
    flag: number;
    gasTotalFee: bigint;
    broadcast: boolean;
    dstChainId: string;
    panicError: number | null;
    customError: {
        name: string;
        params: any;
    } | null;
}

const abi = ethers.AbiCoder.defaultAbiCoder();

describe("ZrSign ZrSigReq", function () {
    const mpcFee = ethers.parseUnits("1000000000000000", "wei");
    const respGas = ethers.parseUnits("2000000", "wei");
    const gasBuff = 120;
    const gasTotalFee = ethers.parseUnits("100000000000000000", "wei");
    const supportedWalletType = helpers.EVM_CHAIN_TYPE_HASH;
    const unsupportedWalletType = helpers.UNSUPPORTED_CHAIN_TYPE_HASH;

    const IS_HASH_MASK = 1 << 0; // 0b0001
    const IS_TX_MASK = 1 << 1; // 0b0100;
    const IS_SIMPLE_TX_MASK = 1 << 2; // 0b1000;

    let instance: IgnitionModuleResultsTToEthersContracts<string, {
        ZrSignImpl: NamedArtifactContractDeploymentFuture<"ZrSign">;
        ZrProxy: NamedArtifactContractDeploymentFuture<"ZrProxy">;
        ZrSignProxy: NamedArtifactContractAtFuture<"ZrSign">;
    }>;

    let accounts: Array<HardhatEthersSigner> | any;
    let regularAddress: HardhatEthersSigner;
    let owner: HardhatEthersSigner;
    let ovm: HardhatEthersSigner;
    let mockMPC: HardhatEthersSigner;
    let feeAcc: HardhatEthersSigner;
    let testCases: Array<TestCase>;

    this.beforeAll(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        regularAddress = accounts[1];
        ovm = accounts[2];
        mockMPC = accounts[7];
        feeAcc = accounts[8];
    });
    it("Signature tests", async () => {
        describe("signature request - data driven test", async function () {
            this.beforeEach(async () => {
                const wt = helpers.EVM_CHAIN_TYPE;
                instance = await loadFixture(ZrSignProxyFixture);

                await instance.ZrSignProxy.grantRole(roles.FEE_ROLE, feeAcc.address);
                await instance.ZrSignProxy.grantRole(roles.MPC_ROLE, ovm.address);
                // const hasMpcRole = await instance.ZrSignProxy.hasRole(roles.MPC_ROLE, ovm.address);
                // console.log("Does OVM have MPC_ROLE?", hasMpcRole);
                await instance.ZrSignProxy.connect(feeAcc).updateMPCFee(mpcFee);
                await instance.ZrSignProxy.connect(feeAcc).updateRespGas(respGas);
                await instance.ZrSignProxy.connect(feeAcc).updateRespGasBuffer(gasBuff);

                await instance.ZrSignProxy.walletTypeIdConfig(
                    wt.purpose, wt.coinType, true
                );

                const wtId = abi.encode(["uint256", "uint256"], [wt.purpose, wt.coinType]);
                const wtIdHash = ethers.keccak256(wtId);

                await instance.ZrSignProxy.chainIdConfig(
                    wtIdHash, chains.ETH_SEPOLIA_CAIP, true
                );

                // Perform the key request
                const keyReqParams = {
                    owner: regularAddress.address,
                    walletTypeId: supportedWalletType,
                    options: 1,
                };

                await instance.ZrSignProxy.connect(regularAddress).zrKeyReq(keyReqParams, { value: gasTotalFee });

                const chainId = await instance.ZrSignProxy.SRC_CHAIN_ID();
                const payload = abi.encode(
                    ["bytes32", "bytes32", "address", "uint256", "string", "bool"],
                    [chainId, supportedWalletType, regularAddress.address, 0, mockMPC.address, 1]
                );

                const plBytes = ethers.toBeArray(payload);
                const payloadHash = ethers.keccak256(plBytes);
                const sig = await ovm.signMessage(ethers.toBeArray(payloadHash));
                // const recoveredAddress = ethers.verifyMessage(ethers.toBeArray(payloadHash), sig);
                // console.log("Recovered Address:", recoveredAddress);
                // console.log("OVM Address:", ovm.address);
                const params = {
                    walletTypeId: supportedWalletType,
                    owner: regularAddress.address,
                    walletIndex: 0,
                    wallet: mockMPC.address,
                    options: 1,
                    monitoring: 0,
                    authSignature: sig
                };
                const gasLimit = await instance.ZrSignProxy.getRespGas();
                await instance.ZrSignProxy.connect(ovm).zrKeyRes(params, {
                    gasLimit: gasLimit
                });
            });

            testCases = [
                {
                    testName: "request signature for payload hash",
                    walletTypeId: supportedWalletType,
                    walletIndex: 0,
                    gasTotalFee: gasTotalFee,
                    caller: regularAddress,
                    flag: IS_HASH_MASK,
                    broadcast: false,
                    dstChainId: chains.ETH_SEPOLIA_CHAIN_ID,
                    panicError: null,
                    customError: null
                },
                {
                    testName: "request signature for payload without broadcast",
                    walletTypeId: supportedWalletType,
                    walletIndex: 0,
                    gasTotalFee: gasTotalFee,
                    caller: regularAddress,
                    flag: IS_TX_MASK,
                    broadcast: false,
                    dstChainId: chains.ETH_SEPOLIA_CHAIN_ID,
                    panicError: null,
                    customError: null
                },
                {
                    testName: "request signature for payload with broadcast",
                    walletTypeId: supportedWalletType,
                    walletIndex: 0,
                    gasTotalFee: gasTotalFee,
                    caller: regularAddress,
                    flag: IS_TX_MASK,
                    broadcast: true,
                    dstChainId: chains.ETH_SEPOLIA_CHAIN_ID,
                    panicError: null,
                    customError: null
                },
                {
                    testName: "not be able to request for unsupported wallet type",
                    walletTypeId: unsupportedWalletType,
                    walletIndex: 0,
                    gasTotalFee: gasTotalFee,
                    caller: regularAddress,
                    flag: IS_HASH_MASK,
                    broadcast: false,
                    dstChainId: chains.ETH_SEPOLIA_CHAIN_ID,
                    panicError: null,
                    customError: {
                        name: "WalletTypeNotSupported",
                        params: [unsupportedWalletType]
                    }
                },
                {
                    testName: "not be able to request for unsupported chain id",
                    walletTypeId: supportedWalletType,
                    walletIndex: 0,
                    gasTotalFee: gasTotalFee,
                    caller: regularAddress,
                    flag: IS_HASH_MASK,
                    broadcast: false,
                    dstChainId: chains.UNSUPPORTED_CHAIN_ID,
                    panicError: null,
                    customError: {
                        name: "ChainIdNotSupported",
                        params: [supportedWalletType, chains.UNSUPPORTED_CHAIN_ID]
                    }
                },
                {
                    testName: "not be able to request with incorrect key index",
                    walletTypeId: supportedWalletType,
                    walletIndex: 5,
                    gasTotalFee: gasTotalFee,
                    caller: regularAddress,
                    flag: IS_HASH_MASK,
                    broadcast: false,
                    dstChainId: chains.ETH_SEPOLIA_CHAIN_ID,
                    panicError: null,
                    customError: {
                        name: "InvalidOptions",
                        params: [0]
                    }
                },
                {
                    testName: "not be able to request with less fee",
                    walletTypeId: supportedWalletType,
                    walletIndex: 0,
                    gasTotalFee: gasTotalFee - gasTotalFee,
                    caller: regularAddress,
                    flag: IS_HASH_MASK,
                    broadcast: false,
                    dstChainId: chains.ETH_SEPOLIA_CHAIN_ID,
                    panicError: null,
                    customError: {
                        name: "InsufficientFee",
                        params: [BigInt(1442893752000000), gasTotalFee - gasTotalFee]
                    }
                }
            ];

            for (let c of testCases) {
                it(`should ${c.testName}`, async () => {
                    const data = {
                        to: owner.address,
                        value: 100,
                        gas: 30000,
                        maxFeePerGas: 1000000108,
                        nonce: 0,
                        data: "0x",
                    };

                    const transaction = [
                        ethers.toBeHex(data.nonce),
                        ethers.toBeHex(data.maxFeePerGas),
                        ethers.toBeHex(200000),
                        data.to,
                        ethers.toBeHex(data.value),
                        data.data,
                        null, null, null,
                    ];
                    const chainId = (await ethers.provider.getNetwork()).chainId
                    const widPayload = abi.encode(
                        ["uint256", "address", "bytes32", "address", "uint256"],
                        [chainId, instance.ZrSignProxy.target, c.walletTypeId, c.caller.address, c.walletIndex]
                    );
                    const wid = ethers.keccak256(widPayload);
                    const rlpPayload = RLP.encode(transaction);
                    const payloadHash = ethers.keccak256(rlpPayload);


                    const signPayload = {
                        walletTypeId: c.walletTypeId,
                        walletIndex: c.walletIndex,
                        dstChainId: c.dstChainId,
                        payload: payloadHash,
                        broadcast: c.broadcast
                    };
                    let tx: any;
                    switch (c.flag) {
                        case IS_TX_MASK: {
                            tx = instance.ZrSignProxy.connect(c.caller).zrSignTx(
                                signPayload, { value: c.gasTotalFee }
                            );

                            break;
                        }
                        case IS_HASH_MASK: {
                            tx = instance.ZrSignProxy.connect(c.caller).zrSignHash(
                                signPayload, { value: c.gasTotalFee }
                            );

                            break;
                        }
                    }

                    if (c.customError != null) {
                        if (c.customError.name === "InsufficientFee") {
                            await expect(tx).to.revertedWithCustomError(
                                instance.ZrSignProxy, c.customError.name
                            );
                        } else {
                            await expect(tx).to.revertedWithCustomError(
                                instance.ZrSignProxy, c.customError.name
                            ).withArgs(...c.customError.params);

                        }
                    } else if (c.panicError != null) {
                        await expect(tx).to.revertedWithPanic(c.panicError);

                    } else {
                        await expect(tx).to.emit(instance.ZrSignProxy, "ZrSigRequest")
                    }
                });
            }
        });
    })
});
