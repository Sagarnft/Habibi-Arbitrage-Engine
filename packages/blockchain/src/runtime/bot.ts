import { runEngine } from "../core/index.js";

import {
  initializeTokenRegistry,
} from "../tokens/init.js";

import {
  tokenRegistry,
} from "../tokens/registry.js";
import { healthMonitor } from "../providers/healthMonitor.js";
import { getActiveDexes } from "../dex/activeDexes.js";
import { rpcManager } from "../providers/rpcManager.js";
import { CHAIN_LIST } from "../chains.js";

import type {
  ScanRequest,
} from "../dex/scanner/types.js";

import { botConfig } from "./config.js";

function getTokenSymbol(chain: string, address: string) {
  const normalizedAddress = address.toLowerCase();
  return tokenRegistry.getAll(chain).find((token) => token.address.toLowerCase() === normalizedAddress)?.symbol
    ?? `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatOpportunityAmount(value: bigint, decimals = 18) {
  const scale = 10 ** Math.min(decimals, 18);
  const normalized = Number(value) / scale;
  const absolute = Math.abs(normalized);
  const precision = absolute >= 1 ? 2 : absolute >= 0.01 ? 4 : 6;
  return `$${normalized.toFixed(precision)}`;
}

async function updateDashboard(data: Record<string, unknown>) {

  try{

    await fetch(
      "http://localhost:4000/dashboard/update",
      {
        method:"POST",

        headers:{
          "Content-Type":"application/json",
        },

        body:JSON.stringify(data),
      },
    );

  }catch(error){

    console.log(
      "Dashboard update failed",
      error,
    );

  }

}


initializeTokenRegistry();


const chainAllowedTokens: Record<string, readonly string[]> = {
  ethereum: ["USDC", "USDT", "DAI", "WETH", "WBTC", "ARB", "LINK", "UNI", "cbETH", "wstETH", "LUSD", "FRAX"],
  arbitrum: ["USDC", "USDT", "DAI", "WETH", "WBTC", "ARB", "LINK", "UNI", "GMX", "FRAX"],
  polygon: ["USDC", "USDT", "DAI", "WMATIC", "WETH", "WBTC", "MATIC", "LINK", "AAVE", "QUICK"],
  bnb: ["USDC", "USDT", "BUSD", "WBNB", "BTCB", "ETH", "ADA", "LINK", "UNI", "CAKE"],
  base: ["USDC", "USDT", "DAI", "WETH", "cbETH", "LINK", "UNI", "BASE"],
  optimism: ["USDC", "USDT", "DAI", "WETH", "WBTC", "OP", "LINK", "UNI"],
  linea: ["USDC", "USDT", "DAI", "WETH", "WBTC", "LINK", "UNI"],
  scroll: ["USDC", "USDT", "DAI", "WETH", "WBTC", "LINK", "UNI"],
  zksync: ["USDC", "USDT", "DAI", "WETH", "WBTC", "LINK", "UNI"],
  avalanche: ["USDC", "USDT", "DAI", "WAVAX", "WBTC", "ETH", "LINK", "PNG"],
};

const majorTokenFallbackSymbols = new Set([
  "USDC", "USDT", "DAI", "WETH", "WBTC", "ETH", "WBNB", "BTCB", "WMATIC", "MATIC", "WAVAX",
  "AVAX", "ARB", "OP", "LINK", "UNI", "AAVE", "QUICK", "cbETH", "wstETH", "LUSD", "FRAX",
  "GMX", "CAKE", "BUSD", "BASE", "PNG",
]);

function getAllowedTokens(chain: string): readonly `0x${string}`[] {
  const allowed = chainAllowedTokens[chain] ?? chainAllowedTokens.ethereum;
  const registryTokens = tokenRegistry.getAll(chain);
  const allowedSet = new Set([...allowed, ...majorTokenFallbackSymbols]);

  return registryTokens
    .filter((token) => allowedSet.has(token.symbol))
    .map((token) => token.address as `0x${string}`);
}

const scanRequest: ScanRequest = {

  chain: "ethereum",

  amountIn:
    1000n * 10n ** 6n,


  tokens: getAllowedTokens("ethereum"),

};

const scanRequests: ScanRequest[] = CHAIN_LIST.map((chain) => ({
  chain,
  amountIn: 1000n * 10n ** 6n,
  tokens: getAllowedTokens(chain),
}));

const CHAIN_PRIORITY_RANK: Record<string, number> = {
  ethereum: 10,
  base: 9,
  arbitrum: 9,
  polygon: 8,
  bnb: 8,
  optimism: 7,
  zksync: 7,
  linea: 6,
  scroll: 6,
  avalanche: 5,
};

function getChainPriority(chain: string): number {
  const status = healthMonitor.getStatus()[chain];
  const activeDexCount = getActiveDexes(chain).length;
  const priorityRank = CHAIN_PRIORITY_RANK[chain] ?? 0;

  let score = activeDexCount * 10 + priorityRank * 25;

  if (status?.healthy) {
    score += 100;
  } else if (status) {
    score -= 50;
  }

  if (status?.latency && status.latency > 0) {
    score -= Math.min(status.latency, 1_000) / 20;
  }

  return score;
}

function isChainEnabled(chain: string): boolean {
  return !healthMonitor.isTemporarilyDisabled(chain);
}



export async function startBot() {

  console.log(
    "🤖 Arbitrage Bot Started",
  );


  console.log(
    "Tokens Loaded:",
    scanRequest.tokens.length,
  );


  while(true){

    try{

      const healthyChains = new Set(rpcManager.getHealthyChainNames(CHAIN_LIST));
      const canUseHealthyFilter = healthyChains.size > 0;
      const enabledRequests = scanRequests.filter((request) => isChainEnabled(request.chain));
      const healthyRequests = enabledRequests.filter((request) => !canUseHealthyFilter || healthyChains.has(request.chain));
      const orderedRequests = (healthyRequests.length ? healthyRequests : enabledRequests.length ? enabledRequests : scanRequests)
        .slice()
        .sort((left, right) => getChainPriority(right.chain) - getChainPriority(left.chain));
      const prioritizedChains = orderedRequests.map((request) => request.chain).join(", ");
      console.log("Scanning chain priority:", prioritizedChains);
      let result = await runEngine(orderedRequests[0] ?? scanRequest);
      for (const request of orderedRequests.slice(1)) {
        if (result.success && result.opportunity) {
          break;
        }

        const nextResult = await runEngine(request);
        if (nextResult.success && nextResult.opportunity) {
          result = nextResult;
          break;
        }
      }


      if (result.success && result.opportunity) {

  console.log(
    "🔥 Opportunity Found:",
    result.opportunity,
  );


  const opportunity = result.opportunity;
  const pair = `${getTokenSymbol(opportunity.chain, opportunity.tokenIn)}/${getTokenSymbol(opportunity.chain, opportunity.tokenOut)}`;
  const diffPercent = opportunity.buyAmount > 0n
    ? (Number(opportunity.grossProfit) / Number(opportunity.buyAmount)) * 100
    : 0;

  await updateDashboard({
    status: "running",
    opportunities: 1,
    bestProfit: formatOpportunityAmount(opportunity.netProfit, opportunity.tokenInDecimals),
    bestRoute: `${opportunity.buyDex} → ${opportunity.sellDex}`,
    bestOpportunity: {
      pair,
      buyDex: opportunity.buyDex,
      sellDex: opportunity.sellDex,
      profit: formatOpportunityAmount(opportunity.netProfit, opportunity.tokenInDecimals),
      confidence: "100",
      chain: opportunity.chain,
      category: "major",
    },
    topRoute: {
      pair,
      buyDex: opportunity.buyDex,
      sellDex: opportunity.sellDex,
      profit: formatOpportunityAmount(opportunity.netProfit, opportunity.tokenInDecimals),
      coverage: "100%",
      chain: opportunity.chain,
      category: "major",
    },
    opportunitiesFeed: [{
      pair,
      buyDex: opportunity.buyDex,
      sellDex: opportunity.sellDex,
      diff: `${diffPercent >= 0 ? "+" : ""}${diffPercent.toFixed(2)}%`,
      profit: formatOpportunityAmount(opportunity.grossProfit, opportunity.tokenInDecimals),
      gas: formatOpportunityAmount(opportunity.gasCost, opportunity.tokenInDecimals),
      net: formatOpportunityAmount(opportunity.netProfit, opportunity.tokenInDecimals),
      confidence: "100",
      chain: opportunity.chain,
      category: "major",
    }],
  });


} else {


  console.log(
    "No Opportunity:",
    result.error,
  );


  await updateDashboard({
    status: "running",
    scanStatus: "No profitable opportunity this cycle",
  });


}


    }catch(error){

      console.error(
        "Bot Error:",
        error,
      );

    }


    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          botConfig.intervalMs,
        ),
    );

  }

}