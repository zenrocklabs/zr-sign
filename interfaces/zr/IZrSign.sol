// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.19;

import { ISign } from "./ISign.sol";

interface IZrSign is ISign {
    function initializeV1() external;

    function walletTypeIdConfig(
        uint256 purpose,
        uint256 coinType,
        uint256 multiplier,
        bool support
    ) external;

    function chainIdConfig(bytes32 walletTypeId, string memory caip, bool support) external;

    function setupBaseFee(uint256 newBaseFee) external;

    function setupMultiplier(bytes32 walletTypeId, uint256 newMultiplier) external;

    function withdrawFees() external;

    event FeeWithdraw(address indexed to, uint256 indexed amount);

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
