import assert from "node:assert/strict";
import { healthMonitor } from "./healthMonitor.js";

healthMonitor.reset();
healthMonitor.setStatus("ethereum", {
  latency: 42,
  healthy: true,
  lastChecked: 1700000000000,
});
healthMonitor.setStatus("arbitrum", {
  latency: -1,
  healthy: false,
  lastChecked: 1700000000001,
});
healthMonitor.setStatus("arbitrum", {
  latency: -1,
  healthy: false,
  lastChecked: 1700000000002,
});
healthMonitor.setStatus("arbitrum", {
  latency: -1,
  healthy: false,
  lastChecked: 1700000000003,
});

const status = healthMonitor.getStatus();
assert.equal(typeof status, "object");
assert.equal(status.ethereum?.healthy, true);

const summary = healthMonitor.getSummary();
assert.equal(summary.total, 2);
assert.equal(summary.healthy, 1);
assert.equal(summary.offline, 1);
assert.equal(summary.overall, "degraded");
assert.equal(healthMonitor.isTemporarilyDisabled("arbitrum"), true);

console.log("health monitor smoke test passed");
