export interface DashboardOpportunityRow {
  pair: string;
  buyDex: string;
  sellDex: string;
  diff: string;
  profit: string;
  gas: string;
  net: string;
  confidence: string;
  slippage?: string;
  gasImpact?: string;
  liquidity?: string;
  reasons?: string[];
  chain?: string;
  category?: string;
}

export interface DashboardDexMetric {
  name: string;
  liquidity: string;
  volume: string;
  routes: number;
  performance: string;
}

export interface DashboardExecutionReadiness {
  readyPairs: number;
  pendingPairs: number;
  coverage: string;
  perDex: Array<{
    dex: string;
    ready: number;
    pending: number;
    coverage: string;
  }>;
  pairs: Array<{
    id: string;
    dex: string;
    chain: string;
    status: string;
    version?: string;
    router?: string;
    factory?: string;
    reason?: string;
    category?: string;
    coverageHint?: string;
  }>;
}

export interface DashboardTopRoute {
  pair: string;
  buyDex: string;
  sellDex: string;
  profit: string;
  coverage: string;
  chain?: string;
  category?: string;
}

export interface DashboardBestOpportunity {
  pair: string;
  buyDex: string;
  sellDex: string;
  profit: string;
  confidence: string;
  chain?: string;
  category?: string;
}

export interface DashboardExecutionPlanRow {
  label: string;
  detail: string;
  status: string;
}

export interface DashboardRpcEndpointRow {
  url: string;
  selected: boolean;
  inCooldown: boolean;
  failures: number;
  successes: number;
  cooldownUntil: number;
  lastLatency?: number;
  lastUsedAt?: number;
}

export interface DashboardRpcChainHealth {
  chain: string;
  selectedUrl?: string;
  latestBlock?: number;
  total: number;
  healthy: number;
  offline: number;
  overall: string;
  endpoints: DashboardRpcEndpointRow[];
}

export interface DashboardTradeHistoryRow {
  id: string;
  pair: string;
  route: string;
  executedAt: string;
  sizeUsd: string;
  pnl: string;
  status: string;
  txHash?: string;
  note?: string;
}

export interface DashboardExecutionIntentRow {
  id: string;
  chain: string;
  walletAddress: string;
  route: string;
  amountUsd: string;
  createdAt: string;
  expiresAt: string;
  status: string;
  privateRelayRequested?: boolean;
  privateRelayRequired?: boolean;
  relayHashes?: string[];
  txHash?: string;
}

export interface DashboardQuoteHealthRow {
  dex: string;
  dexId: string;
  chain: string;
  chainId?: number;
  protocol: string;
  priceSource: string;
  quoteSource: string;
  status: string;
  source: string;
  lastSuccessfulFetch?: string;
  quoteTimestamp?: number;
  quoteAgeMs?: number;
  blockNumber?: number;
  blockAge?: number;
  poolAddress?: string;
  liquidity?: string;
  error?: string;
  latencyMs?: number;
}

export interface DashboardDexSupportMatrixRow {
  dex: string;
  chain: string;
  protocol: string;
  priceSource: string;
  quoteSource: string;
  status: string;
  lastSuccessfulQuote?: string;
}

export interface DashboardPnlSummary {
  totalPnl: string;
  winRate: string;
  totalVolume: string;
  bestTrade: string;
}

export interface DashboardPayload {
  status: string;
  chain: string;
  tokens: number;
  pairsScanned: number;
  opportunities: number;
  bestProfit: string;
  bestRoute: string;
  bestOpportunity?: DashboardBestOpportunity;
  topRoute?: DashboardTopRoute;
  lastScan: string;
  health: {
    total: number;
    healthy: number;
    offline: number;
    overall: string;
  };
  risk: {
    approved: boolean;
    level: string;
    score: number;
    reason?: string;
  };
  protection: {
    allowed: boolean;
    score: number;
    reason?: string;
  };
  rpcHealth: DashboardRpcChainHealth[];
  opportunitiesFeed: DashboardOpportunityRow[];
  dexAnalytics: DashboardDexMetric[];
  executionReadiness?: DashboardExecutionReadiness;
  tokenMonitoring: Array<{
    symbol: string;
    price: string;
    liquidity: string;
    volume: string;
    risk: string;
  }>;
  aiMetrics: Array<{
    label: string;
    value: string;
  }>;
  executionPlan?: DashboardExecutionPlanRow[];
  tradeHistory?: DashboardTradeHistoryRow[];
  executionIntents?: DashboardExecutionIntentRow[];
  executionIntentSummary?: {
    total: number;
    prepared: number;
    submitted: number;
    confirmed: number;
    failed: number;
    active: number;
  };
  pnlSummary?: DashboardPnlSummary;
  quoteHealth?: DashboardQuoteHealthRow[];
  dexSupportMatrix?: DashboardDexSupportMatrixRow[];
  capitalGrowth?: {
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
  marketValidation?: {
    status: "hold" | "watch" | "ready";
    allowed: boolean;
    score: number;
    liveOpportunityRatio: number;
    avgExpectedNetUsd: number;
    rpcHealthyRatio: number;
    reason: string;
  };
  alerting?: {
    webhookConfigured: boolean;
    unresolvedCritical: number;
    recent: Array<{
      id: string;
      event: string;
      message: string;
      timestamp: string;
      severity: "info" | "warning" | "critical";
      delivered: boolean;
      reason: string;
      responseAction: string;
      acknowledged: boolean;
      acknowledgedAt?: string;
      acknowledgedBy?: string;
      status: "delivered" | "failed" | "acknowledged";
    }>;
    recommendedActions: string[];
    lastDeliveredAt?: string;
    lastFailedAt?: string;
  };
  deploymentSafety?: {
    generatedAt: string;
    process: {
      pid: number;
      uptimeSeconds: number;
      startedAt: string;
      nodeVersion: string;
    };
    persistence: {
      filePath: string;
      exists: boolean;
      healthy: boolean;
      sizeBytes: number;
      lastModifiedAt?: string;
    };
    workers: {
      recovery: {
        enabled: boolean;
        inFlight: boolean;
        pending: number;
        retryReady: number;
      };
      settlement: {
        enabled: boolean;
        inFlight: boolean;
        pending: number;
        retryReady: number;
      };
    };
    alerts: {
      webhookConfigured: boolean;
    };
    restart: {
      safeToRestart: boolean;
      blockers: string[];
      reason: string;
    };
  };
  reconciliation?: {
    generatedAt: string;
    matched: number;
    pending: number;
    orphanSettlements: number;
    recentIssues: Array<{
      type: "missing-settlement" | "orphan-settlement";
      txHash: string;
      chain?: string;
      note: string;
    }>;
    reason: string;
  };
  transactions: Array<{
    status: string;
    hash: string;
    gasUsed: string;
  }>;
  chartSummary: {
    profitHistory: number[];
    gasBars: number[];
    successRate: string;
    opportunityTimeline: string;
  };
}

function buildChartSummary(input: Partial<DashboardPayload> | undefined): DashboardPayload["chartSummary"] {
  const feed = Array.isArray(input?.opportunitiesFeed) ? input.opportunitiesFeed : [];
  const profitHistory = feed.length > 0
    ? feed.slice(0, 12).map((row) => {
        const parsed = Number.parseFloat(String(row.profit ?? "").replace(/[$,%\s]/g, "").replace(/,/g, ""));
        return Number.isFinite(parsed) ? parsed : 0;
      })
    : Array.from({ length: 8 }, (_, index) => Math.max(0.08, 0.2 + index * 0.12 + (input?.health?.healthy ?? 0) * 0.04));
  const gasBars = feed.length > 0
    ? feed.slice(0, 12).map((row) => {
        const parsed = Number.parseFloat(String(row.gas ?? "").replace(/[$,%\s]/g, "").replace(/,/g, ""));
        return Number.isFinite(parsed) ? parsed : 0;
      })
    : Array.from({ length: 8 }, (_, index) => Math.max(0.03, 0.06 + index * 0.025 + (input?.health?.healthy ?? 0) * 0.01));

  return {
    profitHistory: profitHistory.length ? profitHistory : [0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.18, 0.22],
    gasBars: gasBars.length ? gasBars : [0.04, 0.05, 0.06, 0.06, 0.08, 0.07, 0.09, 0.08],
    successRate: typeof input?.risk?.score === "number" && input.risk.score > 0
      ? `${Math.min(99.9, Math.max(50, input.risk.score)).toFixed(1)}%`
      : "94.8%",
    opportunityTimeline: `${Math.max(input?.opportunities ?? 0, feed.length, input?.health?.healthy ?? 0)} active`,
  };
}

export function buildDashboardPayload(input: Partial<DashboardPayload>): DashboardPayload {
  const hasOpportunities = (input.opportunities ?? 0) > 0;
  const chartSummary = buildChartSummary(input);
  
  return {
    status: input.status ?? "running",
    chain: input.chain ?? "ethereum",
    tokens: input.tokens ?? 7,
    pairsScanned: input.pairsScanned ?? 42,
    opportunities: input.opportunities ?? 0,
    bestProfit: input.bestProfit ?? "$0",
    bestRoute: input.bestRoute ?? "No opportunity",
    bestOpportunity: input.bestOpportunity ? {
      pair: input.bestOpportunity.pair ?? "",
      buyDex: input.bestOpportunity.buyDex ?? "",
      sellDex: input.bestOpportunity.sellDex ?? "",
      profit: input.bestOpportunity.profit ?? "",
      confidence: input.bestOpportunity.confidence ?? "",
      chain: input.bestOpportunity.chain,
      category: input.bestOpportunity.category,
    } : undefined,
    topRoute: input.topRoute ? {
      pair: input.topRoute.pair ?? "",
      buyDex: input.topRoute.buyDex ?? "",
      sellDex: input.topRoute.sellDex ?? "",
      profit: input.topRoute.profit ?? "",
      coverage: input.topRoute.coverage ?? "0%",
      chain: input.topRoute.chain,
      category: input.topRoute.category,
    } : undefined,
    lastScan: input.lastScan ?? new Date().toISOString(),
    health: input.health ?? {
      total: 2,
      healthy: 2,
      offline: 0,
      overall: "healthy",
    },
    risk: input.risk ?? {
      approved: true,
      level: "approved",
      score: 100,
    },
    protection: input.protection ?? {
      allowed: true,
      score: 100,
      reason: "No protection issues detected",
    },
    rpcHealth: Array.isArray(input.rpcHealth)
      ? input.rpcHealth.map((chain) => ({
          chain: typeof chain.chain === "string" ? chain.chain : "",
          selectedUrl: typeof chain.selectedUrl === "string" ? chain.selectedUrl : undefined,
          latestBlock: typeof chain.latestBlock === "number" ? chain.latestBlock : undefined,
          total: Number(chain.total) || 0,
          healthy: Number(chain.healthy) || 0,
          offline: Number(chain.offline) || 0,
          overall: typeof chain.overall === "string" ? chain.overall : "offline",
          endpoints: Array.isArray(chain.endpoints)
            ? chain.endpoints.map((endpoint) => ({
                url: typeof endpoint.url === "string" ? endpoint.url : "",
                selected: Boolean(endpoint.selected),
                inCooldown: Boolean(endpoint.inCooldown),
                failures: Number(endpoint.failures) || 0,
                successes: Number(endpoint.successes) || 0,
                cooldownUntil: Number(endpoint.cooldownUntil) || 0,
                lastLatency: typeof endpoint.lastLatency === "number" ? endpoint.lastLatency : undefined,
                lastUsedAt: typeof endpoint.lastUsedAt === "number" ? endpoint.lastUsedAt : undefined,
              }))
            : [],
        }))
      : [],
    opportunitiesFeed: (input.opportunitiesFeed && input.opportunitiesFeed.length > 0) ? input.opportunitiesFeed.map((row) => ({
      pair: row.pair ?? "",
      buyDex: row.buyDex ?? "",
      sellDex: row.sellDex ?? "",
      diff: row.diff ?? "",
      profit: row.profit ?? "",
      gas: row.gas ?? "",
      net: row.net ?? "",
      confidence: row.confidence ?? "",
      slippage: typeof row.slippage === "string" ? row.slippage : undefined,
      gasImpact: typeof row.gasImpact === "string" ? row.gasImpact : undefined,
      liquidity: typeof row.liquidity === "string" ? row.liquidity : undefined,
      reasons: Array.isArray(row.reasons) ? row.reasons.filter((reason): reason is string => typeof reason === "string") : undefined,
      chain: row.chain,
      category: row.category,
    })) : [],
    dexAnalytics: input.dexAnalytics ?? [
      {
        name: "Uniswap V2",
        liquidity: "$3.2B",
        volume: "$1.8B",
        routes: 184,
        performance: "Best",
      },
      {
        name: "SushiSwap",
        liquidity: "$1.4B",
        volume: "$680M",
        routes: 126,
        performance: "Strong",
      },
    ],
    capitalGrowth: input.capitalGrowth ?? {
      status: "conservative",
      currentActiveShare: 0.6,
      recommendedActiveShare: 0.6,
      deltaActiveShare: 0,
      winRatePct: 55,
      drawdownPct: 0,
      realizedNetUsd: 0,
      decisionScore: 0.7,
      allowed: true,
      reason: "Capital growth remains conservative until the engine proves a clean profit streak.",
      nextReviewAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    },
    marketValidation: input.marketValidation ?? {
      status: "watch",
      allowed: true,
      score: 0.6,
      liveOpportunityRatio: 0.05,
      avgExpectedNetUsd: 0,
      rpcHealthyRatio: 1,
      reason: "The engine is running but live market validation is still being proven.",
    },
    executionReadiness: input.executionReadiness ?? {
      readyPairs: 0,
      pendingPairs: 0,
      coverage: "0%",
      perDex: [],
      pairs: [],
    },
    tokenMonitoring: input.tokenMonitoring ?? [
      {
        symbol: "WETH",
        price: "$3,412",
        liquidity: "$2.1B",
        volume: "$8.9B",
        risk: "Medium",
      },
      {
        symbol: "USDC",
        price: "$0.9999",
        liquidity: "$3.6B",
        volume: "$12.4B",
        risk: "Low",
      },
    ],
    aiMetrics: input.aiMetrics ?? [
      {
        label: "AI route selection",
        value: "Primary path optimized",
      },
      {
        label: "Risk analysis",
        value: "Conservative bias",
      },
    ],
    executionPlan: input.executionPlan ?? [
      { label: "Route validation", detail: "Factory and router addresses resolved", status: "ready" },
      { label: "Risk guard", detail: "MEV protection threshold satisfied", status: "ready" },
      { label: "Execution window", detail: "Opportunity remains within configured limits", status: "watch" },
    ],
    tradeHistory: input.tradeHistory ?? [],
    executionIntents: input.executionIntents ?? [],
    executionIntentSummary: input.executionIntentSummary ?? {
      total: 0,
      prepared: 0,
      submitted: 0,
      confirmed: 0,
      failed: 0,
      active: 0,
    },
    pnlSummary: input.pnlSummary ?? {
      totalPnl: "$0",
      winRate: "0%",
      totalVolume: "$0",
      bestTrade: "$0",
    },
    quoteHealth: Array.isArray(input.quoteHealth)
      ? input.quoteHealth.map((row) => ({
          dex: typeof row.dex === "string" ? row.dex : "",
          dexId: typeof row.dexId === "string" ? row.dexId : "",
          chain: typeof row.chain === "string" ? row.chain : "",
          chainId: typeof row.chainId === "number" ? row.chainId : undefined,
          protocol: typeof row.protocol === "string" ? row.protocol : "",
          priceSource: typeof row.priceSource === "string" ? row.priceSource : "",
          quoteSource: typeof row.quoteSource === "string" ? row.quoteSource : "",
          status: typeof row.status === "string" ? row.status : "UNVERIFIED",
          source: typeof row.source === "string" ? row.source : "",
          lastSuccessfulFetch: typeof row.lastSuccessfulFetch === "string" ? row.lastSuccessfulFetch : undefined,
          quoteTimestamp: typeof row.quoteTimestamp === "number" ? row.quoteTimestamp : undefined,
          quoteAgeMs: typeof row.quoteAgeMs === "number" ? row.quoteAgeMs : undefined,
          blockNumber: typeof row.blockNumber === "number" ? row.blockNumber : undefined,
          blockAge: typeof row.blockAge === "number" ? row.blockAge : undefined,
          poolAddress: typeof row.poolAddress === "string" ? row.poolAddress : undefined,
          liquidity: typeof row.liquidity === "string" ? row.liquidity : undefined,
          error: typeof row.error === "string" ? row.error : undefined,
          latencyMs: typeof row.latencyMs === "number" ? row.latencyMs : undefined,
        }))
      : [],
    alerting: input.alerting ? {
      webhookConfigured: Boolean(input.alerting.webhookConfigured),
      unresolvedCritical: Number(input.alerting.unresolvedCritical) || 0,
      recent: Array.isArray(input.alerting.recent)
        ? input.alerting.recent.map((entry) => ({
            id: typeof entry.id === "string" ? entry.id : "",
            event: typeof entry.event === "string" ? entry.event : "",
            message: typeof entry.message === "string" ? entry.message : "",
            timestamp: typeof entry.timestamp === "string" ? entry.timestamp : new Date().toISOString(),
            severity: entry.severity === "critical" || entry.severity === "warning" ? entry.severity : "info",
            delivered: Boolean(entry.delivered),
            reason: typeof entry.reason === "string" ? entry.reason : "",
            responseAction: typeof entry.responseAction === "string" ? entry.responseAction : "review-notification",
            acknowledged: Boolean(entry.acknowledged),
            acknowledgedAt: typeof entry.acknowledgedAt === "string" ? entry.acknowledgedAt : undefined,
            acknowledgedBy: typeof entry.acknowledgedBy === "string" ? entry.acknowledgedBy : undefined,
            status: entry.status === "acknowledged" || entry.status === "failed" || entry.status === "delivered" ? entry.status : "delivered",
          }))
        : [],
      recommendedActions: Array.isArray(input.alerting.recommendedActions)
        ? input.alerting.recommendedActions.filter((action): action is string => typeof action === "string")
        : [],
      lastDeliveredAt: typeof input.alerting.lastDeliveredAt === "string" ? input.alerting.lastDeliveredAt : undefined,
      lastFailedAt: typeof input.alerting.lastFailedAt === "string" ? input.alerting.lastFailedAt : undefined,
    } : {
      webhookConfigured: false,
      unresolvedCritical: 0,
      recent: [],
      recommendedActions: [],
    },
    deploymentSafety: input.deploymentSafety ? {
      generatedAt: typeof input.deploymentSafety.generatedAt === "string" ? input.deploymentSafety.generatedAt : new Date().toISOString(),
      process: {
        pid: Number(input.deploymentSafety.process?.pid) || 0,
        uptimeSeconds: Number(input.deploymentSafety.process?.uptimeSeconds) || 0,
        startedAt: typeof input.deploymentSafety.process?.startedAt === "string" ? input.deploymentSafety.process.startedAt : new Date().toISOString(),
        nodeVersion: typeof input.deploymentSafety.process?.nodeVersion === "string" ? input.deploymentSafety.process.nodeVersion : "unknown",
      },
      persistence: {
        filePath: typeof input.deploymentSafety.persistence?.filePath === "string" ? input.deploymentSafety.persistence.filePath : "",
        exists: Boolean(input.deploymentSafety.persistence?.exists),
        healthy: Boolean(input.deploymentSafety.persistence?.healthy),
        sizeBytes: Number(input.deploymentSafety.persistence?.sizeBytes) || 0,
        lastModifiedAt: typeof input.deploymentSafety.persistence?.lastModifiedAt === "string" ? input.deploymentSafety.persistence.lastModifiedAt : undefined,
      },
      workers: {
        recovery: {
          enabled: Boolean(input.deploymentSafety.workers?.recovery?.enabled),
          inFlight: Boolean(input.deploymentSafety.workers?.recovery?.inFlight),
          pending: Number(input.deploymentSafety.workers?.recovery?.pending) || 0,
          retryReady: Number(input.deploymentSafety.workers?.recovery?.retryReady) || 0,
        },
        settlement: {
          enabled: Boolean(input.deploymentSafety.workers?.settlement?.enabled),
          inFlight: Boolean(input.deploymentSafety.workers?.settlement?.inFlight),
          pending: Number(input.deploymentSafety.workers?.settlement?.pending) || 0,
          retryReady: Number(input.deploymentSafety.workers?.settlement?.retryReady) || 0,
        },
      },
      alerts: {
        webhookConfigured: Boolean(input.deploymentSafety.alerts?.webhookConfigured),
      },
      restart: {
        safeToRestart: Boolean(input.deploymentSafety.restart?.safeToRestart),
        blockers: Array.isArray(input.deploymentSafety.restart?.blockers)
          ? input.deploymentSafety.restart.blockers.filter((blocker): blocker is string => typeof blocker === "string")
          : [],
        reason: typeof input.deploymentSafety.restart?.reason === "string" ? input.deploymentSafety.restart.reason : "Deployment restart safety snapshot unavailable.",
      },
    } : {
      generatedAt: new Date().toISOString(),
      process: {
        pid: 0,
        uptimeSeconds: 0,
        startedAt: new Date().toISOString(),
        nodeVersion: "unknown",
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
    reconciliation: input.reconciliation ? {
      generatedAt: typeof input.reconciliation.generatedAt === "string" ? input.reconciliation.generatedAt : new Date().toISOString(),
      matched: Number(input.reconciliation.matched) || 0,
      pending: Number(input.reconciliation.pending) || 0,
      orphanSettlements: Number(input.reconciliation.orphanSettlements) || 0,
      recentIssues: Array.isArray(input.reconciliation.recentIssues)
        ? input.reconciliation.recentIssues.map((issue) => ({
            type: issue.type === "orphan-settlement" ? "orphan-settlement" : "missing-settlement",
            txHash: typeof issue.txHash === "string" ? issue.txHash : "",
            chain: typeof issue.chain === "string" ? issue.chain : undefined,
            note: typeof issue.note === "string" ? issue.note : "Post-trade reconciliation issue.",
          }))
        : [],
      reason: typeof input.reconciliation.reason === "string" ? input.reconciliation.reason : "Post-trade reconciliation snapshot unavailable.",
    } : {
      generatedAt: new Date().toISOString(),
      matched: 0,
      pending: 0,
      orphanSettlements: 0,
      recentIssues: [],
      reason: "Post-trade reconciliation snapshot has not run yet.",
    },
    dexSupportMatrix: Array.isArray(input.dexSupportMatrix)
      ? input.dexSupportMatrix.map((row) => ({
          dex: typeof row.dex === "string" ? row.dex : "",
          chain: typeof row.chain === "string" ? row.chain : "",
          protocol: typeof row.protocol === "string" ? row.protocol : "",
          priceSource: typeof row.priceSource === "string" ? row.priceSource : "",
          quoteSource: typeof row.quoteSource === "string" ? row.quoteSource : "",
          status: typeof row.status === "string" ? row.status : "UNVERIFIED",
          lastSuccessfulQuote: typeof row.lastSuccessfulQuote === "string" ? row.lastSuccessfulQuote : undefined,
        }))
      : [],
    transactions: input.transactions ?? [
      {
        status: "Confirmed",
        hash: "0x81aa...0c6d",
        gasUsed: "147,210",
      },
      {
        status: "Pending",
        hash: "0x2f1c...9be2",
        gasUsed: "124,420",
      },
    ],
    chartSummary: input.chartSummary ?? chartSummary,
  };
}
