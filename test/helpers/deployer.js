const { assert } = require("chai");
const ZrProxy = artifacts.require("ZrProxy");
const ZrSign = artifacts.require("ZrSign");

async function initZrSignWithProxy(proxyAdmin, owner) {
  let implInstance = await ZrSign.new();
  const implContract = new web3.eth.Contract(implInstance.abi);
  const data = implContract.methods.initializeV1().encodeABI();

  let ZrProxyInstance = await ZrProxy.new(
    implInstance.address,
    proxyAdmin,
    data,
    { from: owner }
  );
  let Proxied = await ZrSign.at(ZrProxyInstance.address);
  return {
    implementation: implInstance,
    proxy: ZrProxyInstance,
    proxied: Proxied,
  };
}

module.exports = {
  initZrSignWithProxy,
};
