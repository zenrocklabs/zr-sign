// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.19;

library SignTypes {
    struct ZrKeyReqParams {
        bytes32 walletTypeId;
        bool monitoring;
    }

    struct ZrKeyResParams {
        bytes32 walletTypeId;
        address owner;
        uint256 walletIndex;
        string wallet;
        bool monitoring;
        bytes authSignature;
    }

    struct ZrSignParams {
        bytes32 walletTypeId;
        uint256 walletIndex;
        bytes32 dstChainId;
        bytes payload; // For `zrSignHash`, this would be the hash converted to bytes
        bool broadcast; // Relevant for `zrSignTx`, must be ignored for others
    }

    struct SimpleTx {
        string to;
        uint256 value;
        bytes data;
    }

    function encodeSimple(SimpleTx memory self) public pure returns (bytes memory) {
        return
            abi.encodeWithSignature(
                "transaction(string,uint256,bytes)",
                self.to,
                self.value,
                self.data
            );
    }

    function decodeSimpleTx(
        bytes calldata simpleTxData
    )
        external
        pure
        returns (string memory to, uint256 value, bytes4 signature, bytes memory data)
    {
        // Extract the first 4 bytes for the function signature
        signature = bytes4(simpleTxData[:4]);

        // Decode the remaining data
        (to, value, data) = abi.decode(simpleTxData[4:], (string, uint256, bytes));
    }

    struct SigReqParams {
        bytes32 walletTypeId;
        uint256 walletIndex;
        bytes32 dstChainId;
        bytes payload;
        address owner;
        uint8 zrSignDataType;
        bool broadcast;
    }

    struct SignResParams {
        uint256 traceId;
        bytes signature;
        bool broadcast;
        bytes authSignature;
    }
}
