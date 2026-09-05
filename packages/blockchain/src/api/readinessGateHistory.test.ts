import assert from "node:assert/strict";

const previousCanaryFlag = process.env.EXECUTION_REQUIRE_CANARY_PASS_FOR_PREPARE;
const previousRelayFlag = process.env.EXECUTION_REQUIRE_RELAY_RPC_DRILL_PASS_FOR_PREPARE;
process.env.EXECUTION_REQUIRE_CANARY_PASS_FOR_PREPARE = "false";
process.env.EXECUTION_REQUIRE_RELAY_RPC_DRILL_PASS_FOR_PREPARE = "false";

try {
  const {
    buildExecutionReadinessGateStatus,
    resetReadinessGateHistoryForTests,
    getReadinessGateHistory,
  } = await import("./server.js");

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

  const passingCanary = {
    chain: "arbitrum" as const,
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
  };

  const blockedCanary = {
    ...passingCanary,
    goForScale: false,
    reason: "hold",
  };

  buildExecutionReadinessGateStatus({
    killSwitch: { engaged: false },
    signerReady: true,
    enforceCanaryPass: true,
    canaryValidation: passingCanary,
    relayRpcDrill: passingRelay,
  });
  assert.equal(getReadinessGateHistory(10).length, 1);

  buildExecutionReadinessGateStatus({
    killSwitch: { engaged: false },
    signerReady: true,
    enforceCanaryPass: true,
    canaryValidation: passingCanary,
    relayRpcDrill: passingRelay,
  });
  assert.equal(getReadinessGateHistory(10).length, 1);

  buildExecutionReadinessGateStatus({
    killSwitch: { engaged: false },
    signerReady: true,
    enforceCanaryPass: true,
    canaryValidation: blockedCanary,
    relayRpcDrill: passingRelay,
  });
  const history = getReadinessGateHistory(10);
  assert.equal(history.length, 2);
  assert.equal(history[0].pass, false);
  assert.equal(history[1].pass, true);

  console.log("readiness gate history regression test passed");
} finally {
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
}
