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
    flag: number;
    baseFee: bigint;
    networkFee: bigint;
    broadcast: boolean;
    dstChainId: string;
    panicError: number | null;
    customError: { 
        name: string; 
        params: any; 
    } | null; 
}

const abi = ethers.AbiCoder.defaultAbiCoder();

describe("ZrSign Fees", function () {

    const baseFee = ethers.parseUnits("80", "gwei");
    const networkFee = ethers.parseUnits("4", "wei");
    const supportedWalletType = helpers.EVM_CHAIN_TYPE_HASH;
    const unsupportedWalletType = helpers.UNSUPPORTED_CHAIN_TYPE_HASH;

    const IS_HASH_MASK = 1 << 0; // 0b0001
    const IS_DATA_MASK = 1 << 1; // 0b0010
    const IS_TX_MASK = 1 << 2; // 0b0100;

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
    let tokenomicsAcc: HardhatEthersSigner;
    let testCases: Array<TestCase>;

    this.beforeAll(async() => {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        user = accounts[1];
        ovm = accounts[2];
        mockMPC = accounts[7];
        tokenomicsAcc = accounts[8];
    });

    //TODO: Move into a fixture.
    this.beforeEach(async() => {
        const wt = helpers.EVM_CHAIN_TYPE;
        instance = await loadFixture(ZrSignProxyFixture);
        
        await instance.ZrSignProxy.grantRole(roles.TOKENOMICS_ROLE, tokenomicsAcc.address);
        await instance.ZrSignProxy.grantRole(roles.MPC_ROLE, ovm.address);

        await instance.ZrSignProxy.connect(tokenomicsAcc).setupBaseFee(baseFee);
        await instance.ZrSignProxy.connect(tokenomicsAcc).setupNetworkFee(networkFee);
        await instance.ZrSignProxy.walletTypeIdConfig(
            wt.purpose, wt.coinType, true
        );

        const wtId = abi.encode(["uint256", "uint256"], [wt.purpose, wt.coinType]);
        const wtIdHash = ethers.keccak256(wtId);

        await instance.ZrSignProxy.chainIdConfig(
            wtIdHash, chains.ETH_GOERLI_CAIP, true
        );

        const chainId = await instance.ZrSignProxy.SRC_CHAIN_ID();
        const payload = abi.encode(
            ["bytes32", "bytes32", "address", "uint256", "string"], 
            [chainId, supportedWalletType, user.address, 0, mockMPC.address]
        );

        const plBytes = ethers.toBeArray(payload);
        const payloadHash = ethers.keccak256(plBytes);
        const sig = await ovm.signMessage(ethers.toBeArray(payloadHash));

        const params = {
            walletTypeId: supportedWalletType,
            owner: user.address,
            walletIndex: 0,
            publicKey: mockMPC.address,
            authSignature: sig
        };

        await instance.ZrSignProxy.connect(ovm).zrKeyRes(params);
    });

    it("Signature resolve scenarios:", async () => {

        describe("", async () => {
            let traceId = BigInt(1);
            testCases = [
                {
                    testName: "request signature for payload hash",
                    walletTypeId: supportedWalletType,
                    walletIndex: 0,
                    baseFee: baseFee,
                    networkFee: networkFee,
                    caller: user,
                    flag: IS_HASH_MASK,
                    broadcast: false,
                    dstChainId: chains.ETH_GOERLI_CHAIN_ID,
                    panicError: null,
                    customError: null
                },
                {
                    testName: "request signature for payload without broadcast",
                    walletTypeId: supportedWalletType,
                    walletIndex: 0,
                    baseFee: baseFee,
                    networkFee: networkFee,
                    caller: user,
                    flag: IS_TX_MASK,
                    broadcast: false,
                    dstChainId: chains.ETH_GOERLI_CHAIN_ID,
                    panicError: null,
                    customError: null
                },
                {
                    testName: "request signature for payload with broadcast",
                    walletTypeId: supportedWalletType,
                    walletIndex: 0,
                    baseFee: baseFee,
                    networkFee: networkFee,
                    caller: user,
                    flag: IS_TX_MASK,
                    broadcast: true,
                    dstChainId: chains.ETH_GOERLI_CHAIN_ID,
                    panicError: null,
                    customError: null
                },
                {
                    testName: "not be able to request for unsupported wallet type",
                    walletTypeId: unsupportedWalletType,
                    walletIndex: 0,
                    baseFee: baseFee,
                    networkFee: networkFee,
                    caller: user,
                    flag: IS_HASH_MASK,
                    broadcast: false,
                    dstChainId: chains.ETH_GOERLI_CHAIN_ID,
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
                    baseFee: baseFee,
                    networkFee: networkFee,
                    caller: user,
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
                    baseFee: baseFee,
                    networkFee: networkFee,
                    caller: user,
                    flag: IS_HASH_MASK,
                    broadcast: false,
                    dstChainId: chains.ETH_GOERLI_CHAIN_ID,
                    panicError: 0x32,
                    customError: null
                },
                {
                    testName: "not be able to request with less fee",
                    walletTypeId: supportedWalletType,
                    walletIndex: 0,
                    baseFee: baseFee,
                    networkFee: ethers.parseUnits("2", "wei"),
                    caller: user,
                    flag: IS_HASH_MASK,
                    broadcast: false,
                    dstChainId: chains.ETH_GOERLI_CHAIN_ID,
                    panicError: null,
                    customError: {
                        name: "InsufficientFee",
                        params: [
                            (BigInt(
                                arrayify("0x8166b5ef3786f477a19973ffcd946c854ca3c99a53ce99b18b5ac63314a2a751").length
                            ) * networkFee) + baseFee,
                            (BigInt(
                                arrayify("0x8166b5ef3786f477a19973ffcd946c854ca3c99a53ce99b18b5ac63314a2a751").length
                            ) * ethers.parseUnits("2", "wei")) + baseFee,
                        ]
                    }
                }
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

                    const widPayload = abi.encode(
                        ["bytes32","address","uint256"],
                        [c.walletTypeId, c.caller.address, c.walletIndex]
                    )
                    const wid = ethers.keccak256(widPayload);

                    const rlpPayload = RLP.encode(transaction);                    
                    const payloadHash = ethers.keccak256(rlpPayload)

                    const txNewtorkFee =  BigInt(arrayify(payloadHash).length) * c.networkFee;
                    const txTotalFee = txNewtorkFee + baseFee;

                    
                    const signPayload = {
                        walletTypeId: c.walletTypeId,
                        walletIndex: c.walletIndex,
                        dstChainId: c.dstChainId,
                        payload: payloadHash,
                        broadcast: c.broadcast
                    };

                    let tx: any;
                    switch(c.flag) {
                        case IS_TX_MASK: {
                            tx = instance.ZrSignProxy.connect(c.caller).zrSignTx(
                                signPayload, { value: txTotalFee}
                            );
                            
                            break;
                        }
                        case IS_HASH_MASK: {
                            tx = instance.ZrSignProxy.connect(c.caller).zrSignHash(
                                signPayload, { value: txTotalFee}
                            );

                            break;
                        }
                    }
                    
                    if (c.customError != null) {
                        await expect(tx).to.revertedWithCustomError(
                            instance.ZrSignProxy, c.customError.name
                        ).withArgs(...c.customError.params);

                    } else if(c.panicError != null) {
                        await expect(tx).to.revertedWithPanic(c.panicError);

                    } else {
                        await expect(tx).to.emit(instance.ZrSignProxy, "ZrSigRequest")
                            .withArgs(
                                traceId,
                                wid,
                                c.walletTypeId,
                                c.caller.address,
                                c.walletIndex,
                                c.dstChainId,
                                payloadHash,
                                c.flag,
                                c.broadcast
                            )
                    }

                    traceId++;
                });
            }
        }); 
    });

});