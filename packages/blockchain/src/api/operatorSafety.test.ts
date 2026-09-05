import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = mkdtempSync(path.join(os.tmpdir(), "habibi-operator-safety-"));
const statePath = path.join(tempDir, "execution-state.json");
const previousStorePath = process.env.EXECUTION_STATE_FILE;
const previousWebhook = process.env.ALERT_WEBHOOK_URL;
process.env.EXECUTION_STATE_FILE = statePath;
process.env.ALERT_WEBHOOK_URL = "https://alerts.example.com";

try {
  const {
    buildExecutionReadinessGateStatus,
    buildOperatorSafetySnapshot,
    resetReadinessGateHistoryForTests,
  } = await import("./server.js");

  resetReadinessGateHistoryForTests();

  const readinessGate = buildExecutionReadinessGateStatus({
    killSwitch: { engaged: false },
    signerReady: true,
    enforceCanaryPass: false,
    enforceRelayRpcDrillPass: false,
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
    relayRpcDrill: {
      generatedAt: new Date().toISOString(),
      relay: { requiredChains: [], configuredChains: [], missingChains: [], pass: true },
      rpc: { totalChains: 1, degradedOrOfflineChains: [], lowRedundancyChains: [], pass: true },
      failClosed: { apiKeyConfigured: true, unsafeBypassEnabled: false, signerReady: true, pass: true },
      alerts: { webhookConfigured: true, pass: true },
      workers: { recoveryEnabled: true, settlementEnabled: true, pass: true },
      overallPass: true,
      reason: "ok",
    },
  });

  const operatorSafety = buildOperatorSafetySnapshot({
    killSwitch: { engaged: false },
    readinessGate,
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
    relayRpcDrill: {
      generatedAt: new Date().toISOString(),
      relay: { requiredChains: [], configuredChains: [], missingChains: [], pass: true },
      rpc: { totalChains: 1, degradedOrOfflineChains: [], lowRedundancyChains: [], pass: true },
      failClosed: { apiKeyConfigured: true, unsafeBypassEnabled: false, signerReady: true, pass: true },
      alerts: { webhookConfigured: true, pass: true },
      workers: { recoveryEnabled: true, settlementEnabled: true, pass: true },
      overallPass: true,
      reason: "ok",
    },
  });

  assert.equal(operatorSafety.persistence.exists, true);
  assert.equal(operatorSafety.persistence.healthy, true);
  assert.equal(operatorSafety.alerting.pass, true);
  assert.equal(operatorSafety.risk.pass, true);
  assert.equal(operatorSafety.overallPass, true);

  console.log("operator safety regression test passed");
} finally {
  if (previousStorePath === undefined) {
    delete process.env.EXECUTION_STATE_FILE;
  } else {
    process.env.EXECUTION_STATE_FILE = previousStorePath;
  }
  if (previousWebhook === undefined) {
    delete process.env.ALERT_WEBHOOK_URL;
  } else {
    process.env.ALERT_WEBHOOK_URL = previousWebhook;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
