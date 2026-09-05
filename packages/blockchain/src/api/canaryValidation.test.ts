import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = mkdtempSync(path.join(os.tmpdir(), "habibi-canary-"));
const statePath = path.join(tempDir, "execution-state.json");
const previousStorePath = process.env.EXECUTION_STATE_FILE;
process.env.EXECUTION_STATE_FILE = statePath;

try {
  const {
    buildCanaryValidationStatus,
    createSettlementQueueItem,
    recordExecutedTrade,
    settleTradeByHash,
  } = await import("./server.js");

  const tradeOneHash = "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
  const tradeTwoHash = "0x2222222222222222222222222222222222222222222222222222222222222222" as const;

  recordExecutedTrade({
    walletAddress: "0xabc",
    amountUsd: 100,
    route: { pair: "WETH/USDC", buyDex: "uniswap-v3", sellDex: "sushiswap" },
    txHash: tradeOneHash,
    confirmed: true,
  });
  createSettlementQueueItem({
    txHash: tradeOneHash,
    chain: "arbitrum",
    walletAddress: "0x1111111111111111111111111111111111111111",
    amountUsd: 100,
  });
  settleTradeByHash({
    txHash: tradeOneHash,
    realizedNetUsd: 1.6,
    slippageCostUsd: 0.08,
  });

  recordExecutedTrade({
    walletAddress: "0xabc",
    amountUsd: 100,
    route: { pair: "WETH/USDC", buyDex: "uniswap-v3", sellDex: "sushiswap" },
    txHash: tradeTwoHash,
    confirmed: true,
  });
  createSettlementQueueItem({
    txHash: tradeTwoHash,
    chain: "arbitrum",
    walletAddress: "0x1111111111111111111111111111111111111111",
    amountUsd: 100,
  });
  settleTradeByHash({
    txHash: tradeTwoHash,
    realizedNetUsd: 1.4,
    slippageCostUsd: 0.06,
  });

  const passStatus = buildCanaryValidationStatus({
    chain: "arbitrum",
    minSettledTrades: 2,
    minRealizedNetUsd: 2,
    maxAverageSlippageBps: 10,
    maxLossTrades: 0,
    windowHours: 24,
  });
  assert.equal(passStatus.goForScale, true);
  assert.equal(passStatus.settledTrades, 2);
  assert.equal(passStatus.lossTrades, 0);

  const failStatus = buildCanaryValidationStatus({
    chain: "arbitrum",
    minSettledTrades: 2,
    minRealizedNetUsd: 2,
    maxAverageSlippageBps: 3,
    maxLossTrades: 0,
    windowHours: 24,
  });
  assert.equal(failStatus.goForScale, false);
  assert.equal(failStatus.reason.includes("Average slippage"), true);

  console.log("canary validation regression test passed");
} finally {
  if (previousStorePath === undefined) {
    delete process.env.EXECUTION_STATE_FILE;
  } else {
    process.env.EXECUTION_STATE_FILE = previousStorePath;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
