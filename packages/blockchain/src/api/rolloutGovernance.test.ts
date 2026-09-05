import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeRolloutGovernanceState } from "./executionStore.js";

const tempDir = mkdtempSync(path.join(os.tmpdir(), "habibi-rollout-governance-"));
const statePath = path.join(tempDir, "execution-state.json");

const previousStorePath = process.env.EXECUTION_STATE_FILE;
const previousAutopilot = process.env.ROLLOUT_AUTOPILOT_ENABLED;

process.env.EXECUTION_STATE_FILE = statePath;
process.env.ROLLOUT_AUTOPILOT_ENABLED = "true";

try {
  writeRolloutGovernanceState([
    {
      chain: "arbitrum",
      currentStage: "blocked",
      promotionStreak: 0,
      manualOverrideStage: "scale",
      reason: "manual test override",
    },
  ]);

  const { buildRolloutStatus } = await import("./server.js");
  const status = await buildRolloutStatus();
  assert.equal(typeof status.governance, "object");
  assert.equal(Array.isArray(status.chains), true);
  assert.equal(status.chains.length > 0, true);

  const arbitrum = status.chains.find((row) => row.chain === "arbitrum");
  assert.ok(arbitrum, "expected arbitrum chain row");
  assert.equal(arbitrum?.stage, "scale", "manual override should pin stage");
  assert.equal(arbitrum?.governance?.source, "manual-override");

  console.log("rollout governance regression test passed");
} finally {
  if (previousStorePath === undefined) {
    delete process.env.EXECUTION_STATE_FILE;
  } else {
    process.env.EXECUTION_STATE_FILE = previousStorePath;
  }
  if (previousAutopilot === undefined) {
    delete process.env.ROLLOUT_AUTOPILOT_ENABLED;
  } else {
    process.env.ROLLOUT_AUTOPILOT_ENABLED = previousAutopilot;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
