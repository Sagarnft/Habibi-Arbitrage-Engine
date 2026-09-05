import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = mkdtempSync(path.join(os.tmpdir(), "habibi-server-hardening-"));
const statePath = path.join(tempDir, "execution-state.json");
const previousStorePath = process.env.EXECUTION_STATE_FILE;
process.env.EXECUTION_STATE_FILE = statePath;

try {
  const {
    buildDeploymentSafetySnapshot,
    buildPostTradeReconciliationSnapshot,
    buildRecoveryTicketSnapshot,
    buildStrategyTuningRecommendations,
    createRecoveryTicket,
    recordExecutedTrade,
    settleTradeByHash,
  } = await import("./server.js");

  const trade = recordExecutedTrade({
    walletAddress: "0xabc",
    amountUsd: 180,
    route: { pair: "WETH/USDC", buyDex: "uniswap-v3", sellDex: "sushiswap" },
    txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    confirmed: true,
  });

  assert.ok(trade, "expected a confirmed trade entry before settlement");

  const settled = settleTradeByHash({
    txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    realizedNetUsd: -12.75,
    gasCostUsd: 3.4,
    slippageCostUsd: 2.1,
    note: "settlement from execution wallet",
  });

  assert.equal(settled.success, true, "expected settlement to succeed for known transaction hash");
  assert.equal(settled.trade?.status, "On-chain settled");
  assert.equal(settled.trade?.pnl.startsWith("-$"), true, "expected negative settled pnl format");

  const recovery = createRecoveryTicket({
    chain: "arbitrum",
    walletAddress: "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD",
    amountUsd: 180,
    reason: "partial execution requires recovery",
    route: { pair: "WETH/USDC", buyDex: "uniswap-v3", sellDex: "sushiswap" },
    sourceTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });

  assert.ok(recovery.id.startsWith("recovery-"));
  const recoverySnapshot = buildRecoveryTicketSnapshot();
  assert.equal(recoverySnapshot.pending >= 1, true, "expected at least one pending recovery ticket");

  writeFileSync(statePath, "{}\n", "utf8");
  const deploymentSafety = buildDeploymentSafetySnapshot();
  assert.equal(deploymentSafety.persistence.exists, true);
  assert.equal(typeof deploymentSafety.process.uptimeSeconds, "number");
  assert.equal(deploymentSafety.restart.safeToRestart, false);

  const reconciliation = buildPostTradeReconciliationSnapshot();
  assert.equal(reconciliation.matched >= 1, true);
  assert.equal(reconciliation.pending >= 0, true);
  assert.equal(reconciliation.orphanSettlements >= 0, true);

  const tuning = buildStrategyTuningRecommendations();
  assert.ok(Array.isArray(tuning.recommendations), "expected strategy tuning recommendations");
  assert.equal(tuning.recommendations.length >= 1, true);

  console.log("server hardening regression test passed");
} finally {
  if (previousStorePath === undefined) {
    delete process.env.EXECUTION_STATE_FILE;
  } else {
    process.env.EXECUTION_STATE_FILE = previousStorePath;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
