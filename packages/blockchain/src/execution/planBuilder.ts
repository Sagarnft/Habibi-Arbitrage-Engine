import type { TradePlan } from "./types.js";

export type ExecutionPlanRequest = {
  chain?: string;
  walletAddress: string;
  amountUsd: number;
  minimumNotionalUsd: number;
  maxNotionalUsd?: number;
  walletUsdtBalance?: number;
  allowFlashloan?: boolean;
  slippageBps: number;
  route: {
    pair: string;
    buyDex: string;
    sellDex: string;
  };
};

export type ExecutionPlanResponse = {
  plan: TradePlan;
  safety: {
    allowed: boolean;
    reason: string;
  };
};

function toAddress(value: string): `0x${string}` {
  return value as `0x${string}`;
}

function getRouteTokens(chain: string, pair: string): { buyToken: `0x${string}`; sellToken: `0x${string}` } {
  if (chain === "bnb") {
    return {
      buyToken: toAddress("0x55d398326f99059fF775485246999027B3197955"),
      sellToken: toAddress("0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"),
    };
  }

  const normalizedPair = pair.toUpperCase();

  if (normalizedPair.includes("WETH") && normalizedPair.includes("USDC")) {
    return {
      buyToken: toAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
      sellToken: toAddress("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
    };
  }

  return {
    buyToken: toAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
    sellToken: toAddress("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
  };
}

function resolveTradeNotionalLimits({
  walletUsdtBalance,
  minimumNotionalUsd,
  maxNotionalUsd,
}: {
  walletUsdtBalance?: number;
  minimumNotionalUsd?: number;
  maxNotionalUsd?: number;
}): { minimumNotionalUsd: number; maximumNotionalUsd: number } {
  const configuredMinimum = Number.isFinite(minimumNotionalUsd ?? Number.NaN) ? Number(minimumNotionalUsd) : 100;
  const configuredMaximum = Number.isFinite(maxNotionalUsd ?? Number.NaN) ? Number(maxNotionalUsd) : 100;
  const minimumNotional = Math.max(configuredMinimum, 100);
  const maximumNotional = Math.max(configuredMaximum, minimumNotional);

  if (!Number.isFinite(walletUsdtBalance ?? Number.NaN)) {
    return { minimumNotionalUsd: minimumNotional, maximumNotionalUsd: maximumNotional };
  }

  const walletBalance = Number(walletUsdtBalance);
  return {
    minimumNotionalUsd: Math.min(minimumNotional, walletBalance),
    maximumNotionalUsd: Math.min(maximumNotional, walletBalance),
  };
}

export function buildExecutionPlan(request: ExecutionPlanRequest): ExecutionPlanResponse {
  const chain = request.chain === "bnb" || request.chain === "base" || request.chain === "arbitrum" || request.chain === "polygon"
    ? request.chain
    : "ethereum";
  const slippageBps = Number(request.slippageBps ?? 25);
  const amountUsd = Number(request.amountUsd ?? 100);
  const walletUsdtBalance = Number(request.walletUsdtBalance ?? Number.NaN);
  const allowFlashloan = Boolean(request.allowFlashloan);
  const { minimumNotionalUsd, maximumNotionalUsd } = resolveTradeNotionalLimits({
    walletUsdtBalance,
    minimumNotionalUsd: request.minimumNotionalUsd,
    maxNotionalUsd: request.maxNotionalUsd,
  });

  if (!request.walletAddress) {
    return {
      plan: {
        chain,
        steps: [],
        estimatedProfit: 0n,
      },
      safety: {
        allowed: false,
        reason: "Connect MetaMask before executing.",
      },
    };
  }

  if (!allowFlashloan && Number.isFinite(walletUsdtBalance) && walletUsdtBalance < minimumNotionalUsd) {
    return {
      plan: {
        chain,
        steps: [],
        estimatedProfit: 0n,
      },
      safety: {
        allowed: false,
        reason: `Wallet holds ${walletUsdtBalance.toFixed(2)} USDT, which is below the ${minimumNotionalUsd.toFixed(2)} USD minimum notional required for live execution.`,
      },
    };
  }

  if (amountUsd < minimumNotionalUsd) {
    return {
      plan: {
        chain,
        steps: [],
        estimatedProfit: 0n,
      },
      safety: {
        allowed: false,
        reason: `Trade size ${amountUsd.toFixed(0)} USD is below the ${minimumNotionalUsd.toFixed(2)} USD minimum notional.`,
      },
    };
  }

  if (!allowFlashloan && Number.isFinite(walletUsdtBalance) && amountUsd > maximumNotionalUsd) {
    return {
      plan: {
        chain,
        steps: [],
        estimatedProfit: 0n,
      },
      safety: {
        allowed: false,
        reason: `Trade size ${amountUsd.toFixed(2)} USD exceeds the wallet-capped maximum of ${maximumNotionalUsd.toFixed(2)} USDT.`,
      },
    };
  }

  if (!allowFlashloan && Number.isFinite(walletUsdtBalance) && walletUsdtBalance < amountUsd) {
    return {
      plan: {
        chain,
        steps: [],
        estimatedProfit: 0n,
      },
      safety: {
        allowed: false,
        reason: `Wallet balance ${walletUsdtBalance.toFixed(2)} USDT is below required ${amountUsd.toFixed(2)} USDT trade size. Flashloan execution is not connected in this build, so the wallet must fund the entry leg.`,
      },
    };
  }

  if (slippageBps > 50) {
    return {
      plan: {
        chain,
        steps: [],
        estimatedProfit: 0n,
      },
      safety: {
        allowed: false,
        reason: `Slippage tolerance ${slippageBps} bps exceeds the 50 bps safety cap.`,
      },
    };
  }

  const tokens = getRouteTokens(chain, request.route.pair ?? "WETH/USDC");
  const amountIn = BigInt(Math.round(amountUsd * (chain === "bnb" ? 1e18 : 1e6)));
  const firstStepExpectedOut = amountIn;
  const secondStepExpectedOut = amountIn;
  const estimatedProfit = BigInt(Math.max(1, Math.round(amountUsd * 0.005)));

  return {
    plan: {
      chain,
      steps: [
        {
          dex: request.route.buyDex,
          tokenIn: tokens.buyToken,
          tokenOut: tokens.sellToken,
          amountIn,
          expectedOut: firstStepExpectedOut,
        },
        {
          dex: request.route.sellDex,
          tokenIn: tokens.sellToken,
          tokenOut: tokens.buyToken,
          amountIn: firstStepExpectedOut,
          expectedOut: secondStepExpectedOut,
        },
      ],
      estimatedProfit,
    },
    safety: {
      allowed: true,
      reason: "Execution meets the configured safety thresholds.",
    },
  };
}
