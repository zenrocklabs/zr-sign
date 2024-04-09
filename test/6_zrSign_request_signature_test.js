const { assert } = require("chai");
const helpers = require("./helpers");
const RLP = require("rlp");

contract("ZrSign request signature tests", (accounts) => {
  const owner = accounts[0];
  const tokenomicsAddress = accounts[8];
  const proxyAdmin = accounts[9];
  const regularAddress = accounts[1];
  const ovmAddress = accounts[2];
  const fakeMPCAddress = accounts[8];

  const supportedWalletTypeId = helpers.EVM_CHAIN_TYPE_HASH;
  const unsupportedWalletTypeId = helpers.UNSUPPORTED_CHAIN_TYPE_HASH;

  const IS_HASH_MASK = 1 << 0; // 0b0001
  const IS_DATA_MASK = 1 << 1; // 0b0010
  const IS_TX_MASK = 1 << 2; // 0b0100;

  const baseFee = web3.utils.toWei("80", "gwei");
  const networkFee = web3.utils.toWei("4", "wei");
  let instances;

  beforeEach(async () => {
    instances = await helpers.initZrSignWithProxy(proxyAdmin, owner, tokenomicsAddress, ovmAddress);
    await helpers.setupBaseFee(baseFee, tokenomicsAddress, instances.proxied);
    await helpers.setupNetworkFee(networkFee, tokenomicsAddress, instances.proxied);
    
    const pki = 0;

    const wt = helpers.EVM_CHAIN_TYPE;
    const walletTypeIdPayload = web3.eth.abi.encodeParameters(
      ["uint256", "uint256"],
      [wt.purpose, wt.coinType]
    );
    const walletTypeId = web3.utils.keccak256(walletTypeIdPayload);

    const support = true;
    const caller = owner;

    await helpers.walletTypeIdConfig(
      wt.purpose,
      wt.coinType,
      support,
      caller,
      instances.proxied
    );
    await helpers.chainIdConfig(
      walletTypeId,
      helpers.ETH_GOERLI_CAIP,
      support,
      caller,
      instances.proxied
    );
    
    const payload = web3.eth.abi.encodeParameters(['bytes32', 'address', 'uint256', 'string'], [supportedWalletTypeId, regularAddress, pki, fakeMPCAddress]);
    const payloadHash = web3.utils.soliditySha3(payload);
    const signature = await web3.eth.sign(payloadHash, ovmAddress);
    let vValue = parseInt(signature.slice(-2), 16); // Convert the last two hex characters to an integer
    if (vValue < 27) {
        vValue += 27;
    }
    // Convert vValue back to hex, ensure it is two characters long, and append to the rest of the signature
    const vHex = ("0" + vValue.toString(16)).slice(-2); // Ensures two characters
    const authSignature = signature.slice(0, -2) + vHex;

    await helpers.zrKeyRes(
      supportedWalletTypeId,
      regularAddress,
      pki,
      fakeMPCAddress,
      authSignature,
      ovmAddress,
      instances.proxied
    );
  });

  describe("positive tests", async () => {
    let positivePayloadHashTests = [
      {
        testName: "request signature for payload hash",
        walletTypeId: supportedWalletTypeId,
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

    for (let c of positivePayloadHashTests) {
      it(`shoud ${c.testName}`, async () => {
        //Given
        let tx;
        //When
        const nonce = await web3.eth.getTransactionCount(c.caller, "latest"); // nonce starts counting from 0

        const t = {
          to: owner,
          value: 100,
          gas: 30000,
          maxFeePerGas: 1000000108,
          nonce: nonce,
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
          instances.proxied
        );
        assert.isTrue(feesAreValid, "Invalid fee calculation");

        const totalFee = await helpers.calculateTotalFeeFromInstance(
          payloadHash,
          instances.proxied
        );

        tx = await helpers.zrSignHash(
          c.walletTypeId,
          c.walletIndex,
          c.dstChainId,
          payloadHash,
          totalFee,
          c.caller,
          instances.proxied
        );

        //Then
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
          c.broadcast
        );
      });
    }

    let positivePayloadTXTests = [
      {
        testName: "request signature for payload without broadcast",
        walletTypeId: supportedWalletTypeId,
        traceId: BigInt(1),
        walletIndex: 0,
        baseFee: web3.utils.toWei("80", "gwei"),
        networkFee: web3.utils.toWei("4", "wei"),
        caller: regularAddress,
        flag: IS_TX_MASK,
        broadcast: true,
        dstChainId: helpers.ETH_GOERLI_CHAIN_ID,
      },
      {
        testName: "request signature for payload with broadcast",
        walletTypeId: supportedWalletTypeId,
        traceId: BigInt(1),
        walletIndex: 0,
        baseFee: web3.utils.toWei("80", "gwei"),
        networkFee: web3.utils.toWei("4", "wei"),
        caller: regularAddress,
        flag: IS_TX_MASK,
        broadcast: true,
        dstChainId: helpers.ETH_GOERLI_CHAIN_ID,
      },
    ];

    for (let c of positivePayloadTXTests) {
      it(`shoud ${c.testName}`, async () => {
        //Given
        let tx;
        //When
        const nonce = await web3.eth.getTransactionCount(c.caller, "latest"); // nonce starts counting from 0

        const t = {
          to: owner,
          value: 100,
          gas: 30000,
          maxFeePerGas: 1000000108,
          nonce: nonce,
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

        // Validate fee calculation
        const feesAreValid = await helpers.compareFees(
          c.baseFee,
          c.networkFee,
          instances.proxied
        );
        assert.isTrue(feesAreValid, "Invalid fee calculation");

        const totalFee = await helpers.calculateTotalFeeFromInstance(
          payload,
          instances.proxied
        );

        tx = await helpers.zrSignTx(
          c.walletTypeId,
          c.walletIndex,
          c.dstChainId,
          payload,
          c.broadcast,
          totalFee,
          c.caller,
          instances.proxied
        );

        //Then
        await helpers.expectTXSuccess(tx);
        await helpers.checkZrSigRequestEvent(
          tx.receipt.logs[0],
          c.traceId,
          c.walletTypeId,
          c.caller,
          c.walletIndex,
          c.dstChainId,
          payload,
          c.flag,
          c.broadcast
        );
      });
    }
  });

  describe("negative tests", async () => {
    let negativeTests = [
      {
        testName: "be able to request for unsupported wallet type",
        walletTypeId: unsupportedWalletTypeId,
        traceId: BigInt(1),
        walletIndex: 0,
        baseFee: web3.utils.toWei("80", "gwei"),
        networkFee: web3.utils.toWei("4", "wei"),
        caller: regularAddress,
        flag: IS_HASH_MASK,
        dstChainId: helpers.ETH_GOERLI_CHAIN_ID,
        expectedError: "qs::walletTypeGuard:walletType not supported",
      },
      {
        testName: "be able to request for unsupported chain id",
        walletTypeId: supportedWalletTypeId,
        traceId: BigInt(1),
        walletIndex: 0,
        baseFee: web3.utils.toWei("80", "gwei"),
        networkFee: web3.utils.toWei("4", "wei"),
        caller: regularAddress,
        flag: IS_HASH_MASK,
        dstChainId: helpers.UNSUPPORTED_CHAIN_ID,
        expectedError: "qs::chainIdGuard:chainId not supported",
      },
      {
        testName: "be able to request with incorrect key index",
        walletTypeId: supportedWalletTypeId,
        traceId: BigInt(1),
        walletIndex: 5,
        baseFee: web3.utils.toWei("80", "gwei"),
        networkFee: web3.utils.toWei("4", "wei"),
        caller: regularAddress,
        flag: IS_HASH_MASK,
        dstChainId: helpers.ETH_GOERLI_CHAIN_ID,
        expectedError: "Index out of bounds",
      },
      {
        testName: "be able to request with less fee",
        walletTypeId: supportedWalletTypeId,
        traceId: BigInt(1),
        walletIndex: 0,
        baseFee: web3.utils.toWei("80", "gwei"),
        networkFee: web3.utils.toWei("2", "wei"),
        caller: regularAddress,
        flag: IS_HASH_MASK,
        dstChainId: helpers.ETH_GOERLI_CHAIN_ID,
        expectedError: "qs::sigFee:msg.value should be greater",
      },
    ];

    for (let c of negativeTests) {
      it(`shoud not ${c.testName}`, async () => {
        //Given
        let tx;
        let wallets;

        //When
        const nonce = await web3.eth.getTransactionCount(
          regularAddress,
          "latest"
        ); // nonce starts counting from 0

        const t = {
          to: owner,
          value: 100,
          gas: 30000,
          maxFeePerGas: 1000000108,
          nonce: nonce,
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

        wallets = await helpers.getZrKeys(
          c.walletTypeId,
          c.caller,
          instances.proxied
        );

        const totalFee = await helpers.calculateTotalFee(
          payload,
          c.baseFee,
          c.networkFee
        );

        tx = helpers.zrSignHash(
          c.walletTypeId,
          c.walletIndex,
          c.dstChainId,
          payloadHash,
          totalFee,
          c.caller,
          instances.proxied
        );

        //Then
        await helpers.expectRevert(tx, c.expectedError, undefined);
      });
    }
  });
});
