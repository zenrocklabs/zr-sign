const { assert } = require("chai");
const helpers = require("./helpers");
const RLP = require("rlp");

contract("ZrSign integration tests", (accounts) => {
  const owner = accounts[0];
  const tokenomicsAddress = accounts[8];
  const proxyAdmin = accounts[9];
  const regularAddress = accounts[1];
  const regularAddress1 = accounts[7];
  const ovmAddress = accounts[2];
  const FAKE_EVM_MPC_ADDRESS = accounts[8];
  const FAKE_BTC_TESTNET_MPC_ADDRESS = "mqkWyJnZk7W4w36LVApASLv3SaCgZ1eaua";
  const zeroAddress = "0x0000000000000000000000000000000000000000";

  const IS_HASH_MASK = 1 << 0; // 0b0001
  const IS_DATA_MASK = 1 << 1; // 0b0010
  const IS_TX_MASK = 1 << 2; // 0b0100;

  let instances;

  before(async () => {
    instances = await helpers.initZrSignWithProxy(proxyAdmin, owner, tokenomicsAddress);
  });

  describe("setup fee", async () => {
    const positiveSetupBaseFeeTests = [
      {
        testName: "setup base fee",
        baseFee: web3.utils.toWei("30", "gwei"),
        caller: tokenomicsAddress,
      },
      {
        testName: "change base fee",
        baseFee: web3.utils.toWei("80", "gwei"),
        caller: tokenomicsAddress,
      },
    ];

    for (const c of positiveSetupBaseFeeTests) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        let oldFee;
        let updatedFee;
        let tx;

        // When
        oldFee = await helpers.getBaseFee(instances.proxied);
        tx = await helpers.setupBaseFee(c.baseFee, c.caller, instances.proxied);
        updatedFee = await helpers.getBaseFee(instances.proxied);

        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.checkBaseFeeEvent(tx.receipt.logs[0], oldFee, c.baseFee);
        assert.equal(
          updatedFee,
          c.baseFee,
          `Contract state not updated correctly. Transaction: ${tx.tx}`,
        );
      });
    }

    const positiveSetupNetworkFeeTests = [
      {
        testName: "setup network fee",
        networkFee: web3.utils.toWei("6", "wei"),
        caller: tokenomicsAddress,
      },
      {
        testName: "change network fee",
        networkFee: web3.utils.toWei("4", "wei"),
        caller: tokenomicsAddress,
      },
    ];

    for (const c of positiveSetupNetworkFeeTests) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        let oldFee;
        let updatedFee;
        let tx;

        // When
        oldFee = await helpers.getNetworkFee(instances.proxied);
        tx = await helpers.setupNetworkFee(c.networkFee, c.caller, instances.proxied);
        updatedFee = await helpers.getNetworkFee(instances.proxied);
        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.checkNetworkFeeEvent(tx.receipt.logs[0], oldFee, c.networkFee);
        assert.equal(
          updatedFee,
          c.networkFee,
          `Contract state not updated correctly. Transaction: ${tx.tx}`,
        );
      });
    }
  });

  describe("access control", async () => {
    const positiveAccessControlTests = [
      {
        testName: "grant OVM address to OVM role",
        role: helpers.MPC_ROLE,
        account: ovmAddress,
        caller: owner,
      },
      {
        testName: "grant regular address to OVM role",
        role: helpers.MPC_ROLE,
        account: regularAddress,
        caller: owner,
      },
      {
        testName: "grant regular address 1 to OVM role",
        role: helpers.MPC_ROLE,
        account: regularAddress1,
        caller: owner,
      },
    ];

    for (const c of positiveAccessControlTests) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        let hasRoleBefore;
        let hasRoleAfter;
        let tx;

        // When
        hasRoleBefore = await helpers.hasRole(c.role, c.account, instances.proxied);
        tx = await helpers.grantRole(c.role, c.account, c.caller, instances.proxied);
        hasRoleAfter = await helpers.hasRole(c.role, c.account, instances.proxied);

        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.checkGrandRoleEvent(tx.receipt.logs[0], c.role, c.account, c.caller);
        assert.notEqual(
          hasRoleBefore,
          hasRoleAfter,
          `Contract state not updated correctly. Role ${c.role} was not assigned to account ${c.account}. Transaction: ${tx.tx}`,
        );
      });
    }

    it("should revoke regular address OVM role", async () => {
      // Given
      let hasRoleBefore;
      let hasRoleAfter;
      let tx;

      // When
      hasRoleBefore = await helpers.hasRole(
        helpers.MPC_ROLE,
        regularAddress,
        instances.proxied,
      );
      tx = await helpers.revokeRole(helpers.MPC_ROLE, regularAddress, owner, instances.proxied);
      hasRoleAfter = await helpers.hasRole(helpers.MPC_ROLE, regularAddress, instances.proxied);

      // Then
      await helpers.expectTXSuccess(tx);
      await helpers.checkRevokeRoleEvent(
        tx.receipt.logs[0],
        helpers.MPC_ROLE,
        regularAddress,
        owner,
      );
      assert.notEqual(
        hasRoleBefore,
        hasRoleAfter,
        `Contract state not updated correctly. Role ${helpers.MPC_ROLE} was not revoked from account ${regularAddress}. Transaction: ${tx.tx}`,
      );
    });

    it("should not renounce OVM role if account not sender", async () => {
      // Given
      const customError = {
        name: "AccessControlBadConfirmation",
        params: [],
        instance: instances.proxied,
      };
      let hasRoleBefore;
      let hasRoleAfter;
      let tx;

      // When
      hasRoleBefore = await helpers.hasRole(
        helpers.MPC_ROLE,
        regularAddress1,
        instances.proxied,
      );
      tx = helpers.renounceRole(
        helpers.MPC_ROLE,
        regularAddress1,
        regularAddress,
        instances.proxied,
      );
      hasRoleAfter = await helpers.hasRole(
        helpers.MPC_ROLE,
        regularAddress1,
        instances.proxied,
      );

      // Then
      await helpers.expectRevert(tx, undefined, customError);
      assert.equal(
        hasRoleBefore,
        hasRoleAfter,
        `Contract state not updated correctly. Role ${helpers.MPC_ROLE} was revoked from account ${regularAddress}. Transaction: ${tx.tx}`,
      );
    });

    it("should renounce OVM role", async () => {
      // Given
      let hasRoleBefore;
      let hasRoleAfter;
      let tx;

      // When
      hasRoleBefore = await helpers.hasRole(
        helpers.MPC_ROLE,
        regularAddress1,
        instances.proxied,
      );
      tx = await helpers.renounceRole(
        helpers.MPC_ROLE,
        regularAddress1,
        regularAddress1,
        instances.proxied,
      );
      hasRoleAfter = await helpers.hasRole(
        helpers.MPC_ROLE,
        regularAddress1,
        instances.proxied,
      );

      // Then
      await helpers.expectTXSuccess(tx);
      await helpers.checkRevokeRoleEvent(
        tx.receipt.logs[0],
        helpers.MPC_ROLE,
        regularAddress1,
        regularAddress1,
      );
      assert.notEqual(
        hasRoleBefore,
        hasRoleAfter,
        `Contract state not updated correctly. Role ${helpers.MPC_ROLE} was not revoked from account ${regularAddress}. Transaction: ${tx.tx}`,
      );
    });

    const negativeAccessControlTests = [
      {
        testName: "grant role if has not admin role",
        adminRole: helpers.DEFAULT_ADMIN_ROLE,
        role: helpers.MPC_ROLE,
        account: ovmAddress,
        caller: regularAddress,
      },
      {
        testName: "revoke role if has not admin role",
        adminRole: helpers.DEFAULT_ADMIN_ROLE,
        role: helpers.MPC_ROLE,
        account: regularAddress,
        caller: regularAddress,
      },
    ];

    for (const c of negativeAccessControlTests) {
      it(`shoud not ${c.testName}`, async () => {
        // Given
        const customError = {
          name: "AccessControlUnauthorizedAccount",
          params: [c.caller, c.adminRole],
          instance: instances.proxied,
        };

        let hasRoleBefore;
        let hasRoleAfter;
        let tx;

        // When
        hasRoleBefore = await helpers.hasRole(c.role, c.account, instances.proxied);
        tx = helpers.grantRole(c.role, c.account, c.caller, instances.proxied);
        hasRoleAfter = await helpers.hasRole(c.role, c.account, instances.proxied);

        // Then
        await helpers.expectRevert(tx, undefined, customError);
        assert.equal(
          hasRoleBefore,
          hasRoleAfter,
          `Contract state not updated correctly. Role ${c.role} was assigned to account ${c.account}. Transaction: ${tx.tx}`,
        );
      });
    }
  });

  describe("wallet type config tests", async () => {
    const supportChainTypePositiveTestCases = [
      {
        testName: "support BTC wallet type chain type",
        walletType: helpers.BTC_CHAIN_TYPE,
        support: true,
        caller: owner,
      },
      {
        testName: "support BTC Testnet wallet type chain type",
        walletType: helpers.BTC_TESTNET_CHAIN_TYPE,
        support: true,
        caller: owner,
      },
      {
        testName: "support EVM wallet type",
        walletType: helpers.EVM_CHAIN_TYPE,
        support: true,
        caller: owner,
      },
    ];

    for (const c of supportChainTypePositiveTestCases) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        const walletTypeIdPayload = web3.eth.abi.encodeParameters(
          ["uint256", "uint256"],
          [c.walletType.purpose, c.walletType.coinType],
        );
        const walletTypeId = web3.utils.keccak256(walletTypeIdPayload);
        let tx;
        // When
        tx = await helpers.walletTypeIdConfig(
          c.walletType.purpose,
          c.walletType.coinType,
          c.support,
          c.caller,
          instances.proxied,
        );
        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.assertWalletTypeSupport(walletTypeId, instances.proxied, c.support);
        await helpers.checkWalletTypeConfigEvent(
          tx.receipt.logs[0],
          c.walletType.purpose,
          c.walletType.coinType,
          walletTypeId,
          c.support,
        );
      });
    }

    const removeSupportChainTypePositiveTestCases = [
      {
        testName: "remove support BTC_MAINNET wallet type",
        walletType: helpers.BTC_CHAIN_TYPE,
        support: false,
        caller: owner,
      },
    ];

    for (const c of removeSupportChainTypePositiveTestCases) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        let tx;
        const walletTypeIdPayload = web3.eth.abi.encodeParameters(
          ["uint256", "uint256"],
          [c.walletType.purpose, c.walletType.coinType],
        );
        const walletTypeId = web3.utils.keccak256(walletTypeIdPayload);
        // When
        supportedBefore = await helpers.isWalletTypeSupported(walletTypeId, instances.proxied);
        tx = await helpers.walletTypeIdConfig(
          c.walletType.purpose,
          c.walletType.coinType,
          c.support,
          c.caller,
          instances.proxied,
        );
        supportedAfter = await helpers.isWalletTypeSupported(walletTypeId, instances.proxied);
        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.assertWalletTypeSupport(walletTypeId, instances.proxied);
        await helpers.checkWalletTypeConfigEvent(
          tx.receipt.logs[0],
          c.walletType.purpose,
          c.walletType.coinType,
          walletTypeId,
        );
        assert.notEqual(supportedBefore, supportedAfter);
      });
    }

    const supportChainTypeNegativeTestCases = [
      {
        testName: "config wallet type from account without role",
        walletType: helpers.BTC_TESTNET_CHAIN_TYPE,
        support: true,
        caller: regularAddress,
        customError: {
          name: "AccessControlUnauthorizedAccount",
          params: [regularAddress, helpers.DEFAULT_ADMIN_ROLE],
          instance: undefined,
        },
      },
      {
        testName: "config support for already supported wallet type",
        walletType: helpers.BTC_TESTNET_CHAIN_TYPE,
        support: true,
        caller: owner,
        customError: {
          name: "WalletTypeAlreadySupported",
          params: [helpers.BTC_TESTNET_CHAIN_TYPE_HASH],
          instance: undefined,
        },
      },
      {
        testName: "config remove support for already non supported wallet type",
        walletType: helpers.BTC_CHAIN_TYPE,
        support: false,
        caller: owner,
        customError: {
          name: "WalletTypeNotSupported",
          params: [helpers.BTC_CHAIN_TYPE_HASH],
          instance: undefined,
        },
      },
    ];

    for (const c of supportChainTypeNegativeTestCases) {
      it(`shoud not ${c.testName}`, async () => {
        // Given
        const walletTypeIdPayload = web3.eth.abi.encodeParameters(
          ["uint256", "uint256"],
          [c.walletType.purpose, c.walletType.coinType],
        );
        const walletTypeId = web3.utils.keccak256(walletTypeIdPayload);
        let tx;
        let supportedBefore;
        let supportedAfter;
        // When
        supportedBefore = await helpers.isWalletTypeSupported(walletTypeId, instances.proxied);
        tx = helpers.walletTypeIdConfig(
          c.walletType.purpose,
          c.walletType.coinType,
          c.support,
          c.caller,
          instances.proxied,
        );
        // Then
        if (c.customError) {
          c.customError.instance = instances.proxied;
        }
        await helpers.expectRevert(tx, c.expectedError, c.customError);
        supportedAfter = await helpers.isWalletTypeSupported(walletTypeId, instances.proxied);
        assert.equal(supportedBefore, supportedAfter);
      });
    }
  });

  describe("chain id config tests", async () => {
    const supportChainIdPositiveTestCases = [
      {
        testName: "support BTC Testnet chain id",
        walletType: helpers.BTC_TESTNET_CHAIN_TYPE,
        chainId: helpers.BTC_TESTNET_CHAIN_ID,
        caip: helpers.BTC_TESTNET_CAIP,
        support: true,
        caller: owner,
      },
      {
        testName: "support ETH chain id",
        walletType: helpers.EVM_CHAIN_TYPE,
        chainId: helpers.ETH_MAINNET_CHAIN_ID,
        caip: helpers.ETH_MAINNET_CAIP,
        support: true,
        caller: owner,
      },
      {
        testName: "support Goerli chain id",
        walletType: helpers.EVM_CHAIN_TYPE,
        chainId: helpers.ETH_GOERLI_CHAIN_ID,
        caip: helpers.ETH_GOERLI_CAIP,
        support: true,
        caller: owner,
      },
      {
        testName: "support Matic Mumbai chain id",
        walletType: helpers.EVM_CHAIN_TYPE,
        chainId: helpers.POLYGON_MUMBAI_CHAIN_ID,
        caip: helpers.POLYGON_MUMBAI_CAIP,
        support: true,
        caller: owner,
      },
    ];

    for (const c of supportChainIdPositiveTestCases) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        const walletTypeIdPayload = web3.eth.abi.encodeParameters(
          ["uint256", "uint256"],
          [c.walletType.purpose, c.walletType.coinType],
        );
        const walletTypeId = web3.utils.keccak256(walletTypeIdPayload);
        let tx;
        // When
        tx = await helpers.chainIdConfig(
          walletTypeId,
          c.caip,
          c.support,
          c.caller,
          instances.proxied,
        );
        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.assertChainIdSupport(
          walletTypeId,
          c.chainId,
          instances.proxied,
          c.support,
        );
        await helpers.checkChainIdConfigEvent(
          tx.receipt.logs[0],
          walletTypeId,
          c.chainId,
          c.caip,
          c.support,
        );
      });
    }

    const removeSupportChainIdPositiveTestCases = [
      {
        testName: "remove support BTC Testnet chain id",
        walletType: helpers.BTC_TESTNET_CHAIN_TYPE,
        chainId: helpers.BTC_TESTNET_CHAIN_ID,
        caip: helpers.BTC_TESTNET_CAIP,
        support: false,
        caller: owner,
      },
      {
        testName: "remove support ETH chain id",
        walletType: helpers.EVM_CHAIN_TYPE,
        chainId: helpers.ETH_MAINNET_CHAIN_ID,
        caip: helpers.ETH_MAINNET_CAIP,
        support: false,
        caller: owner,
      },
    ];

    for (const c of removeSupportChainIdPositiveTestCases) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        const walletTypeIdPayload = web3.eth.abi.encodeParameters(
          ["uint256", "uint256"],
          [c.walletType.purpose, c.walletType.coinType],
        );
        const walletTypeId = web3.utils.keccak256(walletTypeIdPayload);
        let tx;
        // When
        tx = await helpers.chainIdConfig(
          walletTypeId,
          c.caip,
          c.support,
          c.caller,
          instances.proxied,
        );
        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.assertChainIdSupport(
          walletTypeId,
          c.chainId,
          instances.proxied,
          c.support,
        );
        await helpers.checkChainIdConfigEvent(
          tx.receipt.logs[0],
          walletTypeId,
          c.chainId,
          c.caip,
          c.support,
        );
      });
    }
  });

  describe("request public key", async () => {
    const requestPublicKeyPositiveTestCases = [
      {
        testName: "request public key for BTC TESTNET",
        walletType: helpers.BTC_TESTNET_CHAIN_TYPE,
        caller: regularAddress,
        fee: web3.utils.toWei("80", "gwei"),
      },
      {
        testName: "request public key for EVM",
        walletType: helpers.EVM_CHAIN_TYPE,
        caller: regularAddress,
        fee: web3.utils.toWei("80", "gwei"),
      },
    ];

    for (const c of requestPublicKeyPositiveTestCases) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        const wt = c.walletType;
        const walletTypeIdPayload = web3.eth.abi.encodeParameters(
          ["uint256", "uint256"],
          [wt.purpose, wt.coinType],
        );
        const walletTypeId = web3.utils.keccak256(walletTypeIdPayload);
        let wallets;
        let tx;
        // When
        wallets = await helpers.getZrKeys(walletTypeId, c.caller, instances.proxied);

        tx = await helpers.zrKeyReq(walletTypeId, c.fee, c.caller, instances.proxied);
        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.checkZrKeyReqEvent(
          tx.receipt.logs[0],
          walletTypeId,
          regularAddress,
          wallets.length,
        );
      });
    }

    const negativeRequestPublicKeyTestCases = [
      {
        testName: "be able to request for unsupported walletType",
        walletTypeId: helpers.UNSUPPORTED_CHAIN_TYPE_HASH,
        caller: regularAddress,
        fee: web3.utils.toWei("80", "gwei"),
        customError: {
          name: "WalletTypeNotSupported",
          params: [helpers.UNSUPPORTED_CHAIN_TYPE_HASH],
          instance: undefined,
        },
      },
      {
        testName: "be able to request with less fee",
        walletTypeId: helpers.EVM_CHAIN_TYPE_HASH,
        caller: regularAddress,
        fee: web3.utils.toWei("30", "gwei"),
        customError: {
          name: "InsufficientFee",
          params: [web3.utils.toWei("80", "gwei"), web3.utils.toWei("30", "gwei")],
          instance: undefined,
        },
      },
    ];

    for (const c of negativeRequestPublicKeyTestCases) {
      it(`shoud not ${c.testName}`, async () => {
        // Given
        let tx;
        let walletsBefore;
        let walletsAfter;

        // When
        walletsBefore = await helpers.getZrKeys(c.walletTypeId, c.caller, instances.proxied);

        tx = helpers.zrKeyReq(c.walletTypeId, c.fee, c.caller, instances.proxied);
        if (c.customError) {
          c.customError.instance = instances.proxied;
        }
        // Then
        await helpers.expectRevert(tx, c.expectedError, c.customError);
        walletsAfter = await helpers.getZrKeys(c.walletTypeId, c.caller, instances.proxied);
        assert.deepEqual(walletsAfter, walletsBefore);
      });
    }
  });

  describe("resolve public key", async () => {
    const resolvePublicKeyPositiveTestCases = [
      {
        testName: "resolve public key for BTC TESTNET",
        walletType: helpers.BTC_TESTNET_CHAIN_TYPE,
        owner: regularAddress,
        walletIndex: 0,
        publicKey: FAKE_BTC_TESTNET_MPC_ADDRESS,
        caller: ovmAddress,
      },
      {
        testName: "resolve public key for EVM",
        walletType: helpers.EVM_CHAIN_TYPE,
        owner: regularAddress,
        walletIndex: 0,
        publicKey: FAKE_EVM_MPC_ADDRESS,
        caller: ovmAddress,
      },
    ];

    for (const c of resolvePublicKeyPositiveTestCases) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        const wt = c.walletType;
        const walletTypeIdPayload = web3.eth.abi.encodeParameters(
          ["uint256", "uint256"],
          [wt.purpose, wt.coinType],
        );
        const walletTypeId = web3.utils.keccak256(walletTypeIdPayload);

        let walletsBefore;
        let walletsAfter;
        let tx;
        // When
        walletsBefore = await helpers.getZrKeys(walletTypeId, c.owner, instances.proxied);

        const chainId = await helpers.getSrcChainId(instances.proxied);
        const payload = web3.eth.abi.encodeParameters(
          ["bytes32", "bytes32", "address", "uint256", "string"],
          [chainId, walletTypeId, c.owner, c.walletIndex, c.publicKey],
        );
        const authSignature = await helpers.getAuthSignature(ovmAddress, payload);

        tx = await helpers.zrKeyRes(
          walletTypeId,
          c.owner,
          c.walletIndex,
          c.publicKey,
          authSignature,
          c.caller,
          instances.proxied,
        );
        walletsAfter = await helpers.getZrKeys(walletTypeId, c.owner, instances.proxied);
        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.checkZrKeyResEvent(
          tx.receipt.logs[0],
          walletTypeId,
          walletsBefore.length,
          c.owner,
          c.publicKey,
          c.caller,
        );
        assert.equal(
          walletsAfter.length,
          walletsBefore.length + 1,
          `public key not accepted by the contract at transaction: ${tx.tx}`,
        );
      });
    }

    const negativeResolvePublicKeyTestCases = [
      {
        testName: "be able to resolve for unsupported wallet type",
        walletType: helpers.UNSUPPORTED_CHAIN_TYPE,
        owner: regularAddress,
        walletIndex: 0,
        mpcAddress: FAKE_BTC_TESTNET_MPC_ADDRESS,
        caller: ovmAddress,
        customError: {
          name: "WalletTypeNotSupported",
          params: [helpers.UNSUPPORTED_CHAIN_TYPE_HASH],
          instance: undefined,
        },
      },
      {
        testName: "be able to resolve zero address",
        walletType: helpers.BTC_TESTNET_CHAIN_TYPE,
        owner: zeroAddress,
        walletIndex: 0,
        mpcAddress: FAKE_EVM_MPC_ADDRESS,
        caller: ovmAddress,
        customError: {
          name: "OwnableInvalidOwner",
          params: [zeroAddress],
          instance: undefined,
        },
      },
      {
        testName: "be able to resolve with incorrect public key",
        walletType: helpers.EVM_CHAIN_TYPE,
        owner: regularAddress,
        walletIndex: 0,
        mpcAddress: "",
        caller: ovmAddress,
        customError: {
          name: "InvalidPublicKeyLength",
          params: [5, 0],
          instance: undefined,
        },
      },
      {
        testName: "be able to resolve without ovm role",
        walletType: helpers.EVM_CHAIN_TYPE,
        owner: regularAddress,
        walletIndex: 0,
        mpcAddress: FAKE_EVM_MPC_ADDRESS,
        caller: owner,
        customError: {
          name: "AccessControlUnauthorizedAccount",
          params: [owner, helpers.MPC_ROLE],
          instance: undefined,
        },
      },
      {
        testName: "be able to resolve with inccorect walletIndex",
        walletType: helpers.EVM_CHAIN_TYPE,
        owner: regularAddress,
        walletIndex: 6,
        mpcAddress: FAKE_EVM_MPC_ADDRESS,
        caller: ovmAddress,
        customError: {
          name: "IncorrectWalletIndex",
          params: [1, 6],
          instance: undefined,
        },
      },
      {
        testName: "be able to resolve with already resolved public key index",
        walletType: helpers.EVM_CHAIN_TYPE,
        owner: regularAddress,
        walletIndex: 0,
        mpcAddress: FAKE_EVM_MPC_ADDRESS,
        caller: ovmAddress,
        customError: {
          name: "IncorrectWalletIndex",
          params: [1, 0],
          instance: undefined,
        },
      },
    ];

    for (const c of negativeResolvePublicKeyTestCases) {
      it(`shoud not ${c.testName}`, async () => {
        // Given
        const wt = c.walletType;
        const walletTypeIdPayload = web3.eth.abi.encodeParameters(
          ["uint256", "uint256"],
          [wt.purpose, wt.coinType],
        );
        const walletTypeId = web3.utils.keccak256(walletTypeIdPayload);

        let tx;
        let walletsBefore;
        let walletsAfter;
        // When
        walletsBefore = await helpers.getZrKeys(walletTypeId, c.owner, instances.proxied);
        const chainId = await helpers.getSrcChainId(instances.proxied);
        const payload = web3.eth.abi.encodeParameters(
          ["bytes32", "bytes32", "address", "uint256", "string"],
          [chainId, walletTypeId, c.owner, c.walletIndex, c.mpcAddress],
        );
        const authSignature = await helpers.getAuthSignature(c.caller, payload);

        tx = helpers.zrKeyRes(
          walletTypeId,
          c.owner,
          c.walletIndex,
          c.mpcAddress,
          authSignature,
          c.caller,
          instances.proxied,
        );

        if (c.customError) {
          c.customError.instance = instances.proxied;
        }
        // Then
        await helpers.expectRevert(tx, c.expectedError, c.customError);

        walletsAfter = await helpers.getZrKeys(walletTypeId, c.owner, instances.proxied);
        assert.equal(walletsBefore.length, walletsAfter.length);
      });
    }
  });

  describe("request signature for hash", async () => {
    const requestSignaturePositiveTestCases = [
      {
        testName: "request signature for payload hash without broadcast",
        walletTypeId: helpers.EVM_CHAIN_TYPE_HASH,
        traceId: BigInt(1),
        walletIndex: 0,
        baseFee: web3.utils.toWei("80", "gwei"),
        networkFee: web3.utils.toWei("4", "wei"),
        caller: regularAddress,
        flag: IS_HASH_MASK,
        broadcast: false,
        dstChainId: helpers.ETH_GOERLI_CHAIN_ID,
      },
    ];
    for (const c of requestSignaturePositiveTestCases) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        let tx;
        // When
        const nonce = await web3.eth.getTransactionCount(regularAddress, "latest"); // nonce starts counting from 0

        const t = {
          to: owner,
          value: 100,
          gas: 30000,
          maxFeePerGas: 1000000108,
          nonce,
          data: "0x",
        };

        const transaction = [
          web3.utils.toHex(t.nonce),
          web3.utils.toHex(t.maxFeePerGas),
          web3.utils.toHex(t.gasLimit),
          t.to,
          web3.utils.toHex(t.value),
          t.data,
          null,
          null,
          null,
        ];

        const payload = RLP.encode(transaction);
        const payloadHash = web3.utils.soliditySha3(payload);
        // Validate fee calculation
        const feesAreValid = await helpers.compareFees(
          c.baseFee,
          c.networkFee,
          instances.proxied,
        );
        assert.isTrue(feesAreValid, "Invalid fee calculation");

        const totalFee = await helpers.calculateTotalFeeFromInstance(
          payloadHash,
          instances.proxied,
        );

        tx = await helpers.zrSignHash(
          c.walletTypeId,
          c.walletIndex,
          c.dstChainId,
          payloadHash,
          totalFee,
          c.caller,
          instances.proxied,
        );

        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.checkZrSigRequestEvent(
          tx.receipt.logs[0],
          c.traceId,
          c.walletTypeId,
          c.caller,
          c.walletIndex,
          c.dstChainId,
          payloadHash,
          c.flag,
          c.broadcast,
        );
      });
    }

    const negativeRequestSignatureTests = [
      {
        testName: "be able to request for unsupported wallet type id",
        walletTypeId: helpers.UNSUPPORTED_CHAIN_TYPE_HASH,
        traceId: BigInt(1),
        walletIndex: 0,
        baseFee: web3.utils.toWei("80", "gwei"),
        networkFee: web3.utils.toWei("4", "wei"),
        caller: regularAddress,
        flag: IS_HASH_MASK,
        broadcast: false,
        dstChainId: helpers.ETH_GOERLI_CHAIN_ID,
        customError: {
          name: "WalletTypeNotSupported",
          params: [helpers.UNSUPPORTED_CHAIN_TYPE_HASH],
          instance: undefined,
        },
      },
      {
        testName: "be able to request with incorrect key index",
        walletTypeId: helpers.EVM_CHAIN_TYPE_HASH,
        traceId: BigInt(1),
        walletIndex: 50,
        baseFee: web3.utils.toWei("80", "gwei"),
        networkFee: web3.utils.toWei("4", "wei"),
        caller: regularAddress,
        flag: IS_HASH_MASK,
        broadcast: false,
        dstChainId: helpers.ETH_GOERLI_CHAIN_ID,
        expectedError: "Index out of bounds",
      },
      {
        testName: "be able to request with less fee",
        walletTypeId: helpers.EVM_CHAIN_TYPE_HASH,
        traceId: BigInt(1),
        walletIndex: 0,
        baseFee: web3.utils.toWei("70", "gwei"),
        networkFee: web3.utils.toWei("4", "wei"),
        caller: regularAddress,
        flag: IS_HASH_MASK,
        broadcast: false,
        dstChainId: helpers.ETH_GOERLI_CHAIN_ID,
        customError: {
          name: "InsufficientFee",
          params: [
            helpers.calculateTotalFee(
              "0xfd8eacaaa8baced8e10178879afa9da8064b4137cb794601906932078f3e86c5",
              web3.utils.toWei("80", "gwei"),
              web3.utils.toWei("4", "wei"),
            ),
            helpers.calculateTotalFee(
              "0xfd8eacaaa8baced8e10178879afa9da8064b4137cb794601906932078f3e86c5",
              web3.utils.toWei("70", "gwei"),
              web3.utils.toWei("4", "wei"),
            ),
          ],
          instance: undefined,
        },
      },
    ];

    for (const c of negativeRequestSignatureTests) {
      it(`shoud not ${c.testName}`, async () => {
        // Given
        let tx;

        // When
        const nonce = await web3.eth.getTransactionCount(regularAddress, "latest"); // nonce starts counting from 0

        const t = {
          to: owner,
          value: 100,
          gas: 30000,
          maxFeePerGas: 1000000108,
          nonce,
          data: "0x",
        };

        const transaction = [
          web3.utils.toHex(t.nonce),
          web3.utils.toHex(t.maxFeePerGas),
          web3.utils.toHex(t.gasLimit),
          t.to,
          web3.utils.toHex(t.value),
          t.data,
          null,
          null,
          null,
        ];

        const payload = RLP.encode(transaction);
        const payloadHash = web3.utils.soliditySha3(payload);
        const totalFee = await helpers.calculateTotalFee(payloadHash, c.baseFee, c.networkFee);
        tx = helpers.zrSignHash(
          c.walletTypeId,
          c.walletIndex,
          c.dstChainId,
          payloadHash,
          totalFee,
          c.caller,
          instances.proxied,
        );

        if (c.customError) {
          c.customError.instance = instances.proxied;
        }

        // Then
        await helpers.expectRevert(tx, c.expectedError, c.customError);
      });
    }
  });

  describe("resolve signature", async () => {
    const resolveSignaturePositiveTestCases = [
      {
        testName: "resolve signature for payload hash without broadcast",
        traceId: 1,
        caller: ovmAddress,
      },
    ];

    for (const c of resolveSignaturePositiveTestCases) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        const filter = {
          traceId: c.traceId,
        };

        let tx;
        // When
        const ev = await instances.proxied.getPastEvents("ZrSigRequest", {
          filter,
          fromBlock: 0,
          toBlock: "latest",
        });
        const event = ev[0];
        const payloadHash = event.args.payload;
        const signature = await web3.eth.sign(payloadHash, FAKE_EVM_MPC_ADDRESS);

        const chainId = await helpers.getSrcChainId(instances.proxied);
        const resPayload = web3.eth.abi.encodeParameters(
          ["bytes32", "uint256", "bytes", "bool"],
          [chainId, event.args.traceId, signature, event.args.broadcast],
        );
        const authSignature = await helpers.getAuthSignature(c.caller, resPayload);

        tx = await helpers.zrSignRes(
          event.args.traceId.toString(),
          signature,
          event.args.broadcast,
          authSignature,
          c.caller,
          instances.proxied,
        );

        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.checkZrSigResolveEvent(
          tx.receipt.logs[0],
          event.args.traceId,
          signature,
          event.args.broadcast,
        );
      });
    }

    const negativeResolveSignatureTests = [
      {
        testName: "be able to resolve without ovm role",
        traceId: BigInt(1),
        broadcast: false,
        caller: regularAddress,
        customError: {
          name: "UnauthorizedCaller",
          params: [regularAddress],
          instance: undefined,
        },
      },
    ];

    for (const c of negativeResolveSignatureTests) {
      it(`shoud not ${c.testName}`, async () => {
        // Given
        let tx;
        // When
        const nonce = await web3.eth.getTransactionCount(regularAddress, "latest"); // nonce starts counting from 0

        const t = {
          to: owner,
          value: 100,
          gas: 30000,
          maxFeePerGas: 1000000108,
          nonce,
          data: "0x",
        };

        const transaction = [
          web3.utils.toHex(t.nonce),
          web3.utils.toHex(t.maxFeePerGas),
          web3.utils.toHex(t.gasLimit),
          t.to,
          web3.utils.toHex(t.value),
          t.data,
          null,
          null,
          null,
        ];

        const payload = RLP.encode(transaction);
        const payloadHash = web3.utils.soliditySha3(payload);
        const signature = await web3.eth.sign(payloadHash, FAKE_EVM_MPC_ADDRESS);
        const evBefore = await instances.proxied.getPastEvents("ZrSigResolve");
        const chainId = await helpers.getSrcChainId(instances.proxied);
        const resPayload = web3.eth.abi.encodeParameters(
          ["bytes32", "uint256", "bytes", "bool"],
          [chainId, c.traceId, signature, c.broadcast],
        );
        const authSignature = await helpers.getAuthSignature(c.caller, resPayload);

        tx = helpers.zrSignRes(
          c.traceId,
          signature,
          c.broadcast,
          authSignature,
          c.caller,
          instances.proxied,
        );

        // Then
        await helpers.expectRevert(tx, c.expectedError);
        const evAfter = await instances.proxied.getPastEvents("ZrSigResolve");
        assert.deepEqual(evAfter, evBefore, "resolve signature event was emiited");
      });
    }
  });

  describe("withdraw fees", async () => {
    it("should withdraw fees with success", async () => {
      // Given
      let expectedBalanceAfter = 0;
      let balanceBefore;
      let balanceAfter;
      let tx;

      // When
      balanceBefore = await helpers.checkETHBalance(instances.proxied.address);
      tx = await helpers.withdrawFees(tokenomicsAddress, instances.proxied);
      balanceAfter = await helpers.checkETHBalance(instances.proxied.address);

      // Then
      await helpers.expectTXSuccess(tx);
      await helpers.checkFeeWithdrawEvent(tx.receipt.logs[0], tokenomicsAddress, balanceBefore);
      assert.equal(balanceAfter.toString(), expectedBalanceAfter.toString());
    });

    it("should not withdraw fees without tokenomics role", async () => {
      // Given
      const role = "0x08f48008958b82aad038b7223d0f8c74cce860619b44d53651dd4adcbe78162b";
      const customError = {
        name: "AccessControlUnauthorizedAccount",
        params: [regularAddress, role],
        instance: instances.proxied,
      };
      let balanceBefore;
      let balanceAfter;
      let tx;


      // When
      balanceBefore = await helpers.checkETHBalance(instances.proxied.address);
      tx = helpers.withdrawFees(regularAddress, instances.proxied);
      balanceAfter = await helpers.checkETHBalance(instances.proxied.address);

      // Then
      await helpers.expectRevert(tx, undefined, customError);
      assert.equal(balanceBefore.toString(), balanceAfter.toString());
    });
  });
});
