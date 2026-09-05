import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = mkdtempSync(path.join(os.tmpdir(), "habibi-live-cost-"));
const statePath = path.join(tempDir, "execution-state.json");
const previousStorePath = process.env.EXECUTION_STATE_FILE;
process.env.EXECUTION_STATE_FILE = statePath;

try {
  const {
    buildLiveCostTuningSnapshot,
    createSettlementQueueItem,
    recordExecutedTrade,
    settleTradeByHash,
  } = await import("./server.js");

  const initial = buildLiveCostTuningSnapshot({ windowTrades: 10 });
  assert.equal(initial.windowTrades, 0);
  assert.equal(initial.slippageMultiplier, 1);
  assert.equal(initial.sizingPenaltyMultiplier, 1);

  const txHashes = [
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  ] as const;

  for (const txHash of txHashes) {
    recordExecutedTrade({
      walletAddress: "0xabc",
      amountUsd: 100,
      route: { pair: "WETH/USDC", buyDex: "uniswap-v3", sellDex: "sushiswap" },
      txHash,
      confirmed: true,
    });
    createSettlementQueueItem({
      txHash,
      chain: "arbitrum",
      walletAddress: "0x1111111111111111111111111111111111111111",
      amountUsd: 100,
    });
  }

  settleTradeByHash({
    txHash: txHashes[0],
    gasCostUsd: 7,
    slippageCostUsd: 1.2,
    realizedNetUsd: -1,
  });
  settleTradeByHash({
    txHash: txHashes[1],
    gasCostUsd: 6,
    slippageCostUsd: 0.9,
    realizedNetUsd: -0.4,
  });
  settleTradeByHash({
    txHash: txHashes[2],
    gasCostUsd: 5.5,
    slippageCostUsd: 0.7,
    realizedNetUsd: 0.2,
  });

  const stressed = buildLiveCostTuningSnapshot({ windowTrades: 3 });
  assert.equal(stressed.windowTrades, 3);
  assert.equal(stressed.sizingPenaltyMultiplier < 1, true);
  assert.equal(stressed.slippageMultiplier > 1, true);
  assert.equal(stressed.gasCostBufferUsd > 0, true);

  const neutral = buildLiveCostTuningSnapshot({ windowTrades: 999 });
  assert.equal(neutral.windowTrades >= 3, true);
  assert.equal(neutral.sizingPenaltyMultiplier <= 1, true);

  console.log("live cost tuning regression test passed");
} finally {
  if (previousStorePath === undefined) {
    delete process.env.EXECUTION_STATE_FILE;
  } else {
    process.env.EXECUTION_STATE_FILE = previousStorePath;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
