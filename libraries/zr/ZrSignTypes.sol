// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.19;

library ZrSignTypes {
    struct ChainInfo {
        uint256 purpose; //44
        uint256 coinType; //60 for EVM //0 for BTC // 1 for BTC testnet
    }

    function encodeChainInfo(ChainInfo memory self) public pure returns (bytes memory) {
        return abi.encode(self);
    }

    function decodeChainInfo(bytes memory data) public pure returns (ChainInfo memory) {
        return abi.decode(data, (ChainInfo));
    }

    function hashChainInfo(ChainInfo memory self) public pure returns (bytes32) {
        return keccak256(encodeChainInfo(self));
    }

    function isNull(ChainInfo memory self) public pure returns (bool) {
        return self.purpose == 0;
    }

    function isNotNull(ChainInfo memory self) public pure returns (bool) {
        return self.purpose != 0;
    }
}
