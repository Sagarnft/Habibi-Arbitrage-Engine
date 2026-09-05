import type { Opportunity } from "../dex/scanner/types.js";
import { checkOpportunityRisk, summarizeOpportunityRisk } from "./filter.js";
import type { RiskConfig, RiskCheckResult } from "./types.js";

export type RiskAssessment = {
  approved: boolean;
  level: "approved" | "warning" | "blocked";
  score: number;
  reason?: string;
  checks: Record<string, boolean>;
};

export class RiskManager {
  constructor(private readonly config: RiskConfig) {}

  public evaluate(opportunity: Opportunity): RiskAssessment {
    const riskCheck = checkOpportunityRisk(opportunity, this.config);
    const summary = summarizeOpportunityRisk(opportunity, this.config);

    const slippageBps = (opportunity as Opportunity & { slippageBps?: number }).slippageBps ?? 0;
    const gasImpactBps = (opportunity as Opportunity & { gasImpactBps?: number }).gasImpactBps ?? 0;

    const checks: Record<string, boolean> = {
      profitable: opportunity.profitable,
      netProfitThreshold: opportunity.netProfit > (this.config.minProfit ?? 0n),
      grossProfitThreshold: opportunity.grossProfit > (this.config.minGrossProfit ?? 1n),
      slippageThreshold: slippageBps <= (this.config.maxSlippageBps ?? Number.MAX_SAFE_INTEGER),
      gasImpactThreshold: gasImpactBps <= (this.config.maxGasImpactBps ?? Number.MAX_SAFE_INTEGER),
    };

    return {
      approved: riskCheck.approved && summary.approved,
      level: summary.level,
      score: summary.score,
      reason: riskCheck.reason ?? summary.reason,
      checks,
    };
  }
}
