import type {
  RiskConfig,
  RiskCheckResult,
} from "./types.js";

import type { Opportunity } from "../dex/scanner/types.js";

const DEFAULT_CONFIG: RiskConfig = {
  minProfit: BigInt(process.env.MIN_PROFIT ?? "50"),
  maxSlippageBps: Number(process.env.MAX_SLIPPAGE_BPS ?? "250"),
  maxGasImpactBps: Number(process.env.MAX_GAS_IMPACT_BPS ?? "200"),
  minGrossProfit: BigInt(process.env.MIN_GROSS_PROFIT ?? "5"),
};

export function checkOpportunityRisk(
  opportunity: Opportunity,
  config: RiskConfig = DEFAULT_CONFIG,
): RiskCheckResult {
  if (!opportunity.profitable) {
    return {
      approved: false,
      reason: "Opportunity is not marked profitable",
    };
  }

  if (opportunity.netProfit <= config.minProfit) {
    return {
      approved: false,
      reason: "Profit below minimum threshold",
    };
  }

  if (opportunity.grossProfit <= (config.minGrossProfit ?? 1n)) {
    return {
      approved: false,
      reason: "Invalid gross profit",
    };
  }

  const slippageBps = (opportunity as Opportunity & { slippageBps?: number }).slippageBps ?? 0;
  if (config.maxSlippageBps !== undefined && slippageBps > config.maxSlippageBps) {
    return {
      approved: false,
      reason: `Slippage exceeds allowed threshold: ${slippageBps} bps`,
    };
  }

  const gasImpactBps = (opportunity as Opportunity & { gasImpactBps?: number }).gasImpactBps ?? 0;
  if (config.maxGasImpactBps !== undefined && gasImpactBps > config.maxGasImpactBps) {
    return {
      approved: false,
      reason: `Gas impact exceeds allowed threshold: ${gasImpactBps} bps`,
    };
  }

  return {
    approved: true,
  };
}

export function summarizeOpportunityRisk(
  opportunity: Opportunity,
  config: RiskConfig = DEFAULT_CONFIG,
) {
  const check = checkOpportunityRisk(opportunity, config);

  let level: "approved" | "warning" | "blocked" = "approved";
  let score = 100;

  const slippageBps = (opportunity as Opportunity & { slippageBps?: number }).slippageBps ?? 0;
  const gasImpactBps = (opportunity as Opportunity & { gasImpactBps?: number }).gasImpactBps ?? 0;

  if (!check.approved) {
    level = "blocked";
    score = 88;
  } else if (slippageBps > 200 || gasImpactBps > 150) {
    level = "warning";
    score = 92;
  }

  return {
    approved: check.approved,
    level,
    score,
    reason: check.reason,
  };
}