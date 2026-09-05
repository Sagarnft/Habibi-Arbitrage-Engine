import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { rpcManager } from "../providers/rpcManager.js";

const tempDir = mkdtempSync(path.join(os.tmpdir(), "habibi-prod-sim-"));
const statePath = path.join(tempDir, "execution-state.json");

const previousStateFile = process.env.EXECUTION_STATE_FILE;
const previousWorkerEnabled = process.env.SETTLEMENT_WORKER_ENABLED;
const previousWorkerMaxAttempts = process.env.SETTLEMENT_WORKER_MAX_ATTEMPTS;
const previousWorkerBackoff = process.env.SETTLEMENT_WORKER_BACKOFF_MS;

process.env.EXECUTION_STATE_FILE = statePath;
process.env.SETTLEMENT_WORKER_ENABLED = "true";
process.env.SETTLEMENT_WORKER_MAX_ATTEMPTS = "1";
process.env.SETTLEMENT_WORKER_BACKOFF_MS = "0";

const originalGetClient = rpcManager.getClient.bind(rpcManager);

try {
  (rpcManager as any).getClient = () => ({
    getTransactionReceipt: async () => {
      throw new Error("simulated rpc outage");
    },
  });

  const {
    buildSettlementQueueSnapshot,
    createSettlementQueueItem,
    processPendingSettlementQueue,
    recordExecutedTrade,
  } = await import("./server.js");

  const txHash = "0xffffeeee111122223333444455556666777788889999aaaabbbbccccddddeeee" as const;
  assert.ok(recordExecutedTrade({
    walletAddress: "0xabc",
    amountUsd: 210,
    route: { pair: "WETH/USDC", buyDex: "uniswap-v3", sellDex: "sushiswap" },
    txHash,
    confirmed: true,
  }));

  const queue = createSettlementQueueItem({
    txHash,
    chain: "arbitrum",
    walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    amountUsd: 210,
    pair: "WETH/USDC",
    route: "uniswap-v3 → sushiswap",
    spreadGainUsdHint: 4.4,
    slippageCostUsdHint: 0.7,
  });
  assert.equal(queue.status, "pending");

  const firstRun = await processPendingSettlementQueue();
  assert.equal(firstRun.processed, 1);
  assert.equal(firstRun.deferred, 1, "first outage/pending receipt simulation should defer");

  await new Promise((resolve) => setTimeout(resolve, 2100));
  const secondRun = await processPendingSettlementQueue();
  assert.equal(secondRun.processed, 1);
  assert.equal(secondRun.failed, 1, "max-attempt breach under repeated pending receipt should fail safely");

  const snapshot = buildSettlementQueueSnapshot();
  assert.equal(snapshot.pending, 0, "pending queue should be drained into terminal state");
  assert.equal(snapshot.failed >= 1, true, "failed queue entry should be tracked");

  console.log("production simulation pending-receipt regression test passed");
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
  if (previousWorkerMaxAttempts === undefined) {
    delete process.env.SETTLEMENT_WORKER_MAX_ATTEMPTS;
  } else {
    process.env.SETTLEMENT_WORKER_MAX_ATTEMPTS = previousWorkerMaxAttempts;
  }
  if (previousWorkerBackoff === undefined) {
    delete process.env.SETTLEMENT_WORKER_BACKOFF_MS;
  } else {
    process.env.SETTLEMENT_WORKER_BACKOFF_MS = previousWorkerBackoff;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
