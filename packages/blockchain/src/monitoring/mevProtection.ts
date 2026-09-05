export type MevProtectionResult = {
  allowed: boolean;
  reason?: string;
  score: number;
  recommendPrivateRelay?: boolean;
  riskLevel?: "low" | "medium" | "high";
};

export class MevProtectionGuard {
  public evaluate(slippageBps: number, profitability: bigint): MevProtectionResult {
    const slippage = Math.max(0, Math.round(slippageBps));
    const recommendPrivateRelay = slippage >= 300;
    if (slippageBps > 1500) {
      return {
        allowed: false,
        reason: "slippage exceeds mev protection threshold",
        score: 0,
        recommendPrivateRelay,
        riskLevel: "high",
      };
    }

    if (profitability <= 0n) {
      return {
        allowed: false,
        reason: "profitability is non-positive",
        score: 0,
        recommendPrivateRelay,
        riskLevel: "high",
      };
    }

    const score = Math.max(0, Math.min(100, 100 - Math.round(slippage * 0.08)));
    const riskLevel = slippage > 500 ? "high" : slippage > 180 ? "medium" : "low";

    return {
      allowed: true,
      score,
      recommendPrivateRelay,
      riskLevel,
    };
  }
}
