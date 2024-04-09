const { assert } = require("chai");

async function getZrKeys(walletTypeId, owner, instance) {
  return await instance.getZrKeys.call(walletTypeId, owner);
}

async function zrKeyReq(walletTypeId, msgValue, caller, instance) {
  //Given
  let tx;
  //When
  const params = { walletTypeId: walletTypeId };

  tx = instance.zrKeyReq(params, {
    from: caller,
    value: msgValue,
  });
  //Then
  return tx;
}

function checkZrKeyReqEvent(log, walletTypeId, owner, walletIndex) {
  assert.equal(
    log.event,
    "ZrKeyRequest",
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

async function zrKeyRes(
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
  tx = instance.zrKeyRes(params, {
    from: caller,
  });

  //Then
  return tx;
}

function checkZrKeyResEvent(log, walletTypeId, walletIndex, owner, publicKey) {
  assert.equal(
    log.event,
    "ZrKeyResolve",
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
  getZrKeys,
  zrKeyReq,
  checkZrKeyReqEvent,
  zrKeyRes,
  checkZrKeyResEvent,
};
