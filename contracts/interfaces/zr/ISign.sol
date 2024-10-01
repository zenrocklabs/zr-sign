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
    ) external view returns (SignTypes.WalletRegistry memory);

    function estimateFee(
        bytes32 walletTypeId,
        address owner,
        uint256 walletIndex,
        uint256 value
    ) external view returns (uint256 mpc, uint256 netResp, uint256 total);

    function estimateFee(
        uint8 options,
        uint256 value
    ) external view returns (uint256 mpc, uint256 netResp, uint256 total);

    function getTraceId() external view returns (uint256);

    function getRequestState(
        uint256 traceId
    ) external view returns (SignTypes.ReqRegistry memory);

    function getMPCFee() external view returns (uint256);
    function getRespGas() external view returns (uint256);
    function getRespGasPriceBuffer() external view returns (uint256);

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
        uint8 options,
        uint256 value,
        uint256 mpcFee
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
        uint256 value,
        uint256 mpcFee,
        SignTypes.SigReqParams params
    );

    event ZrSigResolve(
        uint256 indexed traceId,
        bytes metaData,
        bytes signature,
        bool broadcast
    );

    event ZrSigGasRefund(uint256 engineWalletCost, uint256 userChange);

    event MPCFeeUpdate(uint256 indexed oldBaseFee, uint256 indexed newBaseFee);
    event RespGasUpdate(uint256 indexed oldGas, uint256 indexed newGas);
    event RespGasPriceBufferUpdate(
        uint256 indexed oldGasPriceBuff,
        uint256 indexed newGasPriceBuff
    );

    event MPCFeeWithdraw(address indexed to, uint256 indexed amount);
}
