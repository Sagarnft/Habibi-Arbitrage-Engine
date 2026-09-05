import assert from "node:assert/strict";
import { buildDashboardScanCandidates, buildDashboardSnapshot, recordExecutedTrade, serializeForJson } from "./server.js";
const scanCandidates = buildDashboardScanCandidates();
assert.ok(scanCandidates.length > 0, "expected at least one dashboard scan candidate");
assert.ok(scanCandidates.length <= 80, `expected a bounded scan pool, got ${scanCandidates.length}`);
assert.ok(scanCandidates.length >= 50, `expected expanded multi-chain coverage, got ${scanCandidates.length}`);
const snapshot = await buildDashboardSnapshot();
assert.equal(snapshot.chain, "arbitrum");
assert.equal(["offline", "healthy", "degraded"].includes(snapshot.health.overall), true);
assert.equal(typeof snapshot.risk.approved, "boolean");
assert.ok(snapshot.risk.score >= 0);
assert.equal(typeof snapshot.protection.allowed, "boolean");
assert.ok(snapshot.protection.score >= 0);
assert.ok(snapshot.executionReadiness, "expected execution readiness summary");
assert.equal(snapshot.executionReadiness.readyPairs >= 1, true);
assert.equal(snapshot.executionReadiness.pendingPairs >= 0, true);
assert.equal(typeof snapshot.executionReadiness.coverage, "string");
assert.ok(snapshot.executionReadiness.pairs.length >= 12, "expected compact readiness coverage");
assert.ok(snapshot.executionReadiness.pairs.some((pair) => pair.chain === "bnb"), "expected BNB readiness coverage");
assert.ok(snapshot.executionReadiness.pairs.some((pair) => pair.category), "expected readiness category metadata");
assert.ok(snapshot.bestOpportunity === undefined || typeof snapshot.bestOpportunity.buyDex === "string", "expected best-opportunity metadata to be absent or valid");
assert.ok(Array.isArray(snapshot.opportunitiesFeed), "expected an opportunities feed array");
assert.ok(typeof snapshot.bestProfit === "string", "expected a best-profit string");
assert.ok(typeof snapshot.bestRoute === "string", "expected a best-route string");
const liveSnapshot = await buildDashboardSnapshot({
    scanResult: {
        opportunities: Array.from({ length: 7 }, (_, index) => ({
            chain: index % 2 === 0 ? "arbitrum" : "bnb",
            tokenIn: `0x111111111111111111111111111111111111111${index + 1}`,
            tokenOut: `0x222222222222222222222222222222222222222${index + 1}`,
            buyDex: `uniswap-${index + 1}`,
            sellDex: "sushiswap",
            buyAmount: 1000n,
            sellAmount: 1100n,
            grossProfit: 100n,
            gasCost: 10n,
            netProfit: 90n,
            tokenInDecimals: 18,
            tokenOutDecimals: 18,
            profitable: true,
        })),
        scannedPairs: 1,
        failedPairs: 0,
    },
});
assert.ok(liveSnapshot.opportunities >= 0);
assert.equal(typeof liveSnapshot.bestRoute, "string");
const serialized = serializeForJson({
    plan: {
        estimatedProfit: 123n,
        steps: [{ amountIn: 456n, expectedOut: 789n }],
    },
    safety: { allowed: true },
});
assert.deepEqual(serialized, {
    plan: {
        estimatedProfit: "123",
        steps: [{ amountIn: "456", expectedOut: "789" }],
    },
    safety: { allowed: true },
});
assert.doesNotThrow(() => JSON.stringify(serialized));
const unconfirmedTrade = recordExecutedTrade({
    walletAddress: "0xabc",
    amountUsd: 120,
    route: { pair: "WETH/USDC", buyDex: "pancakeswap", sellDex: "biswap" },
});
assert.equal(unconfirmedTrade, undefined, "expected unconfirmed execution requests to stay out of the trade ledger");
const recordedTrade = recordExecutedTrade({
    walletAddress: "0xabc",
    amountUsd: 120,
    route: { pair: "WETH/USDC", buyDex: "pancakeswap", sellDex: "biswap" },
    txHash: "0xabc123",
    confirmed: true,
});
assert.ok(recordedTrade, "expected a confirmed trade receipt when execution is explicitly confirmed");
assert.equal(recordedTrade?.txHash, "0xabc123", "expected the provided transaction hash to be preserved in the receipt");
assert.equal(recordedTrade?.status, "On-chain confirmed", "expected the execution ledger to only mark on-chain-confirmed transactions");
assert.equal(recordedTrade?.pnl, "$0", "expected the recorded trade PnL to stay neutral until realized settlement is available");
console.log("server snapshot regression test passed");
process.exit(0);
