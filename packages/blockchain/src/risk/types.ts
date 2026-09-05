export interface RiskConfig {
  minProfit: bigint;
  maxSlippageBps?: number;
  maxGasImpactBps?: number;
  minGrossProfit?: bigint;
}

export interface RiskCheckResult {
  approved: boolean;
  reason?: string;
}