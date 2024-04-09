const { assert } = require("chai");
const helpers = require("./helpers");

contract("ZrSign resolve public key tests", (accounts) => {
  const owner = accounts[0];
  const tokenomicsAddress = accounts[8];
  const proxyAdmin = accounts[9];
  const regularAddress = accounts[1];
  const ovmAddress = accounts[2];
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const fakeMPCAddress = accounts[8];
  const supportedWalletTypeId = helpers.EVM_CHAIN_TYPE_HASH;
  const unsupportedWalletTypeId = helpers.UNSUPPORTED_CHAIN_TYPE_HASH;
  const baseFee = web3.utils.toWei("80", "gwei");
  const networkFee = web3.utils.toWei("4", "wei");
  let instances;

  beforeEach(async () => {
    instances = await helpers.initZrSignWithProxy(proxyAdmin, owner, tokenomicsAddress, ovmAddress);
    await helpers.setupBaseFee(baseFee, tokenomicsAddress, instances.proxied);
    await helpers.setupNetworkFee(networkFee, tokenomicsAddress, instances.proxied);
    
    const wt = helpers.EVM_CHAIN_TYPE;
    const support = true;
    const caller = owner;
    await helpers.walletTypeIdConfig(
      wt.purpose,
      wt.coinType,
      support,
      caller,
      instances.proxied
    );
  });

  describe("positive tests", async () => {
    it("shoud resolve public key for chain type", async () => {
      //Given
      let tx;
      let walletsBefore;
      let walletsAfter;

      //When
      walletsBefore = await helpers.getZrKeys(
        supportedWalletTypeId,
        regularAddress,
        instances.proxied
      );

      const walletIndex = walletsBefore.length
      const payload = web3.eth.abi.encodeParameters(['bytes32', 'address', 'uint256', 'string'], [supportedWalletTypeId, regularAddress, walletIndex, fakeMPCAddress]);
      const authSignature = await helpers.getAuthSignature(ovmAddress, payload);

      tx = await helpers.zrKeyRes(
        supportedWalletTypeId,
        regularAddress,
        walletIndex,
        fakeMPCAddress,
        authSignature,
        ovmAddress,
        instances.proxied
      );

      walletsAfter = await helpers.getZrKeys(
        supportedWalletTypeId,
        regularAddress,
        instances.proxied
      );

      //Then
      await helpers.expectTXSuccess(tx);
      await helpers.checkZrKeyResEvent(
        tx.receipt.logs[0],
        supportedWalletTypeId,
        walletsBefore.length,
        regularAddress,
        fakeMPCAddress,
        ovmAddress
      );
      assert.equal(walletsAfter.length, walletsBefore.length + 1);
    });
  });

  describe("negative tests", async () => {
    let negativeTests = [
      {
        testName: "be able to resolve for unsupported for wallet type",
        walletTypeId: unsupportedWalletTypeId,
        owner: regularAddress,
        mpcAddress: fakeMPCAddress,
        caller: ovmAddress,
        expectedError: "qs::walletTypeGuard:walletType not supported",
      },
      {
        testName: "be able to resolve zero address",
        walletTypeId: supportedWalletTypeId,
        owner: zeroAddress,
        mpcAddress: fakeMPCAddress,
        caller: ovmAddress,
        expectedError: "qs::ownerGuard:invalid owner address",
      },
      {
        testName: "be able to resolve with incorrect public key",
        walletTypeId: supportedWalletTypeId,
        owner: regularAddress,
        mpcAddress: "",
        caller: ovmAddress,
        expectedError: "qs::validatePublicKey:public key has an invalid length",
      },
      {
        testName: "be able to resolve without mpc role",
        walletTypeId: supportedWalletTypeId,
        owner: regularAddress,
        mpcAddress: fakeMPCAddress,
        caller: owner,
        expectedError: "qs::onlyMPC:caller not authorized",
      },
    ];

    for (let c of negativeTests) {
      it(`shoud not ${c.testName}`, async () => {
        //Given
        let tx;
        let walletsBefore;
        let walletsAfter;
        //When
        walletsBefore = await helpers.getZrKeys(
          supportedWalletTypeId,
          regularAddress,
          instances.proxied
        );

        const walletIndex = walletsBefore.length
        const payload = web3.eth.abi.encodeParameters(['bytes32', 'address', 'uint256', 'string'], [supportedWalletTypeId, regularAddress, walletIndex, c.mpcAddress]);
        const authSignature = await helpers.getAuthSignature(c.caller, payload);

        tx = helpers.zrKeyRes(
          c.walletTypeId,
          c.owner,
          walletIndex,
          c.mpcAddress,
          authSignature,
          c.caller,
          instances.proxied
        );

        walletsAfter = await helpers.getZrKeys(
          supportedWalletTypeId,
          regularAddress,
          instances.proxied
        );

        //Then
        await helpers.expectRevert(tx, c.expectedError);
        assert.equal(walletsBefore.length, walletsAfter.length);
      });
    }

    it("shoud not resolve public key for chain type with wrong public key index", async () => {
      //Given
      let tx;
      let walletsBefore;
      let walletsAfter;
      const expectedError = "qs::qKeyRes:incorrect walletIndex";
      //When
      walletsBefore = await helpers.getZrKeys(
        supportedWalletTypeId,
        regularAddress,
        instances.proxied
      );

      const walletIndex = walletsBefore.length;
      const nextIndex = walletIndex + 1;
      const payload = web3.eth.abi.encodeParameters(['bytes32', 'address', 'uint256', 'string'], [supportedWalletTypeId, regularAddress, nextIndex, fakeMPCAddress]);
      const authSignature = await helpers.getAuthSignature(ovmAddress, payload);

      tx = helpers.zrKeyRes(
        supportedWalletTypeId,
        regularAddress,
        nextIndex,
        fakeMPCAddress,
        authSignature,
        ovmAddress,
        instances.proxied
      );

      walletsAfter = await helpers.getZrKeys(
        supportedWalletTypeId,
        regularAddress,
        instances.proxied
      );

      //Then
      await helpers.expectRevert(tx, expectedError);
      assert.equal(walletsBefore.length, walletsAfter.length);
    });
    it("shoud not resolve public key for chain type twice", async () => {
      //Given
      let tx;
      let walletsBefore;
      let walletsAfter;
      const pki = 0;
      const expectedError = "qs::qKeyRes:incorrect walletIndex";
      //When
      walletsBefore = await helpers.getZrKeys(
        supportedWalletTypeId,
        regularAddress,
        instances.proxied
      );

      const payload = web3.eth.abi.encodeParameters(['bytes32', 'address', 'uint256', 'string'], [supportedWalletTypeId, regularAddress, pki, fakeMPCAddress]);
      const authSignature = await helpers.getAuthSignature(ovmAddress, payload);

      tx = await helpers.zrKeyRes(
        supportedWalletTypeId,
        regularAddress,
        pki,
        fakeMPCAddress,
        authSignature,
        ovmAddress,
        instances.proxied
      );

      await helpers.expectTXSuccess(tx);
      await helpers.checkZrKeyResEvent(
        tx.receipt.logs[0],
        supportedWalletTypeId,
        walletsBefore.length,
        regularAddress,
        fakeMPCAddress,
        ovmAddress
      );

      walletsAfter = await helpers.getZrKeys(
        supportedWalletTypeId,
        regularAddress,
        instances.proxied
      );

      assert.equal(walletsAfter.length, walletsBefore.length + 1);

      walletsBefore = await helpers.getZrKeys(
        supportedWalletTypeId,
        regularAddress,
        instances.proxied
      );

      tx = helpers.zrKeyRes(
        supportedWalletTypeId,
        regularAddress,
        pki,
        fakeMPCAddress,
        authSignature,
        ovmAddress,
        instances.proxied
      );

      walletsAfter = await helpers.getZrKeys(
        supportedWalletTypeId,
        regularAddress,
        instances.proxied
      );

      //Then
      await helpers.expectRevert(tx, expectedError);
      assert.equal(walletsBefore.length, walletsAfter.length);
    });
  });
});
