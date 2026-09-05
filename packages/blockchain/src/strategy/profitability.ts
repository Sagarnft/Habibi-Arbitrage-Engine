import { getEngineConfigSnapshot, getStrategyProfiles } from "../config/engineConfig.js";
import { appendAlertEvent, getAlertHistoryState, acknowledgeAlertEvent } from "../api/executionStore.js";
import { randomUUID } from "node:crypto";

type StrategyBucket = "stable-arb" | "major-arb" | "volatile-arb";

export type QualityGateDecision = {
  allowed: boolean;
  reason: string;
  strategy: StrategyBucket;
  confidenceScore: number;
  mevRiskScore: number;
  predictedSlippageBps: number;
  expectedNetUsd: number;
  expectedCostUsd: number;
  recommendPrivateRelay: boolean;
};

export type ReplayRow = {
  timestamp: number;
  chain: string;
  pair: string;
  buyDex: string;
  sellDex: string;
  strategy: StrategyBucket;
  expectedNetUsd: number;
  slippageBps: number;
  gasImpactBps: number;
  mevRiskScore: number;
  confidenceScore: number;
  executable: boolean;
};

export type AdaptiveSizingDecision = {
  requestedNotionalUsd: number;
  recommendedNotionalUsd: number;
  maxNotionalUsd: number;
  multiplier: number;
  reason: string;
};

export type CapitalGrowthDecision = {
  status: "paused" | "cooldown" | "conservative" | "growing";
  currentActiveShare: number;
  recommendedActiveShare: number;
  deltaActiveShare: number;
  winRatePct: number;
  drawdownPct: number;
  realizedNetUsd: number;
  decisionScore: number;
  allowed: boolean;
  reason: string;
  nextReviewAt: string;
};

export type MarketReadinessDecision = {
  status: "hold" | "watch" | "ready";
  allowed: boolean;
  score: number;
  liveOpportunityRatio: number;
  avgExpectedNetUsd: number;
  rpcHealthyRatio: number;
  reason: string;
};

export type ReplayValidationSummary = {
  totalRows: number;
  executableRows: number;
  acceptedRows: number;
  rejectedRows: number;
  avgExpectedNetUsd: number;
  avgConfidenceScore: number;
  avgSlippageBps: number;
  avgMevRiskScore: number;
  passRate: number;
  readyForDryRun: boolean;
  reason: string;
};

export type KillSwitchState = {
  engaged: boolean;
  reason?: string;
  engagedAt?: string;
  consecutiveLosses: number;
  abnormalSlippageEvents: number;
  rpcInstabilityEvents: number;
  dailyRealizedLossUsd: number;
};

type AttributionTotals = {
  spreadGainUsd: number;
  gasCostUsd: number;
  slippageCostUsd: number;
  failedTxLossUsd: number;
  realizedNetUsd: number;
};

type RealizedOutcomeRow = {
  timestamp: number;
  realizedNetUsd: number;
};

type AlertSeverity = "info" | "warning" | "critical";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeFinite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function classifyAlertSeverity(event: string): AlertSeverity {
  const normalized = event.toLowerCase();
  if (normalized.includes("kill-switch") || normalized.includes("failure") || normalized.includes("blocked")) {
    return "critical";
  }
  if (normalized.includes("relay") || normalized.includes("rpc") || normalized.includes("alert")) {
    return "warning";
  }
  return "info";
}

function buildAlertResponseAction(event: string, delivered: boolean, severity: AlertSeverity): string {
  const normalized = event.toLowerCase();
  if (normalized.includes("kill-switch")) {
    return "pause-execution-and-review-losses";
  }
  if (normalized.includes("failure")) {
    return "inspect-failed-route-and-retry-after-review";
  }
  if (normalized.includes("relay") || normalized.includes("rpc")) {
    return "verify-relay-and-rpc-failover";
  }
  if (severity === "critical" && !delivered) {
    return "escalate-and-disable-new-executions";
  }
  return "review-notification";
}

export class ProfitabilityController {
  private readonly replayWindowSize: number;
  private readonly minExpectedNetUsd: number;
  private readonly minConfidenceScore: number;
  private readonly maxAllowedPredictedSlippageBps: number;
  private readonly maxAllowedMevRiskScore: number;
  private readonly safetyBufferUsd: number;
  private readonly requirePrivateRelayOnHighMev: boolean;
  private readonly killSwitchMaxConsecutiveLosses: number;
  private readonly killSwitchMaxSlippageEvents: number;
  private readonly killSwitchMaxRpcInstabilityEvents: number;
  private readonly killSwitchMaxDailyLossUsd: number;
  private readonly killSwitchLossWindowMs: number;

  private readonly replayRows: ReplayRow[] = [];
  private readonly realizedOutcomeRows: RealizedOutcomeRow[] = [];
  private attributionTotals: AttributionTotals = {
    spreadGainUsd: 0,
    gasCostUsd: 0,
    slippageCostUsd: 0,
    failedTxLossUsd: 0,
    realizedNetUsd: 0,
  };
  private killSwitch: KillSwitchState = {
    engaged: false,
    consecutiveLosses: 0,
    abnormalSlippageEvents: 0,
    rpcInstabilityEvents: 0,
    dailyRealizedLossUsd: 0,
  };

  constructor() {
    const config = getEngineConfigSnapshot();
    this.replayWindowSize = config.strategy.replayWindowSize;
    this.minExpectedNetUsd = config.strategy.minExpectedNetUsd;
    this.minConfidenceScore = config.strategy.minConfidenceScore;
    this.maxAllowedPredictedSlippageBps = config.strategy.maxPredictedSlippageBps;
    this.maxAllowedMevRiskScore = config.strategy.maxMevRiskScore;
    this.safetyBufferUsd = config.strategy.safetyBufferUsd;
    this.requirePrivateRelayOnHighMev = config.strategy.requirePrivateRelayOnHighMev;
    this.killSwitchMaxConsecutiveLosses = config.strategy.killSwitchMaxConsecutiveLosses;
    this.killSwitchMaxSlippageEvents = config.strategy.killSwitchMaxSlippageEvents;
    this.killSwitchMaxRpcInstabilityEvents = config.strategy.killSwitchMaxRpcInstabilityEvents;
    this.killSwitchMaxDailyLossUsd = config.strategy.killSwitchMaxDailyLossUsd;
    this.killSwitchLossWindowMs = Math.max(60_000, config.strategy.killSwitchLossWindowHours * 60 * 60 * 1000);
  }

  public classifyStrategy(pair: string): StrategyBucket {
    const normalized = pair.toUpperCase();
    const stableSet = ["USDC", "USDT", "DAI", "FRAX", "LUSD", "BUSD"];
    const stableCount = stableSet.reduce((count, symbol) => (normalized.includes(symbol) ? count + 1 : count), 0);
    if (stableCount >= 2) {
      return "stable-arb";
    }

    const majorSet = ["WETH", "ETH", "WBTC", "BTC", "WBNB", "BNB", "WMATIC", "MATIC", "WAVAX", "AVAX"];
    if (majorSet.some((symbol) => normalized.includes(symbol))) {
      return "major-arb";
    }
    return "volatile-arb";
  }

  public predictSlippageBps(baseSlippageBps: number, strategy: StrategyBucket): number {
    const base = Math.max(0, normalizeFinite(baseSlippageBps, 0));
    const recent = this.replayRows
      .filter((row) => row.strategy === strategy)
      .slice(-50);
    if (!recent.length) {
      return base;
    }
    const mean = recent.reduce((sum, row) => sum + row.slippageBps, 0) / recent.length;
    const variance = recent.reduce((sum, row) => sum + ((row.slippageBps - mean) ** 2), 0) / recent.length;
    const volatilityComponent = Math.sqrt(Math.max(0, variance)) * 0.35;
    return Math.round(clamp((base * 0.65) + (mean * 0.35) + volatilityComponent, 0, 5000));
  }

  public evaluateQualityGate(input: {
    chain: string;
    pair: string;
    buyDex: string;
    sellDex: string;
    amountUsd: number;
    grossProfitUsd: number;
    netProfitUsd: number;
    gasCostUsd: number;
    slippageBps: number;
    gasImpactBps: number;
    confidenceHint?: number;
  }): QualityGateDecision {
    const strategy = this.classifyStrategy(input.pair);
    const profile = getStrategyProfiles()[strategy];
    const predictedSlippageBps = this.predictSlippageBps(input.slippageBps, strategy);
    const slippageCostUsd = (Math.max(0, input.amountUsd) * predictedSlippageBps) / 10_000;
    const mevRiskScore = clamp(
      Math.round(
        (predictedSlippageBps * 0.18)
        + (Math.max(0, input.gasImpactBps) * 0.12)
        + ((100 - clamp(Number(input.confidenceHint ?? 75), 0, 100)) * 0.8),
      ),
      0,
      100,
    );
    const mevBufferUsd = mevRiskScore >= 80 ? Math.max(0.03, input.amountUsd * 0.0025) : Math.max(0.01, input.amountUsd * 0.001);
    const expectedCostUsd = Math.max(0, input.gasCostUsd) + slippageCostUsd + mevBufferUsd + this.safetyBufferUsd;
    const expectedNetUsd = Math.max(0, input.netProfitUsd) - expectedCostUsd;
    const confidenceScore = clamp(
      Math.round(
        100
        - (predictedSlippageBps * 0.06)
        - (Math.max(0, input.gasImpactBps) * 0.03)
        + Math.min(20, Math.max(0, input.netProfitUsd * 5)),
      ),
      0,
      100,
    );
    const minExpectedNetUsd = profile.minExpectedNetUsd;
    const minConfidenceScore = profile.minConfidenceScore;
    const maxAllowedSlippageBps = Math.min(profile.maxPredictedSlippageBps, this.maxAllowedPredictedSlippageBps);
    const maxAllowedMevRiskScore = Math.min(profile.maxMevRiskScore, this.maxAllowedMevRiskScore);
    const recommendPrivateRelay = mevRiskScore >= profile.relayThresholdMev || predictedSlippageBps >= profile.relayThresholdSlippageBps;
    const relayRequiredAndMissing = this.requirePrivateRelayOnHighMev && recommendPrivateRelay;
    const allowed = expectedNetUsd >= minExpectedNetUsd
      && confidenceScore >= minConfidenceScore
      && predictedSlippageBps <= maxAllowedSlippageBps
      && mevRiskScore <= maxAllowedMevRiskScore
      && !relayRequiredAndMissing;

    const reason = allowed
      ? "Quality gate passed for execution"
      : relayRequiredAndMissing
        ? "Execution blocked: high MEV risk requires private relay routing"
        : expectedNetUsd < minExpectedNetUsd
          ? `Execution blocked: expected net ${expectedNetUsd.toFixed(4)} USD below minimum ${minExpectedNetUsd.toFixed(4)} USD`
          : confidenceScore < minConfidenceScore
            ? `Execution blocked: confidence ${confidenceScore} below threshold ${minConfidenceScore}`
            : predictedSlippageBps > maxAllowedSlippageBps
              ? `Execution blocked: predicted slippage ${predictedSlippageBps} bps exceeds limit ${maxAllowedSlippageBps} bps`
              : `Execution blocked: MEV risk score ${mevRiskScore} exceeds limit ${maxAllowedMevRiskScore}`;

    return {
      allowed,
      reason,
      strategy,
      confidenceScore,
      mevRiskScore,
      predictedSlippageBps,
      expectedNetUsd,
      expectedCostUsd,
      recommendPrivateRelay,
    };
  }

  public recordReplayRow(row: ReplayRow): void {
    this.replayRows.push(row);
    if (this.replayRows.length > this.replayWindowSize) {
      this.replayRows.splice(0, this.replayRows.length - this.replayWindowSize);
    }
  }

  public getAdaptiveSizing(input: {
    requestedNotionalUsd: number;
    walletUsdtBalance?: number;
    winRatePct: number;
    drawdownPct: number;
    rpcHealthyRatio: number;
    strategy: StrategyBucket;
  }): AdaptiveSizingDecision {
    const strategyProfiles = getStrategyProfiles();
    const strategyModifier = strategyProfiles[input.strategy]?.sizingMultiplier ?? (input.strategy === "stable-arb" ? 1.1 : input.strategy === "major-arb" ? 1 : 0.75);
    const winModifier = clamp(input.winRatePct / 100, 0.4, 1.25);
    const drawdownModifier = clamp(1 - (Math.max(0, input.drawdownPct) / 100), 0.4, 1);
    const rpcModifier = clamp(input.rpcHealthyRatio, 0.5, 1.1);
    const multiplier = clamp(strategyModifier * winModifier * drawdownModifier * rpcModifier, 0.25, 1.5);
    const requested = Math.max(0, input.requestedNotionalUsd);
    const recommended = requested * multiplier;
    const walletCap = Number.isFinite(input.walletUsdtBalance ?? Number.NaN)
      ? Math.max(0, Number(input.walletUsdtBalance))
      : Number.POSITIVE_INFINITY;
    const maxNotionalUsd = Math.min(walletCap, recommended);
    const boundedRecommended = Number.isFinite(maxNotionalUsd)
      ? maxNotionalUsd
      : recommended;

    return {
      requestedNotionalUsd: requested,
      recommendedNotionalUsd: Number(boundedRecommended.toFixed(4)),
      maxNotionalUsd: Number((Number.isFinite(maxNotionalUsd) ? maxNotionalUsd : recommended).toFixed(4)),
      multiplier: Number(multiplier.toFixed(4)),
      reason: `Sizing adjusted by strategy=${strategyModifier.toFixed(2)}, win=${winModifier.toFixed(2)}, drawdown=${drawdownModifier.toFixed(2)}, rpc=${rpcModifier.toFixed(2)}`,
    };
  }

  public getMarketReadinessDecision(input: {
    executableOpportunityRatio?: number;
    avgExpectedNetUsd?: number;
    rpcHealthyRatio?: number;
    winRatePct?: number;
    drawdownPct?: number;
    liveOpportunityCount?: number;
    totalScannedCount?: number;
  }): MarketReadinessDecision {
    const opportunityRatio = clamp(Number(input.executableOpportunityRatio ?? 0), 0, 1);
    const avgExpectedNetUsd = Number.isFinite(Number(input.avgExpectedNetUsd)) ? Number(input.avgExpectedNetUsd) : 0;
    const rpcHealthyRatio = clamp(Number(input.rpcHealthyRatio ?? 1), 0, 1);
    const winRatePct = clamp(Number(input.winRatePct ?? 55), 0, 100);
    const drawdownPct = Math.max(0, Number(input.drawdownPct ?? 0));
    const liveOpportunityCount = Math.max(0, Number(input.liveOpportunityCount ?? 0));
    const totalScannedCount = Math.max(1, Number(input.totalScannedCount ?? 1));
    const liveRatio = clamp(liveOpportunityCount / totalScannedCount, 0, 1);
    const score = clamp(
      (opportunityRatio * 0.4)
        + (Math.min(avgExpectedNetUsd / 10, 1) * 0.35)
        + (rpcHealthyRatio * 0.2)
        + ((winRatePct / 100) * 0.2)
        + ((1 - Math.min(drawdownPct / 20, 1)) * 0.1)
        + (liveRatio * 0.2),
      0,
      1,
    );

    const healthyMarket = score >= 0.5
      && opportunityRatio >= 0.2
      && liveRatio >= 0.1
      && rpcHealthyRatio >= 0.9
      && winRatePct >= 55
      && drawdownPct <= 10;
    if (healthyMarket) {
      return {
        status: "ready",
        allowed: true,
        score: Number(score.toFixed(4)),
        liveOpportunityRatio: Number(liveRatio.toFixed(4)),
        avgExpectedNetUsd: Number(avgExpectedNetUsd.toFixed(4)),
        rpcHealthyRatio: Number(rpcHealthyRatio.toFixed(4)),
        reason: "Live market quality is strong enough to keep scaling with the current safety stack.",
      };
    }
    if (score >= 0.38 || liveRatio >= 0.05) {
      return {
        status: "watch",
        allowed: true,
        score: Number(score.toFixed(4)),
        liveOpportunityRatio: Number(liveRatio.toFixed(4)),
        avgExpectedNetUsd: Number(avgExpectedNetUsd.toFixed(4)),
        rpcHealthyRatio: Number(rpcHealthyRatio.toFixed(4)),
        reason: "The engine is operational, but market quality is still not strong enough to scale aggressively.",
      };
    }
    return {
      status: "hold",
      allowed: false,
      score: Number(score.toFixed(4)),
      liveOpportunityRatio: Number(liveRatio.toFixed(4)),
      avgExpectedNetUsd: Number(avgExpectedNetUsd.toFixed(4)),
      rpcHealthyRatio: Number(rpcHealthyRatio.toFixed(4)),
      reason: "No stable live market validation yet; keep capital and execution conservative.",
    };
  }

  public getCapitalGrowthDecision(input: {
    currentActiveShare?: number;
    winRatePct?: number;
    drawdownPct?: number;
    realizedNetUsd?: number;
    dailyRealizedLossUsd?: number;
    rpcHealthyRatio?: number;
    killSwitchEngaged?: boolean;
  }): CapitalGrowthDecision {
    const currentActiveShare = clamp(Number.isFinite(Number(input.currentActiveShare)) ? Number(input.currentActiveShare) : 0.6, 0.15, 0.8);
    const winRatePct = clamp(Number(input.winRatePct ?? 55), 0, 100);
    const drawdownPct = Math.max(0, Number(input.drawdownPct ?? 0));
    const realizedNetUsd = Number.isFinite(Number(input.realizedNetUsd)) ? Number(input.realizedNetUsd) : 0;
    const dailyRealizedLossUsd = Number.isFinite(Number(input.dailyRealizedLossUsd)) ? Number(input.dailyRealizedLossUsd) : this.killSwitch.dailyRealizedLossUsd;
    const rpcHealthyRatio = clamp(Number(input.rpcHealthyRatio ?? 1), 0, 1);
    const killSwitchEngaged = Boolean(input.killSwitchEngaged ?? this.killSwitch.engaged);
    const decisionScore = clamp(
      (winRatePct / 100) * 0.45
        + ((1 - Math.min(drawdownPct / 25, 1)) * 0.25)
        + (rpcHealthyRatio * 0.2)
        + ((realizedNetUsd >= 0 ? 1 : 0) * 0.1),
      0,
      1,
    );

    if (killSwitchEngaged || drawdownPct > 15 || dailyRealizedLossUsd > 0) {
      const recommendedActiveShare = clamp(currentActiveShare * 0.7, 0.15, 0.75);
      return {
        status: "paused",
        currentActiveShare,
        recommendedActiveShare,
        deltaActiveShare: Number((recommendedActiveShare - currentActiveShare).toFixed(4)),
        winRatePct,
        drawdownPct,
        realizedNetUsd,
        decisionScore,
        allowed: false,
        reason: "Capital growth paused due to kill-switch, drawdown, or realized loss pressure.",
        nextReviewAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };
    }

    if (decisionScore >= 0.8 && winRatePct >= 60 && drawdownPct <= 8 && realizedNetUsd >= 0) {
      const recommendedActiveShare = clamp(currentActiveShare + 0.08, 0.2, 0.8);
      return {
        status: "growing",
        currentActiveShare,
        recommendedActiveShare,
        deltaActiveShare: Number((recommendedActiveShare - currentActiveShare).toFixed(4)),
        winRatePct,
        drawdownPct,
        realizedNetUsd,
        decisionScore,
        allowed: true,
        reason: "Profitability is stable enough to expand capital by a measured, conservative step.",
        nextReviewAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      };
    }

    if (decisionScore >= 0.65 && winRatePct >= 50 && drawdownPct <= 12) {
      const recommendedActiveShare = clamp(currentActiveShare + 0.04, 0.2, 0.8);
      return {
        status: "conservative",
        currentActiveShare,
        recommendedActiveShare,
        deltaActiveShare: Number((recommendedActiveShare - currentActiveShare).toFixed(4)),
        winRatePct,
        drawdownPct,
        realizedNetUsd,
        decisionScore,
        allowed: true,
        reason: "Performance is acceptable for small, controlled capital scaling only.",
        nextReviewAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      };
    }

    const recommendedActiveShare = clamp(currentActiveShare * 0.85, 0.15, 0.75);
    return {
      status: "cooldown",
      currentActiveShare,
      recommendedActiveShare,
      deltaActiveShare: Number((recommendedActiveShare - currentActiveShare).toFixed(4)),
      winRatePct,
      drawdownPct,
      realizedNetUsd,
      decisionScore,
      allowed: true,
      reason: "Recent performance is mixed; capital should remain steady and only expand after a clean recovery stretch.",
      nextReviewAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };
  }

  public recordExecutionOutcome(input: {
    spreadGainUsd?: number;
    gasCostUsd?: number;
    slippageCostUsd?: number;
    realizedNetUsd?: number;
    failed?: boolean;
    slippageBps?: number;
    rpcHealthy?: boolean;
  }): void {
    const spreadGain = Math.max(0, normalizeFinite(Number(input.spreadGainUsd ?? 0), 0));
    const gasCost = Math.max(0, normalizeFinite(Number(input.gasCostUsd ?? 0), 0));
    const slippageCost = Math.max(0, normalizeFinite(Number(input.slippageCostUsd ?? 0), 0));
    const realizedNet = normalizeFinite(Number(input.realizedNetUsd ?? 0), 0);

    this.attributionTotals.spreadGainUsd += spreadGain;
    this.attributionTotals.gasCostUsd += gasCost;
    this.attributionTotals.slippageCostUsd += slippageCost;
    this.attributionTotals.realizedNetUsd += realizedNet;
    this.realizedOutcomeRows.push({ timestamp: Date.now(), realizedNetUsd: realizedNet });
    this.pruneRealizedOutcomeRows();
    this.killSwitch.dailyRealizedLossUsd = this.computeRollingLossUsd();

    if (input.failed || realizedNet < 0) {
      this.killSwitch.consecutiveLosses += 1;
      this.attributionTotals.failedTxLossUsd += Math.abs(realizedNet);
    } else {
      this.killSwitch.consecutiveLosses = 0;
    }

    if (Number(input.slippageBps ?? 0) >= this.maxAllowedPredictedSlippageBps) {
      this.killSwitch.abnormalSlippageEvents += 1;
    }
    if (input.rpcHealthy === false) {
      this.killSwitch.rpcInstabilityEvents += 1;
    }

    this.refreshKillSwitch();
  }

  public getKillSwitchState(): KillSwitchState {
    return { ...this.killSwitch };
  }

  public resetKillSwitch(reason = "manual reset"): KillSwitchState {
    this.killSwitch = {
      engaged: false,
      reason,
      consecutiveLosses: 0,
      abnormalSlippageEvents: 0,
      rpcInstabilityEvents: 0,
      dailyRealizedLossUsd: this.computeRollingLossUsd(),
      engagedAt: undefined,
    };
    return this.getKillSwitchState();
  }

  public getRuntimeConfig() {
    return getEngineConfigSnapshot();
  }

  public getReplaySummary(windowMinutes = 60) {
    const start = Date.now() - (Math.max(1, windowMinutes) * 60_000);
    const rows = this.replayRows.filter((row) => row.timestamp >= start);
    const executable = rows.filter((row) => row.executable);
    const byStrategy = rows.reduce<Record<StrategyBucket, { total: number; executable: number; avgExpectedNetUsd: number }>>((acc, row) => {
      const current = acc[row.strategy] ?? { total: 0, executable: 0, avgExpectedNetUsd: 0 };
      current.total += 1;
      current.executable += row.executable ? 1 : 0;
      current.avgExpectedNetUsd += row.expectedNetUsd;
      acc[row.strategy] = current;
      return acc;
    }, {
      "stable-arb": { total: 0, executable: 0, avgExpectedNetUsd: 0 },
      "major-arb": { total: 0, executable: 0, avgExpectedNetUsd: 0 },
      "volatile-arb": { total: 0, executable: 0, avgExpectedNetUsd: 0 },
    });
    for (const key of Object.keys(byStrategy) as StrategyBucket[]) {
      const bucket = byStrategy[key];
      bucket.avgExpectedNetUsd = bucket.total > 0 ? Number((bucket.avgExpectedNetUsd / bucket.total).toFixed(4)) : 0;
    }

    return {
      windowMinutes,
      scanned: rows.length,
      executable: executable.length,
      avgExpectedNetUsd: rows.length
        ? Number((rows.reduce((sum, row) => sum + row.expectedNetUsd, 0) / rows.length).toFixed(4))
        : 0,
      byStrategy,
      rows,
    };
  }

  public summarizeHistoricalReplay(rows: ReplayRow[]): ReplayValidationSummary {
    const totalRows = rows.length;
    const executableRows = rows.filter((row) => row.executable).length;
    const acceptedRows = rows.filter((row) => row.executable
      && row.expectedNetUsd >= this.minExpectedNetUsd
      && row.confidenceScore >= this.minConfidenceScore
      && row.mevRiskScore <= this.maxAllowedMevRiskScore
      && row.slippageBps <= this.maxAllowedPredictedSlippageBps).length;
    const rejectedRows = totalRows - acceptedRows;
    const avgExpectedNetUsd = totalRows > 0 ? rows.reduce((sum, row) => sum + row.expectedNetUsd, 0) / totalRows : 0;
    const avgConfidenceScore = totalRows > 0 ? rows.reduce((sum, row) => sum + row.confidenceScore, 0) / totalRows : 0;
    const avgSlippageBps = totalRows > 0 ? rows.reduce((sum, row) => sum + row.slippageBps, 0) / totalRows : 0;
    const avgMevRiskScore = totalRows > 0 ? rows.reduce((sum, row) => sum + row.mevRiskScore, 0) / totalRows : 0;
    const passRate = totalRows > 0 ? (acceptedRows / totalRows) * 100 : 0;
    const readyForDryRun = executableRows > 0 && passRate >= 55 && avgExpectedNetUsd >= this.minExpectedNetUsd;
    const reason = readyForDryRun
      ? "Historical replay shows enough executable, profitable routes to move to dry-run validation."
      : `Historical replay is not yet ready for dry-run validation; only ${passRate.toFixed(1)}% of rows cleared the real-profit gate.`;

    return {
      totalRows,
      executableRows,
      acceptedRows,
      rejectedRows,
      avgExpectedNetUsd: Number(avgExpectedNetUsd.toFixed(4)),
      avgConfidenceScore: Number(avgConfidenceScore.toFixed(2)),
      avgSlippageBps: Number(avgSlippageBps.toFixed(2)),
      avgMevRiskScore: Number(avgMevRiskScore.toFixed(2)),
      passRate: Number(passRate.toFixed(2)),
      readyForDryRun,
      reason,
    };
  }

  public getPnlAttribution() {
    return {
      ...this.attributionTotals,
      spreadGainUsd: Number(this.attributionTotals.spreadGainUsd.toFixed(4)),
      gasCostUsd: Number(this.attributionTotals.gasCostUsd.toFixed(4)),
      slippageCostUsd: Number(this.attributionTotals.slippageCostUsd.toFixed(4)),
      failedTxLossUsd: Number(this.attributionTotals.failedTxLossUsd.toFixed(4)),
      realizedNetUsd: Number(this.attributionTotals.realizedNetUsd.toFixed(4)),
    };
  }

  public async sendAlert(event: string, message: string, payload?: Record<string, unknown>): Promise<{ delivered: boolean; reason: string; alertId: string; severity: AlertSeverity; responseAction: string }> {
    const alertId = `alert-${randomUUID()}`;
    const severity = classifyAlertSeverity(event);
    const responseAction = buildAlertResponseAction(event, false, severity);
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    if (!webhookUrl) {
      appendAlertEvent({
        id: alertId,
        event,
        message,
        timestamp: new Date().toISOString(),
        severity,
        delivered: false,
        reason: "ALERT_WEBHOOK_URL is not configured",
        responseAction,
        acknowledged: false,
        payload,
        status: "failed",
      });
      return { delivered: false, reason: "ALERT_WEBHOOK_URL is not configured", alertId, severity, responseAction };
    }

    const body = {
      event,
      message,
      timestamp: new Date().toISOString(),
      payload: payload ?? {},
    };
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const reason = `Webhook returned ${response.status}`;
      appendAlertEvent({
        id: alertId,
        event,
        message,
        timestamp: new Date().toISOString(),
        severity,
        delivered: false,
        reason,
        responseAction,
        acknowledged: false,
        payload,
        status: "failed",
      });
      return { delivered: false, reason, alertId, severity, responseAction };
    }

    appendAlertEvent({
      id: alertId,
      event,
      message,
      timestamp: new Date().toISOString(),
      severity,
      delivered: true,
      reason: "Delivered",
      responseAction,
      acknowledged: false,
      payload,
      status: "delivered",
    });
    return { delivered: true, reason: "Delivered", alertId, severity, responseAction };
  }

  public getAlertHistory(limit = 20) {
    return getAlertHistoryState().slice(0, Math.max(1, Math.min(100, Math.trunc(limit))));
  }

  public acknowledgeAlert(alertId: string, acknowledgedBy?: string) {
    return acknowledgeAlertEvent(alertId, acknowledgedBy);
  }

  private refreshKillSwitch(): void {
    this.killSwitch.dailyRealizedLossUsd = this.computeRollingLossUsd();
    const shouldEngage = this.killSwitch.consecutiveLosses >= this.killSwitchMaxConsecutiveLosses
      || this.killSwitch.abnormalSlippageEvents >= this.killSwitchMaxSlippageEvents
      || this.killSwitch.rpcInstabilityEvents >= this.killSwitchMaxRpcInstabilityEvents
      || this.killSwitch.dailyRealizedLossUsd >= this.killSwitchMaxDailyLossUsd;
    if (!shouldEngage) {
      return;
    }
    if (!this.killSwitch.engaged) {
      this.killSwitch.engaged = true;
      this.killSwitch.engagedAt = new Date().toISOString();
    }
    if (this.killSwitch.consecutiveLosses >= this.killSwitchMaxConsecutiveLosses) {
      this.killSwitch.reason = "Kill-switch engaged due to consecutive loss streak";
      return;
    }
    if (this.killSwitch.abnormalSlippageEvents >= this.killSwitchMaxSlippageEvents) {
      this.killSwitch.reason = "Kill-switch engaged due to abnormal slippage frequency";
      return;
    }
    if (this.killSwitch.dailyRealizedLossUsd >= this.killSwitchMaxDailyLossUsd) {
      this.killSwitch.reason = "Kill-switch engaged due to daily realized loss cap breach";
      return;
    }
    this.killSwitch.reason = "Kill-switch engaged due to RPC instability";
  }

  private pruneRealizedOutcomeRows(now = Date.now()): void {
    const cutoff = now - this.killSwitchLossWindowMs;
    while (this.realizedOutcomeRows.length > 0 && this.realizedOutcomeRows[0].timestamp < cutoff) {
      this.realizedOutcomeRows.shift();
    }
  }

  private computeRollingLossUsd(now = Date.now()): number {
    this.pruneRealizedOutcomeRows(now);
    const rollingLoss = this.realizedOutcomeRows.reduce((sum, row) => (
      row.realizedNetUsd < 0 ? sum + Math.abs(row.realizedNetUsd) : sum
    ), 0);
    return Number(rollingLoss.toFixed(4));
  }
}
