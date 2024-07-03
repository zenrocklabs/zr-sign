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
        string addr;
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

    struct TVDTx {
        string to;
        uint256 value;
        bytes data;
    }

    function encodeTVD(TVDTx memory self) public pure returns (bytes memory) {
        return
            abi.encodeWithSignature(
                "transfer(string,uint256,bytes)",
                self.to,
                self.value,
                self.data
            );
    }

    function decodeTVD(
        bytes calldata tvdData
    )
        external
        pure
        returns (string memory to, uint256 value, bytes4 signature, bytes memory data)
    {
        // Extract the first 4 bytes for the function signature
        signature = bytes4(tvdData[:4]);

        // Decode the remaining data
        (to, value, data) = abi.decode(tvdData[4:], (string, uint256, bytes));
    }

    struct SigReqParams {
        bytes32 walletTypeId;
        uint256 walletIndex;
        bytes32 dstChainId;
        bytes payload;
        address owner;
        uint8 signTypeData;
        bool broadcast;
    }

    struct SignResParams {
        uint256 traceId;
        bytes signature;
        bool broadcast;
        bytes authSignature;
    }
}
