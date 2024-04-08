const { assert } = require("chai");
const QProxy = artifacts.require("QProxy");
const ZrSign = artifacts.require("ZrSign");

async function initZrSignWithProxy(proxyAdmin, owner) {
  let implInstance = await ZrSign.new();
  const implContract = new web3.eth.Contract(implInstance.abi);
  const data = implContract.methods.initializeV1().encodeABI();

  let QProxyInstance = await QProxy.new(
    implInstance.address,
    proxyAdmin,
    data,
    { from: owner }
  );
  let Proxied = await ZrSign.at(QProxyInstance.address);
  return {
    implementation: implInstance,
    proxy: QProxyInstance,
    proxied: Proxied,
  };
}

module.exports = {
  initZrSignWithProxy,
};
