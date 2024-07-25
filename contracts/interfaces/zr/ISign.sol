// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.19;

import { IAccessControl } from "../IAccessControl.sol";
import { SignTypes } from "../../libraries/zr/SignTypes.sol";
import { ZrSignTypes } from "../../libraries/zr/ZrSignTypes.sol";

interface ISign is IAccessControl {
    function zrKeyReq(SignTypes.ZrKeyReqParams calldata params) external payable;

    function zrSignHash(SignTypes.ZrSignParams calldata params) external payable;

    function zrSignData(SignTypes.ZrSignParams calldata params) external payable;

    function zrSignTx(SignTypes.ZrSignParams calldata params) external payable;

    function zrSignSimpleTx(SignTypes.ZrSignParams memory params) external payable;

    function version() external view returns (uint256);

    function isWalletTypeSupported(bytes32 walletTypeId) external view returns (bool);

    function isChainIdSupported(
        bytes32 walletTypeId,
        bytes32 chainId
    ) external view returns (bool);

    function getTraceId() external view returns (uint256);

    function getMPCFee() external view returns (uint256);

    function getWalletTypeInfo(
        bytes32 walletTypeId
    ) external view returns (ZrSignTypes.ChainInfo memory);

    // Event declaration
    event ZrKeyRequest(bytes32 indexed walletTypeId, address indexed owner);

    event ZrSigRequest(
        bytes32 indexed traceId,
        bytes32 srcChain,
        bytes32 walletTypeId,
        address owner,
        uint256 walletIndex,
        bytes32 dstChainId,
        bytes payload,
        uint8 isHashDataTx,
        bool broadcast
    );

    event MPCFeeUpdate(uint256 indexed oldBaseFee, uint256 indexed newBaseFee);
}
