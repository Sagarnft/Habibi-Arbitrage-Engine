# Aave Flashloan Receiver Scaffold

## What this is
- [`AaveFlashloanReceiver.sol`](./AaveFlashloanReceiver.sol) is the on-chain receiver contract.
- [`script/DeployAaveFlashloanReceiver.s.sol`](./script/DeployAaveFlashloanReceiver.s.sol) is the deployment scaffold.
- [`.env.example`](./.env.example) lists the values you need per chain.

## What you still need
- A funded deployer wallet
- Aave pool address for each chain you deploy on
- RPC URL for each deployment chain
- Deployed receiver address copied back into `packages/blockchain/.env.example`

## Flow
1. Set `DEPLOYER_PRIVATE_KEY`
2. Set `AAVE_POOL_ADDRESS`
3. Deploy the receiver for one chain
4. Copy the deployed receiver address into:
   - `FLASHLOAN_RECEIVER_ADDRESS`
   - or `FLASHLOAN_RECEIVER_<CHAIN>`

## Note
This scaffold is intentionally simple. It is a deployment starter, not production security hardening.
