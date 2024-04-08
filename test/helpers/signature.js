async function zrSignHash(
  walletTypeId,
  walletIndex,
  dstChainId,
  payload,
  msgValue,
  caller,
  instance,
  broadcast = false,
) {
  //Given
  let tx;

  //When
  const params = { walletTypeId: walletTypeId, walletIndex: walletIndex, dstChainId: dstChainId, payload: payload, broadcast: broadcast };
  tx = await instance.zrSignHash(params, {
    from: caller,
    value: msgValue,
  });

  //Then
  return tx;
}

async function zrSignData(
  walletTypeId,
  walletIndex,
  dstChainId,
  payload,
  msgValue,
  caller,
  instance,
  broadcast = false,
) {
  //Given
  let tx;
  //When
  const params = { walletTypeId: walletTypeId, walletIndex: walletIndex, dstChainId: dstChainId, payload: payload, broadcast: broadcast };
  tx = await instance.zrSignData(params, {
    from: caller,
    value: msgValue,
  });
  //Then
  return tx;
}

async function zrSignTx(
  walletTypeId,
  walletIndex,
  dstChainId,
  payload,
  broadcast,
  msgValue,
  caller,
  instance
) {
  //Given
  let tx;
  //When
  const params = { walletTypeId: walletTypeId, walletIndex: walletIndex, dstChainId: dstChainId, payload: payload, broadcast: broadcast };
  tx = await instance.zrSignTx(params, {
    from: caller,
    value: msgValue,
  });
  //Then
  return tx;
}

async function zrSignRes(
  traceId,
  signature,
  broadcast,
  authSignature,
  caller,
  instance
) {
  //Given
  let tx;

  const params = {
    traceId: traceId,
    signature: signature,
    broadcast: broadcast,
    authSignature: authSignature
  };

  //When
  tx = instance.zrSignRes(
    params,
    { from: caller }
  );
  //Then
  return tx;
}

function checkQSigRequestEvent(
  log,
  traceId,
  walletTypeId,
  caller,
  walletIndex,
  dstChainId,
  payload,
  isHashDataTx,
  broadcast = false
) {
  assert.equal(
    log.event,
    "QSigRequest",
    `Transaction: ${log.transactionHash} emitted wrong event`
  );
  assert.equal(
    log.args.traceId.toString(),
    traceId.toString(),
    `Wrong traceId event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.walletTypeId,
    walletTypeId,
    `Wrong walletTypeId event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.owner,
    caller,
    `Wrong caller event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.walletIndex.toString(),
    walletIndex.toString(),
    `Wrong wallet index event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    web3.utils.sha3(log.args.dstChainId),
    web3.utils.sha3(dstChainId),
    `Wrong destination chain id event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.payload,
    payload,
    `Wrong payload event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.isHashDataTx,
    isHashDataTx,
    `Wrong is hash event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.broadcast,
    broadcast,
    `Wrong broadcast event argument at transaction: ${log.transactionHash}`
  );
}

function checkQSigResolveEvent(
  log,
  traceId,
  signature,
  broadcast
) {
  assert.equal(
    log.event,
    "QSigResolve",
    `Transaction: ${log.transactionHash} emitted wrong event`
  );
  assert.equal(
    log.args.traceId.toString(),
    traceId.toString(),
    `Wrong trace id event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.signature,
    signature,
    `Wrong signature event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.broadcast.toString(),
    broadcast.toString(),
    `Wrong destination chain id event argument at transaction: ${log.transactionHash}`
  );
}

module.exports = {
  zrSignHash,
  zrSignData,
  zrSignTx,
  zrSignRes,
  checkQSigRequestEvent,
  checkQSigResolveEvent,
};
