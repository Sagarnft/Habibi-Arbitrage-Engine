import assert from "node:assert/strict";

import { buildRolloutGoNoGoStatus } from "./server.js";

const baseCanaryValidation = {
  chain: "arbitrum",
  windowHours: 24,
  minSettledTrades: 3,
  minRealizedNetUsd: 1,
  maxAverageSlippageBps: 35,
  maxLossTrades: 1,
  settledTrades: 3,
  lossTrades: 0,
  cumulativeRealizedNetUsd: 2.5,
  averageSlippageBps: 12,
  goForScale: true,
  reason: "canary pass",
};

const baseReadinessGate = {
  generatedAt: new Date().toISOString(),
  enforced: {
    canaryPassRequired: true,
    relayRpcDrillPassRequired: true,
  },
  checks: {
    killSwitchClear: true,
    signerReady: true,
    canaryPass: true,
    relayRpcDrillPass: true,
  },
  pass: true,
  reason: "readiness pass",
};

const baseRelayRpcDrill = {
  generatedAt: new Date().toISOString(),
  relay: { requiredChains: ["arbitrum"], configuredChains: ["arbitrum"], missingChains: [], pass: true },
  rpc: { totalChains: 1, degradedOrOfflineChains: [], lowRedundancyChains: [], pass: true },
  failClosed: { apiKeyConfigured: true, unsafeBypassEnabled: false, signerReady: true, pass: true },
  alerts: { webhookConfigured: true, pass: true },
  workers: { recoveryEnabled: true, settlementEnabled: true, pass: true },
  overallPass: true,
  reason: "relay/rpc pass",
};

const baseOperatorSafety = {
  generatedAt: new Date().toISOString(),
  persistence: {
    filePath: "/tmp/execution-state.json",
    exists: true,
    healthy: true,
    sizeBytes: 128,
    lastModifiedAt: new Date().toISOString(),
  },
  alerting: {
    webhookConfigured: true,
    pass: true,
  },
  risk: {
    killSwitchEngaged: false,
    readinessGatePass: true,
    canaryPass: true,
    relayRpcDrillPass: true,
    pass: true,
  },
  overallPass: true,
  reason: "operator safety pass",
};

const goScale = buildRolloutGoNoGoStatus({
  chain: "arbitrum",
  observedStage: "scale",
  canaryValidation: baseCanaryValidation,
  readinessGate: baseReadinessGate,
  relayRpcDrill: baseRelayRpcDrill,
  operatorSafety: baseOperatorSafety,
});

assert.equal(goScale.readyForCanary, true);
assert.equal(goScale.readyForScale, true);
assert.equal(goScale.recommendedStage, "scale");

const canaryHold = buildRolloutGoNoGoStatus({
  chain: "arbitrum",
  observedStage: "canary",
  canaryValidation: {
    ...baseCanaryValidation,
    goForScale: false,
    reason: "canary still maturing",
  },
  readinessGate: baseReadinessGate,
  relayRpcDrill: baseRelayRpcDrill,
  operatorSafety: {
    ...baseOperatorSafety,
    overallPass: false,
    reason: "operator safety blocked",
  },
});

assert.equal(canaryHold.readyForCanary, true);
assert.equal(canaryHold.readyForScale, false);
assert.equal(canaryHold.recommendedStage, "canary");
assert.match(canaryHold.reason, /scale/i);

console.log("rollout go/no-go regression test passed");
