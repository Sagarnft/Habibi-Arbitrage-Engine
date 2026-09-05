// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {AaveFlashloanReceiver} from "../AaveFlashloanReceiver.sol";

contract DeployAaveFlashloanReceiver is Script {
    function run() external returns (AaveFlashloanReceiver receiver) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address pool = vm.envAddress("AAVE_POOL_ADDRESS");

        vm.startBroadcast(deployerKey);
        receiver = new AaveFlashloanReceiver(pool);
        vm.stopBroadcast();
    }
}
