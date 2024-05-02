const { assert } = require("chai");
const helpers = require("./helpers");
const RLP = require("rlp");

contract("ZrSign resolve signature tests", (accounts) => {
  const owner = accounts[0];
  const tokenomicsAddress = accounts[8];
  const proxyAdmin = accounts[9];
  const regularAddress = accounts[1];
  const ovmAddress = accounts[2];
  const fakeMPCAddress = accounts[8];

  const supportedWalletTypeId = helpers.EVM_CHAIN_TYPE_HASH;
  const unsupportedWalletTypeId = helpers.UNSUPPORTED_CHAIN_TYPE_HASH;

  const baseFee = web3.utils.toWei("80", "gwei");
  const networkFee = web3.utils.toWei("4", "wei");
  let instances;

  beforeEach(async () => {
    instances = await helpers.initZrSignWithProxy(
      proxyAdmin,
      owner,
      tokenomicsAddress,
      ovmAddress,
    );
    await helpers.setupBaseFee(baseFee, tokenomicsAddress, instances.proxied);
    await helpers.setupNetworkFee(networkFee, tokenomicsAddress, instances.proxied);

    const pki = 0;

    const wt = helpers.EVM_CHAIN_TYPE;
    const walletTypeIdPayload = web3.eth.abi.encodeParameters(
      ["uint256", "uint256"],
      [wt.purpose, wt.coinType],
    );
    const walletTypeId = web3.utils.keccak256(walletTypeIdPayload);

    const support = true;
    const caller = owner;

    await helpers.walletTypeIdConfig(
      wt.purpose,
      wt.coinType,
      support,
      caller,
      instances.proxied,
    );
    await helpers.chainIdConfig(
      walletTypeId,
      helpers.ETH_GOERLI_CAIP,
      support,
      caller,
      instances.proxied,
    );

    const chainId = await helpers.getSrcChainId(instances.proxied);
    const payload = web3.eth.abi.encodeParameters(
      ["bytes32", "bytes32", "address", "uint256", "string"],
      [chainId, supportedWalletTypeId, regularAddress, pki, fakeMPCAddress],
    );
    const authSignature = await helpers.getAuthSignature(ovmAddress, payload);

    await helpers.zrKeyRes(
      supportedWalletTypeId,
      regularAddress,
      pki,
      fakeMPCAddress,
      authSignature,
      ovmAddress,
      instances.proxied,
    );
  });

  describe("positive tests", async () => {
    const positivePayloadHashTests = [
      {
        testName: "resolve signature for payload hash without broadcast",
        walletTypeId: supportedWalletTypeId,
        owner: regularAddress,
        traceId: "0",
        walletIndex: "0",
        dstChainId: helpers.ETH_GOERLI_CHAIN_ID,
        broadcast: false,
        caller: ovmAddress,
      },
    ];
    for (const c of positivePayloadHashTests) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        let tx;

        // When
        const nonce = await web3.eth.getTransactionCount(c.owner, "latest"); // nonce starts counting from 0

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
        const signature = await web3.eth.sign(payloadHash, fakeMPCAddress);
        const chainId = await helpers.getSrcChainId(instances.proxied);
        const resPayload = web3.eth.abi.encodeParameters(
          ["bytes32", "uint256", "bytes", "bool"],
          [chainId, c.traceId, signature, c.broadcast],
        );
        const authSignature = await helpers.getAuthSignature(ovmAddress, resPayload);

        tx = await helpers.zrSignRes(
          c.traceId,
          signature,
          c.broadcast,
          authSignature,
          c.caller,
          instances.proxied,
        );
        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.checkZrSigResolveEvent(
          tx.receipt.logs[0],
          c.traceId,
          signature,
          c.broadcast,
        );
      });
    }

    const positivePayloadTests = [
      {
        testName: "resolve signature for payload hash without broadcast",
        walletTypeId: supportedWalletTypeId,
        owner: regularAddress,
        traceId: "0",
        walletIndex: "0",
        dstChainId: helpers.ETH_GOERLI_CHAIN_ID,
        broadcast: false,
        caller: ovmAddress,
      },
      {
        testName: "resolve signature for payload hash and broadcast",
        walletTypeId: supportedWalletTypeId,
        owner: regularAddress,
        traceId: "0",
        walletIndex: "0",
        dstChainId: helpers.ETH_GOERLI_CHAIN_ID,
        broadcast: true,
        caller: ovmAddress,
      },
    ];

    for (const c of positivePayloadTests) {
      it(`shoud ${c.testName}`, async () => {
        // Given
        let tx;

        // When
        const nonce = await web3.eth.getTransactionCount(c.owner, "latest"); // nonce starts counting from 0

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

        const payloadBytes = RLP.encode(transaction);
        const payload = `0x${RLP.utils.bytesToHex(payloadBytes)}`;
        const payloadHash = web3.utils.soliditySha3(payload);
        const signature = await web3.eth.sign(payloadHash, fakeMPCAddress);
        const chainId = await helpers.getSrcChainId(instances.proxied);
        const resPayload = web3.eth.abi.encodeParameters(
          ["bytes32", "uint256", "bytes", "bool"],
          [chainId, c.traceId, signature, c.broadcast],
        );
        const authSignature = await helpers.getAuthSignature(c.caller, resPayload);

        tx = await helpers.zrSignRes(
          c.traceId,
          signature,
          c.broadcast,
          authSignature,
          c.caller,
          instances.proxied,
        );

        // Then
        await helpers.expectTXSuccess(tx);
        await helpers.checkZrSigResolveEvent(
          tx.receipt.logs[0],
          c.traceId,
          signature,
          c.broadcast,
        );
      });
    }
  });

  describe("negative tests", async () => {
    const negativeTests = [
      {
        testName: "be able to resolve without ovm role",
        traceId: "0",
        broadcast: true,
        caller: regularAddress,
        customError: {
          name: "AccessControlUnauthorizedAccount",
          params: [regularAddress, helpers.MPC_ROLE],
          instance: undefined,
        },
      },
    ];

    for (const c of negativeTests) {
      it(`shoud not ${c.testName}`, async () => {
        // Given
        let tx;
        // When
        const nonce = await web3.eth.getTransactionCount(owner, "latest"); // nonce starts counting from 0

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
        const signature = await web3.eth.sign(payloadHash, fakeMPCAddress);
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

        c.customError.instance = instances.proxied;

        // Then
        await helpers.expectRevert(tx, undefined, c.customError);
      });
    }

    it(`shoud not be able to resolve signature with invalid signature`, async () => {
      // Given
      let tx;
      const customError = {
        name: "InvalidSignature",
        params: [2],
        instance: instances.proxied,
      };
      // When
      const nonce = await web3.eth.getTransactionCount(owner, "latest"); // nonce starts counting from 0

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
      const signature = await web3.eth.sign(payloadHash, fakeMPCAddress);
      const chainId = await helpers.getSrcChainId(instances.proxied);
      const resPayload = web3.eth.abi.encodeParameters(
        ["bytes32", "uint256", "bytes", "bool"],
        [chainId, 0, signature, true],
      );
      const authSignature = await helpers.getAuthSignature(ovmAddress, resPayload, -4);

      tx = helpers.zrSignRes(
        0,
        signature,
        true,
        authSignature,
        regularAddress,
        instances.proxied,
      );

      // Then
      await helpers.expectRevert(tx, undefined, customError);
    });

    it(`shoud not be able to resolve signature for the same data twice`, async () => {
      // Given
      let tx;

      // When
      const nonce = await web3.eth.getTransactionCount(owner, "latest"); // nonce starts counting from 0

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
      const signature = await web3.eth.sign(payloadHash, fakeMPCAddress);
      const chainId = await helpers.getSrcChainId(instances.proxied);
      const resPayload = web3.eth.abi.encodeParameters(
        ["bytes32", "uint256", "bytes", "bool"],
        [chainId, 1, signature, true],
      );

      const customError = {
        name: "AlreadyProcessed",
        params: [1],
        instance: instances.proxied,
      };

      const authSignature = await helpers.getAuthSignature(ovmAddress, resPayload);

      const txSuccess = await helpers.zrSignRes(
        1,
        signature,
        true,
        authSignature,
        ovmAddress,
        instances.proxied,
      );

      await helpers.expectTXSuccess(txSuccess);

      tx = helpers.zrSignRes(
        1,
        signature,
        true,
        authSignature,
        regularAddress,
        instances.proxied,
      );

      // Then
      await helpers.expectRevert(tx, undefined, customError);
    });
  });
});
