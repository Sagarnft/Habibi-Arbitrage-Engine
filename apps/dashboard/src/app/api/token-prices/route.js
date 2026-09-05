"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex";
const BINANCE_BASE = "https://api.binance.com/api/v3";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
// Cache for token prices with 60-second TTL
const priceCache = new Map();
// Fetch with timeout
async function fetchWithTimeout(url, timeoutMs = 5000, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
            cache: "no-store",
        });
    }
    finally {
        clearTimeout(timeoutId);
    }
}
const SYMBOL_ALIASES = {
    BTC: "WBTC",
    BTCB: "WBTC",
    WBTC: "WBTC",
};
const MULTI_DEX_ARBITRAGE_TOKENS = new Set([
    "WBTC",
    "WETH",
    "ETH",
    "BNB",
    "SOL",
    "AVAX",
    "MATIC",
    "ARB",
    "OP",
    "LINK",
    "UNI",
    "AAVE",
    "LTC",
    "BCH",
    "DOT",
    "ATOM",
    "FIL",
    "NEAR",
    "SUI",
    "APT",
    "SEI",
    "RNDR",
    "INJ",
    "FET",
    "USDT",
    "USDC",
]);
const SYMBOL_ID_MAP = {
    WBTC: "bitcoin",
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    BNB: "binancecoin",
    LINK: "chainlink",
    AVAX: "avalanche-2",
    MATIC: "matic-network",
    ARB: "arbitrum",
    OP: "optimism",
    NEAR: "near",
    LTC: "litecoin",
    DOT: "polkadot",
    UNI: "uniswap",
    ATOM: "cosmos",
    FIL: "filecoin",
    APT: "aptos",
    SUI: "sui",
    SEI: "sei-network",
    BCH: "bitcoin-cash",
    RNDR: "render-token",
    AAVE: "aave",
    TAO: "bittensor",
    INJ: "injective-protocol",
    FET: "fetch-ai",
    USDT: "tether",
    USDC: "usd-coin",
};
const BINANCE_SYMBOL_MAP = {
    WBTC: "WBTCUSDT",
    BTC: "BTCUSDT",
    ETH: "ETHUSDT",
    SOL: "SOLUSDT",
    BNB: "BNBUSDT",
    LINK: "LINKUSDT",
    AVAX: "AVAXUSDT",
    MATIC: "MATICUSDT",
    ARB: "ARBUSDT",
    OP: "OPUSDT",
    NEAR: "NEARUSDT",
    LTC: "LTCUSDT",
    DOT: "DOTUSDT",
    UNI: "UNIUSDT",
    ATOM: "ATOMUSDT",
    FIL: "FILUSDT",
    APT: "APTUSDT",
    SUI: "SUIUSDT",
    SEI: "SEIUSDT",
    BCH: "BCHUSDT",
    RNDR: "RNDRUSDT",
    AAVE: "AAVEUSDT",
    TAO: "TAOUSDT",
    INJ: "INJUSDT",
    FET: "FETUSDT",
};
const normalizeSymbol = (value) => {
    const raw = String(value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return SYMBOL_ALIASES[raw] ?? raw;
};
const normalizeChainName = (value) => {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) {
        return "unknown";
    }
    const aliases = {
        ethereum: "ethereum",
        "ethereum-mainnet": "ethereum",
        "eth": "ethereum",
        bsc: "bnb",
        "binance smart chain": "bnb",
        "binance-smart-chain": "bnb",
        "bnb smart chain": "bnb",
        "bnb-mainnet": "bnb",
        base: "base",
        "base-mainnet": "base",
        arbitrum: "arbitrum",
        "arbitrum one": "arbitrum",
        "arbitrum-one": "arbitrum",
        polygon: "polygon",
        "polygon-pos": "polygon",
        optimism: "optimism",
        "op-mainnet": "optimism",
        avalanche: "avalanche",
        "avalanche-c-chain": "avalanche",
        fantom: "fantom",
        celo: "celo",
        mantle: "mantle",
        blast: "blast",
        linea: "linea",
        scroll: "scroll",
        zksync: "zksync",
        "zk-sync": "zksync",
        mode: "mode",
        solana: "solana",
        "solana-mainnet": "solana",
    };
    return aliases[raw] ?? (raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown");
};
const groupDexRowsByChain = (rows) => {
    const grouped = new Map();
    for (const row of rows) {
        const chainKey = normalizeChainName(row.chain);
        const group = grouped.get(chainKey) ?? [];
        group.push(row);
        grouped.set(chainKey, group);
    }
    return Array.from(grouped.entries())
        .map(([chain, chainRows]) => ({
        chain,
        rows: [...chainRows].sort((left, right) => right.price - left.price),
    }))
        .sort((left, right) => left.chain.localeCompare(right.chain));
};
const STABLE_QUOTE_TICKERS = ["USDT", "USDC", "USD", "BUSD", "DAI"];
const MIN_DEX_VOLUME_USD = 50_000;
const LAST_KNOWN_MARKET_PRICES = {
    WBTC: 78292,
    BTC: 78292,
    ETH: 3520.4,
    SOL: 162.21,
    BNB: 618.45,
    LINK: 17.82,
    AVAX: 34.85,
    MATIC: 0.71,
    ARB: 0.94,
    OP: 1.84,
    NEAR: 6.4,
    LTC: 78.32,
    DOT: 6.91,
    UNI: 9.24,
    ATOM: 6.33,
    FIL: 4.12,
    APT: 7.64,
    SUI: 1.42,
    SEI: 0.54,
    BCH: 512.1,
    RNDR: 8.95,
    AAVE: 128.4,
    TAO: 420.9,
    INJ: 31.4,
    FET: 1.02,
    USDT: 1,
    USDC: 1,
};
const BASE_FALLBACK_DEX_NAMES = [
    "Uniswap V3",
    "PancakeSwap",
    "Raydium",
    "SushiSwap",
    "Curve",
    "Balancer",
    "Camelot",
    "Velodrome",
    "KyberSwap",
    "QuickSwap",
    "Trader Joe",
    "Aerodrome",
    "Orca",
    "OpenOcean",
    "1inch",
    "DODO",
    "Pangolin",
    "Maverick",
    "Matcha",
    "THORChain",
    "Mooniswap",
    "Biswap",
    "PancakeSwap v2",
    "Quickswap",
    "SpiritSwap",
    "SpookySwap",
    "Wombat",
    "DFYN",
    "Nile",
    "Lynex",
    "Hashflow",
    "BabydogeSwap",
    "KiloEx",
    "Cetus",
    "MantaSwap",
    "SOLPAD",
    "HorizonDEX",
    "Vertex",
    "GMX",
    "ApolloX",
    "Kinetix",
    "Odos",
    "Sailor",
    "AlienBase",
    "Sunswap",
    "Meridian",
    "Beamswap",
    "Solarbeam",
    "Lyra",
    "PearlFi",
    "Magpie",
    "Metavault",
    "Hyperliquid",
    "Ribbon",
    "Smoothy",
    "Aurora",
    "Gravity",
    "Nomad",
    "ZyberSwap",
    "Lydia",
    "Level Finance",
    "ApeSwap",
    "Trisolaris",
    "WOOFi",
    "Lifinity",
    "Jupiter",
    "WhaleSwap",
    "BelugaDEX",
    "GammaDEX",
    "ArbitrumSwap",
    "BaseSwap",
    "LineaDEX",
    "Kinetix V2",
    "ZenithDEX",
    "PrimeSwap",
    "AltLayerDex",
    "VelaDEX",
    "NovaDEX",
    "PulseX",
    "SwellDEX",
    "TerraSwap",
    "OrbitDEX",
];
const RESTRICTED_DEX_NAMES = new Set(["ZenithDEX", "zenithdex", "Zenith DEX"]);
const FALLBACK_DEX_NAMES = Array.from(new Set(BASE_FALLBACK_DEX_NAMES.filter((name) => !RESTRICTED_DEX_NAMES.has(name) && !RESTRICTED_DEX_NAMES.has(name.toLowerCase()))));
const CANONICAL_BASE_ALIASES = {
    BTC: ["BTC", "WBTC", "BTCB"],
    ETH: ["ETH", "WETH", "ETHW"],
    SOL: ["SOL", "WSOL"],
    BNB: ["BNB", "WBNB"],
    MATIC: ["MATIC", "WMATIC"],
    AVAX: ["AVAX", "WAVAX"],
    ARB: ["ARB"],
    OP: ["OP"],
    NEAR: ["NEAR"],
    LTC: ["LTC"],
    DOT: ["DOT"],
    UNI: ["UNI"],
    ATOM: ["ATOM"],
    FIL: ["FIL"],
    APT: ["APT"],
    SUI: ["SUI"],
    SEI: ["SEI"],
    BCH: ["BCH"],
    RNDR: ["RNDR"],
    AAVE: ["AAVE"],
    TAO: ["TAO"],
    INJ: ["INJ"],
    FET: ["FET"],
    USDT: ["USDT"],
    USDC: ["USDC"],
};
const normalizeDexName = (value) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
        return "Unknown";
    }
    return trimmed
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\b(v\d+)\b/gi, "V$1")
        .trim();
};
const parsePrice = (pair) => {
    const candidates = [
        pair.priceUsd,
        pair.price,
        pair.priceNative,
        pair.price_usd,
        pair.usdPrice,
        pair.last_price,
        pair.lastPrice,
    ];
    for (const candidate of candidates) {
        const value = Number(candidate ?? 0);
        if (Number.isFinite(value) && value > 0) {
            return value;
        }
    }
    return 0;
};
const parseVolume = (pair) => {
    const nestedVolume = (pair.volume ?? null);
    const candidates = [
        pair.volumeUsd24h,
        pair.volume_usd_24h,
        pair.h24Volume,
        pair.volumeH24,
        pair.h24VolumeUsd,
        nestedVolume,
        (typeof nestedVolume === "object" && nestedVolume !== null ? nestedVolume.h24 : undefined),
        (typeof nestedVolume === "object" && nestedVolume !== null ? nestedVolume.h6 : undefined),
        (typeof nestedVolume === "object" && nestedVolume !== null ? nestedVolume.usd : undefined),
        (typeof nestedVolume === "object" && nestedVolume !== null ? nestedVolume.usd24h : undefined),
    ];
    for (const candidate of candidates) {
        const value = Number(candidate ?? 0);
        if (Number.isFinite(value) && value > 0) {
            return value;
        }
    }
    return 0;
};
async function fetchCanonicalMarketPrice(symbol) {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) {
        return 0;
    }
    // Check cache first
    const cached = priceCache.get(normalized);
    if (cached && cached.expireAt > Date.now()) {
        return cached.price;
    }
    const binanceSymbol = BINANCE_SYMBOL_MAP[normalized];
    if (binanceSymbol) {
        try {
            const binanceUrl = `${BINANCE_BASE}/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`;
            const response = await fetchWithTimeout(binanceUrl, 3000);
            if (response.ok) {
                const payload = await response.json();
                const price = Number(payload?.price ?? 0);
                if (Number.isFinite(price) && price > 0) {
                    priceCache.set(normalized, { price, expireAt: Date.now() + 60000 });
                    return price;
                }
            }
        }
        catch {
            // fall through to CoinGecko
        }
    }
    const coingeckoId = SYMBOL_ID_MAP[normalized];
    if (!coingeckoId) {
        return LAST_KNOWN_MARKET_PRICES[normalized] ?? 0;
    }
    try {
        const coingeckoUrl = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(coingeckoId)}&vs_currencies=usd`;
        const response = await fetchWithTimeout(coingeckoUrl, 3000);
        if (!response.ok) {
            return LAST_KNOWN_MARKET_PRICES[normalized] ?? 0;
        }
        const payload = await response.json();
        const price = Number(payload?.[coingeckoId]?.usd ?? 0);
        if (Number.isFinite(price) && price > 0) {
            priceCache.set(normalized, { price, expireAt: Date.now() + 60000 });
            return price;
        }
    }
    catch {
        // ignore
    }
    return LAST_KNOWN_MARKET_PRICES[normalized] ?? 0;
}
const parseRating = (source) => {
    const nestedDex = source.dex;
    const candidates = [
        source.rating,
        source.reputation,
        source.reviewScore,
        source.reputationScore,
        source.userRating,
        source.ratingScore,
        source.rating_value,
        source.review_score,
        source.reputation_score,
        nestedDex?.rating,
        nestedDex?.reputation,
        nestedDex?.reviewScore,
        nestedDex?.score,
    ];
    for (const candidate of candidates) {
        const value = Number(candidate ?? 0);
        if (Number.isFinite(value) && value > 0) {
            return value;
        }
    }
    return undefined;
};
const buildFallbackDexRows = (symbol, canonicalPrice) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) {
        return [];
    }
    const basePrice = Number.isFinite(canonicalPrice) && canonicalPrice > 0 ? canonicalPrice : 1;
    const rows = FALLBACK_DEX_NAMES.map((dexName, index) => {
        const spread = 0.00035 + index * 0.00022 + (index % 3) * 0.00014;
        const price = Number((basePrice * (1 + spread)).toFixed(8));
        const volume = Number((basePrice * (16000 + index * 4200)).toFixed(2));
        return {
            dex: dexName,
            price,
            volume,
            chain: "multi-chain",
            status: "fallback",
            rating: 4.2 + ((index % 5) * 0.1),
            isExact: false,
        };
    });
    rows.sort((left, right) => right.price - left.price);
    return rows.slice(0, 74);
};
const dedupeDexRows = (rows) => {
    const uniqueRows = new Map();
    for (const row of rows) {
        const key = `${row.dex.toLowerCase()}::${String(row.chain ?? "").trim().toLowerCase() || "unknown"}`;
        const existing = uniqueRows.get(key);
        if (!existing || row.price > existing.price) {
            uniqueRows.set(key, row);
        }
    }
    return Array.from(uniqueRows.values()).sort((left, right) => right.price - left.price).slice(0, 74);
};
async function fetchDexPrices(symbol, canonicalPrice = 0) {
    const canonical = normalizeSymbol(symbol);
    if (!canonical) {
        return [];
    }
    const aliasSet = new Set(CANONICAL_BASE_ALIASES[canonical] ?? [canonical]);
    const searchTerms = Array.from(new Set([canonical, ...aliasSet]));
    const collectedRows = [];
    let lastError = null;
    const mapPairToRow = (pair) => {
        const baseToken = (pair?.baseToken ?? null);
        const quoteToken = (pair?.quoteToken ?? null);
        const baseSymbol = normalizeSymbol(String(baseToken?.symbol ?? baseToken?.ticker ?? pair?.symbol ?? ""));
        const quoteSymbol = normalizeSymbol(String(quoteToken?.symbol ?? quoteToken?.ticker ?? ""));
        const dexInfo = (pair?.dex ?? null);
        const dexName = normalizeDexName(String((pair?.dexId ?? dexInfo?.id ?? pair?.dexName ?? pair?.dex_name) ?? "Unknown"));
        if (RESTRICTED_DEX_NAMES.has(dexName) || RESTRICTED_DEX_NAMES.has(dexName.toLowerCase())) {
            return null;
        }
        const price = parsePrice(pair);
        if (!baseSymbol || !dexName || !Number.isFinite(price) || price <= 0) {
            return null;
        }
        if (!aliasSet.has(baseSymbol)) {
            return null;
        }
        const quoteIsStable = STABLE_QUOTE_TICKERS.includes(quoteSymbol);
        if (!quoteIsStable) {
            return null;
        }
        if (canonicalPrice > 0) {
            const relativeDelta = Math.abs(price - canonicalPrice) / canonicalPrice;
            if (relativeDelta > 0.6) {
                return null;
            }
        }
        const volume = parseVolume(pair);
        if (!Number.isFinite(volume) || volume < MIN_DEX_VOLUME_USD) {
            return null;
        }
        const rating = parseRating(pair);
        return {
            dex: dexName,
            price: Number(price.toFixed(8)),
            volume,
            chain: normalizeChainName(String(pair?.chainId ?? pair?.network ?? pair?.chain ?? pair?.networkName ?? "")),
            status: "LIVE",
            rating,
            isExact: true,
        };
    };
    for (const searchTerm of searchTerms) {
        try {
            const response = await fetchWithTimeout(`${DEXSCREENER_BASE}/search?q=${encodeURIComponent(searchTerm)}&limit=20`, 2500, {
                headers: {
                    Accept: "application/json",
                    "User-Agent": "Mozilla/5.0",
                },
            });
            if (!response.ok) {
                if (response.status === 429) {
                    lastError = new Error("DexScreener rate limited");
                }
                continue;
            }
            const payload = await response.json();
            const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
            const realRows = pairs
                .map((pair) => mapPairToRow(pair))
                .filter((entry) => entry !== null);
            collectedRows.push(...realRows);
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error("DexScreener fetch failed");
        }
    }
    const deduped = dedupeDexRows(collectedRows);
    if (deduped.length > 0) {
        return deduped;
    }
    if (lastError) {
        return [];
    }
    return [];
}
async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbolParam = searchParams.get("symbol")?.trim();
    const symbolsParam = searchParams.get("symbols")?.trim();
    try {
        if (symbolsParam) {
            const symbols = [...new Set(symbolsParam.split(",").map((symbol) => symbol.trim()).filter(Boolean).map((symbol) => normalizeSymbol(symbol)).filter((symbol) => MULTI_DEX_ARBITRAGE_TOKENS.has(symbol)))];
            const results = await Promise.all(symbols.map(async (symbol) => {
                const canonicalSymbol = normalizeSymbol(symbol);
                const referencePriceUsd = await fetchCanonicalMarketPrice(canonicalSymbol);
                const dexes = await fetchDexPrices(canonicalSymbol, referencePriceUsd);
                const groupedDexes = groupDexRowsByChain(dexes).flatMap((group) => group.rows);
                const liveDexes = groupedDexes.filter((entry) => String(entry.status).toUpperCase() === "LIVE");
                const topEntry = liveDexes[0];
                return {
                    symbol: canonicalSymbol,
                    price: topEntry?.price ?? 0,
                    referencePriceUsd,
                    status: topEntry ? "LIVE" : "DATA_UNAVAILABLE",
                    dexes: groupedDexes,
                };
            }));
            return server_1.NextResponse.json({ tokens: results });
        }
        if (!symbolParam) {
            return server_1.NextResponse.json({ symbol: null, price: 0, dexes: [] }, { status: 400 });
        }
        const canonicalSymbol = normalizeSymbol(symbolParam);
        if (!MULTI_DEX_ARBITRAGE_TOKENS.has(canonicalSymbol)) {
            return server_1.NextResponse.json({ symbol: canonicalSymbol, price: 0, dexes: [], status: "DATA_UNAVAILABLE" });
        }
        const referencePriceUsd = await fetchCanonicalMarketPrice(canonicalSymbol);
        const dexes = await fetchDexPrices(canonicalSymbol, referencePriceUsd);
        const groupedDexes = groupDexRowsByChain(dexes).flatMap((group) => group.rows);
        const liveDexes = groupedDexes.filter((entry) => String(entry.status).toUpperCase() === "LIVE");
        const topEntry = liveDexes[0];
        return server_1.NextResponse.json({
            symbol: canonicalSymbol,
            price: topEntry?.price ?? 0,
            referencePriceUsd,
            status: topEntry ? "LIVE" : "DATA_UNAVAILABLE",
            dexes: groupedDexes,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unable to fetch live dex prices";
        return server_1.NextResponse.json({ error: message, symbol: symbolParam ?? null, price: 0, dexes: [] }, { status: 500 });
    }
}
