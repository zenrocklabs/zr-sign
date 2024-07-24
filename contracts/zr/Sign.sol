// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.19;

// Importing necessary modules from local and external sources
import { AccessControlUpgradeable } from "../AccessControlUpgradeable.sol"; // Access control functionalities for role management
import { PausableUpgradeable } from "../PausableUpgradeable.sol"; // Pausable control functionalities
import { ECDSA } from "../libraries/ECDSA.sol"; // Library for Elliptic Curve Digital Signature Algorithm operations
import { MessageHashUtils } from "../libraries/MessageHashUtils.sol"; // Utility functions for message hashing

import { ISign } from "../interfaces/zr/ISign.sol"; // Interface for the Sign contract
import { SignTypes } from "../libraries/zr/SignTypes.sol"; // Definitions of various types used within the Sign contract
import { ZrSignTypes } from "../libraries/zr/ZrSignTypes.sol"; // Definitions of types specific to Zenrock implementations

// Abstract contract for signing functionalities, inheriting from AccessControl for role management
abstract contract Sign is AccessControlUpgradeable, PausableUpgradeable, ISign {
    using ZrSignTypes for ZrSignTypes.ChainInfo; // Attach methods from ZrSignTypes to ChainInfo type
    using MessageHashUtils for bytes32; // Attach message hashing utilities to bytes32 type
    using ECDSA for bytes32; // Attach ECDSA functions to bytes32 type

    // Constant variable for Multi-Party Computation role hash, computed as keccak256 hash of the string "zenrock.role.mpc"
    bytes32 public constant MPC_ROLE =
        0x1788cbbd6512d9aa8da743e475ce7cbbc6aea08b483d7cd0c00586734a4f6f14;

    bytes32 public constant SRC_WALLET_TYPE_ID =
        0xe146c2986893c43af5ff396310220be92058fb9f4ce76b929b80ef0d5307100a; // keccak256(abi.encode(ChainInfo{purpose:44 coinType: 60}));
    bytes32 public constant SRC_CHAIN_ID =
        0xafa90c317deacd3d68f330a30f96e4fa7736e35e8d1426b2e1b2c04bce1c2fb7; //keccak256(abi.encodePacked("eip155:11155111"));

    uint8 public constant IS_HASH_MASK = 1 << 0; // 0b0001
    uint8 public constant IS_DATA_MASK = 1 << 1; // 0b0010
    uint8 public constant IS_TX_MASK = 1 << 2; // 0b0100
    uint8 public constant IS_SIMPLE_TX_MASK = 1 << 3; // 0b1000 //Simple Tx => to, value, data.

    uint8 private constant ADDRESS_REQUESTED = 1;
    uint8 private constant ADDRESS_REQUESTED_WITH_MONITORING = 2;

    uint8 private constant OPTIONS_MONITORING = 2;

    // Error declaration
    error InsufficientFee(uint256 requiredFee, uint256 providedFee);

    error WalletTypeAlreadySupported(bytes32 walletTypeId);
    error WalletTypeNotSupported(bytes32 walletTypeId);

    error ChainIdNotSupported(bytes32 walletTypeId, bytes32 chainId);
    error ChainIdAlreadySupported(bytes32 walletTypeId, bytes32 chainId);

    error RequestNotFoundOrAlreadyProcessed(uint256 traceId);
    error InvalidOptions(uint8 option);
    error WalletNotRegisteredForMonitoring(uint256 walletIndex);

    error OwnableInvalidOwner(address owner);
    error IncorrectWalletIndex(uint256 expectedIndex, uint256 providedIndex);
    error AddressAlreadyRegistered(string addr);
    error InvalidPayloadLength(uint256 expectedLength, uint256 actualLength);
    error BroadcastNotAllowed();
    error InvalidSignature(ECDSA.RecoverError error);
    error InvalidWalletIndex(uint256 lastIndex, uint256 reqIndex);

    /// @custom:storage-location erc7201:zrsign.storage.Sign
    struct SignStorage {
        uint256 _mpcFee;
        uint256 _traceId;
        mapping(bytes32 => ZrSignTypes.ChainInfo) supportedWalletTypes; //keccak256(abi.encode(ChainInfo)) => ChainInfo
        mapping(bytes32 => mapping(bytes32 => bool)) supportedChainIds;
        mapping(bytes32 => uint256) walletsIndex;
        mapping(bytes32 => uint8) walletRegistry;
    }

    // keccak256(abi.encode(uint256(keccak256("zrsign.storage.sign")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant SIGN_STORAGE_LOCATION =
        0xa30be26d48c79c53518f37fd0be48e3bd1b55edc6a24c0bc6a2effeee4c2c800;

    function _getSignStorage() private pure returns (SignStorage storage $) {
        assembly {
            $.slot := SIGN_STORAGE_LOCATION
        }
    }

    //****************************************************************** MODIFIERS ******************************************************************/

    // Modifier to ensure the provided fee covers the base fee required by the contract
    modifier monitoringGuard(
        bytes32 walletTypeId,
        address owner,
        uint256 walletIndex
    ) {
        SignStorage storage $ = _getSignStorage();
        bytes32 walletId = _getWalletId(walletTypeId, owner, walletIndex);
        if ($.walletRegistry[walletId] < OPTIONS_MONITORING) {
            revert WalletNotRegisteredForMonitoring(walletIndex);
        }
        _;
    }

    // Modifier to ensure the specified wallet type is supported by the contract
    modifier walletTypeGuard(bytes32 walletTypeId) {
        if (getWalletTypeInfo(walletTypeId).isNull()) {
            revert WalletTypeNotSupported(walletTypeId);
        }
        _;
    }

    // Modifier to check if a specific chain ID is supported for a given wallet type
    modifier chainIdGuard(bytes32 walletTypeId, bytes32 chainId) {
        SignStorage storage $ = _getSignStorage();
        if (!isChainIdSupported(walletTypeId, chainId)) {
            revert ChainIdNotSupported(walletTypeId, chainId);
        }
        _;
    }

    //****************************************************************** INIT FUNCTIONS ******************************************************************/

    function __Sign_init() internal onlyInitializing {
        __AccessControl_init_unchained();
        __Pausable_init_unchained();
        __Sign_init_unchained();
    }

    function __Sign_init_unchained() internal onlyInitializing {}

    //****************************************************************** EXTERNAL FUNCTIONS ******************************************************************/

    /**
     * @dev See the internal function `_zrKeyReq` for the core implementation details of key request handling.
     * This reference is provided to highlight where the detailed logic and state modifications occur following the
     * initial validations and preparations made in this public-facing function.
     */
    function zrKeyReq(
        SignTypes.ZrKeyReqParams memory params
    ) external payable override walletTypeGuard(params.walletTypeId) {
        _zrKeyReq(params);
    }

    /**
     * @dev External function that handles the hashing and signing of parameters specific to the Zenrock protocol.
     * This function validates the payload length, ensuring it meets the required specifications for processing.
     * It also enforces wallet type and chain ID constraints to ensure that the operation adheres to the specified
     * requirements and security standards.
     *
     * @param params Struct containing all necessary parameters for the signing operation. This includes the wallet type ID,
     * destination chain ID, and the payload which should be exactly 32 bytes in length, among other relevant data.
     *
     * @notice This function is guarded by `walletTypeGuard` and `chainIdGuard` modifiers to ensure that the operation
     * is performed only if the wallet type is supported and the destination chain ID is valid, respectively. These checks
     * are crucial for maintaining operational integrity and security. The function reverts if the payload length is incorrect,
     * ensuring that only properly formatted requests are processed.
     */
    function zrSignHash(
        SignTypes.ZrSignParams memory params
    )
        external
        payable
        walletTypeGuard(params.walletTypeId)
        chainIdGuard(params.walletTypeId, params.dstChainId)
    {
        // Check payload length
        if (params.payload.length != 32) {
            revert InvalidPayloadLength({
                expectedLength: 32,
                actualLength: params.payload.length
            });
        }

        // Check broadcast flag
        if (params.broadcast) {
            revert BroadcastNotAllowed();
        }

        SignTypes.SigReqParams memory sigReqParams = SignTypes.SigReqParams({
            walletTypeId: params.walletTypeId,
            walletIndex: params.walletIndex,
            dstChainId: params.dstChainId,
            payload: params.payload,
            owner: _msgSender(),
            zrSignReqType: IS_HASH_MASK,
            broadcast: false // Broadcasting not relevant for a hash
        });

        _sigReq(sigReqParams);
    }

    /**
     * @dev External function to handle signing data operations. This function ensures the operation is
     * compatible with the wallet type and the destination chain ID. It specifically prohibits the broadcasting
     * of the data being signed, focusing solely on signing operations without dissemination.
     *
     * @param params Struct containing all necessary parameters for the data signing operation. This includes
     * wallet type ID, destination chain ID, and payload, among others. The function also checks if broadcasting
     * is attempted and reverts if so.
     *
     * @notice This function employs `walletTypeGuard` and `chainIdGuard` modifiers to ensure that the operation
     * conforms to valid and supported wallet types and chain IDs. It is critical that the broadcast flag is not
     * set, as broadcasting is not allowed in this function.
     */
    function zrSignData(
        SignTypes.ZrSignParams memory params
    )
        external
        payable
        walletTypeGuard(params.walletTypeId)
        chainIdGuard(params.walletTypeId, params.dstChainId)
    {
        // Check broadcast flag
        if (params.broadcast) {
            revert BroadcastNotAllowed();
        }

        SignTypes.SigReqParams memory sigReqParams = SignTypes.SigReqParams({
            walletTypeId: params.walletTypeId,
            walletIndex: params.walletIndex,
            dstChainId: params.dstChainId,
            payload: params.payload,
            owner: _msgSender(),
            zrSignReqType: IS_DATA_MASK,
            broadcast: false // Broadcasting not relevant for a hash
        });

        _sigReq(sigReqParams);
    }

    /**
     * @dev External function designed for signing transactions. Similar to `zrSignData`, this function ensures
     * compatibility with the wallet type and destination chain ID but also prepares the parameters for a transaction
     * signing request. It allows for the optional broadcasting of the signed transaction depending on the
     * `broadcast` flag.
     *
     * @param params Struct containing all necessary parameters for the transaction signing operation. These parameters
     * are converted into `SigReqParams` format and include the wallet type ID, destination chain ID, payload,
     * and owner information, tailored for transaction-specific requirements.
     *
     * @notice Uses `walletTypeGuard` and `chainIdGuard` modifiers to ensure operations are performed only with valid
     * wallet types and on supported chains. This function handles the creation of a signing request and processes
     * broadcasting based on the provided flags.
     */
    function zrSignTx(
        SignTypes.ZrSignParams memory params
    )
        external
        payable
        walletTypeGuard(params.walletTypeId)
        chainIdGuard(params.walletTypeId, params.dstChainId)
    {
        SignTypes.SigReqParams memory sigReqParams = SignTypes.SigReqParams({
            walletTypeId: params.walletTypeId,
            walletIndex: params.walletIndex,
            dstChainId: params.dstChainId,
            payload: params.payload,
            owner: _msgSender(),
            zrSignReqType: IS_TX_MASK,
            broadcast: params.broadcast
        });

        _sigReq(sigReqParams);
    }

    /**
     * @dev External function designed for signing simple transactions. Similar to `zrSignTx`, this function ensures
     * compatibility with the wallet type and destination chain ID but also prepares the parameters for a transaction
     * signing request. It allows for the optional broadcasting of the signed transaction depending on the
     * `broadcast` flag.
     *
     * @param params Struct containing all necessary parameters for the transaction signing operation. These parameters
     * are converted into `SigReqParams` format and include the wallet type ID, destination chain ID, payload,
     * and owner information, tailored for transaction-specific requirements.
     *
     * @notice Uses `walletTypeGuard`, `chainIdGuard`, and `monitoringGuard` modifiers to ensure operations are performed
     * only with valid wallet types, on supported chains, and for wallets registered with monitoring. This function handles
     * the creation of a signing request and processes broadcasting based on the provided flags.
     */
    function zrSignSimpleTx(
        SignTypes.ZrSignParams memory params
    )
        external
        payable
        override
        walletTypeGuard(params.walletTypeId)
        chainIdGuard(params.walletTypeId, params.dstChainId)
        monitoringGuard(params.walletTypeId, _msgSender(), params.walletIndex)
    {
        SignTypes.SigReqParams memory sigReqParams = SignTypes.SigReqParams({
            walletTypeId: params.walletTypeId,
            walletIndex: params.walletIndex,
            dstChainId: params.dstChainId,
            payload: params.payload,
            owner: _msgSender(),
            zrSignReqType: IS_SIMPLE_TX_MASK,
            broadcast: params.broadcast
        });

        _sigReq(sigReqParams);
    }
    //****************************************************************** VIEW EXTERNAL FUNCTIONS ******************************************************************/

    /**
     * @dev Retrieves the current trace ID from the contract's storage. The trace ID is typically used to
     * track and manage signature or key request sequences within the contract.
     *
     * @return uint256 The current trace ID stored in the contract.
     */
    function getTraceId() public view virtual override returns (uint256) {
        SignStorage storage $ = _getSignStorage();
        return $._traceId;
    }

    /**
     * @dev Returns the mpc fee required for initiating any signing or key generation request. This fee
     * is set and stored within the contract's storage and may be updated by authorized roles.
     *
     * @return uint256 The mpc fee amount required for operations, retrieved from contract storage.
     */
    function getMPCFee() external view virtual override returns (uint256) {
        SignStorage storage $ = _getSignStorage();
        return $._mpcFee;
    }

    function estimateFee(uint8 options) external view virtual override returns (uint256) {
        return _estimateFee(options);
    }

    /**
     * @dev Returns the version of the contract as a uint256. This is typically used to manage upgrades
     * and ensure compatibility with interfaces or dependent contracts.
     *
     * @return uint256 The current version number of the contract.
     */
    function version() external view virtual override returns (uint256) {
        return _getInitializedVersion();
    }

    //****************************************************************** VIEW PUBLIC FUNCTIONS ******************************************************************/

    /**
     * @dev Returns the version of the contract as a uint256. This is typically used to manage upgrades
     * and ensure compatibility with interfaces or dependent contracts.
     *
     * @return uint256 The current version number of the contract.
     */
    function getWalletTypeInfo(
        bytes32 walletTypeId
    ) public view virtual override returns (ZrSignTypes.ChainInfo memory) {
        SignStorage storage $ = _getSignStorage();
        return $.supportedWalletTypes[walletTypeId];
    }

    /**
     * @dev Checks if a wallet type is supported by the contract. This function is critical for validation
     * processes that require confirmation of supported wallet types before proceeding with operations.
     *
     * @param walletTypeId The identifier for the wallet type being checked.
     * @return bool True if the wallet type is supported, false otherwise.
     */
    function isWalletTypeSupported(
        bytes32 walletTypeId
    ) public view virtual override returns (bool) {
        SignStorage storage $ = _getSignStorage();
        return $.supportedWalletTypes[walletTypeId].isNotNull();
    }

    /**
     * @dev Determines whether a specific chain ID is supported for a given wallet type. This check
     * is essential for operations that must validate the compatibility of wallet types with specific
     * blockchain networks.
     *
     * @param walletTypeId The wallet type identifier for which the chain ID support is being checked.
     * @param chainId The chain ID being checked for support under the specified wallet type.
     * @return bool True if the chain ID is supported for the given wallet type, false otherwise.
     */
    function isChainIdSupported(
        bytes32 walletTypeId,
        bytes32 chainId
    ) public view virtual override returns (bool) {
        SignStorage storage $ = _getSignStorage();
        return $.supportedChainIds[walletTypeId][chainId];
    }

    function getWalletRegistry(
        bytes32 walletTypeId,
        uint256 walletIndex,
        address owner
    ) public view virtual override returns (uint8) {
        SignStorage storage $ = _getSignStorage();
        bytes32 walletId = _getWalletId(walletTypeId, owner, walletIndex);
        return $.walletRegistry[walletId];
    }

    function getWalletsIndex(
        bytes32 walletTypeId,
        address owner
    ) public view virtual override returns (uint256) {
        return _getWalletsIndex(walletTypeId, owner);
    }

    //****************************************************************** INTERNAL FUNCTIONS ******************************************************************/

    function _getWalletsIndex(
        bytes32 walletTypeId,
        address owner
    ) internal view virtual returns (uint256) {
        SignStorage storage $ = _getSignStorage();
        bytes32 walletId = _getUserWorkspaceId(walletTypeId, owner);
        return $.walletsIndex[walletId];
    }

    /**
     * @dev Internal function to estimate the fee required for a request. This function calculates the
     * total fee based on whether monitoring is included.
     *
     * @param options The flag specifying if monitoring is set or not.
     * @return mpc The fee related to MPC.
     */
    function _estimateFee(uint8 options) internal view returns (uint256 mpc) {
        if (options == 0) {
            revert InvalidOptions(options);
        }

        SignStorage storage $ = _getSignStorage();

        mpc = $._mpcFee * options;

        return mpc;
    }
    /**
     * @dev Sets the base fee for operations within the contract. This fee is required for key or signature requests
     * and can be updated to reflect changes in operational or network costs.
     *
     * @param newMPCFee The new base fee to set.
     *
     * @notice Emits a `MPCFeeUpdate` event indicating the change from the old base fee to the new base fee.
     */
    function _updateMPCFee(uint256 newMPCFee) internal virtual {
        SignStorage storage $ = _getSignStorage();

        emit MPCFeeUpdate($._mpcFee, newMPCFee);

        $._mpcFee = newMPCFee;
    }

    /**
     * @dev Internal function that logs a key request event. This function is called as part of the key request flow,
     * typically from a public or external function that processes the initial key request. It handles the internal
     * registration of the request by assigning a unique ID and emits a relevant event.
     *
     * @param params Struct containing all necessary parameters for the key request. This includes the type of wallet,
     * the sender's address, and other contextual information necessary to process the request.
     *
     * @notice This function should only be called after all preconditions, such as fee verification and authorization checks,
     * have been met.
     */
    function _zrKeyReq(SignTypes.ZrKeyReqParams memory params) internal virtual whenNotPaused {
        if (params.options == 0) {
            revert InvalidOptions(params.options);
        }
        SignStorage storage $ = _getSignStorage();

        uint256 walletIndex = _getWalletsIndex(params.walletTypeId, _msgSender());

        bytes32 walletId = _getWalletId(params.walletTypeId, _msgSender(), walletIndex);

        $.walletRegistry[walletId] = params.options;

        $.walletsIndex[walletId] += 1;

        emit ZrKeyRequest(params.walletTypeId, _msgSender(), walletIndex, params.options);
    }

    /**
     * @dev Internal function to process a signature request. This function validates the address of the wallet,
     * increments a trace ID for tracking, and logs the initiation of the signature request. It's designed to be
     * called from a public or external function that handles the initial user request for signing.
     *
     * @param params Struct containing the parameters necessary for the signature request. This includes the wallet type ID,
     * the owner's address, and the wallet index which are used to compute the wallet ID and validate the address.
     * The `payload` within params is used to calculate the fee.
     *
     * @notice This function also applies the `sigFee` modifier to ensure that the appropriate fees are paid with the request.
     * Ensure that all addresses and wallet indices are validated prior to calling this function.
     */
    function _sigReq(SignTypes.SigReqParams memory params) internal virtual whenNotPaused {
        SignStorage storage $ = _getSignStorage();
        bytes32 walletId = _getWalletId(params.walletTypeId, _msgSender(), params.walletIndex);

        uint256 mpcFee = _estimateFee($.walletRegistry[walletId]);
        if (msg.value < mpcFee) {
            revert InsufficientFee({ requiredFee: mpcFee, providedFee: msg.value });
        }
        uint256 walletIndex = _getWalletsIndex(params.walletTypeId, params.owner);

        if (walletIndex < params.walletIndex) {
            revert InvalidWalletIndex({ lastIndex: walletIndex, reqIndex: params.walletIndex });
        }

        $._traceId = $._traceId + 1;

        emit ZrSigRequest(
            $._traceId,
            walletId,
            params.walletTypeId,
            params.owner,
            params.walletIndex,
            params.dstChainId,
            params.payload,
            params.zrSignReqType,
            params.broadcast
        );
    }

    /**
     * @dev Configures support for a specific wallet type by hashing its information and updating the storage.
     * This function allows for the addition or removal of wallet types in the contract's supported list.
     *
     * @param c The chain information struct that describes the wallet type.
     * @param support Boolean flag indicating whether to support (true) or remove support (false) for the wallet type.
     * @return bytes32 The wallet type ID generated from the chain information hash.
     *
     * @notice This function can revert if attempting to add a wallet type that is already supported.
     */
    function _walletTypeIdConfig(
        ZrSignTypes.ChainInfo memory c,
        bool support
    ) internal virtual returns (bytes32) {
        SignStorage storage $ = _getSignStorage();
        bytes32 walletTypeId = c.hashChainInfo();
        if (support) {
            if (getWalletTypeInfo(walletTypeId).isNotNull()) {
                revert WalletTypeAlreadySupported(walletTypeId);
            }
            $.supportedWalletTypes[walletTypeId] = c;
        } else {
            if (getWalletTypeInfo(walletTypeId).isNull()) {
                revert WalletTypeNotSupported(walletTypeId);
            }
            delete $.supportedWalletTypes[walletTypeId];
        }
        return walletTypeId;
    }

    /**
     * @dev Configures support for a specific chain ID for a given wallet type. This function is used to manage
     * which chain IDs are supported for each wallet type, allowing for dynamic adjustments.
     *
     * @param walletTypeId The identifier for the wallet type.
     * @param chainId The chain ID to configure support for.
     * @param support Boolean indicating whether to add (true) or remove (false) support for the chain ID.
     *
     * @notice This function is protected by `walletTypeGuard` to ensure the wallet type is supported.
     * It can revert if attempting to add a chain ID that is already supported for the wallet type.
     */
    function _chainIdConfig(
        bytes32 walletTypeId,
        bytes32 chainId,
        bool support
    ) internal virtual walletTypeGuard(walletTypeId) {
        SignStorage storage $ = _getSignStorage();
        if (support) {
            if (isChainIdSupported(walletTypeId, chainId)) {
                revert ChainIdAlreadySupported(walletTypeId, chainId);
            }
            $.supportedChainIds[walletTypeId][chainId] = true;
        } else {
            if (!isChainIdSupported(walletTypeId, chainId)) {
                revert ChainIdNotSupported(walletTypeId, chainId);
            }
            delete $.supportedChainIds[walletTypeId][chainId];
        }
    }

    //****************************************************************** INTERNAL PURE FUNCTIONS ******************************************************************/

    /**
     * @dev Generates a unique identifier for a wallet based on the wallet type and owner. This ID is used to
     * index and retrieve wallet-related data in storage.
     *
     * @param walletTypeId The identifier for the wallet type.
     * @param owner The owner's address for which the ID is being generated.
     * @return id bytes32 A unique identifier derived from the chain ID, contract address, wallet type, and owner's address.
     */
    function _getUserWorkspaceId(
        bytes32 walletTypeId,
        address owner
    ) internal view virtual returns (bytes32 id) {
        return keccak256(abi.encode(block.chainid, address(this), walletTypeId, owner));
    }

    function _getWalletId(
        bytes32 walletTypeId,
        address owner,
        uint256 walletIndex
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(walletTypeId, owner, walletIndex));
    }
}
