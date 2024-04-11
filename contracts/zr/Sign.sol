// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.20;

import { AccessControl } from "../AccessControl.sol";
import { ECDSA } from "../../libraries/ECDSA.sol";
import { MessageHashUtils } from "../../libraries/MessageHashUtils.sol";

import { ISign } from "../../interfaces/zr/ISign.sol";
import { SignTypes } from "../../libraries/zr/SignTypes.sol";
import { ZrSignTypes } from "../../libraries/zr/ZrSignTypes.sol";

abstract contract Sign is AccessControl, ISign {
    using ZrSignTypes for ZrSignTypes.ChainInfo;
    using MessageHashUtils for bytes32;
    using ECDSA for bytes32;

    bytes32 public constant MPC_ROLE =
        0x1788cbbd6512d9aa8da743e475ce7cbbc6aea08b483d7cd0c00586734a4f6f14; //keccak256("zenrock.role.mpc");

    bytes32 public constant SRC_WALLET_TYPE_ID =
        0xe146c2986893c43af5ff396310220be92058fb9f4ce76b929b80ef0d5307100a; // keccak256(abi.encode(ChainInfo{purpose:44 coinType: 60}));
    bytes32 public constant SRC_CHAIN_ID =
        0xafa90c317deacd3d68f330a30f96e4fa7736e35e8d1426b2e1b2c04bce1c2fb7; //keccak256(abi.encodePacked("eip155:11155111"));

    uint8 public constant IS_HASH_MASK = 1 << 0; // 0b0001
    uint8 public constant IS_DATA_MASK = 1 << 1; // 0b0010
    uint8 public constant IS_TX_MASK = 1 << 2; // 0b0100;

    // Error declaration
    error InsufficientFee(uint256 requiredFee, uint256 providedFee);

    error WalletTypeAlreadySupported(bytes32 walletTypeId);
    error WalletTypeNotSupported(bytes32 walletTypeId);

    error ChainIdNotSupported(bytes32 walletTypeId, bytes32 chainId);
    error ChainIdAlreadySupported(bytes32 walletTypeId, bytes32 chainId);

    error OwnableInvalidOwner(address owner);
    error IncorrectWalletIndex(uint256 expectedIndex, uint256 providedIndex);
    error InvalidPayloadLength(uint256 expectedLength, uint256 actualLength);
    error BroadcastNotAllowed();
    error InvalidSignature(ECDSA.RecoverError error);
    error UnauthorizedCaller(address caller);
    error InvalidPublicKeyLength(uint256 minLength, uint256 actualLength);

    struct SignStorage {
        uint256 _baseFee;
        uint256 _networkFee;
        uint256 _traceId;
        mapping(bytes32 => ZrSignTypes.ChainInfo) supportedWalletTypes; //keccak256(abi.encode(ChainInfo)) => ChainInfo
        mapping(bytes32 => mapping(bytes32 => bool)) supportedChainIds;
        mapping(bytes32 => string[]) wallets;
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

    // Modifier that checks if the provided fee is sufficient
    modifier keyFee() {
        SignStorage storage $ = _getSignStorage();
        if (msg.value < $._baseFee) {
            revert InsufficientFee({
                requiredFee: $._baseFee,
                providedFee: msg.value
            });
        }
        _;
    }

    modifier sigFee(bytes memory payload) {
        SignStorage storage $ = _getSignStorage();
        uint256 networkFee = payload.length * $._networkFee;
        uint256 totalFee = $._baseFee + networkFee;
        if (msg.value < totalFee) {
            revert InsufficientFee({
                requiredFee: totalFee,
                providedFee: msg.value
            });
        }
        _;
    }

    modifier walletTypeGuard(bytes32 walletTypeId) {
        if (getWalletTypeInfo(walletTypeId).isNull()) {
            revert WalletTypeNotSupported(walletTypeId);
        }
        _;
    }

    modifier chainIdGuard(bytes32 walletTypeId, bytes32 chainId) {
        SignStorage storage $ = _getSignStorage();
        if (!isChainIdSupported(walletTypeId, chainId)) {
            revert ChainIdNotSupported(walletTypeId, chainId);
        }
        _;
    }

    modifier ownerGuard(address owner) {
        if (owner == address(0)) {
            revert OwnableInvalidOwner(owner);
        }
        _;
    }

    //****************************************************************** INIT FUNCTIONS ******************************************************************/

    function __Sign_init() internal onlyInitializing {
        __Sign_init_unchained();
    }

    function __Sign_init_unchained() internal onlyInitializing {}

    //****************************************************************** EXTERNAL FUNCTIONS ******************************************************************/

    function zrKeyReq(
        SignTypes.ZrKeyReqParams memory params
    ) external payable keyFee walletTypeGuard(params.walletTypeId) {
        _zrKeyReq(params);
    }

    function zrKeyRes(
        SignTypes.ZrKeyResParams memory params
    ) external walletTypeGuard(params.walletTypeId) ownerGuard(params.owner) {
        _zrKeyRes(params);
    }

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
            isHashDataTx: IS_HASH_MASK,
            broadcast: false // Broadcasting not relevant for a hash
        });

        _sigReq(sigReqParams);
    }

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
            isHashDataTx: IS_DATA_MASK,
            broadcast: false // Broadcasting not relevant for a hash
        });

        _sigReq(sigReqParams);
    }

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
            isHashDataTx: IS_TX_MASK,
            broadcast: params.broadcast
        });

        _sigReq(sigReqParams);
    }

    function zrSignRes(
        SignTypes.SignResParams memory params
    ) external virtual override {
        _resSig(params);
    }

    //****************************************************************** VIEW EXTERNAL FUNCTIONS ******************************************************************/
    function getTraceId() public view virtual override returns (uint256) {
        SignStorage storage $ = _getSignStorage();
        return $._traceId;
    }

    function getBaseFee() external view virtual override returns (uint256) {
        SignStorage storage $ = _getSignStorage();
        return $._baseFee;
    }

    function getNetworkFee() external view virtual override returns (uint256) {
        SignStorage storage $ = _getSignStorage();

        return $._networkFee;
    }

    function getZrKeys(
        bytes32 walletTypeId,
        address owner
    ) external view virtual override returns (string[] memory) {
        return _getWallets(walletTypeId, owner);
    }

    function getZrKey(
        bytes32 walletTypeId,
        address owner,
        uint256 index
    ) external view virtual override returns (string memory) {
        return _getWalletByIndex(walletTypeId, owner, index);
    }

    function version() external view virtual override returns (uint256) {
        return _getInitializedVersion();
    }

    //****************************************************************** VIEW PUBLIC FUNCTIONS ******************************************************************/

    function getWalletTypeInfo(
        bytes32 walletTypeId
    ) public view virtual returns (ZrSignTypes.ChainInfo memory) {
        SignStorage storage $ = _getSignStorage();
        return $.supportedWalletTypes[walletTypeId];
    }

    function isWalletTypeSupported(
        bytes32 walletTypeId
    ) public view virtual override returns (bool) {
        SignStorage storage $ = _getSignStorage();
        return $.supportedWalletTypes[walletTypeId].isNotNull();
    }

    function isChainIdSupported(
        bytes32 walletTypeId,
        bytes32 chainId
    ) public view virtual override returns (bool) {
        SignStorage storage $ = _getSignStorage();
        return $.supportedChainIds[walletTypeId][chainId];
    }

    //****************************************************************** INTERNAL FUNCTIONS ******************************************************************/
    function _zrKeyReq(
        SignTypes.ZrKeyReqParams memory params
    ) internal virtual {
        SignStorage storage $ = _getSignStorage();
        bytes32 id = _getId(params.walletTypeId, _msgSender());
        uint256 walletIndex = $.wallets[id].length;
        emit ZrKeyRequest(params.walletTypeId, _msgSender(), walletIndex);
    }

    function _zrKeyRes(
        SignTypes.ZrKeyResParams memory params
    ) internal virtual {
        SignStorage storage $ = _getSignStorage();

        bytes memory payload = abi.encode(
            block.chainid,
            params.walletTypeId,
            params.owner,
            params.walletIndex,
            params.publicKey
        );

        bytes32 payloadHash = keccak256(payload).toEthSignedMessageHash();
        _mustValidateAuthSignature(payloadHash, params.authSignature);

        _validatePublicKey(params.publicKey);

        bytes32 id = _getId(params.walletTypeId, params.owner);

        if ($.wallets[id].length != params.walletIndex) {
            revert IncorrectWalletIndex({
                expectedIndex: $.wallets[id].length,
                providedIndex: params.walletIndex
            });
        }

        $.wallets[id].push(params.publicKey);
        emit ZrKeyResolve(
            params.walletTypeId,
            params.owner,
            $.wallets[id].length - 1,
            params.publicKey
        );
    }
    
    function _sigReq(
        SignTypes.SigReqParams memory params
    ) internal virtual sigFee(params.payload) {
        SignStorage storage $ = _getSignStorage();

        _validatePublicKey(
            _getWalletByIndex(
                params.walletTypeId,
                params.owner,
                params.walletIndex
            )
        );

        bytes32 walletId = keccak256(
            abi.encode(params.walletTypeId, params.owner, params.walletIndex)
        );

        unchecked {
            $._traceId = $._traceId + 1;
        }

        emit ZrSigRequest(
            $._traceId,
            walletId,
            params.walletTypeId,
            params.owner,
            params.walletIndex,
            params.dstChainId,
            params.payload,
            params.isHashDataTx,
            params.broadcast
        );
    }

    function _resSig(SignTypes.SignResParams memory params) internal virtual {
        bytes memory payload = abi.encode(
            block.chainid,
            params.traceId,
            params.signature,
            params.broadcast
        );
        bytes32 payloadHash = keccak256(payload).toEthSignedMessageHash();

        _mustValidateAuthSignature(payloadHash, params.authSignature);
        
        emit ZrSigResolve(params.traceId, params.signature, params.broadcast);
    }

    function _mustValidateAuthSignature(
        bytes32 dataHash,
        bytes memory signature
    ) internal virtual {
        (address authAddress, ECDSA.RecoverError sigErr, ) = dataHash
            .tryRecover(signature);

        if (sigErr != ECDSA.RecoverError.NoError) {
            revert InvalidSignature(sigErr);
        }

        if (!hasRole(MPC_ROLE, authAddress)) {
            revert UnauthorizedCaller(authAddress);
        }
    }

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

    function _setupBaseFee(uint256 newBaseFee) internal virtual {
        SignStorage storage $ = _getSignStorage();
        emit BaseFeeUpdate($._baseFee, newBaseFee);
        $._baseFee = newBaseFee;
    }

    function _setupNetworkFee(uint256 newNetworkFee) internal virtual {
        SignStorage storage $ = _getSignStorage();
        emit NetworkFeeUpdate($._networkFee, newNetworkFee);
        $._networkFee = newNetworkFee;
    }

    //****************************************************************** INTERNAL VIEW FUNCTIONS ******************************************************************/
    function _getWalletByIndex(
        bytes32 walletTypeId,
        address owner,
        uint256 index
    ) internal view virtual returns (string memory) {
        SignStorage storage $ = _getSignStorage();

        bytes32 id = _getId(walletTypeId, owner);
        return $.wallets[id][index];
    }

    function _getWallets(
        bytes32 walletTypeId,
        address owner
    ) internal view virtual returns (string[] memory) {
        SignStorage storage $ = _getSignStorage();

        bytes32 id = _getId(walletTypeId, owner);
        return $.wallets[id];
    }

    //****************************************************************** INTERNAL PURE FUNCTIONS ******************************************************************/

    function _getId(
        bytes32 walletTypeId,
        address owner
    ) internal view virtual returns (bytes32 id) {
        return
            keccak256(
                abi.encode(block.chainid, address(this), walletTypeId, owner)
            );
    }

    function _validatePublicKey(string memory publicKey) internal pure virtual {
        uint256 length = abi.encodePacked(publicKey).length;
        if (length <= 4) {
            revert InvalidPublicKeyLength({
                minLength: 5,
                actualLength: length
            });
        }
    }
}
