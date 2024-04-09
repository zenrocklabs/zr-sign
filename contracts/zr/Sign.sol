// SPDX-License-Identifier: BUSL
// SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

pragma solidity 0.8.20;


import "../Context.sol";
import "../AccessControl.sol";
import "../Initializable.sol";
import "../../libraries/ECDSA.sol";
import "../../libraries/MessageHashUtils.sol";

import "../../interfaces/zr/ISign.sol";
import "../../libraries/zr/SignTypes.sol";
import "../../libraries/zr/ZrSignTypes.sol";

abstract contract Sign is AccessControl, ISign {
    using ZrSignTypes for ZrSignTypes.ChainInfo;
    using MessageHashUtils for bytes32;
    using ECDSA for bytes32;

    bytes32 public constant MPC_ROLE = 0x1788cbbd6512d9aa8da743e475ce7cbbc6aea08b483d7cd0c00586734a4f6f14; //keccak256("zenrock.role.mpc");

    bytes32 public constant SRC_WALLET_TYPE_ID =
        0xe146c2986893c43af5ff396310220be92058fb9f4ce76b929b80ef0d5307100a; // keccak256(abi.encode(ChainInfo{purpose:44 coinType: 60}));
    bytes32 public constant SRC_CHAIN_ID =
        0xafa90c317deacd3d68f330a30f96e4fa7736e35e8d1426b2e1b2c04bce1c2fb7; //keccak256(abi.encodePacked("eip155:11155111"));

    uint8 public constant IS_HASH_MASK = 1 << 0; // 0b0001
    uint8 public constant IS_DATA_MASK = 1 << 1; // 0b0010
    uint8 public constant IS_TX_MASK = 1 << 2; // 0b0100;

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

    modifier keyFee() {
        SignStorage storage $ = _getSignStorage();
        require(
            msg.value >= $._baseFee,
            "qs::keyFee:msg.value should be greater"
        );
        _;
    }

    modifier sigFee(bytes memory payload) {
        SignStorage storage $ = _getSignStorage();
        uint256 networkFee = payload.length * $._networkFee;
        uint256 totalFee = $._baseFee + networkFee;
        require(
            msg.value >= totalFee,
            "qs::sigFee:msg.value should be greater"
        );
        _;
    }

    modifier walletTypeGuard(bytes32 walletTypeId) {
        require(
            getWalletTypeInfo(walletTypeId).isNull() == false,
            "qs::walletTypeGuard:walletType not supported"
        );
        _;
    }

    modifier chainIdGuard(bytes32 walletTypeId, bytes32 chainId) {
        SignStorage storage $ = _getSignStorage();
        require(
            $.supportedChainIds[walletTypeId][chainId] == true,
            "qs::chainIdGuard:chainId not supported"
        );
        _;
    }

    modifier ownerGuard(address owner) {
        require(owner != address(0), "qs::ownerGuard:invalid owner address");
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
        SignStorage storage $ = _getSignStorage();
        bytes32 id = _getId(params.walletTypeId, _msgSender());
        uint256 walletIndex = $.wallets[id].length;
        emit ZrKeyRequest(params.walletTypeId, _msgSender(), walletIndex);
    }

    function zrKeyRes(
        SignTypes.ZrKeyResParams memory params
    ) external walletTypeGuard(params.walletTypeId) ownerGuard(params.owner) {
        SignStorage storage $ = _getSignStorage();

        bytes memory payload = abi.encode(
            params.walletTypeId,
            params.owner,
            params.walletIndex,
            params.publicKey
        );

        bytes32 payloadHash = keccak256(payload).toEthSignedMessageHash();
        _mustValidateAuthSignature(payloadHash, params.authSignature);

        _validatePublicKey(params.publicKey);

        bytes32 id = _getId(params.walletTypeId, params.owner);
        require(
            $.wallets[id].length == params.walletIndex,
            "qs::qKeyRes:incorrect walletIndex"
        );

        $.wallets[id].push(params.publicKey);
        emit ZrKeyResolve(
            params.walletTypeId,
            params.owner,
            $.wallets[id].length - 1,
            params.publicKey
        );
    }

    function zrSignHash(
        SignTypes.ZrSignParams memory params
    )
        external
        payable
        sigFee(params.payload)
        walletTypeGuard(params.walletTypeId)
        chainIdGuard(params.walletTypeId, params.dstChainId)
    {
        require(params.payload.length == 32, "payload must be a single hash.");
        require(params.broadcast == false, "hash is not broadcastable.");

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
        sigFee(params.payload)
        walletTypeGuard(params.walletTypeId)
        chainIdGuard(params.walletTypeId, params.dstChainId)
    {
        require(params.broadcast == false, "data is not broadcastable");

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
        sigFee(params.payload)
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

    function zrSignRes(
        SignTypes.SignResParams memory params
    ) external virtual override {
        bytes memory payload = abi.encode(
            params.traceId,
            params.signature,
            params.broadcast
        );
        bytes32 payloadHash = keccak256(payload).toEthSignedMessageHash();

        _mustValidateAuthSignature(payloadHash, params.authSignature);

        _resSig(params);
    }

    function _resSig(SignTypes.SignResParams memory params) internal virtual {
        emit ZrSigResolve(params.traceId, params.signature, params.broadcast);
    }

    function _mustValidateAuthSignature(
        bytes32 dataHash,
        bytes memory signature
    ) internal virtual {
        (address authAddress, ECDSA.RecoverError sigErr, ) = dataHash
            .tryRecover(signature);

        require(
            sigErr == ECDSA.RecoverError.NoError,
            "qs::onlyMPC:invalid signature"
        );

        require(
            hasRole(MPC_ROLE, authAddress) == true,
            "qs::onlyMPC:caller not authorized"
        );
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
    function _walletTypeIdConfig(
        ZrSignTypes.ChainInfo memory c,
        bool support
    ) internal virtual returns(bytes32) {
        SignStorage storage $ = _getSignStorage();
        bytes32 walletTypeId = c.hashChainInfo();
        if (support) {
            require(
                getWalletTypeInfo(walletTypeId).isNull(),
                "qs::supportWalletTypeId:walletTypeId is already supported"
            );
            $.supportedWalletTypes[walletTypeId] = c;
        } else {
            require(
                $.supportedWalletTypes[walletTypeId].isNotNull(),
                "qs::supportWalletTypeId:walletTypeId is not supported"
            );
            delete $.supportedWalletTypes[walletTypeId];
        }
        return walletTypeId;
    }
    
    function _chainIdConfig(
        bytes32 walletTypeId,
        bytes32 chainId,
        bool support
    ) internal virtual {
        SignStorage storage $ = _getSignStorage();
        if (support) {
            require(
                $.supportedChainIds[walletTypeId][chainId] == false,
                "qs::chainIdConfig:chainId is already supported"
            );
            $.supportedChainIds[walletTypeId][chainId] = true;
        } else {
            require(
                $.supportedChainIds[walletTypeId][chainId] == true,
                "qs::chainIdConfig:chainId is not supported"
            );
            delete $.supportedChainIds[walletTypeId][chainId];
        }
    }

    function _setupBaseFee(
        uint256 newBaseFee
    ) internal virtual {
        SignStorage storage $ = _getSignStorage();
        emit BaseFeeUpdate($._baseFee, newBaseFee);
        $._baseFee = newBaseFee;
    }

    function _setupNetworkFee(
        uint256 newNetworkFee
    ) internal virtual {
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
        require(
            abi.encodePacked(publicKey).length > 4,
            "qs::validatePublicKey:public key has an invalid length"
        );
    }
}
