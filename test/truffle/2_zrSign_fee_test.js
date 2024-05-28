const { assert } = require("chai");
const helpers = require("./helpers");

contract("ZrSign fee tests", (accounts) => {
  const owner = accounts[0];
  const tokenomicsAddress = accounts[8];
  const proxyAdmin = accounts[9];
  const regularAddress = accounts[1];

  let instances;

  beforeEach(async () => {
    instances = await helpers.initZrSignWithProxy(proxyAdmin, owner, tokenomicsAddress);
  });

  describe("positive tests", async () => {
    it("shoud setup base fee", async () => {
      // Given
      let oldBaseFee;
      let updatedBaseFee;
      const expectedBaseFee = web3.utils.toWei("80", "gwei");
      let tx;

      // When
      oldBaseFee = await helpers.getBaseFee(instances.proxied);
      tx = await helpers.setupBaseFee(expectedBaseFee, tokenomicsAddress, instances.proxied);
      updatedBaseFee = await helpers.getBaseFee(instances.proxied);

      // Then
      await helpers.expectTXSuccess(tx);
      await helpers.checkBaseFeeEvent(tx.receipt.logs[0], oldBaseFee, expectedBaseFee);
      assert.equal(
        updatedBaseFee,
        expectedBaseFee,
        `Contract state not updated correctly. Transaction: ${tx.tx}`,
      );
    });
    it("shoud setup network fee", async () => {
      // Given
      let oldNetworkFee;
      let updatedNetworkFee;
      const expectedNetworkFee = web3.utils.toWei("4", "wei");
      let tx;

      // When
      oldNetworkFee = await helpers.getNetworkFee(instances.proxied);
      tx = await helpers.setupNetworkFee(
        expectedNetworkFee,
        tokenomicsAddress,
        instances.proxied,
      );
      updatedNetworkFee = await helpers.getNetworkFee(instances.proxied);

      // Then
      await helpers.expectTXSuccess(tx);
      await helpers.checkNetworkFeeEvent(tx.receipt.logs[0], oldNetworkFee, expectedNetworkFee);
      assert.equal(
        updatedNetworkFee,
        expectedNetworkFee,
        `Contract state not updated correctly. Transaction: ${tx.tx}`,
      );
    });
  });

  describe("negative tests", async () => {
    it("shoud not setup base fee without role", async () => {
      // Given
      let tx;
      const expectedBaseFee = web3.utils.toWei("80", "gwei");
      let role;
      let expectedError;

      // When
      role = await instances.proxied.TOKENOMICS_ROLE.call();
      const customError = {
        name: "AccessControlUnauthorizedAccount",
        params: [regularAddress, role],
        instance: instances.proxied,
      };

      tx = helpers.setupBaseFee(expectedBaseFee, regularAddress, instances.proxied);

      // Then

      await helpers.expectRevert(tx, expectedError, customError);
    });
    it("shoud not setup network fee without role", async () => {
      // Given
      let tx;
      const expectedNetworkFee = web3.utils.toWei("4", "wei");
      let role;
      let expectedError;

      // When
      role = await instances.proxied.TOKENOMICS_ROLE.call();
      const customError = {
        name: "AccessControlUnauthorizedAccount",
        params: [regularAddress, role],
        instance: instances.proxied,
      };

      tx = helpers.setupNetworkFee(expectedNetworkFee, regularAddress, instances.proxied);

      // Then
      await helpers.expectRevert(tx, expectedError, customError);
    });
  });
});
