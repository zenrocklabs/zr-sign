// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import { Lib_RLPWriter } from "./Lib_RLPWriter.sol";

import { SignTypes } from "./zr/SignTypes.sol";

import { IZrSign } from "../interfaces/zr/IZrSign.sol";

// Abstract contract for QSign connections
abstract contract ZrSignConnect {
    // Use the RLPWriter library for various types
    using Lib_RLPWriter for address;
    using Lib_RLPWriter for uint256;
    using Lib_RLPWriter for bytes;
    using Lib_RLPWriter for bytes[];
    using SignTypes for SignTypes.SimpleTx;

    uint8 private constant ADDRESS_REGISTERED = 1;
    uint8 private constant ADDRESS_REGISTERED_WITH_MONITORING = 2;

    // Address of the ZrSign contract
    address internal constant ZR_SIGN_ADDRESS =
        payable(address(0xF6B22AcbA6D4b2887B36387ebDD81D17887aD652)); // ZrSign Sepolia address

    // The wallet type for EVM-based wallets
    bytes32 internal constant EVM_WALLET_TYPE =
        0xe146c2986893c43af5ff396310220be92058fb9f4ce76b929b80ef0d5307100a;

    // Request a new EVM wallet
    // This function uses the ZrSign contract to request a new public key for the EVM wallet type
    function requestNewEVMWallet(uint8 options) public virtual {
        uint256 _fee = IZrSign(ZR_SIGN_ADDRESS).estimateFee(options);

        // Prepare the parameters for the key request
        SignTypes.ZrKeyReqParams memory params = SignTypes.ZrKeyReqParams({
            walletTypeId: EVM_WALLET_TYPE,
            options: options
        });

        IZrSign(ZR_SIGN_ADDRESS).zrKeyReq{ value: _fee }(params);
    }

    // Request a signature for a specific hash
    // This function uses the ZrSign contract to request a signature for a specific hash
    // Parameters:
    // - walletTypeId: The ID of the wallet type associated with the hash
    // - fromAccountIndex: The index of the public key to be used for signing
    // - dstChainId: The ID of the destination chain
    // - payloadHash: The hash of the payload to be signed
    function reqSignForHash(
        bytes32 walletTypeId,
        uint256 walletIndex,
        bytes32 dstChainId,
        bytes32 payloadHash
    ) internal virtual {
        uint256 _fee = IZrSign(ZR_SIGN_ADDRESS).estimateFee(walletTypeId, msg.sender, walletIndex);

        SignTypes.ZrSignParams memory params = SignTypes.ZrSignParams({
            walletTypeId: walletTypeId,
            walletIndex: walletIndex,
            dstChainId: dstChainId,
            payload: abi.encodePacked(payloadHash),
            broadcast: false // Not used in this context
        });

        IZrSign(ZR_SIGN_ADDRESS).zrSignHash{ value: _fee }(params);
    }

    // Request a signature for a specific data payload
    // This function uses the ZrSign contract to request a signature for a specific data payload
    // Parameters:
    // - walletTypeId: The ID of the wallet type associated with the data payload
    // - fromAccountIndex: The index of the public key to be used for signing
    // - dstChainId: The ID of the destination chain
    // - payload: The data payload to be signed
    function reqSignForData(
        bytes32 walletTypeId,
        uint256 walletIndex,
        bytes32 dstChainId,
        bytes memory payload
    ) internal virtual {
        uint256 _fee = IZrSign(ZR_SIGN_ADDRESS).estimateFee(walletTypeId, msg.sender, walletIndex);

        SignTypes.ZrSignParams memory params = SignTypes.ZrSignParams({
            walletTypeId: walletTypeId,
            walletIndex: walletIndex,
            dstChainId: dstChainId,
            payload: payload,
            broadcast: false
        });

        IZrSign(ZR_SIGN_ADDRESS).zrSignData{ value: _fee }(params);
    }

    // Request a signature for a transaction
    // This function uses the QSign contract to request a signature for a transaction
    // Parameters:
    // - walletTypeId: The ID of the wallet type associated with the transaction
    // - fromAccountIndex: The index of the account from which the transaction will be sent
    // - chainId: The ID of the chain on which the transaction will be executed
    // - payload: The RLP-encoded transaction data
    // - broadcast: A flag indicating whether the transaction should be broadcasted immediately

    function reqSignForTx(
        bytes32 walletTypeId,
        uint256 walletIndex,
        bytes32 dstChainId,
        bytes memory payload,
        bool broadcast
    ) internal virtual {
        uint256 _fee = IZrSign(ZR_SIGN_ADDRESS).estimateFee(walletTypeId, msg.sender, walletIndex);

        SignTypes.ZrSignParams memory params = SignTypes.ZrSignParams({
            walletTypeId: walletTypeId,
            walletIndex: walletIndex,
            dstChainId: dstChainId,
            payload: payload,
            broadcast: broadcast
        });

        IZrSign(ZR_SIGN_ADDRESS).zrSignTx{ value: _fee }(params);
    }

    function reqSignForSimpleTx(
        bytes32 walletTypeId,
        uint256 walletIndex,
        bytes32 dstChainId,
        string memory to,
        uint256 value,
        bytes memory data,
        bool broadcast
    ) internal virtual {
        uint256 _fee = IZrSign(ZR_SIGN_ADDRESS).estimateFee(walletTypeId, msg.sender, walletIndex);

        bytes memory payload = SignTypes.SimpleTx({
            to: to,
            value: value,
            data: data
        }).encodeSimple();

        SignTypes.ZrSignParams memory params = SignTypes.ZrSignParams({
            walletTypeId: walletTypeId,
            walletIndex: walletIndex,
            dstChainId: dstChainId,
            payload: payload,
            broadcast: broadcast
        });

        IZrSign(ZR_SIGN_ADDRESS).zrSignSimpleTx{ value: _fee }(params);
    }
    // Encode data using RLP
    // This function uses the RLPWriter library to encode data into RLP format
    function rlpEncodeData(bytes memory data) internal virtual returns (bytes memory) {
        return data.writeBytes();
    }

    // Encode a transaction using RLP
    // This function uses the RLPWriter library to encode a transaction into RLP format
    function rlpEncodeTransaction(
        uint256 nonce,
        uint256 gasPrice,
        uint256 gasLimit,
        address to,
        uint256 value,
        bytes memory data
    ) internal virtual returns (bytes memory) {
        bytes memory nb = nonce.writeUint();
        bytes memory gp = gasPrice.writeUint();
        bytes memory gl = gasLimit.writeUint();
        bytes memory t = to.writeAddress();
        bytes memory v = value.writeUint();
        return _encodeTransaction(nb, gp, gl, t, v, data);
    }

    // Helper function to encode a transaction
    // This function is used by the rlpEncodeTransaction function to encode a transaction into RLP format
    function _encodeTransaction(
        bytes memory nonce,
        bytes memory gasPrice,
        bytes memory gasLimit,
        bytes memory to,
        bytes memory value,
        bytes memory data
    ) internal pure returns (bytes memory) {
        bytes memory zb = uint256(0).writeUint();
        bytes[] memory payload = new bytes[](9);
        payload[0] = nonce;
        payload[1] = gasPrice;
        payload[2] = gasLimit;
        payload[3] = to;
        payload[4] = value;
        payload[5] = data;
        payload[6] = zb;
        payload[7] = zb;
        payload[8] = zb;
        return payload.writeList();
    }
}
