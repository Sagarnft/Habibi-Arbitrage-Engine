import { estimateGas } from "../../gas/index.js";
import { getQuotes } from "../../aggregator/quoteAggregator.js";
import { initializeTokenRegistry } from "../../tokens/init.js";
import { tokenRegistry } from "../../tokens/registry.js";
function getTokenSymbol(chain, address) {
    initializeTokenRegistry();
    const normalized = address.toLowerCase();
    return tokenRegistry.getAll(chain).find((token) => token.address.toLowerCase() === normalized)?.symbol ?? address.slice(0, 8);
}
function getMinNetProfitBps() {
    const raw = process.env.MIN_NET_PROFIT_BPS ?? "25";
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 25n;
    }
    return BigInt(Math.trunc(parsed));
}
const MIN_NET_PROFIT_BPS = getMinNetProfitBps();
function getWrappedNativeAddress(chain) {
    initializeTokenRegistry();
    const nativeToken = tokenRegistry.getAll(chain).find((candidate) => candidate.isNative && candidate.wrapped);
    if (nativeToken?.wrapped) {
        return nativeToken.wrapped;
    }
    const wrappedToken = tokenRegistry
        .getAll(chain)
        .find((candidate) => ["WETH", "WBNB", "WMATIC", "WAVAX"].includes(candidate.symbol));
    return wrappedToken?.address ?? null;
}
async function getGasCostInAssetUnits(chain, tokenIn, gasCostWei) {
    initializeTokenRegistry();
    const normalizedToken = tokenIn.toLowerCase();
    const token = tokenRegistry
        .getAll(chain)
        .find((candidate) => candidate.address.toLowerCase() === normalizedToken);
    if (!token) {
        return 0n;
    }
    if (token.isNative || token.wrapped?.toLowerCase() === normalizedToken) {
        return gasCostWei;
    }
    const wrappedNativeAddress = getWrappedNativeAddress(chain);
    if (!wrappedNativeAddress || wrappedNativeAddress.toLowerCase() === normalizedToken) {
        return gasCostWei;
    }
    try {
        const conversionQuotes = await getQuotes(chain, wrappedNativeAddress, tokenIn, gasCostWei);
        const bestQuote = conversionQuotes
            .sort(compareQuoteCandidates)[0];
        if (bestQuote?.amountOut && bestQuote.amountOut > 0n) {
            return bestQuote.amountOut;
        }
    }
    catch {
        return 0n;
    }
    return 0n;
}
function isLiquidityHealthy(tradeSize, reserveIn) {
    if (tradeSize <= 0n || reserveIn <= 0n) {
        return false;
    }
    const maxPoolUsageBps = BigInt(process.env.MAX_POOL_USAGE_BPS ?? "4000");
    const poolUsageBps = (tradeSize * 10000n) / reserveIn;
    return poolUsageBps <= maxPoolUsageBps;
}
function estimateTradeImpactBps(amountIn, reserveIn) {
    if (amountIn <= 0n || reserveIn <= 0n) {
        return 0;
    }
    const usageBps = Number((amountIn * 10000n) / reserveIn);
    const nonLinearImpact = usageBps / 2 + (usageBps * usageBps) / 50_000;
    return Math.min(5_000, Math.max(0, Math.round(nonLinearImpact)));
}
function estimateRouteMetrics(amountIn, grossProfit, gasCost, buyQuote, sellQuote) {
    const buyImpact = estimateTradeImpactBps(amountIn, buyQuote.reserveIn);
    const sellImpact = estimateTradeImpactBps(buyQuote.amountOut, sellQuote.reserveIn);
    const slippageBps = Math.max(buyImpact, sellImpact);
    const routeSize = grossProfit > 0n ? grossProfit + amountIn : amountIn;
    const gasImpactBps = routeSize > 0n
        ? Number((gasCost * 10000n) / routeSize)
        : 0;
    return {
        slippageBps,
        gasImpactBps: Math.min(5_000, gasImpactBps),
    };
}
function getReserveQualityScore(amountIn, reserveIn, reserveOut) {
    if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
        return 0;
    }
    const usageBps = Number((amountIn * 10000n) / reserveIn);
    const outputDepthBps = Number((amountIn * 10000n) / reserveOut);
    const usagePenalty = Math.min(100, usageBps / 2);
    const depthPenalty = Math.min(100, outputDepthBps / 2);
    const score = 100 - ((usagePenalty + depthPenalty) / 2);
    return Math.max(0, Math.min(100, Math.round(score)));
}
function getFreshnessPenalty(opportunity) {
    const quoteAgeMs = Number(opportunity.quoteAgeMs ?? 0);
    const blockAge = Number(opportunity.blockAge ?? 0);
    const quotePenalty = Number.isFinite(quoteAgeMs) && quoteAgeMs > 0
        ? Math.min(20, Math.round(quoteAgeMs / 15000))
        : 0;
    const blockPenalty = Number.isFinite(blockAge) && blockAge > 0
        ? Math.min(12, Math.round(blockAge * 2))
        : 0;
    return quotePenalty + blockPenalty;
}
export function scoreOpportunity(opportunity) {
    const slippagePenalty = Math.min(100, opportunity.slippageBps ?? 0);
    const gasPenalty = Math.min(100, opportunity.gasImpactBps ?? 0);
    const freshnessPenalty = getFreshnessPenalty(opportunity);
    const qualityWeight = Math.max(0, 100 - slippagePenalty - (gasPenalty / 2) - freshnessPenalty);
    const normalizedProfit = Math.max(0, Number(opportunity.netProfit) / 1_000_000);
    return normalizedProfit * (qualityWeight / 100);
}
function compareQuoteCandidates(left, right) {
    if (left.amountOut !== right.amountOut) {
        return left.amountOut > right.amountOut ? -1 : 1;
    }
    const leftAge = left.quoteAgeMs ?? Number.POSITIVE_INFINITY;
    const rightAge = right.quoteAgeMs ?? Number.POSITIVE_INFINITY;
    if (leftAge !== rightAge) {
        return leftAge - rightAge;
    }
    const leftBlockAge = left.blockAge ?? Number.POSITIVE_INFINITY;
    const rightBlockAge = right.blockAge ?? Number.POSITIVE_INFINITY;
    if (leftBlockAge !== rightBlockAge) {
        return leftBlockAge - rightBlockAge;
    }
    return left.dex.localeCompare(right.dex);
}
export async function findOpportunity(chain, tokenIn, tokenOut, amountIn, quotes) {
    const liveQuotes = quotes.filter((quote) => quote.status === "LIVE");
    if (liveQuotes.length < 2) {
        return null;
    }
    const gas = await estimateGas(chain);
    const gasCostInQuoteAsset = await getGasCostInAssetUnits(chain, tokenIn, gas.gasCostWei);
    let bestOpportunity = null;
    for (const buyQuote of liveQuotes) {
        const sellQuotes = await getQuotes(chain, tokenOut, tokenIn, buyQuote.amountOut);
        const sellQuote = sellQuotes
            .filter((quote) => quote.status === "LIVE")
            .filter((quote) => quote.dex !== buyQuote.dex)
            .sort(compareQuoteCandidates)[0];
        if (!sellQuote) {
            continue;
        }
        if (!isLiquidityHealthy(amountIn, buyQuote.reserveIn) || !isLiquidityHealthy(buyQuote.amountOut, sellQuote.reserveIn)) {
            continue;
        }
        const grossProfit = sellQuote.amountOut - amountIn;
        const netProfit = grossProfit - gasCostInQuoteAsset;
        const minimumNetProfit = (amountIn * MIN_NET_PROFIT_BPS) / 10000n;
        if (netProfit < minimumNetProfit) {
            continue;
        }
        const routeMetrics = estimateRouteMetrics(amountIn, grossProfit, gasCostInQuoteAsset, buyQuote, sellQuote);
        const reserveQuality = getReserveQualityScore(amountIn, buyQuote.reserveIn, sellQuote.reserveIn);
        const maxImpactBps = Number(process.env.MAX_ROUTE_IMPACT_BPS ?? "1500");
        const maxGasImpactBps = Number(process.env.MAX_GAS_IMPACT_BPS ?? "500");
        if (reserveQuality < 15 || routeMetrics.slippageBps > maxImpactBps || routeMetrics.gasImpactBps > maxGasImpactBps) {
            continue;
        }
        const candidate = {
            chain,
            tokenIn,
            tokenOut,
            tokenInDecimals: buyQuote.tokenInDecimals,
            tokenOutDecimals: buyQuote.tokenOutDecimals,
            buyDex: buyQuote.dex,
            sellDex: sellQuote.dex,
            buyAmount: amountIn,
            sellAmount: sellQuote.amountOut,
            grossProfit,
            gasCost: gasCostInQuoteAsset,
            netProfit,
            routeLabel: `${buyQuote.dex} → ${sellQuote.dex}`,
            legs: [
                { dex: buyQuote.dex, tokenIn, tokenOut },
                { dex: sellQuote.dex, tokenIn: tokenOut, tokenOut: tokenIn },
            ],
            profitable: true,
            slippageBps: routeMetrics.slippageBps,
            gasImpactBps: routeMetrics.gasImpactBps,
            quoteAgeMs: Math.max(buyQuote.quoteAgeMs ?? 0, sellQuote.quoteAgeMs ?? 0),
            blockAge: Math.max(buyQuote.blockAge ?? 0, sellQuote.blockAge ?? 0),
        };
        const candidateScore = scoreOpportunity(candidate);
        const currentScore = bestOpportunity ? scoreOpportunity(bestOpportunity) : Number.NEGATIVE_INFINITY;
        if (!bestOpportunity || candidateScore > currentScore || (candidateScore === currentScore && netProfit > bestOpportunity.netProfit)) {
            bestOpportunity = candidate;
        }
    }
    return bestOpportunity;
}
export async function findTriangleOpportunity(chain, tokenA, tokenB, tokenC, amountIn) {
    const gas = await estimateGas(chain);
    const firstLegQuotes = (await getQuotes(chain, tokenA, tokenB, amountIn))
        .filter((quote) => quote.status === "LIVE");
    if (firstLegQuotes.length === 0) {
        return null;
    }
    const candidateFirstLegs = [...firstLegQuotes]
        .sort(compareQuoteCandidates)
        .slice(0, 2);
    let bestOpportunity = null;
    for (const firstLeg of candidateFirstLegs) {
        const secondLegQuotes = (await getQuotes(chain, tokenB, tokenC, firstLeg.amountOut))
            .filter((quote) => quote.status === "LIVE");
        const candidateSecondLegs = secondLegQuotes
            .filter((quote) => quote.dex !== firstLeg.dex)
            .sort(compareQuoteCandidates)
            .slice(0, 2);
        for (const secondLeg of candidateSecondLegs) {
            const thirdLegQuotes = (await getQuotes(chain, tokenC, tokenA, secondLeg.amountOut))
                .filter((quote) => quote.status === "LIVE");
            const thirdLeg = thirdLegQuotes
                .filter((quote) => quote.dex !== firstLeg.dex && quote.dex !== secondLeg.dex)
                .sort(compareQuoteCandidates)[0];
            if (!thirdLeg) {
                continue;
            }
            if (!isLiquidityHealthy(amountIn, firstLeg.reserveIn) || !isLiquidityHealthy(firstLeg.amountOut, secondLeg.reserveIn) || !isLiquidityHealthy(secondLeg.amountOut, thirdLeg.reserveIn)) {
                continue;
            }
            const grossProfit = thirdLeg.amountOut - amountIn;
            const gasCostInAssetUnits = await getGasCostInAssetUnits(chain, tokenA, gas.gasCostWei * 3n);
            const netProfit = grossProfit - gasCostInAssetUnits;
            const minimumNetProfit = (amountIn * MIN_NET_PROFIT_BPS) / 10000n;
            if (netProfit < minimumNetProfit) {
                continue;
            }
            const routeMetrics = estimateRouteMetrics(amountIn, grossProfit, gasCostInAssetUnits, firstLeg, thirdLeg);
            const reserveQuality = getReserveQualityScore(amountIn, firstLeg.reserveIn, thirdLeg.reserveIn);
            const maxImpactBps = Number(process.env.MAX_ROUTE_IMPACT_BPS ?? "1500");
            const maxGasImpactBps = Number(process.env.MAX_GAS_IMPACT_BPS ?? "500");
            if (reserveQuality < 15 || routeMetrics.slippageBps > maxImpactBps || routeMetrics.gasImpactBps > maxGasImpactBps) {
                continue;
            }
            const candidate = {
                chain,
                tokenIn: tokenA,
                tokenOut: tokenA,
                tokenInDecimals: firstLeg.tokenInDecimals,
                tokenOutDecimals: thirdLeg.tokenOutDecimals,
                buyDex: firstLeg.dex,
                sellDex: thirdLeg.dex,
                buyAmount: amountIn,
                sellAmount: thirdLeg.amountOut,
                grossProfit,
                gasCost: gasCostInAssetUnits,
                netProfit,
                routeLabel: `${getTokenSymbol(chain, tokenA)} → ${getTokenSymbol(chain, tokenB)} → ${getTokenSymbol(chain, tokenC)} → ${getTokenSymbol(chain, tokenA)}`,
                legs: [
                    { dex: firstLeg.dex, tokenIn: tokenA, tokenOut: tokenB },
                    { dex: secondLeg.dex, tokenIn: tokenB, tokenOut: tokenC },
                    { dex: thirdLeg.dex, tokenIn: tokenC, tokenOut: tokenA },
                ],
                profitable: true,
                slippageBps: routeMetrics.slippageBps,
                gasImpactBps: routeMetrics.gasImpactBps,
                quoteAgeMs: Math.max(firstLeg.quoteAgeMs ?? 0, secondLeg.quoteAgeMs ?? 0, thirdLeg.quoteAgeMs ?? 0),
                blockAge: Math.max(firstLeg.blockAge ?? 0, secondLeg.blockAge ?? 0, thirdLeg.blockAge ?? 0),
            };
            const candidateScore = scoreOpportunity(candidate);
            const currentScore = bestOpportunity ? scoreOpportunity(bestOpportunity) : Number.NEGATIVE_INFINITY;
            if (!bestOpportunity || candidateScore > currentScore || (candidateScore === currentScore && netProfit > bestOpportunity.netProfit)) {
                bestOpportunity = candidate;
            }
        }
    }
    return bestOpportunity;
}
