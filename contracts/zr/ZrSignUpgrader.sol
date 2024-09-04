// // SPDX-License-Identifier: BUSL
// // SPDX-FileCopyrightText: 2024 Zenrock labs Ltd.

// pragma solidity 0.8.19;

// import { ZrProxy } from "../proxy/ZrProxy.sol";

// contract ZrSignUpgrader {
//     ZrProxy internal _proxy;
//     address internal _implementation;
//     address internal _newProxyAdmin;
//     address internal _owner;
    
//     modifier onlyOwner() {
//         require(msg.sender == _owner, "only owner");
//         _;
//     }

//     constructor(ZrProxy proxy, address implementation, address newProxyAdmin) {
//         _proxy = proxy;
//         _implementation = implementation;
//         _newProxyAdmin = newProxyAdmin;
//         _owner = msg.sender;
//     }

//     function upgrade() external onlyOwner {

//         _proxy.upgradeTo(_implementation);

//         // Transfer proxy admin role
//         _proxy.changeAdmin(_newProxyAdmin);

//         // Tear down
//         tearDown();
//     }

//     function proxy() external view returns (address) {
//         return address(_proxy);
//     }

//     /**
//      * @notice The address of the FiatTokenV2 implementation contract
//      * @return Contract address
//      */
//     function implementation() external view returns (address) {
//         return _implementation;
//     }
//     /**
//      * @notice The address to which the proxy admin role will be transferred
//      * after the upgrade is completed
//      * @return Address
//      */
//     function newProxyAdmin() external view returns (address) {
//         return _newProxyAdmin;
//     }

//     function abortUpgrade() external onlyOwner {
//         // Transfer proxy admin role
//         _proxy.changeAdmin(_newProxyAdmin);

//         // Tear down
//         tearDown();
//     }

//     /**
//      * @dev Tears down the helper contract followed by this contract.
//      */
//     function tearDown() internal {
//         selfdestruct(payable(msg.sender));
//     }
// }
