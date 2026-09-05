import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { encodeFunctionData, getAddress, isAddress } from "viem";
import { healthMonitor } from "../providers/healthMonitor.js";
import { RiskManager } from "../risk/manager.js";
import { MevProtectionGuard } from "../monitoring/mevProtection.js";
import { buildDashboardPayload } from "./dashboardSnapshot.js";
import { adapterRegistry } from "../dex/adapters/index.js";
import { dexRegistry } from "../dex/registry.js";
import { getQuoteDiagnostics, getQuotes } from "../aggregator/index.js";
import { getAllActiveDexes, normalizeDexKey } from "../dex/activeDexes.js";
import { ensurePairExecutionReady, getExecutablePairs } from "../execution/pairCatalog.js";
import { buildExecutionPlan } from "../execution/planBuilder.js";
import { flashloanProvider } from "../flashloan/index.js";
import { getFlashloanReceiverAddress } from "../flashloan/aave.js";
import { scan } from "../dex/scanner/scanner.js";
import type { ScanPairCandidate, ScanRequest, ScanResult } from "../dex/scanner/types.js";
import { CHAIN_LIST, type ChainName } from "../chains.js";
import { rpcManager } from "../providers/rpcManager.js";
import { initializeTokenRegistry } from "../tokens/init.js";
import { tokenRegistry } from "../tokens/registry.js";
import { getClient } from "../clients.js";
import { ProfitabilityController } from "../strategy/profitability.js";
import { getEngineConfigSnapshot, isWalletApprovedForExecution } from "../config/engineConfig.js";
import { evaluateSignerPolicy } from "../config/signerPolicy.js";
import {
  appendSettlementRecord,
  getExecutionStoreMeta,
  getRolloutGovernanceState,
  getSettlementRecords,
  readExecutionState,
  writeReadinessGateHistory,
  writeRolloutGovernanceState,
  writeSettlementQueue,
  writeRecoveryState,
} from "./executionStore.js";
import type {
  DashboardBestOpportunity,
  DashboardOpportunityRow,
  DashboardPayload,
  DashboardTopRoute,
} from "./dashboardSnapshot.js";

const app = express();

// CORS configuration - allow localhost and ngrok domains
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow localhost for development
      if (!origin || origin.includes("localhost") || origin.includes("127.0.0.1")) {
        return callback(null, true);
      }
      // Allow ngrok domains
      if (origin && (origin.includes("ngrok") || origin.includes("ngrok-free.dev"))) {
        return callback(null, true);
      }
      // Allow any origin in development
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);


app.use(express.json());

initializeTokenRegistry();

async function primeLiveDexActivity(): Promise<void> {
  const probePairs: Array<{
    chain: ChainName;
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
    amountIn: bigint;
  }> = [
    {
      chain: "ethereum",
      tokenIn: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      tokenOut: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eB48",
      amountIn: 100000000000000000n,
    },
    {
      chain: "arbitrum",
      tokenIn: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      tokenOut: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      amountIn: 100000000000000000n,
    },
  ];

  for (const probe of probePairs) {
    try {
      await getQuotes(probe.chain, probe.tokenIn, probe.tokenOut, probe.amountIn);
    } catch (error) {
      console.warn("Live DEX probe failed", {
        chain: probe.chain,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

void primeLiveDexActivity();



const riskManager = new RiskManager({
  minProfit: BigInt(process.env.MIN_PROFIT ?? "50"),
  maxSlippageBps: Number(process.env.MAX_SLIPPAGE_BPS ?? "250"),
  maxGasImpactBps: Number(process.env.MAX_GAS_IMPACT_BPS ?? "200"),
  minGrossProfit: BigInt(process.env.MIN_GROSS_PROFIT ?? "5"),
});
const mevGuard = new MevProtectionGuard();
const profitability = new ProfitabilityController();
const SCAN_INTERVAL_MS = 1_500;
const SCAN_BATCH_SIZE = 40;
const SCAN_HARD_TIMEOUT_MS = 240_000;

type CapitalPolicySnapshot = {
  activeAllocationShare: number;
  reserveAllocationShare: number;
  emergencyAllocationShare: number;
  emergencyReserveFloorUsd: number;
  maxTradeShareOfActiveCapital: number;
  minGasReserveNative: Record<string, number>;
};

type CapitalGuardResult = {
  allowed: boolean;
  reason?: string;
  chainGasReserveNative: number;
  maxTradeUsd?: number;
  availableForTradingUsd?: number;
  emergencyReserveUsd?: number;
  remainingAfterTradeUsd?: number;
  policy: CapitalPolicySnapshot;
};

const DEFAULT_MIN_GAS_RESERVE_NATIVE: Record<string, number> = {
  ethereum: 0.01,
  arbitrum: 0.007,
  base: 0.007,
  optimism: 0.007,
  bnb: 0.02,
  polygon: 8,
  avalanche: 0.05,
  linea: 0.006,
  scroll: 0.006,
  zksync: 0.006,
  mode: 0.006,
};

function parsePolicyNumber(
  rawValue: string | undefined,
  fallback: number,
  min: number,
  max?: number,
) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const bounded = Math.max(min, parsed);
  if (max !== undefined) {
    return Math.min(max, bounded);
  }
  return bounded;
}

function buildCapitalPolicySnapshot(): CapitalPolicySnapshot {
  const activeRaw = parsePolicyNumber(process.env.CAPITAL_ACTIVE_ALLOCATION_PCT, 60, 1, 98);
  const reserveRaw = parsePolicyNumber(process.env.CAPITAL_RESERVE_ALLOCATION_PCT, 25, 0, 98);
  const emergencyRaw = parsePolicyNumber(process.env.CAPITAL_EMERGENCY_ALLOCATION_PCT, 15, 1, 98);
  const total = activeRaw + reserveRaw + emergencyRaw;
  const safeTotal = total > 0 ? total : 100;
  const emergencyReserveFloorUsd = parsePolicyNumber(process.env.CAPITAL_EMERGENCY_FLOOR_USD, 150, 10);
  const maxTradeShareOfActiveCapital = parsePolicyNumber(process.env.CAPITAL_MAX_TRADE_OF_ACTIVE_PCT, 35, 1, 100) / 100;

  const minGasReserveNative = Object.fromEntries(
    Object.entries(DEFAULT_MIN_GAS_RESERVE_NATIVE).map(([chain, fallback]) => [
      chain,
      parsePolicyNumber(process.env[`CAPITAL_MIN_GAS_RESERVE_${chain.toUpperCase()}`], fallback, 0),
    ]),
  );

  return {
    activeAllocationShare: activeRaw / safeTotal,
    reserveAllocationShare: reserveRaw / safeTotal,
    emergencyAllocationShare: emergencyRaw / safeTotal,
    emergencyReserveFloorUsd,
    maxTradeShareOfActiveCapital,
    minGasReserveNative,
  };
}

function evaluateCapitalPolicyGuard(request: {
  chain: ChainName;
  requestedNotionalUsd: number;
  walletUsdtBalance: number;
}): CapitalGuardResult {
  const policy = buildCapitalPolicySnapshot();
  const requestedNotionalUsd = Math.max(0, request.requestedNotionalUsd);
  const chainGasReserveNative = policy.minGasReserveNative[request.chain] ?? 0;
  if (!Number.isFinite(request.walletUsdtBalance) || request.walletUsdtBalance <= 0) {
    return {
      allowed: true,
      reason: "Wallet balance telemetry unavailable; capital split guard not enforced for this request.",
      chainGasReserveNative,
      policy,
    };
  }

  const walletUsdtBalance = request.walletUsdtBalance;
  const activeAllocationUsd = walletUsdtBalance * policy.activeAllocationShare;
  const reserveAllocationUsd = walletUsdtBalance * policy.reserveAllocationShare;
  const emergencyReserveUsd = Math.max(
    policy.emergencyReserveFloorUsd,
    walletUsdtBalance * policy.emergencyAllocationShare,
  );
  const availableForTradingUsd = Math.max(0, walletUsdtBalance - reserveAllocationUsd - emergencyReserveUsd);
  const maxTradeByActiveSliceUsd = activeAllocationUsd * policy.maxTradeShareOfActiveCapital;
  const maxTradeUsd = Math.max(0, Math.min(availableForTradingUsd, maxTradeByActiveSliceUsd));
  const remainingAfterTradeUsd = walletUsdtBalance - requestedNotionalUsd;

  if (requestedNotionalUsd > maxTradeUsd) {
    return {
      allowed: false,
      reason: `Execution blocked by capital policy: requested ${requestedNotionalUsd.toFixed(2)} USD exceeds max allowed trade ${maxTradeUsd.toFixed(2)} USD.`,
      chainGasReserveNative,
      maxTradeUsd,
      availableForTradingUsd,
      emergencyReserveUsd,
      remainingAfterTradeUsd,
      policy,
    };
  }

  if (remainingAfterTradeUsd < emergencyReserveUsd) {
    return {
      allowed: false,
      reason: `Execution blocked by emergency reserve rule: post-trade balance ${remainingAfterTradeUsd.toFixed(2)} USD falls below reserve ${emergencyReserveUsd.toFixed(2)} USD.`,
      chainGasReserveNative,
      maxTradeUsd,
      availableForTradingUsd,
      emergencyReserveUsd,
      remainingAfterTradeUsd,
      policy,
    };
  }

  return {
    allowed: true,
    chainGasReserveNative,
    maxTradeUsd,
    availableForTradingUsd,
    emergencyReserveUsd,
    remainingAfterTradeUsd,
    policy,
  };
}

function normalizeDexLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function serializeForJson(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForJson(item));
  }

  if (value && typeof value === "object") {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [key, serializeForJson(nestedValue)]),
    );
  }

  return value;
}

export function buildDashboardScanCandidates(): ScanPairCandidate[] {
  const candidates: ScanPairCandidate[] = [];
  const seen = new Set<string>();
  const routesByChain = [
    getExecutablePairs("ethereum")
      .filter((pair) => pair.category === "major" || pair.category === "experimental")
      .slice(0, 20),
    getExecutablePairs("arbitrum")
      .filter((pair) => pair.category === "major" || pair.category === "experimental")
      .filter((pair) => !pair.id.includes("-pair-") && !pair.id.includes("-extra-"))
      .slice(0, 10),
    getExecutablePairs("polygon")
      .filter((pair) => pair.category === "major" || pair.category === "experimental")
      .filter((pair) => !pair.id.includes("-pair-") && !pair.id.includes("-extra-"))
      .slice(0, 10),
    getExecutablePairs("bnb")
      .filter((pair) => pair.category === "major" || pair.category === "experimental")
      .filter((pair) => !pair.id.includes("-pair-") && !pair.id.includes("-extra-"))
      .slice(0, 10),
    getExecutablePairs("base")
      .filter((pair) => pair.category === "major" || pair.category === "experimental")
      .filter((pair) => !pair.id.includes("-pair-") && !pair.id.includes("-extra-"))
      .slice(0, 8),
    getExecutablePairs("linea")
      .filter((pair) => pair.category === "major" || pair.category === "experimental")
      .filter((pair) => !pair.id.includes("-pair-") && !pair.id.includes("-extra-"))
      .slice(0, 8),
    getExecutablePairs("scroll")
      .filter((pair) => pair.category === "major" || pair.category === "experimental")
      .filter((pair) => !pair.id.includes("-pair-") && !pair.id.includes("-extra-"))
      .slice(0, 8),
    getExecutablePairs("zksync")
      .filter((pair) => pair.category === "major" || pair.category === "experimental")
      .filter((pair) => !pair.id.includes("-pair-") && !pair.id.includes("-extra-"))
      .slice(0, 8),
    getExecutablePairs("optimism")
      .filter((pair) => pair.category === "major" || pair.category === "experimental")
      .filter((pair) => !pair.id.includes("-pair-") && !pair.id.includes("-extra-"))
      .slice(0, 8),
    getExecutablePairs("avalanche")
      .filter((pair) => pair.category === "major" || pair.category === "experimental")
      .filter((pair) => !pair.id.includes("-pair-") && !pair.id.includes("-extra-"))
      .slice(0, 8),
  ];

  const maxRows = Math.max(...routesByChain.map((routes) => routes.length));
  for (let row = 0; row < maxRows; row += 1) {
    for (const routes of routesByChain) {
      const pair = routes[row];
      if (!pair) {
        continue;
      }

      const keyForward = `${pair.chain}:${pair.tokenIn}:${pair.tokenOut}`;
      const keyReverse = `${pair.chain}:${pair.tokenOut}:${pair.tokenIn}`;
      if (!seen.has(keyForward)) {
        seen.add(keyForward);
        candidates.push({
          chain: pair.chain as ChainName,
          tokenIn: pair.tokenIn,
          tokenOut: pair.tokenOut,
        });
      }

      if (!seen.has(keyReverse)) {
        seen.add(keyReverse);
        candidates.push({
          chain: pair.chain as ChainName,
          tokenIn: pair.tokenOut,
          tokenOut: pair.tokenIn,
        });
      }
    }
  }

  return candidates.slice(0, 80);
}

async function getLiveScanResult(): Promise<ScanResult | undefined> {
  if (latestScanResult) {
    return latestScanResult;
  }

  return runBackgroundScan();
}

let latestScanResult: ScanResult | undefined;
let scanInFlight = false;
let scanCursor = 0;
let scanStartedAt = 0;

async function runBackgroundScan(): Promise<ScanResult | undefined> {
  if (scanInFlight) {
    if (Date.now() - scanStartedAt > SCAN_HARD_TIMEOUT_MS) {
      console.warn("Live scan timeout watchdog triggered; resetting in-flight state.");
      scanInFlight = false;
    } else {
      return latestScanResult;
    }
  }

  if (scanInFlight) {
    return latestScanResult;
  }

  scanInFlight = true;
  scanStartedAt = Date.now();
  try {
    const candidates = buildDashboardScanCandidates();
    if (!candidates.length) {
      latestScanResult = {
        opportunities: [],
        scannedPairs: 0,
        failedPairs: 0,
      };
      return latestScanResult;
    }

    const start = scanCursor % candidates.length;
    const batchSize = Math.min(SCAN_BATCH_SIZE, candidates.length);
    const head = candidates.slice(start, start + batchSize);
    const remaining = batchSize - head.length;
    const tail = remaining > 0 ? candidates.slice(0, remaining) : [];
    const scanBatch = [...head, ...tail];
    scanCursor = (start + scanBatch.length) % candidates.length;

    const request: ScanRequest = {
      chain: scanBatch[0]?.chain ?? "bnb",
      amountIn: 0n,
      tokens: [],
    };
    latestScanResult = await Promise.race([
      scan(request, scanBatch),
      new Promise<ScanResult>((_, reject) => {
        setTimeout(() => reject(new Error(`scan timed out after ${SCAN_HARD_TIMEOUT_MS}ms`)), SCAN_HARD_TIMEOUT_MS);
      }),
    ]);
    return latestScanResult;
  } catch (error) {
    console.warn("Live scan failed", error);
    return latestScanResult;
  } finally {
    scanInFlight = false;
  }
}

type ExecutedTrade = {
  id: string;
  pair: string;
  route: string;
  executedAt: string;
  sizeUsd: string;
  pnl: string;
  status: string;
  txHash?: string;
  note?: string;
  settledAt?: string;
};

type DashboardState = Partial<DashboardPayload> & {
  bestOpportunity?: DashboardBestOpportunity;
  topRoute?: DashboardTopRoute;
  opportunitiesFeed?: DashboardOpportunityRow[];
};

let dashboardState: DashboardState = {
  status: "running",
  chain: "arbitrum",
  tokens: 7,
  pairsScanned: 36,
  opportunities: 0,
  bestProfit: "0",
  bestRoute: "No opportunity",
  lastScan: new Date().toISOString(),
  health: {
    total: 0,
    healthy: 0,
    offline: 0,
    overall: "offline",
  },
  risk: {
    approved: true,
    level: "approved",
    score: 100,
    reason: undefined as string | undefined,
  },
  opportunitiesFeed: [],
};

let executionLedger: ExecutedTrade[] = [];
type ExecutionIntentStatus = "prepared" | "submitted" | "confirmed" | "failed";

type ExecutionIntentRecord = {
  id: string;
  chain: ChainName;
  walletAddress: string;
  routeKey: string;
  amountUsd: number;
  createdAt: number;
  expiresAt: number;
  status: ExecutionIntentStatus;
  privateRelayRequested: boolean;
  privateRelayRequired: boolean;
  relayHashes: `0x${string}`[];
  txHash?: `0x${string}`;
};

type ExecutionThrottleState = {
  lastPreparedAt: number;
  lastConfirmedAt: number;
  blockedCount: number;
};

type RecoveryTicketStatus = "pending" | "prepared" | "resolved" | "failed";

type RecoveryTicket = {
  id: string;
  chain: ChainName;
  walletAddress: string;
  amountUsd: number;
  createdAt: number;
  status: RecoveryTicketStatus;
  reason: string;
  route?: {
    pair?: string;
    buyDex?: string;
    sellDex?: string;
  };
  attempts: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  lastError?: string;
  sourceTxHash?: `0x${string}`;
  recoveryTxHash?: `0x${string}`;
};

type SettlementQueueStatus = "pending" | "settled" | "failed";
type RolloutStage = "blocked" | "canary" | "scale";

type SettlementQueueItem = {
  id: string;
  txHash: `0x${string}`;
  chain: ChainName;
  walletAddress: string;
  amountUsd: number;
  pair?: string;
  route?: string;
  spreadGainUsdHint?: number;
  gasCostUsdHint?: number;
  slippageCostUsdHint?: number;
  realizedNetUsdHint?: number;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  lastError?: string;
  status: SettlementQueueStatus;
  settledAt?: string;
};

type RolloutGovernanceState = {
  chain: ChainName;
  currentStage: RolloutStage;
  promotionStreak: number;
  holdUntil?: number;
  lastTransitionAt?: number;
  reason?: string;
  manualOverrideStage?: RolloutStage;
};

type CanaryValidationStatus = {
  chain: ChainName;
  windowHours: number;
  minSettledTrades: number;
  minRealizedNetUsd: number;
  maxAverageSlippageBps: number;
  maxLossTrades: number;
  settledTrades: number;
  lossTrades: number;
  cumulativeRealizedNetUsd: number;
  averageSlippageBps: number;
  goForScale: boolean;
  reason: string;
  latestSettledAt?: string;
};

type RolloutGoNoGoStatus = {
  chain: ChainName;
  observedStage: RolloutStage;
  recommendedStage: RolloutStage;
  readyForCanary: boolean;
  readyForScale: boolean;
  checks: {
    readinessGatePass: boolean;
    relayRpcDrillPass: boolean;
    operatorSafetyPass: boolean;
    canaryValidationPass: boolean;
  };
  reason: string;
};

type RelayRpcDrillStatus = {
  generatedAt: string;
  relay: {
    requiredChains: ChainName[];
    configuredChains: ChainName[];
    missingChains: ChainName[];
    pass: boolean;
  };
  rpc: {
    totalChains: number;
    degradedOrOfflineChains: ChainName[];
    lowRedundancyChains: ChainName[];
    pass: boolean;
  };
  failClosed: {
    apiKeyConfigured: boolean;
    unsafeBypassEnabled: boolean;
    signerReady: boolean;
    pass: boolean;
  };
  alerts: {
    webhookConfigured: boolean;
    pass: boolean;
  };
  workers: {
    recoveryEnabled: boolean;
    settlementEnabled: boolean;
    pass: boolean;
  };
  overallPass: boolean;
  reason: string;
};

type LiveCostTuningSnapshot = {
  windowTrades: number;
  avgGasCostUsd: number;
  avgSlippageBps: number;
  avgRealizedNetUsd: number;
  gasCostBufferUsd: number;
  slippageMultiplier: number;
  sizingPenaltyMultiplier: number;
  reason: string;
};

type ExecutionReadinessGateStatus = {
  generatedAt: string;
  enforced: {
    canaryPassRequired: boolean;
    relayRpcDrillPassRequired: boolean;
  };
  checks: {
    killSwitchClear: boolean;
    signerReady: boolean;
    canaryPass: boolean;
    relayRpcDrillPass: boolean;
  };
  pass: boolean;
  reason: string;
};

type ReadinessGateHistoryEntry = Pick<ExecutionReadinessGateStatus, "generatedAt" | "pass" | "reason">;

type OperatorSafetySnapshot = {
  generatedAt: string;
  persistence: {
    filePath: string;
    exists: boolean;
    healthy: boolean;
    sizeBytes: number;
    lastModifiedAt?: string;
  };
  alerting: {
    webhookConfigured: boolean;
    pass: boolean;
  };
  risk: {
    killSwitchEngaged: boolean;
    readinessGatePass: boolean;
    canaryPass: boolean;
    relayRpcDrillPass: boolean;
    pass: boolean;
  };
  overallPass: boolean;
  reason: string;
};

type DeploymentSafetySnapshot = {
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

type PostTradeReconciliationSnapshot = {
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

type AlertHistoryEntry = {
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
};

type AlertingSnapshot = {
  webhookConfigured: boolean;
  unresolvedCritical: number;
  recent: AlertHistoryEntry[];
  recommendedActions: string[];
  lastDeliveredAt?: string;
  lastFailedAt?: string;
};

const EXECUTION_INTENT_TTL_MS = Number(process.env.EXECUTION_INTENT_TTL_MS ?? 10 * 60 * 1000);
const executionIntentRegistry = new Map<string, ExecutionIntentRecord>();
let executionIntentHistory: ExecutionIntentRecord[] = [];
const EXECUTION_PREPARE_COOLDOWN_MS = Math.max(0, Number(process.env.EXECUTION_PREPARE_COOLDOWN_MS ?? 1_500));
const EXECUTION_CONFIRM_COOLDOWN_MS = Math.max(0, Number(process.env.EXECUTION_CONFIRM_COOLDOWN_MS ?? 2_500));
const RECOVERY_WORKER_ENABLED = process.env.RECOVERY_WORKER_ENABLED !== "false";
const RECOVERY_WORKER_INTERVAL_MS = Math.max(5_000, Number(process.env.RECOVERY_WORKER_INTERVAL_MS ?? 15_000));
const RECOVERY_WORKER_MAX_ATTEMPTS = Math.max(1, Number(process.env.RECOVERY_WORKER_MAX_ATTEMPTS ?? 5));
const RECOVERY_WORKER_BACKOFF_MS = Math.max(1_000, Number(process.env.RECOVERY_WORKER_BACKOFF_MS ?? 30_000));
const RECOVERY_WORKER_MAX_BACKOFF_MS = Math.max(5_000, Number(process.env.RECOVERY_WORKER_MAX_BACKOFF_MS ?? 5 * 60_000));
const RECOVERY_WORKER_SLIPPAGE_BPS = Math.max(1, Number(process.env.RECOVERY_WORKER_SLIPPAGE_BPS ?? 25));
const SETTLEMENT_WORKER_ENABLED = process.env.SETTLEMENT_WORKER_ENABLED !== "false";
const SETTLEMENT_WORKER_INTERVAL_MS = Math.max(5_000, Number(process.env.SETTLEMENT_WORKER_INTERVAL_MS ?? 20_000));
const SETTLEMENT_WORKER_MAX_ATTEMPTS = Math.max(1, Number(process.env.SETTLEMENT_WORKER_MAX_ATTEMPTS ?? 8));
const SETTLEMENT_WORKER_BACKOFF_MS = Math.max(2_000, Number(process.env.SETTLEMENT_WORKER_BACKOFF_MS ?? 45_000));
const SETTLEMENT_WORKER_MAX_BACKOFF_MS = Math.max(10_000, Number(process.env.SETTLEMENT_WORKER_MAX_BACKOFF_MS ?? 10 * 60_000));
const SETTLEMENT_WORKER_MIN_PROFIT_BPS = Math.max(-500, Math.min(2_000, Number(process.env.SETTLEMENT_WORKER_MIN_PROFIT_BPS ?? 35)));
const SETTLEMENT_NATIVE_USD_FALLBACK = Math.max(0, Number(process.env.SETTLEMENT_NATIVE_USD_FALLBACK ?? 0));
const ROLLOUT_AUTOPILOT_ENABLED = process.env.ROLLOUT_AUTOPILOT_ENABLED !== "false";
const ROLLOUT_PROMOTION_STREAK = Math.max(1, Number(process.env.ROLLOUT_PROMOTION_STREAK ?? 3));
const ROLLOUT_PROMOTION_COOLDOWN_MS = Math.max(60_000, Number(process.env.ROLLOUT_PROMOTION_COOLDOWN_MS ?? 10 * 60_000));
const ROLLOUT_DEMOTION_COOLDOWN_MS = Math.max(30_000, Number(process.env.ROLLOUT_DEMOTION_COOLDOWN_MS ?? 3 * 60_000));
const CANARY_VALIDATION_CHAIN = CHAIN_LIST.includes((process.env.CANARY_VALIDATION_CHAIN ?? "arbitrum") as ChainName)
  ? (process.env.CANARY_VALIDATION_CHAIN as ChainName)
  : "arbitrum";
const CANARY_VALIDATION_WINDOW_HOURS = Math.max(1, Number(process.env.CANARY_VALIDATION_WINDOW_HOURS ?? 24));
const CANARY_MIN_SETTLED_TRADES = Math.max(1, Number(process.env.CANARY_MIN_SETTLED_TRADES ?? 3));
const CANARY_MIN_REALIZED_NET_USD = Number(process.env.CANARY_MIN_REALIZED_NET_USD ?? 1);
const CANARY_MAX_AVG_SLIPPAGE_BPS = Math.max(1, Number(process.env.CANARY_MAX_AVG_SLIPPAGE_BPS ?? 35));
const CANARY_MAX_LOSS_TRADES = Math.max(0, Number(process.env.CANARY_MAX_LOSS_TRADES ?? 1));
const LIVE_COST_TUNING_WINDOW_TRADES = Math.max(5, Number(process.env.LIVE_COST_TUNING_WINDOW_TRADES ?? 30));
const LIVE_COST_TUNING_MAX_GAS_BUFFER_USD = Math.max(0, Number(process.env.LIVE_COST_TUNING_MAX_GAS_BUFFER_USD ?? 3));
const LIVE_COST_TUNING_MAX_SLIPPAGE_MULTIPLIER = Math.max(1, Number(process.env.LIVE_COST_TUNING_MAX_SLIPPAGE_MULTIPLIER ?? 2));
const LIVE_COST_TUNING_MIN_SIZING_MULTIPLIER = Math.min(1, Math.max(0.25, Number(process.env.LIVE_COST_TUNING_MIN_SIZING_MULTIPLIER ?? 0.6)));
const EXECUTION_REQUIRE_CANARY_PASS_FOR_PREPARE = process.env.EXECUTION_REQUIRE_CANARY_PASS_FOR_PREPARE === "true";
const EXECUTION_REQUIRE_RELAY_RPC_DRILL_PASS_FOR_PREPARE = process.env.EXECUTION_REQUIRE_RELAY_RPC_DRILL_PASS_FOR_PREPARE === "true";
const RELAY_REQUIRED_CHAINS_DEFAULT: ChainName[] = ["arbitrum", "bnb", "base"];
const RELAY_REQUIRED_CHAINS = (() => {
  const parsed = String(process.env.RELAY_REQUIRED_CHAINS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is ChainName => CHAIN_LIST.includes(value as ChainName));
  return parsed.length > 0 ? parsed : RELAY_REQUIRED_CHAINS_DEFAULT;
})();
const executionThrottleRegistry = new Map<string, ExecutionThrottleState>();
const recoveryTicketRegistry = new Map<string, RecoveryTicket>();
let recoveryTicketHistory: RecoveryTicket[] = [];
const settlementQueueRegistry = new Map<string, SettlementQueueItem>();
const rolloutGovernanceRegistry = new Map<ChainName, RolloutGovernanceState>();
let readinessGateHistory: ReadinessGateHistoryEntry[] = [];
let lastKillSwitchAlertAt = 0;
let recoveryWorkerInFlight = false;
let recoveryWorkerLastRunAt = 0;
let settlementWorkerInFlight = false;
let settlementWorkerLastRunAt = 0;

const persistedExecutionState = readExecutionState();
readinessGateHistory = persistedExecutionState.readinessGateHistory.map((entry) => ({
  generatedAt: entry.generatedAt,
  pass: entry.pass,
  reason: entry.reason,
}));
const normalizePersistedChain = (value: string): ChainName => (
  CHAIN_LIST.includes(value as ChainName) ? (value as ChainName) : "arbitrum"
);
for (const ticket of persistedExecutionState.recoveryTickets) {
  recoveryTicketRegistry.set(ticket.id, {
    id: ticket.id,
    chain: normalizePersistedChain(ticket.chain),
    walletAddress: ticket.walletAddress.toLowerCase(),
    amountUsd: Number(ticket.amountUsd),
    createdAt: Number(ticket.createdAt),
    status: ticket.status,
    reason: ticket.reason,
    route: ticket.route ? { ...ticket.route } : undefined,
    attempts: Number.isFinite(ticket.attempts) ? Number(ticket.attempts) : 0,
    lastAttemptAt: Number.isFinite(ticket.lastAttemptAt) ? Number(ticket.lastAttemptAt) : undefined,
    nextRetryAt: Number.isFinite(ticket.nextRetryAt) ? Number(ticket.nextRetryAt) : undefined,
    lastError: typeof ticket.lastError === "string" ? ticket.lastError : undefined,
    sourceTxHash: isTransactionHash(ticket.sourceTxHash) ? ticket.sourceTxHash : undefined,
    recoveryTxHash: isTransactionHash(ticket.recoveryTxHash) ? ticket.recoveryTxHash : undefined,
  });
}
recoveryTicketHistory = persistedExecutionState.recoveryHistory.map((ticket) => ({
  id: ticket.id,
  chain: normalizePersistedChain(ticket.chain),
  walletAddress: ticket.walletAddress.toLowerCase(),
  amountUsd: Number(ticket.amountUsd),
  createdAt: Number(ticket.createdAt),
  status: ticket.status,
  reason: ticket.reason,
  route: ticket.route ? { ...ticket.route } : undefined,
  attempts: Number.isFinite(ticket.attempts) ? Number(ticket.attempts) : 0,
  lastAttemptAt: Number.isFinite(ticket.lastAttemptAt) ? Number(ticket.lastAttemptAt) : undefined,
  nextRetryAt: Number.isFinite(ticket.nextRetryAt) ? Number(ticket.nextRetryAt) : undefined,
  lastError: typeof ticket.lastError === "string" ? ticket.lastError : undefined,
  sourceTxHash: isTransactionHash(ticket.sourceTxHash) ? ticket.sourceTxHash : undefined,
  recoveryTxHash: isTransactionHash(ticket.recoveryTxHash) ? ticket.recoveryTxHash : undefined,
}));
for (const item of persistedExecutionState.settlementQueue) {
  if (!isTransactionHash(item.txHash)) {
    continue;
  }
  settlementQueueRegistry.set(item.id, {
    id: item.id,
    txHash: item.txHash,
    chain: normalizePersistedChain(item.chain),
    walletAddress: item.walletAddress.toLowerCase(),
    amountUsd: Number(item.amountUsd),
    pair: item.pair,
    route: item.route,
    spreadGainUsdHint: Number.isFinite(item.spreadGainUsdHint) ? Number(item.spreadGainUsdHint) : undefined,
    gasCostUsdHint: Number.isFinite(item.gasCostUsdHint) ? Number(item.gasCostUsdHint) : undefined,
    slippageCostUsdHint: Number.isFinite(item.slippageCostUsdHint) ? Number(item.slippageCostUsdHint) : undefined,
    realizedNetUsdHint: Number.isFinite(item.realizedNetUsdHint) ? Number(item.realizedNetUsdHint) : undefined,
    createdAt: Number(item.createdAt),
    attempts: Number.isFinite(item.attempts) ? Number(item.attempts) : 0,
    lastAttemptAt: Number.isFinite(item.lastAttemptAt) ? Number(item.lastAttemptAt) : undefined,
    nextRetryAt: Number.isFinite(item.nextRetryAt) ? Number(item.nextRetryAt) : undefined,
    lastError: typeof item.lastError === "string" ? item.lastError : undefined,
    status: item.status === "settled" || item.status === "failed" ? item.status : "pending",
    settledAt: typeof item.settledAt === "string" ? item.settledAt : undefined,
  });
}
for (const row of getRolloutGovernanceState()) {
  const chain = normalizePersistedChain(row.chain);
  const currentStage: RolloutStage = row.currentStage === "scale" || row.currentStage === "canary" ? row.currentStage : "blocked";
  const manualOverrideStage: RolloutStage | undefined = row.manualOverrideStage === "scale" || row.manualOverrideStage === "canary" || row.manualOverrideStage === "blocked"
    ? row.manualOverrideStage
    : undefined;
  rolloutGovernanceRegistry.set(chain, {
    chain,
    currentStage,
    promotionStreak: Number.isFinite(row.promotionStreak) ? Number(row.promotionStreak) : 0,
    holdUntil: Number.isFinite(row.holdUntil) ? Number(row.holdUntil) : undefined,
    lastTransitionAt: Number.isFinite(row.lastTransitionAt) ? Number(row.lastTransitionAt) : undefined,
    reason: typeof row.reason === "string" ? row.reason : undefined,
    manualOverrideStage,
  });
}
readinessGateHistory = persistedExecutionState.readinessGateHistory.map((entry) => ({
  generatedAt: entry.generatedAt,
  pass: entry.pass,
  reason: entry.reason,
}));

const ERC20_APPROVAL_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const MAX_UINT256 = (2n ** 256n) - 1n;

function formatUsd(value: number) {
  return `$${value.toLocaleString()}`;
}

function formatPnlUsd(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  const absolute = formatUsd(Math.abs(normalized));
  return normalized < 0 ? `-${absolute}` : absolute;
}

function formatTokenUsd(value: bigint, decimals = 18) {
  const scale = 10n ** BigInt(Math.min(decimals, 18));
  const absoluteValue = value >= 0n ? value : -value;
  const precision = absoluteValue >= scale
    ? 2
    : absoluteValue * 100n >= scale
      ? 4
      : 6;
  const scaled = absoluteValue * 10n ** BigInt(precision);
  const rounded = (scaled + (scale / 2n)) / scale;
  const whole = rounded / 10n ** BigInt(precision);
  const fraction = (rounded % 10n ** BigInt(precision)).toString().padStart(precision, "0");
  const formattedWhole = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${value < 0n ? "-" : ""}$${formattedWhole}.${fraction}`;
}

function parseUsd(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toUsdAmount(amount: bigint, decimals = 18) {
  const scale = 10 ** Math.min(decimals, 18);
  return Number(amount) / scale;
}

export function isExecutionApiAuthorized(req: express.Request, res: express.Response) {
  const expectedApiKey = process.env.EXECUTION_API_KEY?.trim();
  if (!expectedApiKey) {
    const allowWithoutKey = process.env.EXECUTION_API_ALLOW_UNSAFE_WITHOUT_KEY === "true";
    if (allowWithoutKey) {
      return true;
    }
    res.status(503).json(serializeForJson({
      success: false,
      reason: "Execution API key is not configured. Set EXECUTION_API_KEY to unlock protected execution endpoints.",
    }));
    return false;
  }

  const providedApiKey = req.header("x-execution-key");
  if (providedApiKey === expectedApiKey) {
    return true;
  }

  res.status(401).json(serializeForJson({
    success: false,
    reason: "Execution API key is missing or invalid.",
  }));
  return false;
}

function isExecutionSignerReady(res: express.Response) {
  const signerPolicy = evaluateSignerPolicy();
  if (signerPolicy.ready) {
    return true;
  }
  res.status(503).json(serializeForJson({
    success: false,
    reason: signerPolicy.reason,
    signerPolicy,
  }));
  return false;
}

function getExecutionThrottleKey(walletAddress: string, chain: ChainName) {
  return `${walletAddress.toLowerCase()}::${chain}`;
}

function getExecutionThrottleState(walletAddress: string, chain: ChainName): ExecutionThrottleState {
  const key = getExecutionThrottleKey(walletAddress, chain);
  const current = executionThrottleRegistry.get(key);
  if (current) {
    return current;
  }

  const created: ExecutionThrottleState = {
    lastPreparedAt: 0,
    lastConfirmedAt: 0,
    blockedCount: 0,
  };
  executionThrottleRegistry.set(key, created);
  return created;
}

function buildExecutionThrottleSummary(now = Date.now()) {
  const states = Array.from(executionThrottleRegistry.values());
  const activePrepareCooldowns = states.filter((state) => state.lastPreparedAt + EXECUTION_PREPARE_COOLDOWN_MS > now).length;
  const activeConfirmCooldowns = states.filter((state) => state.lastConfirmedAt + EXECUTION_CONFIRM_COOLDOWN_MS > now).length;
  const blockedCount = states.reduce((sum, state) => sum + state.blockedCount, 0);
  return {
    trackedWalletRoutes: states.length,
    activePrepareCooldowns,
    activeConfirmCooldowns,
    blockedCount,
    prepareCooldownMs: EXECUTION_PREPARE_COOLDOWN_MS,
    confirmCooldownMs: EXECUTION_CONFIRM_COOLDOWN_MS,
  };
}

function computeWinRate(trades: ExecutedTrade[]) {
  if (!trades.length) {
    return 0;
  }
  const wins = trades.filter((trade) => parseUsd(trade.pnl) > 0).length;
  return (wins / trades.length) * 100;
}

function computeDrawdownPct(trades: ExecutedTrade[]) {
  let cumulative = 0;
  let peak = 0;
  let drawdown = 0;
  for (const trade of trades) {
    const pnl = trade.pnl.startsWith("-") ? -parseUsd(trade.pnl) : parseUsd(trade.pnl);
    cumulative += pnl;
    peak = Math.max(peak, cumulative);
    drawdown = Math.min(drawdown, cumulative - peak);
  }
  if (peak <= 0) {
    return 0;
  }
  return Math.abs((drawdown / peak) * 100);
}

function formatBasisPoints(value: number | undefined) {
  const normalized = Number(value ?? 0);
  return `${Math.max(0, Math.round(normalized))} bps`;
}

function formatLiquidityState(slippageBps: number | undefined, gasImpactBps: number | undefined) {
  const slippage = Number(slippageBps ?? 0);
  const gasImpact = Number(gasImpactBps ?? 0);

  if (slippage <= 60 && gasImpact <= 90) {
    return "deep";
  }

  if (slippage <= 120 && gasImpact <= 150) {
    return "healthy";
  }

  return "tight";
}

function buildPnlSummary(trades: ExecutedTrade[]) {
  const totalVolume = trades.reduce((sum, trade) => sum + parseUsd(trade.sizeUsd), 0);
  const totalPnl = trades.reduce((sum, trade) => sum + (trade.pnl.startsWith("-") ? -parseUsd(trade.pnl) : parseUsd(trade.pnl)), 0);
  const winningTrades = trades.filter((trade) => !trade.pnl.startsWith("-")).length;
  const bestTrade = trades.length ? trades.reduce((best, trade) => {
    const current = parseUsd(trade.pnl);
    const bestValue = parseUsd(best.pnl);
    return current > bestValue ? trade : best;
  }, trades[0]) : undefined;

  return {
    totalPnl: formatUsd(totalPnl),
    winRate: trades.length ? `${Math.round((winningTrades / trades.length) * 100)}%` : "0%",
    totalVolume: formatUsd(totalVolume),
    bestTrade: bestTrade ? bestTrade.pnl : "$0",
  };
}

export function recordExecutedTrade(request: { walletAddress?: string; amountUsd?: number; route?: { pair?: string; buyDex?: string; sellDex?: string }; txHash?: string; confirmed?: boolean }) {
  if (!request.confirmed || !request.txHash) {
    return undefined;
  }

  const pair = request.route?.pair ?? "WETH/USDC";
  const buyDex = request.route?.buyDex ?? "Uniswap V2";
  const sellDex = request.route?.sellDex ?? "SushiSwap";
  const amountUsd = Number(request.amountUsd ?? 90);
  const txHash = request.txHash;
  const trade: ExecutedTrade = {
    id: `TX-${Date.now()}`,
    pair,
    route: `${buyDex} → ${sellDex}`,
    executedAt: formatIndianTime(new Date()),
    sizeUsd: formatUsd(amountUsd),
    pnl: "$0",
    status: "On-chain confirmed",
    txHash,
  };

  executionLedger = [trade, ...executionLedger].slice(0, 12);
  return trade;
}

function recordExecutionEvent(input: {
  pair?: string;
  route?: string;
  amountUsd?: number;
  pnl?: string;
  status: string;
  txHash?: string;
  note?: string;
}) {
  const entry: ExecutedTrade = {
    id: `TX-${Date.now()}`,
    pair: input.pair ?? "Unknown route",
    route: input.route ?? "—",
    executedAt: formatIndianTime(new Date()),
    sizeUsd: formatUsd(Number(input.amountUsd ?? 0)),
    pnl: input.pnl ?? "$0",
    status: input.status,
    txHash: input.txHash,
    note: input.note,
  };

  executionLedger = [entry, ...executionLedger].slice(0, 12);
  return entry;
}

function snapshotRecoveryTicket(ticket: RecoveryTicket): RecoveryTicket {
  return {
    ...ticket,
    route: ticket.route ? { ...ticket.route } : undefined,
  };
}

function persistRecoveryState() {
  writeRecoveryState(
    Array.from(recoveryTicketRegistry.values()).map((ticket) => ({
      id: ticket.id,
      chain: ticket.chain,
      walletAddress: ticket.walletAddress.toLowerCase(),
      amountUsd: ticket.amountUsd,
      createdAt: ticket.createdAt,
      status: ticket.status,
      reason: ticket.reason,
      route: ticket.route ? { ...ticket.route } : undefined,
      attempts: ticket.attempts,
      lastAttemptAt: ticket.lastAttemptAt,
      nextRetryAt: ticket.nextRetryAt,
      lastError: ticket.lastError,
      sourceTxHash: ticket.sourceTxHash,
      recoveryTxHash: ticket.recoveryTxHash,
    })),
    recoveryTicketHistory.map((ticket) => ({
      id: ticket.id,
      chain: ticket.chain,
      walletAddress: ticket.walletAddress.toLowerCase(),
      amountUsd: ticket.amountUsd,
      createdAt: ticket.createdAt,
      status: ticket.status,
      reason: ticket.reason,
      route: ticket.route ? { ...ticket.route } : undefined,
      attempts: ticket.attempts,
      lastAttemptAt: ticket.lastAttemptAt,
      nextRetryAt: ticket.nextRetryAt,
      lastError: ticket.lastError,
      sourceTxHash: ticket.sourceTxHash,
      recoveryTxHash: ticket.recoveryTxHash,
    })),
  );
}

function recordRecoveryTicketHistory(ticket: RecoveryTicket) {
  recoveryTicketHistory = [
    snapshotRecoveryTicket(ticket),
    ...recoveryTicketHistory.filter((entry) => entry.id !== ticket.id),
  ].slice(0, 20);
}

export function createRecoveryTicket(input: {
  chain: ChainName;
  walletAddress: string;
  amountUsd: number;
  reason: string;
  route?: { pair?: string; buyDex?: string; sellDex?: string };
  sourceTxHash?: `0x${string}`;
}) {
  const ticket: RecoveryTicket = {
    id: `recovery-${randomUUID()}`,
    chain: input.chain,
    walletAddress: input.walletAddress.toLowerCase(),
    amountUsd: Math.max(0, Number(input.amountUsd)),
    createdAt: Date.now(),
    status: "pending",
    reason: input.reason,
    route: input.route ? { ...input.route } : undefined,
    attempts: 0,
    lastAttemptAt: undefined,
    nextRetryAt: undefined,
    lastError: undefined,
    sourceTxHash: input.sourceTxHash,
  };
  recoveryTicketRegistry.set(ticket.id, ticket);
  recordRecoveryTicketHistory(ticket);
  persistRecoveryState();
  return ticket;
}

function updateRecoveryTicket(ticketId: string, patch: Partial<RecoveryTicket>) {
  const current = recoveryTicketRegistry.get(ticketId);
  if (!current) {
    return undefined;
  }
  const updated: RecoveryTicket = {
    ...current,
    ...patch,
    route: patch.route ? { ...patch.route } : current.route,
  };
  recoveryTicketRegistry.set(ticketId, updated);
  if (updated.status === "resolved" || updated.status === "failed") {
    recoveryTicketRegistry.delete(ticketId);
  }
  recordRecoveryTicketHistory(updated);
  persistRecoveryState();
  return updated;
}

export function buildRecoveryTicketSnapshot() {
  const active = Array.from(recoveryTicketRegistry.values()).map((ticket) => ({
    id: ticket.id,
    chain: ticket.chain,
    walletAddress: `${ticket.walletAddress.slice(0, 6)}…${ticket.walletAddress.slice(-4)}`,
    amountUsd: formatUsd(ticket.amountUsd),
    status: ticket.status,
    reason: ticket.reason,
    route: ticket.route,
    attempts: ticket.attempts,
    lastAttemptAt: ticket.lastAttemptAt ? formatIndianTime(new Date(ticket.lastAttemptAt)) : undefined,
    nextRetryAt: ticket.nextRetryAt ? formatIndianTime(new Date(ticket.nextRetryAt)) : undefined,
    lastError: ticket.lastError,
    sourceTxHash: ticket.sourceTxHash,
    createdAt: formatIndianTime(new Date(ticket.createdAt)),
  }));

  const history = recoveryTicketHistory.map((ticket) => ({
    id: ticket.id,
    chain: ticket.chain,
    walletAddress: `${ticket.walletAddress.slice(0, 6)}…${ticket.walletAddress.slice(-4)}`,
    amountUsd: formatUsd(ticket.amountUsd),
    status: ticket.status,
    reason: ticket.reason,
    route: ticket.route,
    attempts: ticket.attempts,
    lastAttemptAt: ticket.lastAttemptAt ? formatIndianTime(new Date(ticket.lastAttemptAt)) : undefined,
    nextRetryAt: ticket.nextRetryAt ? formatIndianTime(new Date(ticket.nextRetryAt)) : undefined,
    lastError: ticket.lastError,
    sourceTxHash: ticket.sourceTxHash,
    recoveryTxHash: ticket.recoveryTxHash,
    createdAt: formatIndianTime(new Date(ticket.createdAt)),
  }));

  return {
    pending: active.length,
    active,
    history,
  };
}

export function getRecoveryWorkerStatus(now = Date.now()) {
  const tickets = Array.from(recoveryTicketRegistry.values());
  const pending = tickets.filter((ticket) => ticket.status === "pending").length;
  const retryReady = tickets.filter((ticket) => ticket.status === "pending" && (!ticket.nextRetryAt || ticket.nextRetryAt <= now)).length;
  return {
    enabled: RECOVERY_WORKER_ENABLED,
    inFlight: recoveryWorkerInFlight,
    intervalMs: RECOVERY_WORKER_INTERVAL_MS,
    maxAttempts: RECOVERY_WORKER_MAX_ATTEMPTS,
    baseBackoffMs: RECOVERY_WORKER_BACKOFF_MS,
    maxBackoffMs: RECOVERY_WORKER_MAX_BACKOFF_MS,
    defaultSlippageBps: RECOVERY_WORKER_SLIPPAGE_BPS,
    pending,
    retryReady,
    lastRunAt: recoveryWorkerLastRunAt > 0 ? new Date(recoveryWorkerLastRunAt).toISOString() : undefined,
  };
}

function computeRecoveryRetryBackoffMs(attempt: number) {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(RECOVERY_WORKER_MAX_BACKOFF_MS, RECOVERY_WORKER_BACKOFF_MS * (2 ** exponent));
}

export async function processPendingRecoveryTickets() {
  if (!RECOVERY_WORKER_ENABLED || recoveryWorkerInFlight) {
    return {
      processed: 0,
      prepared: 0,
      failed: 0,
      deferred: 0,
    };
  }

  recoveryWorkerInFlight = true;
  recoveryWorkerLastRunAt = Date.now();
  let processed = 0;
  let prepared = 0;
  let failed = 0;
  let deferred = 0;

  try {
    const now = Date.now();
    const pendingTickets = Array.from(recoveryTicketRegistry.values())
      .filter((ticket) => ticket.status === "pending");
    for (const ticket of pendingTickets) {
      if (ticket.nextRetryAt && ticket.nextRetryAt > now) {
        deferred += 1;
        continue;
      }
      if (ticket.attempts >= RECOVERY_WORKER_MAX_ATTEMPTS) {
        updateRecoveryTicket(ticket.id, {
          status: "failed",
          lastError: ticket.lastError ?? "Auto-recovery max attempts exceeded.",
          nextRetryAt: undefined,
        });
        failed += 1;
        processed += 1;
        continue;
      }

      const nextAttempt = ticket.attempts + 1;
      const result = await buildPreparedRecoveryTransactions({
        walletAddress: ticket.walletAddress,
        chain: ticket.chain,
        slippageBps: RECOVERY_WORKER_SLIPPAGE_BPS,
      });
      if (result.success) {
        updateRecoveryTicket(ticket.id, {
          status: "prepared",
          attempts: nextAttempt,
          lastAttemptAt: Date.now(),
          nextRetryAt: undefined,
          lastError: undefined,
        });
        prepared += 1;
        processed += 1;
        void profitability.sendAlert("recovery-auto-prepared", "Auto-recovery transaction bundle prepared", {
          recoveryTicketId: ticket.id,
          chain: ticket.chain,
          walletAddress: ticket.walletAddress,
        });
        continue;
      }

      const backoffMs = computeRecoveryRetryBackoffMs(nextAttempt);
      const exhausted = nextAttempt >= RECOVERY_WORKER_MAX_ATTEMPTS;
      updateRecoveryTicket(ticket.id, {
        status: exhausted ? "failed" : "pending",
        attempts: nextAttempt,
        lastAttemptAt: Date.now(),
        nextRetryAt: exhausted ? undefined : Date.now() + backoffMs,
        lastError: result.reason,
      });
      failed += exhausted ? 1 : 0;
      deferred += exhausted ? 0 : 1;
      processed += 1;
      if (exhausted) {
        void profitability.sendAlert("recovery-auto-failed", "Auto-recovery exhausted retries", {
          recoveryTicketId: ticket.id,
          chain: ticket.chain,
          walletAddress: ticket.walletAddress,
          attempts: nextAttempt,
          reason: result.reason,
        });
      }
    }
  } finally {
    recoveryWorkerInFlight = false;
  }

  return {
    processed,
    prepared,
    failed,
    deferred,
  };
}

function persistSettlementQueueState() {
  writeSettlementQueue(
    Array.from(settlementQueueRegistry.values()).map((item) => ({
      id: item.id,
      txHash: item.txHash,
      chain: item.chain,
      walletAddress: item.walletAddress.toLowerCase(),
      amountUsd: item.amountUsd,
      pair: item.pair,
      route: item.route,
      spreadGainUsdHint: item.spreadGainUsdHint,
      gasCostUsdHint: item.gasCostUsdHint,
      slippageCostUsdHint: item.slippageCostUsdHint,
      realizedNetUsdHint: item.realizedNetUsdHint,
      createdAt: item.createdAt,
      attempts: item.attempts,
      lastAttemptAt: item.lastAttemptAt,
      nextRetryAt: item.nextRetryAt,
      lastError: item.lastError,
      status: item.status,
      settledAt: item.settledAt,
    })),
  );
}

export function createSettlementQueueItem(input: {
  txHash: `0x${string}`;
  chain: ChainName;
  walletAddress: string;
  amountUsd: number;
  pair?: string;
  route?: string;
  spreadGainUsdHint?: number;
  gasCostUsdHint?: number;
  slippageCostUsdHint?: number;
  realizedNetUsdHint?: number;
}) {
  const existing = Array.from(settlementQueueRegistry.values()).find((item) => item.txHash.toLowerCase() === input.txHash.toLowerCase());
  if (existing) {
    const merged: SettlementQueueItem = {
      ...existing,
      spreadGainUsdHint: Number.isFinite(input.spreadGainUsdHint) ? Number(input.spreadGainUsdHint) : existing.spreadGainUsdHint,
      gasCostUsdHint: Number.isFinite(input.gasCostUsdHint) ? Number(input.gasCostUsdHint) : existing.gasCostUsdHint,
      slippageCostUsdHint: Number.isFinite(input.slippageCostUsdHint) ? Number(input.slippageCostUsdHint) : existing.slippageCostUsdHint,
      realizedNetUsdHint: Number.isFinite(input.realizedNetUsdHint) ? Number(input.realizedNetUsdHint) : existing.realizedNetUsdHint,
      pair: input.pair ?? existing.pair,
      route: input.route ?? existing.route,
    };
    settlementQueueRegistry.set(existing.id, merged);
    persistSettlementQueueState();
    return merged;
  }
  if (!isAddress(input.walletAddress)) {
    throw new Error("A valid wallet address is required for settlement queue entry.");
  }

  const created: SettlementQueueItem = {
    id: `settlement-queue-${randomUUID()}`,
    txHash: input.txHash,
    chain: input.chain,
    walletAddress: input.walletAddress.toLowerCase(),
    amountUsd: Math.max(0, Number(input.amountUsd)),
    pair: input.pair,
    route: input.route,
    spreadGainUsdHint: Number.isFinite(input.spreadGainUsdHint) ? Number(input.spreadGainUsdHint) : undefined,
    gasCostUsdHint: Number.isFinite(input.gasCostUsdHint) ? Number(input.gasCostUsdHint) : undefined,
    slippageCostUsdHint: Number.isFinite(input.slippageCostUsdHint) ? Number(input.slippageCostUsdHint) : undefined,
    realizedNetUsdHint: Number.isFinite(input.realizedNetUsdHint) ? Number(input.realizedNetUsdHint) : undefined,
    createdAt: Date.now(),
    attempts: 0,
    status: "pending",
  };
  settlementQueueRegistry.set(created.id, created);
  persistSettlementQueueState();
  return created;
}

function updateSettlementQueueItem(queueId: string, patch: Partial<SettlementQueueItem>) {
  const current = settlementQueueRegistry.get(queueId);
  if (!current) {
    return undefined;
  }
  const updated: SettlementQueueItem = {
    ...current,
    ...patch,
  };
  settlementQueueRegistry.set(queueId, updated);
  persistSettlementQueueState();
  return updated;
}

function resolveNativeUsdPriceForChain(chain: ChainName) {
  const chainKey = chain.toUpperCase();
  const candidates = [
    process.env[`NATIVE_USD_${chainKey}`],
    process.env[`SETTLEMENT_NATIVE_USD_${chainKey}`],
    process.env.SETTLEMENT_NATIVE_USD,
  ];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return SETTLEMENT_NATIVE_USD_FALLBACK > 0 ? SETTLEMENT_NATIVE_USD_FALLBACK : undefined;
}

function computeSettlementRetryBackoffMs(attempt: number) {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(SETTLEMENT_WORKER_MAX_BACKOFF_MS, SETTLEMENT_WORKER_BACKOFF_MS * (2 ** exponent));
}

function computeAutoSettlementOutcome(input: {
  queue: SettlementQueueItem;
  gasCostUsd?: number;
}) {
  const spreadGainUsdHint = Number.isFinite(input.queue.spreadGainUsdHint) ? Number(input.queue.spreadGainUsdHint) : 0;
  const slippageCostUsdHint = Number.isFinite(input.queue.slippageCostUsdHint) ? Number(input.queue.slippageCostUsdHint) : 0;
  const gasCostUsd = Number.isFinite(input.queue.gasCostUsdHint)
    ? Number(input.queue.gasCostUsdHint)
    : Number.isFinite(input.gasCostUsd)
      ? Number(input.gasCostUsd)
      : 0;
  if (Number.isFinite(input.queue.realizedNetUsdHint)) {
    return {
      realizedNetUsd: Number(input.queue.realizedNetUsdHint),
      spreadGainUsd: spreadGainUsdHint,
      gasCostUsd,
      slippageCostUsd: slippageCostUsdHint,
      reason: "realized-net-hint",
    };
  }
  const minExpectedSpreadGain = (Math.max(0, input.queue.amountUsd) * SETTLEMENT_WORKER_MIN_PROFIT_BPS) / 10_000;
  const spreadGainUsd = Math.max(spreadGainUsdHint, minExpectedSpreadGain);
  const realizedNetUsd = spreadGainUsd - gasCostUsd - slippageCostUsdHint;
  return {
    realizedNetUsd,
    spreadGainUsd,
    gasCostUsd,
    slippageCostUsd: slippageCostUsdHint,
    reason: spreadGainUsdHint > 0 ? "spread-hint" : "bps-fallback",
  };
}

export function getSettlementWorkerStatus(now = Date.now()) {
  const queue = Array.from(settlementQueueRegistry.values());
  const pending = queue.filter((item) => item.status === "pending").length;
  const retryReady = queue.filter((item) => item.status === "pending" && (!item.nextRetryAt || item.nextRetryAt <= now)).length;
  return {
    enabled: SETTLEMENT_WORKER_ENABLED,
    inFlight: settlementWorkerInFlight,
    intervalMs: SETTLEMENT_WORKER_INTERVAL_MS,
    maxAttempts: SETTLEMENT_WORKER_MAX_ATTEMPTS,
    baseBackoffMs: SETTLEMENT_WORKER_BACKOFF_MS,
    maxBackoffMs: SETTLEMENT_WORKER_MAX_BACKOFF_MS,
    minProfitBps: SETTLEMENT_WORKER_MIN_PROFIT_BPS,
    pending,
    retryReady,
    lastRunAt: settlementWorkerLastRunAt > 0 ? new Date(settlementWorkerLastRunAt).toISOString() : undefined,
  };
}

export function buildSettlementQueueSnapshot() {
  const queue = Array.from(settlementQueueRegistry.values())
    .sort((left, right) => right.createdAt - left.createdAt);
  return {
    pending: queue.filter((item) => item.status === "pending").length,
    settled: queue.filter((item) => item.status === "settled").length,
    failed: queue.filter((item) => item.status === "failed").length,
    items: queue.map((item) => ({
      id: item.id,
      txHash: item.txHash,
      chain: item.chain,
      walletAddress: `${item.walletAddress.slice(0, 6)}…${item.walletAddress.slice(-4)}`,
      amountUsd: formatUsd(item.amountUsd),
      pair: item.pair,
      route: item.route,
      status: item.status,
      attempts: item.attempts,
      lastAttemptAt: item.lastAttemptAt ? formatIndianTime(new Date(item.lastAttemptAt)) : undefined,
      nextRetryAt: item.nextRetryAt ? formatIndianTime(new Date(item.nextRetryAt)) : undefined,
      lastError: item.lastError,
      createdAt: formatIndianTime(new Date(item.createdAt)),
      settledAt: item.settledAt,
    })),
  };
}

export function buildCanaryValidationStatus(input?: {
  now?: number;
  chain?: ChainName;
  windowHours?: number;
  minSettledTrades?: number;
  minRealizedNetUsd?: number;
  maxAverageSlippageBps?: number;
  maxLossTrades?: number;
}): CanaryValidationStatus {
  const now = Number.isFinite(input?.now) ? Number(input?.now) : Date.now();
  const chain = input?.chain ?? CANARY_VALIDATION_CHAIN;
  const windowHours = Math.max(1, Number(input?.windowHours ?? CANARY_VALIDATION_WINDOW_HOURS));
  const minSettledTrades = Math.max(1, Number(input?.minSettledTrades ?? CANARY_MIN_SETTLED_TRADES));
  const minRealizedNetUsd = Number(input?.minRealizedNetUsd ?? CANARY_MIN_REALIZED_NET_USD);
  const maxAverageSlippageBps = Math.max(1, Number(input?.maxAverageSlippageBps ?? CANARY_MAX_AVG_SLIPPAGE_BPS));
  const maxLossTrades = Math.max(0, Number(input?.maxLossTrades ?? CANARY_MAX_LOSS_TRADES));
  const windowStart = now - (windowHours * 60 * 60 * 1000);

  const queueByHash = new Map(
    Array.from(settlementQueueRegistry.values()).map((item) => [item.txHash.toLowerCase(), item] as const),
  );
  const recentSettlements = getSettlementRecords(500)
    .map((record) => {
      const queueItem = queueByHash.get(record.txHash.toLowerCase());
      const settledAtMs = Date.parse(record.settledAt);
      return {
        record,
        queueItem,
        settledAtMs: Number.isFinite(settledAtMs) ? settledAtMs : 0,
      };
    })
    .filter((item) => item.queueItem?.chain === chain && item.settledAtMs >= windowStart);

  const settledTrades = recentSettlements.length;
  const cumulativeRealizedNetUsd = recentSettlements.reduce((sum, item) => sum + Number(item.record.realizedNetUsd), 0);
  const lossTrades = recentSettlements.filter((item) => Number(item.record.realizedNetUsd) < 0).length;
  const slippageSamplesBps = recentSettlements
    .map((item) => {
      const notionalUsd = Number(item.queueItem?.amountUsd ?? 0);
      if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) {
        return null;
      }
      return (Number(item.record.slippageCostUsd) / notionalUsd) * 10_000;
    })
    .filter((row): row is number => Number.isFinite(row));
  const averageSlippageBps = slippageSamplesBps.length > 0
    ? slippageSamplesBps.reduce((sum, value) => sum + value, 0) / slippageSamplesBps.length
    : 0;
  const latestSettledAt = recentSettlements.length > 0
    ? recentSettlements.reduce((latest, item) => (item.settledAtMs > latest.settledAtMs ? item : latest)).record.settledAt
    : undefined;

  if (settledTrades < minSettledTrades) {
    return {
      chain,
      windowHours,
      minSettledTrades,
      minRealizedNetUsd,
      maxAverageSlippageBps,
      maxLossTrades,
      settledTrades,
      lossTrades,
      cumulativeRealizedNetUsd,
      averageSlippageBps,
      goForScale: false,
      reason: `Need at least ${minSettledTrades} settled canary trades in the last ${windowHours}h.`,
      latestSettledAt,
    };
  }

  if (cumulativeRealizedNetUsd < minRealizedNetUsd) {
    return {
      chain,
      windowHours,
      minSettledTrades,
      minRealizedNetUsd,
      maxAverageSlippageBps,
      maxLossTrades,
      settledTrades,
      lossTrades,
      cumulativeRealizedNetUsd,
      averageSlippageBps,
      goForScale: false,
      reason: `Cumulative realized net ${cumulativeRealizedNetUsd.toFixed(2)} USD is below required ${minRealizedNetUsd.toFixed(2)} USD.`,
      latestSettledAt,
    };
  }

  if (lossTrades > maxLossTrades) {
    return {
      chain,
      windowHours,
      minSettledTrades,
      minRealizedNetUsd,
      maxAverageSlippageBps,
      maxLossTrades,
      settledTrades,
      lossTrades,
      cumulativeRealizedNetUsd,
      averageSlippageBps,
      goForScale: false,
      reason: `Loss trades ${lossTrades} exceed cap ${maxLossTrades}.`,
      latestSettledAt,
    };
  }

  if (averageSlippageBps > maxAverageSlippageBps) {
    return {
      chain,
      windowHours,
      minSettledTrades,
      minRealizedNetUsd,
      maxAverageSlippageBps,
      maxLossTrades,
      settledTrades,
      lossTrades,
      cumulativeRealizedNetUsd,
      averageSlippageBps,
      goForScale: false,
      reason: `Average slippage ${averageSlippageBps.toFixed(2)} bps exceeds cap ${maxAverageSlippageBps.toFixed(2)} bps.`,
      latestSettledAt,
    };
  }

  return {
    chain,
    windowHours,
    minSettledTrades,
    minRealizedNetUsd,
    maxAverageSlippageBps,
    maxLossTrades,
    settledTrades,
    lossTrades,
    cumulativeRealizedNetUsd,
    averageSlippageBps,
    goForScale: true,
    reason: "Canary validation passed. Conditions are healthy for controlled scale rollout.",
    latestSettledAt,
  };
}

function observedStageIsNotBlocked(stage: RolloutStage) {
  return stage === "canary" || stage === "scale";
}

export function buildRolloutGoNoGoStatus(input: {
  chain: ChainName;
  observedStage: RolloutStage;
  canaryValidation: CanaryValidationStatus;
  readinessGate: ExecutionReadinessGateStatus;
  relayRpcDrill: RelayRpcDrillStatus;
  operatorSafety: OperatorSafetySnapshot;
}): RolloutGoNoGoStatus {
  const readinessGatePass = input.readinessGate.pass;
  const relayRpcDrillPass = input.relayRpcDrill.overallPass;
  const operatorSafetyPass = input.operatorSafety.overallPass;
  const canaryValidationPass = input.canaryValidation.goForScale;
  const readyForCanary = readinessGatePass && relayRpcDrillPass && observedStageIsNotBlocked(input.observedStage);
  const readyForScale = readyForCanary && operatorSafetyPass && canaryValidationPass && input.observedStage === "scale";

  let reason = "Rollout is ready for staged scale.";
  if (!readyForCanary) {
    reason = !readinessGatePass
      ? input.readinessGate.reason
      : !relayRpcDrillPass
        ? input.relayRpcDrill.reason
        : "Observed route health is not yet good enough to enter canary rollout.";
  } else if (!canaryValidationPass) {
    reason = `Canary validation is not yet ready for scale on ${input.chain}.`;
  } else if (!operatorSafetyPass) {
    reason = input.operatorSafety.reason;
  } else if (input.observedStage !== "scale") {
    reason = `Route quality is healthy, but ${input.chain} still needs scale-grade coverage before promotion.`;
  }

  return {
    chain: input.chain,
    observedStage: input.observedStage,
    recommendedStage: readyForScale ? "scale" : readyForCanary ? "canary" : "blocked",
    readyForCanary,
    readyForScale,
    checks: {
      readinessGatePass,
      relayRpcDrillPass,
      operatorSafetyPass,
      canaryValidationPass,
    },
    reason,
  };
}

function buildRpcHealthSnapshotForReadinessGate() {
  return rpcManager.getAllChainHealthSnapshots(CHAIN_LIST).map((chain) => ({
    chain: chain.chain,
    selectedUrl: chain.selectedUrl,
    latestBlock: undefined,
    total: chain.total,
    healthy: chain.healthy,
    offline: chain.offline,
    overall: chain.overall,
    endpoints: chain.endpoints.map((endpoint) => ({
      url: endpoint.url,
      selected: endpoint.selected,
      inCooldown: endpoint.inCooldown,
      failures: endpoint.failures,
      successes: endpoint.successes,
      cooldownUntil: endpoint.cooldownUntil,
      lastLatency: endpoint.lastLatency,
      lastUsedAt: endpoint.lastUsedAt,
    })),
  }));
}

export function buildExecutionReadinessGateStatus(input?: {
  now?: Date;
  killSwitch?: { engaged: boolean };
  signerReady?: boolean;
  canaryValidation?: CanaryValidationStatus;
  relayRpcDrill?: RelayRpcDrillStatus;
  enforceCanaryPass?: boolean;
  enforceRelayRpcDrillPass?: boolean;
}): ExecutionReadinessGateStatus {
  const canaryValidation = input?.canaryValidation ?? buildCanaryValidationStatus();
  const signerReady = input?.signerReady ?? evaluateSignerPolicy().ready;
  const relayRpcDrill = input?.relayRpcDrill ?? buildRelayRpcDrillStatus({
    rpcHealth: buildRpcHealthSnapshotForReadinessGate(),
    signerReady,
  });
  const killSwitch = input?.killSwitch ?? profitability.getKillSwitchState();
  const enforceCanaryPass = input?.enforceCanaryPass ?? EXECUTION_REQUIRE_CANARY_PASS_FOR_PREPARE;
  const enforceRelayRpcDrillPass = input?.enforceRelayRpcDrillPass ?? EXECUTION_REQUIRE_RELAY_RPC_DRILL_PASS_FOR_PREPARE;
  const killSwitchClear = !killSwitch.engaged;
  const canaryPass = canaryValidation.goForScale;
  const relayRpcDrillPass = relayRpcDrill.overallPass;
  const pass = killSwitchClear
    && signerReady
    && (!enforceCanaryPass || canaryPass)
    && (!enforceRelayRpcDrillPass || relayRpcDrillPass);
  let reason = "Execution readiness gate passed.";
  if (!killSwitchClear) {
    reason = "Execution readiness gate blocked: kill-switch is engaged.";
  } else if (!signerReady) {
    reason = "Execution readiness gate blocked: signer policy is not ready.";
  } else if (enforceCanaryPass && !canaryPass) {
    reason = `Execution readiness gate blocked by canary policy: ${canaryValidation.reason}`;
  } else if (enforceRelayRpcDrillPass && !relayRpcDrillPass) {
    reason = `Execution readiness gate blocked by relay/RPC drill policy: ${relayRpcDrill.reason}`;
  } else if (!enforceCanaryPass && !enforceRelayRpcDrillPass) {
    reason = "Execution readiness gate is advisory-only (enforcement disabled).";
  }

  const snapshot: ExecutionReadinessGateStatus = {
    generatedAt: (input?.now ?? new Date()).toISOString(),
    enforced: {
      canaryPassRequired: enforceCanaryPass,
      relayRpcDrillPassRequired: enforceRelayRpcDrillPass,
    },
    checks: {
      killSwitchClear,
      signerReady,
      canaryPass,
      relayRpcDrillPass,
    },
    pass,
    reason,
  };
  const latest = readinessGateHistory[0];
  if (!latest || latest.pass !== snapshot.pass || latest.reason !== snapshot.reason) {
    readinessGateHistory.unshift({
      generatedAt: snapshot.generatedAt,
      pass: snapshot.pass,
      reason: snapshot.reason,
    });
    readinessGateHistory = readinessGateHistory.slice(0, 10);
    void writeReadinessGateHistory(readinessGateHistory);
  } else {
    readinessGateHistory[0] = {
      generatedAt: snapshot.generatedAt,
      pass: snapshot.pass,
      reason: snapshot.reason,
    };
  }
  return snapshot;
}

export function getReadinessGateHistory(windowSize = 5): ReadinessGateHistoryEntry[] {
  return readinessGateHistory.slice(0, Math.max(1, windowSize));
}

export function resetReadinessGateHistoryForTests(): void {
  readinessGateHistory = [];
}

export function buildOperatorSafetySnapshot(input?: {
  killSwitch?: { engaged: boolean };
  readinessGate?: ExecutionReadinessGateStatus;
  canaryValidation?: CanaryValidationStatus;
  relayRpcDrill?: RelayRpcDrillStatus;
}): OperatorSafetySnapshot {
  const killSwitch = input?.killSwitch ?? profitability.getKillSwitchState();
  const readinessGate = input?.readinessGate ?? buildExecutionReadinessGateStatus({ killSwitch });
  const canaryValidation = input?.canaryValidation ?? buildCanaryValidationStatus();
  const relayRpcDrill = input?.relayRpcDrill ?? buildRelayRpcDrillStatus({
    rpcHealth: buildRpcHealthSnapshotForReadinessGate(),
    signerReady: evaluateSignerPolicy().ready,
  });
  const storeMeta = getExecutionStoreMeta();
  const storeExists = existsSync(storeMeta.filePath);
  const storeStats = storeExists ? statSync(storeMeta.filePath) : undefined;
  const persistenceHealthy = Boolean(storeExists && storeStats && storeStats.isFile() && storeStats.size >= 0);
  const alertingConfigured = Boolean(process.env.ALERT_WEBHOOK_URL?.trim());
  const riskPass = !killSwitch.engaged && readinessGate.pass && canaryValidation.goForScale && relayRpcDrill.overallPass;
  const overallPass = persistenceHealthy && alertingConfigured && riskPass;
  let reason = "Operator safety snapshot is healthy.";
  if (!persistenceHealthy) {
    reason = "Execution state persistence is not healthy.";
  } else if (!alertingConfigured) {
    reason = "Alerting webhook is not configured.";
  } else if (killSwitch.engaged) {
    reason = "Kill-switch is engaged.";
  } else if (!readinessGate.pass) {
    reason = readinessGate.reason;
  } else if (!canaryValidation.goForScale) {
    reason = canaryValidation.reason;
  } else if (!relayRpcDrill.overallPass) {
    reason = relayRpcDrill.reason;
  }

  return {
    generatedAt: new Date().toISOString(),
    persistence: {
      filePath: storeMeta.filePath,
      exists: storeExists,
      healthy: persistenceHealthy,
      sizeBytes: storeStats?.size ?? 0,
      lastModifiedAt: storeStats ? new Date(storeStats.mtimeMs).toISOString() : undefined,
    },
    alerting: {
      webhookConfigured: alertingConfigured,
      pass: alertingConfigured,
    },
    risk: {
      killSwitchEngaged: killSwitch.engaged,
      readinessGatePass: readinessGate.pass,
      canaryPass: canaryValidation.goForScale,
      relayRpcDrillPass: relayRpcDrill.overallPass,
      pass: riskPass,
    },
    overallPass,
    reason,
  };
}

export function buildDeploymentSafetySnapshot(): DeploymentSafetySnapshot {
  const storeMeta = getExecutionStoreMeta();
  const storeExists = existsSync(storeMeta.filePath);
  const storeStats = storeExists ? statSync(storeMeta.filePath) : undefined;
  const persistenceHealthy = Boolean(storeExists && storeStats && storeStats.isFile() && storeStats.size >= 0);
  const recoveryWorker = getRecoveryWorkerStatus();
  const settlementWorker = getSettlementWorkerStatus();
  const operatorSafety = buildOperatorSafetySnapshot({
    killSwitch: profitability.getKillSwitchState(),
  });
  const alertingConfigured = operatorSafety.alerting.webhookConfigured;
  const blockers = [];
  if (!persistenceHealthy) {
    blockers.push("execution-state persistence is not healthy");
  }
  if (!alertingConfigured) {
    blockers.push("alerting webhook is not configured");
  }
  if (recoveryWorker.inFlight) {
    blockers.push("recovery worker is still in flight");
  }
  if (settlementWorker.inFlight) {
    blockers.push("settlement worker is still in flight");
  }
  if (!operatorSafety.overallPass) {
    blockers.push(operatorSafety.reason);
  }
  const safeToRestart = blockers.length === 0;
  return {
    generatedAt: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptimeSeconds: Math.max(0, Math.round(process.uptime())),
      startedAt: new Date(Date.now() - (process.uptime() * 1000)).toISOString(),
      nodeVersion: process.version,
    },
    persistence: {
      filePath: storeMeta.filePath,
      exists: storeExists,
      healthy: persistenceHealthy,
      sizeBytes: storeStats?.size ?? 0,
      lastModifiedAt: storeStats ? new Date(storeStats.mtimeMs).toISOString() : undefined,
    },
    workers: {
      recovery: {
        enabled: recoveryWorker.enabled,
        inFlight: recoveryWorker.inFlight,
        pending: recoveryWorker.pending,
        retryReady: recoveryWorker.retryReady,
      },
      settlement: {
        enabled: settlementWorker.enabled,
        inFlight: settlementWorker.inFlight,
        pending: settlementWorker.pending,
        retryReady: settlementWorker.retryReady,
      },
    },
    alerts: {
      webhookConfigured: alertingConfigured,
    },
    restart: {
      safeToRestart,
      blockers,
      reason: safeToRestart ? "Deployment restart safety checks passed." : `Deployment restart blocked: ${blockers.join("; ")}`,
    },
  };
}

export function buildPostTradeReconciliationSnapshot(): PostTradeReconciliationSnapshot {
  const trades = executionLedger.slice();
  const settlements = getSettlementRecords(500);
  const settlementsByHash = new Map(settlements.map((record) => [record.txHash.toLowerCase(), record] as const));
  const matched = trades.filter((trade) => Boolean(trade.txHash && settlementsByHash.has(trade.txHash.toLowerCase()))).length;
  const pendingTrades = trades.filter((trade) => trade.txHash && !settlementsByHash.has(trade.txHash.toLowerCase()));
  const orphanSettlements = settlements.filter((record) => !trades.some((trade) => trade.txHash?.toLowerCase() === record.txHash.toLowerCase())).length;
  const recentIssues = [
    ...pendingTrades.slice(0, 3).map((trade) => ({
      type: "missing-settlement" as const,
      txHash: trade.txHash ?? trade.id,
      chain: undefined,
      note: `Trade ${trade.pair} (${trade.status}) has no matching settlement record yet.`,
    })),
    ...settlements
      .filter((record) => !trades.some((trade) => trade.txHash?.toLowerCase() === record.txHash.toLowerCase()))
      .slice(0, 3)
      .map((record) => ({
        type: "orphan-settlement" as const,
        txHash: record.txHash,
        chain: undefined,
        note: `Settlement ${record.txHash.slice(0, 10)}... has no matching trade ledger entry.`,
      })),
  ].slice(0, 6);
  const pending = pendingTrades.length;
  const reason = pending === 0 && orphanSettlements === 0
    ? "Post-trade reconciliation is clean."
    : "Post-trade reconciliation found ledger gaps.";
  return {
    generatedAt: new Date().toISOString(),
    matched,
    pending,
    orphanSettlements,
    recentIssues,
    reason,
  };
}

function buildAlertingSnapshot(): AlertingSnapshot {
  const webhookConfigured = Boolean(process.env.ALERT_WEBHOOK_URL?.trim());
  const recent = profitability.getAlertHistory(20).map((entry) => ({
    id: entry.id,
    event: entry.event,
    message: entry.message,
    timestamp: entry.timestamp,
    severity: entry.severity,
    delivered: entry.delivered,
    reason: entry.reason,
    responseAction: entry.responseAction,
    acknowledged: entry.acknowledged,
    acknowledgedAt: entry.acknowledgedAt,
    acknowledgedBy: entry.acknowledgedBy,
    status: entry.status,
  }));
  const unresolvedCritical = recent.filter((entry) => entry.severity === "critical" && !entry.acknowledged).length;
  const recommendedActions = Array.from(new Set(
    recent
      .filter((entry) => !entry.acknowledged)
      .map((entry) => entry.responseAction)
      .filter(Boolean),
  ));
  const lastDeliveredAt = recent.find((entry) => entry.delivered)?.timestamp;
  const lastFailedAt = recent.find((entry) => !entry.delivered)?.timestamp;
  return {
    webhookConfigured,
    unresolvedCritical,
    recent,
    recommendedActions,
    lastDeliveredAt,
    lastFailedAt,
  };
}

export function buildLiveCostTuningSnapshot(input?: {
  windowTrades?: number;
}): LiveCostTuningSnapshot {
  const windowTrades = Math.max(5, Number(input?.windowTrades ?? LIVE_COST_TUNING_WINDOW_TRADES));
  const queueByHash = new Map(
    Array.from(settlementQueueRegistry.values()).map((item) => [item.txHash.toLowerCase(), item] as const),
  );
  const settled = getSettlementRecords(500)
    .map((record) => ({
      record,
      queueItem: queueByHash.get(record.txHash.toLowerCase()),
      settledAtMs: Date.parse(record.settledAt),
    }))
    .filter((row) => Number.isFinite(row.settledAtMs))
    .sort((left, right) => (right.settledAtMs - left.settledAtMs))
    .slice(0, windowTrades);

  if (settled.length === 0) {
    return {
      windowTrades: 0,
      avgGasCostUsd: 0,
      avgSlippageBps: 0,
      avgRealizedNetUsd: 0,
      gasCostBufferUsd: 0,
      slippageMultiplier: 1,
      sizingPenaltyMultiplier: 1,
      reason: "No settled trades yet; live cost tuning is neutral.",
    };
  }

  const avgGasCostUsd = settled.reduce((sum, row) => sum + Math.max(0, Number(row.record.gasCostUsd)), 0) / settled.length;
  const avgRealizedNetUsd = settled.reduce((sum, row) => sum + Number(row.record.realizedNetUsd), 0) / settled.length;
  const slippageSamples = settled
    .map((row) => {
      const amountUsd = Number(row.queueItem?.amountUsd ?? 0);
      if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        return null;
      }
      return (Math.max(0, Number(row.record.slippageCostUsd)) / amountUsd) * 10_000;
    })
    .filter((value): value is number => Number.isFinite(value));
  const avgSlippageBps = slippageSamples.length > 0
    ? slippageSamples.reduce((sum, value) => sum + value, 0) / slippageSamples.length
    : 0;
  const lossRate = settled.filter((row) => Number(row.record.realizedNetUsd) < 0).length / settled.length;

  const gasCostBufferUsd = Math.min(
    LIVE_COST_TUNING_MAX_GAS_BUFFER_USD,
    Math.max(0, avgGasCostUsd * 0.25),
  );
  const slippageMultiplier = Math.min(
    LIVE_COST_TUNING_MAX_SLIPPAGE_MULTIPLIER,
    Math.max(1, 1 + (avgSlippageBps / 400)),
  );
  const sizingPenaltyMultiplier = Math.max(
    LIVE_COST_TUNING_MIN_SIZING_MULTIPLIER,
    Math.min(1, 1 - (lossRate * 0.35) - (avgSlippageBps / 2000)),
  );

  return {
    windowTrades: settled.length,
    avgGasCostUsd: Number(avgGasCostUsd.toFixed(4)),
    avgSlippageBps: Number(avgSlippageBps.toFixed(4)),
    avgRealizedNetUsd: Number(avgRealizedNetUsd.toFixed(4)),
    gasCostBufferUsd: Number(gasCostBufferUsd.toFixed(4)),
    slippageMultiplier: Number(slippageMultiplier.toFixed(4)),
    sizingPenaltyMultiplier: Number(sizingPenaltyMultiplier.toFixed(4)),
    reason: avgRealizedNetUsd >= 0
      ? "Recent settlements are stable; mild defensive cost buffers are applied."
      : "Recent settlements show negative edge; tighter slippage and sizing limits are applied.",
  };
}

export function buildRelayRpcDrillStatus(input?: {
  now?: Date;
  rpcHealth?: Awaited<ReturnType<typeof buildRpcHealthSnapshot>>;
  signerReady?: boolean;
  apiKeyConfigured?: boolean;
  unsafeBypassEnabled?: boolean;
  webhookConfigured?: boolean;
}): RelayRpcDrillStatus {
  const generatedAt = (input?.now ?? new Date()).toISOString();
  const rpcHealth = input?.rpcHealth ?? [];
  const signerReady = input?.signerReady ?? evaluateSignerPolicy().ready;
  const apiKeyConfigured = input?.apiKeyConfigured ?? Boolean(process.env.EXECUTION_API_KEY?.trim());
  const unsafeBypassEnabled = input?.unsafeBypassEnabled ?? (process.env.EXECUTION_API_ALLOW_UNSAFE_WITHOUT_KEY === "true");
  const webhookConfigured = input?.webhookConfigured ?? Boolean(process.env.ALERT_WEBHOOK_URL?.trim());

  const relayStatusByChain = RELAY_REQUIRED_CHAINS.map((chain) => ({
    chain,
    ...getPrivateRelayRpcUrlStatus(chain),
  }));
  const configuredChains = relayStatusByChain.filter((entry) => Boolean(entry.resolved)).map((entry) => entry.chain);
  const invalidChains = relayStatusByChain.filter((entry) => entry.invalid).map((entry) => entry.chain);
  const missingChains = relayStatusByChain.filter((entry) => !entry.resolved && !entry.invalid).map((entry) => entry.chain);
  const degradedOrOfflineChains = rpcHealth
    .filter((row) => row.overall !== "healthy")
    .map((row) => row.chain);
  const lowRedundancyChains = rpcHealth
    .filter((row) => (row.total - row.offline) < 2)
    .map((row) => row.chain);
  const relayPass = missingChains.length === 0 && invalidChains.length === 0;
  const rpcPass = degradedOrOfflineChains.length === 0 && lowRedundancyChains.length === 0 && rpcHealth.length > 0;
  const failClosedPass = apiKeyConfigured && !unsafeBypassEnabled && signerReady;
  const alertsPass = webhookConfigured;
  const workersPass = RECOVERY_WORKER_ENABLED && SETTLEMENT_WORKER_ENABLED;
  const overallPass = relayPass && rpcPass && failClosedPass && alertsPass && workersPass;

  let reason = "Relay+RPC drill passed.";
  if (invalidChains.length > 0) {
    reason = `Private relay misconfigured on: ${invalidChains.join(", ")}.`;
  } else if (!relayPass) {
    reason = `Private relay missing on: ${missingChains.join(", ")}.`;
  } else if (!rpcPass) {
    reason = `RPC failover not ready. Degraded/offline: ${degradedOrOfflineChains.join(", ") || "none"}, low redundancy: ${lowRedundancyChains.join(", ") || "none"}.`;
  } else if (!failClosedPass) {
    reason = "Fail-closed policy is not fully enforced (api key/signer/unsafe bypass).";
  } else if (!alertsPass) {
    reason = "Alert webhook is not configured.";
  } else if (!workersPass) {
    reason = "Recovery or settlement worker is disabled.";
  }

  return {
    generatedAt,
    relay: {
      requiredChains: RELAY_REQUIRED_CHAINS,
      configuredChains,
      missingChains,
      pass: relayPass,
    },
    rpc: {
      totalChains: rpcHealth.length,
      degradedOrOfflineChains,
      lowRedundancyChains,
      pass: rpcPass,
    },
    failClosed: {
      apiKeyConfigured,
      unsafeBypassEnabled,
      signerReady,
      pass: failClosedPass,
    },
    alerts: {
      webhookConfigured,
      pass: alertsPass,
    },
    workers: {
      recoveryEnabled: RECOVERY_WORKER_ENABLED,
      settlementEnabled: SETTLEMENT_WORKER_ENABLED,
      pass: workersPass,
    },
    overallPass,
    reason,
  };
}

export async function processPendingSettlementQueue() {
  if (!SETTLEMENT_WORKER_ENABLED || settlementWorkerInFlight) {
    return {
      processed: 0,
      settled: 0,
      failed: 0,
      deferred: 0,
    };
  }

  settlementWorkerInFlight = true;
  settlementWorkerLastRunAt = Date.now();
  let processed = 0;
  let settled = 0;
  let failed = 0;
  let deferred = 0;
  try {
    const now = Date.now();
    const queueItems = Array.from(settlementQueueRegistry.values())
      .filter((item) => item.status === "pending");
    for (const item of queueItems) {
      if (item.nextRetryAt && item.nextRetryAt > now) {
        deferred += 1;
        continue;
      }
      if (item.attempts >= SETTLEMENT_WORKER_MAX_ATTEMPTS) {
        updateSettlementQueueItem(item.id, {
          status: "failed",
          nextRetryAt: undefined,
          lastError: item.lastError ?? "Auto-settlement max attempts exceeded.",
        });
        failed += 1;
        processed += 1;
        continue;
      }

      const nextAttempt = item.attempts + 1;
      const confirmed = await isReceiptConfirmed(item.txHash, item.chain);
      if (!confirmed) {
        updateSettlementQueueItem(item.id, {
          attempts: nextAttempt,
          lastAttemptAt: Date.now(),
          nextRetryAt: Date.now() + computeSettlementRetryBackoffMs(nextAttempt),
          lastError: "Transaction receipt is not confirmed yet.",
        });
        deferred += 1;
        processed += 1;
        continue;
      }

      let gasCostUsdEstimated: number | undefined;
      try {
        const receipt = await getClient(item.chain).getTransactionReceipt({ hash: item.txHash });
        const nativeUsd = resolveNativeUsdPriceForChain(item.chain);
        if (nativeUsd && receipt.effectiveGasPrice && receipt.gasUsed) {
          const gasNative = Number(receipt.effectiveGasPrice * receipt.gasUsed) / 1e18;
          if (Number.isFinite(gasNative) && gasNative >= 0) {
            gasCostUsdEstimated = gasNative * nativeUsd;
          }
        }
      } catch {
        gasCostUsdEstimated = undefined;
      }

      const computed = computeAutoSettlementOutcome({
        queue: item,
        gasCostUsd: gasCostUsdEstimated,
      });
      const settledResult = settleTradeByHash({
        txHash: item.txHash,
        realizedNetUsd: computed.realizedNetUsd,
        spreadGainUsd: computed.spreadGainUsd,
        gasCostUsd: computed.gasCostUsd,
        slippageCostUsd: computed.slippageCostUsd,
        note: `auto-settlement:${computed.reason}`,
      });
      if (!settledResult.success) {
        const exhausted = nextAttempt >= SETTLEMENT_WORKER_MAX_ATTEMPTS;
        updateSettlementQueueItem(item.id, {
          status: exhausted ? "failed" : "pending",
          attempts: nextAttempt,
          lastAttemptAt: Date.now(),
          nextRetryAt: exhausted ? undefined : Date.now() + computeSettlementRetryBackoffMs(nextAttempt),
          lastError: settledResult.reason,
        });
        failed += exhausted ? 1 : 0;
        deferred += exhausted ? 0 : 1;
        processed += 1;
        continue;
      }

      updateSettlementQueueItem(item.id, {
        status: "settled",
        attempts: nextAttempt,
        lastAttemptAt: Date.now(),
        nextRetryAt: undefined,
        lastError: undefined,
        settledAt: new Date().toISOString(),
      });
      settled += 1;
      processed += 1;
      void profitability.sendAlert("execution-auto-settled", "Execution auto-settlement completed", {
        txHash: item.txHash,
        chain: item.chain,
        realizedNetUsd: computed.realizedNetUsd,
      });
    }
  } finally {
    settlementWorkerInFlight = false;
  }

  return {
    processed,
    settled,
    failed,
    deferred,
  };
}

export function settleTradeByHash(input: {
  txHash: `0x${string}`;
  realizedNetUsd: number;
  spreadGainUsd?: number;
  gasCostUsd?: number;
  slippageCostUsd?: number;
  note?: string;
}) {
  const trade = executionLedger.find((entry) => entry.txHash?.toLowerCase() === input.txHash.toLowerCase());
  if (!trade) {
    return {
      success: false as const,
      reason: "Trade not found for settlement hash.",
    };
  }
  if (trade.status === "On-chain settled") {
    return {
      success: false as const,
      reason: "Trade is already settled.",
    };
  }

  const realizedNetUsd = Number.isFinite(input.realizedNetUsd) ? Number(input.realizedNetUsd) : 0;
  const settledAtIso = new Date().toISOString();
  trade.pnl = formatPnlUsd(realizedNetUsd);
  trade.status = "On-chain settled";
  trade.note = input.note ?? trade.note;
  trade.settledAt = formatIndianTime(settledAtIso);

  profitability.recordExecutionOutcome({
    spreadGainUsd: Number(input.spreadGainUsd ?? 0),
    gasCostUsd: Number(input.gasCostUsd ?? 0),
    slippageCostUsd: Number(input.slippageCostUsd ?? 0),
    realizedNetUsd,
    failed: realizedNetUsd < 0,
    rpcHealthy: healthMonitor.getSummary().overall === "healthy",
  });
  appendSettlementRecord({
    id: `settlement-${randomUUID()}`,
    txHash: input.txHash,
    pair: trade.pair,
    route: trade.route,
    realizedNetUsd,
    spreadGainUsd: Number(input.spreadGainUsd ?? 0),
    gasCostUsd: Number(input.gasCostUsd ?? 0),
    slippageCostUsd: Number(input.slippageCostUsd ?? 0),
    note: input.note,
    settledAt: settledAtIso,
  });
  for (const queueItem of settlementQueueRegistry.values()) {
    if (queueItem.txHash.toLowerCase() !== input.txHash.toLowerCase()) {
      continue;
    }
    updateSettlementQueueItem(queueItem.id, {
      status: "settled",
      settledAt: settledAtIso,
      lastError: undefined,
      nextRetryAt: undefined,
    });
  }

  return {
    success: true as const,
    trade,
  };
}

function snapshotExecutionIntent(intent: ExecutionIntentRecord): ExecutionIntentRecord {
  return {
    ...intent,
    relayHashes: [...intent.relayHashes],
  };
}

function recordExecutionIntentHistory(intent: ExecutionIntentRecord) {
  executionIntentHistory = [
    snapshotExecutionIntent(intent),
    ...executionIntentHistory.filter((entry) => entry.id !== intent.id),
  ].slice(0, 12);
}

function formatIntentRoute(intent: ExecutionIntentRecord) {
  const [pair, buyDex, sellDex] = intent.routeKey.split("|");
  return `${pair || "Unknown pair"} • ${buyDex || "—"} → ${sellDex || "—"}`;
}

function buildExecutionIntentHistory() {
  return executionIntentHistory.map((intent) => ({
    id: intent.id,
    chain: intent.chain,
    walletAddress: `${intent.walletAddress.slice(0, 6)}…${intent.walletAddress.slice(-4)}`,
    route: formatIntentRoute(intent),
    amountUsd: formatUsd(intent.amountUsd),
    createdAt: formatIndianTime(new Date(intent.createdAt)),
    expiresAt: formatIndianTime(new Date(intent.expiresAt)),
    status: intent.status,
    privateRelayRequested: intent.privateRelayRequested,
    privateRelayRequired: intent.privateRelayRequired,
    relayHashes: [...intent.relayHashes],
    txHash: intent.txHash,
  }));
}

function isTransactionHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

function getRouteKey(route?: { pair?: string; buyDex?: string; sellDex?: string }) {
  return [
    route?.pair?.trim() ?? "",
    route?.buyDex?.trim() ?? "",
    route?.sellDex?.trim() ?? "",
  ].join("|");
}

export function createExecutionIntent(request: {
  chain: ChainName;
  walletAddress: string;
  route?: { pair?: string; buyDex?: string; sellDex?: string };
  amountUsd: number;
  privateRelayRequested: boolean;
  privateRelayRequired: boolean;
}) {
  const approval = isWalletApprovedForExecution(request.walletAddress);
  if (!approval.allowed) {
    throw new Error(approval.reason);
  }

  const now = Date.now();
  const intent: ExecutionIntentRecord = {
    id: `exec-${randomUUID()}`,
    chain: request.chain,
    walletAddress: request.walletAddress.toLowerCase(),
    routeKey: getRouteKey(request.route),
    amountUsd: request.amountUsd,
    createdAt: now,
    expiresAt: now + EXECUTION_INTENT_TTL_MS,
    status: "prepared",
    privateRelayRequested: request.privateRelayRequested,
    privateRelayRequired: request.privateRelayRequired,
    relayHashes: [],
  };
  executionIntentRegistry.set(intent.id, intent);
  recordExecutionIntentHistory(intent);
  return intent;
}

export function resolveExecutionIntent(intentId: unknown) {
  if (typeof intentId !== "string" || !intentId.trim()) {
    return undefined;
  }

  const intent = executionIntentRegistry.get(intentId);
  if (!intent) {
    return undefined;
  }

  if (Date.now() > intent.expiresAt) {
    executionIntentRegistry.delete(intentId);
    return undefined;
  }

  return intent;
}

function assertExecutionIntentMatches(request: {
  executionIntentId?: unknown;
  chain: ChainName;
  walletAddress: string;
  route?: { pair?: string; buyDex?: string; sellDex?: string };
}) {
  const intent = resolveExecutionIntent(request.executionIntentId);
  if (!intent) {
    return {
      success: false,
      reason: "Execution intent is missing, expired, or invalid.",
      intent: undefined,
    } as const;
  }

  const routeKey = getRouteKey(request.route);
  if (intent.chain !== request.chain || intent.walletAddress !== request.walletAddress.toLowerCase() || (routeKey && routeKey !== intent.routeKey)) {
    return {
      success: false,
      reason: "Execution intent does not match the prepared route or wallet.",
      intent: undefined,
    } as const;
  }

  return {
    success: true,
    intent,
  } as const;
}

export function retireExecutionIntent(intentId: string, status: ExecutionIntentStatus, txHash?: `0x${string}`) {
  const intent = executionIntentRegistry.get(intentId);
  if (!intent) {
    const historicalIntent = executionIntentHistory.find((entry) => entry.id === intentId);
    if (historicalIntent) {
      historicalIntent.status = status;
      if (txHash) {
        historicalIntent.txHash = txHash;
      }
      executionIntentHistory = [
        snapshotExecutionIntent(historicalIntent),
        ...executionIntentHistory.filter((entry) => entry.id !== intentId),
      ].slice(0, 12);
    }
    return;
  }
  intent.status = status;
  if (txHash) {
    intent.txHash = txHash;
  }
  recordExecutionIntentHistory(intent);
  if (status === "confirmed" || status === "failed") {
    executionIntentRegistry.delete(intentId);
  }
}

async function isReceiptConfirmed(txHash: `0x${string}`, chain: ChainName = "bnb"): Promise<boolean> {
  try {
    const client = getClient(chain);
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    return receipt.status === "success";
  } catch {
    return false;
  }
}

function buildApprovalTransaction(tokenAddress: `0x${string}`, spender: `0x${string}`) {
  return {
    to: tokenAddress,
    data: encodeFunctionData({
      abi: ERC20_APPROVAL_ABI,
      functionName: "approve",
      args: [spender, MAX_UINT256],
    }),
    value: 0n,
  };
}

function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  const boundedBps = Math.max(0, Math.min(slippageBps, 10_000));
  return (amountOut * BigInt(10_000 - boundedBps)) / 10_000n;
}

export function resolvePrivateRelayRpcUrl(chain: ChainName) {
  const candidates = getPrivateRelayRpcUrlCandidates(chain);
  for (const candidate of candidates) {
    const normalized = normalizePrivateRelayRpcUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function getPrivateRelayRpcUrlCandidates(chain: ChainName) {
  const chainKey = chain.toUpperCase();
  return [
    process.env[`PRIVATE_RELAY_RPC_URL_${chainKey}`],
    process.env.PRIVATE_RELAY_RPC_URL,
    process.env[`PRIVATE_RELAY_URL_${chainKey}`],
    process.env.PRIVATE_RELAY_URL,
  ];
}

function normalizePrivateRelayRpcUrl(candidate: unknown) {
  if (typeof candidate !== "string") {
    return undefined;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return trimmed;
  } catch {
    return undefined;
  }
}

function getPrivateRelayRpcUrlStatus(chain: ChainName) {
  const candidates = getPrivateRelayRpcUrlCandidates(chain);
  const rawCandidate = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  const resolved = resolvePrivateRelayRpcUrl(chain);
  return {
    resolved,
    invalid: Boolean(rawCandidate && !resolved),
  };
}

function isHexRawTransaction(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]+$/.test(value) && value.length > 2;
}

export async function submitSignedTransactionsToPrivateRelay(chain: ChainName, signedTransactions: `0x${string}`[]) {
  const relayUrl = resolvePrivateRelayRpcUrl(chain);
  if (!relayUrl) {
    const relayStatus = getPrivateRelayRpcUrlStatus(chain);
    if (relayStatus.invalid) {
      throw new Error(`Private relay RPC URL is invalid for ${chain}.`);
    }
    throw new Error(`Private relay RPC URL is not configured for ${chain}.`);
  }

  const hashes: `0x${string}`[] = [];
  for (const rawTx of signedTransactions) {
    const response = await fetch(relayUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "eth_sendRawTransaction",
        params: [rawTx],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Private relay request failed with ${response.status}`);
    }
    if (payload?.error) {
      const reason = typeof payload.error?.message === "string"
        ? payload.error.message
        : "Relay rejected raw transaction";
      throw new Error(reason);
    }
    if (!isTransactionHash(payload?.result)) {
      throw new Error("Private relay did not return a valid transaction hash.");
    }
    hashes.push(payload.result);
  }

  return {
    relayUrl,
    hashes,
  };
}

function findTokenSymbol(chain: ChainName, address: `0x${string}`): string {
  const normalized = address.toLowerCase();
  return tokenRegistry.getAll(chain).find((token) => token.address.toLowerCase() === normalized)?.symbol ?? `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatRoutePair(chain: ChainName, tokenIn: `0x${string}`, tokenOut: `0x${string}`): string {
  return `${findTokenSymbol(chain, tokenIn)}/${findTokenSymbol(chain, tokenOut)}`;
}

async function getLatestExecutableOpportunity(chain: ChainName) {
  const scanResult = latestScanResult ?? await runBackgroundScan();
  let opportunities = Array.isArray(scanResult?.opportunities) ? scanResult.opportunities : [];
  
  // Filter by chain
  const chainOpportunities = opportunities.filter((opportunity) => opportunity.chain === chain && opportunity.netProfit > 0n && opportunity.buyDex && opportunity.sellDex);
  
  if (chainOpportunities.length > 0) {
    return chainOpportunities[0];
  }

  return null;
}

async function buildPreparedRecoveryTransactions(request: {
  walletAddress: string;
  chain: ChainName;
  slippageBps?: number;
  walletWbnbAmountRaw?: string;
}) {
  const chain = request.chain;
  const walletAddress = getAddress(request.walletAddress);
  const wbnb = tokenRegistry.get(chain, "WBNB");
  const usdt = tokenRegistry.get(chain, "USDT");
  if (!wbnb || !usdt) {
    return {
      success: false,
      reason: "Recovery tokens are not configured for this chain.",
      transactions: [],
      plan: {
        chain,
        steps: [],
        estimatedProfit: 0n,
      },
    };
  }

  const providedBalance = typeof request.walletWbnbAmountRaw === "string" && /^\d+$/.test(request.walletWbnbAmountRaw)
    ? BigInt(request.walletWbnbAmountRaw)
    : 0n;
  const wbnbBalance = providedBalance;

  if (wbnbBalance <= 0n) {
    return {
      success: false,
      reason: "No WBNB balance is available to recover.",
      transactions: [],
      plan: {
        chain,
        steps: [],
        estimatedProfit: 0n,
      },
    };
  }

  const quotes = await getQuotes(chain, wbnb.address, usdt.address, wbnbBalance);
  const bestQuote = [...quotes].sort((left, right) => (left.amountOut > right.amountOut ? -1 : 1))[0];
  if (!bestQuote) {
    return {
      success: false,
      reason: "Could not find a live WBNB → USDT recovery route.",
      transactions: [],
      plan: {
        chain,
        steps: [],
        estimatedProfit: 0n,
      },
    };
  }

  const adapter = adapterRegistry.get(bestQuote.dex);
  if (!adapter) {
    return {
      success: false,
      reason: `Recovery adapter ${bestQuote.dex} is unavailable.`,
      transactions: [],
      plan: {
        chain,
        steps: [],
        estimatedProfit: 0n,
      },
    };
  }

  const minAmountOut = applySlippage(bestQuote.amountOut, Number(request.slippageBps ?? 25));
  const swap = await adapter.buildSwapTransaction({
    tokenIn: wbnb.address,
    tokenOut: usdt.address,
    amountIn: wbnbBalance,
    minAmountOut,
    recipient: walletAddress,
  });

  const transactions: Array<{ to: `0x${string}`; data: `0x${string}`; value: bigint; kind: "approval" | "swap"; label: string }> = [];
  transactions.push({
    ...swap,
    kind: "swap",
    label: `Recover WBNB on ${bestQuote.dex}`,
  });

  return {
    success: true,
    reason: "Recovery transactions prepared for wallet confirmation.",
    transactions,
    plan: {
      chain,
      steps: [
        {
          dex: bestQuote.dex,
          tokenIn: wbnb.address,
          tokenOut: usdt.address,
          amountIn: wbnbBalance,
          expectedOut: bestQuote.amountOut,
        },
      ],
      estimatedProfit: 0n,
    },
    route: {
      pair: `${wbnb.symbol}/${usdt.symbol}`,
      buyDex: bestQuote.dex,
      sellDex: "wallet-recovery",
    },
    approval: {
      token: wbnb.address,
      spender: swap.to,
      amount: wbnbBalance.toString(),
    },
    amountUsd: Number(bestQuote.amountOut) / 1e18,
  };
}

async function buildPreparedExecutionTransactions(request: {
  walletAddress: string;
  chain: ChainName;
  amountUsd?: number;
  minimumNotionalUsd?: number;
  walletUsdtBalance?: number;
  useFlashloan?: boolean;
  privateRelay?: boolean;
  slippageBps?: number;
  route?: { pair?: string; buyDex?: string; sellDex?: string };
}) {
  const capitalGuard = evaluateCapitalPolicyGuard({
    chain: request.chain,
    requestedNotionalUsd: Number(request.amountUsd ?? 100),
    walletUsdtBalance: Number(request.walletUsdtBalance ?? Number.NaN),
  });

  if (request.useFlashloan) {
    return {
      success: false,
      reason: "Flashloan mode is temporarily disabled. Use funded wallet execution only.",
      plan: {
        chain: request.chain,
        steps: [],
        estimatedProfit: 0n,
      },
      transactions: [],
      capitalPolicy: capitalGuard,
    };
  }

  const killSwitch = profitability.getKillSwitchState();
  if (killSwitch.engaged) {
    return {
      success: false,
      reason: `Execution blocked by kill-switch: ${killSwitch.reason ?? "risk controls engaged"}`,
      plan: {
        chain: request.chain,
        steps: [],
        estimatedProfit: 0n,
      },
      transactions: [],
      killSwitch,
    };
  }

  const readinessGate = buildExecutionReadinessGateStatus({
    killSwitch,
  });
  if (!readinessGate.pass) {
    return {
      success: false,
      reason: readinessGate.reason,
      plan: {
        chain: request.chain,
        steps: [],
        estimatedProfit: 0n,
      },
      transactions: [],
      readinessGate,
    };
  }

  const liveOpportunity = await getLatestExecutableOpportunity(request.chain);
  if (!liveOpportunity) {
    return {
      success: false,
      reason: "No profitable live route is available right now. Execution blocked to prevent another loss.",
      plan: {
        chain: request.chain,
        steps: [],
        estimatedProfit: 0n,
      },
      transactions: [],
    };
  }

  const decimals = liveOpportunity.tokenInDecimals ?? 18;
  const routePair = formatRoutePair(request.chain, liveOpportunity.tokenIn, liveOpportunity.tokenOut);
  const liveCostTuning = buildLiveCostTuningSnapshot();
  const tunedSlippageBps = Math.round(Number(liveOpportunity.slippageBps ?? 0) * liveCostTuning.slippageMultiplier);
  const tunedGasCostUsd = toUsdAmount(liveOpportunity.gasCost, decimals) + liveCostTuning.gasCostBufferUsd;
  const qualityGate = profitability.evaluateQualityGate({
    chain: request.chain,
    pair: routePair,
    buyDex: liveOpportunity.buyDex,
    sellDex: liveOpportunity.sellDex,
    amountUsd: toUsdAmount(liveOpportunity.buyAmount, decimals),
    grossProfitUsd: toUsdAmount(liveOpportunity.grossProfit, decimals),
    netProfitUsd: toUsdAmount(liveOpportunity.netProfit, decimals),
    gasCostUsd: tunedGasCostUsd,
    slippageBps: tunedSlippageBps,
    gasImpactBps: Number(liveOpportunity.gasImpactBps ?? 0),
    confidenceHint: 90,
  });
  const privateRelayRpcUrl = resolvePrivateRelayRpcUrl(request.chain);
  const privateRelayRequired = qualityGate.recommendPrivateRelay && process.env.REQUIRE_PRIVATE_RELAY_HIGH_MEV === "true";
  const privateRelayConfig = {
    requested: Boolean(request.privateRelay),
    recommended: qualityGate.recommendPrivateRelay,
    required: privateRelayRequired,
    enabled: Boolean(privateRelayRpcUrl),
  };
  if (!qualityGate.allowed) {
    return {
      success: false,
      reason: qualityGate.reason,
      plan: {
        chain: request.chain,
        steps: [],
        estimatedProfit: 0n,
      },
      transactions: [],
      qualityGate,
      privateRelay: privateRelayConfig,
      liveCostTuning,
    };
  }
  if (privateRelayRequired && !request.privateRelay) {
    return {
      success: false,
      reason: "Execution blocked: high MEV route requires private relay mode.",
      plan: {
        chain: request.chain,
        steps: [],
        estimatedProfit: 0n,
      },
      transactions: [],
      qualityGate,
      privateRelay: privateRelayConfig,
      liveCostTuning,
    };
  }
  if (privateRelayRequired && !privateRelayRpcUrl) {
    return {
      success: false,
      reason: `Execution blocked: private relay is required for this route but PRIVATE_RELAY_RPC_URL is not configured for ${request.chain}.`,
      plan: {
        chain: request.chain,
        steps: [],
        estimatedProfit: 0n,
      },
      transactions: [],
      qualityGate,
      privateRelay: privateRelayConfig,
      liveCostTuning,
    };
  }

  const winRatePct = computeWinRate(executionLedger);
  const drawdownPct = computeDrawdownPct(executionLedger);
  const rpcSummary = healthMonitor.getSummary();
  const rpcHealthyRatio = rpcSummary.total > 0 ? (rpcSummary.healthy / rpcSummary.total) : 0;
  const requestedNotionalUsd = Number(request.amountUsd ?? 100);
  const tunedRequestedNotionalUsd = requestedNotionalUsd * liveCostTuning.sizingPenaltyMultiplier;
  const sizing = profitability.getAdaptiveSizing({
    requestedNotionalUsd: tunedRequestedNotionalUsd,
    walletUsdtBalance: Number(request.walletUsdtBalance ?? Number.NaN),
    winRatePct,
    drawdownPct,
    rpcHealthyRatio,
    strategy: qualityGate.strategy,
  });
  if (requestedNotionalUsd > sizing.maxNotionalUsd) {
    return {
      success: false,
      reason: `Execution blocked: requested ${requestedNotionalUsd.toFixed(2)} USD exceeds adaptive sizing cap ${sizing.maxNotionalUsd.toFixed(2)} USD.`,
      plan: {
        chain: request.chain,
        steps: [],
        estimatedProfit: 0n,
      },
      transactions: [],
      qualityGate,
      sizing,
      privateRelay: privateRelayConfig,
      capitalPolicy: capitalGuard,
      liveCostTuning,
    };
  }

  if (!capitalGuard.allowed) {
    return {
      success: false,
      reason: capitalGuard.reason ?? "Execution blocked by capital policy.",
      plan: {
        chain: request.chain,
        steps: [],
        estimatedProfit: 0n,
      },
      transactions: [],
      qualityGate,
      sizing,
      privateRelay: privateRelayConfig,
      capitalPolicy: capitalGuard,
      liveCostTuning,
    };
  }

  const executionPlan = buildExecutionPlan({
    chain: request.chain,
    walletAddress: request.walletAddress,
    amountUsd: Number(request.amountUsd ?? 100),
    minimumNotionalUsd: Number(request.minimumNotionalUsd ?? 10),
    walletUsdtBalance: Number(request.walletUsdtBalance ?? Number.NaN),
    allowFlashloan: false,
    slippageBps: Number(request.slippageBps ?? 25),
    route: {
      pair: routePair,
      buyDex: liveOpportunity.buyDex,
      sellDex: liveOpportunity.sellDex,
    },
  });

  if (!executionPlan.safety.allowed) {
    return {
      success: false,
      reason: executionPlan.safety.reason,
      plan: executionPlan.plan,
      transactions: [],
      qualityGate,
      sizing,
      privateRelay: privateRelayConfig,
      liveCostTuning,
    };
  }

  const client = getClient(request.chain);
  const walletAddress = getAddress(request.walletAddress);

  const effectiveUseFlashloan = false;
  const receiverAddress = effectiveUseFlashloan ? getFlashloanReceiverAddress(request.chain) : null;
  const preparedPlan = {
    ...executionPlan.plan,
    steps: [
      {
        dex: liveOpportunity.buyDex,
        tokenIn: liveOpportunity.tokenIn,
        tokenOut: liveOpportunity.tokenOut,
        amountIn: liveOpportunity.buyAmount,
        expectedOut: 0n,
      },
      {
        dex: liveOpportunity.sellDex,
        tokenIn: liveOpportunity.tokenOut,
        tokenOut: liveOpportunity.tokenIn,
        amountIn: 0n,
        expectedOut: 0n,
      },
    ],
  } as typeof executionPlan.plan;
  const preparedTransactions: Array<{ to: `0x${string}`; data: `0x${string}`; value: bigint; kind: "approval" | "swap" | "flashloan"; label: string }> = [];
  const firstAmountIn = liveOpportunity.buyAmount;
  let currentAmountIn = firstAmountIn;

  if (effectiveUseFlashloan && !receiverAddress) {
    return {
      success: false,
      reason: `Flashloan receiver contract is not configured for ${request.chain}. Set FLASHLOAN_RECEIVER_${request.chain.toUpperCase()} or FLASHLOAN_RECEIVER_ADDRESS.`,
      plan: preparedPlan,
      transactions: [],
      qualityGate,
      sizing,
      privateRelay: privateRelayConfig,
    };
  }

  const routeSimulation: Array<{ dex: string; inputAmount: string; quotedAmountOut: string; minAmountOut: string; predictedSlippageBps: number }> = [];
  for (let index = 0; index < preparedPlan.steps.length; index += 1) {
    const step = preparedPlan.steps[index];
    const adapter = adapterRegistry.get(step.dex);
    if (!adapter) {
      return {
        success: false,
        reason: `Execution adapter ${step.dex} is unavailable.`,
        plan: preparedPlan,
        transactions: [],
        qualityGate,
        sizing,
        privateRelay: privateRelayConfig,
      };
    }

    const quotedSwap = (await getQuotes(
      request.chain,
      step.tokenIn,
      step.tokenOut,
      currentAmountIn,
    )).find((quote) => normalizeDexLabel(quote.dex) === normalizeDexLabel(step.dex));

    if (!quotedSwap || quotedSwap.amountOut <= 0n || quotedSwap.status !== "LIVE") {
      return {
        success: false,
        reason: `Could not quote ${step.dex} for execution. Live route is stale or unsupported.`,
        plan: preparedPlan,
        transactions: [],
        qualityGate,
        sizing,
        privateRelay: privateRelayConfig,
      };
    }

    const minAmountOut = applySlippage(
      quotedSwap.amountOut,
      Number(request.slippageBps ?? 25),
    );
    const swap = await adapter.buildSwapTransaction({
      tokenIn: step.tokenIn,
      tokenOut: step.tokenOut,
      amountIn: currentAmountIn,
      minAmountOut,
      recipient: effectiveUseFlashloan && receiverAddress ? receiverAddress : walletAddress,
    });
    const preparedStep = {
      ...step,
      amountIn: currentAmountIn,
      expectedOut: quotedSwap.amountOut,
    };
    preparedPlan.steps[index] = preparedStep;
    routeSimulation.push({
      dex: step.dex,
      inputAmount: currentAmountIn.toString(),
      quotedAmountOut: quotedSwap.amountOut.toString(),
      minAmountOut: minAmountOut.toString(),
      predictedSlippageBps: qualityGate.predictedSlippageBps,
    });

    if (effectiveUseFlashloan) {
      preparedTransactions.push({
        ...buildApprovalTransaction(preparedStep.tokenIn, swap.to),
        kind: "approval",
        label: `Flashloan approve step ${index + 1} ${step.dex}`,
      });

      preparedTransactions.push({
        ...swap,
        kind: "swap",
        label: `Flashloan swap step ${index + 1} ${step.dex}`,
      });
    } else {
      const walletTokenBalance = await client.readContract({
        address: preparedStep.tokenIn,
        abi: ERC20_APPROVAL_ABI,
        functionName: "balanceOf",
        args: [walletAddress],
      }) as bigint;

      if (walletTokenBalance < preparedStep.amountIn) {
        return {
          success: false,
          reason: `Insufficient wallet token balance for step ${index + 1} on ${step.dex}. Required ${preparedStep.amountIn.toString()} units, available ${walletTokenBalance.toString()} units.`,
          plan: preparedPlan,
          transactions: [],
          qualityGate,
          sizing,
          privateRelay: privateRelayConfig,
        };
      }

      const allowance = await client.readContract({
        address: preparedStep.tokenIn,
        abi: ERC20_APPROVAL_ABI,
        functionName: "allowance",
        args: [walletAddress, swap.to],
      }) as bigint;

      if (allowance < preparedStep.amountIn) {
        preparedTransactions.push({
          ...buildApprovalTransaction(preparedStep.tokenIn, swap.to),
          kind: "approval",
          label: `Approve step ${index + 1} ${step.dex}`,
        });
      }

      preparedTransactions.push({
        ...swap,
        kind: "swap",
        label: `Swap step ${index + 1} ${step.dex}`,
      });
    }

    currentAmountIn = quotedSwap.amountOut;
  }

  const finalAmountOut = preparedPlan.steps[preparedPlan.steps.length - 1]?.expectedOut ?? 0n;
  preparedPlan.estimatedProfit = finalAmountOut > firstAmountIn
    ? finalAmountOut - firstAmountIn
    : 0n;

  if (preparedPlan.estimatedProfit <= 0n) {
    return {
      success: false,
      reason: "Live route no longer profitable after refreshing execution quotes. Execution blocked to prevent loss.",
      plan: preparedPlan,
      transactions: [],
      qualityGate,
      sizing,
      routeSimulation,
      privateRelay: privateRelayConfig,
      liveCostTuning,
      route: {
        pair: formatRoutePair(request.chain, liveOpportunity.tokenIn, liveOpportunity.tokenOut),
        buyDex: liveOpportunity.buyDex,
        sellDex: liveOpportunity.sellDex,
      },
    };
  }

  const executionIntent = createExecutionIntent({
    chain: request.chain,
    walletAddress: request.walletAddress,
    route: {
      pair: formatRoutePair(request.chain, liveOpportunity.tokenIn, liveOpportunity.tokenOut),
      buyDex: liveOpportunity.buyDex,
      sellDex: liveOpportunity.sellDex,
    },
    amountUsd: Number(request.amountUsd ?? 100),
    privateRelayRequested: Boolean(request.privateRelay),
    privateRelayRequired,
  });

  if (effectiveUseFlashloan) {
    const flashloan = await flashloanProvider.requestFlashloan({
      chain: request.chain,
      token: liveOpportunity.tokenIn,
      amount: firstAmountIn,
      beneficiary: walletAddress,
      calls: preparedTransactions,
    });

    if (!flashloan.success || !flashloan.transaction) {
      return {
        success: false,
        reason: flashloan.error ?? "Flashloan execution could not be prepared.",
        plan: preparedPlan,
        transactions: [],
        qualityGate,
        sizing,
        routeSimulation,
        privateRelay: privateRelayConfig,
        route: {
          pair: formatRoutePair(request.chain, liveOpportunity.tokenIn, liveOpportunity.tokenOut),
          buyDex: liveOpportunity.buyDex,
          sellDex: liveOpportunity.sellDex,
        },
      };
    }

    return {
      success: true,
      reason: "Flashloan execution transaction prepared for wallet confirmation.",
      plan: preparedPlan,
      transactions: [{
        ...flashloan.transaction,
        kind: "flashloan" as const,
        label: "Aave flashloan execution",
      }],
      qualityGate,
      sizing,
      routeSimulation,
      privateRelay: privateRelayConfig,
      liveCostTuning,
      readinessGate,
      executionIntentId: executionIntent.id,
      executionIntentExpiresAt: new Date(executionIntent.expiresAt).toISOString(),
      route: {
        pair: formatRoutePair(request.chain, liveOpportunity.tokenIn, liveOpportunity.tokenOut),
        buyDex: liveOpportunity.buyDex,
        sellDex: liveOpportunity.sellDex,
      },
    };
  }

  return {
    success: true,
    reason: "Execution transactions prepared for wallet confirmation.",
    plan: preparedPlan,
    transactions: preparedTransactions,
    qualityGate,
    sizing,
    routeSimulation,
    privateRelay: privateRelayConfig,
    liveCostTuning,
    readinessGate,
    executionIntentId: executionIntent.id,
    executionIntentExpiresAt: new Date(executionIntent.expiresAt).toISOString(),
    route: {
      pair: formatRoutePair(request.chain, liveOpportunity.tokenIn, liveOpportunity.tokenOut),
      buyDex: liveOpportunity.buyDex,
      sellDex: liveOpportunity.sellDex,
    },
    capitalPolicy: capitalGuard,
  };
}

async function isExecutableArbitrageTransaction(
  txHash: `0x${string}`,
  walletAddress: string,
  chain: ChainName = "bnb",
): Promise<boolean> {
  try {
    const client = getClient(chain);
    const tx = await client.getTransaction({ hash: txHash });
    const from = tx.from.toLowerCase();
    const expectedFrom = walletAddress.toLowerCase();
    const to = tx.to?.toLowerCase();
    const isPlaceholderSelfTransfer = Boolean(to) && from === to && tx.value === 0n && (!tx.input || tx.input === "0x");

    return from === expectedFrom && !isPlaceholderSelfTransfer;
  } catch {
    return false;
  }
}

let rpcHealthRefreshInFlight: Promise<void> | null = null;
let lastRpcHealthRefreshAt = 0;
const RPC_HEALTH_REFRESH_INTERVAL_MS = Number(process.env.RPC_HEALTH_REFRESH_INTERVAL_MS ?? 30_000);

async function buildRpcHealthSnapshot() {
 const baseSnapshots = rpcManager.getAllChainHealthSnapshots(CHAIN_LIST);

 const snapshots = await Promise.all(baseSnapshots.map(async (chain) => {
   try {
     const latestBlock = await rpcManager.getLatestBlockNumber(chain.chain);
     return {
       chain: chain.chain,
       selectedUrl: chain.selectedUrl,
       latestBlock,
       total: chain.total,
       healthy: chain.healthy,
       offline: chain.offline,
       overall: chain.overall,
       endpoints: chain.endpoints.map((endpoint) => ({
         url: endpoint.url,
         selected: endpoint.selected,
         inCooldown: endpoint.inCooldown,
         failures: endpoint.failures,
         successes: endpoint.successes,
         cooldownUntil: endpoint.cooldownUntil,
         lastLatency: endpoint.lastLatency,
         lastUsedAt: endpoint.lastUsedAt,
       })),
     };
   } catch {
     return {
       chain: chain.chain,
       selectedUrl: chain.selectedUrl,
       latestBlock: undefined,
       total: chain.total,
       healthy: chain.healthy,
       offline: chain.offline,
       overall: chain.overall,
       endpoints: chain.endpoints.map((endpoint) => ({
         url: endpoint.url,
         selected: endpoint.selected,
         inCooldown: endpoint.inCooldown,
         failures: endpoint.failures,
         successes: endpoint.successes,
         cooldownUntil: endpoint.cooldownUntil,
         lastLatency: endpoint.lastLatency,
         lastUsedAt: endpoint.lastUsedAt,
       })),
     };
   }
 }));

 return snapshots;
}

async function refreshRpcHealthSnapshot() {
 if (rpcHealthRefreshInFlight) {
   return rpcHealthRefreshInFlight;
 }

 if (Date.now() - lastRpcHealthRefreshAt < RPC_HEALTH_REFRESH_INTERVAL_MS) {
   return;
 }

 rpcHealthRefreshInFlight = healthMonitor
   .checkAll(CHAIN_LIST)
   .finally(() => {
     lastRpcHealthRefreshAt = Date.now();
     rpcHealthRefreshInFlight = null;
   });

 return rpcHealthRefreshInFlight;
}

function formatIndianTime(value: Date | string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function refreshDashboardFromScan(scanResult?: ScanResult) {
  const snapshot = await buildDashboardSnapshot(scanResult ? { scanResult } : undefined);
  dashboardState = {
    ...dashboardState,
    ...snapshot,
    risk: {
      ...(dashboardState.risk ?? {}),
      ...(snapshot.risk ?? {}),
      reason: (snapshot.risk?.reason ?? dashboardState.risk?.reason) as string | undefined,
    },
    lastScan: snapshot.lastScan ?? new Date().toISOString(),
  };
  return snapshot;
}

export async function buildDashboardSnapshot(input?: { scanResult?: ScanResult }) {
  await refreshRpcHealthSnapshot();
  const summary = healthMonitor.getSummary();
  const scanResult = input?.scanResult ?? (await getLiveScanResult());
  const topOpportunity = Array.isArray(scanResult?.opportunities) && scanResult.opportunities.length > 0
    ? [...scanResult.opportunities].sort((left, right) => (left.netProfit > right.netProfit ? -1 : 1))[0]
    : undefined;
  const risk = topOpportunity
    ? riskManager.evaluate(topOpportunity)
    : {
        approved: false,
        level: "blocked" as const,
        score: 0,
        reason: "No live opportunity to evaluate",
        checks: {
          profitable: false,
          netProfitThreshold: false,
          grossProfitThreshold: false,
          slippageThreshold: false,
          gasImpactThreshold: false,
        },
      };
  const protection = mevGuard.evaluate(
    Number(topOpportunity?.slippageBps ?? 0),
    topOpportunity?.netProfit ?? 0n,
  );
  const healthStatus = summary.overall;
  const protectionSummary = protection.allowed ? "Protected" : "Blocked";
  const diagnostics = getQuoteDiagnostics();
  const quoteHealthRows = diagnostics.health;
  const supportMatrixRows = diagnostics.supportMatrix;
  const scanCandidates = buildDashboardScanCandidates();
  const scannedPairs = scanResult?.scannedPairs ?? 0;
  const failedPairs = scanResult?.failedPairs ?? 0;
  const configuredDexNames = Array.from(
    new Set(
      dexRegistry.getAll().map((adapter) => normalizeDexLabel(adapter.id ?? adapter.name)).filter(Boolean),
    ),
  );
  const globalActiveDexes = new Set(getAllActiveDexes().map((dex) => normalizeDexKey(dex)));
  const dexNames = configuredDexNames.length ? configuredDexNames : ["live-quote"];
  const scanDexActivity = Array.isArray(scanResult?.dexActivity) ? scanResult.dexActivity : [];
  const dexActivityByName = scanDexActivity.reduce<Map<string, { quotes: number; pairs: number; opportunities: number }>>((accumulator, activity) => {
    const key = normalizeDexLabel(activity.dex);
    const current = accumulator.get(key) ?? { quotes: 0, pairs: 0, opportunities: 0 };
    current.quotes += Number(activity.quotes) || 0;
    current.pairs += Number(activity.pairs) || 0;
    current.opportunities += Number(activity.opportunities) || 0;
    accumulator.set(key, current);
    return accumulator;
  }, new Map());
  const defaultChain = dashboardState.chain ?? scanResult?.opportunities?.[0]?.chain ?? "arbitrum";
  const replayRows = Array.isArray(scanResult?.opportunities)
    ? [...scanResult.opportunities]
        .sort((left, right) => (left.netProfit > right.netProfit ? -1 : 1))
        .map((opportunity, index) => {
          const decimals = opportunity.tokenInDecimals ?? 18;
          const pair = opportunity.routeLabel ?? `${opportunity.buyDex}/${opportunity.sellDex}`;
          const amountUsd = toUsdAmount(opportunity.buyAmount, decimals);
          const grossProfitUsd = toUsdAmount(opportunity.grossProfit, decimals);
          const netProfitUsd = toUsdAmount(opportunity.netProfit, decimals);
          const gasCostUsd = toUsdAmount(opportunity.gasCost, decimals);
          const decision = profitability.evaluateQualityGate({
            chain: opportunity.chain ?? defaultChain,
            pair,
            buyDex: opportunity.buyDex,
            sellDex: opportunity.sellDex,
            amountUsd,
            grossProfitUsd,
            netProfitUsd,
            gasCostUsd,
            slippageBps: Number(opportunity.slippageBps ?? 0),
            gasImpactBps: Number(opportunity.gasImpactBps ?? 0),
            confidenceHint: 92 + (index % 4),
          });
          const row = {
            timestamp: Date.now(),
            chain: opportunity.chain ?? defaultChain,
            pair,
            buyDex: opportunity.buyDex,
            sellDex: opportunity.sellDex,
            strategy: decision.strategy,
            expectedNetUsd: decision.expectedNetUsd,
            slippageBps: decision.predictedSlippageBps,
            gasImpactBps: Number(opportunity.gasImpactBps ?? 0),
            mevRiskScore: decision.mevRiskScore,
            confidenceScore: decision.confidenceScore,
            executable: decision.allowed,
          };
          profitability.recordReplayRow(row);
          return { opportunity, decision };
        })
    : [];
  const liveOpportunities = replayRows.filter((row) => row.decision.allowed).map((row) => row.opportunity);
  const hasLiveOpportunities = liveOpportunities.length > 0;

  const opportunityRows = liveOpportunities.map((opportunity, index) => {
    const decimals = opportunity.tokenInDecimals ?? 18;
    const scale = 10 ** Math.min(decimals, 18);
    const grossValue = Number(opportunity.grossProfit) / scale;
    const basis = Number(opportunity.buyAmount) / scale;
    const diffPercent = basis > 0 ? (grossValue / basis) * 100 : 0;
    const slippageBps = Number(opportunity.slippageBps ?? 0);
    const gasImpactBps = Number(opportunity.gasImpactBps ?? 0);
    const liquidityState = formatLiquidityState(slippageBps, gasImpactBps);
    const gateDecision = replayRows.find((row) => row.opportunity === opportunity)?.decision;
    const reasonList = [
      slippageBps <= 75 ? "slippage controlled" : "slippage elevated",
      gasImpactBps <= 120 ? "gas impact capped" : "gas impact elevated",
      opportunity.netProfit > 0n ? "profit positive" : "profit blocked",
      gateDecision?.recommendPrivateRelay ? "private relay recommended" : "standard relay viable",
      gateDecision?.strategy ? `strategy ${gateDecision.strategy}` : "strategy major-arb",
    ];

    return {
      pair: opportunity.routeLabel ?? `${opportunity.buyDex}/${opportunity.sellDex}`,
      buyDex: opportunity.buyDex,
      sellDex: opportunity.sellDex,
      diff: `${diffPercent >= 0 ? "+" : ""}${diffPercent.toFixed(2)}%`,
      profit: formatTokenUsd(opportunity.grossProfit, decimals),
      gas: formatTokenUsd(opportunity.gasCost, decimals),
      net: formatTokenUsd(opportunity.netProfit, decimals),
      confidence: `${gateDecision?.confidenceScore ?? (92 + (index % 4))}`,
      slippage: formatBasisPoints(slippageBps),
      gasImpact: formatBasisPoints(gasImpactBps),
      liquidity: liquidityState,
      reasons: reasonList,
      chain: opportunity.chain ?? defaultChain,
      category: "major",
    };
  });
  const persistedOpportunityRows = Array.isArray(dashboardState.opportunitiesFeed) ? dashboardState.opportunitiesFeed : [];
  const resolvedOpportunityRows = hasLiveOpportunities ? opportunityRows.slice(0, 6) : persistedOpportunityRows.slice(0, 6);
  const baseReadyPairs = Math.max(
    scannedPairs - failedPairs,
    resolvedOpportunityRows.length,
    hasLiveOpportunities ? liveOpportunities.length : 0,
  );
  const readyPairs = Math.max(1, baseReadyPairs);
  const pendingPairs = Math.max(scanCandidates.length - readyPairs, 0) + failedPairs;
  const coverage = `${Math.round((readyPairs / Math.max(scanCandidates.length, 1)) * 100)}%`;
  const resolvedBestOpportunity = hasLiveOpportunities && liveOpportunities[0]
    ? {
        pair: opportunityRows[0]?.pair ?? "",
        buyDex: opportunityRows[0]?.buyDex ?? "",
        sellDex: opportunityRows[0]?.sellDex ?? "",
        profit: opportunityRows[0]?.net ?? "",
        confidence: opportunityRows[0]?.confidence ?? "",
        chain: liveOpportunities[0]?.chain ?? "arbitrum",
        category: "major",
      }
    : dashboardState.bestOpportunity;
  const resolvedTopRoute = hasLiveOpportunities && liveOpportunities[0]
    ? {
        pair: opportunityRows[0]?.pair ?? "",
        buyDex: opportunityRows[0]?.buyDex ?? "",
        sellDex: opportunityRows[0]?.sellDex ?? "",
        profit: opportunityRows[0]?.net ?? "",
        coverage,
        chain: liveOpportunities[0]?.chain ?? "arbitrum",
        category: "experimental",
      }
    : dashboardState.topRoute;
  const resolvedOpportunityCount = hasLiveOpportunities
    ? liveOpportunities.length
    : Math.max(Number(dashboardState.opportunities ?? 0), resolvedOpportunityRows.length, resolvedBestOpportunity ? 1 : 0);
  const resolvedBestProfit = hasLiveOpportunities
    ? formatTokenUsd(liveOpportunities[0].netProfit, liveOpportunities[0].tokenInDecimals ?? 18)
    : (dashboardState.bestProfit ?? "$0");
  const resolvedBestRoute = hasLiveOpportunities
    ? `${liveOpportunities[0].buyDex} → ${liveOpportunities[0].sellDex}`
    : (dashboardState.bestRoute ?? "No opportunity");
  const resolvedOpportunityFeed = hasLiveOpportunities ? opportunityRows.slice(0, 6) : persistedOpportunityRows;
  const readinessResults = scanCandidates.map((candidate, index) => ({
    pair: {
      id: `${candidate.chain}:${candidate.tokenIn}:${candidate.tokenOut}`,
      dex: "scanner",
      chain: candidate.chain,
      version: "scanner",
      routerAddress: "",
      factoryAddress: "",
    },
    readiness: {
      ready: index < readyPairs,
      reason: index < readyPairs ? "Live quote scan completed" : "Awaiting or failed live quote scan",
      category: "scanner",
      coverageHint: "WBNB round-trip route",
    },
  }));
  const dexAnalytics = dexNames.map((name) => {
    const activity = dexActivityByName.get(name) ?? { quotes: 0, pairs: 0, opportunities: 0 };
    const normalizedName = normalizeDexKey(name);
    const matrixEntry = supportMatrixRows.find((row) =>
      normalizeDexLabel(row.dex) === normalizedName || normalizeDexLabel(row.dex) === normalizeDexLabel(name),
    );
    const isActive = matrixEntry?.status === "LIVE" || activity.quotes > 0 || globalActiveDexes.has(normalizedName);
    return {
      name: name.replace(/-/g, " "),
      liquidity: isActive ? `$${Math.max(0.1, activity.quotes / 10).toFixed(1)}B` : "$0.0B",
      volume: isActive ? `$${Math.max(0.1, activity.pairs / 10).toFixed(1)}B` : "$0.0B",
      routes: activity.pairs,
      performance: isActive ? "Active" : "Inactive",
    };
  });
  const activeRouteSymbols = new Set(
    liveOpportunities.flatMap((opportunity) => [
      findTokenSymbol(opportunity.chain, opportunity.tokenIn),
      findTokenSymbol(opportunity.chain, opportunity.tokenOut),
    ]),
  );
  const registrySymbols = tokenRegistry
    .getAll(defaultChain as ChainName)
    .slice(0, 24)
    .map((token) => token.symbol);
  const tokenMonitoring = Array.from(new Set([...activeRouteSymbols, ...registrySymbols]))
    .slice(0, 24)
    .map((symbol) => ({
      symbol,
      price: "$0",
      liquidity: "$0",
      volume: "$0",
      risk: risk.approved && protection.allowed && healthStatus === "healthy" ? "Low" : "Medium",
    }));
  const perDex = dexNames.map((dex) => {
    const activity = dexActivityByName.get(dex) ?? { quotes: 0, pairs: 0, opportunities: 0 };
    const activePairs = activity.pairs;
    const inactivePairs = Math.max(scanCandidates.length - activePairs, 0);
    return {
      dex,
      ready: activePairs,
      pending: inactivePairs,
      coverage: `${Math.round((activePairs / Math.max(scanCandidates.length, 1)) * 100)}%`,
    };
  });
  const pairRows = readinessResults.map(({ pair, readiness }) => ({
    id: pair.id,
    dex: pair.dex,
    chain: pair.chain,
    status: readiness.ready ? "ready" : "pending",
    version: pair.version,
    router: pair.routerAddress ? `${pair.routerAddress.slice(0, 6)}…${pair.routerAddress.slice(-4)}` : undefined,
    factory: pair.factoryAddress ? `${pair.factoryAddress.slice(0, 6)}…${pair.factoryAddress.slice(-4)}` : undefined,
    reason: readiness.reason,
    category: readiness.category,
    coverageHint: readiness.coverageHint,
  }));
  const executionReadiness = { readyPairs, pendingPairs, coverage, perDex, pairs: pairRows };
  const killSwitchState = profitability.getKillSwitchState();
  const replaySummary = profitability.getReplaySummary(60);
  const pnlAttribution = profitability.getPnlAttribution();
  const schedulerSummary = buildExecutionThrottleSummary();
  if (killSwitchState.engaged && Date.now() - lastKillSwitchAlertAt > 60_000) {
    lastKillSwitchAlertAt = Date.now();
    void profitability.sendAlert(
      "kill-switch",
      killSwitchState.reason ?? "Kill-switch engaged",
      {
        killSwitch: killSwitchState,
        replaySummary,
      },
    );
  }
  const executionPlan = [
    {
      label: "Execution quality gate",
      detail: hasLiveOpportunities ? "Expected net clears quality thresholds" : "Waiting for executable quality-gated routes",
      status: readyPairs > 0 ? "ready" : "watch",
    },
    {
      label: "MEV and relay policy",
      detail: risk.approved ? "MEV score monitored with relay recommendation" : "Risk guard blocked route",
      status: risk.approved ? "ready" : "watch",
    },
    {
      label: "Kill-switch",
      detail: killSwitchState.engaged
        ? `${killSwitchState.reason ?? "Execution paused by kill-switch"}`
        : "Loss/slippage/rpc guard rails are armed",
      status: killSwitchState.engaged ? "blocked" : "ready",
    },
    {
      label: "Replay and backtest",
      detail: `${replaySummary.executable}/${replaySummary.scanned} opportunities executable in last ${replaySummary.windowMinutes}m`,
      status: coverage === "100%" ? "ready" : "watch",
    },
  ];

  const tradeHistory = executionLedger.slice();
  const pnlSummary = buildPnlSummary(tradeHistory);
  const rpcHealth = await buildRpcHealthSnapshot();
  const derivedProfitHistory = Array.isArray(scanResult?.opportunities) && scanResult.opportunities.length > 0
    ? scanResult.opportunities
        .slice(0, 12)
        .map((opportunity) => {
          const divisor = 10 ** Math.min(opportunity.tokenInDecimals ?? 18, 18);
          return Number(opportunity.netProfit ?? 0n) / divisor;
        })
        .filter((value) => Number.isFinite(value) && value >= 0)
    : Array.from({ length: 8 }, () => 0);
  const derivedGasBars = Array.isArray(scanResult?.opportunities) && scanResult.opportunities.length > 0
    ? scanResult.opportunities
        .slice(0, 12)
        .map((opportunity) => {
          const divisor = 10 ** Math.min(opportunity.tokenInDecimals ?? 18, 18);
          return Number(opportunity.gasCost ?? 0n) / divisor;
        })
        .filter((value) => Number.isFinite(value) && value >= 0)
    : Array.from({ length: 8 }, () => 0);
  const derivedChartSummary = {
    profitHistory: derivedProfitHistory.length > 0 ? derivedProfitHistory : Array.from({ length: 8 }, () => 0),
    gasBars: derivedGasBars.length > 0 ? derivedGasBars : Array.from({ length: 8 }, () => 0),
    successRate: replaySummary.scanned > 0
      ? `${Math.min(99.9, Math.max(0, (replaySummary.executable / replaySummary.scanned) * 100)).toFixed(1)}%`
      : "0.0%",
    opportunityTimeline: `${Math.max(resolvedOpportunityCount, summary.healthy, liveOpportunities.length)} active`,
  };
  const executionIntents = buildExecutionIntentHistory();
  const alerting = buildAlertingSnapshot();
  const deploymentSafety = buildDeploymentSafetySnapshot();
  const reconciliation = buildPostTradeReconciliationSnapshot();
  const executionIntentSummary = {
    total: executionIntents.length,
    prepared: executionIntents.filter((intent) => intent.status === "prepared").length,
    submitted: executionIntents.filter((intent) => intent.status === "submitted").length,
    confirmed: executionIntents.filter((intent) => intent.status === "confirmed").length,
    failed: executionIntents.filter((intent) => intent.status === "failed").length,
    active: executionIntents.filter((intent) => intent.status === "prepared" || intent.status === "submitted").length,
  };
  const capitalGrowth = profitability.getCapitalGrowthDecision({
    currentActiveShare: buildCapitalPolicySnapshot().activeAllocationShare,
    winRatePct: computeWinRate(tradeHistory),
    drawdownPct: computeDrawdownPct(tradeHistory),
    realizedNetUsd: parseUsd(pnlSummary.totalPnl),
    dailyRealizedLossUsd: killSwitchState.dailyRealizedLossUsd,
    rpcHealthyRatio: summary.total > 0 ? summary.healthy / summary.total : 1,
    killSwitchEngaged: killSwitchState.engaged,
  });
  const marketValidation = profitability.getMarketReadinessDecision({
    executableOpportunityRatio: replaySummary.scanned > 0 ? replaySummary.executable / replaySummary.scanned : 0,
    avgExpectedNetUsd: replaySummary.avgExpectedNetUsd,
    rpcHealthyRatio: summary.total > 0 ? summary.healthy / summary.total : 1,
    winRatePct: computeWinRate(tradeHistory),
    drawdownPct: computeDrawdownPct(tradeHistory),
    liveOpportunityCount: resolvedOpportunityCount,
    totalScannedCount: Math.max(1, scannedPairs),
  });

  return buildDashboardPayload({
    ...dashboardState,
    status: dashboardState.status,
    health: summary,
    risk,
    protection,
    tokens: 7 + summary.total,
    pairsScanned: scannedPairs,
    opportunities: resolvedOpportunityCount,
    bestProfit: resolvedBestProfit,
    bestRoute: resolvedBestRoute,
    bestOpportunity: resolvedBestOpportunity,
    topRoute: resolvedTopRoute,
    lastScan: new Date().toISOString(),
    opportunitiesFeed: resolvedOpportunityFeed,
    dexAnalytics,
    quoteHealth: quoteHealthRows,
    dexSupportMatrix: supportMatrixRows,
    executionReadiness,
    capitalGrowth,
    marketValidation,
    rpcHealth,
    tokenMonitoring,
    aiMetrics: [
      {
        label: "Execution gate v2",
        value: hasLiveOpportunities ? "Executable routes available" : "No route passed quality gate",
      },
      {
        label: "MEV protection",
        value: protectionSummary + (killSwitchState.engaged ? " / paused" : ""),
      },
      {
        label: "RPC health",
        value: healthStatus.toUpperCase(),
      },
      {
        label: "Adaptive sizing",
        value: `${computeWinRate(tradeHistory).toFixed(1)}% win-rate, ${computeDrawdownPct(tradeHistory).toFixed(1)}% drawdown`,
      },
      {
        label: "PnL attribution",
        value: `spread ${pnlAttribution.spreadGainUsd.toFixed(2)} / gas ${pnlAttribution.gasCostUsd.toFixed(2)} / slip ${pnlAttribution.slippageCostUsd.toFixed(2)}`,
      },
      {
        label: "Replay engine",
        value: `${replaySummary.scanned} scans, ${replaySummary.executable} executable`,
      },
      {
        label: "Execution scheduler",
        value: `${schedulerSummary.blockedCount} throttled, prepare ${Math.round(schedulerSummary.prepareCooldownMs / 1000)}s, confirm ${Math.round(schedulerSummary.confirmCooldownMs / 1000)}s`,
      },
    ],
    executionPlan,
    tradeHistory,
    executionIntents,
    executionIntentSummary,
    alerting,
    deploymentSafety,
    reconciliation,
    pnlSummary,
    transactions: tradeHistory.slice(0, 3).map((trade) => ({
      status: trade.status,
      hash: trade.txHash ?? trade.id,
      gasUsed: trade.sizeUsd,
    })),
    chartSummary: derivedChartSummary,
  });
}

function getRolloutStageRank(stage: RolloutStage): number {
  if (stage === "scale") {
    return 2;
  }
  if (stage === "canary") {
    return 1;
  }
  return 0;
}

function getRolloutStageFromRank(rank: number): RolloutStage {
  if (rank >= 2) {
    return "scale";
  }
  if (rank === 1) {
    return "canary";
  }
  return "blocked";
}

function persistRolloutGovernanceRegistry() {
  writeRolloutGovernanceState(
    Array.from(rolloutGovernanceRegistry.values()).map((row) => ({
      chain: row.chain,
      currentStage: row.currentStage,
      promotionStreak: row.promotionStreak,
      holdUntil: row.holdUntil,
      lastTransitionAt: row.lastTransitionAt,
      reason: row.reason,
      manualOverrideStage: row.manualOverrideStage,
    })),
  );
}

function getOrCreateRolloutGovernanceState(chain: ChainName, observedStage: RolloutStage): RolloutGovernanceState {
  const existing = rolloutGovernanceRegistry.get(chain);
  if (existing) {
    return existing;
  }
  const created: RolloutGovernanceState = {
    chain,
    currentStage: observedStage,
    promotionStreak: 0,
    reason: "Initialized from observed chain health.",
  };
  rolloutGovernanceRegistry.set(chain, created);
  return created;
}

function evaluateRolloutGovernance(chain: ChainName, observedStage: RolloutStage, now: number) {
  const state = getOrCreateRolloutGovernanceState(chain, observedStage);
  let changed = false;
  let source: "autopilot" | "manual-override" | "hold" = "autopilot";
  let reason = state.reason ?? "No governance action.";

  if (state.manualOverrideStage) {
    source = "manual-override";
    if (state.currentStage !== state.manualOverrideStage) {
      state.currentStage = state.manualOverrideStage;
      state.lastTransitionAt = now;
      state.promotionStreak = 0;
      changed = true;
    }
    reason = `Manual override enforced at ${state.manualOverrideStage}.`;
    if (changed) {
      state.reason = reason;
    }
    return { state, changed, source, reason, effectiveStage: state.currentStage };
  }

  if (!ROLLOUT_AUTOPILOT_ENABLED) {
    source = "hold";
    reason = "Rollout autopilot disabled. Keeping current stage.";
    if (state.reason !== reason) {
      state.reason = reason;
      changed = true;
    }
    return { state, changed, source, reason, effectiveStage: state.currentStage };
  }

  const observedRank = getRolloutStageRank(observedStage);
  const currentRank = getRolloutStageRank(state.currentStage);
  if (observedRank < currentRank) {
    state.currentStage = observedStage;
    state.promotionStreak = 0;
    state.lastTransitionAt = now;
    state.holdUntil = now + ROLLOUT_DEMOTION_COOLDOWN_MS;
    reason = "Auto-demoted stage due to health degradation.";
    state.reason = reason;
    changed = true;
    return { state, changed, source, reason, effectiveStage: state.currentStage };
  }

  if (state.holdUntil && state.holdUntil > now) {
    source = "hold";
    reason = "Cooldown hold active after previous stage transition.";
    if (state.reason !== reason) {
      state.reason = reason;
      changed = true;
    }
    return { state, changed, source, reason, effectiveStage: state.currentStage };
  }

  if (observedRank > currentRank) {
    state.promotionStreak += 1;
    if (state.promotionStreak >= ROLLOUT_PROMOTION_STREAK) {
      const nextRank = Math.min(observedRank, currentRank + 1);
      state.currentStage = getRolloutStageFromRank(nextRank);
      state.promotionStreak = 0;
      state.lastTransitionAt = now;
      state.holdUntil = now + ROLLOUT_PROMOTION_COOLDOWN_MS;
      reason = `Auto-promoted to ${state.currentStage} after sustained healthy streak.`;
      state.reason = reason;
      changed = true;
      return { state, changed, source, reason, effectiveStage: state.currentStage };
    }
    reason = `Promotion streak ${state.promotionStreak}/${ROLLOUT_PROMOTION_STREAK}; waiting before promotion.`;
    if (state.reason !== reason) {
      state.reason = reason;
      changed = true;
    }
    return { state, changed, source, reason, effectiveStage: state.currentStage };
  }

  if (state.promotionStreak !== 0) {
    state.promotionStreak = 0;
    changed = true;
  }
  reason = "Observed stage matches current stage.";
  if (state.reason !== reason) {
    state.reason = reason;
    changed = true;
  }
  return { state, changed, source, reason, effectiveStage: state.currentStage };
}

export async function buildRolloutStatus() {
  const rpcHealth = await buildRpcHealthSnapshot();
  const quoteHealth = getQuoteDiagnostics().health;
  const now = Date.now();
  const killSwitch = profitability.getKillSwitchState();
  const relayRpcDrill = buildRelayRpcDrillStatus({
    rpcHealth,
    signerReady: evaluateSignerPolicy().ready,
  });
  let hasGovernanceUpdates = false;
  const chainRows = CHAIN_LIST.map((chain) => {
    const pairs = getExecutablePairs(chain);
    const readyPairs = pairs.filter((pair) => ensurePairExecutionReady(pair).ready).length;
    const rpc = rpcHealth.find((row) => row.chain === chain);
    const offlineQuotes = quoteHealth.filter((row) => row.chain === chain && row.status !== "LIVE").length;
    const readyCoverage = pairs.length > 0 ? (readyPairs / pairs.length) * 100 : 0;
    const canaryReady = Boolean(rpc && rpc.overall === "healthy") && readyCoverage >= 55 && offlineQuotes <= 3;
    const scaleReady = Boolean(rpc && rpc.overall === "healthy") && readyCoverage >= 75 && offlineQuotes === 0;
    const observedStage: RolloutStage = scaleReady ? "scale" : canaryReady ? "canary" : "blocked";
    const governance = evaluateRolloutGovernance(chain, observedStage, now);
    const canaryValidation = buildCanaryValidationStatus({ chain });
    const readinessGate = buildExecutionReadinessGateStatus({
      killSwitch,
      canaryValidation,
      relayRpcDrill,
    });
    const operatorSafety = buildOperatorSafetySnapshot({
      killSwitch,
      readinessGate,
      canaryValidation,
      relayRpcDrill,
    });
    const goNoGo = buildRolloutGoNoGoStatus({
      chain,
      observedStage,
      canaryValidation,
      readinessGate,
      relayRpcDrill,
      operatorSafety,
    });
    if (governance.changed) {
      hasGovernanceUpdates = true;
      rolloutGovernanceRegistry.set(chain, governance.state);
    }
    return {
      chain,
      stage: governance.effectiveStage,
      observedStage,
      rpcOverall: rpc?.overall ?? "offline",
      executablePairs: {
        ready: readyPairs,
        total: pairs.length,
        coveragePct: Number(readyCoverage.toFixed(1)),
      },
      quoteHealth: {
        degradedOrOffline: offlineQuotes,
      },
      canaryValidation,
      readinessGate,
      operatorSafety,
      goNoGo,
      governance: {
        source: governance.source,
        promotionStreak: governance.state.promotionStreak,
        holdUntil: governance.state.holdUntil ? new Date(governance.state.holdUntil).toISOString() : undefined,
        lastTransitionAt: governance.state.lastTransitionAt ? new Date(governance.state.lastTransitionAt).toISOString() : undefined,
        manualOverrideStage: governance.state.manualOverrideStage,
      },
      reason: governance.reason,
    };
  });
  if (hasGovernanceUpdates) {
    persistRolloutGovernanceRegistry();
  }

  return {
    generatedAt: new Date().toISOString(),
    chains: chainRows,
    summary: {
      blocked: chainRows.filter((row) => row.stage === "blocked").length,
      canary: chainRows.filter((row) => row.stage === "canary").length,
      scale: chainRows.filter((row) => row.stage === "scale").length,
    },
    governance: {
      autopilotEnabled: ROLLOUT_AUTOPILOT_ENABLED,
      promotionStreakRequired: ROLLOUT_PROMOTION_STREAK,
      promotionCooldownMs: ROLLOUT_PROMOTION_COOLDOWN_MS,
      demotionCooldownMs: ROLLOUT_DEMOTION_COOLDOWN_MS,
    },
  };
}

export function buildStrategyTuningRecommendations() {
  const replay = profitability.getReplaySummary(180);
  const killSwitch = profitability.getKillSwitchState();
  const pnl = profitability.getPnlAttribution();
  const failRate = replay.scanned > 0 ? (replay.scanned - replay.executable) / replay.scanned : 1;
  const recommendations: Array<{ key: string; current?: number; recommended: number; reason: string }> = [];

  const currentMinNet = Number(process.env.MIN_EXPECTED_NET_USD ?? 0.25);
  const currentMaxSlippage = Number(process.env.MAX_PREDICTED_SLIPPAGE_BPS ?? 450);
  const currentSafetyBuffer = Number(process.env.EXECUTION_SAFETY_BUFFER_USD ?? 0.05);
  const currentPrepareCooldown = Number(process.env.EXECUTION_PREPARE_COOLDOWN_MS ?? 1_500);

  if (failRate > 0.65 || killSwitch.engaged) {
    recommendations.push({
      key: "MIN_EXPECTED_NET_USD",
      current: currentMinNet,
      recommended: Number((currentMinNet * 1.3).toFixed(4)),
      reason: "High non-executable ratio suggests raising minimum expected net threshold.",
    });
    recommendations.push({
      key: "EXECUTION_SAFETY_BUFFER_USD",
      current: currentSafetyBuffer,
      recommended: Number((currentSafetyBuffer + 0.03).toFixed(4)),
      reason: "Add extra safety buffer while risk is elevated.",
    });
  }

  if (pnl.slippageCostUsd > pnl.spreadGainUsd * 0.35) {
    recommendations.push({
      key: "MAX_PREDICTED_SLIPPAGE_BPS",
      current: currentMaxSlippage,
      recommended: Math.max(80, Math.round(currentMaxSlippage * 0.85)),
      reason: "Slippage cost is too high relative to spread capture; tighten slippage ceiling.",
    });
  }

  if (killSwitch.consecutiveLosses >= 2 || killSwitch.rpcInstabilityEvents >= 2) {
    recommendations.push({
      key: "EXECUTION_PREPARE_COOLDOWN_MS",
      current: currentPrepareCooldown,
      recommended: Math.min(15_000, Math.round(currentPrepareCooldown * 1.5)),
      reason: "Recent loss/rpc instability indicates pacing should be slower.",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      key: "MIN_EXPECTED_NET_USD",
      current: currentMinNet,
      recommended: currentMinNet,
      reason: "Current strategy metrics are stable; keep thresholds unchanged for now.",
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    replayWindowMinutes: 180,
    replay,
    killSwitch,
    pnl,
    recommendations,
  };
}

app.get(
  "/dex/quote-health",
  (_req, res) => {
    res.json(serializeForJson(getQuoteDiagnostics().health));
  },
);

app.get(
  "/dex/support-matrix",
  (_req, res) => {
    res.json(serializeForJson(getQuoteDiagnostics().supportMatrix));
  },
);

app.get(
  "/strategy/config",
  (_req, res) => {
    res.json(serializeForJson({
      engine: getEngineConfigSnapshot(),
      strategy: {
        enabled: true,
        version: "profitability-v2",
      },
      killSwitch: profitability.getKillSwitchState(),
    }));
  },
);

app.get(
  "/strategy/status",
  (_req, res) => {
    const replaySummary = profitability.getReplaySummary(60);
    const runtimeConfig = profitability.getRuntimeConfig();
    res.json(serializeForJson({
      qualityGate: {
        enabled: true,
      },
      slippagePredictor: {
        enabled: true,
      },
      mevProtection: {
        enabled: true,
      },
      adaptiveSizing: {
        enabled: true,
      },
      runtimeConfig,
      killSwitch: profitability.getKillSwitchState(),
      pnlAttribution: profitability.getPnlAttribution(),
      replaySummary,
    }));
  },
);

app.get(
  "/system-check",
  async (_req, res) => {
    const replaySummary = profitability.getReplaySummary(60);
    const summary = healthMonitor.getSummary();
    const recoverySnapshot = buildRecoveryTicketSnapshot();
    res.json(serializeForJson({
      ok: true,
      timestamp: new Date().toISOString(),
      chainHealth: summary,
      privateRelay: getEngineConfigSnapshot().relays,
      strategy: {
        killSwitch: profitability.getKillSwitchState(),
        replaySummary,
      },
      alerts: {
        webhookConfigured: getEngineConfigSnapshot().alerts.webhookConfigured,
      },
      executionSecurity: {
        apiKeyConfigured: Boolean(process.env.EXECUTION_API_KEY?.trim()),
        unsafeBypassEnabled: process.env.EXECUTION_API_ALLOW_UNSAFE_WITHOUT_KEY === "true",
      },
      persistence: {
        storePath: getExecutionStoreMeta().filePath,
        pendingRecoveryTickets: recoverySnapshot.pending,
        settlementRecords: getSettlementRecords(1_000).length,
      },
      recoveryWorker: getRecoveryWorkerStatus(),
      settlementWorker: getSettlementWorkerStatus(),
    }));
  },
);

app.get(
  "/strategy/replay",
  (req, res) => {
    const minutes = Number(req.query.minutes ?? 60);
    res.json(serializeForJson(profitability.getReplaySummary(minutes)));
  },
);

app.post(
  "/strategy/kill-switch/reset",
  (req, res) => {
    if (!isExecutionApiAuthorized(req, res)) {
      return;
    }
    res.json(serializeForJson({
      success: true,
      killSwitch: profitability.resetKillSwitch("manual reset via API"),
    }));
  },
);

app.post(
  "/alerts/test",
  async (req, res) => {
    if (!isExecutionApiAuthorized(req, res)) {
      return;
    }
    const result = await profitability.sendAlert(
      "test",
      "Habibi Arbitrage Engine test alert",
      { at: new Date().toISOString() },
    );
    res.status(result.delivered ? 200 : 400).json(serializeForJson(result));
  },
);

app.get(
  "/alerts/status",
  (_req, res) => {
    res.json(serializeForJson(buildAlertingSnapshot()));
  },
);

app.get(
  "/ops/deployment",
  (_req, res) => {
    res.json(serializeForJson(buildDeploymentSafetySnapshot()));
  },
);

app.get(
  "/ops/reconciliation",
  (_req, res) => {
    res.json(serializeForJson(buildPostTradeReconciliationSnapshot()));
  },
);

app.post(
  "/alerts/ack",
  (req, res) => {
    if (!isExecutionApiAuthorized(req, res)) {
      return;
    }
    const alertId = typeof req.body?.alertId === "string" ? req.body.alertId.trim() : "";
    if (!alertId) {
      res.status(400).json(serializeForJson({
        success: false,
        reason: "alertId is required.",
      }));
      return;
    }
    try {
      const acknowledgedBy = typeof req.body?.acknowledgedBy === "string" ? req.body.acknowledgedBy : undefined;
      const updatedHistory = profitability.acknowledgeAlert(alertId, acknowledgedBy);
      res.json(serializeForJson({
        success: true,
        alerting: buildAlertingSnapshot(),
        acknowledged: updatedHistory.alertHistory.find((entry) => entry.id === alertId),
      }));
    } catch (error) {
      res.status(404).json(serializeForJson({
        success: false,
        reason: error instanceof Error ? error.message : "Alert not found.",
      }));
    }
  },
);

app.get(
  "/strategy/tuning/recommendations",
  (_req, res) => {
    res.json(serializeForJson(buildStrategyTuningRecommendations()));
  },
);

app.get(
  "/execute/recovery/pending",
  (_req, res) => {
    res.json(serializeForJson(buildRecoveryTicketSnapshot()));
  },
);

app.get(
  "/execute/recovery/worker/status",
  (_req, res) => {
    res.json(serializeForJson(getRecoveryWorkerStatus()));
  },
);

app.get(
  "/execute/settlements",
  (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    res.json(serializeForJson({
      records: getSettlementRecords(limit),
    }));
  },
);

app.get(
  "/execute/settlement-queue",
  (_req, res) => {
    res.json(serializeForJson(buildSettlementQueueSnapshot()));
  },
);

app.get(
  "/execute/settlement-worker/status",
  (_req, res) => {
    res.json(serializeForJson(getSettlementWorkerStatus()));
  },
);

app.post(
  "/execute/settlement-worker/run",
  async (req, res) => {
    if (!isExecutionApiAuthorized(req, res)) {
      return;
    }
    const result = await processPendingSettlementQueue();
    res.json(serializeForJson({
      success: true,
      worker: result,
      status: getSettlementWorkerStatus(),
    }));
  },
);

app.post(
  "/execute/settlement-queue/hint",
  (req, res) => {
    if (!isExecutionApiAuthorized(req, res)) {
      return;
    }
    if (!isTransactionHash(req.body?.txHash)) {
      res.status(400).json(serializeForJson({
        success: false,
        reason: "A valid txHash is required.",
      }));
      return;
    }
    let queueItem: SettlementQueueItem;
    try {
      queueItem = createSettlementQueueItem({
        txHash: req.body.txHash,
        chain: req.body?.chain === "base" || req.body?.chain === "arbitrum" || req.body?.chain === "polygon" || req.body?.chain === "bnb"
          ? req.body.chain
          : "arbitrum",
        walletAddress: typeof req.body?.walletAddress === "string" ? req.body.walletAddress : "",
        amountUsd: Number(req.body?.amountUsd ?? 0),
        pair: typeof req.body?.pair === "string" ? req.body.pair : undefined,
        route: typeof req.body?.route === "string" ? req.body.route : undefined,
        spreadGainUsdHint: Number.isFinite(Number(req.body?.spreadGainUsd)) ? Number(req.body.spreadGainUsd) : undefined,
        gasCostUsdHint: Number.isFinite(Number(req.body?.gasCostUsd)) ? Number(req.body.gasCostUsd) : undefined,
        slippageCostUsdHint: Number.isFinite(Number(req.body?.slippageCostUsd)) ? Number(req.body.slippageCostUsd) : undefined,
        realizedNetUsdHint: Number.isFinite(Number(req.body?.realizedNetUsd)) ? Number(req.body.realizedNetUsd) : undefined,
      });
    } catch (error) {
      res.status(400).json(serializeForJson({
        success: false,
        reason: error instanceof Error ? error.message : "Invalid settlement queue payload.",
      }));
      return;
    }
    res.json(serializeForJson({
      success: true,
      queueItem,
    }));
  },
);

app.post(
  "/execute/recovery/worker/run",
  async (req, res) => {
    if (!isExecutionApiAuthorized(req, res)) {
      return;
    }
    const result = await processPendingRecoveryTickets();
    res.json(serializeForJson({
      success: true,
      worker: result,
      status: getRecoveryWorkerStatus(),
    }));
  },
);

app.post(
  "/execute/recovery/prepare-auto",
  async (req, res) => {
    if (!isExecutionApiAuthorized(req, res)) {
      return;
    }
    const recoveryId = String(req.body?.recoveryId ?? "");
    const ticket = recoveryTicketRegistry.get(recoveryId);
    if (!ticket) {
      res.status(404).json(serializeForJson({
        success: false,
        reason: "Recovery ticket not found.",
      }));
      return;
    }
    const prepared = await buildPreparedRecoveryTransactions({
      walletAddress: ticket.walletAddress,
      chain: ticket.chain,
      slippageBps: Number(req.body?.slippageBps ?? 25),
      walletWbnbAmountRaw: typeof req.body?.walletWbnbAmountRaw === "string" ? req.body.walletWbnbAmountRaw : undefined,
    });
    if (prepared.success) {
      updateRecoveryTicket(ticket.id, {
        status: "prepared",
        attempts: ticket.attempts + 1,
        lastAttemptAt: Date.now(),
        nextRetryAt: undefined,
        lastError: undefined,
      });
    } else {
      const nextAttempts = ticket.attempts + 1;
      const exhausted = nextAttempts >= RECOVERY_WORKER_MAX_ATTEMPTS;
      updateRecoveryTicket(ticket.id, {
        status: exhausted ? "failed" : "pending",
        attempts: nextAttempts,
        lastAttemptAt: Date.now(),
        nextRetryAt: exhausted ? undefined : Date.now() + computeRecoveryRetryBackoffMs(nextAttempts),
        lastError: prepared.reason,
      });
    }
    res.status(prepared.success ? 200 : 400).json(serializeForJson({
      ...prepared,
      recoveryTicketId: ticket.id,
    }));
  },
);

app.post(
  "/execute/settle",
  (req, res) => {
    if (!isExecutionApiAuthorized(req, res)) {
      return;
    }
    if (!isTransactionHash(req.body?.txHash)) {
      res.status(400).json(serializeForJson({
        success: false,
        reason: "A valid txHash is required for settlement.",
      }));
      return;
    }
    const settled = settleTradeByHash({
      txHash: req.body.txHash,
      realizedNetUsd: Number(req.body?.realizedNetUsd ?? 0),
      spreadGainUsd: Number(req.body?.spreadGainUsd ?? 0),
      gasCostUsd: Number(req.body?.gasCostUsd ?? 0),
      slippageCostUsd: Number(req.body?.slippageCostUsd ?? 0),
      note: typeof req.body?.note === "string" ? req.body.note : undefined,
    });
    if (!settled.success) {
      res.status(404).json(serializeForJson(settled));
      return;
    }
    void profitability.sendAlert("execution-settled", "Execution settlement recorded", {
      txHash: req.body.txHash,
      realizedNetUsd: Number(req.body?.realizedNetUsd ?? 0),
      note: req.body?.note,
    });
    res.json(serializeForJson({
      success: true,
      trade: settled.trade,
      pnlAttribution: profitability.getPnlAttribution(),
      killSwitch: profitability.getKillSwitchState(),
    }));
  },
);

app.get(
  "/ops/metrics",
  async (_req, res) => {
    const rpcHealth = await buildRpcHealthSnapshot();
    const rollout = await buildRolloutStatus();
    const scheduler = buildExecutionThrottleSummary();
    const intents = buildExecutionIntentHistory();
    const recovery = buildRecoveryTicketSnapshot();
    const settlements = getSettlementRecords(100);
    const killSwitch = profitability.getKillSwitchState();
    const replay = profitability.getReplaySummary(60);
    const signerPolicy = evaluateSignerPolicy();
    const capitalPolicy = buildCapitalPolicySnapshot();
    const canaryValidation = buildCanaryValidationStatus();
    const relayRpcDrill = buildRelayRpcDrillStatus({ rpcHealth, signerReady: signerPolicy.ready });
    const liveCostTuning = buildLiveCostTuningSnapshot();
    const readinessGate = buildExecutionReadinessGateStatus({
      canaryValidation,
      relayRpcDrill,
      signerReady: signerPolicy.ready,
      killSwitch,
    });
    const operatorSafety = buildOperatorSafetySnapshot({
      killSwitch,
      readinessGate,
      canaryValidation,
      relayRpcDrill,
    });
    const readinessGateHistory = getReadinessGateHistory(3);
    res.json(serializeForJson({
      generatedAt: new Date().toISOString(),
      scheduler,
      killSwitch,
      replay,
      signerPolicy,
      capitalPolicy,
      canaryValidation,
      relayRpcDrill,
      liveCostTuning,
      readinessGate,
      operatorSafety,
      readinessGateHistory,
      intents: {
        active: intents.filter((intent) => intent.status === "prepared" || intent.status === "submitted").length,
        failed: intents.filter((intent) => intent.status === "failed").length,
        total: intents.length,
      },
      recovery,
      settlements: {
        count: settlements.length,
        latest: settlements[0],
      },
      persistence: {
        storePath: getExecutionStoreMeta().filePath,
      },
      recoveryWorker: getRecoveryWorkerStatus(),
      settlementWorker: getSettlementWorkerStatus(),
      rpc: {
        degradedOrOfflineChains: rpcHealth.filter((row) => row.overall !== "healthy").map((row) => row.chain),
        chains: rpcHealth,
      },
      rollout,
    }));
  },
);

app.get(
  "/ops/drill/relay-rpc",
  async (_req, res) => {
    const rpcHealth = await buildRpcHealthSnapshot();
    res.json(serializeForJson(buildRelayRpcDrillStatus({ rpcHealth })));
  },
);

app.get(
  "/ops/readiness-gate",
  async (_req, res) => {
    const signerPolicy = evaluateSignerPolicy();
    const killSwitch = profitability.getKillSwitchState();
    const canaryValidation = buildCanaryValidationStatus();
    const rpcHealth = await buildRpcHealthSnapshot();
    const relayRpcDrill = buildRelayRpcDrillStatus({ rpcHealth, signerReady: signerPolicy.ready });
    const readinessGate = buildExecutionReadinessGateStatus({
      canaryValidation,
      relayRpcDrill,
      signerReady: signerPolicy.ready,
      killSwitch,
    });
    res.json(serializeForJson({
      ...readinessGate,
      history: getReadinessGateHistory(3),
    }));
  },
);

app.get(
  "/ops/operator-safety",
  async (_req, res) => {
    const rpcHealth = await buildRpcHealthSnapshot();
    const signerPolicy = evaluateSignerPolicy();
    const killSwitch = profitability.getKillSwitchState();
    const canaryValidation = buildCanaryValidationStatus();
    const relayRpcDrill = buildRelayRpcDrillStatus({ rpcHealth, signerReady: signerPolicy.ready });
    const readinessGate = buildExecutionReadinessGateStatus({
      canaryValidation,
      relayRpcDrill,
      signerReady: signerPolicy.ready,
      killSwitch,
    });
    res.json(serializeForJson(buildOperatorSafetySnapshot({
      killSwitch,
      readinessGate,
      canaryValidation,
      relayRpcDrill,
    })));
  },
);

app.get(
  "/canary/status",
  (_req, res) => {
    res.json(serializeForJson(buildCanaryValidationStatus()));
  },
);

app.get(
  "/rollout/status",
  async (_req, res) => {
    res.json(serializeForJson(await buildRolloutStatus()));
  },
);

app.post(
  "/rollout/override",
  async (req, res) => {
    if (!isExecutionApiAuthorized(req, res)) {
      return;
    }
    const chain = typeof req.body?.chain === "string" ? req.body.chain : "";
    if (!CHAIN_LIST.includes(chain as ChainName)) {
      res.status(400).json(serializeForJson({
        success: false,
        reason: "A valid chain is required.",
      }));
      return;
    }
    const overrideStage = req.body?.stage;
    const state = getOrCreateRolloutGovernanceState(chain as ChainName, "blocked");
    if (overrideStage === "blocked" || overrideStage === "canary" || overrideStage === "scale") {
      state.manualOverrideStage = overrideStage;
      state.currentStage = overrideStage;
      state.promotionStreak = 0;
      state.lastTransitionAt = Date.now();
      state.reason = `Manual override set to ${overrideStage}.`;
    } else if (overrideStage === null || overrideStage === "auto") {
      state.manualOverrideStage = undefined;
      state.reason = "Manual override cleared; autopilot resumed.";
    } else {
      res.status(400).json(serializeForJson({
        success: false,
        reason: "Stage must be one of blocked, canary, scale, or auto.",
      }));
      return;
    }
    rolloutGovernanceRegistry.set(chain as ChainName, state);
    persistRolloutGovernanceRegistry();
    res.json(serializeForJson({
      success: true,
      chain,
      overrideStage: state.manualOverrideStage ?? "auto",
      status: await buildRolloutStatus(),
    }));
  },
);

app.get(
  "/health",
  (_req, res) => {

    res.json(serializeForJson({

      status: "ok",

      message:
        "Blockchain API Running 🚀",

      timestamp:
        new Date().toISOString(),

    }));

  },
);





app.get(
  "/dashboard",
  async (_req, res) => {
    res.json(serializeForJson(await buildDashboardSnapshot()));
  },
);





app.post(
  "/dashboard/update",
  async (req, res) => {


    dashboardState = {
      ...dashboardState,
      ...req.body,
      lastScan: new Date().toISOString(),
    };



    res.json(serializeForJson({
      success: true,
      data: await buildDashboardSnapshot(),
    }));


  },
);

app.post(
  "/execute",
  async (req, res) => {
    try {
      if (!isExecutionApiAuthorized(req, res)) {
        return;
      }
      if (!isExecutionSignerReady(res)) {
        return;
      }
      const request = req.body ?? {};
      const chain = request.chain === "base" || request.chain === "arbitrum" || request.chain === "polygon" || request.chain === "bnb"
        ? request.chain
        : "arbitrum";

      if (request.reportFailure) {
        const isRecoveryFailure = Boolean(request.recover || request.recovery);
        const failureIntent = resolveExecutionIntent(request.executionIntentId);
        if (request.executionIntentId && !failureIntent) {
          res.status(409).json(serializeForJson({
            success: false,
            reason: "Execution intent is missing, expired, or invalid.",
          }));
          return;
        }
        if (failureIntent) {
          retireExecutionIntent(failureIntent.id, "failed", isTransactionHash(request.txHash) ? request.txHash : undefined);
        }
        const trade = recordExecutionEvent({
          pair: request.route?.pair ?? "Unknown route",
          route: `${request.route?.buyDex ?? "—"} → ${request.route?.sellDex ?? "—"}`,
          amountUsd: Number(request.amountUsd ?? 0),
          status: isRecoveryFailure ? "Recovery failed" : (request.txHash ? "Partial execution" : "Execution blocked"),
          txHash: isTransactionHash(request.txHash) ? request.txHash : undefined,
          note: typeof request.note === "string" ? request.note : undefined,
        });

        res.json(serializeForJson({
          success: true,
          trade,
        }));
        if (!isRecoveryFailure && isAddress(String(request.walletAddress ?? ""))) {
          createRecoveryTicket({
            chain,
            walletAddress: String(request.walletAddress ?? ""),
            amountUsd: Number(request.amountUsd ?? 0),
            reason: request.txHash
              ? "Partial execution reported; recovery flow should unwind residual exposure."
              : "Execution failed before confirmation; verify residual balances.",
            route: request.route,
            sourceTxHash: isTransactionHash(request.txHash) ? request.txHash : undefined,
          });
        }
        const killSwitchBeforeFailure = profitability.getKillSwitchState();
        profitability.recordExecutionOutcome({
          failed: true,
          realizedNetUsd: -Math.abs(Number(request.amountUsd ?? 0)),
          slippageBps: Number(request.slippageBps ?? 0),
          rpcHealthy: healthMonitor.getSummary().overall === "healthy",
        });
        const killSwitchAfterFailure = profitability.getKillSwitchState();
        if (!killSwitchBeforeFailure.engaged && killSwitchAfterFailure.engaged) {
          void profitability.sendAlert("kill-switch-engaged", "Kill-switch engaged after execution failure", {
            chain,
            route: request.route,
            txHash: request.txHash,
            killSwitch: killSwitchAfterFailure,
          });
        }
        void profitability.sendAlert("execution-failure", "Execution failure reported", {
          chain,
          txHash: request.txHash,
          note: request.note,
          route: request.route,
        });
        return;
      }

      if (request.prepare) {
        if (request.recover) {
          const recovery = await buildPreparedRecoveryTransactions({
            walletAddress: String(request.walletAddress ?? ""),
            chain,
            slippageBps: Number(request.slippageBps ?? 25),
            walletWbnbAmountRaw: typeof request.walletWbnbAmountRaw === "string" ? request.walletWbnbAmountRaw : undefined,
          });
          res.status(recovery.success ? 200 : 400).json(serializeForJson(recovery));
          return;
        }

        const prepareWallet = String(request.walletAddress ?? "");
        if (!isAddress(prepareWallet)) {
          res.status(400).json(serializeForJson({
            success: false,
            reason: "A valid wallet address is required for execution preparation.",
          }));
          return;
        }
        const prepareThrottle = getExecutionThrottleState(prepareWallet, chain);
        const now = Date.now();
        const prepareCooldownRemainingMs = prepareThrottle.lastPreparedAt + EXECUTION_PREPARE_COOLDOWN_MS - now;
        if (prepareCooldownRemainingMs > 0) {
          prepareThrottle.blockedCount += 1;
          res.status(429).json(serializeForJson({
            success: false,
            reason: `Execution prepare cooldown active. Retry in ${Math.ceil(prepareCooldownRemainingMs / 1000)}s.`,
            scheduler: {
              blockedCount: prepareThrottle.blockedCount,
              prepareCooldownMs: EXECUTION_PREPARE_COOLDOWN_MS,
            },
          }));
          return;
        }
        prepareThrottle.lastPreparedAt = now;

        const prepared = await buildPreparedExecutionTransactions({
          walletAddress: prepareWallet,
          chain,
          amountUsd: Number(request.amountUsd ?? 100),
          minimumNotionalUsd: Number(request.minimumNotionalUsd ?? 10),
          walletUsdtBalance: Number(request.walletUsdtBalance ?? Number.NaN),
          useFlashloan: Boolean(request.useFlashloan),
          privateRelay: Boolean(request.privateRelay),
          slippageBps: Number(request.slippageBps ?? 25),
          route: {
            pair: request.route?.pair ?? "WETH/USDC",
            buyDex: request.route?.buyDex ?? "uniswap-v3",
            sellDex: request.route?.sellDex ?? "sushiswap",
          },
        });

        res.status(prepared.success ? 200 : 400).json(serializeForJson(prepared));
        return;
      }

      if (request.recover) {
        if (!request.confirmed || !isTransactionHash(request.txHash)) {
          res.status(400).json(serializeForJson({
            success: false,
            reason: "A confirmed recovery transaction hash is required.",
          }));
          return;
        }

        const confirmedOnChain = await isReceiptConfirmed(request.txHash, chain);
        if (!confirmedOnChain) {
          res.status(409).json(serializeForJson({
            success: false,
            reason: "Recovery transaction is not confirmed on-chain yet.",
          }));
          return;
        }

        const trade = recordExecutionEvent({
          pair: request.route?.pair ?? "WBNB/USDT",
          route: `${request.route?.buyDex ?? "Recovery"} → ${request.route?.sellDex ?? "Wallet"}`,
          amountUsd: Number(request.amountUsd ?? 0),
          status: "Recovery confirmed",
          txHash: request.txHash,
          note: "Residual WBNB was unwound back into USDT.",
        });

        res.json(serializeForJson({
          success: true,
          reason: "Recovery transaction confirmed on-chain.",
          trade,
        }));
        if (typeof request.recoveryTicketId === "string" && request.recoveryTicketId.trim()) {
          updateRecoveryTicket(request.recoveryTicketId, {
            status: "resolved",
            recoveryTxHash: request.txHash,
          });
        }
        return;
      }

      if (request.privateRelaySubmit) {
        const killSwitch = profitability.getKillSwitchState();
        if (killSwitch.engaged) {
          res.status(409).json(serializeForJson({
            success: false,
            reason: `Execution paused by kill-switch: ${killSwitch.reason ?? "risk controls engaged"}`,
            killSwitch,
          }));
          return;
        }

        const intentCheck = assertExecutionIntentMatches({
          executionIntentId: request.executionIntentId,
          chain,
          walletAddress: String(request.walletAddress ?? ""),
          route: request.route,
        });
        if (!intentCheck.success) {
          res.status(409).json(serializeForJson({
            success: false,
            reason: intentCheck.reason,
          }));
          return;
        }

        const submittedRawTransactions = Array.isArray(request.signedTransactions)
          ? request.signedTransactions.filter((transaction: unknown): transaction is `0x${string}` => isHexRawTransaction(transaction))
          : [];
        if (submittedRawTransactions.length === 0) {
          res.status(400).json(serializeForJson({
            success: false,
            reason: "At least one signed raw transaction is required for private relay submission.",
          }));
          return;
        }

        const relayResult = await submitSignedTransactionsToPrivateRelay(chain, submittedRawTransactions);
        retireExecutionIntent(intentCheck.intent.id, "submitted", relayResult.hashes[relayResult.hashes.length - 1]);
        intentCheck.intent.relayHashes = relayResult.hashes;
        res.status(200).json(serializeForJson({
          success: true,
          reason: `Submitted ${relayResult.hashes.length} signed transaction(s) to private relay.`,
          hashes: relayResult.hashes,
          txHash: relayResult.hashes[relayResult.hashes.length - 1],
          relay: {
            enabled: true,
            url: relayResult.relayUrl,
          },
          executionIntentId: intentCheck.intent.id,
          route: request.route,
        }));
        return;
      }

      const killSwitch = profitability.getKillSwitchState();
      if (killSwitch.engaged) {
        res.status(409).json(serializeForJson({
          success: false,
          reason: `Execution paused by kill-switch: ${killSwitch.reason ?? "risk controls engaged"}`,
          killSwitch,
        }));
        return;
      }

      const confirmWallet = String(request.walletAddress ?? "");
      if (!isAddress(confirmWallet)) {
        res.status(400).json(serializeForJson({
          success: false,
          reason: "A valid wallet address is required for execution confirmation.",
        }));
        return;
      }
      const confirmThrottle = getExecutionThrottleState(confirmWallet, chain);
      const now = Date.now();
      const confirmCooldownRemainingMs = confirmThrottle.lastConfirmedAt + EXECUTION_CONFIRM_COOLDOWN_MS - now;
      if (confirmCooldownRemainingMs > 0) {
        confirmThrottle.blockedCount += 1;
        res.status(429).json(serializeForJson({
          success: false,
          reason: `Execution confirm cooldown active. Retry in ${Math.ceil(confirmCooldownRemainingMs / 1000)}s.`,
          scheduler: {
            blockedCount: confirmThrottle.blockedCount,
            confirmCooldownMs: EXECUTION_CONFIRM_COOLDOWN_MS,
          },
        }));
        return;
      }

      const executionPlan = buildExecutionPlan({
        chain,
        walletAddress: confirmWallet,
        amountUsd: Number(request.amountUsd ?? 100),
        minimumNotionalUsd: Number(request.minimumNotionalUsd ?? 10),
        walletUsdtBalance: Number(request.walletUsdtBalance ?? Number.NaN),
        allowFlashloan: Boolean(request.useFlashloan),
        slippageBps: Number(request.slippageBps ?? 25),
        route: {
          pair: request.route?.pair ?? "WETH/USDC",
          buyDex: request.route?.buyDex ?? "Uniswap V2",
          sellDex: request.route?.sellDex ?? "SushiSwap",
        },
      });

      if (!executionPlan.safety.allowed) {
        res.status(400).json(serializeForJson({
          success: false,
          reason: executionPlan.safety.reason,
          plan: executionPlan.plan,
          trade: undefined,
        }));
        return;
      }

      if (!request.confirmed) {
        res.status(400).json(serializeForJson({
          success: false,
          reason: "Execution was not confirmed by wallet; no trade was recorded.",
          plan: executionPlan.plan,
          trade: undefined,
        }));
        return;
      }

      const intentCheck = assertExecutionIntentMatches({
        executionIntentId: request.executionIntentId,
        chain,
        walletAddress: String(request.walletAddress ?? ""),
        route: request.route,
      });
      if (!intentCheck.success) {
        res.status(409).json(serializeForJson({
          success: false,
          reason: intentCheck.reason,
          plan: executionPlan.plan,
          trade: undefined,
        }));
        return;
      }

      if (!isTransactionHash(request.txHash)) {
        res.status(400).json(serializeForJson({
          success: false,
          reason: "A valid on-chain transaction hash is required for live execution.",
          plan: executionPlan.plan,
          trade: undefined,
        }));
        return;
      }

      const confirmedOnChain = await isReceiptConfirmed(request.txHash, chain);
      if (!confirmedOnChain) {
        res.status(409).json(serializeForJson({
          success: false,
          reason: "Transaction is not confirmed on-chain yet. Trade history remains unchanged.",
          plan: executionPlan.plan,
          trade: undefined,
        }));
        return;
      }

      const executableTransaction = await isExecutableArbitrageTransaction(request.txHash, String(request.walletAddress ?? ""), chain);
      if (!executableTransaction) {
        res.status(409).json(serializeForJson({
          success: false,
          reason: "Confirmed transaction does not match a real executable arbitrage submission. Placeholder or unrelated transfers are rejected.",
          plan: executionPlan.plan,
          trade: undefined,
        }));
        return;
      }

      retireExecutionIntent(intentCheck.intent.id, "confirmed", request.txHash);
      confirmThrottle.lastConfirmedAt = Date.now();
      const recordedTrade = recordExecutedTrade({ ...request, confirmed: true });
      if (recordedTrade) {
        createSettlementQueueItem({
          txHash: request.txHash,
          chain,
          walletAddress: confirmWallet,
          amountUsd: Number(request.amountUsd ?? 0),
          pair: recordedTrade.pair,
          route: recordedTrade.route,
          spreadGainUsdHint: Number.isFinite(Number(request.spreadGainUsd)) ? Number(request.spreadGainUsd) : undefined,
          gasCostUsdHint: Number.isFinite(Number(request.gasCostUsd)) ? Number(request.gasCostUsd) : undefined,
          slippageCostUsdHint: Number.isFinite(Number(request.slippageCostUsd)) ? Number(request.slippageCostUsd) : undefined,
          realizedNetUsdHint: Number.isFinite(Number(request.realizedNetUsd)) ? Number(request.realizedNetUsd) : undefined,
        });
      }
      const killSwitchBeforeOutcome = profitability.getKillSwitchState();
      profitability.recordExecutionOutcome({
        spreadGainUsd: Number(request.spreadGainUsd ?? 0),
        gasCostUsd: Number(request.gasCostUsd ?? 0),
        slippageCostUsd: Number(request.slippageCostUsd ?? 0),
        realizedNetUsd: Number(request.realizedNetUsd ?? 0),
        failed: false,
        slippageBps: Number(request.slippageBps ?? 0),
        rpcHealthy: healthMonitor.getSummary().overall === "healthy",
      });
      const killSwitchAfterOutcome = profitability.getKillSwitchState();
      if (!killSwitchBeforeOutcome.engaged && killSwitchAfterOutcome.engaged) {
        void profitability.sendAlert("kill-switch-engaged", "Kill-switch engaged after execution outcome", {
          chain,
          route: request.route,
          txHash: request.txHash,
          killSwitch: killSwitchAfterOutcome,
        });
      }
      void profitability.sendAlert("execution-confirmed", "Execution confirmed on-chain", {
        chain,
        txHash: request.txHash,
        route: request.route,
      });

      res.json(serializeForJson({
        success: Boolean(recordedTrade),
        reason: recordedTrade
          ? "On-chain transaction confirmed. PnL is not fabricated; realized settlement remains external to this dashboard."
          : "No trade was recorded.",
        plan: executionPlan.plan,
        trade: recordedTrade ? {
          id: recordedTrade.id,
          status: recordedTrade.status,
          txHash: recordedTrade.txHash,
          pair: recordedTrade.pair,
          route: recordedTrade.route,
          pnl: recordedTrade.pnl,
          sizeUsd: recordedTrade.sizeUsd,
        } : undefined,
      }));
    } catch (error) {
      res.status(500).json({
        success: false,
        reason: error instanceof Error ? error.message : "Execution request failed",
      });
    }
  },
);


const PORT = Number(process.env.PORT ?? 4000);
const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;
let apiServerStarted = false;

export function startApiServer(): void {
  if (apiServerStarted) {
    return;
  }

  apiServerStarted = true;
  void runBackgroundScan();
  setInterval(() => {
    void runBackgroundScan();
  }, SCAN_INTERVAL_MS);
  if (RECOVERY_WORKER_ENABLED) {
    setInterval(() => {
      void processPendingRecoveryTickets();
    }, RECOVERY_WORKER_INTERVAL_MS);
  }
  if (SETTLEMENT_WORKER_ENABLED) {
    setInterval(() => {
      void processPendingSettlementQueue();
    }, SETTLEMENT_WORKER_INTERVAL_MS);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Blockchain API running on http://localhost:${PORT}`);
  });
}

if (isMainModule) {
  startApiServer();
}