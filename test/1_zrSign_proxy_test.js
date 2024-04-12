const { assert } = require("chai");

const helpers = require("./helpers");

contract("ZrSign proxy tests", (accounts) => {
  let instances;
  const owner = accounts[0];
  const proxyAdmin = accounts[9];
  beforeEach(async () => {
    instances = await helpers.initZrSignWithProxy(proxyAdmin, owner);
  });

  describe("positive tests", async () => {
    it("shoud check proxy admin", async () => {
      // Given
      let admin;
      const expectedAdmin = proxyAdmin;
      // When
      admin = await web3.eth.getStorageAt(
        instances.proxy.address,
        "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
      );
      // Then
      assert.equal(
        web3.utils.toChecksumAddress(admin.length === 42 ? admin : `0x${admin.substr(26)}`),
        web3.utils.toChecksumAddress(expectedAdmin),
        "wrong proxy admin",
      );
    });
  });
});
