// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.20;

library SignTXTypes {
    struct UnsignedTx {
        uint8 txType; // Transaction types: 0 - Legacy, 1 - Access List (EIP-2930), 2 - Dynamic Fee (EIP-1559).
        string to; // Address to which the transaction is directed
        uint256 value; // Amount of ETH to send
        bytes data; // Data payload of the transaction
        uint256 nonce; // Account nonce to prevent replay attacks
    }

    struct LegacyGasParameters {
        uint256 gasLimit; // Maximum gas to be used by the transaction
        uint256 gasPrice; // Gas price (for legacy transactions)
    }

    struct DynamicFeeGasParameters {
        uint256 gasLimit; // Maximum gas to be used by the transaction
        uint256 maxPriorityFeePerGas; // Tip to miner (for EIP-1559 transactions)
        uint256 maxFeePerGas; // Maximum total fee per gas (for EIP-1559 transactions)
    }

    struct AccessListEntry {
        address account; // Address of the account
        bytes32[] storageKeys; // List of storage keys to be preloaded
    }

    struct UnsignedLegacyTx {
        UnsignedTx transaction;
        LegacyGasParameters gasParameters; // Gas-related parameters for the transaction
    }

    struct UnsignedAccessListTx {
        UnsignedTx transaction;
        AccessListEntry[] accessList; // Specific to EIP-2930
        LegacyGasParameters gasParameters; // Gas-related parameters for the transaction
    }

    struct UnsignedDynamicFeeTx {
        UnsignedTx tx;
        AccessListEntry[] accessList; // Specific to EIP-2930
        DynamicFeeGasParameters gasParameters; // Gas-related parameters for the transaction
    }

    function encodeUnsignedLegacyTx(UnsignedLegacyTx memory self)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(self);
    }

    function decodeUnsignedLegacyTx(bytes memory data)
        public
        pure
        returns (UnsignedLegacyTx memory)
    {
        return abi.decode(data, (UnsignedLegacyTx));
    }

    function encodeUnsignedAccessListTx(UnsignedAccessListTx memory self)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(self);
    }

    function decodeUnsignedAccessListTx(bytes memory data)
        public
        pure
        returns (UnsignedAccessListTx memory)
    {
        return abi.decode(data, (UnsignedAccessListTx));
    }

    function encodeUnsignedDynamicFeeTx(UnsignedDynamicFeeTx memory self)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(self);
    }

    function decodeUnsignedDynamicFeeTx(bytes memory data)
        public
        pure
        returns (UnsignedDynamicFeeTx memory)
    {
        return abi.decode(data, (UnsignedDynamicFeeTx));
    }
}
