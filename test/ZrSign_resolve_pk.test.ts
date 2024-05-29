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
    owner: string; 
    mpcAddress: string; 
    caller: HardhatEthersSigner; 
    customError: { 
        name: string; 
        params: any; 
    } | null; 
}

describe("ZrSign key request", function() {

    const baseFee = ethers.parseUnits("80", "gwei");
    const networkFee = ethers.parseUnits("4", "wei");
    const supportedWalletType = helpers.EVM_CHAIN_TYPE_HASH;
    const unsupportedWalletType = helpers.UNSUPPORTED_CHAIN_TYPE_HASH;
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    let accounts: Array<HardhatEthersSigner> | any;
    let owner: HardhatEthersSigner;
    let user: HardhatEthersSigner;
    let ovm: HardhatEthersSigner;
    let tokenomicsAddress: HardhatEthersSigner;
    let mockMPC: HardhatEthersSigner;
    
    let testCases: Array<TestCase>;

    this.beforeAll(async() => {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        user = accounts[1];
        ovm = accounts[2];
        mockMPC = accounts[7];
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

    it(`Key resolve scenarios`, function() {
        // Hack: needs to be inside "it" because we need to load "before" hooks.
        // CAUTION: Test cases share state, order sensitive.
        testCases = [
            {
                testName: "resolve public key for chain type",
                walletTypeId: supportedWalletType,
                walletIndexIncrement: 0,
                owner: user.address,
                mpcAddress: mockMPC.address,
                caller: ovm,
                customError: null
            },
            {
                testName: "not resolve public key twice",
                walletTypeId: supportedWalletType,
                walletIndexIncrement: 0,
                owner: user.address,
                mpcAddress: mockMPC.address,
                caller: ovm,
                customError: {
                    name: "PublicKeyAlreadyRegistered",
                    params: [mockMPC.address]
                }
            },
            {
                testName: "not resolve unsupported wallet type",
                walletTypeId: unsupportedWalletType,
                walletIndexIncrement: 0,
                owner: user.address,
                mpcAddress: mockMPC.address,
                caller: ovm,
                customError: {
                    name: "WalletTypeNotSupported",
                    params: [unsupportedWalletType],
                }
            },
            {
                testName: "not resolve zero address",
                walletTypeId: supportedWalletType,
                walletIndexIncrement: 0,
                owner: zeroAddress,
                mpcAddress: mockMPC.address,
                caller: ovm,
                customError: {
                    name: "OwnableInvalidOwner",
                    params: [zeroAddress],
                },
            },
            {
                testName: "not resolve with incorrect public key",
                walletTypeId: supportedWalletType,
                walletIndexIncrement: 0,
                owner: user.address,
                mpcAddress: "",
                caller: ovm,
                customError: {
                    name: "InvalidPublicKeyLength",
                    params: [5, 0],
                },
            },
            {
                testName: "not resolve without mpc role",
                walletTypeId: supportedWalletType,
                walletIndexIncrement: 0,
                owner: user.address,
                mpcAddress: mockMPC.address,
                caller: owner,  
                customError: {
                    name: "AccessControlUnauthorizedAccount",
                    params: [owner, roles.MPC_ROLE],
                },
            },
            {
                testName: "not resolve public key for chain type with wrong public key index",
                walletTypeId: supportedWalletType,
                walletIndexIncrement: 1,
                owner: user.address,
                mpcAddress: mockMPC.address,
                caller: ovm,
                customError: {
                    name: "IncorrectWalletIndex",
                    params: [1, 2]
                }
            },
        ]

        describe('', function() { 
                for (let c of testCases) {
                it(`should ${c.testName}`, async () => {
                    const wallets = await instance.ZrSignProxy.getZrKeys(
                        supportedWalletType,
                        user.address
                    )
            
                    const chainId = await instance.ZrSignProxy.SRC_CHAIN_ID();
                    const walletIndex = wallets.length + c.walletIndexIncrement;
                    const payload = abi.encode(
                        ["bytes32", "bytes32", "address", "uint256", "string"], 
                        [chainId, supportedWalletType, user.address, walletIndex, c.mpcAddress]
                    );
                    
                    const plBytes = ethers.toBeArray(payload);
                    const payloadHash = ethers.keccak256(plBytes);
                    const sig = await c.caller.signMessage(ethers.toBeArray(payloadHash));
            
                    const params = {
                        walletTypeId: c.walletTypeId,
                        owner: c.owner,
                        walletIndex: walletIndex,
                        publicKey: c.mpcAddress,
                        authSignature: sig
                    };
            
                    if (c.customError != null) {
                        await expect(instance.ZrSignProxy.connect(c.caller).zrKeyRes(params))
                            .to.revertedWithCustomError(instance.ZrSignProxy, c.customError.name)
                            .withArgs(...c.customError.params);
                    } else {
                        await expect(instance.ZrSignProxy.connect(ovm).zrKeyRes(params))
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
