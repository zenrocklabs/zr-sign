const UNSUPPORTED_CHAIN_TYPE = { purpose: 0, coinType: 0 };
const UNSUPPORTED_CHAIN_TYPE_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const BTC_CHAIN_TYPE = { purpose: 44, coinType: 0 };
const BTC_TESTNET_CHAIN_TYPE = { purpose: 44, coinType: 1 };

const EVM_CHAIN_TYPE = { purpose: 44, coinType: 60 };
const EVM_CHAIN_TYPE_HASH =
  "0xe146c2986893c43af5ff396310220be92058fb9f4ce76b929b80ef0d5307100a";

export {
  UNSUPPORTED_CHAIN_TYPE,
  UNSUPPORTED_CHAIN_TYPE_HASH,
  BTC_CHAIN_TYPE,
  BTC_TESTNET_CHAIN_TYPE,
  EVM_CHAIN_TYPE,
  EVM_CHAIN_TYPE_HASH,
};