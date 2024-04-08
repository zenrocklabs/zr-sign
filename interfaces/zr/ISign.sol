// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Qredo Ltd.

pragma solidity 0.8.20;

import "./IAccessControl.sol";
import "../libraries/SignTypes.sol";
import "../libraries/ZrSignTypes.sol";

interface ISign is IAccessControl {
    function zrKeyReq(SignTypes.QKeyReqParams calldata params) external payable;

    function zrKeyRes(SignTypes.QKeyResParams calldata params) external;

    function zrSignHash(SignTypes.ZrSignParams calldata params) external payable;

    function zrSignData(SignTypes.ZrSignParams calldata params) external payable;

    function zrSignTx(SignTypes.ZrSignParams calldata params) external payable;

    function zrSignRes(SignTypes.SignResParams calldata params) external;

    function version() external view returns (uint256);

    function isWalletTypeSupported(
        bytes32 walletTypeId
    ) external view returns (bool);

    function isChainIdSupported(
        bytes32 walletTypeId,
        bytes32 chainId
    ) external view returns (bool);

    function getTraceId() external view returns (uint256);

    function getBaseFee() external view returns (uint256);

    function getNetworkFee() external view returns (uint256);

    function getWalletTypeInfo(
        bytes32 walletTypeId
    ) external view returns (ZrSignTypes.ChainInfo memory);

    function getZrKeys(
        bytes32 walletTypeId,
        address owner
    ) external view returns (string[] memory);

    function getZrKey(
        bytes32 walletTypeId,
        address owner,
        uint256 index
    ) external view returns (string memory);

    event ZrKeyRequest(
        bytes32 indexed walletTypeId,
        address indexed owner,
        uint256 indexed walletIndex
    );

    event ZrKeyResolve(
        bytes32 indexed walletTypeId,
        address indexed owner,
        uint256 indexed walletIndex,
        string publicKey
    );

    event ZrSigRequest(
        uint256 indexed traceId,
        bytes32 indexed walletId,
        bytes32 walletTypeId,
        address owner,
        uint256 walletIndex,
        bytes32 dstChainId,
        bytes payload,
        uint8 isHashDataTx,
        bool broadcast
    );

    event ZrSigResolve(uint256 indexed traceId, bytes signature, bool broadcast);

    event BaseFeeUpdate(uint256 indexed oldBaseFee, uint256 indexed newBaseFee);
    event NetworkFeeUpdate(
        uint256 indexed oldNetworkFee,
        uint256 indexed newNetworkFee
    );
}
