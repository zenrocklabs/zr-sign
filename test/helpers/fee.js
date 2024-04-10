const { arrayify } = require("@ethersproject/bytes");

async function getBaseFee(instance) {
  //Given
  let baseFee;
  //When
  baseFee = instance.getBaseFee.call();
  //Then
  return baseFee;
}

async function setupBaseFee(newBaseFee, caller, instance) {
  //Given
  let tx;
  //When
  tx = instance.setupBaseFee(newBaseFee, { from: caller });
  //Then
  return tx;
}

function checkBaseFeeEvent(log, oldBaseFee, newBaseFee) {
  assert.equal(
    log.event,
    "BaseFeeUpdate",
    `Transaction: ${log.transactionHash} emitted wrong event`
  );
  assert.equal(
    log.args.oldBaseFee.toString(),
    oldBaseFee.toString(),
    `Wrong old base fee update event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.newBaseFee,
    newBaseFee,
    `Wrong new base fee update event argument at transaction: ${log.transactionHash}`
  );
}
async function getNetworkFee(instance) {
  //Given
  let netwrokFee;
  //When
  netwrokFee = instance.getNetworkFee.call();
  //Then
  return netwrokFee;
}
async function setupNetworkFee(newNetworkFee, caller, instance) {
  //Given
  let tx;
  //When
  tx = instance.setupNetworkFee(newNetworkFee, { from: caller });
  //Then
  return tx;
}

function checkNetworkFeeEvent(log, oldNetworkFee, newNetworkFee) {
  assert.equal(
    log.event,
    "NetworkFeeUpdate",
    `Transaction: ${log.transactionHash} emitted wrong event`
  );
  assert.equal(
    log.args.oldNetworkFee.toString(),
    oldNetworkFee.toString(),
    `Wrong old network fee update event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.newNetworkFee,
    newNetworkFee,
    `Wrong new network fee update event argument at transaction: ${log.transactionHash}`
  );
}

async function withdrawFees(caller, instance) {
  //Given
  let tx;
  //When
  tx = instance.withdrawFees(newFee, { from: caller });
  //Then
  return tx;
}

function checkFeeWithdrawEvent(log, to, amount) {
  assert.equal(
    log.event,
    "Withdraw",
    `Transaction: ${log.transactionHash} emitted wrong event`
  );
  assert.equal(
    log.args.to,
    to,
    `Wrong withdraw fee to event argument at transaction: ${log.transactionHash}`
  );
  assert.equal(
    log.args.amount.toString(),
    amount.toString(),
    `Wrong withdraw fee amount event argument at transaction: ${log.transactionHash}`
  );
}

function calculateTotalFee(payload, baseFee, networkFee) {
  const totalNet = calculateNetworkFee(payload, networkFee);
  const totalFee = BigInt(baseFee) + BigInt(totalNet);
  return totalFee.toString();
}

async function calculateTotalFeeFromInstance(payload, instance) {
  const bFee = await getBaseFee(instance);
  const nFee = await getNetworkFee(instance);
  const totalNet = calculateNetworkFee(payload, nFee);
  const totalFee = BigInt(bFee) + BigInt(totalNet);
  return totalFee.toString();
}

function calculateNetworkFee(payload, networkFee) {
  const bts = arrayify(payload);
  const totalNetFee = bts.length * networkFee;
  return totalNetFee;
}

async function compareFees(baseFee, networkFee, instance) {
  const bFee = await getBaseFee(instance);
  const nFee = await getNetworkFee(instance);
  return bFee == baseFee && nFee == networkFee;
}

module.exports = {
  getBaseFee,
  setupBaseFee,
  checkBaseFeeEvent,
  getNetworkFee,
  setupNetworkFee,
  checkNetworkFeeEvent,
  calculateTotalFee,
  calculateTotalFeeFromInstance,
  withdrawFees,
  checkFeeWithdrawEvent,
  calculateNetworkFee,
  compareFees,
};
