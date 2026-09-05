import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = mkdtempSync(path.join(os.tmpdir(), "habibi-recovery-worker-"));
const statePath = path.join(tempDir, "execution-state.json");

const previousStorePath = process.env.EXECUTION_STATE_FILE;
const previousWorkerMaxAttempts = process.env.RECOVERY_WORKER_MAX_ATTEMPTS;
const previousWorkerEnabled = process.env.RECOVERY_WORKER_ENABLED;
const previousWorkerBackoff = process.env.RECOVERY_WORKER_BACKOFF_MS;

process.env.EXECUTION_STATE_FILE = statePath;
process.env.RECOVERY_WORKER_ENABLED = "true";
process.env.RECOVERY_WORKER_MAX_ATTEMPTS = "1";
process.env.RECOVERY_WORKER_BACKOFF_MS = "1000";

try {
  const {
    buildRecoveryTicketSnapshot,
    createRecoveryTicket,
    getRecoveryWorkerStatus,
    processPendingRecoveryTickets,
  } = await import("./server.js");

  const ticket = createRecoveryTicket({
    chain: "bnb",
    walletAddress: "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD",
    amountUsd: 120,
    reason: "worker failure-path regression",
    route: { pair: "WBNB/USDT", buyDex: "pancakeswap", sellDex: "wallet-recovery" },
  });

  const run = await processPendingRecoveryTickets();
  assert.equal(run.processed, 1);
  assert.equal(run.failed, 1);
  assert.equal(run.prepared, 0);

  const snapshot = buildRecoveryTicketSnapshot();
  assert.equal(snapshot.pending, 0, "failed ticket should leave pending queue");
  const failedTicket = snapshot.history.find((entry) => entry.id === ticket.id);
  assert.ok(failedTicket, "ticket should be present in history");
  assert.equal(failedTicket?.status, "failed");

  const status = getRecoveryWorkerStatus();
  assert.equal(status.pending, 0);

  console.log("recovery worker regression test passed");
} finally {
  if (previousStorePath === undefined) {
    delete process.env.EXECUTION_STATE_FILE;
  } else {
    process.env.EXECUTION_STATE_FILE = previousStorePath;
  }
  if (previousWorkerMaxAttempts === undefined) {
    delete process.env.RECOVERY_WORKER_MAX_ATTEMPTS;
  } else {
    process.env.RECOVERY_WORKER_MAX_ATTEMPTS = previousWorkerMaxAttempts;
  }
  if (previousWorkerEnabled === undefined) {
    delete process.env.RECOVERY_WORKER_ENABLED;
  } else {
    process.env.RECOVERY_WORKER_ENABLED = previousWorkerEnabled;
  }
  if (previousWorkerBackoff === undefined) {
    delete process.env.RECOVERY_WORKER_BACKOFF_MS;
  } else {
    process.env.RECOVERY_WORKER_BACKOFF_MS = previousWorkerBackoff;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
