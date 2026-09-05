import assert from "node:assert/strict";
import { createExecutionIntent, resolveExecutionIntent, retireExecutionIntent } from "./server.js";

const previousMode = process.env.EXECUTION_OPERATION_MODE;
const previousWallets = process.env.EXECUTION_VALIDATION_WALLETS;

process.env.EXECUTION_OPERATION_MODE = "live";
const intent = createExecutionIntent({
  chain: "bnb",
  walletAddress: "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD",
  route: {
    pair: "WETH/USDC",
    buyDex: "uniswap-v3",
    sellDex: "sushiswap",
  },
  amountUsd: 125,
  privateRelayRequested: true,
  privateRelayRequired: false,
});

assert.equal(resolveExecutionIntent(intent.id)?.id, intent.id);
assert.equal(resolveExecutionIntent(intent.id)?.walletAddress, "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");

retireExecutionIntent(intent.id, "confirmed", "0x1111111111111111111111111111111111111111111111111111111111111111");
assert.equal(resolveExecutionIntent(intent.id), undefined);

process.env.EXECUTION_OPERATION_MODE = "freeze";
process.env.EXECUTION_VALIDATION_WALLETS = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd,0x2222222222222222222222222222222222222222";
const approvedIntent = createExecutionIntent({
  chain: "arbitrum",
  walletAddress: "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD",
  route: { pair: "ETH/USDC", buyDex: "uniswap-v3", sellDex: "camelot" },
  amountUsd: 50,
  privateRelayRequested: false,
  privateRelayRequired: false,
});
assert.equal(approvedIntent.walletAddress, "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");

assert.throws(() => createExecutionIntent({
  chain: "arbitrum",
  walletAddress: "0x3333333333333333333333333333333333333333",
  route: { pair: "ETH/USDC", buyDex: "sushiswap", sellDex: "camelot" },
  amountUsd: 50,
  privateRelayRequested: false,
  privateRelayRequired: false,
}), /not in the validation allowlist/i);

if (previousMode === undefined) {
  delete process.env.EXECUTION_OPERATION_MODE;
} else {
  process.env.EXECUTION_OPERATION_MODE = previousMode;
}
if (previousWallets === undefined) {
  delete process.env.EXECUTION_VALIDATION_WALLETS;
} else {
  process.env.EXECUTION_VALIDATION_WALLETS = previousWallets;
}

console.log("execution intent lifecycle regression test passed");
