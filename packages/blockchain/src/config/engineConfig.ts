export type StrategyProfileDefinition = {
  minExpectedNetUsd: number;
  minConfidenceScore: number;
  maxPredictedSlippageBps: number;
  maxMevRiskScore: number;
  relayThresholdMev: number;
  relayThresholdSlippageBps: number;
  sizingMultiplier: number;
};

export type ExecutionWalletMode = "freeze" | "dry-run" | "live";

export type EngineConfigSnapshot = {
  strategy: {
    replayWindowSize: number;
    minExpectedNetUsd: number;
    minConfidenceScore: number;
    maxPredictedSlippageBps: number;
    maxMevRiskScore: number;
    safetyBufferUsd: number;
    requirePrivateRelayOnHighMev: boolean;
    killSwitchMaxConsecutiveLosses: number;
    killSwitchMaxSlippageEvents: number;
    killSwitchMaxRpcInstabilityEvents: number;
    killSwitchMaxDailyLossUsd: number;
    killSwitchLossWindowHours: number;
    profiles: {
      "stable-arb": StrategyProfileDefinition;
      "major-arb": StrategyProfileDefinition;
      "volatile-arb": StrategyProfileDefinition;
    };
  };
  execution: {
    mode: ExecutionWalletMode;
    validationWallets: string[];
    validationRequired: boolean;
  };
  relays: {
    defaultUrl?: string;
    configuredChains: string[];
  };
  alerts: {
    webhookConfigured: boolean;
  };
};

function normalizeNumber(value: number | undefined, fallback: number, min?: number, max?: number): number {
  const parsed = Number.isFinite(value) ? Number(value) : fallback;
  const bounded = min !== undefined && max !== undefined ? Math.min(Math.max(parsed, min), max) : parsed;
  const safe = min !== undefined && max === undefined ? Math.max(parsed, min) : bounded;
  return Number.isFinite(safe) ? safe : fallback;
}

export function getStrategyProfiles(): EngineConfigSnapshot["strategy"]["profiles"] {
  return {
    "stable-arb": {
      minExpectedNetUsd: Math.max(0.05, Number(process.env.STABLE_ARB_MIN_EXPECTED_NET_USD ?? 0.18)),
      minConfidenceScore: normalizeNumber(Number(process.env.STABLE_ARB_MIN_CONFIDENCE_SCORE ?? 70), 70, 0, 100),
      maxPredictedSlippageBps: normalizeNumber(Number(process.env.STABLE_ARB_MAX_SLIPPAGE_BPS ?? 180), 180, 10, 3000),
      maxMevRiskScore: normalizeNumber(Number(process.env.STABLE_ARB_MAX_MEV_RISK ?? 75), 75, 1, 100),
      relayThresholdMev: normalizeNumber(Number(process.env.STABLE_ARB_RELAY_MEV_THRESHOLD ?? 65), 65, 1, 100),
      relayThresholdSlippageBps: normalizeNumber(Number(process.env.STABLE_ARB_RELAY_SLIPPAGE_BPS ?? 140), 140, 10, 3000),
      sizingMultiplier: normalizeNumber(Number(process.env.STABLE_ARB_SIZING_MULTIPLIER ?? 1.1), 1.1, 0.25, 1.5),
    },
    "major-arb": {
      minExpectedNetUsd: Math.max(0.05, Number(process.env.MAJOR_ARB_MIN_EXPECTED_NET_USD ?? 0.25)),
      minConfidenceScore: normalizeNumber(Number(process.env.MAJOR_ARB_MIN_CONFIDENCE_SCORE ?? 75), 75, 0, 100),
      maxPredictedSlippageBps: normalizeNumber(Number(process.env.MAJOR_ARB_MAX_SLIPPAGE_BPS ?? 240), 240, 10, 3000),
      maxMevRiskScore: normalizeNumber(Number(process.env.MAJOR_ARB_MAX_MEV_RISK ?? 80), 80, 1, 100),
      relayThresholdMev: normalizeNumber(Number(process.env.MAJOR_ARB_RELAY_MEV_THRESHOLD ?? 70), 70, 1, 100),
      relayThresholdSlippageBps: normalizeNumber(Number(process.env.MAJOR_ARB_RELAY_SLIPPAGE_BPS ?? 180), 180, 10, 3000),
      sizingMultiplier: normalizeNumber(Number(process.env.MAJOR_ARB_SIZING_MULTIPLIER ?? 1), 1, 0.25, 1.5),
    },
    "volatile-arb": {
      minExpectedNetUsd: Math.max(0.05, Number(process.env.VOLATILE_ARB_MIN_EXPECTED_NET_USD ?? 0.4)),
      minConfidenceScore: normalizeNumber(Number(process.env.VOLATILE_ARB_MIN_CONFIDENCE_SCORE ?? 80), 80, 0, 100),
      maxPredictedSlippageBps: normalizeNumber(Number(process.env.VOLATILE_ARB_MAX_SLIPPAGE_BPS ?? 220), 220, 10, 3000),
      maxMevRiskScore: normalizeNumber(Number(process.env.VOLATILE_ARB_MAX_MEV_RISK ?? 70), 70, 1, 100),
      relayThresholdMev: normalizeNumber(Number(process.env.VOLATILE_ARB_RELAY_MEV_THRESHOLD ?? 60), 60, 1, 100),
      relayThresholdSlippageBps: normalizeNumber(Number(process.env.VOLATILE_ARB_RELAY_SLIPPAGE_BPS ?? 160), 160, 10, 3000),
      sizingMultiplier: normalizeNumber(Number(process.env.VOLATILE_ARB_SIZING_MULTIPLIER ?? 0.75), 0.75, 0.25, 1.5),
    },
  };
}

export function getExecutionWalletPolicy() {
  const modeValue = (process.env.EXECUTION_OPERATION_MODE ?? "live").toLowerCase();
  const mode: ExecutionWalletMode = modeValue === "freeze" || modeValue === "dry-run" || modeValue === "live"
    ? modeValue
    : "live";

  const validationWallets = Array.from(new Set(
    (process.env.EXECUTION_VALIDATION_WALLETS ?? process.env.VALIDATION_WALLETS ?? "")
      .split(/[\s,;]+/)
      .map((address) => address.trim().toLowerCase())
      .filter(Boolean),
  ));

  const validationRequired = mode === "freeze" || mode === "dry-run";
  return {
    mode,
    validationWallets,
    validationRequired,
  };
}

export function isWalletApprovedForExecution(walletAddress: string | undefined): { allowed: boolean; reason: string; mode: ExecutionWalletMode; validationWallets: string[] } {
  const normalizedWallet = (walletAddress ?? "").trim().toLowerCase();
  const { mode, validationWallets, validationRequired } = getExecutionWalletPolicy();

  if (!validationRequired) {
    return {
      allowed: true,
      reason: `Execution mode is ${mode}; validation gate is not active.`,
      mode,
      validationWallets,
    };
  }

  if (!normalizedWallet) {
    return {
      allowed: false,
      reason: "Execution wallet is missing. Validation gating requires a wallet address.",
      mode,
      validationWallets,
    };
  }

  if (validationWallets.length === 0) {
    return {
      allowed: false,
      reason: `Execution is in ${mode} mode but no validation wallet is configured. Add EXECUTION_VALIDATION_WALLETS to allow the current wallet.`,
      mode,
      validationWallets,
    };
  }

  const allowed = validationWallets.includes(normalizedWallet);
  return {
    allowed,
    reason: allowed
      ? `Execution wallet ${normalizedWallet} is approved for ${mode} mode.`
      : `Execution wallet ${normalizedWallet} is not in the validation allowlist for ${mode} mode.`,
    mode,
    validationWallets,
  };
}

export function getEngineConfigSnapshot(): EngineConfigSnapshot {
  const configuredChains = Object.entries(process.env)
    .filter(([key]) => key.startsWith("PRIVATE_RELAY_RPC_URL_"))
    .map(([key]) => key.replace("PRIVATE_RELAY_RPC_URL_", "").toLowerCase())
    .sort();

  const strategyProfiles = getStrategyProfiles();
  const executionPolicy = getExecutionWalletPolicy();

  return {
    strategy: {
      replayWindowSize: Math.max(200, Number(process.env.REPLAY_WINDOW_SIZE ?? 5000)),
      minExpectedNetUsd: Math.max(0.05, Number(process.env.MIN_EXPECTED_NET_USD ?? 0.25)),
      minConfidenceScore: normalizeNumber(Number(process.env.MIN_CONFIDENCE_SCORE ?? 65), 65, 0, 100),
      maxPredictedSlippageBps: normalizeNumber(Number(process.env.MAX_PREDICTED_SLIPPAGE_BPS ?? 450), 450, 10, 3000),
      maxMevRiskScore: normalizeNumber(Number(process.env.MAX_MEV_RISK_SCORE ?? 80), 80, 1, 100),
      safetyBufferUsd: Math.max(0, Number(process.env.EXECUTION_SAFETY_BUFFER_USD ?? 0.05)),
      requirePrivateRelayOnHighMev: process.env.REQUIRE_PRIVATE_RELAY_HIGH_MEV === "true",
      killSwitchMaxConsecutiveLosses: Math.max(1, Number(process.env.KILL_SWITCH_MAX_CONSECUTIVE_LOSSES ?? 4)),
      killSwitchMaxSlippageEvents: Math.max(1, Number(process.env.KILL_SWITCH_MAX_SLIPPAGE_EVENTS ?? 6)),
      killSwitchMaxRpcInstabilityEvents: Math.max(1, Number(process.env.KILL_SWITCH_MAX_RPC_INSTABILITY_EVENTS ?? 4)),
      killSwitchMaxDailyLossUsd: Math.max(1, Number(process.env.KILL_SWITCH_MAX_DAILY_LOSS_USD ?? 75)),
      killSwitchLossWindowHours: Math.max(1, Number(process.env.KILL_SWITCH_LOSS_WINDOW_HOURS ?? 24)),
      profiles: strategyProfiles,
    },
    execution: {
      mode: executionPolicy.mode,
      validationWallets: executionPolicy.validationWallets,
      validationRequired: executionPolicy.validationRequired,
    },
    relays: {
      defaultUrl: process.env.PRIVATE_RELAY_RPC_URL || undefined,
      configuredChains,
    },
    alerts: {
      webhookConfigured: Boolean(process.env.ALERT_WEBHOOK_URL && process.env.ALERT_WEBHOOK_URL.trim()),
    },
  };
}
