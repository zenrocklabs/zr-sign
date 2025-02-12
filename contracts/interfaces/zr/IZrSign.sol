// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.19;

import { ISign } from "./ISign.sol";

interface IZrSign is ISign {
    function initializeV1() external;

    function walletTypeIdConfig(uint256 purpose, uint256 coinType, bool support) external;

    function chainIdConfig(bytes32 walletTypeId, string memory caip, bool support) external;

    function updateMPCFee(uint256 newMPCFee) external;
    function updateRespGas(uint256 newRespGas) external;
    function updateRespGasBuffer(uint256 newRespGasBuffer) external;
    function withdrawMPCFees() external;

    event WalletTypeIdSupport(
        uint256 indexed purpose,
        uint256 indexed coinType,
        bytes32 indexed walletTypeId,
        bool support
    );

    event ChainIdSupport(
        bytes32 indexed walletTypeId,
        bytes32 indexed chainId,
        string caip,
        bool support
    );
}
