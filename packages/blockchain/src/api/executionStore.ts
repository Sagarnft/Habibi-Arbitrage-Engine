import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type PersistedRecoveryTicketStatus = "pending" | "prepared" | "resolved" | "failed";

export type PersistedRecoveryTicket = {
  id: string;
  chain: string;
  walletAddress: string;
  amountUsd: number;
  createdAt: number;
  status: PersistedRecoveryTicketStatus;
  reason: string;
  route?: {
    pair?: string;
    buyDex?: string;
    sellDex?: string;
  };
  attempts?: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  lastError?: string;
  sourceTxHash?: string;
  recoveryTxHash?: string;
};

export type PersistedSettlementRecord = {
  id: string;
  txHash: string;
  pair?: string;
  route?: string;
  realizedNetUsd: number;
  spreadGainUsd: number;
  gasCostUsd: number;
  slippageCostUsd: number;
  note?: string;
  settledAt: string;
};

export type PersistedSettlementQueueStatus = "pending" | "settled" | "failed";
export type PersistedRolloutStage = "blocked" | "canary" | "scale";

export type PersistedSettlementQueueItem = {
  id: string;
  txHash: string;
  chain: string;
  walletAddress: string;
  amountUsd: number;
  pair?: string;
  route?: string;
  spreadGainUsdHint?: number;
  gasCostUsdHint?: number;
  slippageCostUsdHint?: number;
  realizedNetUsdHint?: number;
  createdAt: number;
  attempts?: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  lastError?: string;
  status: PersistedSettlementQueueStatus;
  settledAt?: string;
};

export type PersistedRolloutGovernanceState = {
  chain: string;
  currentStage: PersistedRolloutStage;
  promotionStreak: number;
  holdUntil?: number;
  lastTransitionAt?: number;
  reason?: string;
  manualOverrideStage?: PersistedRolloutStage;
};

export type PersistedReadinessGateHistoryEntry = {
  generatedAt: string;
  pass: boolean;
  reason: string;
};

export type PersistedAlertStatus = "delivered" | "failed" | "acknowledged";

export type PersistedAlertEvent = {
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
  payload?: Record<string, unknown>;
  status: PersistedAlertStatus;
};

export type PersistedExecutionState = {
  version: 1;
  updatedAt: string;
  recoveryTickets: PersistedRecoveryTicket[];
  recoveryHistory: PersistedRecoveryTicket[];
  settlementRecords: PersistedSettlementRecord[];
  settlementQueue: PersistedSettlementQueueItem[];
  rolloutGovernance: PersistedRolloutGovernanceState[];
  readinessGateHistory: PersistedReadinessGateHistoryEntry[];
  alertHistory: PersistedAlertEvent[];
};

const DEFAULT_STATE_PATH_CANDIDATES = [
  process.env.EXECUTION_STATE_FILE?.trim(),
  path.resolve(process.cwd(), "packages/blockchain/.runtime/execution-state.json"),
  path.resolve(process.cwd(), ".runtime/execution-state.json"),
].filter((candidate): candidate is string => Boolean(candidate));

const EXECUTION_STATE_FILE = DEFAULT_STATE_PATH_CANDIDATES[0];

function createEmptyState(): PersistedExecutionState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    recoveryTickets: [],
    recoveryHistory: [],
    settlementRecords: [],
    settlementQueue: [],
    rolloutGovernance: [],
    readinessGateHistory: [],
    alertHistory: [],
  };
}

let cachedState: PersistedExecutionState | undefined;

function normalizeTicket(value: unknown): PersistedRecoveryTicket | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string"
    || typeof raw.chain !== "string"
    || typeof raw.walletAddress !== "string"
    || typeof raw.amountUsd !== "number"
    || typeof raw.createdAt !== "number"
    || typeof raw.status !== "string"
    || typeof raw.reason !== "string"
  ) {
    return null;
  }
  return {
    id: raw.id,
    chain: raw.chain,
    walletAddress: raw.walletAddress.toLowerCase(),
    amountUsd: Number.isFinite(raw.amountUsd) ? raw.amountUsd : 0,
    createdAt: raw.createdAt,
    status: raw.status as PersistedRecoveryTicketStatus,
    reason: raw.reason,
    route: raw.route && typeof raw.route === "object"
      ? {
          pair: typeof (raw.route as Record<string, unknown>).pair === "string" ? (raw.route as Record<string, unknown>).pair as string : undefined,
          buyDex: typeof (raw.route as Record<string, unknown>).buyDex === "string" ? (raw.route as Record<string, unknown>).buyDex as string : undefined,
          sellDex: typeof (raw.route as Record<string, unknown>).sellDex === "string" ? (raw.route as Record<string, unknown>).sellDex as string : undefined,
        }
      : undefined,
    attempts: Number.isFinite(raw.attempts) ? Number(raw.attempts) : 0,
    lastAttemptAt: Number.isFinite(raw.lastAttemptAt) ? Number(raw.lastAttemptAt) : undefined,
    nextRetryAt: Number.isFinite(raw.nextRetryAt) ? Number(raw.nextRetryAt) : undefined,
    lastError: typeof raw.lastError === "string" ? raw.lastError : undefined,
    sourceTxHash: typeof raw.sourceTxHash === "string" ? raw.sourceTxHash : undefined,
    recoveryTxHash: typeof raw.recoveryTxHash === "string" ? raw.recoveryTxHash : undefined,
  };
}

function normalizeSettlement(value: unknown): PersistedSettlementRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string"
    || typeof raw.txHash !== "string"
    || typeof raw.realizedNetUsd !== "number"
    || typeof raw.spreadGainUsd !== "number"
    || typeof raw.gasCostUsd !== "number"
    || typeof raw.slippageCostUsd !== "number"
    || typeof raw.settledAt !== "string"
  ) {
    return null;
  }
  return {
    id: raw.id,
    txHash: raw.txHash,
    pair: typeof raw.pair === "string" ? raw.pair : undefined,
    route: typeof raw.route === "string" ? raw.route : undefined,
    realizedNetUsd: Number.isFinite(raw.realizedNetUsd) ? raw.realizedNetUsd : 0,
    spreadGainUsd: Number.isFinite(raw.spreadGainUsd) ? raw.spreadGainUsd : 0,
    gasCostUsd: Number.isFinite(raw.gasCostUsd) ? raw.gasCostUsd : 0,
    slippageCostUsd: Number.isFinite(raw.slippageCostUsd) ? raw.slippageCostUsd : 0,
    note: typeof raw.note === "string" ? raw.note : undefined,
    settledAt: raw.settledAt,
  };
}

function normalizeSettlementQueueItem(value: unknown): PersistedSettlementQueueItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string"
    || typeof raw.txHash !== "string"
    || typeof raw.chain !== "string"
    || typeof raw.walletAddress !== "string"
    || typeof raw.amountUsd !== "number"
    || typeof raw.createdAt !== "number"
    || typeof raw.status !== "string"
  ) {
    return null;
  }
  return {
    id: raw.id,
    txHash: raw.txHash,
    chain: raw.chain,
    walletAddress: raw.walletAddress.toLowerCase(),
    amountUsd: Number.isFinite(raw.amountUsd) ? raw.amountUsd : 0,
    pair: typeof raw.pair === "string" ? raw.pair : undefined,
    route: typeof raw.route === "string" ? raw.route : undefined,
    spreadGainUsdHint: Number.isFinite(raw.spreadGainUsdHint) ? Number(raw.spreadGainUsdHint) : undefined,
    gasCostUsdHint: Number.isFinite(raw.gasCostUsdHint) ? Number(raw.gasCostUsdHint) : undefined,
    slippageCostUsdHint: Number.isFinite(raw.slippageCostUsdHint) ? Number(raw.slippageCostUsdHint) : undefined,
    realizedNetUsdHint: Number.isFinite(raw.realizedNetUsdHint) ? Number(raw.realizedNetUsdHint) : undefined,
    createdAt: raw.createdAt,
    attempts: Number.isFinite(raw.attempts) ? Number(raw.attempts) : 0,
    lastAttemptAt: Number.isFinite(raw.lastAttemptAt) ? Number(raw.lastAttemptAt) : undefined,
    nextRetryAt: Number.isFinite(raw.nextRetryAt) ? Number(raw.nextRetryAt) : undefined,
    lastError: typeof raw.lastError === "string" ? raw.lastError : undefined,
    status: raw.status as PersistedSettlementQueueStatus,
    settledAt: typeof raw.settledAt === "string" ? raw.settledAt : undefined,
  };
}

function normalizeAlertEvent(value: unknown): PersistedAlertEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string"
    || typeof raw.event !== "string"
    || typeof raw.message !== "string"
    || typeof raw.timestamp !== "string"
    || typeof raw.reason !== "string"
    || typeof raw.responseAction !== "string"
    || typeof raw.severity !== "string"
  ) {
    return null;
  }
  const severity = raw.severity === "info" || raw.severity === "warning" || raw.severity === "critical"
    ? raw.severity
    : "info";
  const status = raw.status === "delivered" || raw.status === "failed" || raw.status === "acknowledged"
    ? raw.status
    : raw.delivered === false ? "failed" : "delivered";
  return {
    id: raw.id,
    event: raw.event,
    message: raw.message,
    timestamp: raw.timestamp,
    severity,
    delivered: Boolean(raw.delivered),
    reason: raw.reason,
    responseAction: raw.responseAction,
    acknowledged: Boolean(raw.acknowledged),
    acknowledgedAt: typeof raw.acknowledgedAt === "string" ? raw.acknowledgedAt : undefined,
    acknowledgedBy: typeof raw.acknowledgedBy === "string" ? raw.acknowledgedBy : undefined,
    payload: raw.payload && typeof raw.payload === "object" ? (raw.payload as Record<string, unknown>) : undefined,
    status,
  };
}

function normalizeRolloutGovernanceState(value: unknown): PersistedRolloutGovernanceState | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.chain !== "string"
    || typeof raw.currentStage !== "string"
    || typeof raw.promotionStreak !== "number"
  ) {
    return null;
  }
  const normalizeStage = (stage: unknown): PersistedRolloutStage | undefined => {
    return stage === "blocked" || stage === "canary" || stage === "scale" ? stage : undefined;
  };
  const currentStage = normalizeStage(raw.currentStage);
  if (!currentStage) {
    return null;
  }
  return {
    chain: raw.chain,
    currentStage,
    promotionStreak: Number.isFinite(raw.promotionStreak) ? Number(raw.promotionStreak) : 0,
    holdUntil: Number.isFinite(raw.holdUntil) ? Number(raw.holdUntil) : undefined,
    lastTransitionAt: Number.isFinite(raw.lastTransitionAt) ? Number(raw.lastTransitionAt) : undefined,
    reason: typeof raw.reason === "string" ? raw.reason : undefined,
    manualOverrideStage: normalizeStage(raw.manualOverrideStage),
  };
}

function loadStateFromDisk(): PersistedExecutionState {
  if (!existsSync(EXECUTION_STATE_FILE)) {
    return createEmptyState();
  }
  const raw = readFileSync(EXECUTION_STATE_FILE, "utf8").trim();
  if (!raw) {
    return createEmptyState();
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const recoveryTickets = Array.isArray(parsed.recoveryTickets)
    ? parsed.recoveryTickets.map(normalizeTicket).filter((row): row is PersistedRecoveryTicket => row !== null)
    : [];
  const recoveryHistory = Array.isArray(parsed.recoveryHistory)
    ? parsed.recoveryHistory.map(normalizeTicket).filter((row): row is PersistedRecoveryTicket => row !== null)
    : [];
  const settlementRecords = Array.isArray(parsed.settlementRecords)
    ? parsed.settlementRecords.map(normalizeSettlement).filter((row): row is PersistedSettlementRecord => row !== null)
    : [];
  const settlementQueue = Array.isArray(parsed.settlementQueue)
    ? parsed.settlementQueue.map(normalizeSettlementQueueItem).filter((row): row is PersistedSettlementQueueItem => row !== null)
    : [];
  const rolloutGovernance = Array.isArray(parsed.rolloutGovernance)
    ? parsed.rolloutGovernance.map(normalizeRolloutGovernanceState).filter((row): row is PersistedRolloutGovernanceState => row !== null)
    : [];
  const readinessGateHistory = Array.isArray(parsed.readinessGateHistory)
    ? parsed.readinessGateHistory
      .filter((value): value is PersistedReadinessGateHistoryEntry => Boolean(value && typeof value === "object"))
      .map((value) => ({
        generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : new Date().toISOString(),
        pass: Boolean(value.pass),
        reason: typeof value.reason === "string" ? value.reason : "Execution readiness gate status unavailable.",
      }))
    : [];
  const alertHistory = Array.isArray(parsed.alertHistory)
    ? parsed.alertHistory.map(normalizeAlertEvent).filter((row): row is PersistedAlertEvent => row !== null)
    : [];
  return {
    version: 1,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    recoveryTickets,
    recoveryHistory,
    settlementRecords,
    settlementQueue,
    rolloutGovernance,
    readinessGateHistory,
    alertHistory,
  };
}

function ensureLoaded(): PersistedExecutionState {
  if (!cachedState) {
    cachedState = loadStateFromDisk();
  }
  return cachedState;
}

function flushState(state: PersistedExecutionState): void {
  mkdirSync(path.dirname(EXECUTION_STATE_FILE), { recursive: true });
  const nextState: PersistedExecutionState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(EXECUTION_STATE_FILE, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  cachedState = nextState;
}

export function readExecutionState(): PersistedExecutionState {
  const state = ensureLoaded();
  return {
    ...state,
    recoveryTickets: state.recoveryTickets.map((ticket) => ({ ...ticket, route: ticket.route ? { ...ticket.route } : undefined })),
    recoveryHistory: state.recoveryHistory.map((ticket) => ({ ...ticket, route: ticket.route ? { ...ticket.route } : undefined })),
    settlementRecords: state.settlementRecords.map((row) => ({ ...row })),
    settlementQueue: state.settlementQueue.map((item) => ({ ...item })),
    rolloutGovernance: state.rolloutGovernance.map((row) => ({ ...row })),
    readinessGateHistory: state.readinessGateHistory.map((entry) => ({ ...entry })),
    alertHistory: state.alertHistory.map((entry) => ({ ...entry, payload: entry.payload ? { ...entry.payload } : undefined })),
  };
}

export function writeRecoveryState(recoveryTickets: PersistedRecoveryTicket[], recoveryHistory: PersistedRecoveryTicket[]): PersistedExecutionState {
  const state = ensureLoaded();
  const normalizedTickets = recoveryTickets.map((ticket) => normalizeTicket(ticket)).filter((row): row is PersistedRecoveryTicket => row !== null);
  const normalizedHistory = recoveryHistory.map((ticket) => normalizeTicket(ticket)).filter((row): row is PersistedRecoveryTicket => row !== null);
  const nextState: PersistedExecutionState = {
    ...state,
    recoveryTickets: normalizedTickets,
    recoveryHistory: normalizedHistory.slice(0, 200),
  };
  flushState(nextState);
  return readExecutionState();
}

export function appendSettlementRecord(record: PersistedSettlementRecord): PersistedExecutionState {
  const state = ensureLoaded();
  const normalized = normalizeSettlement(record);
  if (!normalized) {
    throw new Error("Invalid settlement record payload.");
  }
  const nextSettlements = [
    normalized,
    ...state.settlementRecords.filter((row) => row.txHash.toLowerCase() !== normalized.txHash.toLowerCase()),
  ].slice(0, 500);
  const nextState: PersistedExecutionState = {
    ...state,
    settlementRecords: nextSettlements,
  };
  flushState(nextState);
  return readExecutionState();
}

export function getSettlementRecords(limit = 100): PersistedSettlementRecord[] {
  const numericLimit = Number.isFinite(limit) ? limit : 100;
  const boundedLimit = Math.max(1, Math.min(1000, Math.trunc(numericLimit)));
  return readExecutionState().settlementRecords.slice(0, boundedLimit);
}

export function writeSettlementQueue(items: PersistedSettlementQueueItem[]): PersistedExecutionState {
  const state = ensureLoaded();
  const normalizedItems = items
    .map((item) => normalizeSettlementQueueItem(item))
    .filter((row): row is PersistedSettlementQueueItem => row !== null);
  const nextState: PersistedExecutionState = {
    ...state,
    settlementQueue: normalizedItems.slice(0, 500),
  };
  flushState(nextState);
  return readExecutionState();
}

export function writeRolloutGovernanceState(items: PersistedRolloutGovernanceState[]): PersistedExecutionState {
  const state = ensureLoaded();
  const normalizedItems = items
    .map((item) => normalizeRolloutGovernanceState(item))
    .filter((row): row is PersistedRolloutGovernanceState => row !== null);
  const nextState: PersistedExecutionState = {
    ...state,
    rolloutGovernance: normalizedItems.slice(0, 64),
  };
  flushState(nextState);
  return readExecutionState();
}

export function writeReadinessGateHistory(items: PersistedReadinessGateHistoryEntry[]): PersistedExecutionState {
  const state = ensureLoaded();
  const normalizedItems = items
    .filter((item): item is PersistedReadinessGateHistoryEntry => Boolean(item && typeof item.generatedAt === "string"))
    .map((item) => ({
      generatedAt: item.generatedAt,
      pass: Boolean(item.pass),
      reason: typeof item.reason === "string" ? item.reason : "Execution readiness gate status unavailable.",
    }));
  const nextState: PersistedExecutionState = {
    ...state,
    readinessGateHistory: normalizedItems.slice(0, 10),
  };
  flushState(nextState);
  return readExecutionState();
}

export function writeAlertHistory(items: PersistedAlertEvent[]): PersistedExecutionState {
  const state = ensureLoaded();
  const normalizedItems = items
    .map((item) => normalizeAlertEvent(item))
    .filter((row): row is PersistedAlertEvent => row !== null);
  const nextState: PersistedExecutionState = {
    ...state,
    alertHistory: normalizedItems.slice(0, 100),
  };
  flushState(nextState);
  return readExecutionState();
}

export function appendAlertEvent(item: PersistedAlertEvent): PersistedExecutionState {
  const state = ensureLoaded();
  const normalized = normalizeAlertEvent(item);
  if (!normalized) {
    throw new Error("Invalid alert event payload.");
  }
  const nextState: PersistedExecutionState = {
    ...state,
    alertHistory: [
      normalized,
      ...state.alertHistory.filter((entry) => entry.id !== normalized.id),
    ].slice(0, 100),
  };
  flushState(nextState);
  return readExecutionState();
}

export function acknowledgeAlertEvent(id: string, acknowledgedBy?: string): PersistedExecutionState {
  const state = ensureLoaded();
  const target = state.alertHistory.find((entry) => entry.id === id);
  if (!target) {
    throw new Error("Alert event not found.");
  }
  const acknowledgedAt = new Date().toISOString();
  const updated: PersistedAlertEvent = {
    ...target,
    acknowledged: true,
    acknowledgedAt,
    acknowledgedBy: typeof acknowledgedBy === "string" && acknowledgedBy.trim() ? acknowledgedBy.trim() : undefined,
    status: "acknowledged",
  };
  const nextState: PersistedExecutionState = {
    ...state,
    alertHistory: [
      updated,
      ...state.alertHistory.filter((entry) => entry.id !== id),
    ].slice(0, 100),
  };
  flushState(nextState);
  return readExecutionState();
}

export function getAlertHistoryState(): PersistedAlertEvent[] {
  return readExecutionState().alertHistory;
}

export function getReadinessGateHistoryState(): PersistedReadinessGateHistoryEntry[] {
  return readExecutionState().readinessGateHistory;
}

export function getRolloutGovernanceState(): PersistedRolloutGovernanceState[] {
  return readExecutionState().rolloutGovernance;
}

export function getExecutionStoreMeta() {
  return {
    filePath: EXECUTION_STATE_FILE,
  };
}
