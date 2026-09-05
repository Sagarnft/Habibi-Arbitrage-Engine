import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ProfitabilityController } from "./profitability.js";

const previousDailyLoss = process.env.KILL_SWITCH_MAX_DAILY_LOSS_USD;
const previousLossWindow = process.env.KILL_SWITCH_LOSS_WINDOW_HOURS;
const previousStorePath = process.env.EXECUTION_STATE_FILE;
const previousAlertWebhookUrl = process.env.ALERT_WEBHOOK_URL;

process.env.KILL_SWITCH_MAX_DAILY_LOSS_USD = "5";
process.env.KILL_SWITCH_LOSS_WINDOW_HOURS = "24";

const tempDir = mkdtempSync(path.join(os.tmpdir(), "habibi-alerting-"));
const storePath = path.join(tempDir, "execution-state.json");
process.env.EXECUTION_STATE_FILE = storePath;

const receivedAlerts: Array<Record<string, unknown>> = [];
const alertServer = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  req.on("end", () => {
    receivedAlerts.push(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });
});

await new Promise<void>((resolve) => {
  alertServer.listen(0, "127.0.0.1", resolve);
});
const alertAddress = alertServer.address();
if (!alertAddress || typeof alertAddress === "string") {
  throw new Error("Failed to start alert test server.");
}
process.env.ALERT_WEBHOOK_URL = `http://127.0.0.1:${alertAddress.port}/alert`;

const controller = new ProfitabilityController();
controller.recordExecutionOutcome({
  realizedNetUsd: -3,
  failed: true,
  slippageBps: 0,
  rpcHealthy: true,
});

let state = controller.getKillSwitchState();
assert.equal(state.engaged, false, "kill-switch should stay disengaged below daily loss limit");

controller.recordExecutionOutcome({
  realizedNetUsd: -3.5,
  failed: true,
  slippageBps: 0,
  rpcHealthy: true,
});

state = controller.getKillSwitchState();
assert.equal(state.engaged, true, "kill-switch should engage after daily loss cap breach");
assert.equal(state.reason, "Kill-switch engaged due to daily realized loss cap breach");
assert.equal(state.dailyRealizedLossUsd >= 6.5, true);

const alertDelivery = await controller.sendAlert("kill-switch", "Kill-switch engaged for testing", {
  reason: state.reason,
});
assert.equal(alertDelivery.delivered, true);
assert.equal(alertDelivery.severity, "critical");
assert.equal(alertDelivery.responseAction, "pause-execution-and-review-losses");
assert.equal(receivedAlerts.length, 1);

const alertHistory = controller.getAlertHistory(10);
assert.ok(alertHistory.length >= 1, "performance controller should retain at least one alert event");
assert.equal(alertHistory.some((entry) => entry.id === alertDelivery.alertId), true);
assert.equal(alertHistory.find((entry) => entry.id === alertDelivery.alertId)?.acknowledged, false);
assert.equal(alertHistory.find((entry) => entry.id === alertDelivery.alertId)?.status, "delivered");

const ackState = controller.acknowledgeAlert(alertDelivery.alertId, "test-operator");
const ackedEntry = ackState.alertHistory.find((entry) => entry.id === alertDelivery.alertId);
assert.equal(ackedEntry?.acknowledged, true);
assert.equal(ackedEntry?.status, "acknowledged");
assert.equal(ackedEntry?.acknowledgedBy, "test-operator");

const growthDecision = controller.getCapitalGrowthDecision({
  currentActiveShare: 0.6,
  winRatePct: 72,
  drawdownPct: 5,
  realizedNetUsd: 18,
  dailyRealizedLossUsd: 0,
  rpcHealthyRatio: 1,
  killSwitchEngaged: false,
});
assert.equal(growthDecision.status, "growing");
assert.equal(growthDecision.allowed, true);
assert.ok(growthDecision.recommendedActiveShare > growthDecision.currentActiveShare);

const pausedDecision = controller.getCapitalGrowthDecision({
  currentActiveShare: 0.6,
  winRatePct: 35,
  drawdownPct: 18,
  realizedNetUsd: -5,
  dailyRealizedLossUsd: 0,
  rpcHealthyRatio: 0.8,
  killSwitchEngaged: false,
});
assert.equal(pausedDecision.status, "paused");
assert.equal(pausedDecision.allowed, false);

const marketValidation = controller.getMarketReadinessDecision({
  executableOpportunityRatio: 0.35,
  avgExpectedNetUsd: 2.5,
  rpcHealthyRatio: 1,
  winRatePct: 70,
  drawdownPct: 5,
  liveOpportunityCount: 4,
  totalScannedCount: 12,
});
assert.equal(marketValidation.status, "ready");
assert.equal(marketValidation.allowed, true);
assert.ok(marketValidation.score >= 0.7);

if (previousDailyLoss === undefined) {
  delete process.env.KILL_SWITCH_MAX_DAILY_LOSS_USD;
} else {
  process.env.KILL_SWITCH_MAX_DAILY_LOSS_USD = previousDailyLoss;
}
if (previousLossWindow === undefined) {
  delete process.env.KILL_SWITCH_LOSS_WINDOW_HOURS;
} else {
  process.env.KILL_SWITCH_LOSS_WINDOW_HOURS = previousLossWindow;
}
if (previousStorePath === undefined) {
  delete process.env.EXECUTION_STATE_FILE;
} else {
  process.env.EXECUTION_STATE_FILE = previousStorePath;
}
if (previousAlertWebhookUrl === undefined) {
  delete process.env.ALERT_WEBHOOK_URL;
} else {
  process.env.ALERT_WEBHOOK_URL = previousAlertWebhookUrl;
}
alertServer.close();
rmSync(tempDir, { recursive: true, force: true });

console.log("profitability daily loss kill-switch regression test passed");
process.exit(0);
