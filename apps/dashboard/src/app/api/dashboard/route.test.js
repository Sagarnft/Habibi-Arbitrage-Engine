"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const route_js_1 = require("./route.js");
const upstream_js_1 = require("./upstream.js");
(0, node_test_1.default)("resolveUpstreamBaseUrl defaults to the blockchain API port", () => {
    const url = (0, upstream_js_1.resolveUpstreamBaseUrl)();
    strict_1.default.equal(url === "http://127.0.0.1:4000" || url === "http://localhost:4000", true);
});
(0, node_test_1.default)("GET returns the upstream dashboard payload when the blockchain API is slow", async () => {
    const originalTimeout = process.env.DASHBOARD_UPSTREAM_TIMEOUT_MS;
    process.env.DASHBOARD_UPSTREAM_TIMEOUT_MS = "15000";
    try {
        const response = await (0, route_js_1.GET)();
        strict_1.default.equal(response.status, 200);
        const payload = await response.json();
        strict_1.default.ok(payload.executionReadiness || payload.opportunitiesFeed?.length);
        strict_1.default.equal(typeof payload.recoveryWorker, "object");
        strict_1.default.equal(typeof payload.settlementWorker, "object");
        strict_1.default.equal(typeof payload.settlementQueue, "object");
        strict_1.default.equal(typeof payload.settlements, "object");
        strict_1.default.equal(typeof payload.rollout, "object");
        strict_1.default.equal(typeof payload.signerPolicy, "object");
        strict_1.default.equal(typeof payload.capitalPolicy, "object");
        strict_1.default.equal(typeof payload.capitalPolicy.activeAllocationShare, "number");
        strict_1.default.equal(typeof payload.capitalGrowth, "object");
        strict_1.default.equal(typeof payload.capitalGrowth.allowed, "boolean");
        strict_1.default.equal(typeof payload.marketValidation, "object");
        strict_1.default.equal(typeof payload.marketValidation.allowed, "boolean");
        strict_1.default.equal(typeof payload.canaryValidation, "object");
        strict_1.default.equal(typeof payload.canaryValidation.goForScale, "boolean");
        strict_1.default.equal(typeof payload.relayRpcDrill, "object");
        strict_1.default.equal(typeof payload.relayRpcDrill.overallPass, "boolean");
        strict_1.default.equal(typeof payload.liveCostTuning, "object");
        strict_1.default.equal(typeof payload.liveCostTuning.sizingPenaltyMultiplier, "number");
        strict_1.default.equal(typeof payload.readinessGate, "object");
        strict_1.default.equal(typeof payload.readinessGate.pass, "boolean");
        strict_1.default.equal(Array.isArray(payload.readinessGateHistory), true);
        strict_1.default.equal(typeof payload.operatorSafety, "object");
        strict_1.default.equal(typeof payload.operatorSafety.overallPass, "boolean");
        strict_1.default.equal(typeof payload.deploymentSafety, "object");
        strict_1.default.equal(typeof payload.deploymentSafety.restart.safeToRestart, "boolean");
        strict_1.default.equal(typeof payload.reconciliation, "object");
        strict_1.default.equal(typeof payload.reconciliation.matched, "number");
        strict_1.default.equal(typeof payload.rollout.governance, "object");
    }
    finally {
        if (originalTimeout === undefined) {
            delete process.env.DASHBOARD_UPSTREAM_TIMEOUT_MS;
        }
        else {
            process.env.DASHBOARD_UPSTREAM_TIMEOUT_MS = originalTimeout;
        }
    }
});
