import { getAddress, isAddress } from "viem";
import { CHAINS } from "../chains.js";
import { getClient } from "../clients.js";
import { IUniswapV2FactoryABI } from "../contracts/abis/IUniswapV2Factory.js";
import { IUniswapV2PairABI } from "../contracts/abis/IUniswapV2Pair.js";
import { IUniswapV3FactoryABI } from "../contracts/abis/IUniswapV3Factory.js";
import { IUniswapV3QuoterABI } from "../contracts/abis/IUniswapV3Quoter.js";
import { EthereumV3DEXes, BaseV3DEXes, ArbitrumV3DEXes, PolygonV3DEXes, LineaV3DEXes } from "../dex/config/index.js";
import { dexRegistry } from "../dex/registry.js";
import { rpcManager } from "../providers/rpcManager.js";
import { initializeTokenRegistry } from "../tokens/init.js";
import { tokenRegistry } from "../tokens/registry.js";
import { runWithConcurrency } from "../utils/index.js";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const QUOTE_TIMEOUT_MS = Number(process.env.QUOTE_TIMEOUT_MS ?? 12_000);
const QUOTE_RETRY_COUNT = Number(process.env.QUOTE_RETRY_COUNT ?? 2);
const QUOTE_RETRY_BASE_MS = Number(process.env.QUOTE_RETRY_BASE_MS ?? 220);
const QUOTE_FETCH_CONCURRENCY = Number(process.env.QUOTE_FETCH_CONCURRENCY ?? 8);
const QUOTE_CACHE_TTL_MS = Number(process.env.QUOTE_CACHE_TTL_MS ?? 1_500);
const POOL_METADATA_TTL_MS = Number(process.env.POOL_METADATA_TTL_MS ?? 600_000);
const MAX_QUOTE_AGE_MS = Number(process.env.MAX_QUOTE_AGE_MS ?? 20_000);
const MAX_BLOCK_AGE = Number(process.env.MAX_BLOCK_AGE ?? 4);
const MIN_LIQUIDITY_RAW = BigInt(process.env.MIN_QUOTE_LIQUIDITY_RAW ?? "1000");
const MAX_PRICE_DEVIATION_RATIO = Number(process.env.MAX_PRICE_DEVIATION_RATIO ?? 0.35);
const REPRODUCIBILITY_DEVIATION_RATIO = Number(process.env.REPRODUCIBILITY_DEVIATION_RATIO ?? 0.2);
const V3_FEE_TIERS = [100, 500, 3_000, 10_000];
const quoteCache = new Map();
const poolMetadataCache = new Map();
const reproducibilityCache = new Map();
const quoteDiagnostics = new Map();
const supportMatrix = new Map();
function normalizeKey(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function normalizeAddress(address) {
    return getAddress(address);
}
function isZeroAddress(address) {
    return normalizeKey(address) === normalizeKey(ZERO_ADDRESS);
}
function assertPositiveAmount(amount) {
    if (amount <= 0n) {
        throw new Error("Invalid quote amount: amountIn must be > 0");
    }
}
function asChainName(chain) {
    if (chain in CHAINS) {
        return chain;
    }
    return null;
}
function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error(`Quote timed out after ${timeoutMs}ms`)), timeoutMs);
        promise.then((value) => {
            clearTimeout(timeoutId);
            resolve(value);
        }, (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
}
async function withRetry(operation, retries = QUOTE_RETRY_COUNT) {
    let attempt = 0;
    let lastError = null;
    while (attempt <= retries) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt >= retries) {
                throw lastError;
            }
            const backoff = Math.max(QUOTE_RETRY_BASE_MS, QUOTE_RETRY_BASE_MS * (2 ** attempt));
            await wait(backoff);
            attempt += 1;
        }
    }
    throw lastError ?? new Error("Unknown quote retry failure");
}
function toFloatAmount(value, decimals) {
    if (decimals < 0) {
        return 0;
    }
    const scale = 10 ** Math.min(decimals, 18);
    return Number(value) / scale;
}
function computePriceImpact(amountIn, amountOut, reserveIn, reserveOut) {
    if (amountIn <= 0n || amountOut <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
        return 0;
    }
    const idealOut = (amountIn * reserveOut) / reserveIn;
    if (idealOut <= 0n || idealOut < amountOut) {
        return 0;
    }
    return Number(((idealOut - amountOut) * 10000n) / idealOut) / 100;
}
function computeV2AmountOut(amountIn, reserveIn, reserveOut, feeBps) {
    const feeDenominator = 10000n;
    const feeNumerator = feeDenominator - BigInt(Math.max(0, Math.min(10_000, Math.trunc(feeBps))));
    const amountInWithFee = amountIn * feeNumerator;
    const numerator = amountInWithFee * reserveOut;
    const denominator = (reserveIn * feeDenominator) + amountInWithFee;
    if (denominator <= 0n) {
        return 0n;
    }
    return numerator / denominator;
}
function resolveExecutableTokenAddress(chain, address) {
    initializeTokenRegistry();
    const normalizedAddress = address.toLowerCase();
    const token = tokenRegistry.getByAddress(chain, normalizedAddress);
    if (token?.isNative && token.wrapped) {
        return normalizeAddress(token.wrapped);
    }
    if (isZeroAddress(normalizedAddress)) {
        const native = tokenRegistry.getAll(chain).find((candidate) => candidate.isNative && candidate.wrapped);
        if (native?.wrapped) {
            return normalizeAddress(native.wrapped);
        }
    }
    return normalizeAddress(normalizedAddress);
}
function readTokenDecimals(chain, address) {
    initializeTokenRegistry();
    const token = tokenRegistry.getByAddress(chain, address.toLowerCase());
    if (!token) {
        throw new Error(`Token metadata missing for ${chain}:${address}`);
    }
    return token.decimals;
}
const V3_CONFIGS = [
    ...EthereumV3DEXes,
    ...BaseV3DEXes,
    ...ArbitrumV3DEXes,
    ...PolygonV3DEXes,
    ...LineaV3DEXes,
];
function getV3ConfigForAdapter(adapter) {
    if (!normalizeKey(adapter.name).includes("uniswap")) {
        return undefined;
    }
    return V3_CONFIGS.find((config) => config.chain === adapter.chain);
}
function getCacheKey(request, dexId) {
    return `${normalizeKey(dexId)}:${request.chain}:${request.tokenIn.toLowerCase()}:${request.tokenOut.toLowerCase()}:${request.amountIn.toString()}`;
}
function getPoolMetadataKey(dexId, chain, tokenIn, tokenOut) {
    return `${normalizeKey(dexId)}:${chain}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
}
function getReproducibilityKey(quote) {
    return `${normalizeKey(quote.dex)}:${quote.chain}:${quote.tokenIn.toLowerCase()}:${quote.tokenOut.toLowerCase()}:${quote.amountIn.toString()}`;
}
async function getLatestBlock(chain) {
    const chainName = asChainName(chain);
    if (!chainName) {
        return undefined;
    }
    try {
        return await rpcManager.getLatestBlockNumber(chainName);
    }
    catch {
        return undefined;
    }
}
async function quoteFromV2Connector(connector, request, adapter) {
    const startedAt = Date.now();
    assertPositiveAmount(request.amountIn);
    const chainName = asChainName(request.chain);
    if (!chainName) {
        throw new Error(`Unsupported chain ${request.chain}`);
    }
    if (!adapter.factoryAddress || isZeroAddress(adapter.factoryAddress)) {
        throw new Error(`${adapter.name}: factory address missing`);
    }
    const tokenIn = resolveExecutableTokenAddress(request.chain, request.tokenIn);
    const tokenOut = resolveExecutableTokenAddress(request.chain, request.tokenOut);
    if (!isAddress(tokenIn) || !isAddress(tokenOut) || isZeroAddress(tokenIn) || isZeroAddress(tokenOut)) {
        throw new Error("Token address invalid for executable EVM quote");
    }
    const client = getClient(chainName);
    const poolKey = getPoolMetadataKey(connector.dexId, request.chain, tokenIn, tokenOut);
    const cachedMetadata = poolMetadataCache.get(poolKey);
    const useCachedMetadata = Boolean(cachedMetadata && (Date.now() - cachedMetadata.cachedAt) <= POOL_METADATA_TTL_MS);
    let pairAddress = cachedMetadata?.pairAddress;
    let token0 = cachedMetadata?.token0;
    let token1 = cachedMetadata?.token1;
    let tokenInDecimals = cachedMetadata?.tokenInDecimals;
    let tokenOutDecimals = cachedMetadata?.tokenOutDecimals;
    if (!useCachedMetadata) {
        const fetchedPair = await client.readContract({
            address: adapter.factoryAddress,
            abi: IUniswapV2FactoryABI,
            functionName: "getPair",
            args: [tokenIn, tokenOut],
        });
        if (fetchedPair === ZERO_ADDRESS) {
            throw new Error(`${adapter.name}: pair not found`);
        }
        pairAddress = normalizeAddress(fetchedPair);
        const [fetchedToken0, fetchedToken1] = await Promise.all([
            client.readContract({
                address: pairAddress,
                abi: IUniswapV2PairABI,
                functionName: "token0",
            }),
            client.readContract({
                address: pairAddress,
                abi: IUniswapV2PairABI,
                functionName: "token1",
            }),
        ]);
        token0 = normalizeAddress(fetchedToken0);
        token1 = normalizeAddress(fetchedToken1);
        tokenInDecimals = readTokenDecimals(request.chain, tokenIn);
        tokenOutDecimals = readTokenDecimals(request.chain, tokenOut);
        poolMetadataCache.set(poolKey, {
            pairAddress,
            token0,
            token1,
            tokenInDecimals,
            tokenOutDecimals,
            cachedAt: Date.now(),
        });
    }
    if (!pairAddress || !token0 || !token1 || tokenInDecimals === undefined || tokenOutDecimals === undefined) {
        throw new Error(`${adapter.name}: pool metadata incomplete`);
    }
    const [reserves, blockNumberBigInt] = await Promise.all([
        client.readContract({
            address: pairAddress,
            abi: IUniswapV2PairABI,
            functionName: "getReserves",
        }),
        client.getBlockNumber(),
    ]);
    const reserve0 = reserves[0];
    const reserve1 = reserves[1];
    const tokenInIsToken0 = token0.toLowerCase() === tokenIn.toLowerCase();
    const reserveIn = tokenInIsToken0 ? reserve0 : reserve1;
    const reserveOut = tokenInIsToken0 ? reserve1 : reserve0;
    const feeBps = Math.max(0, Math.min(10_000, Math.trunc(adapter.feeBps ?? 30)));
    const amountOut = computeV2AmountOut(request.amountIn, reserveIn, reserveOut, feeBps);
    return {
        dexId: connector.dexId,
        dex: connector.dex,
        chain: connector.chain,
        chainId: connector.chainId,
        protocol: connector.protocol,
        quoteTimestamp: Date.now(),
        amountIn: request.amountIn,
        amountOut,
        tokenIn,
        tokenOut,
        tokenInDecimals,
        tokenOutDecimals,
        poolAddress: pairAddress,
        reserveIn,
        reserveOut,
        liquidity: reserveIn < reserveOut ? reserveIn : reserveOut,
        priceImpact: computePriceImpact(request.amountIn, amountOut, reserveIn, reserveOut),
        feeBps,
        feeAmount: (request.amountIn * BigInt(feeBps)) / 10000n,
        blockNumber: Number(blockNumberBigInt),
        source: connector.source,
        status: "LIVE",
        latencyMs: Date.now() - startedAt,
    };
}
async function quoteFromV3Connector(connector, request, adapter, v3Config) {
    const startedAt = Date.now();
    assertPositiveAmount(request.amountIn);
    const chainName = asChainName(request.chain);
    if (!chainName) {
        throw new Error(`Unsupported chain ${request.chain}`);
    }
    const tokenIn = resolveExecutableTokenAddress(request.chain, request.tokenIn);
    const tokenOut = resolveExecutableTokenAddress(request.chain, request.tokenOut);
    if (!isAddress(tokenIn) || !isAddress(tokenOut) || isZeroAddress(tokenIn) || isZeroAddress(tokenOut)) {
        throw new Error("Token address invalid for executable EVM quote");
    }
    const client = getClient(chainName);
    const tokenInDecimals = readTokenDecimals(request.chain, tokenIn);
    const tokenOutDecimals = readTokenDecimals(request.chain, tokenOut);
    let bestAmountOut = 0n;
    let bestPool = ZERO_ADDRESS;
    let selectedFee = adapter.feeBps ?? 30;
    for (const fee of V3_FEE_TIERS) {
        const poolAddress = await client.readContract({
            address: v3Config.factory,
            abi: IUniswapV3FactoryABI,
            functionName: "getPool",
            args: [tokenIn, tokenOut, fee],
        });
        if (poolAddress === ZERO_ADDRESS) {
            continue;
        }
        const quote = await client.readContract({
            address: v3Config.quoter,
            abi: IUniswapV3QuoterABI,
            functionName: "quoteExactInputSingle",
            args: [{
                    tokenIn,
                    tokenOut,
                    amountIn: request.amountIn,
                    fee,
                    sqrtPriceLimitX96: 0n,
                }],
        });
        const amountOut = quote[0];
        if (amountOut > bestAmountOut) {
            bestAmountOut = amountOut;
            bestPool = normalizeAddress(poolAddress);
            selectedFee = Math.round(fee / 100);
        }
    }
    if (bestAmountOut <= 0n || bestPool === ZERO_ADDRESS) {
        throw new Error(`${adapter.name}: no executable v3 quote route`);
    }
    const blockNumber = Number(await client.getBlockNumber());
    return {
        dexId: connector.dexId,
        dex: connector.dex,
        chain: connector.chain,
        chainId: connector.chainId,
        protocol: connector.protocol,
        quoteTimestamp: Date.now(),
        amountIn: request.amountIn,
        amountOut: bestAmountOut,
        tokenIn,
        tokenOut,
        tokenInDecimals,
        tokenOutDecimals,
        poolAddress: bestPool,
        reserveIn: 0n,
        reserveOut: 0n,
        liquidity: bestAmountOut,
        priceImpact: 0,
        feeBps: selectedFee,
        feeAmount: (request.amountIn * BigInt(selectedFee)) / 10000n,
        blockNumber,
        source: connector.source,
        status: "LIVE",
        latencyMs: Date.now() - startedAt,
    };
}
function buildUnsupportedRawQuote(connector, request, error) {
    return {
        dexId: connector.dexId,
        dex: connector.dex,
        chain: connector.chain,
        chainId: connector.chainId,
        protocol: connector.protocol,
        quoteTimestamp: Date.now(),
        amountIn: request.amountIn,
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        source: connector.source,
        status: "DATA_UNAVAILABLE",
        latencyMs: 0,
        error: error ?? `${connector.dex}: reliable connector unavailable`,
    };
}
function validateRawQuote(rawQuote, latestBlock) {
    const reasons = [];
    const now = Date.now();
    const quoteAgeMs = now - rawQuote.quoteTimestamp;
    const blockAge = typeof latestBlock === "number" && typeof rawQuote.blockNumber === "number"
        ? Math.max(0, latestBlock - rawQuote.blockNumber)
        : 0;
    if (!rawQuote.chainId || rawQuote.chainId <= 0)
        reasons.push("chainId missing");
    if (!rawQuote.tokenIn || !isAddress(rawQuote.tokenIn))
        reasons.push("tokenIn missing/invalid");
    if (!rawQuote.tokenOut || !isAddress(rawQuote.tokenOut))
        reasons.push("tokenOut missing/invalid");
    if (typeof rawQuote.tokenInDecimals !== "number" || rawQuote.tokenInDecimals < 0 || rawQuote.tokenInDecimals > 36)
        reasons.push("tokenIn decimals invalid");
    if (typeof rawQuote.tokenOutDecimals !== "number" || rawQuote.tokenOutDecimals < 0 || rawQuote.tokenOutDecimals > 36)
        reasons.push("tokenOut decimals invalid");
    if (!rawQuote.poolAddress || !isAddress(rawQuote.poolAddress) || isZeroAddress(rawQuote.poolAddress))
        reasons.push("pool missing/inactive");
    if (!rawQuote.amountOut || rawQuote.amountOut <= 0n)
        reasons.push("amountOut invalid");
    if (!rawQuote.liquidity || rawQuote.liquidity <= MIN_LIQUIDITY_RAW)
        reasons.push("liquidity too low");
    if (quoteAgeMs > MAX_QUOTE_AGE_MS)
        reasons.push("stale quote timestamp");
    if (blockAge > MAX_BLOCK_AGE)
        reasons.push("stale block");
    if (reasons.some((reason) => reason.includes("stale"))) {
        return { status: "STALE", reasons };
    }
    if (reasons.length > 0) {
        return { status: "INVALID", reasons };
    }
    return { status: "LIVE", reasons: [] };
}
function normalizeQuote(rawQuote, latestBlock) {
    if (!rawQuote.amountOut || rawQuote.tokenInDecimals === undefined || rawQuote.tokenOutDecimals === undefined) {
        return null;
    }
    const amountInFloat = toFloatAmount(rawQuote.amountIn, rawQuote.tokenInDecimals);
    const amountOutFloat = toFloatAmount(rawQuote.amountOut, rawQuote.tokenOutDecimals);
    const executablePrice = amountInFloat > 0 ? amountOutFloat / amountInFloat : 0;
    const quoteAgeMs = Date.now() - rawQuote.quoteTimestamp;
    const blockAge = typeof latestBlock === "number" && typeof rawQuote.blockNumber === "number"
        ? Math.max(0, latestBlock - rawQuote.blockNumber)
        : 0;
    return {
        dex: rawQuote.dex,
        chain: rawQuote.chain,
        chainId: rawQuote.chainId ?? 0,
        protocol: rawQuote.protocol,
        pair: rawQuote.poolAddress ?? ZERO_ADDRESS,
        poolAddress: rawQuote.poolAddress ?? ZERO_ADDRESS,
        amountOut: rawQuote.amountOut,
        amountIn: rawQuote.amountIn,
        executablePrice,
        liquidity: rawQuote.liquidity ?? 0n,
        priceImpact: rawQuote.priceImpact ?? 0,
        fee: {
            bps: rawQuote.feeBps ?? 0,
            amount: rawQuote.feeAmount ?? 0n,
        },
        reserveIn: rawQuote.reserveIn ?? 0n,
        reserveOut: rawQuote.reserveOut ?? 0n,
        tokenIn: rawQuote.tokenIn,
        tokenOut: rawQuote.tokenOut,
        tokenInDecimals: rawQuote.tokenInDecimals,
        tokenOutDecimals: rawQuote.tokenOutDecimals,
        timestamp: new Date(rawQuote.quoteTimestamp).toISOString(),
        quoteTimestamp: rawQuote.quoteTimestamp,
        quoteAgeMs,
        blockNumber: rawQuote.blockNumber ?? 0,
        blockAge,
        source: rawQuote.source,
        status: rawQuote.status,
        confidence: rawQuote.status === "LIVE" ? 100 : 0,
    };
}
function enforcePriceDeviation(quotes) {
    if (quotes.length < 2) {
        return quotes;
    }
    const prices = quotes.map((quote) => quote.executablePrice).filter((price) => Number.isFinite(price) && price > 0).sort((a, b) => a - b);
    if (prices.length < 2) {
        return quotes;
    }
    const median = prices[Math.floor(prices.length / 2)];
    return quotes.map((quote) => {
        if (!Number.isFinite(quote.executablePrice) || quote.executablePrice <= 0 || median <= 0) {
            return quote;
        }
        const deviation = Math.abs(quote.executablePrice - median) / median;
        if (deviation > MAX_PRICE_DEVIATION_RATIO) {
            return {
                ...quote,
                status: "UNVERIFIED",
                confidence: 0,
            };
        }
        return quote;
    });
}
function enforceReproducibility(quotes) {
    return quotes.map((quote) => {
        const key = getReproducibilityKey(quote);
        const previous = reproducibilityCache.get(key);
        reproducibilityCache.set(key, {
            amountOut: quote.amountOut,
            timestamp: quote.quoteTimestamp,
        });
        if (!previous || (quote.quoteTimestamp - previous.timestamp) > MAX_QUOTE_AGE_MS) {
            return quote;
        }
        if (previous.amountOut <= 0n || quote.amountOut <= 0n) {
            return quote;
        }
        const min = previous.amountOut < quote.amountOut ? previous.amountOut : quote.amountOut;
        const max = previous.amountOut > quote.amountOut ? previous.amountOut : quote.amountOut;
        const deviation = Number((max - min) * 10000n / max) / 10_000;
        if (deviation > REPRODUCIBILITY_DEVIATION_RATIO) {
            return {
                ...quote,
                status: "UNVERIFIED",
                confidence: 0,
            };
        }
        return quote;
    });
}
function updateDiagnostics(connector, quote, status, latencyMs, error) {
    const key = `${connector.chain}:${connector.dexId}`;
    const current = quoteDiagnostics.get(key);
    const next = {
        dex: connector.dex,
        dexId: connector.dexId,
        chain: connector.chain,
        chainId: connector.chainId,
        protocol: connector.protocol,
        priceSource: connector.priceSource,
        quoteSource: connector.quoteSource,
        status,
        source: quote?.source ?? connector.source,
        lastSuccessfulFetch: status === "LIVE" ? (quote?.timestamp ?? current?.lastSuccessfulFetch) : current?.lastSuccessfulFetch,
        quoteTimestamp: quote?.quoteTimestamp ?? current?.quoteTimestamp,
        quoteAgeMs: quote?.quoteAgeMs ?? current?.quoteAgeMs,
        blockNumber: quote?.blockNumber ?? current?.blockNumber,
        blockAge: quote?.blockAge ?? current?.blockAge,
        poolAddress: quote?.poolAddress ?? current?.poolAddress,
        liquidity: quote ? quote.liquidity.toString() : current?.liquidity,
        latencyMs,
        error,
    };
    quoteDiagnostics.set(key, next);
    supportMatrix.set(key, {
        dex: connector.dex,
        chain: connector.chain,
        protocol: connector.protocol,
        priceSource: connector.priceSource,
        quoteSource: connector.quoteSource,
        status,
        lastSuccessfulQuote: next.lastSuccessfulFetch,
    });
}
function getV2Connector(adapter) {
    const chainName = asChainName(adapter.chain);
    const connectorBase = {
        dexId: adapter.id,
        dex: adapter.name,
        chain: adapter.chain,
        chainId: chainName ? CHAINS[chainName].id : undefined,
        protocol: `evm-${adapter.version}`,
        version: adapter.version,
        kind: "evm-v2-reserves",
        priceSource: "onchain-pool-reserves",
        quoteSource: "factory:getPair + pair:getReserves",
        source: "onchain:evm:v2",
        supported: true,
    };
    return {
        ...connectorBase,
        quote: (request) => quoteFromV2Connector(connectorBase, request, adapter),
    };
}
function getV3Connector(adapter, config) {
    const chainName = asChainName(adapter.chain);
    const connectorBase = {
        dexId: adapter.id,
        dex: adapter.name,
        chain: adapter.chain,
        chainId: chainName ? CHAINS[chainName].id : undefined,
        protocol: `evm-${adapter.version}`,
        version: adapter.version,
        kind: "evm-v3-quoter",
        priceSource: "onchain-quoter",
        quoteSource: "factory:getPool + quoter:quoteExactInputSingle",
        source: "onchain:evm:v3",
        supported: true,
    };
    return {
        ...connectorBase,
        quote: (request) => quoteFromV3Connector(connectorBase, request, adapter, config),
    };
}
function getUnsupportedConnector(adapter) {
    const chainName = asChainName(adapter.chain);
    const connectorBase = {
        dexId: adapter.id,
        dex: adapter.name,
        chain: adapter.chain,
        chainId: chainName ? CHAINS[chainName].id : undefined,
        protocol: `evm-${adapter.version}`,
        version: adapter.version,
        kind: "unsupported",
        priceSource: "none",
        quoteSource: "none",
        source: "data-unavailable",
        supported: false,
    };
    return {
        ...connectorBase,
        quote: async (request) => buildUnsupportedRawQuote(connectorBase, request),
    };
}
function buildConnectorCatalog() {
    const adapters = dexRegistry.getAll();
    return adapters.map((adapter) => {
        const hasFactory = Boolean(adapter.factoryAddress && !isZeroAddress(adapter.factoryAddress));
        if (adapter.version === "v2" && hasFactory) {
            const connector = getV2Connector(adapter);
            supportMatrix.set(`${connector.chain}:${connector.dexId}`, {
                dex: connector.dex,
                chain: connector.chain,
                protocol: connector.protocol,
                priceSource: connector.priceSource,
                quoteSource: connector.quoteSource,
                status: "UNVERIFIED",
            });
            return connector;
        }
        if (adapter.version === "v3") {
            const v3Config = getV3ConfigForAdapter(adapter);
            if (v3Config) {
                const connector = getV3Connector(adapter, v3Config);
                supportMatrix.set(`${connector.chain}:${connector.dexId}`, {
                    dex: connector.dex,
                    chain: connector.chain,
                    protocol: connector.protocol,
                    priceSource: connector.priceSource,
                    quoteSource: connector.quoteSource,
                    status: "UNVERIFIED",
                });
                return connector;
            }
        }
        const connector = getUnsupportedConnector(adapter);
        supportMatrix.set(`${connector.chain}:${connector.dexId}`, {
            dex: connector.dex,
            chain: connector.chain,
            protocol: connector.protocol,
            priceSource: connector.priceSource,
            quoteSource: connector.quoteSource,
            status: "DATA_UNAVAILABLE",
        });
        return connector;
    });
}
const connectors = buildConnectorCatalog();
function connectorForChain(chain) {
    return connectors.filter((connector) => connector.chain === chain);
}
async function fetchConnectorQuote(connector, request) {
    const cacheKey = getCacheKey(request, connector.dexId);
    const cached = quoteCache.get(cacheKey);
    if (cached && (Date.now() - cached.storedAt) <= QUOTE_CACHE_TTL_MS) {
        const latestBlock = await getLatestBlock(request.chain);
        const quoteAgeMs = Date.now() - cached.quote.quoteTimestamp;
        const blockAge = typeof latestBlock === "number"
            ? Math.max(0, latestBlock - cached.quote.blockNumber)
            : cached.quote.blockAge;
        if (quoteAgeMs <= MAX_QUOTE_AGE_MS && blockAge <= MAX_BLOCK_AGE && cached.quote.status === "LIVE") {
            return {
                ...cached.quote,
                quoteAgeMs,
                blockAge,
            };
        }
    }
    const startedAt = Date.now();
    if (!connector.supported) {
        updateDiagnostics(connector, null, "DATA_UNAVAILABLE", 0, "DATA UNAVAILABLE / UNSUPPORTED");
        return null;
    }
    try {
        const rawQuote = await withRetry(() => withTimeout(connector.quote(request), QUOTE_TIMEOUT_MS), QUOTE_RETRY_COUNT);
        const latestBlock = await getLatestBlock(request.chain);
        const validation = validateRawQuote(rawQuote, latestBlock);
        const normalized = normalizeQuote(rawQuote, latestBlock);
        if (!normalized) {
            updateDiagnostics(connector, null, "INVALID", Date.now() - startedAt, "Malformed quote payload");
            return null;
        }
        const status = rawQuote.status === "DATA_UNAVAILABLE" ? "DATA_UNAVAILABLE" : validation.status;
        const withStatus = {
            ...normalized,
            status,
            confidence: status === "LIVE" ? 100 : 0,
        };
        if (status === "LIVE") {
            quoteCache.set(cacheKey, { quote: withStatus, storedAt: Date.now() });
            updateDiagnostics(connector, withStatus, status, Date.now() - startedAt);
            return withStatus;
        }
        updateDiagnostics(connector, withStatus, status, Date.now() - startedAt, validation.reasons.join("; "));
        return withStatus;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateDiagnostics(connector, null, "ERROR", Date.now() - startedAt, message);
        return null;
    }
}
function chainMatches(connector, chain) {
    return normalizeKey(connector.chain) === normalizeKey(chain);
}
export function getQuoteDiagnostics() {
    const support = Array.from(supportMatrix.values()).sort((left, right) => `${left.chain}:${left.dex}`.localeCompare(`${right.chain}:${right.dex}`));
    const health = Array.from(quoteDiagnostics.values()).sort((left, right) => `${left.chain}:${left.dex}`.localeCompare(`${right.chain}:${right.dex}`));
    return { health, supportMatrix: support };
}
export async function getRoundTripQuote(chain, tokenIn, tokenOut, amountIn) {
    return getBestQuote(chain, tokenIn, tokenOut, amountIn);
}
export async function getQuotes(chain, tokenIn, tokenOut, amountIn) {
    assertPositiveAmount(amountIn);
    const request = { chain, tokenIn, tokenOut, amountIn };
    const eligibleConnectors = connectorForChain(chain).filter((connector) => chainMatches(connector, chain));
    if (!eligibleConnectors.length) {
        return [];
    }
    const quoteTasks = eligibleConnectors.map((connector) => async () => fetchConnectorQuote(connector, request));
    const fetched = await runWithConcurrency(quoteTasks, Math.max(1, QUOTE_FETCH_CONCURRENCY));
    const normalized = fetched.filter((quote) => quote !== null);
    const deviationChecked = enforcePriceDeviation(normalized);
    const reproducibilityChecked = enforceReproducibility(deviationChecked);
    const liveQuotes = reproducibilityChecked
        .filter((quote) => quote.status === "LIVE")
        .sort((left, right) => (left.amountOut > right.amountOut ? -1 : 1));
    return liveQuotes;
}
export async function getBestQuote(chain, tokenIn, tokenOut, amountIn) {
    const quotes = await getQuotes(chain, tokenIn, tokenOut, amountIn);
    return quotes[0] ?? null;
}
