// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Qredo Ltd.

pragma solidity 0.8.20;

library SignTypes {
    struct QKeyReqParams {
        bytes32 walletTypeId;
    }

    struct QKeyResParams {
        bytes32 walletTypeId;
        address owner;
        uint256 walletIndex;
        string publicKey;
        bytes authSignature;
    }

    struct ZrSignParams {
        bytes32 walletTypeId;
        uint256 walletIndex;
        bytes32 dstChainId;
        bytes payload; // For `zrSignHash`, this would be the hash converted to bytes
        bool broadcast; // Relevant for `zrSignTx`, must be ignored for others
    }

    struct SigReqParams {
        bytes32 walletTypeId;
        uint256 walletIndex;
        bytes32 dstChainId;
        bytes payload;
        address owner;
        uint8 isHashDataTx;
        bool broadcast;
    }

    struct SignResParams {
        uint256 traceId;
        bytes signature;
        bool broadcast;
        bytes authSignature;
    }
}
