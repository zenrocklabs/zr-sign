import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ZrSignProxyFixture } from "./shared/fixtures";
import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { IgnitionModuleResultsTToEthersContracts } from "@nomicfoundation/hardhat-ignition-ethers/dist/src/ethers-ignition-helper";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/src/signers"
import { NamedArtifactContractDeploymentFuture, NamedArtifactContractAtFuture } from "@nomicfoundation/ignition-core";
import * as roles from "./shared/roles";
import * as helpers from "./shared/walletTypes";
import * as chains from "./shared/chainIds";
import RLP from "rlp";
import { arrayify } from "@ethersproject/bytes";

type TestCase = { 
    testName: string;
    walletTypeId: string; 
    walletIndex: number;
    caller: HardhatEthersSigner; 
    broadcast: boolean;
    dstChainId: string;
    rerun: boolean;
    panicError: number | null;
    customError: { 
        name: string; 
        params: any; 
    } | null; 
}

const abi = ethers.AbiCoder.defaultAbiCoder();

describe("ZrSign Resolve Signatures", function () {

    const baseFee = ethers.parseUnits("80", "gwei");
    const networkFee = ethers.parseUnits("4", "wei");
    const supportedWalletType = helpers.EVM_CHAIN_TYPE_HASH;

    let instance: IgnitionModuleResultsTToEthersContracts<string, { 
        ZrSignImpl: NamedArtifactContractDeploymentFuture<"ZrSign">; 
        ZrProxy: NamedArtifactContractDeploymentFuture<"ZrProxy">; 
        ZrSignProxy: NamedArtifactContractAtFuture<"ZrSign">; 
    }>;

    let accounts: Array<HardhatEthersSigner> | any;
    let owner: HardhatEthersSigner;
    let user: HardhatEthersSigner;
    let ovm: HardhatEthersSigner;
    let mockMPC: HardhatEthersSigner;
    let feeAcc: HardhatEthersSigner;
    let testCases: Array<TestCase>;

    this.beforeAll(async() => {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        user = accounts[1];
        ovm = accounts[2];
        mockMPC = accounts[7];
        feeAcc = accounts[8];
    });

    it("Signature resolve scenarios:", async () => {
        describe("signature resolve - data driven test", function() {
            this.beforeEach(async() => {
                const wt = helpers.EVM_CHAIN_TYPE;
                instance = await loadFixture(ZrSignProxyFixture);
                
                await instance.ZrSignProxy.grantRole(roles.FEE_ROLE, feeAcc.address);
                await instance.ZrSignProxy.grantRole(roles.MPC_ROLE, ovm.address);
        
                await instance.ZrSignProxy.connect(feeAcc).setupBaseFee(baseFee);
                await instance.ZrSignProxy.walletTypeIdConfig(
                    wt.purpose, wt.coinType, true
                );

                const wtId = abi.encode(["uint256", "uint256"], [wt.purpose, wt.coinType]);
                const wtIdHash = ethers.keccak256(wtId);
        
                await instance.ZrSignProxy.chainIdConfig(
                    wtIdHash, chains.ETH_SEPOLIA_CAIP, true
                );

                const chainId = await instance.ZrSignProxy.SRC_CHAIN_ID();
                const payload = abi.encode(
                    ["bytes32", "bytes32", "address", "uint256", "string", "bool"], 
                    [chainId, supportedWalletType, user.address, 0, mockMPC.address, false]
                );
        
                const plBytes = ethers.toBeArray(payload);
                const payloadHash = ethers.keccak256(plBytes);
                const sig = await ovm.signMessage(ethers.toBeArray(payloadHash));
        
                const params = {
                    walletTypeId: supportedWalletType,
                    owner: user.address,
                    walletIndex: 0,
                    addr: mockMPC.address,
                    monitoring: false,
                    authSignature: sig
                };
        
                await instance.ZrSignProxy.connect(ovm).zrKeyRes(params);
            });

            testCases = [
                {
                    testName: "resovle signature for payload hash without broadcast",
                    walletTypeId: supportedWalletType,
                    walletIndex: 0,
                    caller: ovm,
                    broadcast: false,
                    dstChainId: chains.ETH_SEPOLIA_CHAIN_ID,
                    rerun: false,
                    panicError: null,
                    customError: null
                },
                {
                    testName: "not resolve when not authorized by MPC_ROLE",
                    walletTypeId: supportedWalletType,
                    walletIndex: 0,
                    caller: user,
                    broadcast: false,
                    dstChainId: chains.ETH_SEPOLIA_CHAIN_ID,
                    rerun: false,
                    panicError: null,
                    customError: {
                        name: "AccessControlUnauthorizedAccount",
                        params: [user.address, roles.MPC_ROLE]
                    }
                },
                {
                    testName: "not resolve signature for the same data twice",
                    walletTypeId: supportedWalletType,
                    walletIndex: 0,
                    caller: ovm,
                    broadcast: false,
                    dstChainId: chains.ETH_SEPOLIA_CHAIN_ID,
                    rerun: true,
                    panicError: null,
                    customError: {
                        name: "RequestNotFoundOrAlreadyProcessed",
                        params: [1]
                    }
                },

            ]

            for (let c of testCases) {
                it(`should ${c.testName}`, async () => {
                    const data = {
                        to: owner.address,
                        value: 100,
                        gas: 30000,
                        maxFeePerGas: 1000000108,
                        nonce: 0,
                        data: "0x",
                    }

                    const transaction = [
                        ethers.toBeHex(data.nonce),
                        ethers.toBeHex(data.maxFeePerGas),
                        ethers.toBeHex(200000),
                        data.to,
                        ethers.toBeHex(data.value),
                        data.data,
                        null, null, null,
                    ];

                    const rlpPayload = RLP.encode(transaction);                    
                    const payloadHash = ethers.keccak256(rlpPayload);

                    const signPayload = {
                        walletTypeId: c.walletTypeId,
                        walletIndex: c.walletIndex,
                        dstChainId: c.dstChainId,
                        payload: payloadHash,
                        broadcast: c.broadcast
                    };

                    await instance.ZrSignProxy.connect(user).zrSignHash(
                        signPayload, { value: baseFee}
                    );

                    const signature = await mockMPC.signMessage(ethers.toBeArray(payloadHash));
                    const chainId = await instance.ZrSignProxy.SRC_CHAIN_ID();
                    let resPayload = abi.encode(
                        ["bytes32","uint256", "bytes", "bool"],
                        [chainId, 1, signature, c.broadcast]
                    )

                    const resolvePayloadHash = ethers.keccak256(ethers.toBeArray(resPayload));
                    const authSignature = await c.caller.signMessage(ethers.toBeArray(resolvePayloadHash));

                    const params = {
                        traceId: 1,
                        signature: signature,
                        broadcast: c.broadcast,
                        authSignature: authSignature
                    };

                    let resolveTx = instance.ZrSignProxy.connect(c.caller).zrSignRes(params);

                    if (c.rerun) {
                        resolveTx = instance.ZrSignProxy.connect(c.caller).zrSignRes(params);
                    }

                    if (c.customError != null) {
                        await expect(resolveTx).to.revertedWithCustomError(
                            instance.ZrSignProxy, c.customError.name)
                            .withArgs(...c.customError.params);

                    } else {
                        await expect(resolveTx).to.emit(instance.ZrSignProxy, "ZrSigResolve");
                    }
                });
            }
        });
    });
});