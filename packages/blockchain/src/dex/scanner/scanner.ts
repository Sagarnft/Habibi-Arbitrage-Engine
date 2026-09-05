import { getQuotes } from "../../aggregator/quoteAggregator.js";
import { runWithConcurrency } from "../../utils/index.js";
import { checkOpportunityRisk } from "../../risk/index.js";
import { buildAmountIn } from "../../tokens/index.js";
import { initializeTokenRegistry } from "../../tokens/init.js";
import { tokenRegistry } from "../../tokens/registry.js";
import { healthMonitor } from "../../providers/healthMonitor.js";
import { rpcManager } from "../../providers/rpcManager.js";
import { CHAIN_LIST } from "../../chains.js";
import { getActiveDexes, normalizeDexKey } from "../activeDexes.js";
import { buildTokenPairs } from "./routes.js";
import { findOpportunity, findTriangleOpportunity, scoreOpportunity } from "./opportunity.js";
import { ProfitabilityController } from "../../strategy/profitability.js";

import type {
  ScanPairCandidate,
  ScanRequest,
  ScanResult,
  Opportunity,
} from "./types.js";


const SCAN_CONCURRENCY = Number(process.env.SCAN_CONCURRENCY ?? 24);
const MAX_TRIAL_AMOUNTS = Number(process.env.SCAN_TRIAL_AMOUNTS ?? 16);
const AMOUNT_SCALING_DIVISORS = [
  1500n,
  1200n,
  1000n,
  800n,
  600n,
  500n,
  400n,
  300n,
  200n,
  100n,
  50n,
  20n,
  10n,
  5n,
  2n,
  1n,
] as const;

function getMinimumTrialAmount(baseAmountIn: bigint): bigint {
  const configuredBps = Number(process.env.MIN_TRIAL_AMOUNT_BPS ?? "500");
  if (!Number.isFinite(configuredBps) || configuredBps <= 0) {
    return 1n;
  }

  const normalizedBps = Math.max(1, Math.min(10_000, Math.trunc(configuredBps)));
  const minimum = (baseAmountIn * BigInt(normalizedBps)) / 10_000n;
  return minimum > 0n ? minimum : 1n;
}

const TRIANGLE_SYMBOLS: Record<string, Array<[string, string, string]>> = {
  ethereum: [
    ["WETH", "USDC", "USDT"],
    ["WETH", "USDC", "DAI"],
    ["USDC", "USDT", "DAI"],
  ],
  arbitrum: [
    ["WETH", "USDC", "USDT"],
    ["WETH", "USDC", "DAI"],
    ["USDC", "USDT", "DAI"],
  ],
  polygon: [
    ["WMATIC", "USDC", "USDT"],
    ["WMATIC", "USDC", "DAI"],
    ["USDC", "USDT", "DAI"],
  ],
  bnb: [
    ["WBNB", "USDT", "USDC"],
    ["WBNB", "USDT", "DAI"],
    ["USDT", "USDC", "DAI"],
  ],
  avalanche: [
    ["WAVAX", "USDC", "USDT"],
    ["WAVAX", "USDC", "DAI"],
    ["USDC", "USDT", "DAI"],
  ],
};
const profitability = new ProfitabilityController();

function resolveOpportunityFindingWindow() {
  const raw = process.env.TEMP_OPPORTUNITY_FINDING_SECONDS_WINDOW ?? "off";
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized === "off" || normalized === "false" || normalized === "disabled" || normalized === "all") {
    return null;
  }

  const match = normalized.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (!match) {
    return null;
  }

  const startSecond = Math.max(0, Math.min(59, Number(match[1])));
  const endSecond = Math.max(startSecond, Math.min(59, Number(match[2])));
  return { startSecond, endSecond };
}

function toUsdAmount(amount: bigint, decimals = 18) {
  const scale = 10 ** Math.min(decimals, 18);
  return Number(amount) / scale;
}

function buildTrialAmounts(baseAmountIn: bigint): bigint[] {
  const trialAmounts: bigint[] = [];
  const minimumTrialAmount = getMinimumTrialAmount(baseAmountIn);

  for (const divisor of AMOUNT_SCALING_DIVISORS) {
    const amount = baseAmountIn / divisor;
    if (amount <= 0n || amount < minimumTrialAmount) {
      continue;
    }

    if (!trialAmounts.includes(amount)) {
      trialAmounts.push(amount);
    }
  }

  if (trialAmounts.length === 0 && baseAmountIn > 0n) {
    trialAmounts.push(baseAmountIn);
  }

  return trialAmounts.slice(0, Math.max(1, MAX_TRIAL_AMOUNTS));
}

function getChainScanScore(chain: string): number {
  const status = healthMonitor.getStatus()[chain];
  const activeDexCount = getActiveDexes(chain).length;
  const normalizedChain = normalizeDexKey(chain);

  let score = activeDexCount * 10;

  if (status?.healthy) {
    score += 100;
  } else if (status) {
    score -= 50;
  }

  if (status?.latency && status.latency > 0) {
    score -= Math.min(status.latency, 1_000) / 20;
  }

  if (normalizedChain === "ethereum" || normalizedChain === "arbitrum" || normalizedChain === "bnb" || normalizedChain === "base") {
    score += 5;
  }

  return score;
}

function isChainEnabled(chain: string): boolean {
  return !healthMonitor.isTemporarilyDisabled(chain);
}



export async function scan(
  request: ScanRequest,
  pairCandidates?: readonly ScanPairCandidate[],
): Promise<ScanResult> {
  const opportunityWindow = resolveOpportunityFindingWindow();
  const currentSecond = new Date().getSeconds();
  if (opportunityWindow && (currentSecond < opportunityWindow.startSecond || currentSecond > opportunityWindow.endSecond)) {
    console.log("SCAN COMPLETE:", {
      pairs: 0,
      opportunities: 0,
      failedPairs: 0,
      scanWindow: {
        active: false,
        currentSecond,
        startSecond: opportunityWindow.startSecond,
        endSecond: opportunityWindow.endSecond,
        reason: "Temporary opportunity finding window is closed",
      },
    });
    return {
      opportunities: [],
      scannedPairs: 0,
      failedPairs: 0,
      scanWindow: {
        active: false,
        currentSecond,
        startSecond: opportunityWindow.startSecond,
        endSecond: opportunityWindow.endSecond,
        reason: "Temporary opportunity finding window is closed",
      },
      dexActivity: [],
    };
  }

  const healthyChains = new Set(rpcManager.getHealthyChainNames(CHAIN_LIST));
  const canUseHealthyFilter = healthyChains.size > 0;

  const pairs = pairCandidates?.length
    ? [...pairCandidates]
        .filter((candidate) => isChainEnabled(candidate.chain))
        .filter((candidate) => !canUseHealthyFilter || healthyChains.has(candidate.chain as (typeof CHAIN_LIST)[number]))
        .map((candidate) => ({
          chain: candidate.chain,
          tokenIn: candidate.tokenIn,
          tokenOut: candidate.tokenOut,
        }))
        .sort((left, right) => {
          const chainDelta = getChainScanScore(right.chain) - getChainScanScore(left.chain);
          if (chainDelta !== 0) {
            return chainDelta;
          }

          const leftDexCount = getActiveDexes(left.chain).length;
          const rightDexCount = getActiveDexes(right.chain).length;
          if (rightDexCount !== leftDexCount) {
            return rightDexCount - leftDexCount;
          }

          return `${left.chain}:${left.tokenIn}:${left.tokenOut}`.localeCompare(`${right.chain}:${right.tokenIn}:${right.tokenOut}`);
        })
    : buildTokenPairs(
        request.tokens,
      ).map((pair) => ({
        chain: request.chain,
        tokenIn: pair.tokenIn,
        tokenOut: pair.tokenOut,
      }))
        .filter((pair) => isChainEnabled(pair.chain))
        .filter((pair) => !canUseHealthyFilter || healthyChains.has(pair.chain));


  let failedPairs = 0;
  const dexActivity = new Map<string, { quotes: number; pairs: Set<string>; opportunities: number }>();
  initializeTokenRegistry();

  const ensureDexActivity = (dex: string) => {
    const normalizedDex = dex.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const current = dexActivity.get(normalizedDex) ?? { quotes: 0, pairs: new Set<string>(), opportunities: 0 };
    dexActivity.set(normalizedDex, current);
    return current;
  };



  const tasks =
    pairs.map(
      (pair) => async () => {

        try {


          if (
            pair.tokenIn === pair.tokenOut
          ) {
            return null;
          }


          const amountIn =
            buildAmountIn(
              pair.chain,
              pair.tokenIn,
            );


          if (
            amountIn <= 0n
          ) {
            return null;
          }



          const trialAmounts = buildTrialAmounts(amountIn);
          let bestOpportunity: Opportunity | null = null;
          const pairKey = `${pair.chain}:${pair.tokenIn}:${pair.tokenOut}`;

          for (const trialAmountIn of trialAmounts) {
            const quotes =
              await getQuotes(
                pair.chain,
                pair.tokenIn,
                pair.tokenOut,
                trialAmountIn,
              );

            for (const quote of quotes) {
              const currentDex = ensureDexActivity(quote.dex);
              currentDex.quotes += 1;
              currentDex.pairs.add(pairKey);
            }


            const discoveredOpportunity =
              await findOpportunity(
                pair.chain,
                pair.tokenIn,
                pair.tokenOut,
                trialAmountIn,
                quotes,
              );


            if (!discoveredOpportunity) {
              continue;
            }

            if (
              !bestOpportunity
              || scoreOpportunity(discoveredOpportunity) > scoreOpportunity(bestOpportunity)
              || (
                scoreOpportunity(discoveredOpportunity) === scoreOpportunity(bestOpportunity)
                && discoveredOpportunity.netProfit > bestOpportunity.netProfit
              )
            ) {
              bestOpportunity = discoveredOpportunity;
            }
          }

          return bestOpportunity;



        } catch (error) {

          failedPairs++;

          return null;
        }

      },
    );

  const triangleScansEnabled = process.env.ENABLE_TRIANGLE_SCANS !== "false";
  const triangleTasks = triangleScansEnabled
    ? Object.entries(TRIANGLE_SYMBOLS).flatMap(([chain, triangles]) =>
        triangles.map(([symbolA, symbolB, symbolC]) => async () => {
          try {
            const tokenA = tokenRegistry.get(chain, symbolA);
            const tokenB = tokenRegistry.get(chain, symbolB);
            const tokenC = tokenRegistry.get(chain, symbolC);

            if (!tokenA || !tokenB || !tokenC) {
              return null;
            }

            const amountIn = buildAmountIn(chain, tokenA.address as `0x${string}`);
            if (amountIn <= 0n) {
              return null;
            }

            return await findTriangleOpportunity(
              chain as any,
              tokenA.address as `0x${string}`,
              tokenB.address as `0x${string}`,
              tokenC.address as `0x${string}`,
              amountIn,
            );
          } catch {
            failedPairs++;
            return null;
          }
        }),
      )
    : [];

  const results =
    await runWithConcurrency(
      tasks,
      SCAN_CONCURRENCY,
    );

  const triangleResults = triangleTasks.length
    ? await runWithConcurrency(triangleTasks, 1)
    : [];



  const opportunities: Opportunity[] = [];



  for (const opportunity of [...results, ...triangleResults]) {


    if (!opportunity) {
      continue;
    }


    const risk =
      checkOpportunityRisk(
        opportunity,
      );


    const pair = `${opportunity.buyDex}/${opportunity.sellDex}`;
    const qualityGate = profitability.evaluateQualityGate({
      chain: opportunity.chain,
      pair,
      buyDex: opportunity.buyDex,
      sellDex: opportunity.sellDex,
      amountUsd: toUsdAmount(opportunity.buyAmount, opportunity.tokenInDecimals ?? 18),
      grossProfitUsd: toUsdAmount(opportunity.grossProfit, opportunity.tokenInDecimals ?? 18),
      netProfitUsd: toUsdAmount(opportunity.netProfit, opportunity.tokenInDecimals ?? 18),
      gasCostUsd: toUsdAmount(opportunity.gasCost, opportunity.tokenInDecimals ?? 18),
      slippageBps: Number(opportunity.slippageBps ?? 0),
      gasImpactBps: Number(opportunity.gasImpactBps ?? 0),
      confidenceHint: 90,
    });
    if (risk.approved && qualityGate.allowed) {
      opportunities.push(opportunity);
      continue;
    }

    const slippageBps = opportunity.slippageBps ?? 0;
    const gasImpactBps = opportunity.gasImpactBps ?? 0;
    const passesFallbackQualityGate = (
      opportunity.profitable
      && opportunity.netProfit > 0n
      && opportunity.netProfit > (opportunity.buyAmount * 1n) / 1000n
      && slippageBps <= 600
      && gasImpactBps <= 400
    );

    if (passesFallbackQualityGate && qualityGate.allowed) {
      opportunities.push(opportunity);
    }

  }

  const scoreOpportunity = (opportunity: Opportunity): number => {
    const profitScore = Number(opportunity.netProfit) / 1e18;
    const slippagePenalty = (opportunity.slippageBps ?? 0) * 0.075;
    const gasPenalty = (opportunity.gasImpactBps ?? 0) * 0.04;
    return profitScore - slippagePenalty - gasPenalty;
  };

  opportunities.sort(
    (a, b) => scoreOpportunity(b) - scoreOpportunity(a),
  );

  for (const opportunity of opportunities) {
    ensureDexActivity(opportunity.buyDex).opportunities += 1;
    ensureDexActivity(opportunity.sellDex).opportunities += 1;
  }



  console.log(
    "SCAN COMPLETE:",
    {
      pairs: pairs.length,
      opportunities: opportunities.length,
      failedPairs,
      scanWindow: opportunityWindow ? {
        active: true,
        currentSecond,
        startSecond: opportunityWindow.startSecond,
        endSecond: opportunityWindow.endSecond,
      } : undefined,
    },
  );



  return {

    opportunities,

    scannedPairs:
      pairs.length,

    failedPairs,
    scanWindow: opportunityWindow ? {
      active: currentSecond >= opportunityWindow.startSecond && currentSecond <= opportunityWindow.endSecond,
      currentSecond,
      startSecond: opportunityWindow.startSecond,
      endSecond: opportunityWindow.endSecond,
    } : undefined,
    dexActivity: Array.from(dexActivity.entries()).map(([dex, activity]) => ({
      dex,
      quotes: activity.quotes,
      pairs: activity.pairs.size,
      opportunities: activity.opportunities,
    })),

  };
}