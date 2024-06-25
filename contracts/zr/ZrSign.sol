// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.19;
import { ReentrancyGuardUpgradeable } from "../ReentrancyGuardUpgradeable.sol";
import { Sign } from "./Sign.sol";
import { ZrSignTypes } from "../../libraries/zr/ZrSignTypes.sol";
import { IZrSign } from "../../interfaces/zr/IZrSign.sol";

contract ZrSign is Sign, ReentrancyGuardUpgradeable, IZrSign {
    using ZrSignTypes for ZrSignTypes.ChainInfo;

    bytes32 public constant FEE_ROLE =
        0x13b7ad447453d194d272cdda9bb09d7d357cda1ab7de80d865b4c1cbefc3cf28; //keccak256("zenrock.role.fee");

    bytes32 public constant PAUSER_ROLE =
        0x8ab6d0465f335f1458251c44a70aa92d9297798531f73d2c8a32b5bd379821b8; //keccak256("zenrock.role.pauser");

    //****************************************************************** CONSTRUCTOR FUNCTION ******************************************************************/

    /**
     * @dev Constructor for ZrSign. Disables initializers to prevent re-initialization in upgradeable contract scenarios.
     * This is crucial to ensure the contract's integrity and security when deployed as part of an upgradeable suite.
     */
    constructor() {
        _disableInitializers();
    }

    //****************************************************************** INIT FUNCTIONS ******************************************************************/

    /**
     * @dev Initializer for version 1 of the contract. Sets up initial state and roles as required.
     * This function should only be called once during the initial setup of the contract following a proxy deployment.
     */
    function initializeV1() external initializer {
        __ZrSign_init();
    }

    function __ZrSign_init() internal onlyInitializing {
        __ReentrancyGuard_init();
        __ZrSign_init_unchained();
        __Sign_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function __ZrSign_init_unchained() internal onlyInitializing {}

    //****************************************************************** EXTERNAL FUNCTIONS ******************************************************************/
    /**
     * @dev Configures support for specific wallet types based on their purpose and coin type.
     * This function is restricted to administrators and logs the configuration event.
     *
     * @param purpose The intended use or category of the wallet type.
     * @param coinType The specific coin or token type associated with the wallet.
     * @param support Boolean indicating whether to add or remove support.
     */
    function walletTypeIdConfig(
        uint256 purpose,
        uint256 coinType,
        bool support
    ) external virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        ZrSignTypes.ChainInfo memory c = ZrSignTypes.ChainInfo(purpose, coinType);
        bytes32 walletTypeId = _walletTypeIdConfig(c, support);
        emit WalletTypeIdSupport(purpose, coinType, walletTypeId, support);
    }

    /**
     * @dev Manages the support for specific chain IDs, allowing the contract to adapt to new blockchain
     * networks or remove support as needed. Modifications are logged for transparency.
     *
     * @param walletTypeId The identifier for the wallet type associated with this chain ID.
     * @param caip The blockchain identifier (CAIP standard) to configure.
     * @param support Boolean indicating whether to add or remove support.
     */
    function chainIdConfig(
        bytes32 walletTypeId,
        string memory caip,
        bool support
    ) external virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 chainId = keccak256(abi.encodePacked(caip));
        _chainIdConfig(walletTypeId, chainId, support);
        emit ChainIdSupport(walletTypeId, chainId, caip, support);
    }

    /**
     * @dev Sets the base fee required for initiating operations within the contract. This function is
     * restricted to roles managing tokenomics to adjust economic parameters as necessary.
     *
     * @param newBaseFee The new base fee to be set for contract operations.
     */
    function setupBaseFee(
        uint256 newBaseFee
    ) external virtual override onlyRole(FEE_ROLE) {
        _setupBaseFee(newBaseFee);
    }

    /**
     * @dev Allows the withdrawal of collected fees from the contract. This operation is restricted to
     * roles designated with financial management responsibilities.
     */
    function withdrawFees() external virtual override onlyRole(FEE_ROLE) nonReentrant {
        address payable sender = payable(_msgSender());
        uint256 amount = address(this).balance;
        (bool success, ) = sender.call{ value: amount }("");
        require(success, "Failed to send Ether"); // Checks if the low-level call was successful
        emit FeeWithdraw(sender, amount);
    }

    function pause() external virtual onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external virtual onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
