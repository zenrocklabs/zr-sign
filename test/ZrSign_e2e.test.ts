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
    let feeAcc: HardhatEthersSigner;
    let ovm: HardhatEthersSigner;

    this.beforeAll(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        user = accounts[1];
        ovm = accounts[2];
        feeAcc = accounts[8];

        instance = await loadFixture(ZrSignProxyFixture);

        await instance.ZrSignProxy.grantRole(roles.FEE_ROLE, feeAcc.address);
        // await instance.ZrSßignProxy.grantRole(roles.MPC_ROLE, ovm.address);

    });

    it("Fee tests", async () => {
        describe("Fee tests:", function () {
            let testCases: Array<FeeTestCase> = [
                {
                    testName: "update MPC fee",
                    fee: ethers.parseUnits("30", "gwei"),
                    caller: feeAcc
                }
            ]

            for (let c of testCases) {
                it(`should ${c.testName}`, async () => {
                    let fee, updatedFee;
                    let tx;
                    fee = await instance.ZrSignProxy.getMPCFee();
                    tx = await instance.ZrSignProxy.connect(c.caller).updateMPCFee(c.fee);
                    updatedFee = await instance.ZrSignProxy.getMPCFee();

                    await expect(tx).to.emit(instance.ZrSignProxy, "MPCFeeUpdate")
                        .withArgs(fee, updatedFee);


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