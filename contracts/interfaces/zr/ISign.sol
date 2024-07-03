// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.19;

import { IAccessControl } from "../IAccessControl.sol";
import { SignTypes } from "../../libraries/zr/SignTypes.sol";
import { ZrSignTypes } from "../../libraries/zr/ZrSignTypes.sol";

interface ISign is IAccessControl {
    function zrKeyReq(SignTypes.ZrKeyReqParams calldata params) external payable;

    function zrKeyRes(SignTypes.ZrKeyResParams calldata params) external;

    function zrSignHash(SignTypes.ZrSignParams calldata params) external payable;

    function zrSignData(SignTypes.ZrSignParams calldata params) external payable;

    function zrSignTx(SignTypes.ZrSignParams calldata params) external payable;
    
    function zrSignSimpleTx(SignTypes.ZrSignParams memory params) external payable;

    function zrSignRes(SignTypes.SignResParams calldata params) external;

    function version() external view returns (uint256);

    function isWalletTypeSupported(bytes32 walletTypeId) external view returns (bool);

    function isChainIdSupported(
        bytes32 walletTypeId,
        bytes32 chainId
    ) external view returns (bool);

    function getWalletRegistry(
        bytes32 walletTypeId,
        uint256 walletIndex,
        address owner
    ) external view returns (uint8);

    function getTraceId() external view returns (uint256);

    function getRequestState(uint256 traceId) external view returns (uint8);

    function getBaseFee() external view returns (uint256);

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

    // Event declaration
    event ZrKeyRequest(
        bytes32 indexed walletTypeId,
        address indexed owner,
        uint256 indexed walletIndex,
        bool monitoring
    );

    event ZrKeyResolve(
        bytes32 indexed walletTypeId,
        address indexed owner,
        uint256 indexed walletIndex,
        string addr
    );

    event ZrSigRequest(
        uint256 indexed traceId,
        bytes32 indexed walletId,
        bytes32 walletTypeId,
        address owner,
        uint256 walletIndex,
        bytes32 dstChainId,
        bytes payload,
        uint8 zrSignDataType,
        bool broadcast
    );

    event ZrSigResolve(uint256 indexed traceId, bytes signature, bool broadcast);

    event BaseFeeUpdate(uint256 indexed oldBaseFee, uint256 indexed newBaseFee);
    event MultiplierUpdate(uint256 indexed oldMultiplierFee, uint256 indexed newMultiplierFee);
}
