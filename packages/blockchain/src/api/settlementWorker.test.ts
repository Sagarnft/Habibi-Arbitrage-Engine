import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { rpcManager } from "../providers/rpcManager.js";

const tempDir = mkdtempSync(path.join(os.tmpdir(), "habibi-settlement-worker-"));
const statePath = path.join(tempDir, "execution-state.json");

const previousStateFile = process.env.EXECUTION_STATE_FILE;
const previousWorkerEnabled = process.env.SETTLEMENT_WORKER_ENABLED;
const previousWorkerInterval = process.env.SETTLEMENT_WORKER_INTERVAL_MS;
const previousWorkerMaxAttempts = process.env.SETTLEMENT_WORKER_MAX_ATTEMPTS;
const previousNativeUsdArb = process.env.NATIVE_USD_ARBITRUM;

process.env.EXECUTION_STATE_FILE = statePath;
process.env.SETTLEMENT_WORKER_ENABLED = "true";
process.env.SETTLEMENT_WORKER_INTERVAL_MS = "5000";
process.env.SETTLEMENT_WORKER_MAX_ATTEMPTS = "2";
process.env.NATIVE_USD_ARBITRUM = "2500";

const originalGetClient = rpcManager.getClient.bind(rpcManager);

try {
  (rpcManager as any).getClient = () => ({
    getTransactionReceipt: async () => ({
      status: "success",
      effectiveGasPrice: 1_000_000_000n,
      gasUsed: 110_000n,
    }),
  });

  const {
    buildSettlementQueueSnapshot,
    createSettlementQueueItem,
    processPendingSettlementQueue,
    recordExecutedTrade,
  } = await import("./server.js");
  const { getSettlementRecords } = await import("./executionStore.js");

  const txHash = "0x9999999999999999999999999999999999999999999999999999999999999999" as const;
  const trade = recordExecutedTrade({
    walletAddress: "0xabc",
    amountUsd: 240,
    route: { pair: "WETH/USDC", buyDex: "uniswap-v3", sellDex: "sushiswap" },
    txHash,
    confirmed: true,
  });
  assert.ok(trade, "expected trade to exist before settlement");

  const queue = createSettlementQueueItem({
    txHash,
    chain: "arbitrum",
    walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    amountUsd: 240,
    pair: "WETH/USDC",
    route: "uniswap-v3 → sushiswap",
    spreadGainUsdHint: 5.4,
    slippageCostUsdHint: 0.6,
  });
  assert.equal(queue.status, "pending");

  const run = await processPendingSettlementQueue();
  assert.equal(run.settled, 1, "expected queue item to auto-settle");

  const snapshot = buildSettlementQueueSnapshot();
  assert.equal(snapshot.pending, 0);
  assert.equal(snapshot.settled >= 1, true);

  const settlements = getSettlementRecords(5);
  assert.equal(settlements.length >= 1, true, "expected settlement record persistence");

  console.log("settlement worker regression test passed");
} finally {
  (rpcManager as any).getClient = originalGetClient;
  if (previousStateFile === undefined) {
    delete process.env.EXECUTION_STATE_FILE;
  } else {
    process.env.EXECUTION_STATE_FILE = previousStateFile;
  }
  if (previousWorkerEnabled === undefined) {
    delete process.env.SETTLEMENT_WORKER_ENABLED;
  } else {
    process.env.SETTLEMENT_WORKER_ENABLED = previousWorkerEnabled;
  }
  if (previousWorkerInterval === undefined) {
    delete process.env.SETTLEMENT_WORKER_INTERVAL_MS;
  } else {
    process.env.SETTLEMENT_WORKER_INTERVAL_MS = previousWorkerInterval;
  }
  if (previousWorkerMaxAttempts === undefined) {
    delete process.env.SETTLEMENT_WORKER_MAX_ATTEMPTS;
  } else {
    process.env.SETTLEMENT_WORKER_MAX_ATTEMPTS = previousWorkerMaxAttempts;
  }
  if (previousNativeUsdArb === undefined) {
    delete process.env.NATIVE_USD_ARBITRUM;
  } else {
    process.env.NATIVE_USD_ARBITRUM = previousNativeUsdArb;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
