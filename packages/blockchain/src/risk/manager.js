import { checkOpportunityRisk, summarizeOpportunityRisk } from "./filter.js";
export class RiskManager {
    config;
    constructor(config) {
        this.config = config;
    }
    evaluate(opportunity) {
        const riskCheck = checkOpportunityRisk(opportunity, this.config);
        const summary = summarizeOpportunityRisk(opportunity, this.config);
        const slippageBps = opportunity.slippageBps ?? 0;
        const gasImpactBps = opportunity.gasImpactBps ?? 0;
        const checks = {
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
