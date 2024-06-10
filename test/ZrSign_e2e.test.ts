import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ZrSignProxyFixture } from "./shared/fixtures";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/src/signers"
import { IgnitionModuleResultsTToEthersContracts } from "@nomicfoundation/hardhat-ignition-ethers/dist/src/ethers-ignition-helper";
import { NamedArtifactContractDeploymentFuture, NamedArtifactContractAtFuture } from "@nomicfoundation/ignition-core";
import { ethers } from "hardhat";
import { expect } from "chai";
import * as roles from "./shared/roles";

type FeeTestCase = { 
    testName: string;
    fee: bigint; 
    feeType: "base" | "network"; 
    caller: HardhatEthersSigner;
}

type ACTestCase = {
    testName: string;
    role: string; 
    action: "grant" | "revoke" | "renounce";
    account: HardhatEthersSigner; 
    caller: HardhatEthersSigner;
    customError: { 
        name: string; 
        params: any; 
    } | null;
}

describe("ZrSign End to end tests", function () {

    let instance: IgnitionModuleResultsTToEthersContracts<string, { 
        ZrSignImpl: NamedArtifactContractDeploymentFuture<"ZrSign">; 
        ZrProxy: NamedArtifactContractDeploymentFuture<"ZrProxy">; 
        ZrSignProxy: NamedArtifactContractAtFuture<"ZrSign">; 
    }>;

    let accounts: Array<HardhatEthersSigner> | any;
    let owner: HardhatEthersSigner;
    let user: HardhatEthersSigner;
    let tokenomicsAcc: HardhatEthersSigner;
    let ovm: HardhatEthersSigner;

    this.beforeAll(async() => {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        user = accounts[1];
        ovm = accounts[2];
        tokenomicsAcc = accounts[8];

        instance = await loadFixture(ZrSignProxyFixture);
                
        await instance.ZrSignProxy.grantRole(roles.TOKENOMICS_ROLE, tokenomicsAcc.address);
        // await instance.ZrSignProxy.grantRole(roles.MPC_ROLE, ovm.address);

    });

    it("Fee tests", async () => {
        describe("Fee tests:", function () {
            let testCases: Array<FeeTestCase> = [
                {
                    testName: "set base fee",
                    fee: ethers.parseUnits("30", "gwei"),
                    feeType: "base",
                    caller: tokenomicsAcc
                },
                {
                    testName: "change base fee",
                    fee: ethers.parseUnits("80", "gwei"),
                    feeType: "base",
                    caller: tokenomicsAcc
                },
                {
                    testName: "set network fee",
                    fee: ethers.parseUnits("6", "wei"),
                    feeType: "network",
                    caller: tokenomicsAcc
                },
                {
                    testName: "change network fee",
                    fee: ethers.parseUnits("4", "wei"),
                    feeType: "network",
                    caller: tokenomicsAcc
                },

            ]

            for (let c of testCases) {
                it(`should ${c.testName}`, async () => {
                    let fee, updatedFee;
                    let tx;

                    switch(c.feeType) {
                        case "base":
                            fee = await instance.ZrSignProxy.getBaseFee();
                            tx = await instance.ZrSignProxy.connect(c.caller).setupBaseFee(c.fee);
                            updatedFee = await instance.ZrSignProxy.getBaseFee();
                            
                            await expect(tx).to.emit(instance.ZrSignProxy, "BaseFeeUpdate")
                            .withArgs(fee, updatedFee);
                            
                        case "network":
                            fee = await instance.ZrSignProxy.getNetworkFee();
                            tx = await instance.ZrSignProxy.connect(c.caller).setupNetworkFee(c.fee);
                            updatedFee = await instance.ZrSignProxy.getNetworkFee();
                            
                            await expect(tx).to.emit(instance.ZrSignProxy, "NetworkFeeUpdate")
                            .withArgs(fee, updatedFee);
                        default:
                            return;
                    }
                   

                    expect(updatedFee.toString()).to.equal(c.fee.toString());
                });
            }

        });
    });

    it("Access Control tests", async () => {
        describe("Access Control tests:", function () {
            let testCases: Array<ACTestCase> = [
                {
                    testName: "grant OVM address to OVM role",
                    role: roles.MPC_ROLE,
                    action: "grant",
                    account: ovm,
                    caller: owner,
                    customError: null
                },
                {
                    testName: "grant regular address to OVM role",
                    role: roles.MPC_ROLE,
                    action: "grant",
                    account: user,
                    caller: owner,
                    customError: null
                },
                {
                    testName: "renounce OVM role from regular address",
                    role: roles.MPC_ROLE,
                    action: "renounce",
                    account: user,
                    caller: user,
                    customError: null
                },
                {
                    testName: "not renounce OVM role if account is not sender",
                    role: roles.MPC_ROLE,
                    action: "renounce",
                    account: user,
                    caller: owner,
                    customError: {
                        name: "AccessControlBadConfirmation",
                        params: []
                    }
                },

            ]

            for (let c of testCases) {
                it(`should ${c.testName}`, async () => {
                    let hasRole, hasRoleAfter;
                    let tx;
                    
                    switch (c.action) {
                        case "grant":
                            hasRole = await instance.ZrSignProxy.hasRole(c.role, c.account.address);
                            tx = await instance.ZrSignProxy.grantRole(c.role, c.account.address)
                            hasRoleAfter = await instance.ZrSignProxy.hasRole(c.role, c.account.address);
        
                            await expect(tx).to.emit(instance.ZrSignProxy, "RoleGranted")
                                    .withArgs(c.role, c.account.address, c.caller);
                            
                            expect(hasRole).to.be.false;
                            expect(hasRoleAfter).to.be.true;

                            break;
                        case "revoke":

                            break;
                        case "renounce":
                            hasRole = await instance.ZrSignProxy.hasRole(c.role, c.account.address);
                            tx = instance.ZrSignProxy.connect(c.caller).renounceRole(c.role, c.account.address)
                            
                            if (c.customError != null) {
                                await expect(tx).to.revertedWithCustomError(instance.ZrSignProxy, c.customError.name);
                                
                            } else {
                                await expect(tx).to.emit(instance.ZrSignProxy, "RoleRevoked")
                                .withArgs(c.role, c.account.address, c.caller);
                                
                                hasRoleAfter = await instance.ZrSignProxy.hasRole(c.role, c.account.address);
                                
                                expect(hasRole).to.be.true;
                                expect(hasRoleAfter).to.be.false;
                            }

                            break;
                    }
                    
                    
                });
            }

        });
    });
});