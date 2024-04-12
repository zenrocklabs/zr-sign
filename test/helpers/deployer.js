const SignTypes = artifacts.require("SignTypes");
const ZrSignTypes = artifacts.require("ZrSignTypes");
const ZrProxy = artifacts.require("ZrProxy");
const ZrSign = artifacts.require("ZrSign");

async function initZrSignWithProxy(proxyAdmin, owner, tokenomicsAddr, mpcAddr) {
  await ZrSign.link(SignTypes);
  await ZrSign.link(ZrSignTypes);

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

  if (mpcAddr) {
    const mpcRole = await Proxied.MPC_ROLE.call();
    await Proxied.grantRole(mpcRole, mpcAddr);
  }

  if (tokenomicsAddr) {
    const tokenomicsRole = await Proxied.TOKENOMICS_ROLE.call();
    await Proxied.grantRole(tokenomicsRole, tokenomicsAddr);
  }

  return {
    implementation: implInstance,
    proxy: ZrProxyInstance,
    proxied: Proxied,
  };
}

module.exports = {
  initZrSignWithProxy,
};
