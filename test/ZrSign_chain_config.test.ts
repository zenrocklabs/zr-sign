import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { IgnitionModuleResultsTToEthersContracts } from "@nomicfoundation/hardhat-ignition-ethers/dist/src/ethers-ignition-helper";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/src/signers"
import { NamedArtifactContractDeploymentFuture, NamedArtifactContractAtFuture } from "@nomicfoundation/ignition-core";
import { ZrSignProxyFixture } from "./shared/fixtures";
import { ethers } from "hardhat";
import { expect } from "chai";
import * as roles from "./shared/roles";
import * as helpers from "./shared/walletTypes";
import * as chainIds from "./shared/chainIds";

const abi = ethers.AbiCoder.defaultAbiCoder();

let instance: IgnitionModuleResultsTToEthersContracts<string, { 
    ZrSignImpl: NamedArtifactContractDeploymentFuture<"ZrSign">; 
    ZrProxy: NamedArtifactContractDeploymentFuture<"ZrProxy">; 
    ZrSignProxy: NamedArtifactContractAtFuture<"ZrSign">; 
}>;

describe("QSign chain config tests", function () {
    
    let accounts: Array<HardhatEthersSigner> | any;
    let regularAddress: HardhatEthersSigner;

    this.beforeAll(async() => {
        accounts = await ethers.getSigners();
        regularAddress = accounts[1];
    });

    this.beforeEach(async() => {
        instance = await loadFixture(ZrSignProxyFixture);
    });

    describe("wallet type configs", function () {

        const positiveCases = [
            {
                testName:   "BTC wallet type chain type",
                walletType: helpers.BTC_CHAIN_TYPE,
              },
              {
                testName:   "BTC Testnet wallet type chain type",
                walletType: helpers.BTC_TESTNET_CHAIN_TYPE,
              },
              {
                testName:   "EVM wallet type",
                walletType: helpers.EVM_CHAIN_TYPE,
              },
        ]

        for (let c of positiveCases) {
            it(`should add then remove wallet type support: ${c.testName}`, async function () { 
                const walletTypeIdPayload = abi.encode(
                    ["uint256", "uint256"],
                    [c.walletType.purpose, c.walletType.coinType]
                )

                const walletTypeId = ethers.keccak256(walletTypeIdPayload);
                
                const txAddConfig = await instance.ZrSignProxy.walletTypeIdConfig(
                    c.walletType.purpose,
                    c.walletType.coinType,
                    true
                );    
                
                expect(await instance.ZrSignProxy.isWalletTypeSupported(walletTypeId)).to.equal(true);
                await expect(txAddConfig).to.emit(instance.ZrSignProxy, "WalletTypeIdSupport")
                    .withArgs(c.walletType.purpose, c.walletType.coinType, walletTypeId, true);
                
                const txRemoveConfig = await instance.ZrSignProxy.walletTypeIdConfig(
                    c.walletType.purpose,
                    c.walletType.coinType,
                    false
                ); 

                expect(await instance.ZrSignProxy.isWalletTypeSupported(walletTypeId)).to.equal(false);
                await expect(txRemoveConfig).to.emit(instance.ZrSignProxy, "WalletTypeIdSupport")
                    .withArgs(c.walletType.purpose, c.walletType.coinType, walletTypeId, false);
            });
        }

        it("should not config wallet type from account without appropriate role", async () => { 
            const wt = helpers.BTC_CHAIN_TYPE;

            await expect(instance.ZrSignProxy.connect(regularAddress).walletTypeIdConfig(
                wt.purpose,
                wt.coinType,
                true
            )).to.be.revertedWithCustomError(instance.ZrSignProxy, "AccessControlUnauthorizedAccount")
                .withArgs(regularAddress, roles.DEFAULT_ADMIN_ROLE);
        });

        it("should not allow support for already supported wallet type", async () => {
            const wt = helpers.BTC_CHAIN_TYPE;
            const walletTypeIdPayload = abi.encode(
                ["uint256", "uint256"],
                [wt.purpose, wt.coinType]
            )

            const walletTypeId = ethers.keccak256(walletTypeIdPayload);
            
            const txAddConfig = await instance.ZrSignProxy.walletTypeIdConfig(
                wt.purpose, wt.coinType, true
            );    
            
            expect(await instance.ZrSignProxy.isWalletTypeSupported(walletTypeId)).to.equal(true);
            await expect(txAddConfig).to.emit(instance.ZrSignProxy, "WalletTypeIdSupport")
                .withArgs(wt.purpose, wt.coinType, walletTypeId, true);
            
            await expect(instance.ZrSignProxy.walletTypeIdConfig(
                wt.purpose, wt.coinType, true
            )).to.be.revertedWithCustomError(instance.ZrSignProxy, "WalletTypeAlreadySupported")
                .withArgs(walletTypeId);
        });

        it("should not remove support for non supported wallet type", async () => {
            const wt = helpers.BTC_CHAIN_TYPE;
            const walletTypeIdPayload = abi.encode(
                ["uint256", "uint256"],
                [wt.purpose, wt.coinType]
            )

            const walletTypeId = ethers.keccak256(walletTypeIdPayload);

            await expect(instance.ZrSignProxy.walletTypeIdConfig(
                wt.purpose, wt.coinType, false
            )).to.be.revertedWithCustomError(instance.ZrSignProxy, "WalletTypeNotSupported")
                .withArgs(walletTypeId);
        });
    });

    describe("chain Id type configs", function () {

        let positiveTestCases = [
            {
              testName:     "BTC chain id",
              walletType:   helpers.BTC_CHAIN_TYPE,
              caip:         chainIds.BTC_TESTNET_CAIP,
              chainId:      chainIds.BTC_TESTNET_CHAIN_ID,
            },
            {
              testName:     "GOERLI chain id",
              walletType:   helpers.EVM_CHAIN_TYPE,
              caip:         chainIds.ETH_GOERLI_CAIP,
              chainId:      chainIds.ETH_GOERLI_CHAIN_ID,
            },
            {
              testName:     "ETH chain id",
              walletType:   helpers.EVM_CHAIN_TYPE,
              caip:         chainIds.ETH_MAINNET_CAIP,
              chainId:      chainIds.ETH_MAINNET_CHAIN_ID,
            },
            {
              testName:     "MUMBAI chain id",
              walletType:   helpers.EVM_CHAIN_TYPE,
              caip:         chainIds.POLYGON_MUMBAI_CAIP,
              chainId:      chainIds.POLYGON_MUMBAI_CHAIN_ID,
            },
        ];

        for (let c of positiveTestCases) {
            it(`should add then remove chain ID support: ${c.testName}`, async () => {
                const walletTypeIdPayload = abi.encode(
                    ["uint256", "uint256"],
                    [c.walletType.purpose, c.walletType.coinType]
                )

                const walletTypeId = ethers.keccak256(walletTypeIdPayload);
                
                await instance.ZrSignProxy.walletTypeIdConfig(
                    c.walletType.purpose,
                    c.walletType.coinType,
                    true
                );  

                await expect(
                    instance.ZrSignProxy.chainIdConfig(walletTypeId, c.caip, true)
                ).to.emit(instance.ZrSignProxy, "ChainIdSupport").withArgs(
                    walletTypeId, c.chainId, c.caip, true
                )
                expect(await instance.ZrSignProxy.isChainIdSupported(walletTypeId, c.chainId)).to.equal(true);

                await expect(
                    instance.ZrSignProxy.chainIdConfig(walletTypeId, c.caip, false)
                ).to.emit(instance.ZrSignProxy, "ChainIdSupport").withArgs(
                    walletTypeId, c.chainId, c.caip, false
                );
                expect(await instance.ZrSignProxy.isChainIdSupported(walletTypeId, c.chainId)).to.equal(false);
            });
        };

        it("should not set chain id from account without appropriate role", async () => { 
            const wt = helpers.EVM_CHAIN_TYPE;
            const caip = chainIds.ETH_MAINNET_CAIP;
            const walletTypeIdPayload = abi.encode(
                ["uint256", "uint256"],
                [wt.purpose, wt.coinType]
            )
            const walletTypeId = ethers.keccak256(walletTypeIdPayload);

            await instance.ZrSignProxy.walletTypeIdConfig(
                wt.purpose,
                wt.coinType,
                true
            );

            await expect(
                instance.ZrSignProxy.connect(regularAddress).chainIdConfig(walletTypeId, caip, true)
            ).to.be.revertedWithCustomError(instance.ZrSignProxy, "AccessControlUnauthorizedAccount")
                .withArgs(regularAddress, roles.DEFAULT_ADMIN_ROLE);
        });

        it("should not allow support for already supported chain id", async () => {
            const wt = helpers.EVM_CHAIN_TYPE;
            const caip = chainIds.ETH_MAINNET_CAIP;
            const chainId = chainIds.ETH_MAINNET_CHAIN_ID;
            const walletTypeIdPayload = abi.encode(
                ["uint256", "uint256"],
                [wt.purpose, wt.coinType]
            )

            const walletTypeId = ethers.keccak256(walletTypeIdPayload);
            
            await instance.ZrSignProxy.walletTypeIdConfig(
                wt.purpose, wt.coinType, true
            );    

            await instance.ZrSignProxy.chainIdConfig(walletTypeId, caip, true);
            await expect(
                instance.ZrSignProxy.chainIdConfig(walletTypeId, caip, true)
            ).to.be.revertedWithCustomError(instance.ZrSignProxy, "ChainIdAlreadySupported")
                .withArgs(walletTypeId, chainId);
        });

        it("should not remove support for non supported chain id", async () => { 
            const wt = helpers.EVM_CHAIN_TYPE;
            const caip = chainIds.ETH_MAINNET_CAIP;
            const chainId = chainIds.ETH_MAINNET_CHAIN_ID;
            const walletTypeIdPayload = abi.encode(
                ["uint256", "uint256"],
                [wt.purpose, wt.coinType]
            )

            const walletTypeId = ethers.keccak256(walletTypeIdPayload);
            
            await instance.ZrSignProxy.walletTypeIdConfig(
                wt.purpose, wt.coinType, true
            );    

            await expect(
                instance.ZrSignProxy.chainIdConfig(walletTypeId, caip, false)
            ).to.be.revertedWithCustomError(instance.ZrSignProxy, "ChainIdNotSupported")
                .withArgs(walletTypeId, chainId);
        });

        it("should not allow chain id support for non supported wallet type", async () => {
            const wt = helpers.EVM_CHAIN_TYPE;
            const caip = chainIds.ETH_MAINNET_CAIP;
            const walletTypeIdPayload = abi.encode(
                ["uint256", "uint256"],
                [wt.purpose, wt.coinType]
            )

            const walletTypeId = ethers.keccak256(walletTypeIdPayload);
            
            await expect(
                instance.ZrSignProxy.chainIdConfig(walletTypeId, caip, true)
            ).to.be.revertedWithCustomError(instance.ZrSignProxy, "WalletTypeNotSupported")
                .withArgs(walletTypeId);
        });
    });

});