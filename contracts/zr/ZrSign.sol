// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.20;

import { Sign } from "./Sign.sol";
import { ZrSignTypes } from "../../libraries/zr/ZrSignTypes.sol";
import { IZrSign } from "../../interfaces/zr/IZrSign.sol";

contract ZrSign is Sign, IZrSign {
    using ZrSignTypes for ZrSignTypes.ChainInfo;

    bytes32 public constant TOKENOMICS_ROLE = 0x08f48008958b82aad038b7223d0f8c74cce860619b44d53651dd4adcbe78162b; //keccak256("zenrock.role.tokenomics");

    //****************************************************************** CONSTRUCTOR FUNCTION ******************************************************************/

    constructor() {
        _disableInitializers();
    }

    //****************************************************************** INIT FUNCTIONS ******************************************************************/

    function initializeV1() external initializer {
        __ZrSign_init();
    }

    function __ZrSign_init() internal onlyInitializing {
        __ZrSign_init_unchained();
        __Sign_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function __ZrSign_init_unchained() internal onlyInitializing {}

    //****************************************************************** EXTERNAL FUNCTIONS ******************************************************************/

    function walletTypeIdConfig(
        uint256 purpose,
        uint256 coinType,
        bool support
    ) external virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        ZrSignTypes.ChainInfo memory c = ZrSignTypes.ChainInfo(purpose, coinType);
        bytes32 walletTypeId = _walletTypeIdConfig(c, support);
        emit WalletTypeIdSupport(purpose, coinType, walletTypeId, support);
    }

    function chainIdConfig(
        bytes32 walletTypeId,
        string memory caip,
        bool support
    )
        external
        virtual
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
        walletTypeGuard(walletTypeId)
    {
        bytes32 chainId = keccak256(abi.encodePacked(caip));
        _chainIdConfig(walletTypeId, chainId, support);
        emit ChainIdSupport(walletTypeId, chainId, caip, support);
    }

    function setupBaseFee(
        uint256 newBaseFee
    ) external virtual override onlyRole(TOKENOMICS_ROLE) {
        _setupBaseFee(newBaseFee);
    }

    function setupNetworkFee(
        uint256 newNetworkFee
    ) external virtual override onlyRole(TOKENOMICS_ROLE) {
        _setupNetworkFee(newNetworkFee);
    }

    function withdrawFees()
        external
        payable
        virtual
        override
        onlyRole(TOKENOMICS_ROLE)
    {
        address payable sender = payable(_msgSender());
        uint256 amount = address(this).balance;
        sender.transfer(amount);
        emit FeeWithdraw(sender, amount);
    }
}
