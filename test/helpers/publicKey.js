const { assert } = require("chai");

async function getQKeys(walletTypeId, owner, instance) {
  return await instance.getQKeys.call(walletTypeId, owner);
}

async function qKeyReq(walletTypeId, msgValue, caller, instance) {
  //Given
  let tx;
  //When
  const params = { walletTypeId: walletTypeId };

  tx = instance.qKeyReq(params, {
    from: caller,
    value: msgValue,
  });
  //Then
  return tx;
}

function checkQKeyReqEvent(log, walletTypeId, owner, walletIndex) {
  assert.equal(
    log.event,
    "QKeyRequest",
    `Transaction: ${log.transactionHash} emitted wrong event`
  );
  assert.equal(
    log.args.walletTypeId,
    walletTypeId,
    `Wrong walletTypeId event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.owner,
    owner,
    `Wrong owner event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.walletIndex.toString(),
    walletIndex.toString(),
    `Wrong wallet index event argument at transaction: ${log.transactionHash}`
  );
}

async function qKeyRes(
  walletTypeId,
  owner,
  walletIndex,
  publicKey,
  signature,
  caller,
  instance
) {
  //Given
  let tx;
  //When
  const params = { walletTypeId: walletTypeId, owner: owner, walletIndex: walletIndex, publicKey: publicKey, authSignature: signature };
  tx = instance.qKeyRes(params, {
    from: caller,
  });

  //Then
  return tx;
}

function checkQKeyResEvent(log, walletTypeId, walletIndex, owner, publicKey) {
  assert.equal(
    log.event,
    "QKeyResolve",
    `Transaction: ${log.transactionHash} emitted wrong event`
  );
  assert.equal(
    log.args.walletTypeId,
    walletTypeId,
    `Wrong walletTypeId event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.walletIndex.toString(),
    walletIndex.toString(),
    `Wrong wallet index event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.owner,
    owner,
    `Wrong owner address event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.publicKey,
    publicKey,
    `Wrong public key event argument at transaction: ${log.transactionHash}`
  );
}

module.exports = {
  getQKeys,
  qKeyReq,
  checkQKeyReqEvent,
  qKeyRes,
  checkQKeyResEvent,
};
