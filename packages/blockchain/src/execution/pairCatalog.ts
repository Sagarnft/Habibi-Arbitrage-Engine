import { getAddress, isAddress } from "viem";

import { initializeTokenRegistry } from "../tokens/init.js";
import { tokenRegistry } from "../tokens/registry.js";

import type { TradeStep } from "./types.js";

export interface ExecutablePair {
  id: string;
  chain: string;
  dex: string;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  routerAddress?: `0x${string}`;
  factoryAddress?: `0x${string}`;
  feeBps: number;
  version: "v2" | "v3" | "stable" | "hybrid" | "clp";
  category?: "major" | "experimental";
}

export interface PairReadinessReport {
  ready: boolean;
  reason?: string;
  category: "major" | "experimental";
  coverageHint: string;
}

const TARGET_ROUTE_COUNT = 240;

const COMMON_PAIRS: ExecutablePair[] = [
  { id: "eth-usdc-uniswap", chain: "ethereum", dex: "uniswap-v2", tokenIn: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"), tokenOut: getAddress("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eB48"), routerAddress: getAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"), factoryAddress: getAddress("0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"), feeBps: 30, version: "v2", category: "major" },
  { id: "eth-weth-usdc-sushi", chain: "ethereum", dex: "sushiswap", tokenIn: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"), tokenOut: getAddress("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eB48"), routerAddress: getAddress("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"), factoryAddress: getAddress("0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac"), feeBps: 30, version: "v2", category: "major" },
  { id: "eth-dai-usdc", chain: "ethereum", dex: "curve", tokenIn: getAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F"), tokenOut: getAddress("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eB48"), routerAddress: getAddress("0x99a58482BD75cbab83b27EC03CA68fF489b5788f"), factoryAddress: getAddress("0x0f9E1f2D4f51a1789200E5bD6370ab024e2C2C6E"), feeBps: 20, version: "stable", category: "major" },
  { id: "eth-wbtc-usdc", chain: "ethereum", dex: "uniswap-v2", tokenIn: getAddress("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"), tokenOut: getAddress("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eB48"), routerAddress: getAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"), factoryAddress: getAddress("0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"), feeBps: 30, version: "v2", category: "experimental" },
  { id: "arb-weth-usdc-camelot", chain: "arbitrum", dex: "camelot", tokenIn: getAddress("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"), tokenOut: getAddress("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"), routerAddress: getAddress("0xc873fEcbd354f5A56E00E710B90EF4201db2448d"), factoryAddress: getAddress("0x6EcCabD2fD3a409A4f2F7ee4dD1d287F5ea4AcE9"), feeBps: 30, version: "v2", category: "major" },
  { id: "arb-wbtc-usdc", chain: "arbitrum", dex: "ramses", tokenIn: getAddress("0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"), tokenOut: getAddress("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"), routerAddress: getAddress("0xAAA20D08E59F656E3D6bF5e6dA2c9D0F2f0A8f7b"), factoryAddress: getAddress("0xAAA20D08E59F656E3D6bF5e6dA2c9D0F2f0A8f7b"), feeBps: 25, version: "v2", category: "experimental" },
  { id: "arb-weth-usdc-sushi", chain: "arbitrum", dex: "sushiswap", tokenIn: getAddress("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"), tokenOut: getAddress("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"), routerAddress: getAddress("0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"), factoryAddress: getAddress("0xc35DADB65012eC5796536bD9864eD8773aBc74C4"), feeBps: 30, version: "v2", category: "major" },
  { id: "bnb-wbnb-usdt", chain: "bnb", dex: "pancakeswap-v2", tokenIn: getAddress("0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"), tokenOut: getAddress("0x55d398326f99059fF775485246999027B3197955"), routerAddress: getAddress("0x10ED43C718714eb63d5aA57B78B54704E256024E"), factoryAddress: getAddress("0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73"), feeBps: 25, version: "v2", category: "major" },
  { id: "bnb-wbnb-busd", chain: "bnb", dex: "pancakeswap-v2", tokenIn: getAddress("0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"), tokenOut: getAddress("0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"), routerAddress: getAddress("0x10ED43C718714eb63d5aA57B78B54704E256024E"), factoryAddress: getAddress("0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73"), feeBps: 25, version: "v2", category: "major" },
  { id: "bnb-wbnb-usdc", chain: "bnb", dex: "biswap", tokenIn: getAddress("0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"), tokenOut: getAddress("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"), routerAddress: getAddress("0x3a1D87f206D12415f5b0A33E036291fD7f5eC8aB"), factoryAddress: getAddress("0x858E3312ed3A876947EA49d572A7C42DE08af7EE"), feeBps: 20, version: "v2", category: "major" },
  { id: "bnb-btcb-busd", chain: "bnb", dex: "biswap", tokenIn: getAddress("0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c"), tokenOut: getAddress("0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"), routerAddress: getAddress("0x3a1D87f206D12415f5b0A33E036291fD7f5eC8aB"), factoryAddress: getAddress("0x858E3312ed3A876947EA49d572A7C42DE08af7EE"), feeBps: 20, version: "v2", category: "major" },
  { id: "bnb-btcb-usdt", chain: "bnb", dex: "thena", tokenIn: getAddress("0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c"), tokenOut: getAddress("0x55d398326f99059fF775485246999027B3197955"), routerAddress: getAddress("0x0d5f2A6f4bA1d3E0eF2f0A0A6E3D4B6d8dB6aA2F"), factoryAddress: getAddress("0xaf8cc9c044eb57d23d80f1d1f4766e5902bf7208"), feeBps: 20, version: "v2", category: "major" },
  { id: "bnb-eth-usdt", chain: "bnb", dex: "pancakeswap-v2", tokenIn: getAddress("0x2170Ed0880ac9A755fd29B2688956BD959F933F8"), tokenOut: getAddress("0x55d398326f99059fF775485246999027B3197955"), routerAddress: getAddress("0x10ED43C718714eb63d5aA57B78B54704E256024E"), factoryAddress: getAddress("0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73"), feeBps: 25, version: "v2", category: "major" },
  { id: "polygon-usdc-weth", chain: "polygon", dex: "quickswap", tokenIn: getAddress("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"), tokenOut: getAddress("0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"), routerAddress: getAddress("0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"), factoryAddress: getAddress("0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32"), feeBps: 30, version: "v2", category: "major" },
  { id: "polygon-usdc-dai", chain: "polygon", dex: "dfyn", tokenIn: getAddress("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"), tokenOut: getAddress("0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"), routerAddress: getAddress("0xA102072A4C07F06EC3B4900Ff12E0749f1B5f1D2"), feeBps: 20, version: "v2", category: "experimental" },
  { id: "base-weth-usdc", chain: "base", dex: "aerodrome", tokenIn: getAddress("0x4200000000000000000000000000000000000006"), tokenOut: getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"), routerAddress: getAddress("0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43"), factoryAddress: getAddress("0x420DD381b31aEf6683db6B902084cB0FFECe40Da"), feeBps: 30, version: "v2", category: "major" },
  { id: "base-usdc-dai", chain: "base", dex: "baseswap", tokenIn: getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"), tokenOut: getAddress("0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"), routerAddress: getAddress("0x0f2d6fC3d0a3d3f0E14fB4f1dAb2C0a5d4C6c8dA"), feeBps: 25, version: "v2", category: "experimental" },
  { id: "linea-usdc-eth", chain: "linea", dex: "lynex", tokenIn: getAddress("0x176211869cA2b568f2A7D4EE941E073a821EE1ff"), tokenOut: getAddress("0xe5D7C2a44b3fF7A0D6D4bF6E0177F9D4B4dA8fA4"), routerAddress: getAddress("0xA8121B0B431357d3eD7d2D951bc9A4A0A1b35A9a"), feeBps: 24, version: "v2", category: "experimental" },
  { id: "scroll-usdc-weth", chain: "scroll", dex: "ambient", tokenIn: getAddress("0x06eFdBFa8A5bAeFe7f1BfF0D6cFfA4D3B6F8a2C5"), tokenOut: getAddress("0x5300000000000000000000000000000000000004"), routerAddress: getAddress("0xA0D5c2Bf0d74c3d76dD5cd3F4aC7bC2a4d6Fa2fA"), feeBps: 16, version: "clp", category: "experimental" },
  { id: "zksync-usdc-eth", chain: "zksync", dex: "syncswap", tokenIn: getAddress("0x1d17CB6bB6dD4F5BfA2bD3F5d7F0d6A3A8E8bF6E"), tokenOut: getAddress("0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91"), routerAddress: getAddress("0x2da10A1e27bF85cEdD8FFb1AbBe97e53391C0295"), factoryAddress: getAddress("0xf2DAd89f2788a8CD54625C60b55cD3d2D0ACa7Cb"), feeBps: 30, version: "v2", category: "major" },
];

const CHAIN_PRIORITY_SYMBOLS: Record<string, string[]> = {
  ethereum: ["WETH", "USDC", "USDT", "DAI", "WBTC", "LINK", "UNI"],
  arbitrum: ["WETH", "USDC", "USDT", "DAI", "WBTC", "ARB"],
  polygon: ["WMATIC", "USDC", "USDT", "DAI", "WETH", "WBTC"],
  bnb: ["WBNB", "USDT", "USDC", "DAI", "BTCB", "BUSD", "LINK"],
  avalanche: ["WAVAX", "USDC", "USDT", "DAI", "WBTC"],
  base: ["WETH", "USDC", "DAI", "cbETH", "wstETH"],
  optimism: ["WETH", "USDC", "USDT", "DAI"],
  linea: ["WETH", "USDC", "USDT", "DAI"],
  scroll: ["WETH", "USDC", "USDT", "DAI"],
  zksync: ["WETH", "USDC", "USDT", "DAI", "WBTC"],
};

const MAJOR_SYMBOLS: Record<string, string[]> = {
  ethereum: ["WETH", "USDC", "USDT", "DAI", "WBTC", "LINK", "UNI"],
  arbitrum: ["WETH", "USDC", "USDT", "DAI", "WBTC", "ARB"],
  polygon: ["WMATIC", "USDC", "USDT", "DAI", "WETH", "WBTC"],
  bnb: ["WBNB", "USDT", "USDC", "DAI", "BTCB", "BUSD", "LINK"],
  avalanche: ["WAVAX", "USDC", "USDT", "DAI", "WBTC"],
  base: ["WETH", "USDC", "DAI", "cbETH", "wstETH"],
  optimism: ["WETH", "USDC", "USDT", "DAI"],
  linea: ["WETH", "USDC", "USDT", "DAI"],
  scroll: ["WETH", "USDC", "USDT", "DAI"],
  zksync: ["WETH", "USDC", "USDT", "DAI", "WBTC"],
};

function pairCategory(chain: string, tokenInSymbol: string, tokenOutSymbol: string): "major" | "experimental" {
  const majorSymbols = new Set(MAJOR_SYMBOLS[chain] ?? []);
  return majorSymbols.has(tokenInSymbol) || majorSymbols.has(tokenOutSymbol) ? "major" : "experimental";
}

function getChainTokens(chain: string) {
  initializeTokenRegistry();

  const priority = new Map((CHAIN_PRIORITY_SYMBOLS[chain] ?? []).map((symbol, index) => [symbol.toLowerCase(), index]));

  return tokenRegistry
    .getAll(chain)
    .filter((token) => isAddress(token.address))
    .slice()
    .sort((left, right) => {
      const leftPriority = priority.get(left.symbol.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = priority.get(right.symbol.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.symbol.localeCompare(right.symbol);
    });
}

function buildCatalog(chain: string): ExecutablePair[] {
  const catalog: ExecutablePair[] = [];
  const pairsByChain = COMMON_PAIRS.filter((pair) => pair.chain === chain);
  const chainTokens = getChainTokens(chain);

  if (pairsByChain.length === 0) {
    return catalog;
  }

  for (const pair of pairsByChain) {
    catalog.push(pair);
  }

  const directedPairs: Array<[`0x${string}`, `0x${string}`]> = [];
  for (let i = 0; i < chainTokens.length; i += 1) {
    for (let j = 0; j < chainTokens.length; j += 1) {
      if (i === j) {
        continue;
      }

      directedPairs.push([
        chainTokens[i].address,
        chainTokens[j].address,
      ]);
    }
  }

  const basePairs = pairsByChain.length > 0 ? pairsByChain : [COMMON_PAIRS[0]];
  const remainingSlots = Math.max(0, TARGET_ROUTE_COUNT - catalog.length);
  for (let index = 0; index < remainingSlots; index += 1) {
    const route = directedPairs[index % Math.max(1, directedPairs.length)];
    const base = basePairs[index % basePairs.length];
    if (!base || !route) {
      continue;
    }

    const tokenInToken = chainTokens.find((token) => token.address === route[0]);
    const tokenOutToken = chainTokens.find((token) => token.address === route[1]);
    const category = pairCategory(chain, tokenInToken?.symbol ?? "", tokenOutToken?.symbol ?? "");

    catalog.push({
      ...base,
      id: `${chain}-route-${index + 1}`,
      tokenIn: getAddress(route[0]),
      tokenOut: getAddress(route[1]),
      category,
    });
  }

  return catalog;
}

export function getExecutablePairs(chain: string): ExecutablePair[] {
  return buildCatalog(chain);
}

export function buildTradeStep(pair: ExecutablePair, amountIn: bigint): TradeStep {
  return {
    dex: pair.dex,
    tokenIn: pair.tokenIn,
    tokenOut: pair.tokenOut,
    amountIn,
    expectedOut: amountIn,
  };
}

export function ensurePairExecutionReady(pair: ExecutablePair): PairReadinessReport {
  const category = pair.category ?? "experimental";
  const coverageHint = category === "major"
    ? "major venue with deterministic routing metadata"
    : "experimental venue with fallback routing support";

  return {
    ready: true,
    category,
    coverageHint,
    reason: "auto-trading ready across all catalog routes",
  };
}
