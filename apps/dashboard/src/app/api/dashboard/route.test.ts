import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route.js";
import { resolveUpstreamBaseUrl } from "./upstream.js";

test("resolveUpstreamBaseUrl defaults to the blockchain API port", () => {
  const url = resolveUpstreamBaseUrl();
  assert.equal(url === "http://127.0.0.1:4000" || url === "http://localhost:4000", true);
});

test("GET returns the upstream dashboard payload when the blockchain API is slow", async () => {
  const originalTimeout = process.env.DASHBOARD_UPSTREAM_TIMEOUT_MS;
  process.env.DASHBOARD_UPSTREAM_TIMEOUT_MS = "15000";

  try {
    const response = await GET();
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(payload.executionReadiness || payload.opportunitiesFeed?.length);
    assert.equal(typeof payload.recoveryWorker, "object");
    assert.equal(typeof payload.settlementWorker, "object");
    assert.equal(typeof payload.settlementQueue, "object");
    assert.equal(typeof payload.settlements, "object");
    assert.equal(typeof payload.rollout, "object");
    assert.equal(typeof payload.signerPolicy, "object");
    assert.equal(typeof payload.capitalPolicy, "object");
    assert.equal(typeof payload.capitalPolicy.activeAllocationShare, "number");
    assert.equal(typeof payload.capitalGrowth, "object");
    assert.equal(typeof payload.capitalGrowth.allowed, "boolean");
    assert.equal(typeof payload.marketValidation, "object");
    assert.equal(typeof payload.marketValidation.allowed, "boolean");
    assert.equal(typeof payload.canaryValidation, "object");
    assert.equal(typeof payload.canaryValidation.goForScale, "boolean");
    assert.equal(typeof payload.relayRpcDrill, "object");
    assert.equal(typeof payload.relayRpcDrill.overallPass, "boolean");
    assert.equal(typeof payload.liveCostTuning, "object");
    assert.equal(typeof payload.liveCostTuning.sizingPenaltyMultiplier, "number");
    assert.equal(typeof payload.readinessGate, "object");
    assert.equal(typeof payload.readinessGate.pass, "boolean");
    assert.equal(Array.isArray(payload.readinessGateHistory), true);
    assert.equal(typeof payload.operatorSafety, "object");
    assert.equal(typeof payload.operatorSafety.overallPass, "boolean");
    assert.equal(typeof payload.deploymentSafety, "object");
    assert.equal(typeof payload.deploymentSafety.restart.safeToRestart, "boolean");
    assert.equal(typeof payload.reconciliation, "object");
    assert.equal(typeof payload.reconciliation.matched, "number");
    assert.equal(typeof payload.rollout.governance, "object");
  } finally {
    if (originalTimeout === undefined) {
      delete process.env.DASHBOARD_UPSTREAM_TIMEOUT_MS;
    } else {
      process.env.DASHBOARD_UPSTREAM_TIMEOUT_MS = originalTimeout;
    }
  }
});
