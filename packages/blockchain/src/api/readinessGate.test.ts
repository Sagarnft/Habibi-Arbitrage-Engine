import assert from "node:assert/strict";

const previousCanaryFlag = process.env.EXECUTION_REQUIRE_CANARY_PASS_FOR_PREPARE;
const previousRelayFlag = process.env.EXECUTION_REQUIRE_RELAY_RPC_DRILL_PASS_FOR_PREPARE;
process.env.EXECUTION_REQUIRE_CANARY_PASS_FOR_PREPARE = "false";
process.env.EXECUTION_REQUIRE_RELAY_RPC_DRILL_PASS_FOR_PREPARE = "false";

try {
  const { buildExecutionReadinessGateStatus } = await import("./server.js");

  const advisory = buildExecutionReadinessGateStatus({
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
      reason: "Hold",
    },
    relayRpcDrill: {
      generatedAt: new Date().toISOString(),
      relay: { requiredChains: [], configuredChains: [], missingChains: [], pass: false },
      rpc: { totalChains: 0, degradedOrOfflineChains: [], lowRedundancyChains: [], pass: false },
      failClosed: { apiKeyConfigured: true, unsafeBypassEnabled: false, signerReady: true, pass: true },
      alerts: { webhookConfigured: true, pass: true },
      workers: { recoveryEnabled: true, settlementEnabled: true, pass: true },
      overallPass: false,
      reason: "drill fail",
    },
  });
  assert.equal(advisory.pass, true);

  const canaryEnforced = buildExecutionReadinessGateStatus({
    killSwitch: { engaged: false },
    signerReady: true,
    enforceCanaryPass: true,
    enforceRelayRpcDrillPass: false,
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
      reason: "Canary hold",
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
  assert.equal(canaryEnforced.pass, false);
  assert.equal(canaryEnforced.reason.includes("canary policy"), true);

  const signerBlocked = buildExecutionReadinessGateStatus({
    killSwitch: { engaged: false },
    signerReady: false,
    enforceCanaryPass: false,
    enforceRelayRpcDrillPass: false,
    canaryValidation: {
      chain: "arbitrum",
      windowHours: 24,
      minSettledTrades: 3,
      minRealizedNetUsd: 1,
      maxAverageSlippageBps: 35,
      maxLossTrades: 1,
      settledTrades: 5,
      lossTrades: 0,
      cumulativeRealizedNetUsd: 5,
      averageSlippageBps: 10,
      goForScale: true,
      reason: "pass",
    },
    relayRpcDrill: {
      generatedAt: new Date().toISOString(),
      relay: { requiredChains: [], configuredChains: [], missingChains: [], pass: true },
      rpc: { totalChains: 1, degradedOrOfflineChains: [], lowRedundancyChains: [], pass: true },
      failClosed: { apiKeyConfigured: true, unsafeBypassEnabled: false, signerReady: false, pass: false },
      alerts: { webhookConfigured: true, pass: true },
      workers: { recoveryEnabled: true, settlementEnabled: true, pass: true },
      overallPass: true,
      reason: "ok",
    },
  });
  assert.equal(signerBlocked.pass, false);
  assert.equal(signerBlocked.reason.includes("signer"), true);

  console.log("readiness gate regression test passed");
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
