require("web3");

const UNSUPPORTED_CHAIN_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const BTC_TESTNET_CAIP = "bip122:000000000933ea01ad0ee984209779ba";
const BTC_TESTNET_CHAIN_ID =
  "0xcc8dcc74cf3de5b0154f437b295f5d0709e6527ffb67b1201e78769ff0cccbf7"; // keccak256(abi.encodePacked("bip122:000000000933ea01ad0ee984209779ba"));

const ETH_MAINNET_CAIP = "eip155:1";
const ETH_MAINNET_CHAIN_ID =
  "0x38b2caf37cccf00b6fbc0feb1e534daf567950e4d48066d0e3669028fe5f83e6"; // keccak256(abi.encodePacked("eip155:1"));

const ETH_GOERLI_CAIP = "eip155:5";
const ETH_GOERLI_CHAIN_ID =
  "0x2d54565298150cabeaf089a83d79683d200bca5c395d91069c00f6b280552588"; // keccak256(abi.encodePacked("eip155:5"));

const ETH_SEPOLIA_CAIP = "eip155:11155111";
const ETH_SEPOLIA_CHAIN_ID =
  "0xafa90c317deacd3d68f330a30f96e4fa7736e35e8d1426b2e1b2c04bce1c2fb7"; // keccak256(abi.encodePacked("eip155:11155111"));

const POLYGON_MUMBAI_CAIP = "eip155:80001";
const POLYGON_MUMBAI_CHAIN_ID =
  "0xa24f2e4ffab961d4f74844398efaab23f70f2830a83e1ea4f58097ea0408d254"; // keccak256(abi.encodePacked("eip155:80001"));

async function getSrcWalletTypeId(instance) {
  // Given
  let res;
  // When
  res = instance.SRC_WALLET_TYPE_ID.call();
  // Then
  return res;
}

async function getSrcChainId(instance) {
  // Given
  let res;
  // When
  res = instance.SRC_CHAIN_ID.call();
  // Then
  return res;
}
module.exports = {
  UNSUPPORTED_CHAIN_ID,
  BTC_TESTNET_CAIP,
  BTC_TESTNET_CHAIN_ID,
  ETH_MAINNET_CAIP,
  ETH_MAINNET_CHAIN_ID,
  ETH_GOERLI_CAIP,
  ETH_GOERLI_CHAIN_ID,
  ETH_SEPOLIA_CAIP,
  ETH_SEPOLIA_CHAIN_ID,
  POLYGON_MUMBAI_CAIP,
  POLYGON_MUMBAI_CHAIN_ID,
  getSrcWalletTypeId,
  getSrcChainId,
};
