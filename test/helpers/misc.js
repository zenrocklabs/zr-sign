const { assert, expect } = require("chai");
const { defaultAbiCoder } = require("@ethersproject/abi");
const { hexDataSlice } = require("@ethersproject/bytes");
const { keccak256 } = require("@ethersproject/solidity");

// Improved version of expectRevert function
async function expectRevert(tx, expectedReason, customError, printDebug = false) {
  try {
    await tx;
    // If the promise resolves successfully, it means the transaction did not revert as expected.
    assert.fail(`Expected transaction to revert, but it did not. Transaction hash: ${tx.tx}`);
  } catch (error) {
    // Optional debugging logs
    if (printDebug) {
      console.log("Transaction Information:", tx);
      console.log("Caught Error:", error);
      console.log("Expected Reason:", expectedReason);
    }

    // Check for custom errors if specified
    if (customError) {
      handleCustomError(error, customError, printDebug);
    } else if (expectedReason) {
      // Handle expected revert reason for non-custom errors
      const reasonIncluded =
        error.message.includes(expectedReason) ||
        (error.reason && error.reason.includes(expectedReason));
      assert.isTrue(
        reasonIncluded,
        `Expected revert reason not found. Expected: "${expectedReason}", got: "${error.message}"`,
      );
    }
  }
}

function handleCustomError(error, customError, printDebug = false) {
  // Source https://github.com/TomiOhl/custom-error-test-helper/blob/main/src/index.ts
  const errorAbi = customError.instance.abi.find(
    (elem) => elem.type === "error" && elem.name === customError.name,
  );
  expect(errorAbi, `Expected custom error ${customError.name}`).to.exist;

  const types = errorAbi.inputs.map((elem) => elem.type);
  const revertData = typeof error.data === "string" ? error.data : error.data.result;

  const errorId = keccak256(
    ["string"],
    [`${customError.name}(${types ? types.toString() : ""})`],
  )
    .substring(0, 10)
    .toLowerCase(); // Convert errorId to lowercase
  expect(
    JSON.stringify(revertData).toLowerCase(),
    `Expected custom error ${customError.name} (${errorId})`,
  ).to.include(errorId); // Convert revertData to lowercase in comparison

  if (customError.params) {
    expect(
      customError.params.length,
      "Expected the number of customError.params to match the number of types",
    ).to.eq(types.length);
    const decodedValues = defaultAbiCoder.decode(types, hexDataSlice(revertData, 4));
    decodedValues.forEach((elem, index) => {
      if (printDebug) {
        console.log(`errorAbi: ${errorAbi}`);
        console.log(`errorId: ${errorId}`);
        console.log(`decodedValues: ${decodedValues}`);
        console.log(`elem: ${elem.toString()}`);
        console.log(`index: ${index.toString()}`);
        console.log(`customError.params: ${customError.params}`);
      }
      // Convert both elements to string and lowercase before comparison
      expect(elem.toString().toLowerCase()).to.eq(
        customError.params[index].toString().toLowerCase(),
      );
    });
  }
}

function expectTXSuccess(tx) {
  assert.isTrue(tx.receipt.status, `Transaction: ${tx.tx} failed`);
}

function checkLog(log, expectedLog, expectedArgs) {
  assert.equal(
    log.event,
    expectedLog,
    `Transaction: ${tx.receipt.logs[0].transactionHash} emitted wrong event`,
  );
  for (let i = 0; i < log.args.__length__; i++) {
    assert.equal(
      log.args[i].toString(),
      expectedArgs[i].toString(),
      `Wrong old fee update at transaction: ${tx.receipt.logs[0].transactionHash}`,
    );
  }
}

function verifyUpgradeEvent(e, implAddress) {
  assert.equal(e.event, "Upgraded", "wrong Upgrade event");
  assert.equal(e.args.implementation, implAddress, "wrong implementation address");
}

async function getAuthSignature(signer, payload, vOff = -2) {
  const payloadHash = web3.utils.soliditySha3(payload);
  const signature = await web3.eth.sign(payloadHash, signer);
  let vValue = parseInt(signature.slice(-2), 16); // Convert the last two hex characters to an integer
  if (vValue < 27) {
    vValue += 27;
  }
  // Convert vValue back to hex, ensure it is two characters long, and append to the rest of the signature
  const vHex = ("0" + vValue.toString(16)).slice(-2); // Ensures two characters
  const authSignature = signature.slice(0, vOff) + vHex;
  return authSignature;
}

module.exports = {
  expectRevert,
  verifyUpgradeEvent,
  expectTXSuccess,
  checkLog,
  getAuthSignature,
};
