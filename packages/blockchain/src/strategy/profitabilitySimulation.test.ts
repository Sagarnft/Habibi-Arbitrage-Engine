import assert from "node:assert/strict";
import test from "node:test";
import { ProfitabilityController } from "./profitability.js";

test("quality gate blocks latency/slippage spikes", () => {
  const previousMaxSlippage = process.env.MAX_PREDICTED_SLIPPAGE_BPS;
  process.env.MAX_PREDICTED_SLIPPAGE_BPS = "250";
  try {
    const controller = new ProfitabilityController();
    const now = Date.now();
    for (let index = 0; index < 24; index += 1) {
      controller.recordReplayRow({
        timestamp: now - (index * 1_000),
        chain: "arbitrum",
        pair: "WETH/USDC",
        buyDex: "uniswap-v3",
        sellDex: "sushiswap",
        strategy: "major-arb",
        expectedNetUsd: 12,
        slippageBps: 420 + index,
        gasImpactBps: 40,
        mevRiskScore: 80,
        confidenceScore: 95,
        executable: true,
      });
    }

    const gate = controller.evaluateQualityGate({
      chain: "arbitrum",
      pair: "WETH/USDC",
      buyDex: "uniswap-v3",
      sellDex: "sushiswap",
      amountUsd: 300,
      grossProfitUsd: 30,
      netProfitUsd: 22,
      gasCostUsd: 1.5,
      slippageBps: 410,
      gasImpactBps: 35,
      confidenceHint: 95,
    });

    assert.equal(gate.allowed, false);
    assert.equal(gate.predictedSlippageBps > 250, true);
    assert.equal(gate.reason.includes("predicted slippage"), true);
  } finally {
    if (previousMaxSlippage === undefined) {
      delete process.env.MAX_PREDICTED_SLIPPAGE_BPS;
    } else {
      process.env.MAX_PREDICTED_SLIPPAGE_BPS = previousMaxSlippage;
    }
  }
});

test("historical replay summary flags weak profitability before dry-run", () => {
  const controller = new ProfitabilityController();
  const rows = [
    {
      timestamp: Date.now(),
      chain: "arbitrum",
      pair: "WETH/USDC",
      buyDex: "uniswap-v3",
      sellDex: "camelot",
      strategy: "major-arb",
      expectedNetUsd: 0.3,
      slippageBps: 220,
      gasImpactBps: 50,
      mevRiskScore: 88,
      confidenceScore: 74,
      executable: true,
    },
    {
      timestamp: Date.now() + 1,
      chain: "arbitrum",
      pair: "ETH/USDC",
      buyDex: "camelot",
      sellDex: "uniswap-v3",
      strategy: "stable-arb",
      expectedNetUsd: 0.12,
      slippageBps: 260,
      gasImpactBps: 38,
      mevRiskScore: 86,
      confidenceScore: 72,
      executable: true,
    },
    {
      timestamp: Date.now() + 2,
      chain: "arbitrum",
      pair: "BTC/USDC",
      buyDex: "uniswap-v3",
      sellDex: "camelot",
      strategy: "major-arb",
      expectedNetUsd: 0.05,
      slippageBps: 400,
      gasImpactBps: 90,
      mevRiskScore: 92,
      confidenceScore: 68,
      executable: false,
    },
  ] as const;

  const summary = controller.summarizeHistoricalReplay(rows);
  assert.equal(summary.totalRows, 3);
  assert.equal(summary.executableRows, 2);
  assert.equal(summary.readyForDryRun, false);
  assert.ok(summary.passRate < 60);
  assert.match(summary.reason, /dry-run/i);
});

test("kill-switch engages on rpc instability spikes", () => {
  const previousMaxConsecutive = process.env.KILL_SWITCH_MAX_CONSECUTIVE_LOSSES;
  const previousMaxSlippageEvents = process.env.KILL_SWITCH_MAX_SLIPPAGE_EVENTS;
  const previousMaxRpcEvents = process.env.KILL_SWITCH_MAX_RPC_INSTABILITY_EVENTS;
  const previousMaxDailyLoss = process.env.KILL_SWITCH_MAX_DAILY_LOSS_USD;

  process.env.KILL_SWITCH_MAX_CONSECUTIVE_LOSSES = "99";
  process.env.KILL_SWITCH_MAX_SLIPPAGE_EVENTS = "99";
  process.env.KILL_SWITCH_MAX_RPC_INSTABILITY_EVENTS = "2";
  process.env.KILL_SWITCH_MAX_DAILY_LOSS_USD = "9999";

  try {
    const controller = new ProfitabilityController();
    controller.recordExecutionOutcome({
      realizedNetUsd: 0.4,
      failed: false,
      slippageBps: 20,
      rpcHealthy: false,
    });
    controller.recordExecutionOutcome({
      realizedNetUsd: 0.6,
      failed: false,
      slippageBps: 22,
      rpcHealthy: false,
    });

    const state = controller.getKillSwitchState();
    assert.equal(state.engaged, true);
    assert.equal(state.rpcInstabilityEvents >= 2, true);
    assert.equal(state.reason, "Kill-switch engaged due to RPC instability");
  } finally {
    if (previousMaxConsecutive === undefined) {
      delete process.env.KILL_SWITCH_MAX_CONSECUTIVE_LOSSES;
    } else {
      process.env.KILL_SWITCH_MAX_CONSECUTIVE_LOSSES = previousMaxConsecutive;
    }
    if (previousMaxSlippageEvents === undefined) {
      delete process.env.KILL_SWITCH_MAX_SLIPPAGE_EVENTS;
    } else {
      process.env.KILL_SWITCH_MAX_SLIPPAGE_EVENTS = previousMaxSlippageEvents;
    }
    if (previousMaxRpcEvents === undefined) {
      delete process.env.KILL_SWITCH_MAX_RPC_INSTABILITY_EVENTS;
    } else {
      process.env.KILL_SWITCH_MAX_RPC_INSTABILITY_EVENTS = previousMaxRpcEvents;
    }
    if (previousMaxDailyLoss === undefined) {
      delete process.env.KILL_SWITCH_MAX_DAILY_LOSS_USD;
    } else {
      process.env.KILL_SWITCH_MAX_DAILY_LOSS_USD = previousMaxDailyLoss;
    }
  }
});
