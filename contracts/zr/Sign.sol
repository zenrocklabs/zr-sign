// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.19;

// Importing necessary modules from local and external sources
import { AccessControlUpgradeable } from "../AccessControlUpgradeable.sol"; // Access control functionalities for role management
import { PausableUpgradeable } from "../PausableUpgradeable.sol"; // Pausable control functionalities
import { ECDSA } from "../libraries/ECDSA.sol"; // Library for Elliptic Curve Digital Signature Algorithm operations
import { MessageHashUtils } from "../libraries/MessageHashUtils.sol"; // Utility functions for message hashing
import { ReentrancyGuardUpgradeable } from "../ReentrancyGuardUpgradeable.sol";

import { ISign } from "../interfaces/zr/ISign.sol"; // Interface for the Sign contract
import { SignTypes } from "../libraries/zr/SignTypes.sol"; // Definitions of various types used within the Sign contract
import { ZrSignTypes } from "../libraries/zr/ZrSignTypes.sol"; // Definitions of types specific to Zenrock implementations

// Abstract contract for signing functionalities, inheriting from AccessControl for role management
abstract contract Sign is
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    ISign
{
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
    uint8 public constant IS_TX_MASK = 1 << 1; // 0b0010
    uint8 public constant IS_SIMPLE_TX_MASK = 1 << 2; // 0b0100 //Simple Tx => to, value, data.

    uint8 public constant WALLET_REQUESTED = 1;
    uint8 public constant WALLET_REGISTERED = 2;

    uint8 public constant OPTIONS_MONITORING = 2;

    uint8 public constant SIG_REQ_IN_PROGRESS = 1;
    uint8 public constant SIG_REQ_ALREADY_PROCESSED = 2;

    // Error declaration
    error InsufficientFee(uint256 requiredFee, uint256 providedFee);

    error WalletTypeAlreadySupported(bytes32 walletTypeId);
    error WalletTypeNotSupported(bytes32 walletTypeId);

    error ChainIdNotSupported(bytes32 walletTypeId, bytes32 chainId);
    error ChainIdAlreadySupported(bytes32 walletTypeId, bytes32 chainId);

    error RequestNotFoundOrAlreadyProcessed(uint256 traceId);

    error InvalidOptions(uint8 option);

    error OwnableInvalidOwner(address owner);
    error IncorrectWalletIndex(uint256 expectedIndex, uint256 providedIndex);

    error WalletAlreadyRegistered(string wallet);
    error WalletNotRequested(string wallet);
    error WalletNotRegisteredForMonitoring(uint256 walletIndex);

    error InvalidWalletIndex(uint256 walletIndex);

    error BroadcastNotAllowed();
    error InvalidSignature(ECDSA.RecoverError error);
    error InvalidAddressLength(uint256 minLength, uint256 actualLength);

    /// @custom:storage-location erc7201:zrsign.storage.Sign
    struct SignStorage {
        uint256 _mpcFee;
        uint256 _totalMPCFee;
        uint256 _respGas;
        uint256 _respGasPriceBuffer;
        uint256 _traceId;
        mapping(bytes32 => ZrSignTypes.ChainInfo) supportedWalletTypes; //keccak256(abi.encode(ChainInfo)) => ChainInfo
        mapping(bytes32 => mapping(bytes32 => bool)) supportedChainIds;
        mapping(bytes32 => string[]) wallets;
        mapping(bytes32 => SignTypes.WalletRegistry) walletReg;
        mapping(uint256 => SignTypes.ReqRegistry) reqReg;
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

    modifier monitoringGuard(
        bytes32 walletTypeId,
        address owner,
        uint256 walletIndex
    ) {
        SignStorage storage $ = _getSignStorage();
        bytes32 walletId = _getWalletId(walletTypeId, owner, walletIndex);
        if ($.walletReg[walletId].options < OPTIONS_MONITORING) {
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

    // Modifier to ensure the owner address provided is valid and not zero
    modifier ownerGuard(address owner) {
        if (owner == address(0)) {
            revert OwnableInvalidOwner(owner);
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
     * @dev See the internal function `_zrKeyRes` for the core implementation details of key response handling.
     * This reference is provided to highlight where the detailed logic and state modifications occur following the
     * initial validations and preparations made in this public-facing function.
     */
    function zrKeyRes(
        SignTypes.ZrKeyResParams memory params
    ) external override walletTypeGuard(params.walletTypeId) ownerGuard(params.owner) {
        _zrKeyRes(params);
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
     * is performed only if the wallet type is supported and the destination chain ID is valid,respectively. These checks
     * are crucial for maintaining operational integrity and security. The function reverts if the payload length is incorrect,
     * ensuring that only properly formatted requests are processed.
     */
    function zrSignHash(
        SignTypes.ZrSignParams memory params
    )
        external
        payable
        override
        walletTypeGuard(params.walletTypeId)
        chainIdGuard(params.walletTypeId, params.dstChainId)
    {
        // Check broadcast flag
        if (params.broadcast) {
            revert BroadcastNotAllowed(); // Broadcasting not relevant for a hash
        }

        SignTypes.SigReqParams memory sigReqParams = SignTypes.SigReqParams({
            walletTypeId: params.walletTypeId,
            walletIndex: params.walletIndex,
            dstChainId: params.dstChainId,
            payload: params.payload,
            owner: _msgSender(),
            zrSignReqType: IS_HASH_MASK,
            broadcast: params.broadcast
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
        override
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

    /**
     * @dev See the internal function `_sigRes` for the core implementation details of sig response handling.
     * This reference is provided to highlight where the detailed logic.
     */
    function zrSignRes(SignTypes.SignResParams memory params) external virtual override {
        _sigRes(params);
    }

    //****************************************************************** VIEW EXTERNAL FUNCTIONS ******************************************************************/

    /**
     * @dev See the internal function `_estimateFee` for the core implementation details of fee estimation.
     * This reference is provided to highlight where the detailed logic and calculations occur following the
     * initial parameter preparations made in this public-facing function.
     */
    function estimateFee(
        bytes32 walletTypeId,
        address owner,
        uint256 walletIndex,
        uint256 value
    ) external view virtual override returns (uint256, uint256, uint256) {
        return _estimateFee(walletTypeId, owner, walletIndex, value);
    }

    /**
     * @dev See the internal function `_estimateFee` for the core implementation details of fee estimation.
     * This reference is provided to highlight where the detailed logic and calculations occur following the
     * initial parameter preparations made in this public-facing function.
     */
    function estimateFee(
        uint8 options,
        uint256 value
    ) external view virtual override returns (uint256, uint256, uint256) {
        return _estimateFee(options, value);
    }

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
     * @dev Retrieves the current request state from the contract's storage. The trace ID is typically used to
     * track and manage signature or key request sequences within the contract.
     *
     * @param traceId The trace ID of the request.
     *
     * @return uint256 The current state stored in the contract.
     */
    function getRequestState(
        uint256 traceId
    ) public view virtual override returns (SignTypes.ReqRegistry memory) {
        SignStorage storage $ = _getSignStorage();
        return $.reqReg[traceId];
    }

    /**
     * @dev Returns the base fee required for initiating any signing or key generation request. This fee
     * is set and stored within the contract's storage and may be updated by authorized roles.
     *
     * @return uint256 The base fee amount required for operations, retrieved from contract storage.
     */
    function getMPCFee() external view virtual override returns (uint256) {
        SignStorage storage $ = _getSignStorage();
        return $._mpcFee;
    }

    function getRespGas() external view virtual override returns (uint256) {
        SignStorage storage $ = _getSignStorage();
        return $._respGas;
    }

    function getRespGasPriceBuffer() external view virtual override returns (uint256) {
        SignStorage storage $ = _getSignStorage();
        return $._respGasPriceBuffer;
    }

    /**
     * @dev Retrieves a list of all keys associated with a specific wallet type and owner. This function is
     * useful for external parties or contract interactions that need to audit or verify the keys held by a particular
     * user or operation.
     *
     * @param walletTypeId The type ID of the wallet for which keys are being requested.
     * @param owner The address of the wallet owner.
     * @return string[] An array of keys for the specified wallet type and owner.
     */
    function getZrKeys(
        bytes32 walletTypeId,
        address owner
    ) external view virtual override returns (string[] memory) {
        return _getWallets(walletTypeId, owner);
    }

    /**
     * @dev Fetches a specific key from a wallet based on the wallet type, owner, and index. This is used to
     * retrieve detailed information about individual keys when needed.
     *
     * @param walletTypeId The type ID of the wallet which the key belongs to.
     * @param owner The address of the owner of the wallet.
     * @param index The index of the key within the wallet to retrieve.
     * @return string The key at the specified index for the given wallet type and owner.
     */
    function getZrKey(
        bytes32 walletTypeId,
        address owner,
        uint256 index
    ) external view virtual override returns (string memory) {
        return _getWalletByIndex(walletTypeId, owner, index);
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
    ) public view virtual override returns (SignTypes.WalletRegistry memory) {
        SignStorage storage $ = _getSignStorage();
        return $.walletReg[_getWalletId(walletTypeId, owner, walletIndex)];
    }

    function getColletedFees() public view virtual returns (uint256) {
        SignStorage storage $ = _getSignStorage();
        return $._totalMPCFee;
    }

    //****************************************************************** INTERNAL FUNCTIONS ******************************************************************/

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

        bytes32 userWorkspaceId = _getUserWorkspaceId(params.walletTypeId, params.owner);
        uint256 walletIndex = $.wallets[userWorkspaceId].length;
        bytes32 walletId = _getWalletId(params.walletTypeId, params.owner, walletIndex);

        (uint256 mpc, uint256 netResp, uint256 totalFee) = _estimateFee(
            params.options,
            msg.value
        );

        if (msg.value < totalFee) {
            revert InsufficientFee({ requiredFee: totalFee, providedFee: msg.value });
        }

        if ($.walletReg[walletId].status >= WALLET_REQUESTED) {
            uint256 currentValue = $.walletReg[walletId].value;
            $.walletReg[walletId].value = currentValue + totalFee;
        } else {
            $._totalMPCFee += mpc;
            $.walletReg[walletId] = SignTypes.WalletRegistry({
                status: WALLET_REQUESTED,
                options: params.options,
                value: netResp
            });
        }

        emit ZrKeyRequest(params.walletTypeId, params.owner, walletIndex, params.options);
    }

    /**
     * @dev Internal function that processes the response for a key request. It is used to validate the authenticity and
     * integrity of the key response through signature verification and then updates the contract state with the new key
     * information. It is called by an external method that receives the key generation results.
     *
     * @param params Struct containing response parameters, including the wallet type, owner address, wallet index, address,
     * and the authorization signature proving the key's legitimacy.
     *
     * @notice This function performs crucial validations such as signature authenticity and address integrity. It ensures
     * that the wallet index is correct, preventing unauthorized key updates.
     */
    function _zrKeyRes(SignTypes.ZrKeyResParams memory params) internal virtual whenNotPaused {
        SignStorage storage $ = _getSignStorage();

        bytes memory payload = abi.encode(
            SRC_CHAIN_ID,
            params.walletTypeId,
            params.owner,
            params.walletIndex,
            params.wallet,
            params.options
        );

        bytes32 payloadHash = keccak256(payload).toEthSignedMessageHash();
        _mustValidateAuthSignature(payloadHash, params.authSignature);

        _validateAddress(params.wallet);

        bytes32 userWorkspaceId = _getUserWorkspaceId(params.walletTypeId, params.owner);

        if ($.wallets[userWorkspaceId].length != params.walletIndex) {
            revert IncorrectWalletIndex({
                expectedIndex: $.wallets[userWorkspaceId].length,
                providedIndex: params.walletIndex
            });
        }

        bytes32 walletId = _getWalletId(params.walletTypeId, params.owner, params.walletIndex);
        SignTypes.WalletRegistry memory reg = $.walletReg[walletId];
        if (reg.status != WALLET_REQUESTED) {
            revert WalletNotRequested({ wallet: params.wallet });
        }

        if (reg.status == WALLET_REGISTERED) {
            revert WalletAlreadyRegistered({ wallet: params.wallet });
        }

        $.wallets[userWorkspaceId].push(params.wallet);
        $.walletReg[walletId].status = WALLET_REGISTERED;

        emit ZrKeyResolve(params.walletTypeId, params.owner, params.walletIndex, params.wallet);

        // Calculate the actual gas used and the refund amount
        _processGasRefund($._respGas, $.walletReg[walletId].value, params.owner);
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
        (uint256 mpc, uint256 netResp, uint256 totalFee) = _estimateFee(
            params.walletTypeId,
            params.owner,
            params.walletIndex,
            msg.value
        );
        if (msg.value < totalFee) {
            revert InsufficientFee({ requiredFee: totalFee, providedFee: msg.value });
        }

        SignStorage storage $ = _getSignStorage();

        bytes32 walletId = _getWalletId(params.walletTypeId, params.owner, params.walletIndex);
        SignTypes.WalletRegistry memory reg = $.walletReg[walletId];

        if (reg.status != WALLET_REGISTERED) {
            revert InvalidWalletIndex(params.walletIndex);
        }

        $._traceId = $._traceId + 1;

        $.reqReg[$._traceId] = SignTypes.ReqRegistry({
            status: SIG_REQ_IN_PROGRESS,
            value: netResp
        });

        $._totalMPCFee += mpc;

        emit ZrSigRequest($._traceId, walletId, params);
    }

    /**
     * @dev Internal function to finalize the signature response. This function checks the authenticity of the
     * authorization signature against the combined payload and logs the resolution of the signature operation.
     * It is typically called by an external function responsible for receiving and processing the signature
     * response from a signer.
     *
     * @param params Struct containing the response parameters, including the trace ID, the signature itself, and a broadcast flag
     * indicating whether the signature should be broadcasted. These parameters are encoded and hashed to validate the auth signature.
     *
     * @notice This function validates the authorization signature to ensure it matches the expected payload hash.
     * The function emits a `ZrSigResolve` event indicating the resolution of a signature request.
     */
    function _sigRes(SignTypes.SignResParams memory params) internal virtual whenNotPaused {
        SignStorage storage $ = _getSignStorage();

        bytes memory payload = abi.encode(
            SRC_CHAIN_ID,
            params.traceId,
            params.owner,
            params.metaData,
            params.signature,
            params.broadcast
        );

        bytes32 payloadHash = keccak256(payload).toEthSignedMessageHash();

        if ($.reqReg[params.traceId].status != SIG_REQ_IN_PROGRESS) {
            revert RequestNotFoundOrAlreadyProcessed({ traceId: params.traceId });
        }

        _mustValidateAuthSignature(payloadHash, params.authSignature);

        $.reqReg[params.traceId].status = SIG_REQ_ALREADY_PROCESSED;

        emit ZrSigResolve(params.traceId, params.metaData, params.signature, params.broadcast);
        uint256 netRespValue = $.reqReg[params.traceId].value;
        uint256 initialGas = $._respGas;
        // Calculate the actual gas used and the refund amount
        _processGasRefund(initialGas, netRespValue, params.owner);
    }

    function _processGasRefund(
        uint256 initialGas,
        uint256 netRespFee,
        address recipient
    ) internal nonReentrant {
        uint256 lowLevelCallGas = 7210;
        uint256 gasPrice = tx.gasprice;
        address payable sender = payable(_msgSender());

        uint256 gasUsed = (initialGas - gasleft()) + lowLevelCallGas;
        uint256 actualGasCost = gasUsed * gasPrice;
        if ((netRespFee + lowLevelCallGas) > actualGasCost) {
            actualGasCost = (gasUsed + lowLevelCallGas) * gasPrice;
            (bool successGasCost, ) = sender.call{ value: actualGasCost }(""); // 7210 gas
            require(successGasCost, "Transfer failed");

            uint256 excessAmount = netRespFee - actualGasCost;
            (bool successExcess, ) = recipient.call{ value: excessAmount }(""); // 7210 gas
            require(successExcess, "Transfer failed");
        } else {
            (bool successNetResp, ) = sender.call{ value: netRespFee }(""); // 7210 gas
            require(successNetResp, "Transfer failed");
        }
    }

    /**
     * @dev Internal function to validate an authorization signature against a given data hash. This function is critical
     * for ensuring the integrity and authenticity of actions within the contract that require verified approval,
     * typically those involving key or signature operations. It uses ECDSA for signature recovery and validation.
     *
     * @param dataHash The keccak256 hash of the data for which the signature is being verified. This data hash
     * should encapsulate all relevant information that the signature purports to authorize.
     * @param signature The digital signature provided for verification against the data hash. It must be produced by
     * the appropriate private key corresponding to the address that is expected to authorize the action.
     *
     * @notice If the signature does not correctly match the expected address derived from the data hash,
     * or if any error occurs in the recovery process, this function reverts the transaction. This ensures that
     * only valid, verifiable actions are processed.
     */
    function _mustValidateAuthSignature(
        bytes32 dataHash,
        bytes memory signature
    ) internal virtual {
        (address authAddress, ECDSA.RecoverError sigErr, ) = dataHash.tryRecover(signature);

        if (sigErr != ECDSA.RecoverError.NoError) {
            revert InvalidSignature(sigErr);
        }

        if (!hasRole(MPC_ROLE, authAddress)) {
            revert AccessControlUnauthorizedAccount(authAddress, MPC_ROLE);
        }
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

    function _withdrawMPCFees() internal virtual {
        SignStorage storage $ = _getSignStorage();

        address payable sender = payable(_msgSender());
        uint256 amount = $._totalMPCFee;
        (bool success, ) = sender.call{ value: amount }("");
        require(success, "Failed to send Ether"); // Checks if the low-level call was successful
        $._totalMPCFee = 0;

        emit MPCFeeWithdraw(sender, amount);
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

    function _updateRespGas(uint256 newRespGas) internal virtual {
        SignStorage storage $ = _getSignStorage();
        emit RespGasUpdate($._respGas, newRespGas);
        $._respGas = newRespGas;
    }

    function _updateRespGasBuff(uint256 newRespGasPriceBuff) internal virtual {
        SignStorage storage $ = _getSignStorage();
        emit RespGasPriceBufferUpdate($._respGasPriceBuffer, newRespGasPriceBuff);
        $._respGasPriceBuffer = newRespGasPriceBuff;
    }
    
    //****************************************************************** INTERNAL VIEW FUNCTIONS ******************************************************************/

    /**
     * @dev Internal function to estimate the fee required for a request. This function calculates the
     * total fee based on whether the wallet is registered with monitoring and calculates the response fee.
     *
     * @param walletTypeId The type ID of the wallet for which the fee is being estimated.
     * @param owner The address of the wallet owner.
     * @param walletIndex The index of the wallet within the owner's list of wallets.
     * @param value msg.value sent by the user.
     * @return mpc The fee related to MPC.
     * @return netResp The estimated response fee.
     * @return total The total estimated fee required for the request.
     */
    function _estimateFee(
        bytes32 walletTypeId,
        address owner,
        uint256 walletIndex,
        uint256 value
    ) internal view virtual returns (uint256 mpc, uint256 netResp, uint256 total) {
        SignStorage storage $ = _getSignStorage();

        bytes32 walletId = _getWalletId(walletTypeId, owner, walletIndex);

        if ($.walletReg[walletId].options == 0) {
            revert InvalidOptions($.walletReg[walletId].options);
        }

        mpc = $._mpcFee * $.walletReg[walletId].options;

        netResp = ($._respGas * ((block.basefee * $._respGasPriceBuffer) / 100));
        total = mpc + netResp;

        // If the user sends more than the calculated total, add the excess to netResp
        if (value > total) {
            netResp += (value - total);
            total = mpc + netResp;
        }

        return (mpc, netResp, total);
    }

    /**
     * @dev Internal function to estimate the fee required for a request. This function calculates the
     * total fee based on whether monitoring is included and calculates the response fee.
     *
     * @param options The flag specifying if monitoring is set or not.
     * @param value msg.value sent by the user.
     * @return mpc The fee related to MPC.
     * @return netResp The estimated response fee.
     * @return total The total estimated fee required for the request.
     */
    function _estimateFee(
        uint8 options,
        uint256 value
    ) internal view returns (uint256 mpc, uint256 netResp, uint256 total) {
        if (options == 0) {
            revert InvalidOptions(options);
        }

        SignStorage storage $ = _getSignStorage();
        mpc = $._mpcFee * options;

        netResp = ($._respGas * ((block.basefee * $._respGasPriceBuffer) / 100));

        total = mpc + netResp;

        // If the user sends more than the calculated total, add the excess to netResp
        if (value > total) {
            netResp += (value - total);
            total = mpc + netResp;
        }

        return (mpc, netResp, total);
    }

    /**
     * @dev Retrieves a specific wallet by its index from the storage. This is used to access detailed information
     * about individual wallets under a particular wallet type and owner.
     *
     * @param walletTypeId The identifier for the wallet type.
     * @param owner The owner's address whose wallet is being accessed.
     * @param index The index of the wallet in the list of wallets owned by the specified owner.
     * @return string The wallet information at the specified index.
     */
    function _getWalletByIndex(
        bytes32 walletTypeId,
        address owner,
        uint256 index
    ) internal view virtual returns (string memory) {
        SignStorage storage $ = _getSignStorage();

        bytes32 userWorkspaceId = _getUserWorkspaceId(walletTypeId, owner);
        return $.wallets[userWorkspaceId][index];
    }

    /**
     * @dev Retrieves all wallets associated with a given wallet type and owner. This function is useful for
     * operations that need to interact with or display all wallets owned by a particular user under a specific wallet type.
     *
     * @param walletTypeId The identifier for the wallet type.
     * @param owner The owner's address whose wallets are being retrieved.
     * @return string[] An array of all wallets associated with the given wallet type and owner.
     */
    function _getWallets(
        bytes32 walletTypeId,
        address owner
    ) internal view virtual returns (string[] memory) {
        SignStorage storage $ = _getSignStorage();
        return $.wallets[_getUserWorkspaceId(walletTypeId, owner)];
    }

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
    ) internal view virtual returns (bytes32) {
        return
            keccak256(
                abi.encode(block.chainid, address(this), walletTypeId, owner, walletIndex)
            );
    }

    //****************************************************************** INTERNAL PURE FUNCTIONS ******************************************************************/

    /**
     * @dev Validates the address by checking its length. This function ensures that the address meets
     * the minimum length requirement, providing basic validation that is crucial for security.
     *
     * @param addr The address to validate.
     *
     * @notice Reverts if the address length is not sufficient, indicating an invalid or malformed key.
     */
    function _validateAddress(string memory addr) internal pure virtual {
        uint256 length = abi.encodePacked(addr).length;
        if (length <= 4) {
            revert InvalidAddressLength({ minLength: 5, actualLength: length });
        }
    }
}
