import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = mkdtempSync(path.join(os.tmpdir(), "habibi-store-"));
const storePath = path.join(tempDir, "execution-state.json");

const previousStorePath = process.env.EXECUTION_STATE_FILE;
process.env.EXECUTION_STATE_FILE = storePath;

try {
  const store = await import("./executionStore.js");
  const empty = store.readExecutionState();
  assert.equal(empty.recoveryTickets.length, 0);
  assert.equal(empty.settlementRecords.length, 0);

  store.writeRecoveryState([
    {
      id: "recovery-1",
      chain: "arbitrum",
      walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      amountUsd: 150,
      createdAt: Date.now(),
      status: "pending",
      reason: "test pending recovery",
    },
  ], []);
  const withRecovery = store.readExecutionState();
  assert.equal(withRecovery.recoveryTickets.length, 1);
  assert.equal(withRecovery.recoveryTickets[0]?.walletAddress, "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");

  store.appendSettlementRecord({
    id: "settlement-1",
    txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    realizedNetUsd: 8.5,
    spreadGainUsd: 11,
    gasCostUsd: 1.8,
    slippageCostUsd: 0.7,
    settledAt: new Date().toISOString(),
  });
  const withSettlement = store.readExecutionState();
  assert.equal(withSettlement.settlementRecords.length, 1);
  assert.equal(store.getSettlementRecords(1).length, 1);

  const meta = store.getExecutionStoreMeta();
  assert.equal(meta.filePath, storePath);

  console.log("execution store persistence regression test passed");
} finally {
  if (previousStorePath === undefined) {
    delete process.env.EXECUTION_STATE_FILE;
  } else {
    process.env.EXECUTION_STATE_FILE = previousStorePath;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
