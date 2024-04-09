const { assert } = require("chai");
const helpers = require("./helpers");

contract("ZrSign request public key tests", (accounts) => {
  const owner = accounts[0];
  const proxyAdmin = accounts[9];
  const regularAddress = accounts[1];
  const supportedWalletType = helpers.EVM_CHAIN_TYPE_HASH;
  const unsupportedWalletType = helpers.UNSUPPORTED_CHAIN_TYPE_HASH;
  const baseFee = web3.utils.toWei("80", "gwei");
  const networkFee = web3.utils.toWei("4", "wei");

  let instances;

  beforeEach(async () => {
    instances = await helpers.initZrSignWithProxy(proxyAdmin, owner);
    await helpers.setupBaseFee(baseFee, owner, instances.proxied);
    await helpers.setupNetworkFee(networkFee, owner, instances.proxied);

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
    it("shoud request public key", async () => {
      //Given
      let tx;
      let baseFee;
      let wallets;

      //When
      wallets = await helpers.getZrKeys(
        supportedWalletType,
        regularAddress,
        instances.proxied
      );

      baseFee = await helpers.getBaseFee(instances.proxied);
      tx = await helpers.zrKeyReq(
        supportedWalletType,
        baseFee,
        regularAddress,
        instances.proxied
      );

      //Then
      await helpers.expectTXSuccess(tx);
      await helpers.checkZrKeyReqEvent(
        tx.receipt.logs[0],
        supportedWalletType,
        regularAddress,
        wallets.length
      );
    });
  });

  describe("negative tests", async () => {
    let negativeTests = [
      {
        testName: "be able to request for unsupported wallet type",
        fee: web3.utils.toWei("80", "gwei"),
        walletTypeId: unsupportedWalletType,
        caller: regularAddress,
        expectedError: "qs::walletTypeGuard:walletType not supported",
      },
      {
        testName: "be able to request with less fee",
        fee: web3.utils.toWei("30", "gwei"),
        walletTypeId: supportedWalletType,
        caller: regularAddress,
        expectedError: "qs::keyFee:msg.value should be greater",
      },
    ];

    for (let c of negativeTests) {
      it(`shoud not ${c.testName}`, async () => {
        //Given
        let tx;

        //When
        tx = helpers.zrKeyReq(
          c.walletTypeId,
          c.fee,
          c.caller,
          instances.proxied
        );

        //Then
        await helpers.expectRevert(tx, c.expectedError);
      });
    }
  });
});
