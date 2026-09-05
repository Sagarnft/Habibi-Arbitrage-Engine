import { NextResponse } from "next/server";
import { resolveUpstreamBaseUrl } from "./upstream";

const EMPTY_DASHBOARD_STATE = {
  status: "idle",
  chain: "arbitrum",
  tokens: 0,
  pairsScanned: 0,
  opportunities: 0,
  bestProfit: "$0",
  bestRoute: "No opportunity",
  lastScan: new Date().toISOString(),
  health: {
    total: 0,
    healthy: 0,
    offline: 0,
    overall: "offline",
  },
  risk: { approved: false, level: "unverified", score: 0, reason: "No live opportunity detected" },
  protection: { allowed: false, score: 0, reason: "No live opportunity detected" },
  rpcHealth: [],
  opportunitiesFeed: [],
  dexAnalytics: [],
  executionReadiness: {
    readyPairs: 0,
    pendingPairs: 0,
    coverage: "0%",
    perDex: [],
    pairs: [],
  },
  tokenMonitoring: [],
  aiMetrics: [],
  transactions: [],
  signerPolicy: {
    mode: "wallet-external",
    ready: true,
    production: false,
    usingServerKey: false,
    kmsConfigured: false,
    reason: "External wallet signer mode is active.",
  },
  capitalPolicy: {
    activeAllocationShare: 0.6,
    reserveAllocationShare: 0.25,
    emergencyAllocationShare: 0.15,
    emergencyReserveFloorUsd: 150,
    maxTradeShareOfActiveCapital: 0.35,
    minGasReserveNative: {},
  },
  capitalGrowth: {
    status: "conservative",
    currentActiveShare: 0.6,
    recommendedActiveShare: 0.6,
    deltaActiveShare: 0,
    winRatePct: 55,
    drawdownPct: 0,
    realizedNetUsd: 0,
    decisionScore: 0.7,
    allowed: true,
    reason: "Capital growth is conservative until a clean performance streak is sustained.",
    nextReviewAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  },
  marketValidation: {
    status: "watch",
    allowed: true,
    score: 0.6,
    liveOpportunityRatio: 0.05,
    avgExpectedNetUsd: 0,
    rpcHealthyRatio: 1,
    reason: "The engine is running but live market validation is still being proven.",
  },
  canaryValidation: {
    chain: "arbitrum",
    windowHours: 24,
    minSettledTrades: 3,
    minRealizedNetUsd: 1,
    maxAverageSlippageBps: 35,
    maxLossTrades: 1,
    settledTrades: 0,
    lossTrades: 0,
    cumulativeRealizedNetUsd: 0,
    averageSlippageBps: 0,
    goForScale: false,
    reason: "No canary validation data yet.",
  },
  relayRpcDrill: {
    generatedAt: new Date().toISOString(),
    relay: { requiredChains: [], configuredChains: [], missingChains: [], pass: false },
    rpc: { totalChains: 0, degradedOrOfflineChains: [], lowRedundancyChains: [], pass: false },
    failClosed: { apiKeyConfigured: false, unsafeBypassEnabled: false, signerReady: true, pass: false },
    alerts: { webhookConfigured: false, pass: false },
    workers: { recoveryEnabled: false, settlementEnabled: false, pass: false },
    overallPass: false,
    reason: "Relay/RPC drill has not run yet.",
  },
  liveCostTuning: {
    windowTrades: 0,
    avgGasCostUsd: 0,
    avgSlippageBps: 0,
    avgRealizedNetUsd: 0,
    gasCostBufferUsd: 0,
    slippageMultiplier: 1,
    sizingPenaltyMultiplier: 1,
    reason: "No settled trades yet; live cost tuning is neutral.",
  },
  readinessGate: {
    generatedAt: new Date().toISOString(),
    enforced: { canaryPassRequired: false, relayRpcDrillPassRequired: false },
    checks: { killSwitchClear: true, signerReady: true, canaryPass: false, relayRpcDrillPass: false },
    pass: true,
    reason: "Execution readiness gate is advisory-only (enforcement disabled).",
  },
  readinessGateHistory: [],
  operatorSafety: {
    generatedAt: new Date().toISOString(),
    persistence: {
      filePath: "",
      exists: false,
      healthy: false,
      sizeBytes: 0,
      lastModifiedAt: undefined,
    },
    alerting: {
      webhookConfigured: false,
      pass: false,
    },
    risk: {
      killSwitchEngaged: false,
      readinessGatePass: true,
      canaryPass: false,
      relayRpcDrillPass: false,
      pass: false,
    },
    overallPass: false,
    reason: "Operator safety snapshot has not run yet.",
  },
  alerting: {
    webhookConfigured: false,
    unresolvedCritical: 0,
    recent: [],
    recommendedActions: [],
  },
  deploymentSafety: {
    generatedAt: new Date().toISOString(),
    process: {
      pid: 0,
      uptimeSeconds: 0,
      startedAt: new Date().toISOString(),
      nodeVersion: process.version,
    },
    persistence: {
      filePath: "",
      exists: false,
      healthy: false,
      sizeBytes: 0,
      lastModifiedAt: undefined,
    },
    workers: {
      recovery: {
        enabled: false,
        inFlight: false,
        pending: 0,
        retryReady: 0,
      },
      settlement: {
        enabled: false,
        inFlight: false,
        pending: 0,
        retryReady: 0,
      },
    },
    alerts: {
      webhookConfigured: false,
    },
    restart: {
      safeToRestart: false,
      blockers: [],
      reason: "Deployment restart safety snapshot has not run yet.",
    },
  },
  reconciliation: {
    generatedAt: new Date().toISOString(),
    matched: 0,
    pending: 0,
    orphanSettlements: 0,
    recentIssues: [],
    reason: "Post-trade reconciliation snapshot has not run yet.",
  },
  recoveryWorker: {
    enabled: false,
    inFlight: false,
    intervalMs: 0,
    maxAttempts: 0,
    baseBackoffMs: 0,
    maxBackoffMs: 0,
    defaultSlippageBps: 0,
    pending: 0,
    retryReady: 0,
  },
  settlementWorker: {
    enabled: false,
    inFlight: false,
    intervalMs: 0,
    maxAttempts: 0,
    baseBackoffMs: 0,
    maxBackoffMs: 0,
    minProfitBps: 0,
    pending: 0,
    retryReady: 0,
  },
  settlementQueue: {
    pending: 0,
    settled: 0,
    failed: 0,
    items: [],
  },
  settlements: {
    count: 0,
    latest: undefined,
  },
  rollout: {
    summary: {
      blocked: 0,
      canary: 0,
      scale: 0,
    },
    governance: {
      autopilotEnabled: true,
      promotionStreakRequired: 3,
      promotionCooldownMs: 600000,
      demotionCooldownMs: 180000,
    },
    chains: [],
  },
  chartSummary: {
    profitHistory: [0, 0, 0, 0, 0, 0, 0, 0],
    gasBars: [0, 0, 0, 0, 0, 0, 0, 0],
    successRate: "0%",
    opportunityTimeline: "0 active",
  },
};

const parseMetric = (value: unknown) => {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeDashboardPayload = (payload: Record<string, unknown>) => {
  const feed = Array.isArray(payload.opportunitiesFeed) ? payload.opportunitiesFeed : [];
  const sanitizedFeed = feed.filter((row) => {
    if (!row || typeof row !== "object") {
      return false;
    }

    const candidate = row as Record<string, unknown>;
    const pair = String(candidate.pair ?? "").trim();
    const buyDex = String(candidate.buyDex ?? "").trim();
    const sellDex = String(candidate.sellDex ?? "").trim();
    const profit = parseMetric(candidate.profit);
    const net = parseMetric(candidate.net);
    const confidence = parseMetric(candidate.confidence);

    return Boolean(pair && buyDex && sellDex && profit > 0 && net > 0 && confidence > 0);
  });

  const first = sanitizedFeed[0] as Record<string, unknown> | undefined;
  return {
    ...payload,
    opportunitiesFeed: sanitizedFeed,
    opportunities: sanitizedFeed.length,
    bestRoute: sanitizedFeed.length > 0 ? String(payload.bestRoute ?? first?.pair ?? "No opportunity") : "No opportunity",
    bestProfit: sanitizedFeed.length > 0 ? String(payload.bestProfit ?? first?.profit ?? "$0") : "$0",
  };
};

const mergeOperationalPayload = (
  payload: Record<string, unknown>,
  opsMetricsPayload: unknown,
  settlementQueuePayload: unknown,
  rolloutPayload: unknown,
) => {
  const nextPayload: Record<string, unknown> = { ...payload };
  if (opsMetricsPayload && typeof opsMetricsPayload === "object") {
    const ops = opsMetricsPayload as Record<string, unknown>;
    nextPayload.recoveryWorker = ops.recoveryWorker ?? nextPayload.recoveryWorker;
    nextPayload.settlementWorker = ops.settlementWorker ?? nextPayload.settlementWorker;
    nextPayload.settlements = ops.settlements ?? nextPayload.settlements;
    nextPayload.signerPolicy = ops.signerPolicy ?? nextPayload.signerPolicy;
    nextPayload.capitalPolicy = ops.capitalPolicy ?? nextPayload.capitalPolicy;
    nextPayload.capitalGrowth = ops.capitalGrowth ?? nextPayload.capitalGrowth;
    nextPayload.marketValidation = ops.marketValidation ?? nextPayload.marketValidation;
    nextPayload.canaryValidation = ops.canaryValidation ?? nextPayload.canaryValidation;
    nextPayload.relayRpcDrill = ops.relayRpcDrill ?? nextPayload.relayRpcDrill;
    nextPayload.liveCostTuning = ops.liveCostTuning ?? nextPayload.liveCostTuning;
    nextPayload.readinessGate = ops.readinessGate ?? nextPayload.readinessGate;
    nextPayload.readinessGateHistory = ops.readinessGateHistory ?? nextPayload.readinessGateHistory;
    nextPayload.operatorSafety = ops.operatorSafety ?? nextPayload.operatorSafety;
    nextPayload.deploymentSafety = ops.deploymentSafety ?? nextPayload.deploymentSafety;
    nextPayload.reconciliation = ops.reconciliation ?? nextPayload.reconciliation;
    nextPayload.alerting = ops.alerting ?? nextPayload.alerting;
    nextPayload.recovery = ops.recovery ?? nextPayload.recovery;
    nextPayload.persistence = ops.persistence ?? nextPayload.persistence;
    nextPayload.opsMetricsGeneratedAt = ops.generatedAt ?? nextPayload.opsMetricsGeneratedAt;
  }

  if (settlementQueuePayload && typeof settlementQueuePayload === "object") {
    nextPayload.settlementQueue = settlementQueuePayload;
  }

  if (rolloutPayload && typeof rolloutPayload === "object") {
    nextPayload.rollout = rolloutPayload;
  }

  return nextPayload;
};

const fetchJsonFromUpstream = async (
  upstreamBaseUrl: string,
  path: string,
  signal: AbortSignal,
) => {
  try {
    const response = await fetch(`${upstreamBaseUrl}${path}`, {
      cache: "no-store",
      signal,
    });
    if (!response.ok) {
      return undefined;
    }
    return response.json();
  } catch {
    return undefined;
  }
};

export const dynamic = "force-dynamic";

export async function GET() {
  const upstreamBaseUrl = resolveUpstreamBaseUrl();
  const controller = new AbortController();
  const timeoutMs = Number(process.env.DASHBOARD_UPSTREAM_TIMEOUT_MS ?? 15000);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${upstreamBaseUrl}/dashboard`, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json(EMPTY_DASHBOARD_STATE, { status: 200 });
    }

    const [payload, opsMetricsPayload, settlementQueuePayload, rolloutPayload] = await Promise.all([
      response.json(),
      fetchJsonFromUpstream(upstreamBaseUrl, "/ops/metrics", controller.signal),
      fetchJsonFromUpstream(upstreamBaseUrl, "/execute/settlement-queue", controller.signal),
      fetchJsonFromUpstream(upstreamBaseUrl, "/rollout/status", controller.signal),
    ]);
    const normalizedPayload = payload && typeof payload === "object"
      ? {
        ...EMPTY_DASHBOARD_STATE,
        ...sanitizeDashboardPayload(
          mergeOperationalPayload(
            payload as Record<string, unknown>,
            opsMetricsPayload,
            settlementQueuePayload,
            rolloutPayload,
          ),
        ),
      }
      : EMPTY_DASHBOARD_STATE;
    return NextResponse.json(normalizedPayload, { status: 200 });
  } catch {
    return NextResponse.json(EMPTY_DASHBOARD_STATE, { status: 200 });
  } finally {
    clearTimeout(timeoutId);
  }
}
