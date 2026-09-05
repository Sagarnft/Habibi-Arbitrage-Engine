import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = mkdtempSync(path.join(os.tmpdir(), "habibi-readiness-persist-"));
const statePath = path.join(tempDir, "execution-state.json");
const previousStorePath = process.env.EXECUTION_STATE_FILE;
const previousCanaryFlag = process.env.EXECUTION_REQUIRE_CANARY_PASS_FOR_PREPARE;
const previousRelayFlag = process.env.EXECUTION_REQUIRE_RELAY_RPC_DRILL_PASS_FOR_PREPARE;
process.env.EXECUTION_STATE_FILE = statePath;
process.env.EXECUTION_REQUIRE_CANARY_PASS_FOR_PREPARE = "true";
process.env.EXECUTION_REQUIRE_RELAY_RPC_DRILL_PASS_FOR_PREPARE = "false";

try {
  const {
    buildExecutionReadinessGateStatus,
    getReadinessGateHistory,
    resetReadinessGateHistoryForTests,
  } = await import("./server.js");
  const { readExecutionState } = await import("./executionStore.js");

  resetReadinessGateHistoryForTests();

  const passingRelay = {
    generatedAt: new Date().toISOString(),
    relay: { requiredChains: [], configuredChains: [], missingChains: [], pass: true },
    rpc: { totalChains: 1, degradedOrOfflineChains: [], lowRedundancyChains: [], pass: true },
    failClosed: { apiKeyConfigured: true, unsafeBypassEnabled: false, signerReady: true, pass: true },
    alerts: { webhookConfigured: true, pass: true },
    workers: { recoveryEnabled: true, settlementEnabled: true, pass: true },
    overallPass: true,
    reason: "ok",
  };

  buildExecutionReadinessGateStatus({
    killSwitch: { engaged: false },
    signerReady: true,
    canaryValidation: {
      chain: "arbitrum",
      windowHours: 24,
      minSettledTrades: 3,
      minRealizedNetUsd: 1,
      maxAverageSlippageBps: 35,
      maxLossTrades: 1,
      settledTrades: 4,
      lossTrades: 0,
      cumulativeRealizedNetUsd: 4,
      averageSlippageBps: 10,
      goForScale: true,
      reason: "pass",
    },
    relayRpcDrill: passingRelay,
  });

  buildExecutionReadinessGateStatus({
    killSwitch: { engaged: false },
    signerReady: true,
    canaryValidation: {
      chain: "arbitrum",
      windowHours: 24,
      minSettledTrades: 3,
      minRealizedNetUsd: 1,
      maxAverageSlippageBps: 35,
      maxLossTrades: 1,
      settledTrades: 0,
      lossTrades: 0,
      cumulativeRealizedNetUsd: 0,
      averageSlippageBps: 0,
      goForScale: false,
      reason: "hold",
    },
    relayRpcDrill: passingRelay,
  });

  const currentHistory = getReadinessGateHistory(10);
  assert.equal(currentHistory.length, 2);

  const persistedState = readExecutionState();
  assert.equal(persistedState.readinessGateHistory.length, 2);
  assert.equal(persistedState.readinessGateHistory[0].pass, false);
  assert.equal(persistedState.readinessGateHistory[1].pass, true);

  console.log("readiness gate persistence regression test passed");
} finally {
  if (previousStorePath === undefined) {
    delete process.env.EXECUTION_STATE_FILE;
  } else {
    process.env.EXECUTION_STATE_FILE = previousStorePath;
  }
  if (previousCanaryFlag === undefined) {
    delete process.env.EXECUTION_REQUIRE_CANARY_PASS_FOR_PREPARE;
  } else {
    process.env.EXECUTION_REQUIRE_CANARY_PASS_FOR_PREPARE = previousCanaryFlag;
  }
  if (previousRelayFlag === undefined) {
    delete process.env.EXECUTION_REQUIRE_RELAY_RPC_DRILL_PASS_FOR_PREPARE;
  } else {
    process.env.EXECUTION_REQUIRE_RELAY_RPC_DRILL_PASS_FOR_PREPARE = previousRelayFlag;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
