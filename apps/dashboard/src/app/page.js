"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Home;
const react_1 = require("react");
const dashboardData_1 = require("./lib/dashboardData");
const botFlow_1 = require("./lib/botFlow");
const executionSafety_1 = require("./lib/executionSafety");
const AnimatedCelestialBackground_1 = require("./components/AnimatedCelestialBackground");
const Sidebar_1 = require("./components/Sidebar");
const PROFILE_STORAGE_KEY = "habibi.userProfile";
const AUTO_BOT_STORAGE_KEY = "habibi.autoBotEnabled";
const DEFAULT_PROFILE = {
    avatarDataUrl: null,
    name: "Sagar Swami",
    email: "",
    phoneCountryCode: "+91",
    phoneNumber: "",
};
const PROJECT_CHAIN_LIST = [
    "ethereum",
    "bnb",
    "base",
    "arbitrum",
    "polygon",
    "optimism",
    "avalanche",
    "fantom",
    "celo",
    "mantle",
    "blast",
    "linea",
    "scroll",
    "zksync",
    "mode",
    "sei",
    "manta",
    "ronin",
    "swell",
    "taiko",
    "worldchain",
    "berachain",
    "sonic",
    "coredao",
];
const PROJECT_DEX_LIST = [
    "uniswap",
    "uniswap-v2",
    "uniswap-v3",
    "sushiswap",
    "curve",
    "pancakeswap",
    "balancer",
    "aerodrome",
    "velodrome",
    "quickswap",
    "thena",
    "biswap",
    "baseswap",
    "beethovenx",
    "pangolin",
    "hashflow",
    "mute",
    "chronos",
    "wombat",
    "ramses",
    "dfyn",
    "bebop",
    "traderjoe",
    "kyberswap",
    "lydia",
    "zyberswap",
    "odos",
    "maverick",
    "syncswap",
    "mdex",
    "velocore",
    "matcha",
    "openocean",
    "oneinch",
    "paraswap",
    "dodo",
    "ambient",
    "camelot",
    "apeswap",
    "lynex",
    "thorchain",
    "xfai",
    "polydex",
    "spiritswap",
    "spookyswap",
    "trisolaris",
    "woofi",
    "lifinity",
    "orca",
    "raydium",
    "gmx",
    "vertex",
    "apollox",
    "kiloex",
    "izumi",
    "sailor",
    "cetus",
    "alienbase",
    "kine",
    "nomad",
    "sunswap",
    "meridian",
    "beamswap",
    "solarbeam",
    "lyra",
    "pearlfi",
    "magpie",
    "nile",
    "metavault",
    "hyperliquid",
    "ribbon",
    "smoothy",
    "aurora",
    "gravity",
];
const TOKEN_DEX_UNIVERSE = [...PROJECT_DEX_LIST];
function formatStableTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "n/a";
    }
    return date.toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour12: true,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}
function formatRpcLatency(value) {
    if (!value || value < 0) {
        return "n/a";
    }
    return `${Math.round(value)}ms`;
}
function formatRpcCooldown(until) {
    if (!until || until <= Date.now()) {
        return "ready";
    }
    const remaining = Math.max(0, until - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    return `${seconds}s cooldown`;
}
const TOKEN_SYMBOL_BY_ADDRESS = {
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
    "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "WETH",
    "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": "WMATIC",
    "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": "WBNB",
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC",
    "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "USDC",
    "0x4200000000000000000000000000000000000006": "WETH",
    "0x5300000000000000000000000000000000000004": "WETH",
    "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7": "WAVAX",
    "0x04068da6c83afcfa0e13ba15a6696662335d5b75": "USDC",
    "0x9702230a8ea53601f5cd2dc00f8db8d4df4a8c7": "USDC",
    "0x471ece3750da237f93b8e339c536989b8978a479": "USDC",
};
function resolveTokenSymbol(address) {
    if (!address) {
        return undefined;
    }
    return TOKEN_SYMBOL_BY_ADDRESS[address.toLowerCase()];
}
function formatTokenPair(pairValue, fallback) {
    const rawValue = pairValue?.trim();
    if (!rawValue) {
        return fallback;
    }
    const segments = rawValue.split(":").map((segment) => segment.trim()).filter(Boolean);
    if (segments.length >= 3) {
        const [chainName, tokenA, tokenB] = segments;
        const leftSymbol = resolveTokenSymbol(tokenA) ?? tokenA;
        const rightSymbol = resolveTokenSymbol(tokenB) ?? tokenB;
        if (chainName && leftSymbol && rightSymbol) {
            return `${leftSymbol}/${rightSymbol}`;
        }
    }
    const addressMatches = rawValue.match(/0x[a-fA-F0-9]{20,64}/g) ?? [];
    if (addressMatches.length >= 2) {
        const leftSymbol = resolveTokenSymbol(addressMatches[0]) ?? "TOKEN";
        const rightSymbol = resolveTokenSymbol(addressMatches[1]) ?? "TOKEN";
        return `${leftSymbol}/${rightSymbol}`;
    }
    return rawValue;
}
function formatConfidence(value) {
    if (typeof value === "number") {
        return String(value).replace(/%/g, "");
    }
    if (!value) {
        return "0";
    }
    return String(value).replace(/%/g, "").trim() || "0";
}
function SectionCard({ title, subtitle, children }) {
    return (<section className="panel terminal-panel flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.36em] text-amber-600">{title}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{subtitle}</h3>
        </div>
        <span className="rounded-full border border-amber-300/50 bg-amber-100/40 px-2.5 py-1 text-[10px] font-medium text-amber-700">
          Live
        </span>
      </div>
      {children}
    </section>);
}
function toHexQuantity(value) {
    return `0x${value.toString(16)}`;
}
const MAX_UINT256_HEX = `${"f".repeat(64)}`;
function buildApproveData(spender) {
    return `0x095ea7b3${spender.slice(2).padStart(64, "0")}${MAX_UINT256_HEX}`;
}
const FLASHLOAN_CHAIN_CONFIG = {
    ethereum: {
        chainId: "0x1",
        chainName: "Ethereum",
        nativeSymbol: "ETH",
        rpcUrl: "https://ethereum-rpc.publicnode.com",
        usdtAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        usdtDecimals: 6,
        wnativeAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    },
    arbitrum: {
        chainId: "0xa4b1",
        chainName: "Arbitrum One",
        nativeSymbol: "ETH",
        rpcUrl: "https://arb1.arbitrum.io/rpc",
        usdtAddress: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
        usdtDecimals: 6,
        wnativeAddress: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    },
    base: {
        chainId: "0x2105",
        chainName: "Base",
        nativeSymbol: "ETH",
        rpcUrl: "https://mainnet.base.org",
        usdtAddress: "0xfde4c96c8593536e31f229ea8f37b2ad3ad1d9e2",
        usdtDecimals: 6,
        wnativeAddress: "0x4200000000000000000000000000000000000006",
    },
    optimism: {
        chainId: "0xa",
        chainName: "Optimism",
        nativeSymbol: "ETH",
        rpcUrl: "https://mainnet.optimism.io",
        usdtAddress: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
        usdtDecimals: 6,
        wnativeAddress: "0x4200000000000000000000000000000000000006",
    },
    polygon: {
        chainId: "0x89",
        chainName: "Polygon",
        nativeSymbol: "MATIC",
        rpcUrl: "https://polygon-rpc.com",
        usdtAddress: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
        usdtDecimals: 6,
        wnativeAddress: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
    },
    bnb: {
        chainId: "0x38",
        chainName: "BNB Smart Chain",
        nativeSymbol: "BNB",
        rpcUrl: "https://bsc-dataseed.binance.org/",
        usdtAddress: "0x55d398326f99059ff775485246999027b3197955",
        usdtDecimals: 18,
        wnativeAddress: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    },
    avalanche: {
        chainId: "0xa86a",
        chainName: "Avalanche",
        nativeSymbol: "AVAX",
        rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
        usdtAddress: "0x9702230A8Ea53601f5cD2dc00f8Db8d4df4A8C7",
        usdtDecimals: 6,
        wnativeAddress: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    },
    fantom: {
        chainId: "0xfa",
        chainName: "Fantom",
        nativeSymbol: "FTM",
        rpcUrl: "https://rpc.ftm.tools",
        usdtAddress: "0x04068da6c83afcfa0e13ba15a6696662335d5b75",
        usdtDecimals: 6,
        wnativeAddress: "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83",
    },
    celo: {
        chainId: "0xa4ec",
        chainName: "Celo",
        nativeSymbol: "CELO",
        rpcUrl: "https://forno.celo.org",
        usdtAddress: "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e",
        usdtDecimals: 6,
        wnativeAddress: "0x471EcE3750Da237f93B8E339c536989b8978a479",
    },
    mantle: {
        chainId: "0x1388",
        chainName: "Mantle",
        nativeSymbol: "MNT",
        rpcUrl: "https://rpc.mantle.xyz",
        usdtAddress: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
        usdtDecimals: 6,
        wnativeAddress: "0x78c1b0C915c4FAA5FffA6CAbf0213952c2B6EC12",
    },
    blast: {
        chainId: "0x13e31",
        chainName: "Blast",
        nativeSymbol: "ETH",
        rpcUrl: "https://rpc.blast.io",
        usdtAddress: "0x4300000000000000000000000000000000000003",
        usdtDecimals: 6,
        wnativeAddress: "0x4300000000000000000000000000000000000004",
    },
    linea: {
        chainId: "0xe708",
        chainName: "Linea",
        nativeSymbol: "ETH",
        rpcUrl: "https://rpc.linea.build",
        usdtAddress: "0x0000000000000000000000000000000000000001",
        usdtDecimals: 6,
        wnativeAddress: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
    },
    scroll: {
        chainId: "0x8274",
        chainName: "Scroll",
        nativeSymbol: "ETH",
        rpcUrl: "https://rpc.scroll.io",
        usdtAddress: "0xf55BEC9cAEDC1a4C09dA540f57c0bA0D8d99c19A",
        usdtDecimals: 6,
        wnativeAddress: "0x5300000000000000000000000000000000000004",
    },
    zksync: {
        chainId: "0x144",
        chainName: "zkSync Era",
        nativeSymbol: "ETH",
        rpcUrl: "https://mainnet.era.zksync.io",
        usdtAddress: "0x493257fD37EDB34451f62EDf8D2a0C418852bA4C",
        usdtDecimals: 6,
        wnativeAddress: "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91",
    },
    mode: {
        chainId: "0x868b",
        chainName: "Mode",
        nativeSymbol: "ETH",
        rpcUrl: "https://mainnet.mode.network",
        usdtAddress: "0xF19547f9ED24aA66b03c3a552D181Ae334FBb8DB",
        usdtDecimals: 6,
        wnativeAddress: "0x4200000000000000000000000000000000000006",
    },
};
const FLASHLOAN_CHAIN_LIST = Object.keys(FLASHLOAN_CHAIN_CONFIG);
function isFlashloanChain(chain) {
    return chain in FLASHLOAN_CHAIN_CONFIG;
}
function getChainConfig(chain) {
    return isFlashloanChain(chain) ? FLASHLOAN_CHAIN_CONFIG[chain] : FLASHLOAN_CHAIN_CONFIG.arbitrum;
}
function getChainFromChainId(chainId) {
    const entry = Object.entries(FLASHLOAN_CHAIN_CONFIG).find(([, config]) => config.chainId === chainId);
    return entry ? entry[0] : null;
}
function getChainNumericId(chain) {
    return Number.parseInt(getChainConfig(chain).chainId, 16);
}
function Home() {
    const [dashboardSnapshot, setDashboardSnapshot] = (0, react_1.useState)(() => (0, dashboardData_1.createDefaultDashboardSnapshot)());
    const [scannerCount, setScannerCount] = (0, react_1.useState)(5);
    const [lastKnownBlockMap, setLastKnownBlockMap] = (0, react_1.useState)({});
    const [isRefreshing, setIsRefreshing] = (0, react_1.useState)(false);
    const [walletAddress, setWalletAddress] = (0, react_1.useState)(null);
    const [walletChain, setWalletChain] = (0, react_1.useState)("Not connected");
    const [walletBalance, setWalletBalance] = (0, react_1.useState)("0");
    const [walletUsdtBalance, setWalletUsdtBalance] = (0, react_1.useState)(null);
    const [walletWbnbBalance, setWalletWbnbBalance] = (0, react_1.useState)(null);
    const [walletStatus, setWalletStatus] = (0, react_1.useState)("Wallet not connected");
    const [connectedWallet, setConnectedWallet] = (0, react_1.useState)("None");
    const [isExecuting, setIsExecuting] = (0, react_1.useState)(false);
    const [isConnecting, setIsConnecting] = (0, react_1.useState)(false);
    const [isWalletPanelOpen, setIsWalletPanelOpen] = (0, react_1.useState)(false);
    const [isHydrated, setIsHydrated] = (0, react_1.useState)(false);
    const [executionMessage, setExecutionMessage] = (0, react_1.useState)("No transaction submitted yet.");
    const [executionHash, setExecutionHash] = (0, react_1.useState)(null);
    const [selectedExecutionIntentId, setSelectedExecutionIntentId] = (0, react_1.useState)(null);
    const [tradeAmountUsd, setTradeAmountUsd] = (0, react_1.useState)(100);
    const [minimumNotionalUsd, setMinimumNotionalUsd] = (0, react_1.useState)(100);
    const [tradeAmountError, setTradeAmountError] = (0, react_1.useState)(null);
    const [slippageBps, setSlippageBps] = (0, react_1.useState)(50);
    const [isCustomSlippage, setIsCustomSlippage] = (0, react_1.useState)(false);
    const [customSlippagePercent, setCustomSlippagePercent] = (0, react_1.useState)("0.50");
    const slippagePresetOptions = [
        { label: "0.10%", valueBps: 10 },
        { label: "0.25%", valueBps: 25 },
        { label: "0.50%", valueBps: 50 },
    ];
    const applySlippagePreset = (valueBps) => {
        setSlippageBps(valueBps);
        setIsCustomSlippage(false);
        setCustomSlippagePercent((valueBps / 100).toFixed(2));
    };
    const applyCustomSlippage = (value) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return;
        }
        const nextPercent = Math.min(5, parsed);
        setCustomSlippagePercent(nextPercent.toFixed(2));
        setSlippageBps(Math.round(nextPercent * 100));
        setIsCustomSlippage(true);
    };
    const [activePanel, setActivePanel] = (0, react_1.useState)("overview");
    const [activeSidebarLabel, setActiveSidebarLabel] = (0, react_1.useState)("Dashboard");
    const [isSidebarCollapsed, setIsSidebarCollapsed] = (0, react_1.useState)(false);
    const [isAutoBotEnabled, setIsAutoBotEnabled] = (0, react_1.useState)(false);
    const [autoBotStatus, setAutoBotStatus] = (0, react_1.useState)("Auto bot idle");
    const [isScanning, setIsScanning] = (0, react_1.useState)(false);
    const [selectedTokenSymbol, setSelectedTokenSymbol] = (0, react_1.useState)(null);
    const walletConnectProviderRef = (0, react_1.useRef)(null);
    const walletUsdtBalanceRef = (0, react_1.useRef)(null);
    const autoWalletConnectAttemptedRef = (0, react_1.useRef)(false);
    const [walletConnectProjectId, setWalletConnectProjectId] = (0, react_1.useState)(() => process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "");
    const [walletConnectProjectIdInput, setWalletConnectProjectIdInput] = (0, react_1.useState)("");
    const [profile, setProfile] = (0, react_1.useState)(DEFAULT_PROFILE);
    const profileHydratedRef = (0, react_1.useRef)(false);
    const autoBotHydratedRef = (0, react_1.useRef)(false);
    const executeRouteRef = (0, react_1.useRef)(async () => { });
    const executionLockRef = (0, react_1.useRef)(false);
    const autoBotPollInFlightRef = (0, react_1.useRef)(false);
    const executionReadiness = (0, react_1.useMemo)(() => dashboardSnapshot.executionReadiness ?? {
        readyPairs: 0,
        pendingPairs: 0,
        coverage: "0%",
        perDex: [],
        pairs: [],
    }, [dashboardSnapshot]);
    const parseOpportunityMetric = (value) => {
        if (typeof value === "number") {
            return Number.isFinite(value) ? value : 0;
        }
        const normalized = String(value ?? "")
            .replace(/[$,%\s]/g, "")
            .replace(/,/g, "")
            .trim();
        if (!normalized || normalized === "—" || normalized === "-") {
            return 0;
        }
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    };
    const parseUsdAmount = (value) => {
        const parsed = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
        return Number.isFinite(parsed) ? parsed : 0;
    };
    const liveOpportunityRows = (0, react_1.useMemo)(() => {
        const rows = dashboardSnapshot.opportunitiesFeed ?? [];
        if (rows.length === 0) {
            return [];
        }
        return [...rows]
            .filter((row) => typeof row.pair === "string" || typeof row.buyDex === "string" || typeof row.sellDex === "string")
            .sort((a, b) => {
            const profitGap = parseOpportunityMetric(b.profit) - parseOpportunityMetric(a.profit);
            if (profitGap !== 0) {
                return profitGap;
            }
            return parseOpportunityMetric(b.confidence) - parseOpportunityMetric(a.confidence);
        })
            .slice(0, scannerCount);
    }, [dashboardSnapshot.opportunitiesFeed, scannerCount]);
    const visibleScannerRows = (0, react_1.useMemo)(() => liveOpportunityRows.slice(0, 2), [liveOpportunityRows]);
    const opportunityTableRows = (0, react_1.useMemo)(() => liveOpportunityRows.slice(0, 24), [liveOpportunityRows]);
    const totalOpportunityCount = Math.max(0, Math.min(12, liveOpportunityRows.length));
    const scannerTone = (0, react_1.useMemo)(() => {
        if (totalOpportunityCount <= 2) {
            return {
                accent: "#ef4444",
                strong: "#fca5a5",
                glow: "rgba(239, 68, 68, 0.22)",
            };
        }
        if (totalOpportunityCount <= 5) {
            return {
                accent: "#d4a63e",
                strong: "#f5d88a",
                glow: "rgba(212, 166, 62, 0.22)",
            };
        }
        if (totalOpportunityCount <= 10) {
            return {
                accent: "#3b82f6",
                strong: "#93c5fd",
                glow: "rgba(59, 130, 246, 0.22)",
            };
        }
        if (totalOpportunityCount <= 15) {
            return {
                accent: "#f8fafc",
                strong: "#ffffff",
                glow: "rgba(255, 255, 255, 0.18)",
            };
        }
        return {
            accent: "#c0c0c0",
            strong: "#e2e8f0",
            glow: "rgba(192, 192, 192, 0.2)",
        };
    }, [totalOpportunityCount]);
    const visibleExecutionRoutes = (0, react_1.useMemo)(() => (executionReadiness.pairs ?? []).slice(0, 144), [executionReadiness.pairs]);
    const transactions = (0, react_1.useMemo)(() => dashboardSnapshot.transactions ?? [], [dashboardSnapshot]);
    const tradeHistory = (0, react_1.useMemo)(() => dashboardSnapshot.tradeHistory ?? [], [dashboardSnapshot.tradeHistory]);
    const executionIntents = (0, react_1.useMemo)(() => dashboardSnapshot.executionIntents ?? [], [dashboardSnapshot.executionIntents]);
    (0, react_1.useEffect)(() => {
        if (executionIntents.length === 0) {
            setSelectedExecutionIntentId(null);
            return;
        }
        if (!selectedExecutionIntentId || !executionIntents.some((intent) => intent.id === selectedExecutionIntentId)) {
            setSelectedExecutionIntentId(executionIntents[0].id);
        }
    }, [executionIntents, selectedExecutionIntentId]);
    const selectedExecutionIntent = (0, react_1.useMemo)(() => executionIntents.find((intent) => intent.id === selectedExecutionIntentId) ?? executionIntents[0] ?? null, [executionIntents, selectedExecutionIntentId]);
    const gasFeeHistory = (0, react_1.useMemo)(() => {
        if (transactions.length > 0) {
            return transactions.map((tx, index) => ({
                id: `${tx.hash}-${index}`,
                label: tx.status || `Tx ${index + 1}`,
                value: parseUsdAmount(tx.gasUsed),
                display: tx.gasUsed || "$0",
            }));
        }
        return tradeHistory.map((trade, index) => ({
            id: `${trade.id}-${index}`,
            label: trade.route,
            value: 0,
            display: "$0",
        }));
    }, [tradeHistory, transactions]);
    const totalGasFeesDeducted = (0, react_1.useMemo)(() => gasFeeHistory.reduce((sum, entry) => sum + entry.value, 0), [gasFeeHistory]);
    const executedQuotesHistory = (0, react_1.useMemo)(() => tradeHistory.map((trade) => ({
        id: trade.id,
        pair: trade.pair,
        route: trade.route,
        time: trade.executedAt,
        status: trade.status,
    })), [tradeHistory]);
    const chartSummary = (0, react_1.useMemo)(() => dashboardSnapshot.chartSummary ?? {
        profitHistory: [],
        gasBars: [],
        successRate: "0%",
        opportunityTimeline: "0 active",
    }, [dashboardSnapshot.chartSummary]);
    const dexAnalytics = (0, react_1.useMemo)(() => dashboardSnapshot.dexAnalytics ?? [], [dashboardSnapshot.dexAnalytics]);
    const quoteHealth = (0, react_1.useMemo)(() => dashboardSnapshot.quoteHealth ?? [], [dashboardSnapshot.quoteHealth]);
    const dexSupportMatrix = (0, react_1.useMemo)(() => dashboardSnapshot.dexSupportMatrix ?? [], [dashboardSnapshot.dexSupportMatrix]);
    const rpcHealth = (0, react_1.useMemo)(() => dashboardSnapshot.rpcHealth ?? [], [dashboardSnapshot.rpcHealth]);
    const chainHealthMap = (0, react_1.useMemo)(() => new Map(rpcHealth.map((chain) => [String(chain.chain ?? "").trim().toLowerCase(), chain])), [rpcHealth]);
    const chainBlockMap = (0, react_1.useMemo)(() => {
        const nextMap = PROJECT_CHAIN_LIST.reduce((accumulator, chainName) => {
            const key = chainName.toLowerCase();
            const latestBlock = Number(chainHealthMap.get(key)?.latestBlock ?? 0);
            accumulator[key] = Number.isFinite(latestBlock) && latestBlock > 0 ? latestBlock : 0;
            return accumulator;
        }, {});
        return nextMap;
    }, [chainHealthMap]);
    (0, react_1.useEffect)(() => {
        setLastKnownBlockMap((current) => {
            const nextMap = { ...current };
            for (const [chainKey, value] of Object.entries(chainBlockMap)) {
                if (typeof value === "number" && Number.isFinite(value) && value > 0) {
                    nextMap[chainKey] = value;
                }
            }
            return nextMap;
        });
    }, [chainBlockMap]);
    const resolvedRpcHealth = (0, react_1.useMemo)(() => {
        const merged = new Map();
        for (const chain of rpcHealth) {
            const key = String(chain.chain ?? "").trim().toLowerCase();
            if (key) {
                merged.set(key, chain);
            }
        }
        return PROJECT_CHAIN_LIST.map((chainName) => {
            const key = chainName.toLowerCase();
            const entry = merged.get(key);
            if (entry) {
                return entry;
            }
            return {
                chain: chainName,
                selectedUrl: undefined,
                total: 0,
                healthy: 0,
                offline: 0,
                overall: "offline",
                endpoints: [],
            };
        });
    }, [rpcHealth]);
    const tokenMonitoring = (0, react_1.useMemo)(() => dashboardSnapshot.tokenMonitoring ?? [], [dashboardSnapshot.tokenMonitoring]);
    const trackedTokens = (0, react_1.useMemo)(() => {
        const map = new Map();
        tokenMonitoring.forEach((token) => {
            const symbol = String(token.symbol ?? "").trim();
            if (!symbol) {
                return;
            }
            const entry = map.get(symbol) ?? {
                symbol,
                price: token.price ?? "$0",
                liquidity: token.liquidity ?? "$0",
                volume: token.volume ?? "$0",
                risk: token.risk ?? "Low",
            };
            map.set(symbol, entry);
        });
        return Array.from(map.values()).sort((left, right) => left.symbol.localeCompare(right.symbol));
    }, [tokenMonitoring]);
    const parseTokenPriceString = (value) => {
        const normalized = String(value ?? "$0").replace(/[$,%\s,]/g, "");
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    };
    const formatTokenPrice = (value) => {
        if (!Number.isFinite(value)) {
            return "$0";
        }
        if (value >= 1000) {
            return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
        }
        if (value >= 1) {
            return `$${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
        }
        if (value >= 0.01) {
            return `$${value.toFixed(4)}`;
        }
        return `$${value.toFixed(8)}`;
    };
    const MIN_24H_VOLUME_USD = 100_000;
    const formatVolumeDisplay = (value) => {
        if (!Number.isFinite(value) || value <= 0) {
            return "$0";
        }
        if (value >= 1_000_000_000) {
            return `$${(value / 1_000_000_000).toFixed(2)}B`;
        }
        if (value >= 1_000_000) {
            return `$${(value / 1_000_000).toFixed(2)}M`;
        }
        if (value >= 1_000) {
            return `$${(value / 1_000).toFixed(2)}K`;
        }
        return `$${value.toFixed(2)}`;
    };
    const parseDexReputationScore = (entry) => {
        if (!entry || typeof entry !== "object") {
            return null;
        }
        const candidateKeys = [
            "rating",
            "reputation",
            "reviewScore",
            "reputationScore",
            "userRating",
            "ratingScore",
            "score",
        ];
        for (const key of candidateKeys) {
            const value = Number(entry[key] ?? 0);
            if (Number.isFinite(value) && value > 0) {
                return value;
            }
        }
        const nestedDex = entry.dex;
        if (nestedDex) {
            for (const key of ["rating", "reputation", "reviewScore", "score"]) {
                const value = Number(nestedDex[key] ?? 0);
                if (Number.isFinite(value) && value > 0) {
                    return value;
                }
            }
        }
        return null;
    };
    const [liveTokenPrices, setLiveTokenPrices] = (0, react_1.useState)({});
    const [bestDexBySymbol, setBestDexBySymbol] = (0, react_1.useState)({});
    const [selectedTokenDexRows, setSelectedTokenDexRows] = (0, react_1.useState)([]);
    const [selectedDexChainFilter, setSelectedDexChainFilter] = (0, react_1.useState)("all");
    const [selectedDexPriceFilter, setSelectedDexPriceFilter] = (0, react_1.useState)("all");
    const [selectedDexExactMode, setSelectedDexExactMode] = (0, react_1.useState)(false);
    const tokenRefreshThrottleRef = (0, react_1.useRef)(null);
    const selectedTokenRefreshThrottleRef = (0, react_1.useRef)({});
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined" || trackedTokens.length === 0) {
            return;
        }
        const refreshAllTokenPrices = async () => {
            const now = Date.now();
            if (tokenRefreshThrottleRef.current && now - tokenRefreshThrottleRef.current < 30000) {
                return;
            }
            tokenRefreshThrottleRef.current = now;
            const symbols = trackedTokens.map((token) => token.symbol).filter(Boolean);
            if (!symbols.length) {
                return;
            }
            try {
                const response = await fetch(`/api/token-prices?symbols=${encodeURIComponent(symbols.join(","))}`, { cache: "no-store" });
                if (!response.ok) {
                    return;
                }
                const payload = await response.json();
                const tokenMap = payload?.tokens ?? [];
                const nextPrices = {};
                const nextBestDexMap = {};
                for (const entry of tokenMap) {
                    const symbol = String(entry?.symbol ?? "").trim();
                    const price = Number(entry?.price ?? 0);
                    const dexes = Array.isArray(entry?.dexes) ? entry.dexes : [];
                    const leadingDex = dexes.length > 0 ? String(dexes[0]?.dex ?? "") : "";
                    if (symbol && Number.isFinite(price) && price > 0) {
                        nextPrices[symbol] = price;
                    }
                    if (symbol && leadingDex) {
                        nextBestDexMap[symbol] = leadingDex;
                    }
                }
                setLiveTokenPrices((current) => ({ ...current, ...nextPrices }));
                setBestDexBySymbol((current) => ({ ...current, ...nextBestDexMap }));
            }
            catch {
                // Keep last known live values when refresh fails.
            }
        };
        void refreshAllTokenPrices();
        const intervalId = window.setInterval(() => {
            void refreshAllTokenPrices();
        }, 15000);
        return () => window.clearInterval(intervalId);
    }, [trackedTokens]);
    const liveTrackedTokens = (0, react_1.useMemo)(() => trackedTokens.map((token) => {
        const currentValue = liveTokenPrices[token.symbol] ?? parseTokenPriceString(token.price);
        return {
            ...token,
            price: formatTokenPrice(currentValue),
        };
    }), [liveTokenPrices, trackedTokens]);
    const selectedToken = (0, react_1.useMemo)(() => liveTrackedTokens.find((token) => token.symbol === selectedTokenSymbol) ?? null, [liveTrackedTokens, selectedTokenSymbol]);
    const availableSelectedDexChains = (0, react_1.useMemo)(() => {
        const chains = selectedTokenDexRows
            .map((row) => String(row.chain ?? "").trim())
            .filter(Boolean)
            .map((chain) => chain.toLowerCase())
            .filter((chain) => chain.length > 0);
        return Array.from(new Set(chains)).sort((left, right) => {
            if (left === "multi-chain") {
                return 1;
            }
            if (right === "multi-chain") {
                return -1;
            }
            return left.localeCompare(right);
        });
    }, [selectedTokenDexRows]);
    const sameChainDexGroups = (0, react_1.useMemo)(() => {
        const grouped = new Map();
        for (const row of selectedTokenDexRows) {
            const chainKey = String(row.chain ?? "").trim().toLowerCase();
            if (!chainKey || chainKey === "multi-chain") {
                continue;
            }
            const current = grouped.get(chainKey) ?? [];
            current.push(row);
            grouped.set(chainKey, current);
        }
        return Array.from(grouped.values()).filter((rows) => rows.length >= 2);
    }, [selectedTokenDexRows]);
    const highestPriceDexRow = (0, react_1.useMemo)(() => {
        if (sameChainDexGroups.length === 0) {
            return null;
        }
        const comparisonPool = selectedDexChainFilter !== "all"
            ? sameChainDexGroups.filter((rows) => rows.some((row) => String(row.chain ?? "").trim().toLowerCase() === selectedDexChainFilter))
            : sameChainDexGroups;
        if (comparisonPool.length === 0) {
            return null;
        }
        const candidateRows = comparisonPool.flatMap((rows) => rows);
        return candidateRows.reduce((best, current) => (current.price > best.price ? current : best));
    }, [sameChainDexGroups, selectedDexChainFilter]);
    const lowestPriceDexRow = (0, react_1.useMemo)(() => {
        if (sameChainDexGroups.length === 0) {
            return null;
        }
        const comparisonPool = selectedDexChainFilter !== "all"
            ? sameChainDexGroups.filter((rows) => rows.some((row) => String(row.chain ?? "").trim().toLowerCase() === selectedDexChainFilter))
            : sameChainDexGroups;
        if (comparisonPool.length === 0) {
            return null;
        }
        const candidateRows = comparisonPool.flatMap((rows) => rows);
        return candidateRows.reduce((best, current) => (current.price < best.price ? current : best));
    }, [sameChainDexGroups, selectedDexChainFilter]);
    const bestArbitrageGap = (0, react_1.useMemo)(() => {
        if (!highestPriceDexRow || !lowestPriceDexRow || lowestPriceDexRow.price <= 0) {
            return null;
        }
        if (String(highestPriceDexRow.chain ?? "").trim().toLowerCase() !== String(lowestPriceDexRow.chain ?? "").trim().toLowerCase()) {
            return null;
        }
        const absoluteGap = highestPriceDexRow.price - lowestPriceDexRow.price;
        const percentGap = (absoluteGap / lowestPriceDexRow.price) * 100;
        return {
            absoluteGap,
            buyPrice: highestPriceDexRow.price,
            sellPrice: lowestPriceDexRow.price,
            absoluteGapUsd: absoluteGap,
            percentGap,
            buyDex: highestPriceDexRow.dex,
            sellDex: lowestPriceDexRow.dex,
            pairName: highestPriceDexRow.pairName || `${selectedTokenSymbol ?? "TOKEN"}/USDT`,
        };
    }, [highestPriceDexRow, lowestPriceDexRow, selectedTokenSymbol]);
    const filteredSelectedTokenDexRows = (0, react_1.useMemo)(() => {
        let chainFiltered = [...selectedTokenDexRows].filter((row) => {
            const chainKey = String(row.chain ?? "").trim().toLowerCase();
            return chainKey && chainKey !== "multi-chain";
        });
        if (selectedDexChainFilter !== "all") {
            chainFiltered = chainFiltered.filter((row) => {
                const chainKey = String(row.chain ?? "").trim().toLowerCase();
                return chainKey === selectedDexChainFilter;
            });
        }
        if (selectedDexExactMode) {
            chainFiltered = chainFiltered.filter((row) => row.isExact !== false);
        }
        chainFiltered.sort((left, right) => right.price - left.price);
        if (selectedDexPriceFilter === "all") {
            return chainFiltered;
        }
        const extremePrice = selectedDexPriceFilter === "highest"
            ? Math.max(...chainFiltered.map((row) => row.price))
            : Math.min(...chainFiltered.map((row) => row.price));
        return chainFiltered.filter((row) => Math.abs(row.price - extremePrice) < 1e-9);
    }, [selectedDexChainFilter, selectedDexExactMode, selectedDexPriceFilter, selectedTokenDexRows]);
    (0, react_1.useEffect)(() => {
        if (!selectedTokenSymbol) {
            setSelectedTokenDexRows([]);
            setSelectedDexChainFilter("all");
            setSelectedDexPriceFilter("all");
            return;
        }
        setSelectedDexChainFilter("all");
        setSelectedDexPriceFilter("all");
        setSelectedDexExactMode(false);
        const refreshSelectedTokenDexRows = async () => {
            const now = Date.now();
            const lastRefresh = selectedTokenRefreshThrottleRef.current[selectedTokenSymbol] ?? 0;
            if (now - lastRefresh < 15000) {
                return;
            }
            selectedTokenRefreshThrottleRef.current[selectedTokenSymbol] = now;
            try {
                const response = await fetch(`/api/token-prices?symbol=${encodeURIComponent(selectedTokenSymbol)}`, { cache: "no-store" });
                if (!response.ok) {
                    setSelectedTokenDexRows([]);
                    return;
                }
                const payload = await response.json();
                const dexes = Array.isArray(payload?.dexes) ? payload.dexes : [];
                const rawRows = [];
                for (const [index, entry] of dexes.entries()) {
                    const volumeValue = Number(entry?.volume ?? 0);
                    const priceValue = Number(entry?.price ?? 0);
                    const chainKey = String(entry?.chain ?? "").trim().toLowerCase();
                    if (!Number.isFinite(priceValue) || priceValue <= 0 || !chainKey || chainKey === "multi-chain") {
                        continue;
                    }
                    rawRows.push({
                        dex: entry?.dex ?? `DEX-${index + 1}`,
                        chain: chainKey,
                        pairName: `${selectedTokenSymbol}/USDT`,
                        price: priceValue,
                        spread: `${(0.08 + ((index % 7) * 0.11) + ((index % 2) * 0.04)).toFixed(2)}%`,
                        volume: formatVolumeDisplay(volumeValue),
                        status: String(entry?.status ?? "").toUpperCase() === "LIVE" ? "LIVE" : "ACTIVE",
                        isExact: entry?.isExact === true,
                    });
                }
                const rows = [...rawRows].sort((left, right) => right.price - left.price).slice(0, 74);
                setSelectedTokenDexRows(rows);
            }
            catch {
                setSelectedTokenDexRows([]);
            }
        };
        void refreshSelectedTokenDexRows();
        const intervalId = window.setInterval(() => {
            void refreshSelectedTokenDexRows();
        }, 15000);
        return () => window.clearInterval(intervalId);
    }, [selectedTokenSymbol]);
    const aiMetrics = (0, react_1.useMemo)(() => dashboardSnapshot.aiMetrics ?? [], [dashboardSnapshot.aiMetrics]);
    const recoveryWorker = (0, react_1.useMemo)(() => dashboardSnapshot.recoveryWorker ?? {
        enabled: false,
        inFlight: false,
        intervalMs: 0,
        maxAttempts: 0,
        baseBackoffMs: 0,
        maxBackoffMs: 0,
        defaultSlippageBps: 0,
        pending: 0,
        retryReady: 0,
        lastRunAt: undefined,
    }, [dashboardSnapshot.recoveryWorker]);
    const settlementWorker = (0, react_1.useMemo)(() => dashboardSnapshot.settlementWorker ?? {
        enabled: false,
        inFlight: false,
        intervalMs: 0,
        maxAttempts: 0,
        baseBackoffMs: 0,
        maxBackoffMs: 0,
        minProfitBps: 0,
        pending: 0,
        retryReady: 0,
        lastRunAt: undefined,
    }, [dashboardSnapshot.settlementWorker]);
    const settlementQueue = (0, react_1.useMemo)(() => dashboardSnapshot.settlementQueue ?? {
        pending: 0,
        settled: 0,
        failed: 0,
        items: [],
    }, [dashboardSnapshot.settlementQueue]);
    const recentSettlementQueueItems = (0, react_1.useMemo)(() => (settlementQueue.items ?? []).slice(0, 3), [settlementQueue.items]);
    const settlementsSummary = (0, react_1.useMemo)(() => dashboardSnapshot.settlements ?? {
        count: 0,
        latest: undefined,
    }, [dashboardSnapshot.settlements]);
    const rolloutSummary = (0, react_1.useMemo)(() => dashboardSnapshot.rollout?.summary ?? {
        blocked: 0,
        canary: 0,
        scale: 0,
    }, [dashboardSnapshot.rollout?.summary]);
    const rolloutChains = (0, react_1.useMemo)(() => (dashboardSnapshot.rollout?.chains ?? []).slice(0, 4), [dashboardSnapshot.rollout?.chains]);
    const rolloutGovernance = (0, react_1.useMemo)(() => dashboardSnapshot.rollout?.governance ?? {
        autopilotEnabled: true,
        promotionStreakRequired: 3,
        promotionCooldownMs: 600000,
        demotionCooldownMs: 180000,
    }, [dashboardSnapshot.rollout?.governance]);
    const killSwitch = (0, react_1.useMemo)(() => dashboardSnapshot.killSwitch ?? {
        engaged: false,
        reason: undefined,
        engagedAt: undefined,
        consecutiveLosses: 0,
        abnormalSlippageEvents: 0,
        rpcInstabilityEvents: 0,
        dailyRealizedLossUsd: 0,
    }, [dashboardSnapshot.killSwitch]);
    const replaySummary = (0, react_1.useMemo)(() => dashboardSnapshot.replay ?? {
        windowMinutes: 60,
        scanned: 0,
        executable: 0,
        avgExpectedNetUsd: 0,
    }, [dashboardSnapshot.replay]);
    const degradedChains = (0, react_1.useMemo)(() => dashboardSnapshot.rpc?.degradedOrOfflineChains ?? [], [dashboardSnapshot.rpc?.degradedOrOfflineChains]);
    const signerPolicy = (0, react_1.useMemo)(() => dashboardSnapshot.signerPolicy ?? {
        mode: "wallet-external",
        ready: true,
        production: false,
        usingServerKey: false,
        kmsConfigured: false,
        reason: "External wallet signer mode is active.",
    }, [dashboardSnapshot.signerPolicy]);
    const capitalPolicy = (0, react_1.useMemo)(() => dashboardSnapshot.capitalPolicy ?? {
        activeAllocationShare: 0.6,
        reserveAllocationShare: 0.25,
        emergencyAllocationShare: 0.15,
        emergencyReserveFloorUsd: 150,
        maxTradeShareOfActiveCapital: 0.35,
        minGasReserveNative: {},
    }, [dashboardSnapshot.capitalPolicy]);
    const capitalGrowth = (0, react_1.useMemo)(() => dashboardSnapshot.capitalGrowth ?? {
        status: "conservative",
        currentActiveShare: 0.6,
        recommendedActiveShare: 0.6,
        deltaActiveShare: 0,
        winRatePct: 55,
        drawdownPct: 0,
        realizedNetUsd: 0,
        decisionScore: 0.7,
        allowed: true,
        reason: "Capital growth is conservative until a clean performance streak is sustained.",
        nextReviewAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    }, [dashboardSnapshot.capitalGrowth]);
    const marketValidation = (0, react_1.useMemo)(() => dashboardSnapshot.marketValidation ?? {
        status: "watch",
        allowed: true,
        score: 0.6,
        liveOpportunityRatio: 0.05,
        avgExpectedNetUsd: 0,
        rpcHealthyRatio: 1,
        reason: "The engine is running but live market validation is still being proven.",
    }, [dashboardSnapshot.marketValidation]);
    const canaryValidation = (0, react_1.useMemo)(() => dashboardSnapshot.canaryValidation ?? {
        chain: "arbitrum",
        windowHours: 24,
        minSettledTrades: 3,
        minRealizedNetUsd: 1,
        maxAverageSlippageBps: 35,
        maxLossTrades: 1,
        settledTrades: 0,
        lossTrades: 0,
        cumulativeRealizedNetUsd: 0,
        averageSlippageBps: 0,
        goForScale: false,
        reason: "No canary validation data yet.",
        latestSettledAt: undefined,
    }, [dashboardSnapshot.canaryValidation]);
    const relayRpcDrill = (0, react_1.useMemo)(() => dashboardSnapshot.relayRpcDrill ?? {
        generatedAt: new Date().toISOString(),
        relay: { requiredChains: [], configuredChains: [], missingChains: [], pass: false },
        rpc: { totalChains: 0, degradedOrOfflineChains: [], lowRedundancyChains: [], pass: false },
        failClosed: { apiKeyConfigured: false, unsafeBypassEnabled: false, signerReady: true, pass: false },
        alerts: { webhookConfigured: false, pass: false },
        workers: { recoveryEnabled: false, settlementEnabled: false, pass: false },
        overallPass: false,
        reason: "Relay/RPC drill has not run yet.",
    }, [dashboardSnapshot.relayRpcDrill]);
    const liveCostTuning = (0, react_1.useMemo)(() => dashboardSnapshot.liveCostTuning ?? {
        windowTrades: 0,
        avgGasCostUsd: 0,
        avgSlippageBps: 0,
        avgRealizedNetUsd: 0,
        gasCostBufferUsd: 0,
        slippageMultiplier: 1,
        sizingPenaltyMultiplier: 1,
        reason: "No settled trades yet; live cost tuning is neutral.",
    }, [dashboardSnapshot.liveCostTuning]);
    const readinessGate = (0, react_1.useMemo)(() => dashboardSnapshot.readinessGate ?? {
        generatedAt: new Date().toISOString(),
        enforced: { canaryPassRequired: false, relayRpcDrillPassRequired: false },
        checks: { killSwitchClear: true, signerReady: true, canaryPass: false, relayRpcDrillPass: false },
        pass: true,
        reason: "Execution readiness gate is advisory-only (enforcement disabled).",
    }, [dashboardSnapshot.readinessGate]);
    const readinessGateHistory = (0, react_1.useMemo)(() => dashboardSnapshot.readinessGateHistory ?? [], [dashboardSnapshot.readinessGateHistory]);
    const operatorSafety = (0, react_1.useMemo)(() => dashboardSnapshot.operatorSafety ?? {
        generatedAt: new Date().toISOString(),
        persistence: {
            filePath: "",
            exists: false,
            healthy: false,
            sizeBytes: 0,
            lastModifiedAt: undefined,
        },
        alerting: {
            webhookConfigured: false,
            pass: false,
        },
        risk: {
            killSwitchEngaged: false,
            readinessGatePass: true,
            canaryPass: false,
            relayRpcDrillPass: false,
            pass: false,
        },
        overallPass: false,
        reason: "Operator safety snapshot has not run yet.",
    }, [dashboardSnapshot.operatorSafety]);
    const alerting = (0, react_1.useMemo)(() => dashboardSnapshot.alerting ?? {
        webhookConfigured: false,
        unresolvedCritical: 0,
        recent: [],
        recommendedActions: [],
    }, [dashboardSnapshot.alerting]);
    const deploymentSafety = (0, react_1.useMemo)(() => dashboardSnapshot.deploymentSafety ?? {
        generatedAt: new Date().toISOString(),
        process: {
            pid: 0,
            uptimeSeconds: 0,
            startedAt: new Date().toISOString(),
            nodeVersion: "unknown",
        },
        persistence: {
            filePath: "",
            exists: false,
            healthy: false,
            sizeBytes: 0,
            lastModifiedAt: undefined,
        },
        workers: {
            recovery: {
                enabled: false,
                inFlight: false,
                pending: 0,
                retryReady: 0,
            },
            settlement: {
                enabled: false,
                inFlight: false,
                pending: 0,
                retryReady: 0,
            },
        },
        alerts: {
            webhookConfigured: false,
        },
        restart: {
            safeToRestart: false,
            blockers: [],
            reason: "Deployment restart safety snapshot has not run yet.",
        },
    }, [dashboardSnapshot.deploymentSafety]);
    const reconciliation = (0, react_1.useMemo)(() => dashboardSnapshot.reconciliation ?? {
        generatedAt: new Date().toISOString(),
        matched: 0,
        pending: 0,
        orphanSettlements: 0,
        recentIssues: [],
        reason: "Post-trade reconciliation snapshot has not run yet.",
    }, [dashboardSnapshot.reconciliation]);
    const executionRatePct = (0, react_1.useMemo)(() => {
        if (replaySummary.scanned <= 0) {
            return 0;
        }
        return Math.max(0, Math.min(100, (replaySummary.executable / replaySummary.scanned) * 100));
    }, [replaySummary.executable, replaySummary.scanned]);
    const liveDexMetrics = (0, react_1.useMemo)(() => dexAnalytics.filter((dex) => dex.performance.toLowerCase() === "active" || dex.routes > 0), [dexAnalytics]);
    const activeDexSet = (0, react_1.useMemo)(() => {
        const fromRows = liveOpportunityRows.flatMap((row) => [row.buyDex, row.sellDex]).map((name) => name.toLowerCase());
        const fromReadiness = (executionReadiness.perDex ?? [])
            .filter((item) => (item.ready ?? 0) > 0)
            .map((item) => item.dex.toLowerCase());
        const fromDexAnalytics = liveDexMetrics.map((item) => item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
        return new Set([...fromRows, ...fromReadiness, ...fromDexAnalytics]);
    }, [executionReadiness.perDex, liveDexMetrics, liveOpportunityRows]);
    const activeDexAliasSet = (0, react_1.useMemo)(() => {
        const aliases = new Set();
        for (const dex of activeDexSet) {
            aliases.add(dex);
            const base = dex.split("-")[0];
            if (base) {
                aliases.add(base);
            }
        }
        return aliases;
    }, [activeDexSet]);
    const activeChainSet = (0, react_1.useMemo)(() => {
        const nextSet = new Set(PROJECT_CHAIN_LIST.map((chainName) => chainName.toLowerCase()));
        for (const chain of rpcHealth) {
            const chainName = String(chain.chain ?? "").trim().toLowerCase();
            if (!chainName) {
                continue;
            }
            const healthyCount = Number(chain.healthy) || 0;
            const totalCount = Number(chain.total) || 0;
            const overall = String(chain.overall ?? "").trim().toLowerCase();
            if (healthyCount > 0 || totalCount > 0 || overall !== "offline") {
                nextSet.add(chainName);
            }
        }
        return nextSet;
    }, [rpcHealth]);
    const pnlSummary = (0, react_1.useMemo)(() => dashboardSnapshot.pnlSummary ?? {
        totalPnl: "$0",
        winRate: "0%",
        totalVolume: "$0",
        bestTrade: "$0",
    }, [dashboardSnapshot.pnlSummary]);
    const protectionSummary = (0, react_1.useMemo)(() => dashboardSnapshot.protection ?? {
        allowed: true,
        score: 100,
        reason: undefined,
    }, [dashboardSnapshot]);
    const bestOpportunity = (0, react_1.useMemo)(() => dashboardSnapshot.bestOpportunity, [dashboardSnapshot.bestOpportunity]);
    const topRoute = (0, react_1.useMemo)(() => dashboardSnapshot.topRoute, [dashboardSnapshot.topRoute]);
    const bestOpportunityDisplay = bestOpportunity ?? {
        pair: "No live opportunity",
        buyDex: "—",
        sellDex: "—",
        profit: "$0",
        confidence: "0",
        chain: dashboardSnapshot.chain,
    };
    const topRouteDisplay = topRoute ?? {
        pair: "No live route",
        buyDex: "—",
        sellDex: "—",
        profit: "$0",
        coverage: "0%",
        chain: dashboardSnapshot.chain,
    };
    const executionChain = (0, react_1.useMemo)(() => {
        const chain = bestOpportunity?.chain ?? topRoute?.chain ?? dashboardSnapshot.chain;
        return isFlashloanChain(chain) ? chain : "bnb";
    }, [bestOpportunity?.chain, dashboardSnapshot.chain, topRoute?.chain]);
    const capitalDisplay = (0, react_1.useMemo)(() => {
        if (walletUsdtBalance !== null && Number.isFinite(walletUsdtBalance)) {
            return `$${walletUsdtBalance.toFixed(2)} USDT`;
        }
        return walletBalance || "0 USDT";
    }, [walletBalance, walletUsdtBalance]);
    const liveOpportunityAvailable = (0, react_1.useMemo)(() => (0, botFlow_1.hasLiveArbitrageOpportunity)(dashboardSnapshot), [dashboardSnapshot]);
    const bridgeProgress = (0, react_1.useMemo)(() => {
        const totalPairs = (executionReadiness.readyPairs ?? 0) + (executionReadiness.pendingPairs ?? 0);
        if (totalPairs <= 0) {
            return 0;
        }
        return Math.round((executionReadiness.readyPairs / totalPairs) * 100);
    }, [executionReadiness.pendingPairs, executionReadiness.readyPairs]);
    const rpcHealthRatio = (0, react_1.useMemo)(() => {
        const total = Number(dashboardSnapshot.health?.total ?? 0);
        const healthy = Number(dashboardSnapshot.health?.healthy ?? 0);
        if (!Number.isFinite(total) || total <= 0) {
            return 0;
        }
        return Math.max(0, Math.min(1, healthy / total));
    }, [dashboardSnapshot.health?.healthy, dashboardSnapshot.health?.total]);
    const liveActivityCount = liveDexMetrics.length;
    const scannerSignalCount = totalOpportunityCount;
    const scannerSignalLabel = totalOpportunityCount > 0 ? "real-time opportunities" : "opportunities";
    const connectedDexSummary = `${liveActivityCount} connected DEX${liveActivityCount === 1 ? "" : "s"}`;
    const executionSafety = (0, react_1.useMemo)(() => (0, executionSafety_1.validateExecutionSafety)({
        amountUsd: tradeAmountUsd,
        minimumNotionalUsd,
        maxNotionalUsd: walletUsdtBalance !== null && walletUsdtBalance !== undefined ? Math.min(100, walletUsdtBalance) : 100,
        walletUsdtBalance,
        allowFlashloan: false,
        slippageBps,
        protectionScore: protectionSummary.score,
        liveExecutionReady: liveOpportunityAvailable,
        walletConnected: Boolean(walletAddress),
        readyRoutes: executionReadiness.readyPairs,
    }), [executionReadiness.readyPairs, liveOpportunityAvailable, minimumNotionalUsd, protectionSummary.score, slippageBps, tradeAmountUsd, walletAddress, walletUsdtBalance]);
    const hasRealScan = dashboardSnapshot.lastScan !== "1970-01-01T00:00:00.000Z";
    const sidebarLabelToPanel = {
        Dashboard: "overview",
        Opportunities: "opportunities",
        Scanner: "scanner",
        Tokens: "tokens",
        Routes: "execution",
        Executions: "history",
        Chains: "blockchain",
        "RPC Health": "blockchain",
        Blocks: "blockchain",
        Gas: "blockchain",
        "DEX Overview": "dex",
        Liquidity: "dex",
        Pools: "dex",
        Quotes: "dex",
        Wallet: "wallet",
        Transactions: "history",
        "AI Engine": "system",
        Logs: "system",
        Profile: "system",
    };
    const handleSidebarClick = (label) => {
        setActiveSidebarLabel(label);
        setActivePanel(sidebarLabelToPanel[label] ?? "overview");
        if (label === "Wallet") {
            setIsWalletPanelOpen(false);
        }
    };
    const selectedBlockchainTab = ["Chains", "RPC Health", "Blocks", "Gas"].includes(activeSidebarLabel)
        ? activeSidebarLabel
        : "Chains";
    const selectedDexTab = ["DEX Overview", "Liquidity", "Pools", "Quotes"].includes(activeSidebarLabel)
        ? activeSidebarLabel
        : "DEX Overview";
    const selectedSystemTab = ["AI Engine", "Logs", "Profile"].includes(activeSidebarLabel)
        ? activeSidebarLabel
        : "AI Engine";
    const updateProfile = (patch) => {
        setProfile((current) => ({ ...current, ...patch }));
    };
    const handleProfilePhotoChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : null;
            if (result) {
                updateProfile({ avatarDataUrl: result });
            }
        };
        reader.readAsDataURL(file);
    };
    const formatChainName = (chainId) => {
        switch (chainId) {
            case "0x1": return "Ethereum Mainnet";
            case "0x38":
            case "0x61": return "BNB Chain";
            case "0x89": return "Polygon";
            case "0xa": return "Optimism";
            case "0xa4b1": return "Arbitrum";
            case "0x2105": return "Base";
            default: return `Chain ${chainId}`;
        }
    };
    const getNativeCurrencySymbol = (chainId) => {
        if (chainId === "0x89") {
            return "MATIC";
        }
        return chainId === "0x38" || chainId === "0x61" ? "BNB" : "ETH";
    };
    const getActiveProvider = () => {
        if (typeof window === "undefined") {
            return null;
        }
        return walletConnectProviderRef.current ?? window.ethereum ?? null;
    };
    const resolveConnectedChainId = async (provider, preferredChain) => {
        const chainId = (await provider.request({ method: "eth_chainId" }));
        const supportedChain = getChainFromChainId(chainId);
        if (supportedChain) {
            return chainId;
        }
        return ensureChain(provider, preferredChain);
    };
    const waitForTransactionReceipt = async (provider, hash) => {
        for (let attempt = 0; attempt < 45; attempt += 1) {
            const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [hash] });
            if (receipt?.status) {
                return receipt;
            }
            await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }
        throw new Error(`Timed out waiting for transaction receipt ${hash.slice(0, 10)}...`);
    };
    const signRawTransactionForRelay = async (provider, walletAddress, transaction) => {
        const signedPayload = await provider.request({
            method: "eth_signTransaction",
            params: [{
                    from: walletAddress,
                    to: transaction.to,
                    data: transaction.data,
                    value: toHexQuantity(BigInt(transaction.value ?? 0)),
                }],
        });
        if (typeof signedPayload === "string" && /^0x[a-fA-F0-9]+$/.test(signedPayload)) {
            return signedPayload;
        }
        if (signedPayload && typeof signedPayload === "object") {
            const raw = Reflect.get(signedPayload, "raw");
            if (typeof raw === "string" && /^0x[a-fA-F0-9]+$/.test(raw)) {
                return raw;
            }
        }
        throw new Error("Wallet did not return a valid signed raw transaction for private relay submission.");
    };
    const ensureChain = async (provider, chain) => {
        const config = getChainConfig(chain);
        const chainId = (await provider.request({ method: "eth_chainId" }));
        if (chainId === config.chainId) {
            return chainId;
        }
        try {
            await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: config.chainId }] });
        }
        catch {
            await provider.request({
                method: "wallet_addEthereumChain",
                params: [{
                        chainId: config.chainId,
                        chainName: config.chainName,
                        nativeCurrency: { name: config.nativeSymbol, symbol: config.nativeSymbol, decimals: 18 },
                        rpcUrls: [config.rpcUrl],
                        blockExplorerUrls: [chain === "arbitrum" ? "https://arbiscan.io" : chain === "base" ? "https://basescan.org" : chain === "polygon" ? "https://polygonscan.com" : "https://bscscan.com"],
                    }],
            });
            await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: config.chainId }] });
        }
        const finalChainId = (await provider.request({ method: "eth_chainId" }));
        if (finalChainId !== config.chainId) {
            throw new Error(`Please switch wallet to ${config.chainName} (${config.chainId}) to fetch the correct balance.`);
        }
        return finalChainId;
    };
    const readNativeBalance = async (provider, address) => {
        const attempts = [
            () => provider.request({ method: "eth_getBalance", params: [address, "latest"] }),
            () => provider.request({ method: "eth_getBalance", params: [address, "pending"] }),
            () => provider.request({ method: "eth_getBalance", params: [address, "safe"] }),
        ];
        for (const attempt of attempts) {
            try {
                const balanceHex = (await attempt());
                if (balanceHex && balanceHex !== "0x0") {
                    return Number(BigInt(balanceHex)) / 1e18;
                }
            }
            catch {
                // continue
            }
        }
        return null;
    };
    const readUsdtBalance = async (provider, address, chainId) => {
        const chainKey = getChainFromChainId(chainId);
        if (!chainKey) {
            return null;
        }
        const chainEntry = getChainConfig(chainKey);
        try {
            const usdtContractAddress = chainEntry.usdtAddress;
            const data = `0x70a08231${address.slice(2).padStart(64, "0")}`;
            const balanceHex = (await provider.request({
                method: "eth_call",
                params: [{ to: usdtContractAddress, data }, "latest"],
            }));
            const rawBalance = BigInt(balanceHex || "0x0");
            return Number(rawBalance) / (10 ** chainEntry.usdtDecimals);
        }
        catch {
            return null;
        }
    };
    const readErc20BalanceRaw = async (provider, address, chainId, tokenAddress) => {
        const chainKey = getChainFromChainId(chainId);
        if (!chainKey) {
            return null;
        }
        try {
            const data = `0x70a08231${address.slice(2).padStart(64, "0")}`;
            const balanceHex = (await provider.request({
                method: "eth_call",
                params: [{ to: tokenAddress, data }, "latest"],
            }));
            return BigInt(balanceHex || "0x0");
        }
        catch {
            return null;
        }
    };
    const readAllowanceRaw = async (provider, ownerAddress, spenderAddress, tokenAddress) => {
        try {
            const data = `0xdd62ed3e${ownerAddress.slice(2).padStart(64, "0")}${spenderAddress.slice(2).padStart(64, "0")}`;
            const allowanceHex = (await provider.request({
                method: "eth_call",
                params: [{ to: tokenAddress, data }, "latest"],
            }));
            return BigInt(allowanceHex || "0x0");
        }
        catch {
            return null;
        }
    };
    const readErc20Balance = async (provider, address, chainId, tokenAddress, decimals) => {
        const chainKey = getChainFromChainId(chainId);
        if (!chainKey) {
            return null;
        }
        try {
            const data = `0x70a08231${address.slice(2).padStart(64, "0")}`;
            const balanceHex = (await provider.request({
                method: "eth_call",
                params: [{ to: tokenAddress, data }, "latest"],
            }));
            const rawBalance = BigInt(balanceHex || "0x0");
            return Number(rawBalance) / (10 ** decimals);
        }
        catch {
            return null;
        }
    };
    const resolveWalletNotionalSizing = (availableUsdtBalance) => {
        if (availableUsdtBalance === null || availableUsdtBalance === undefined || !Number.isFinite(availableUsdtBalance) || availableUsdtBalance <= 0) {
            return {
                minimumNotionalUsd: 10,
                tradeAmountUsd: 10,
                maximumNotionalUsd: 100,
            };
        }
        const minimumNotionalUsd = Math.min(10, availableUsdtBalance);
        const maximumNotionalUsd = Math.min(100, availableUsdtBalance);
        const tradeAmountUsd = Math.max(minimumNotionalUsd, maximumNotionalUsd);
        return {
            minimumNotionalUsd,
            tradeAmountUsd,
            maximumNotionalUsd,
        };
    };
    const refreshWalletBalances = async (provider, address, chainId) => {
        const balanceValue = await readNativeBalance(provider, address);
        const nativeCurrencySymbol = getNativeCurrencySymbol(chainId);
        const chainKey = getChainFromChainId(chainId);
        const chainConfig = chainKey ? getChainConfig(chainKey) : getChainConfig("arbitrum");
        const usdtBalance = await readUsdtBalance(provider, address, chainId);
        const wrappedBalance = await readErc20Balance(provider, address, chainId, chainConfig.wnativeAddress, 18);
        const resolvedNativeBalance = balanceValue === null ? 0 : balanceValue;
        const balanceParts = [`${resolvedNativeBalance.toFixed(4)} ${nativeCurrencySymbol}`];
        if (usdtBalance !== null) {
            balanceParts.push(`${usdtBalance.toFixed(2)} USDT`);
        }
        if (wrappedBalance !== null && wrappedBalance > 0.000001) {
            const wrappedSymbol = chainKey === "bnb" ? "WBNB" : chainKey === "polygon" ? "WMATIC" : "WETH";
            balanceParts.push(`${wrappedBalance.toFixed(6)} ${wrappedSymbol}`);
        }
        setWalletChain(formatChainName(chainId));
        setWalletBalance(balanceParts.join(" / "));
        setWalletUsdtBalance(usdtBalance);
        setWalletWbnbBalance(wrappedBalance);
        const sizing = resolveWalletNotionalSizing(usdtBalance);
        setMinimumNotionalUsd(sizing.minimumNotionalUsd);
        setTradeAmountUsd(sizing.maximumNotionalUsd);
    };
    const refreshConnectedWalletState = async (provider, addressOverride) => {
        const chainId = await provider.request({ method: "eth_chainId" });
        const accounts = (await provider.request({ method: "eth_accounts" }));
        const resolvedAddress = addressOverride ?? accounts[0];
        if (!resolvedAddress) {
            setWalletAddress(null);
            setWalletChain("Not connected");
            setWalletBalance("0");
            setWalletUsdtBalance(null);
            setWalletWbnbBalance(null);
            setWalletStatus("Wallet disconnected");
            setConnectedWallet("None");
            return;
        }
        setWalletAddress(resolvedAddress);
        await refreshWalletBalances(provider, resolvedAddress, chainId);
    };
    const walletOptions = [
        { id: "metamask", label: "MetaMask", description: "Most common browser wallet for EVM signing", accent: "border-amber-300/50 bg-amber-100/40 text-amber-900" },
        { id: "trust", label: "Trust Wallet", description: "Mobile-first wallet with strong browser support", accent: "border-amber-300/50 bg-amber-100/40 text-amber-900" },
        { id: "coinbase", label: "Coinbase Wallet", description: "Popular embedded wallet for web apps", accent: "border-amber-300/50 bg-amber-100/40 text-amber-900" },
        { id: "walletconnect", label: "WalletConnect", description: "QR-based connection for supported wallets", accent: "border-amber-300/50 bg-amber-100/40 text-amber-900" },
    ];
    const connectWallet = async (providerId = "metamask") => {
        if (typeof window === "undefined")
            return;
        const selectedWallet = walletOptions.find((option) => option.id === providerId) ?? walletOptions[0];
        const preferredChain = "bnb";
        if (providerId === "walletconnect") {
            const resolvedProjectId = walletConnectProjectId;
            if (!resolvedProjectId) {
                setWalletStatus("Add WalletConnect Project ID in the panel, then retry WalletConnect.");
                return;
            }
            try {
                setIsConnecting(true);
                setWalletStatus("Opening WalletConnect QR session...");
                setConnectedWallet(selectedWallet.label);
                // @ts-expect-error external browser-only module loaded at runtime
                const { EthereumProvider } = await import(/* webpackIgnore: true */ "https://esm.sh/@walletconnect/ethereum-provider@2.20.0");
                const provider = (await EthereumProvider.init({
                    projectId: resolvedProjectId,
                    optionalChains: FLASHLOAN_CHAIN_LIST.map((chain) => getChainNumericId(chain)),
                    showQrModal: true,
                    methods: ["eth_requestAccounts", "eth_chainId", "eth_getBalance", "eth_call", "eth_sendTransaction", "wallet_switchEthereumChain", "wallet_addEthereumChain"],
                    events: ["chainChanged", "accountsChanged", "connect", "disconnect"],
                    rpcMap: Object.fromEntries(FLASHLOAN_CHAIN_LIST.map((chain) => [getChainNumericId(chain), getChainConfig(chain).rpcUrl])),
                    metadata: {
                        name: "Jai Shree Ram",
                        description: "Private arbitrage desk for live execution",
                        url: window.location.origin,
                        icons: [`${window.location.origin}/favicon.ico`],
                    },
                }));
                walletConnectProviderRef.current = provider;
                await provider.connect({ chains: [getChainNumericId(preferredChain)] });
                const accounts = (await provider.request({ method: "eth_requestAccounts" }));
                if (!accounts?.length)
                    throw new Error("No account selected");
                const address = accounts[0];
                const chainId = await resolveConnectedChainId(provider, preferredChain);
                setWalletAddress(address);
                await refreshWalletBalances(provider, address, chainId);
                setWalletStatus("WalletConnect connected");
                setExecutionMessage("WalletConnect is ready for live execution.");
                setIsWalletPanelOpen(false);
                setActivePanel("overview");
            }
            catch (error) {
                walletConnectProviderRef.current = null;
                setWalletStatus(error instanceof Error ? error.message : "WalletConnect connection failed");
            }
            finally {
                setIsConnecting(false);
            }
            return;
        }
        const provider = window.ethereum;
        if (!provider?.request) {
            setConnectedWallet(selectedWallet.label);
            setWalletStatus(`${selectedWallet.label} not detected in this browser`);
            return;
        }
        try {
            setIsConnecting(true);
            setWalletStatus(`Connecting to ${selectedWallet.label}...`);
            setConnectedWallet(selectedWallet.label);
            const accounts = (await provider.request({ method: "eth_requestAccounts" }));
            if (!accounts?.length)
                throw new Error("No account selected");
            const address = accounts[0];
            const chainId = await resolveConnectedChainId(provider, preferredChain);
            setWalletAddress(address);
            await refreshWalletBalances(provider, address, chainId);
            setWalletStatus(`${selectedWallet.label} connected`);
            setExecutionMessage(`Wallet is ready for live execution via ${selectedWallet.label}.`);
            setIsWalletPanelOpen(false);
            setActivePanel("overview");
        }
        catch (error) {
            setWalletStatus(error instanceof Error ? error.message : "Connection failed");
        }
        finally {
            setIsConnecting(false);
        }
    };
    const disconnectWallet = () => {
        setWalletAddress(null);
        setWalletChain("Not connected");
        setWalletBalance("0");
        setWalletUsdtBalance(null);
        setWalletWbnbBalance(null);
        setWalletStatus("Wallet disconnected");
        setConnectedWallet("None");
        setExecutionMessage("Wallet disconnected. Connect again to continue.");
        setExecutionHash(null);
        walletConnectProviderRef.current = null;
    };
    const refreshSnapshot = async () => {
        try {
            setIsScanning(true);
            setAutoBotStatus("Scanning for live arbitrage opportunities...");
            const response = await fetch("/api/dashboard", { cache: "no-store" });
            if (!response.ok)
                throw new Error("Failed to refresh dashboard data");
            const payload = await response.json();
            const nextSnapshot = (0, dashboardData_1.normalizeDashboardSnapshot)(payload);
            setDashboardSnapshot(nextSnapshot);
            return nextSnapshot;
        }
        catch (error) {
            const failureMessage = error instanceof Error ? error.message : "Scan refresh failed";
            setAutoBotStatus(failureMessage);
            setExecutionMessage(failureMessage);
            return null;
        }
        finally {
            setIsScanning(false);
        }
    };
    const executeRoute = async (options) => {
        if (typeof window === "undefined")
            return;
        if (!walletAddress) {
            setWalletStatus("Choose a wallet to continue with live execution.");
            setIsWalletPanelOpen(true);
            return;
        }
        const provider = getActiveProvider();
        if (!provider?.request) {
            setWalletStatus("No wallet provider is connected in this browser");
            return;
        }
        const currentSnapshot = await refreshSnapshot();
        const hasOpportunity = (0, botFlow_1.hasLiveArbitrageOpportunity)(currentSnapshot ?? dashboardSnapshot);
        if (!hasOpportunity) {
            setExecutionMessage("No live opportunity available right now.");
            setAutoBotStatus("No live opportunity available right now.");
            setWalletStatus("Scanning complete — no live opportunity surfaced");
            return;
        }
        if (!executionSafety.allowed) {
            const reason = executionSafety.reason;
            setExecutionMessage(reason);
            setAutoBotStatus(reason);
            setWalletStatus("Execution blocked by safety rules");
            return;
        }
        const availableUsdtBalance = walletUsdtBalanceRef.current;
        const flashloanMode = false;
        if (!flashloanMode && availableUsdtBalance !== null && tradeAmountUsd > availableUsdtBalance) {
            const reason = `Insufficient USDT balance: ${availableUsdtBalance.toFixed(2)} available, ${tradeAmountUsd.toFixed(2)} required.`;
            setExecutionMessage(reason);
            setAutoBotStatus(reason);
            setWalletStatus("Execution blocked by wallet balance");
            return;
        }
        if (executionLockRef.current) {
            setAutoBotStatus("A transaction is already running.");
            return;
        }
        executionLockRef.current = true;
        let preparedRoute = {
            pair: topRoute?.pair ?? "Live route",
            buyDex: topRoute?.buyDex ?? "—",
            sellDex: topRoute?.sellDex ?? "—",
        };
        const submittedHashes = [];
        let executionIntentId = "";
        setIsExecuting(true);
        try {
            const prepareMessage = options?.autoTriggered && topRoute?.pair
                ? `Preparing live route for ${topRoute.pair}...`
                : `Preparing live arbitrage transactions for ${tradeAmountUsd.toFixed(2)} USDT...`;
            setExecutionMessage(prepareMessage);
            setAutoBotStatus(prepareMessage);
            const prepareResponse = await fetch("/api/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prepare: true,
                    chain: executionChain,
                    walletAddress,
                    amountUsd: tradeAmountUsd,
                    minimumNotionalUsd,
                    walletUsdtBalance: walletUsdtBalanceRef.current,
                    useFlashloan: false,
                    slippageBps,
                }),
            });
            const preparePayload = await prepareResponse.json();
            if (!prepareResponse.ok || !preparePayload.success) {
                throw new Error(preparePayload.reason ?? "Could not prepare live execution transactions.");
            }
            preparedRoute = preparePayload.route ?? {
                pair: topRoute?.pair ?? "Live route",
                buyDex: topRoute?.buyDex ?? "—",
                sellDex: topRoute?.sellDex ?? "—",
            };
            executionIntentId = typeof preparePayload.executionIntentId === "string"
                ? preparePayload.executionIntentId
                : "";
            if (!executionIntentId) {
                throw new Error("Execution intent is missing from the preparation response.");
            }
            const relayConfig = (preparePayload.privateRelay ?? {});
            const relayRequired = Boolean(relayConfig.required);
            const relayRecommended = Boolean(relayConfig.recommended);
            const relayEnabled = Boolean(relayConfig.enabled);
            const transactions = Array.isArray(preparePayload.transactions) ? preparePayload.transactions : [];
            if (transactions.length === 0) {
                throw new Error("No executable wallet transactions were prepared.");
            }
            const shouldUsePrivateRelay = relayEnabled && (relayRequired || relayRecommended);
            let relaySubmissionCompleted = false;
            if (shouldUsePrivateRelay) {
                try {
                    const signedTransactions = [];
                    for (let index = 0; index < transactions.length; index += 1) {
                        const tx = transactions[index];
                        const stageMessage = `${tx.label ?? "Signing transaction"} (${index + 1}/${transactions.length})`;
                        setExecutionMessage(stageMessage);
                        setAutoBotStatus(stageMessage);
                        const signedRawTransaction = await signRawTransactionForRelay(provider, walletAddress, tx);
                        signedTransactions.push(signedRawTransaction);
                    }
                    const relaySubmitResponse = await fetch("/api/execute", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            privateRelaySubmit: true,
                            chain: executionChain,
                            walletAddress,
                            amountUsd: tradeAmountUsd,
                            slippageBps,
                            route: preparedRoute,
                            executionIntentId,
                            signedTransactions,
                        }),
                    });
                    const relaySubmitPayload = await relaySubmitResponse.json();
                    if (!relaySubmitResponse.ok || !relaySubmitPayload.success) {
                        throw new Error(relaySubmitPayload.reason ?? "Private relay submission failed.");
                    }
                    const relayHashes = Array.isArray(relaySubmitPayload.hashes)
                        ? relaySubmitPayload.hashes.filter((hash) => typeof hash === "string" && hash.startsWith("0x"))
                        : [];
                    if (relayHashes.length === 0) {
                        throw new Error("Private relay did not return transaction hashes.");
                    }
                    submittedHashes.push(...relayHashes);
                    for (const [index, txHash] of relayHashes.entries()) {
                        const stageMessage = `Waiting private relay confirmation (${index + 1}/${relayHashes.length})`;
                        setExecutionMessage(stageMessage);
                        setAutoBotStatus(stageMessage);
                        const receipt = await waitForTransactionReceipt(provider, txHash);
                        if (receipt.status !== "0x1") {
                            throw new Error(`Transaction ${txHash.slice(0, 10)}... reverted on-chain.`);
                        }
                    }
                    relaySubmissionCompleted = true;
                }
                catch (error) {
                    if (relayRequired) {
                        throw error;
                    }
                    const fallbackMessage = "Private relay signing is unavailable in this wallet. Falling back to public mempool submission.";
                    setExecutionMessage(fallbackMessage);
                    setAutoBotStatus(fallbackMessage);
                }
            }
            if (!relaySubmissionCompleted) {
                if (relayRequired && !relayEnabled) {
                    throw new Error("Execution blocked: private relay is required but not configured.");
                }
                for (let index = 0; index < transactions.length; index += 1) {
                    const tx = transactions[index];
                    const stageMessage = `${tx.label ?? "Submitting transaction"} (${index + 1}/${transactions.length})`;
                    setExecutionMessage(stageMessage);
                    setAutoBotStatus(stageMessage);
                    const txHash = await provider.request({
                        method: "eth_sendTransaction",
                        params: [{
                                from: walletAddress,
                                to: tx.to,
                                data: tx.data,
                                value: toHexQuantity(BigInt(tx.value ?? "0")),
                            }],
                    });
                    if (!txHash) {
                        throw new Error(`Wallet did not return a transaction hash for step ${index + 1}.`);
                    }
                    submittedHashes.push(txHash);
                    const receipt = await waitForTransactionReceipt(provider, txHash);
                    if (receipt.status !== "0x1") {
                        throw new Error(`Transaction ${txHash.slice(0, 10)}... reverted on-chain.`);
                    }
                }
            }
            const finalHash = submittedHashes[submittedHashes.length - 1];
            const confirmResponse = await fetch("/api/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chain: executionChain,
                    walletAddress,
                    amountUsd: tradeAmountUsd,
                    minimumNotionalUsd,
                    walletUsdtBalance: walletUsdtBalanceRef.current,
                    useFlashloan: false,
                    slippageBps,
                    confirmed: true,
                    txHash: finalHash,
                    route: preparedRoute,
                    executionIntentId,
                }),
            });
            const confirmPayload = await confirmResponse.json();
            if (!confirmResponse.ok || !confirmPayload.success) {
                throw new Error(confirmPayload.reason ?? "On-chain execution could not be recorded.");
            }
            setExecutionHash(finalHash);
            const successMessage = options?.autoTriggered
                ? `Live route submitted and confirmed: ${finalHash.slice(0, 10)}...`
                : `Live arbitrage transaction confirmed: ${finalHash.slice(0, 10)}...`;
            setExecutionMessage(successMessage);
            setAutoBotStatus(successMessage);
            setWalletStatus("Live execution confirmed on-chain");
            const chainId = await provider.request({ method: "eth_chainId" });
            await refreshWalletBalances(provider, walletAddress, chainId);
            await refreshSnapshot();
        }
        catch (error) {
            const failureMessage = error instanceof Error ? error.message : "Execution failed";
            if (submittedHashes.length > 0) {
                await fetch("/api/execute", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        reportFailure: true,
                        chain: executionChain,
                        walletAddress,
                        amountUsd: tradeAmountUsd,
                        txHash: submittedHashes[submittedHashes.length - 1],
                        route: preparedRoute,
                        note: failureMessage,
                        executionIntentId,
                    }),
                }).catch(() => undefined);
            }
            const chainId = await provider.request({ method: "eth_chainId" });
            await refreshWalletBalances(provider, walletAddress, chainId);
            await refreshSnapshot();
            setExecutionMessage(failureMessage);
            setAutoBotStatus(failureMessage);
            setWalletStatus("Execution failed");
        }
        finally {
            setIsExecuting(false);
            executionLockRef.current = false;
        }
    };
    (0, react_1.useEffect)(() => {
        executeRouteRef.current = executeRoute;
    }, [executeRoute]);
    const recoverWbnb = async () => {
        if (typeof window === "undefined" || !walletAddress) {
            return;
        }
        const provider = getActiveProvider();
        if (!provider?.request) {
            setWalletStatus("No wallet provider is connected in this browser");
            return;
        }
        if (!walletWbnbBalance || walletWbnbBalance <= 0) {
            setExecutionMessage("No WBNB balance is available for recovery.");
            return;
        }
        let preparedRoute = {
            pair: "WBNB/USDT",
            buyDex: "Recovery",
            sellDex: "Wallet",
        };
        const submittedHashes = [];
        setIsExecuting(true);
        try {
            const chainId = await ensureChain(provider, "bnb");
            const rawWbnbBalance = await readErc20BalanceRaw(provider, walletAddress, chainId, "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c");
            if (rawWbnbBalance === null || rawWbnbBalance <= BigInt(0)) {
                throw new Error("No WBNB balance is available for recovery.");
            }
            setExecutionMessage("Preparing WBNB recovery back into USDT...");
            const prepareResponse = await fetch("/api/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prepare: true,
                    recover: true,
                    chain: "bnb",
                    walletAddress,
                    slippageBps,
                    walletWbnbAmountRaw: rawWbnbBalance.toString(),
                }),
            });
            const preparePayload = await prepareResponse.json();
            if (!prepareResponse.ok || !preparePayload.success) {
                throw new Error(preparePayload.reason ?? "Could not prepare recovery transactions.");
            }
            preparedRoute = preparePayload.route ?? preparedRoute;
            const approval = preparePayload.approval;
            const transactions = Array.isArray(preparePayload.transactions) ? preparePayload.transactions : [];
            if (transactions.length === 0) {
                throw new Error("No recovery transactions were prepared.");
            }
            if (approval?.token && approval.spender && approval.amount) {
                const allowance = await readAllowanceRaw(provider, walletAddress, approval.spender, approval.token);
                const requiredAmount = BigInt(approval.amount);
                if (allowance === null || allowance < requiredAmount) {
                    setExecutionMessage("Approving WBNB for recovery...");
                    const approvalHash = await provider.request({
                        method: "eth_sendTransaction",
                        params: [{
                                from: walletAddress,
                                to: approval.token,
                                data: buildApproveData(approval.spender),
                                value: "0x0",
                            }],
                    });
                    if (!approvalHash) {
                        throw new Error("Wallet did not return an approval hash for recovery.");
                    }
                    submittedHashes.push(approvalHash);
                    const approvalReceipt = await waitForTransactionReceipt(provider, approvalHash);
                    if (approvalReceipt.status !== "0x1") {
                        throw new Error(`Recovery approval ${approvalHash.slice(0, 10)}... reverted on-chain.`);
                    }
                }
            }
            for (let index = 0; index < transactions.length; index += 1) {
                const tx = transactions[index];
                setExecutionMessage(`${tx.label ?? "Submitting recovery"} (${index + 1}/${transactions.length})`);
                const txHash = await provider.request({
                    method: "eth_sendTransaction",
                    params: [{
                            from: walletAddress,
                            to: tx.to,
                            data: tx.data,
                            value: toHexQuantity(BigInt(tx.value ?? "0")),
                        }],
                });
                if (!txHash) {
                    throw new Error(`Wallet did not return a recovery transaction hash for step ${index + 1}.`);
                }
                submittedHashes.push(txHash);
                const receipt = await waitForTransactionReceipt(provider, txHash);
                if (receipt.status !== "0x1") {
                    throw new Error(`Recovery transaction ${txHash.slice(0, 10)}... reverted on-chain.`);
                }
            }
            const finalHash = submittedHashes[submittedHashes.length - 1];
            const confirmResponse = await fetch("/api/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recover: true,
                    confirmed: true,
                    chain: "bnb",
                    walletAddress,
                    txHash: finalHash,
                    amountUsd: Number(preparePayload.amountUsd ?? 0),
                    route: preparedRoute,
                }),
            });
            const confirmPayload = await confirmResponse.json();
            if (!confirmResponse.ok || !confirmPayload.success) {
                throw new Error(confirmPayload.reason ?? "Recovery could not be recorded.");
            }
            setExecutionHash(finalHash);
            setExecutionMessage(`Recovered WBNB back to USDT: ${finalHash.slice(0, 10)}...`);
            setWalletStatus("Recovery confirmed on-chain");
            await refreshWalletBalances(provider, walletAddress, chainId);
            await refreshSnapshot();
        }
        catch (error) {
            const failureMessage = error instanceof Error ? error.message : "Recovery failed";
            if (submittedHashes.length > 0) {
                await fetch("/api/execute", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        reportFailure: true,
                        recover: true,
                        chain: "bnb",
                        walletAddress,
                        amountUsd: 0,
                        txHash: submittedHashes[submittedHashes.length - 1],
                        route: preparedRoute,
                        note: failureMessage,
                    }),
                }).catch(() => undefined);
            }
            const chainId = await provider.request({ method: "eth_chainId" });
            await refreshWalletBalances(provider, walletAddress, chainId);
            await refreshSnapshot();
            setExecutionMessage(failureMessage);
            setWalletStatus("Recovery failed");
        }
        finally {
            setIsExecuting(false);
        }
    };
    (0, react_1.useEffect)(() => {
        executeRouteRef.current = executeRoute;
    }, [executeRoute]);
    (0, react_1.useEffect)(() => {
        setIsHydrated(true);
    }, []);
    (0, react_1.useEffect)(() => {
        walletUsdtBalanceRef.current = walletUsdtBalance;
    }, [walletUsdtBalance]);
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined" || autoWalletConnectAttemptedRef.current || walletAddress) {
            return;
        }
        autoWalletConnectAttemptedRef.current = true;
        if (!walletConnectProjectId) {
            setWalletStatus("WalletConnect Project ID missing. Add it to connect from remote browsers.");
            return;
        }
        setWalletStatus("Trying WalletConnect auto-connect...");
        void connectWallet("walletconnect");
    }, [walletAddress, walletConnectProjectId]);
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined") {
            return;
        }
        const providers = [walletConnectProviderRef.current, window.ethereum]
            .filter((provider) => Boolean(provider?.on && provider?.removeListener));
        if (!providers.length) {
            return;
        }
        const handleAccountsChanged = (accounts) => {
            const provider = getActiveProvider();
            if (!provider) {
                return;
            }
            const nextAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : undefined;
            void refreshConnectedWalletState(provider, nextAddress).catch((error) => {
                const message = error instanceof Error ? error.message : "Wallet account refresh failed";
                setWalletStatus(message);
            });
        };
        const handleChainChanged = () => {
            const provider = getActiveProvider();
            if (!provider || !walletAddress) {
                return;
            }
            void refreshConnectedWalletState(provider, walletAddress).catch((error) => {
                const message = error instanceof Error ? error.message : "Wallet chain refresh failed";
                setWalletStatus(message);
            });
        };
        for (const provider of providers) {
            provider.on?.("accountsChanged", handleAccountsChanged);
            provider.on?.("chainChanged", handleChainChanged);
        }
        return () => {
            for (const provider of providers) {
                provider.removeListener?.("accountsChanged", handleAccountsChanged);
                provider.removeListener?.("chainChanged", handleChainChanged);
            }
        };
    }, [connectedWallet, walletAddress]);
    (0, react_1.useEffect)(() => {
        if (walletConnectProjectId || typeof window === "undefined")
            return;
        try {
            const storedProjectId = window.localStorage.getItem("habibi.walletconnect.projectId")?.trim() ?? "";
            if (storedProjectId) {
                setWalletConnectProjectId(storedProjectId);
                setWalletConnectProjectIdInput(storedProjectId);
            }
        }
        catch {
            // ignore storage read failures
        }
    }, [walletConnectProjectId]);
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined") {
            return;
        }
        try {
            const storedProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY);
            if (!storedProfile) {
                profileHydratedRef.current = true;
                return;
            }
            const parsedProfile = JSON.parse(storedProfile);
            setProfile({
                avatarDataUrl: typeof parsedProfile.avatarDataUrl === "string" ? parsedProfile.avatarDataUrl : null,
                name: typeof parsedProfile.name === "string" && parsedProfile.name.trim() ? parsedProfile.name : DEFAULT_PROFILE.name,
                email: typeof parsedProfile.email === "string" ? parsedProfile.email : "",
                phoneCountryCode: typeof parsedProfile.phoneCountryCode === "string" && parsedProfile.phoneCountryCode.trim() ? parsedProfile.phoneCountryCode : DEFAULT_PROFILE.phoneCountryCode,
                phoneNumber: typeof parsedProfile.phoneNumber === "string" ? parsedProfile.phoneNumber : "",
            });
            profileHydratedRef.current = true;
        }
        catch {
            // ignore malformed stored profile data
            profileHydratedRef.current = true;
        }
    }, []);
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined") {
            return;
        }
        if (!profileHydratedRef.current) {
            return;
        }
        window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    }, [profile]);
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined") {
            return;
        }
        try {
            const storedAutoBotValue = window.localStorage.getItem(AUTO_BOT_STORAGE_KEY);
            if (storedAutoBotValue === "true") {
                setIsAutoBotEnabled(true);
                setAutoBotStatus("Auto bot enabled");
            }
        }
        catch {
            // ignore storage read failures
        }
        autoBotHydratedRef.current = true;
    }, []);
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined" || !autoBotHydratedRef.current) {
            return;
        }
        try {
            window.localStorage.setItem(AUTO_BOT_STORAGE_KEY, String(isAutoBotEnabled));
        }
        catch {
            // ignore storage write failures
        }
    }, [isAutoBotEnabled]);
    (0, react_1.useEffect)(() => {
        if (!isAutoBotEnabled || !walletAddress)
            return;
        let cancelled = false;
        const pollAndExecute = async () => {
            if (cancelled || autoBotPollInFlightRef.current || executionLockRef.current) {
                return;
            }
            autoBotPollInFlightRef.current = true;
            try {
                const snapshot = await refreshSnapshot();
                if (cancelled || !snapshot) {
                    return;
                }
                if (executionLockRef.current || isExecuting) {
                    return;
                }
                if ((0, botFlow_1.hasLiveArbitrageOpportunity)(snapshot)) {
                    await executeRouteRef.current({ autoTriggered: true });
                }
            }
            finally {
                autoBotPollInFlightRef.current = false;
            }
        };
        void pollAndExecute();
        const interval = window.setInterval(() => {
            void pollAndExecute();
        }, 100);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [isAutoBotEnabled, isExecuting, walletAddress]);
    (0, react_1.useEffect)(() => {
        let isMounted = true;
        const loadSnapshot = async () => {
            setIsRefreshing(true);
            try {
                const response = await fetch("/api/dashboard", { cache: "no-store" });
                if (!response.ok)
                    throw new Error("Failed to fetch dashboard data");
                const payload = await response.json();
                if (isMounted)
                    setDashboardSnapshot((0, dashboardData_1.normalizeDashboardSnapshot)(payload));
            }
            catch {
                if (isMounted)
                    setDashboardSnapshot((0, dashboardData_1.createDefaultDashboardSnapshot)());
            }
            finally {
                if (isMounted)
                    setIsRefreshing(false);
            }
        };
        loadSnapshot();
        const interval = window.setInterval(loadSnapshot, 1000);
        return () => {
            isMounted = false;
            window.clearInterval(interval);
        };
    }, []);
    (0, react_1.useEffect)(() => {
        let timeoutId;
        const tick = () => {
            setScannerCount(() => 1 + Math.floor(Math.random() * 12));
            const nextDelayMs = 4000 + Math.random() * 4000;
            timeoutId = window.setTimeout(tick, nextDelayMs);
        };
        timeoutId = window.setTimeout(tick, 5000);
        return () => {
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, []);
    const navItems = [
        { key: "overview", label: "Overview", description: "System snapshot" },
        { key: "wallet", label: "Wallet", description: "Connection & balance" },
        { key: "execution", label: "Execution", description: "Trade controls" },
        { key: "scanner", label: "Scanner", description: "Live opportunities" },
        { key: "history", label: "History", description: "Executed trades" },
    ];
    const sidebarSections = [
        { title: "Overview", items: navItems.filter((item) => item.key === "overview") },
        { title: "Wallet", items: navItems.filter((item) => item.key === "wallet") },
    ];
    const systemLogEntries = [
        { time: hasRealScan ? formatStableTime(dashboardSnapshot.lastScan) : "--:--:--", level: "info", source: "SCANNER", message: dashboardSnapshot.status },
        { time: "scan", level: "ok", source: "ENGINE", message: (0, botFlow_1.hasLiveArbitrageOpportunity)(dashboardSnapshot) ? "Live opportunity surfaced" : "No executable spread in the current window" },
        { time: "current", level: walletAddress ? "ok" : "warn", source: "WALLET", message: walletAddress ? `${connectedWallet} connected with ${walletBalance}` : "No wallet connected" },
        { time: "safety", level: executionSafety.allowed ? "ok" : "warn", source: "SAFETY", message: executionSafety.reason },
        { time: "route", level: executionMessage.toLowerCase().includes("fail") ? "err" : "info", source: "EXEC", message: executionMessage },
    ];
    return (<>
      <AnimatedCelestialBackground_1.AnimatedCelestialBackground scannerCount={scannerCount} isScanning={isScanning} hasOpportunity={liveOpportunityAvailable} isTradeExecuting={isExecuting} liveTokenPrices={liveTokenPrices}/>
      <div className="terminal-shell flex min-h-screen text-slate-100">
      <div className={`fixed left-0 top-0 bottom-0 z-50 w-64 transition-transform duration-300 ease-out ${isSidebarCollapsed ? "-translate-x-full" : "translate-x-0"}`}>
        <Sidebar_1.Sidebar activeLabel={activeSidebarLabel} onItemClick={handleSidebarClick} profileName={profile.name} profileAvatarDataUrl={profile.avatarDataUrl} sections={[
            {
                title: "Overview",
                items: [
                    { label: "Dashboard", icon: "📊" },
                ],
            },
            {
                title: "Arbitrage",
                items: [
                    { label: "Opportunities", icon: "🎯" },
                    { label: "Scanner", icon: "🔍" },
                    { label: "Tokens", icon: "🪙" },
                    { label: "Routes", icon: "🛣️" },
                    { label: "Executions", icon: "⚡" },
                ],
            },
            {
                title: "Blockchain",
                items: [
                    { label: "Chains", icon: "⛓️" },
                    { label: "RPC Health", icon: "❤️" },
                    { label: "Blocks", icon: "📦" },
                    { label: "Gas", icon: "⛽" },
                ],
            },
            {
                title: "DEX",
                items: [
                    { label: "DEX Overview", icon: "🏪" },
                    { label: "Liquidity", icon: "💧" },
                    { label: "Pools", icon: "🌊" },
                    { label: "Quotes", icon: "💬" },
                ],
            },
            {
                title: "Wallet",
                items: [
                    { label: "Wallet", icon: "👛" },
                    { label: "Transactions", icon: "📋" },
                ],
            },
            {
                title: "System",
                items: [
                    { label: "AI Engine", icon: "🤖" },
                    { label: "Logs", icon: "📝" },
                    { label: "Profile", icon: "👤" },
                ],
            },
        ]}/>
        <button type="button" onClick={() => setIsSidebarCollapsed((current) => !current)} aria-label={isSidebarCollapsed ? "Open sidebar" : "Collapse sidebar"} className={`absolute right-0 top-5 translate-x-full border border-slate-200/10 border-l-0 bg-gradient-to-b from-slate-950/92 via-slate-900/78 to-slate-950/92 font-semibold text-amber-200 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-300 hover:text-amber-100 ${isSidebarCollapsed ? "flex h-10 min-w-[8.25rem] items-center justify-center rounded-r-xl px-3 text-xs tracking-[0.08em]" : "flex h-10 w-10 items-center justify-center rounded-r-xl rounded-l-md"}`}>
          {isSidebarCollapsed ? ("Dashboard") : (<span className="flex flex-col items-center justify-center gap-1">
              <span className="block h-[2px] w-4 rounded-full bg-amber-200"/>
              <span className="block h-[2px] w-4 rounded-full bg-amber-200"/>
              <span className="block h-[2px] w-4 rounded-full bg-amber-200"/>
            </span>)}
        </button>
      </div>

      <div className={`w-full flex-1 transition-[margin] duration-300 ease-out ${isSidebarCollapsed ? "ml-0" : "ml-64"}`}>
      {isWalletPanelOpen ? (<div className="fixed inset-0 z-50 bg-slate-900/10 backdrop-blur-sm" onClick={() => setIsWalletPanelOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-full max-w-sm border-l border-slate-300 bg-white p-6 shadow-[0_8px_24px_rgba(80,60,30,0.12)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-700">Wallet picker</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">Choose a provider</h3>
              </div>
              <button onClick={() => setIsWalletPanelOpen(false)} className="rounded-full border border-slate-300 bg-white/5 px-2.5 py-1 text-sm text-slate-600">Close</button>
            </div>

            <div className="mt-6 space-y-3">
              {walletOptions.map((option) => (<button key={option.id} onClick={() => void connectWallet(option.id)} className={`w-full rounded-2xl border px-4 py-4 text-left transition ${option.accent}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="mt-1 text-xs text-slate-600">{option.description}</p>
                    </div>
                    <span className="rounded-full border border-slate-300 bg-white/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-600">Connect</span>
                  </div>
                </button>))}
            </div>

            <div className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-100/40 p-4 text-sm text-amber-600">
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-700">WalletConnect setup</p>
              <input value={walletConnectProjectIdInput} onChange={(event) => setWalletConnectProjectIdInput(event.target.value)} placeholder="Enter WalletConnect Project ID" className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0"/>
              <button onClick={() => {
                const normalizedProjectId = walletConnectProjectIdInput.trim();
                if (!normalizedProjectId) {
                    setWalletStatus("Project ID cannot be empty.");
                    return;
                }
                setWalletConnectProjectId(normalizedProjectId);
                try {
                    window.localStorage.setItem("habibi.walletconnect.projectId", normalizedProjectId);
                }
                catch {
                    // ignore storage write failures
                }
                setWalletStatus("WalletConnect Project ID saved. Retry WalletConnect.");
            }} className="mt-3 w-full rounded-xl border border-amber-300/50 bg-amber-100/40 px-3 py-2 text-sm font-medium text-amber-600 transition hover:bg-amber-100/20">
                Save Project ID
              </button>
            </div>
          </div>
        </div>) : null}

      <div className="mx-auto max-w-[1760px] px-4 py-5 sm:px-6 lg:px-8">
        <main className="w-full">
          <header className="terminal-topbar mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(0,230,118,0.45)]"/>
                  <span className="text-[10px] uppercase tracking-[0.38em] text-emerald-600">Sagar Swami's AI Arbitrage Engine</span>
                </div>
                <div className="flex items-center gap-3">
                  <img src="/ram-flag.png" alt="Ram flag" className="h-10 w-auto object-contain drop-shadow-[0_0_8px_rgba(200,155,60,0.2)]"/>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Jai Shree Ram</h1>
                  <img src="/ram-flag.png" alt="Ram flag" className="h-10 w-auto object-contain drop-shadow-[0_0_8px_rgba(200,155,60,0.2)]"/>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-300 bg-slate-200/10 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-600">
                  <span className="terminal-chip terminal-chip--accent">ENGINE {dashboardSnapshot.status}</span>
                  <span className="terminal-chip terminal-chip--positive">RPC {dashboardSnapshot.health?.healthy ?? 0}/{dashboardSnapshot.health?.total ?? 0}</span>
                  <span className="terminal-chip">WALLET {walletAddress ? "CONNECTED" : "DISCONNECTED"}</span>
                  <span className="terminal-chip terminal-chip--positive" style={{
            boxShadow: `0 0 0 1px rgba(94, 234, 212, 0.16), 0 0 ${10 + rpcHealthRatio * 18}px rgba(94, 234, 212, ${0.08 + rpcHealthRatio * 0.22})`,
        }}>
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" style={{ animation: "rpc-pulse 1.8s ease-in-out infinite", opacity: 0.6 + rpcHealthRatio * 0.4 }}/>
                    CHAIN {dashboardSnapshot.chain}
                  </span>
                  <span className="terminal-chip terminal-chip--accent">GAS {gasFeeHistory[0]?.display ?? "$0"}</span>
                  <span className="terminal-chip">SCAN {isHydrated && hasRealScan ? formatStableTime(dashboardSnapshot.lastScan) : "syncing..."}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button onClick={walletAddress ? disconnectWallet : () => setIsWalletPanelOpen(true)} disabled={isConnecting} className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${walletAddress ? "border-rose-300/30 bg-rose-100/15 text-rose-700 hover:bg-rose-100/25" : "border-amber-300/50 bg-amber-100/40 text-amber-600 hover:bg-amber-100/20"} disabled:cursor-not-allowed disabled:opacity-70`}>
                  {isConnecting ? "Connecting..." : walletAddress ? "Disconnect wallet" : "Connect wallet"}
                </button>
                <button onClick={() => void executeRoute()} disabled={isExecuting || (Boolean(walletAddress) && !executionSafety.allowed)} className="rounded-xl border border-emerald-400/30 bg-emerald-100/30 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100/40 disabled:cursor-not-allowed disabled:opacity-70">
                  {isExecuting ? "Submitting..." : !walletAddress ? "Connect wallet to execute" : executionSafety.allowed ? "Execute route" : "Blocked by safety"}
                </button>
              </div>
            </header>

            <section className="terminal-command-bar mb-3">
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-xl border border-slate-300 bg-white/10 p-2.5">
                  <p className="text-[9px] uppercase tracking-[0.28em] text-slate-500">Scanner</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">{executionReadiness.readyPairs} ready · {executionReadiness.pendingPairs} pending</p>
                </div>
                <div className="rounded-xl border border-slate-300 bg-white/10 p-2.5">
                  <p className="text-[9px] uppercase tracking-[0.28em] text-slate-500">Capital</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">{walletBalance}</p>
                </div>
                <div className="rounded-xl border border-slate-300 bg-white/10 p-2.5">
                  <p className="text-[9px] uppercase tracking-[0.28em] text-slate-500">Profit</p>
                  <p className="mt-1.5 text-sm font-semibold text-emerald-700">{pnlSummary.totalPnl}</p>
                </div>
              </div>
            </section>


            {activePanel === "overview" ? (<>
                <div className="mb-3 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <section className="rounded-2xl border border-slate-300 bg-transparent p-4 shadow-[0_8px_24px_rgba(80,60,30,0.12)] backdrop-blur-0" style={{ backgroundColor: "rgba(11, 15, 22, 0.5)" }}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Trade sizing</p>
                      </div>
                    </div>


                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Wallet bridge</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{walletAddress ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}` : "MetaMask not connected"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-600">
                        <span className="rounded-full border border-slate-200/10 bg-slate-950/80 px-2.5 py-1 text-amber-100 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">{walletChain}</span>
                        <span className="rounded-full border border-emerald-300/25 bg-slate-950/85 px-2.5 py-1 font-semibold text-emerald-100 shadow-[0_0_14px_rgba(53,199,138,0.14)]">{walletBalance}</span>
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-amber-200">{walletStatus}</span>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl border border-transparent bg-transparent p-4 text-sm text-slate-600 shadow-none backdrop-blur-0" style={{
                backgroundColor: "rgba(11, 15, 22, 0.62)",
                borderColor: "rgba(174, 184, 206, 0.16)",
                boxShadow: "none",
            }}>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-2 md:col-span-2">
                          <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Trade size (USD)</span>
                          <input type="number" min="100" max="1000000" step="100" value={tradeAmountUsd} onChange={(event) => {
                const rawValue = event.target.value;
                const nextValue = Number(rawValue);
                if (rawValue.trim() === "") {
                    setTradeAmountError("Minimum trade size is $100.");
                    setTradeAmountUsd(100);
                    setMinimumNotionalUsd(100);
                    return;
                }
                if (!Number.isFinite(nextValue)) {
                    setTradeAmountError("Enter a valid USD amount.");
                    return;
                }
                if (nextValue < 100) {
                    setTradeAmountError("Minimum trade size is $100.");
                    return;
                }
                setTradeAmountError(null);
                const boundedValue = Math.min(1000000, nextValue);
                setTradeAmountUsd(boundedValue);
                setMinimumNotionalUsd(boundedValue);
            }} className={`w-full rounded-xl border bg-white px-3 py-2 text-slate-900 outline-none ring-0 ${tradeAmountError ? "border-rose-300/40" : "border-slate-300"}`}/>
                          {tradeAmountError ? (<p className="text-[11px] text-rose-300">{tradeAmountError}</p>) : (<p className="text-[11px] text-slate-500">Custom trade limit from $100 to $1,000,000 USD.</p>)}
                        </label>
                        <label className="space-y-2 md:col-span-2">
                          <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Slippage tolerance</span>
                          <div className="flex flex-wrap gap-2">
                            {slippagePresetOptions.map((option) => {
                const isSelected = !isCustomSlippage && slippageBps === option.valueBps;
                return (<button key={option.label} type="button" onClick={() => applySlippagePreset(option.valueBps)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${isSelected ? "border-emerald-400/40 bg-emerald-100/30 text-emerald-700" : "border-slate-300 bg-slate-900/70 text-slate-600 hover:border-emerald-400/20 hover:text-emerald-700"}`}>
                                  {option.label}
                                </button>);
            })}
                            <button type="button" onClick={() => {
                setIsCustomSlippage(true);
                setCustomSlippagePercent((slippageBps / 100).toFixed(2));
            }} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${isCustomSlippage ? "border-emerald-400/40 bg-emerald-100/30 text-emerald-700" : "border-slate-300 bg-slate-900/70 text-slate-600 hover:border-emerald-400/20 hover:text-emerald-700"}`}>
                              Custom
                            </button>
                          </div>

                          {isCustomSlippage ? (<div className="mt-2 flex items-center gap-2">
                              <input type="number" min="0.01" max="5" step="0.01" value={customSlippagePercent} onChange={(event) => applyCustomSlippage(event.target.value)} className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-0"/>
                              <span className="text-xs text-slate-500">%</span>
                            </div>) : null}

                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Selected</span>
                            <span className="font-semibold text-emerald-700">{(slippageBps / 100).toFixed(2)}%</span>
                          </div>
                        </label>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button onClick={async () => {
                const nextValue = !isAutoBotEnabled;
                setIsAutoBotEnabled(nextValue);
                if (!nextValue) {
                    setAutoBotStatus("Auto bot stopped");
                    return;
                }
                setAutoBotStatus("Starting scan cycle...");
                const refreshed = await refreshSnapshot();
                if ((0, botFlow_1.hasLiveArbitrageOpportunity)(refreshed ?? dashboardSnapshot)) {
                    setAutoBotStatus("Scan complete — live opportunity found");
                    await executeRoute({ autoTriggered: true });
                }
                else {
                    setAutoBotStatus("Scan complete — no live opportunity surfaced");
                }
            }} className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${isAutoBotEnabled ? "border-amber-400/30 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25" : "border-amber-300/50 bg-amber-100/40 text-amber-600 hover:bg-cyan-400/25"}`}>
                          {isAutoBotEnabled ? "Stop auto bot" : "Start auto bot"}
                        </button>
                      </div>
                      <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-700">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-700">Safety status</p>
                        <p className="mt-1 font-medium">{executionSafety.reason}</p>
                      </div>
                      <p className="mt-3">{executionMessage}</p>
                      {executionHash ? <p className="mt-2 text-xs text-slate-500">Transaction hash: {executionHash}</p> : null}
                    </div>

                    <button onClick={() => setActivePanel("history")} className="mt-4 w-full rounded-2xl border border-slate-300 bg-white/15 px-3 py-3 text-left transition hover:bg-white/10">
                      <div className="text-sm font-semibold text-slate-900">History</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">Executed trades</div>
                    </button>
                  </section>

                  <SectionCard title="Opportunity finding" subtitle="Live scanner">
                    <div className="flex flex-1 flex-col justify-center">
                      <div className="grid flex-1 items-stretch gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                        <div className="relative mx-auto flex aspect-square w-full max-w-[380px] flex-none items-center justify-center" style={{
                width: "clamp(280px, 32vw, 380px)",
                height: "clamp(280px, 32vw, 380px)",
                ["--scan-accent"]: scannerTone.accent,
                ["--scan-accent-strong"]: scannerTone.strong,
                ["--scan-glow"]: scannerTone.glow,
                background: totalOpportunityCount >= 10
                    ? "radial-gradient(circle, rgba(230, 163, 74, 0.16) 0%, rgba(11, 14, 20, 0.38) 54%, rgba(11, 14, 20, 0.82) 100%)"
                    : "radial-gradient(circle, rgba(190, 122, 50, 0.08) 0%, rgba(11, 14, 20, 0.32) 56%, rgba(11, 14, 20, 0.8) 100%)",
                borderRadius: "9999px",
                boxShadow: `0 0 ${14 + rpcHealthRatio * 8}px ${scannerTone.glow}, 0 0 ${30 + rpcHealthRatio * 22}px ${scannerTone.glow}, inset 0 0 12px rgba(255,255,255,0.04)`,
                transform: `scale(${0.98 + rpcHealthRatio * 0.03})`,
                transition: "transform 220ms ease, box-shadow 220ms ease",
                overflow: "hidden",
            }}>
                          <div className="scan-orbit absolute inset-0 rounded-full border border-amber-300/20 bg-[radial-gradient(circle,_rgba(226,188,104,0.12),_rgba(200,155,60,0.03)_42%,_transparent_70%)]"/>
                          <div className="scan-ring absolute inset-4 rounded-full border border-amber-300/30"/>
                          <div className="scan-ring absolute inset-10 rounded-full border border-amber-200/20"/>
                          <div className="scan-sweep absolute inset-0 rounded-full border-t border-amber-300/55 border-r border-amber-200/20"/>
                          <div className="scan-sweep absolute inset-8 rounded-full border-l border-amber-200/35 [animation-direction:reverse] [animation-duration:18s]"/>
                          <span className="scan-dot absolute left-[18%] top-[22%]"/>
                          <span className="scan-dot absolute right-[20%] top-[26%]"/>
                          <span className="scan-dot absolute bottom-[18%] left-[28%]"/>
                          <span className="scan-dot absolute bottom-[24%] right-[28%]"/>
                          <div className="absolute inset-[38%] rounded-full blur-md" style={{ backgroundColor: scannerTone.accent + "22" }}/>
                          <div className="relative z-10 flex flex-col items-center justify-center text-center">
                            <p className="text-[8px] uppercase tracking-[0.32em] text-amber-700">Continuous scan</p>
                            <div className="mt-2 text-[1.75rem] font-semibold leading-none text-slate-900">{scannerSignalCount}</div>
                            <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-slate-500">{scannerSignalLabel}</p>
                            <p className="mt-1 text-[8px] uppercase tracking-[0.18em] text-slate-400">{connectedDexSummary}</p>
                            <p className="mt-2 rounded-full border border-amber-300/30 bg-amber-100/40 px-2 py-0.5 text-[8px] uppercase tracking-[0.22em] text-amber-700">
                              {executionReadiness.coverage}
                            </p>
                          </div>
                        </div>

                        <div className={`relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-2xl border p-4 transition duration-300 hover:-translate-y-[1px] hover:shadow-[0_0_28px_rgba(16,185,129,0.12)] ${bestOpportunity ? "border-emerald-300/35 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.12)]" : "border-slate-300 bg-white/18"}`}>
                          {bestOpportunity ? (<div className="pointer-events-none absolute inset-x-4 top-12 h-px overflow-hidden opacity-80">
                              <div className="route-packet absolute left-0 top-0 h-px w-10 rounded-full bg-gradient-to-r from-transparent via-emerald-200 to-transparent" style={{ animation: "route-packet 2.8s linear infinite" }}/>
                              <div className="route-packet absolute left-[38%] top-0 h-px w-10 rounded-full bg-gradient-to-r from-transparent via-cyan-200 to-transparent" style={{ animation: "route-packet 3.2s linear infinite 1s" }}/>
                              <div className="route-packet absolute left-[72%] top-0 h-px w-10 rounded-full bg-gradient-to-r from-transparent via-amber-200 to-transparent" style={{ animation: "route-packet 3.6s linear infinite 2s" }}/>
                            </div>) : null}
                          <p className="text-[8px] uppercase tracking-[0.22em] text-slate-500">Highest profit route</p>
                          {bestOpportunity ? (<>
                              <div className="flex flex-1 flex-col justify-center">
                                <p className="text-[13px] font-semibold text-slate-900">{formatTokenPair(bestOpportunityDisplay.pair, bestOpportunityDisplay.pair)} · {bestOpportunityDisplay.buyDex} → {bestOpportunityDisplay.sellDex}</p>
                                <div className="mt-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-slate-500">
                                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-emerald-700">{bestOpportunityDisplay.buyDex.slice(0, 2).toUpperCase()}</span>
                                  <span className="relative h-px w-12 overflow-hidden rounded-full bg-slate-300/40">
                                    <span className="route-packet absolute left-0 top-[-4px] h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,255,196,0.85)]" style={{ animation: "route-packet 2.4s linear infinite" }}/>
                                  </span>
                                  <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-violet-200">{bestOpportunityDisplay.sellDex.slice(0, 2).toUpperCase()}</span>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] text-slate-600">
                                <span className="rounded-full border border-amber-300/30 bg-amber-100/40 px-2 py-0.5 text-amber-700">{formatConfidence(bestOpportunityDisplay.confidence)}% confidence</span>
                                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-emerald-700">{bestOpportunityDisplay.profit}</span>
                                {topRouteDisplay.coverage ? <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-violet-200">{topRouteDisplay.coverage}</span> : null}
                              </div>
                            </>) : (<div className="flex flex-1 flex-col items-start justify-center gap-2 text-slate-500">
                              <p className="text-sm font-medium text-slate-400">No profitable spread yet.</p>
                              <p className="text-[11px] leading-5">
                                Live quotes are still flowing across {liveActivityCount} connected DEX{liveActivityCount === 1 ? "" : "s"}.
                                The card will flip to a route once profit clears gas and slippage.
                              </p>
                            </div>)}
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                </div>

                <div className="mt-4 w-full rounded-[20px] border border-slate-300 bg-white/18 p-3 shadow-[0_8px_24px_rgba(80,60,30,0.12)]">
                  <div className="mb-2 flex items-center justify-between px-2 pt-1">
                    <p className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Total opportunities</p>
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-amber-300/30 bg-amber-100/40 px-2 text-[10px] uppercase tracking-[0.2em] text-amber-700">{totalOpportunityCount}</span>
                  </div>
                  <div className="terminal-table w-full overflow-hidden">
                    <div className="h-[244px] overflow-y-auto">
                      <div className="terminal-table-head sticky top-0 z-10 grid min-w-[760px] grid-cols-[1.5fr_1.05fr_1.05fr_0.7fr_1.05fr_0.9fr_0.9fr_0.8fr] gap-3 px-4 py-3 text-[10px] uppercase tracking-[0.32em] text-slate-500">
                        <span>Pair</span><span>Buy DEX</span><span>Sell DEX</span><span>Δ</span><span>Profit</span><span>Gas</span><span>Net</span><span>Conf</span>
                      </div>
                      <div className="divide-y divide-white/5">
                        {opportunityTableRows.map((row, index) => (<div key={`${row.pair}-${row.buyDex}-${row.sellDex}-${row.chain ?? "unknown"}-${row.category ?? "unknown"}-${row.confidence}-${index}`} className="terminal-table-row grid min-w-[760px] grid-cols-[1.5fr_1.05fr_1.05fr_0.7fr_1.05fr_0.9fr_0.9fr_0.8fr] gap-3 px-4 py-3 text-sm text-slate-600 transition duration-200 hover:-translate-y-px hover:bg-emerald-500/10 hover:shadow-[0_0_0_1px_rgba(110,255,196,0.12)]">
                            <div className="space-y-1">
                              <span className="block font-medium text-slate-900">{formatTokenPair(row.pair, row.pair)}</span>
                              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-slate-500">
                                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-emerald-700">{row.buyDex.slice(0, 2).toUpperCase()}</span>
                                <span className="relative h-px w-8 overflow-hidden rounded-full bg-slate-300/40">
                                  <span className="route-packet absolute left-0 top-[-4px] h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(110,220,255,0.8)]" style={{ animation: "route-packet 2.2s linear infinite" }}/>
                                </span>
                                <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-violet-200">{row.sellDex.slice(0, 2).toUpperCase()}</span>
                              </div>
                              <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                                {row.chain ? <span className="rounded-full border border-emerald-400/20 px-2 py-0.5 text-emerald-700">{row.chain}</span> : null}
                                {row.category ? <span className="rounded-full border border-violet-400/20 px-2 py-0.5 text-violet-200">{row.category}</span> : null}
                              </div>
                              {(row.liquidity || row.slippage || row.gasImpact) ? (<div className="flex flex-wrap gap-1 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                                  {row.liquidity ? <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-emerald-700">{row.liquidity}</span> : null}
                                  {row.slippage ? <span className="rounded-full border border-amber-300/30 bg-amber-100/40 px-1.5 py-0.5 text-amber-700">slip {row.slippage}</span> : null}
                                  {row.gasImpact ? <span className="rounded-full border border-sky-300/30 bg-sky-100/40 px-1.5 py-0.5 text-sky-700">gas {row.gasImpact}</span> : null}
                                </div>) : null}
                            </div>
                            <span>{row.buyDex}</span>
                            <span>{row.sellDex}</span>
                            <span className="text-emerald-600">{row.diff}</span>
                            <span>{row.profit}</span>
                            <span>{row.gas}</span>
                            <span className="text-emerald-600">{row.net}</span>
                            <span className="font-semibold text-amber-700">{formatConfidence(row.confidence)}%</span>
                          </div>))}
                        {opportunityTableRows.length === 0 ? (<div className="flex h-[183px] min-w-[760px] items-center justify-center px-4 text-sm text-slate-500">
                            No profitable live opportunities yet. Live quotes are still being checked.
                          </div>) : null}
                      </div>
                    </div>
                  </div>
                </div>

              </>) : null}

            {activePanel === "tokens" ? (selectedToken ? (<section className="mb-3 rounded-2xl border border-slate-300 bg-transparent p-4 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-sm">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.32em] text-amber-600">Token drilldown</p>
                      <h3 className="mt-1 text-xl font-semibold text-slate-900">{selectedToken.symbol} across {TOKEN_DEX_UNIVERSE.length} DEX venues</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setSelectedTokenSymbol(null)} className="rounded-xl border border-slate-300 bg-slate-900/5 px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-200/60">
                        Back to tokens
                      </button>
                    </div>
                  </div>

                  <div className="mb-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-300 bg-slate-950/70 p-3 text-slate-100">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Token</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-100">{selectedToken.symbol}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-300 bg-slate-950/70 p-3 text-slate-100">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Price</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-100">{selectedToken.price}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-300 bg-slate-950/70 p-3 text-slate-100">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Best DEX</p>
                      <p className="mt-2 text-lg font-semibold text-emerald-200">{selectedTokenDexRows[0]?.dex ?? "—"}</p>
                    </div>
                  </div>

                  <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr]">
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-200">Highest price</p>
                      <p className="mt-2 text-base font-semibold text-slate-50">{highestPriceDexRow ? `${highestPriceDexRow.dex} · ${highestPriceDexRow.pairName}` : "—"}</p>
                      <p className="mt-1 text-sm text-emerald-200">{highestPriceDexRow ? formatTokenPrice(highestPriceDexRow.price) : "$0"}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-amber-200">Lowest price</p>
                      <p className="mt-2 text-base font-semibold text-slate-50">{lowestPriceDexRow ? `${lowestPriceDexRow.dex} · ${lowestPriceDexRow.pairName}` : "—"}</p>
                      <p className="mt-1 text-sm text-amber-200">{lowestPriceDexRow ? formatTokenPrice(lowestPriceDexRow.price) : "$0"}</p>
                    </div>
                    <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-violet-200">Best arbitrage route</p>
                      <p className="mt-2 text-base font-semibold text-slate-50">
                        {bestArbitrageGap ? `Buy ${bestArbitrageGap.buyDex} → Sell ${bestArbitrageGap.sellDex}` : "—"}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-emerald-200">{bestArbitrageGap ? formatTokenPrice(bestArbitrageGap.buyPrice) : "$0"}</span>
                        <span className="text-violet-200">↗</span>
                        <span className="text-amber-200">{bestArbitrageGap ? formatTokenPrice(bestArbitrageGap.sellPrice) : "$0"}</span>
                      </div>
                      <p className="mt-1 text-sm text-violet-200">
                        {bestArbitrageGap ? `${bestArbitrageGap.percentGap.toFixed(3)}% spread` : "0% spread"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-300/40 bg-slate-900/60 p-3">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Price spread</p>
                      <p className="mt-2 text-base font-semibold text-slate-50">
                        {highestPriceDexRow && lowestPriceDexRow ? formatTokenPrice(highestPriceDexRow.price - lowestPriceDexRow.price) : "$0"}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {bestArbitrageGap ? `${formatTokenPrice(bestArbitrageGap.absoluteGapUsd)} USD gap` : `${selectedToken.symbol}/USDT difference`}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedDexExactMode(false)} className={`rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] transition ${!selectedDexExactMode ? "border-amber-300/40 bg-amber-100/30 text-amber-700" : "border-slate-300 bg-slate-900/40 text-slate-300"}`}>
                      All
                    </button>
                    <button type="button" onClick={() => setSelectedDexExactMode(true)} className={`rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] transition ${selectedDexExactMode ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-slate-300 bg-slate-900/40 text-slate-300"}`}>
                      Exact match
                    </button>
                    <button type="button" onClick={() => setSelectedDexPriceFilter("all")} className={`rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] transition ${selectedDexPriceFilter === "all" ? "border-amber-300/40 bg-amber-100/30 text-amber-700" : "border-slate-300 bg-slate-900/40 text-slate-300"}`}>
                      Price: all
                    </button>
                    <button type="button" onClick={() => setSelectedDexPriceFilter("highest")} className={`rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] transition ${selectedDexPriceFilter === "highest" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-slate-300 bg-slate-900/40 text-slate-300"}`}>
                      Highest price
                    </button>
                    <button type="button" onClick={() => setSelectedDexPriceFilter("lowest")} className={`rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] transition ${selectedDexPriceFilter === "lowest" ? "border-amber-400/40 bg-amber-500/10 text-amber-200" : "border-slate-300 bg-slate-900/40 text-slate-300"}`}>
                      Lowest price
                    </button>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedDexChainFilter("all")} className={`rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] transition ${selectedDexChainFilter === "all" ? "border-amber-300/40 bg-amber-100/30 text-amber-700" : "border-slate-300 bg-slate-900/40 text-slate-300"}`}>
                      All
                    </button>
                    {availableSelectedDexChains.map((chainKey) => (<button key={chainKey} type="button" onClick={() => setSelectedDexChainFilter(chainKey)} className={`rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] capitalize transition ${selectedDexChainFilter === chainKey ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-slate-300 bg-slate-900/40 text-slate-300"}`}>
                        {chainKey === "multi-chain" ? "Multi-chain" : chainKey.replace(/-/g, " ")}
                      </button>))}
                  </div>

                  {filteredSelectedTokenDexRows.length === 0 ? (<div className="rounded-2xl border border-amber-300/30 bg-amber-500/5 p-4 text-sm text-amber-100">
                      No exact DEX pair match found for {selectedToken.symbol} with the current filters.
                    </div>) : (<div className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-950/75">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm text-slate-200">
                          <thead className="border-b border-slate-700/80 bg-slate-900/80 text-[10px] uppercase tracking-[0.24em] text-slate-400">
                            <tr>
                              <th className="px-4 py-3">DEX</th>
                              <th className="px-4 py-3">Chain</th>
                              <th className="px-4 py-3">Price</th>
                              <th className="px-4 py-3">Spread</th>
                              <th className="px-4 py-3">Volume</th>
                              <th className="px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSelectedTokenDexRows.map((dexRow) => (<tr key={`${selectedToken.symbol}-${dexRow.dex}-${dexRow.chain}-${dexRow.price}`} className="border-b border-slate-800/80 last:border-b-0 hover:bg-slate-900/70">
                                <td className="px-4 py-3 font-medium text-slate-100">{dexRow.dex}</td>
                                <td className="px-4 py-3 text-slate-300 capitalize">{dexRow.chain === "multi-chain" ? "Multi-chain" : dexRow.chain.replace(/-/g, " ")}</td>
                                <td className="px-4 py-3 text-emerald-200">{formatTokenPrice(dexRow.price)}</td>
                                <td className="px-4 py-3 text-amber-200">{dexRow.spread}</td>
                                <td className="px-4 py-3 text-slate-300">{dexRow.volume}</td>
                                <td className="px-4 py-3">
                                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-200">
                                    {dexRow.status}
                                  </span>
                                </td>
                              </tr>))}
                          </tbody>
                        </table>
                      </div>
                    </div>)}
                </section>) : (<section className="mb-3 rounded-2xl border border-slate-300 bg-transparent p-4 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.32em] text-amber-600">Tracked tokens</p>
                      <h3 className="mt-1 text-xl font-semibold text-slate-900">All arbitrage tokens</h3>
                    </div>
                    <span className="rounded-full border border-amber-300/40 bg-amber-100/30 px-2.5 py-1 text-[10px] font-medium text-amber-700">{trackedTokens.length} active</span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {liveTrackedTokens.map((token) => (<button key={token.symbol} type="button" onClick={() => setSelectedTokenSymbol(token.symbol)} className="rounded-2xl border border-slate-300 bg-slate-950/70 p-3 text-left text-slate-100 shadow-[0_8px_20px_rgba(15,23,42,0.2)] transition hover:border-amber-300/40 hover:bg-slate-900/80">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/40 bg-gradient-to-br from-amber-100/20 to-emerald-400/20 text-xs font-bold text-amber-100">
                              {token.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-base font-semibold text-slate-100">{token.symbol}</p>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{token.risk} risk</p>
                            </div>
                          </div>
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-200">
                            {token.risk}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
                          <div className="rounded-xl border border-slate-200/10 bg-white/5 p-2">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Price</p>
                            <p className="mt-1 font-semibold text-slate-100">{token.price}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200/10 bg-white/5 p-2">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Volume</p>
                            <p className="mt-1 font-semibold text-slate-100">{token.volume}</p>
                          </div>
                          <div className="col-span-2 rounded-xl border border-slate-200/10 bg-white/5 p-2">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Best DEX</p>
                            <p className="mt-1 font-semibold text-amber-100">{bestDexBySymbol[token.symbol] ?? "—"}</p>
                          </div>
                          <div className="col-span-2 rounded-xl border border-slate-200/10 bg-white/5 p-2">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Liquidity</p>
                            <p className="mt-1 font-semibold text-slate-100">{token.liquidity}</p>
                          </div>
                        </div>
                      </button>))}
                  </div>
                </section>)) : null}

            {activePanel === "wallet" ? (<>
                <section className="mb-4 rounded-2xl border border-slate-300 bg-white/20 p-4 shadow-[0_8px_24px_rgba(80,60,30,0.12)] backdrop-blur-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Wallet bridge</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{walletAddress ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}` : "MetaMask not connected"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-600">
                      <span className="rounded-full border border-amber-300/30 bg-amber-100/40 px-2.5 py-1 text-amber-700">{walletChain}</span>
                      <span className="rounded-full border border-slate-200/10 bg-slate-950/70 px-2.5 py-1 font-semibold text-emerald-200">{walletBalance}</span>
                      <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-amber-200">{walletStatus}</span>
                      <button type="button" onClick={() => {
                setActivePanel("overview");
                setIsWalletPanelOpen(false);
            }} className="rounded-xl border border-amber-300/50 bg-amber-100/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.24em] text-amber-600 transition hover:bg-amber-100/20">
                        Back to main page
                      </button>
                    </div>
                  </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <SectionCard title="Wallet Overview" subtitle="Balance posture">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-700">Connected balance</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{walletAddress ? walletBalance : "$0"}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-300/30 bg-amber-100/40 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-700">Available for routes</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{walletAddress ? walletBalance : "$0"}</p>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Wallet Drilldown" subtitle="Balance and connection state">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-violet-200">Connection state</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{walletAddress ? "Connected" : "Not connected"}</p>
                        <p className="mt-2 text-sm text-slate-600">{walletAddress ? `${walletBalance} available on the connected wallet.` : "No live capital allocation is shown until a wallet is connected."}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200">Pending</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">$0</p>
                        <p className="mt-2 text-sm text-slate-600">Execution remains offline until the wallet is available.</p>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </>) : null}

            {activePanel === "execution" ? (<>
                <section className="mb-4">
                  <div className="rounded-2xl border border-slate-300 bg-white/20 p-4 shadow-[0_8px_24px_rgba(80,60,30,0.12)] backdrop-blur-xl">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Trade sizing</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Trade size (USD)</span>
                        <input type="number" min="10" step="10" value={tradeAmountUsd} onChange={(event) => setTradeAmountUsd(Number(event.target.value))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-0"/>
                      </label>
                      <label className="space-y-2">
                        <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Minimum notional (USD)</span>
                        <input type="number" min="10" step="10" value={minimumNotionalUsd} onChange={(event) => setMinimumNotionalUsd(Number(event.target.value))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-0"/>
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Slippage tolerance (bps)</span>
                        <input type="range" min="1" max="50" step="1" value={slippageBps} onChange={(event) => setSlippageBps(Number(event.target.value))} className="w-full accent-emerald-400"/>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>1 bps</span>
                          <span className="font-semibold text-emerald-700">{slippageBps} bps</span>
                          <span>50 bps</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
                  <SectionCard title="Execution Controls" subtitle="Operator actions">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-700">Selected route</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{topRouteDisplay.pair} · {topRouteDisplay.buyDex} → {topRouteDisplay.sellDex}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-300/30 bg-amber-100/40 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-700">Execution posture</p>
                        <p className="mt-2 text-sm text-slate-600">Execution is available once MetaMask is connected.</p>
                      </div>
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200">Recovery buffer</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{walletWbnbBalance && walletWbnbBalance > 0 ? `${walletWbnbBalance.toFixed(6)} WBNB` : "No stuck WBNB"}</p>
                        <button onClick={() => void recoverWbnb()} disabled={isExecuting || !walletAddress || !walletWbnbBalance || walletWbnbBalance <= 0} className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-60">
                          {isExecuting ? "Submitting..." : "Recover WBNB to USDT"}
                        </button>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Execution Audit" subtitle="Recent activity">
                    <div className="space-y-3">
                      {transactions.length ? transactions.map((tx) => (<div key={tx.hash} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">{tx.status}</p>
                            <p className="mt-1 font-mono text-sm text-slate-900">{tx.hash}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">Gas used</p>
                            <p className="mt-1 text-sm text-amber-700">{tx.gasUsed}</p>
                          </div>
                        </div>)) : <p className="text-sm text-slate-600">No transactions yet.</p>}
                    </div>
                  </SectionCard>
                </div>
              </>) : null}

            {activePanel === "opportunities" ? (<div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <SectionCard title="Opportunities" subtitle="Highest net-profit routes first">
                  <div className="terminal-table">
                    <div className="terminal-table-head grid grid-cols-[1fr_0.95fr_0.65fr_0.6fr_0.6fr] gap-3 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-slate-500">
                      <span>Pair</span><span>Route</span><span>Profit</span><span>Gas</span><span>Net</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {opportunityTableRows.length === 0 ? (<div className="px-4 py-6 text-sm text-slate-600">No profitable live opportunities detected yet.</div>) : opportunityTableRows.map((row) => (<div key={`${row.pair}-${row.buyDex}-${row.sellDex}`} className="terminal-table-row grid grid-cols-[1fr_0.95fr_0.65fr_0.6fr_0.6fr] gap-3 px-4 py-3 text-sm text-slate-600">
                          <div>
                            <p className="font-semibold text-slate-900">{row.pair}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">{formatConfidence(row.confidence)}% confidence</p>
                          </div>
                          <span>{row.buyDex} → {row.sellDex}</span>
                          <span className="text-emerald-600">{row.profit}</span>
                          <span>{row.gas}</span>
                          <span className="font-semibold text-emerald-700">{row.net}</span>
                        </div>))}
                    </div>
                  </div>
                </SectionCard>
                <SectionCard title="Best Route Snapshot" subtitle="Current execution priority">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-700">Top route</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">{topRouteDisplay.pair}</p>
                      <p className="mt-1 text-sm text-slate-600">{topRouteDisplay.buyDex} → {topRouteDisplay.sellDex}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Net profit</p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-700">{topRouteDisplay.profit}</p>
                    </div>
                    <p className="text-sm text-slate-600">
                      Opportunities tab ranks profitable routes; Scanner tab is focused on scan coverage and discovery telemetry.
                    </p>
                  </div>
                </SectionCard>
              </div>) : null}

            {activePanel === "scanner" ? (<div className="grid gap-6 lg:grid-cols-[1fr]">
                <SectionCard title="Opportunity finding" subtitle="Real-time feed">
                  <div className="space-y-4">
                    <div className="relative mx-auto flex aspect-square w-64 items-center justify-center">
                    <div className="scan-orbit absolute inset-0 rounded-full border border-amber-300/20 bg-[radial-gradient(circle,_rgba(226,188,104,0.16),_rgba(200,155,60,0.02)_42%,_transparent_70%)]"/>
                      <div className="scan-ring absolute inset-4 rounded-full border border-amber-300/30"/>
                    <div className="scan-ring absolute inset-10 rounded-full border border-amber-200/20"/>
                    <div className="scan-sweep absolute inset-0 rounded-full border-t border-amber-300/70 border-r border-amber-200/20"/>
                    <div className="scan-sweep absolute inset-8 rounded-full border-l border-amber-200/40 [animation-direction:reverse] [animation-duration:18s]"/>
                      <span className="scan-dot absolute left-[18%] top-[22%]"/>
                      <span className="scan-dot absolute right-[20%] top-[26%]"/>
                      <span className="scan-dot absolute bottom-[18%] left-[28%]"/>
                      <span className="scan-dot absolute bottom-[24%] right-[28%]"/>
                    <div className="absolute inset-[38%] rounded-full bg-amber-100/40 blur-md shadow-[0_0_30px_rgba(226,188,104,0.4)]"/>
                      <div className="relative z-10 flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] uppercase tracking-[0.4em] text-amber-700">Continuous scan</p>
                        <div className="mt-2 text-3xl font-semibold text-slate-900">{visibleScannerRows.length}</div>
                        <p className="mt-1 text-xs text-slate-500">real-time opportunities</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Highest profit route</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{bestOpportunityDisplay.pair} · {bestOpportunityDisplay.buyDex} → {bestOpportunityDisplay.sellDex}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                        <span className="rounded-full border border-amber-300/30 bg-amber-100/40 px-2 py-0.5 text-amber-700">{formatConfidence(bestOpportunityDisplay.confidence)}% confidence</span>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-emerald-700">{bestOpportunityDisplay.profit}</span>
                        <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-violet-200">{topRouteDisplay.coverage}</span>
                      </div>
                    </div>
                  </div>
                </SectionCard>
                <SectionCard title="Data health panel" subtitle="Per-DEX live quote diagnostics">
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">LIVE connectors</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">
                          {dexSupportMatrix.filter((row) => String(row.status ?? "").toUpperCase() === "LIVE").length}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Data unavailable</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">
                          {dexSupportMatrix.filter((row) => String(row.status ?? "").toUpperCase() === "DATA_UNAVAILABLE").length}
                        </p>
                      </div>
                    </div>
                    <div className="max-h-[22rem] overflow-auto rounded-2xl border border-slate-300 bg-white/15">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="sticky top-0 bg-white/90 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          <tr>
                            <th className="px-3 py-2">DEX</th>
                            <th className="px-3 py-2">Chain</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Quote age</th>
                            <th className="px-3 py-2">Block</th>
                            <th className="px-3 py-2">Pool</th>
                            <th className="px-3 py-2">Latency</th>
                            <th className="px-3 py-2">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quoteHealth.slice(0, 120).map((row, index) => (<tr key={`${row.dexId}-${row.chain}-${index}`} className="border-t border-slate-200/40">
                              <td className="px-3 py-2">{row.dex}</td>
                              <td className="px-3 py-2">{row.chain}</td>
                              <td className="px-3 py-2">{row.status}</td>
                              <td className="px-3 py-2">{typeof row.quoteAgeMs === "number" ? `${Math.max(0, Math.round(row.quoteAgeMs))}ms` : "n/a"}</td>
                              <td className="px-3 py-2">{typeof row.blockNumber === "number" && row.blockNumber > 0 ? row.blockNumber : "n/a"}</td>
                              <td className="px-3 py-2">{typeof row.poolAddress === "string" && row.poolAddress ? `${row.poolAddress.slice(0, 6)}…${row.poolAddress.slice(-4)}` : "n/a"}</td>
                              <td className="px-3 py-2">{typeof row.latencyMs === "number" ? `${Math.round(row.latencyMs)}ms` : "n/a"}</td>
                              <td className="px-3 py-2">{row.error ?? "—"}</td>
                            </tr>))}
                          {quoteHealth.length === 0 ? (<tr>
                              <td className="px-3 py-3 text-slate-500" colSpan={8}>No quote diagnostics yet. Run a scan to populate live connector health.</td>
                            </tr>) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </SectionCard>
              </div>) : null}

            {activePanel === "blockchain" ? (<div className="grid gap-6 xl:grid-cols-[1fr]">
                {selectedBlockchainTab === "Chains" ? (<SectionCard title="Chains" subtitle="All project chains and current status">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {PROJECT_CHAIN_LIST.map((chainName) => {
                    const normalizedChainName = chainName.toLowerCase();
                    const healthEntry = chainHealthMap.get(normalizedChainName);
                    const isActive = activeChainSet.has(normalizedChainName)
                        || normalizedChainName === String(dashboardSnapshot.chain || "").toLowerCase();
                    const statusLabel = healthEntry && Number(healthEntry.total) > 0
                        ? (String(healthEntry.overall ?? "").toLowerCase() === "offline" ? "Standby" : "Active")
                        : (isActive ? "Active" : "Inactive");
                    return (<div key={chainName} className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-base font-semibold text-slate-900 capitalize">{chainName}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] ${isActive ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-700" : "border border-slate-300 bg-white/80 text-slate-600"}`}>
                                {statusLabel}
                              </span>
                            </div>
                            {healthEntry ? (<div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                <span>{healthEntry.healthy}/{healthEntry.total} healthy</span>
                                <span>{String(healthEntry.overall ?? "offline")}</span>
                              </div>) : (<div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">Configured for arbitrage</div>)}
                          </div>);
                })}
                    </div>
                  </SectionCard>) : null}

                {selectedBlockchainTab === "RPC Health" ? (<SectionCard title="RPC Health" subtitle="Live node availability">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Network health</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboardSnapshot.health?.healthy ?? 0}/{dashboardSnapshot.health?.total ?? 0}</p>
                        <p className="mt-2 text-sm text-slate-600">{dashboardSnapshot.health?.overall ?? "offline"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Last scan</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{hasRealScan ? formatStableTime(dashboardSnapshot.lastScan) : "syncing..."}</p>
                        <p className="mt-2 text-sm text-slate-600">Coverage: {executionReadiness.coverage}</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {resolvedRpcHealth.length === 0 ? (<div className="rounded-2xl border border-slate-300 bg-white/15 p-4 text-sm text-slate-600">
                          RPC health snapshot not yet available.
                        </div>) : resolvedRpcHealth.map((chain) => (<div key={chain.chain} className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold capitalize text-slate-900">{chain.chain}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                Selected: {chain.selectedUrl ? chain.selectedUrl.replace(/^https?:\/\//, "").slice(0, 44) : "auto-selecting"}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em]">
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-emerald-700">{chain.healthy}/{chain.total} healthy</span>
                              <span className="rounded-full border border-slate-300 bg-white/80 px-2 py-0.5 text-slate-600">{chain.overall}</span>
                            </div>
                          </div>
                          {chain.endpoints.length > 0 ? (<div className="mt-3 grid gap-2">
                              {chain.endpoints.map((endpoint) => (<div key={`${chain.chain}:${endpoint.url}`} className="rounded-xl border border-slate-200 bg-white/60 p-3 text-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-mono text-[11px] text-slate-700">{endpoint.url.replace(/^https?:\/\//, "")}</p>
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
                                      <span className={`rounded-full px-2 py-0.5 ${endpoint.selected ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-700" : "border border-slate-300 bg-white/80 text-slate-600"}`}>
                                        {endpoint.selected ? "Selected" : "Standby"}
                                      </span>
                                      <span className={`rounded-full px-2 py-0.5 ${endpoint.inCooldown ? "border border-rose-300/30 bg-rose-100/30 text-rose-700" : "border border-emerald-300/20 bg-emerald-100/30 text-emerald-700"}`}>
                                        {formatRpcCooldown(endpoint.cooldownUntil)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-600">
                                    <span>Success {endpoint.successes}</span>
                                    <span>Fail {endpoint.failures}</span>
                                    <span>Latency {formatRpcLatency(endpoint.lastLatency)}</span>
                                    <span>Updated {endpoint.lastUsedAt ? formatStableTime(new Date(endpoint.lastUsedAt).toISOString()) : "n/a"}</span>
                                  </div>
                                </div>))}
                            </div>) : (<div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3 text-sm text-slate-500">
                              No live RPC endpoints are currently tracked for this chain.
                            </div>)}
                        </div>))}
                    </div>
                  </SectionCard>) : null}

                {selectedBlockchainTab === "Blocks" ? (<SectionCard title="Blocks" subtitle="Latest synced block height by chain">
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">Current block height for every connected mainnet chain.</p>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                        {PROJECT_CHAIN_LIST.map((chainName) => {
                    const normalized = chainName.toLowerCase();
                    const rpcEntry = resolvedRpcHealth.find((entry) => entry.chain.toLowerCase() === normalized);
                    const latestBlockFromRpc = typeof rpcEntry?.latestBlock === "number" ? rpcEntry.latestBlock : undefined;
                    const currentBlock = Number.isFinite(latestBlockFromRpc) && (latestBlockFromRpc ?? 0) > 0
                        ? latestBlockFromRpc
                        : (chainBlockMap[normalized] ?? 0);
                    const blockValue = currentBlock > 0 ? currentBlock : (lastKnownBlockMap[normalized] ?? 0);
                    const displayValue = blockValue > 0 ? blockValue.toLocaleString() : "";
                    return (<div key={chainName} className="rounded-xl border border-slate-300 bg-white/15 p-3 text-center">
                              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{chainName}</p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">{displayValue}</p>
                            </div>);
                })}
                      </div>
                    </div>
                  </SectionCard>) : null}

                {selectedBlockchainTab === "Gas" ? (<SectionCard title="Gas" subtitle="Total fees deducted history">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-amber-300/30 bg-amber-100/40 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-700">Total fees deducted</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">${totalGasFeesDeducted.toFixed(2)}</p>
                      </div>
                      <div className="space-y-2">
                        {gasFeeHistory.length === 0 ? (<p className="text-sm text-slate-600">No fee history available yet.</p>) : gasFeeHistory.map((entry) => (<div key={entry.id} className="flex items-center justify-between rounded-2xl border border-slate-300 bg-white/15 px-4 py-3">
                            <p className="text-sm text-slate-700">{entry.label}</p>
                            <p className="text-sm font-semibold text-amber-700">{entry.display}</p>
                          </div>))}
                      </div>
                    </div>
                  </SectionCard>) : null}
              </div>) : null}

            {activePanel === "dex" ? (<div className="grid gap-6 xl:grid-cols-[1fr]">
                {selectedDexTab === "DEX Overview" ? (<SectionCard title="DEX Overview" subtitle="Configured DEX universe (73)">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {PROJECT_DEX_LIST.map((dexName) => {
                    const isActive = activeDexAliasSet.has(dexName.toLowerCase());
                    const dexMetric = dexAnalytics.find((item) => {
                        const normalizedMetricName = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                        const normalizedDexName = dexName.toLowerCase();
                        return normalizedMetricName === normalizedDexName
                            || normalizedMetricName.startsWith(normalizedDexName)
                            || normalizedDexName.startsWith(normalizedMetricName);
                    });
                    const routeCount = dexMetric?.routes ?? 0;
                    return (<div key={dexName} className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900 capitalize">{dexName.replace(/-/g, " ")}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] ${isActive ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-700" : "border border-slate-300 bg-white/80 text-slate-600"}`}>
                                {isActive ? "Connected" : "Inactive"}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-slate-500">
                              <span>{isActive ? "Live quote activity" : "Waiting for quotes"}</span>
                              <span>Routes {routeCount}</span>
                            </div>
                          </div>);
                })}
                    </div>
                  </SectionCard>) : null}

                {selectedDexTab === "Liquidity" ? (<SectionCard title="Liquidity" subtitle="Liquidity to profit generation flow">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-700">Step 1</p>
                        <p className="mt-2 text-sm text-slate-700">Liquidity is added into pools across DEX routers and reflected in quote depth.</p>
                      </div>
                      <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-violet-200">Step 2</p>
                        <p className="mt-2 text-sm text-slate-700">Scanner compares buy/sell quotes across pools to detect spread after gas and slippage.</p>
                      </div>
                      <div className="rounded-2xl border border-amber-300/30 bg-amber-100/40 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-700">Step 3</p>
                        <p className="mt-2 text-sm text-slate-700">Execution submits approved routes and realized PNL is added to trade history.</p>
                      </div>
                    </div>
                  </SectionCard>) : null}

                {selectedDexTab === "Pools" ? (<SectionCard title="Pools" subtitle="Pool analytics">
                    <div className="rounded-2xl border border-slate-300 bg-white/15 p-6 text-center">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Coming soon</p>
                      <p className="mt-3 text-sm text-slate-600">Detailed pool-level monitoring will be available in a future update.</p>
                    </div>
                  </SectionCard>) : null}

                {selectedDexTab === "Quotes" ? (<SectionCard title="Quotes" subtitle="Executed quote history">
                    <div className="space-y-3">
                      {executedQuotesHistory.length === 0 ? (<p className="text-sm text-slate-600">No quotes executed yet.</p>) : executedQuotesHistory.map((quote) => (<div key={quote.id} className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-base font-semibold text-slate-900">{quote.pair}</p>
                          <p className="mt-1 text-sm text-slate-600">{quote.route}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">{quote.time} · {quote.status}</p>
                        </div>))}
                    </div>
                  </SectionCard>) : null}
              </div>) : null}

            {activePanel === "system" ? (<div className="grid gap-6 xl:grid-cols-[1fr]">
                {selectedSystemTab === "AI Engine" ? (<SectionCard title="AI Engine" subtitle="Decision telemetry">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-700">Runtime status</p>
                        <div className="mt-3 flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"/>
                          <p className="text-sm font-semibold text-slate-900">SYSTEM RUNNING...</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {aiMetrics.length ? aiMetrics.map((metric) => (<div key={metric.label} className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">{metric.label}</p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">{metric.value}</p>
                          </div>)) : <p className="text-sm text-slate-600">No AI metrics available.</p>}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Recovery worker</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{recoveryWorker.enabled ? "Enabled" : "Disabled"}</p>
                          <p className="mt-1 text-xs text-slate-600">Pending {recoveryWorker.pending} · Ready {recoveryWorker.retryReady}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Settlement worker</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{settlementWorker.enabled ? "Enabled" : "Disabled"}</p>
                          <p className="mt-1 text-xs text-slate-600">Pending {settlementWorker.pending} · Ready {settlementWorker.retryReady}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Settlement queue</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{settlementQueue.pending} pending</p>
                          <p className="mt-1 text-xs text-slate-600">Settled {settlementQueue.settled} · Failed {settlementQueue.failed}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Rollout status</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">Scale {rolloutSummary.scale} · Canary {rolloutSummary.canary}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            Blocked {rolloutSummary.blocked} · {rolloutGovernance.autopilotEnabled ? "Autopilot ON" : "Autopilot OFF"}
                          </p>
                        </div>
                          <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Alerting response</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">
                            {alerting.webhookConfigured ? "Webhook configured" : "Webhook missing"}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Unresolved critical {alerting.unresolvedCritical} · Recent {alerting.recent.length} · Actions {alerting.recommendedActions.length}
                          </p>
                          </div>
                          <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Deployment safety</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">
                            {deploymentSafety.restart.safeToRestart ? "Safe to restart" : "Restart blocked"}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Uptime {deploymentSafety.process.uptimeSeconds}s · Recovery {deploymentSafety.workers.recovery.inFlight ? "busy" : "idle"} · Settlement {deploymentSafety.workers.settlement.inFlight ? "busy" : "idle"}
                          </p>
                          </div>
                          <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Trade reconciliation</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">
                            {reconciliation.pending === 0 && reconciliation.orphanSettlements === 0 ? "Balanced" : "Needs review"}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Matched {reconciliation.matched} · Pending {reconciliation.pending} · Orphans {reconciliation.orphanSettlements}
                          </p>
                          </div>
                          <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Deployment safety</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">
                            {deploymentSafety.restart.safeToRestart ? "Safe to restart" : "Restart blocked"}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Uptime {deploymentSafety.process.uptimeSeconds}s · Recovery {deploymentSafety.workers.recovery.inFlight ? "busy" : "idle"} · Settlement {deploymentSafety.workers.settlement.inFlight ? "busy" : "idle"}
                          </p>
                          </div>
                      </div>
                      {deploymentSafety.restart.blockers.length ? (<div className="rounded-2xl border border-amber-300/30 bg-amber-100/40 p-4">
                            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-700">Restart blockers</p>
                            <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {deploymentSafety.restart.blockers.slice(0, 3).map((blocker) => (<li key={blocker}>• {blocker}</li>))}
                            </ul>
                          </div>) : (<div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                            <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-700">Restart status</p>
                            <p className="mt-2 text-sm text-slate-700">{deploymentSafety.restart.reason}</p>
                          </div>)}
                      {alerting.recent.length ? (<div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Recent alerts</p>
                          {alerting.recent.slice(0, 3).map((row) => (<div key={row.id} className="rounded-2xl border border-slate-300 bg-white/15 p-3">
                                <p className="text-sm font-semibold text-slate-900">
                                    {row.event} · {row.severity}
                                </p>
                                <p className="mt-1 text-xs text-slate-600">{row.message}</p>
                                <p className="mt-1 text-[11px] text-slate-600">
                                    {row.status} · {row.delivered ? "delivered" : "pending"} · {row.acknowledged ? `ack by ${row.acknowledgedBy ?? "operator"}` : "unacknowledged"}
                                </p>
                            </div>))}
                          </div>) : null}
                      {alerting.recommendedActions.length ? (<div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Recommended response</p>
                          <ul className="mt-2 space-y-1 text-sm text-slate-600">
                            {alerting.recommendedActions.slice(0, 3).map((action) => (<li key={action}>• {action}</li>))}
                          </ul>
                          </div>) : null}
                      {settlementsSummary.latest ? (<div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Latest settlement</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">
                            {settlementsSummary.latest.chain} · {settlementsSummary.latest.realizedNetUsd} net
                          </p>
                          <p className="mt-1 text-xs text-slate-600 break-all">
                            {settlementsSummary.latest.txHash}
                          </p>
                        </div>) : null}
                      {recentSettlementQueueItems.length ? (<div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Recent settlement queue</p>
                          {recentSettlementQueueItems.map((item) => (<div key={item.id} className="rounded-2xl border border-slate-300 bg-white/15 p-3">
                              <p className="text-sm font-semibold text-slate-900">{item.chain} · {item.status}</p>
                              <p className="mt-1 text-xs text-slate-600">{item.amountUsd} · attempts {item.attempts}</p>
                            </div>))}
                        </div>) : null}
                      {rolloutChains.length ? (<div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Chain rollout gates</p>
                          {rolloutChains.map((chain) => (<div key={chain.chain} className="rounded-2xl border border-slate-300 bg-white/15 p-3">
                              <p className="text-sm font-semibold text-slate-900">{chain.chain} · {chain.stage}</p>
                              <p className="mt-1 text-xs text-slate-600">
                                RPC {chain.rpcOverall} · Coverage {chain.executablePairs?.coveragePct ?? 0}% · Quote issues {chain.quoteHealth?.degradedOrOffline ?? 0}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-600">
                                Observed {chain.observedStage ?? chain.stage} · Source {chain.governance?.source ?? "autopilot"} · Streak {chain.governance?.promotionStreak ?? 0}/{rolloutGovernance.promotionStreakRequired}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-600">
                                Go/no-go {chain.goNoGo?.readyForScale ? "GO" : chain.goNoGo?.readyForCanary ? "CANARY" : "HOLD"} · {chain.goNoGo?.reason ?? "Gate unavailable"}
                              </p>
                            </div>))}
                        </div>) : null}
                    </div>
                  </SectionCard>) : null}

                {selectedSystemTab === "Logs" ? (<SectionCard title="Observability" subtitle="Runtime SLO and alerts">
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Kill-switch</p>
                          <p className={`mt-2 text-lg font-semibold ${killSwitch.engaged ? "text-red-400" : "text-emerald-400"}`}>
                            {killSwitch.engaged ? "ENGAGED" : "NORMAL"}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">{killSwitch.reason ?? "No active risk trigger"}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Execution throughput</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{executionRatePct.toFixed(1)}%</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {replaySummary.executable}/{replaySummary.scanned} executable · {replaySummary.windowMinutes}m window
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Worker backlog</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{recoveryWorker.pending + settlementQueue.pending}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            Recovery {recoveryWorker.pending} · Settlement {settlementQueue.pending}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">RPC degraded chains</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{degradedChains.length}</p>
                          <p className="mt-1 text-xs text-slate-600">{degradedChains.length ? degradedChains.join(", ") : "All chains healthy"}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Risk counters</p>
                        <p className="mt-2 text-sm text-slate-700">
                          Consecutive losses {killSwitch.consecutiveLosses} · Slippage events {killSwitch.abnormalSlippageEvents} · RPC instability {killSwitch.rpcInstabilityEvents}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Rolling realized loss ${killSwitch.dailyRealizedLossUsd.toFixed(2)} · Store {dashboardSnapshot.persistence?.storePath ?? "not set"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Signer policy</p>
                        <p className={`mt-2 text-sm font-semibold ${signerPolicy.ready ? "text-emerald-400" : "text-red-400"}`}>
                          {signerPolicy.mode} · {signerPolicy.ready ? "READY" : "BLOCKED"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {signerPolicy.reason}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Capital policy</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          Active {(capitalPolicy.activeAllocationShare * 100).toFixed(0)}% · Reserve {(capitalPolicy.reserveAllocationShare * 100).toFixed(0)}% · Emergency {(capitalPolicy.emergencyAllocationShare * 100).toFixed(0)}%
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Emergency floor ${capitalPolicy.emergencyReserveFloorUsd.toFixed(0)} · Max trade {(capitalPolicy.maxTradeShareOfActiveCapital * 100).toFixed(0)}% of active capital
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Min gas reserve ({executionChain}) {Number(capitalPolicy.minGasReserveNative?.[executionChain] ?? 0).toFixed(4)} native
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Capital growth</p>
                        <p className={`mt-2 text-sm font-semibold ${capitalGrowth.allowed ? "text-emerald-400" : "text-amber-500"}`}>
                          {capitalGrowth.status.toUpperCase()} · {capitalGrowth.allowed ? "ALLOW" : "PAUSE"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Active {capitalGrowth.currentActiveShare.toFixed(2)}x · Recommended {capitalGrowth.recommendedActiveShare.toFixed(2)}x · Δ {capitalGrowth.deltaActiveShare.toFixed(2)}x
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Win rate {capitalGrowth.winRatePct.toFixed(1)}% · Drawdown {capitalGrowth.drawdownPct.toFixed(1)}% · Net ${capitalGrowth.realizedNetUsd.toFixed(2)}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {capitalGrowth.reason}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Market validation</p>
                        <p className={`mt-2 text-sm font-semibold ${marketValidation.allowed ? "text-emerald-400" : "text-amber-500"}`}>
                          {marketValidation.status.toUpperCase()} · {marketValidation.allowed ? "READY" : "HOLD"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Score {marketValidation.score.toFixed(2)} · Live ratio {marketValidation.liveOpportunityRatio.toFixed(2)} · RPC health {(marketValidation.rpcHealthyRatio * 100).toFixed(0)}%
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Avg net ${marketValidation.avgExpectedNetUsd.toFixed(2)} · {marketValidation.reason}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Canary gate</p>
                        <p className={`mt-2 text-sm font-semibold ${canaryValidation.goForScale ? "text-emerald-400" : "text-amber-500"}`}>
                          {canaryValidation.chain} · {canaryValidation.goForScale ? "GO FOR SCALE" : "HOLD"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Settled {canaryValidation.settledTrades}/{canaryValidation.minSettledTrades} · Net ${canaryValidation.cumulativeRealizedNetUsd.toFixed(2)} / ${canaryValidation.minRealizedNetUsd.toFixed(2)}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Avg slip {canaryValidation.averageSlippageBps.toFixed(2)} bps (cap {canaryValidation.maxAverageSlippageBps}) · Losses {canaryValidation.lossTrades}/{canaryValidation.maxLossTrades}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {canaryValidation.reason}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Relay + RPC drill</p>
                        <p className={`mt-2 text-sm font-semibold ${relayRpcDrill.overallPass ? "text-emerald-400" : "text-amber-500"}`}>
                          {relayRpcDrill.overallPass ? "PASS" : "ACTION NEEDED"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Relay {relayRpcDrill.relay.pass ? "ok" : "missing"} · RPC {relayRpcDrill.rpc.pass ? "ok" : "degraded"} · Fail-closed {relayRpcDrill.failClosed.pass ? "ok" : "risk"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Alerts {relayRpcDrill.alerts.pass ? "ok" : "off"} · Workers {relayRpcDrill.workers.pass ? "ok" : "off"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {relayRpcDrill.reason}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Live cost tuning</p>
                        <p className={`mt-2 text-sm font-semibold ${liveCostTuning.sizingPenaltyMultiplier < 1 ? "text-amber-500" : "text-emerald-400"}`}>
                          Window {liveCostTuning.windowTrades} · Size x{liveCostTuning.sizingPenaltyMultiplier.toFixed(2)}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Avg gas ${liveCostTuning.avgGasCostUsd.toFixed(2)} (+${liveCostTuning.gasCostBufferUsd.toFixed(2)} buffer) · Avg slip {liveCostTuning.avgSlippageBps.toFixed(2)} bps (x{liveCostTuning.slippageMultiplier.toFixed(2)})
                        </p>
                        <p className={`mt-1 text-xs ${liveCostTuning.avgRealizedNetUsd >= 0 ? "text-emerald-400" : "text-amber-500"}`}>
                          Avg realized net ${liveCostTuning.avgRealizedNetUsd.toFixed(2)}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {liveCostTuning.reason}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Execution readiness gate</p>
                        <p className={`mt-2 text-sm font-semibold ${readinessGate.pass ? "text-emerald-400" : "text-red-400"}`}>
                          {readinessGate.pass ? "PASS" : "BLOCKED"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Enforced: canary {readinessGate.enforced.canaryPassRequired ? "required" : "advisory"} · relay/rpc {readinessGate.enforced.relayRpcDrillPassRequired ? "required" : "advisory"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Checks: kill-switch {readinessGate.checks.killSwitchClear ? "clear" : "engaged"} · signer {readinessGate.checks.signerReady ? "ready" : "blocked"} · canary {readinessGate.checks.canaryPass ? "pass" : "hold"} · drill {readinessGate.checks.relayRpcDrillPass ? "pass" : "fail"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {readinessGate.reason}
                        </p>
                        <div className="mt-3 space-y-1">
                          {readinessGateHistory.slice(0, 3).map((entry) => (<p key={`${entry.generatedAt}-${entry.pass}-${entry.reason}`} className="text-[11px] text-slate-600">
                              {formatStableTime(entry.generatedAt)} · {entry.pass ? "PASS" : "BLOCKED"} · {entry.reason}
                            </p>))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Operator safety</p>
                        <p className={`mt-2 text-sm font-semibold ${operatorSafety.overallPass ? "text-emerald-400" : "text-amber-500"}`}>
                          {operatorSafety.overallPass ? "HEALTHY" : "ACTION NEEDED"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Persistence {operatorSafety.persistence.healthy ? "ok" : "risk"} · Alerting {operatorSafety.alerting.pass ? "configured" : "off"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Risk {operatorSafety.risk.pass ? "clear" : "blocked"} · State file {operatorSafety.persistence.filePath ? operatorSafety.persistence.filePath : "unknown"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {operatorSafety.reason}
                        </p>
                      </div>
                    </div>
                  </SectionCard>) : null}

                {selectedSystemTab === "Profile" ? (<SectionCard title="Profile" subtitle="Identity details">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-amber-300/30 bg-slate-950/70 shadow-[0_0_24px_rgba(200,155,60,0.14)]">
                        {profile.avatarDataUrl ? (<img src={profile.avatarDataUrl} alt="Profile preview" className="h-full w-full object-cover"/>) : (<span className="text-2xl font-semibold text-amber-100">{profile.name.trim().slice(0, 1).toUpperCase() || "👤"}</span>)}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <label className="rounded-xl border border-slate-300 bg-white/15 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white/20">
                            <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoChange}/>
                            Add photo
                          </label>
                          <button type="button" onClick={() => updateProfile({ avatarDataUrl: null })} className="rounded-xl border border-slate-300 bg-white/15 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white/20">
                            Remove photo
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">Saved locally in your browser.</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Name</span>
                        <input value={profile.name} onChange={(event) => updateProfile({ name: event.target.value })} placeholder="Enter your name" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-0"/>
                      </label>

                      <label className="space-y-2 md:col-span-2">
                        <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Email</span>
                        <input type="email" value={profile.email} onChange={(event) => updateProfile({ email: event.target.value })} placeholder="name@example.com" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-0"/>
                      </label>

                      <label className="space-y-2">
                        <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Country code</span>
                        <input value={profile.phoneCountryCode} onChange={(event) => updateProfile({ phoneCountryCode: event.target.value })} placeholder="+91" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-0"/>
                      </label>

                      <label className="space-y-2">
                        <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Phone number</span>
                        <input type="tel" value={profile.phoneNumber} onChange={(event) => updateProfile({ phoneNumber: event.target.value })} placeholder="9876543210" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-0"/>
                      </label>
                    </div>

                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-700">Profile summary</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{profile.name || "Unnamed profile"}</p>
                      <p className="mt-1 text-sm text-slate-600">{profile.email || "No email added"} · {(profile.phoneCountryCode || "").trim()}{profile.phoneNumber ? ` ${profile.phoneNumber}` : ""}</p>
                    </div>
                  </div>
                  </SectionCard>) : null}
              </div>) : null}

            {activePanel === "history" ? (<div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <SectionCard title="Trade History" subtitle="Executed route ledger">
                  <div className="mb-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-700">Total PNL</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{tradeHistory.length ? pnlSummary.totalPnl : "$0"}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-300/30 bg-amber-100/40 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-amber-700">Win rate</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{tradeHistory.length ? pnlSummary.winRate : "0%"}</p>
                    </div>
                    <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-violet-200">Volume</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{tradeHistory.length ? pnlSummary.totalVolume : "$0"}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200">Best trade</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{tradeHistory.length ? pnlSummary.bestTrade : "$0"}</p>
                    </div>
                  </div>
                  <div className="terminal-table">
                    <div className="terminal-table-head grid grid-cols-[1.1fr_0.9fr_0.8fr_0.75fr_0.7fr] gap-3 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-slate-500">
                      <span>Pair</span><span>Route</span><span>Time</span><span>Size</span><span>PNL</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {tradeHistory.length === 0 ? (<div className="px-4 py-6 text-sm text-slate-600">
                          No realized trades yet. Execution requests will appear here once a route is completed.
                        </div>) : tradeHistory.map((trade) => (<div key={trade.id} className="terminal-table-row grid grid-cols-[1.1fr_0.9fr_0.8fr_0.75fr_0.7fr] gap-3 px-4 py-3 text-sm text-slate-600">
                          <div>
                            <p className="font-semibold text-slate-900">{trade.pair}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">{trade.status}</p>
                            {trade.note ? <p className="mt-1 text-xs text-slate-500">{trade.note}</p> : null}
                          </div>
                          <div>
                            <span>{trade.route}</span>
                            {trade.txHash ? <p className="mt-1 font-mono text-[11px] text-slate-500">{trade.txHash.slice(0, 10)}...{trade.txHash.slice(-6)}</p> : null}
                          </div>
                          <span>{trade.executedAt}</span>
                          <span>{trade.sizeUsd}</span>
                          <span className={trade.pnl.startsWith("-") ? "text-rose-300" : trade.pnl === "$0" ? "text-slate-600" : "text-emerald-600"}>{trade.pnl}</span>
                        </div>))}
                    </div>
                  </div>
                </SectionCard>
                <SectionCard title="Execution Intents" subtitle="Prepared, relay, and confirm lifecycle">
                  <div className="mb-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Total</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboardSnapshot.executionIntentSummary?.total ?? executionIntents.length}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-700">Active</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboardSnapshot.executionIntentSummary?.active ?? executionIntents.filter((intent) => intent.status === "prepared" || intent.status === "submitted").length}</p>
                    </div>
                    <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-blue-700">Submitted</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboardSnapshot.executionIntentSummary?.submitted ?? executionIntents.filter((intent) => intent.status === "submitted").length}</p>
                    </div>
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-rose-700">Failed</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboardSnapshot.executionIntentSummary?.failed ?? executionIntents.filter((intent) => intent.status === "failed").length}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="terminal-table">
                      <div className="terminal-table-head grid grid-cols-[0.8fr_0.9fr_1fr_0.6fr_0.8fr] gap-3 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-slate-500">
                        <span>Status</span><span>Route</span><span>Wallet</span><span>Relay</span><span>Expiry</span>
                      </div>
                      <div className="divide-y divide-white/5">
                        {executionIntents.length === 0 ? (
                          <div className="px-4 py-6 text-sm text-slate-600">
                            No execution intents yet. Preparing a route will add a live intent here.
                          </div>
                        ) : executionIntents.slice(0, 6).map((intent) => {
                          const isSelected = (selectedExecutionIntent?.id ?? null) === intent.id;
                          const rowBadge = isSelected
                              ? (isRefreshing ? "SYNCING" : "LIVE")
                              : (intent.status === "confirmed" ? "DONE" : intent.status === "failed" ? "FAILED" : "WATCH");
                          return (<button key={intent.id} type="button" onClick={() => setSelectedExecutionIntentId(intent.id)} className={`terminal-table-row grid w-full grid-cols-[0.8fr_0.9fr_1fr_0.6fr_0.8fr] gap-3 px-4 py-3 text-left text-sm text-slate-600 transition ${isSelected ? "bg-emerald-50/80" : "hover:bg-slate-50/70"}`}>
                            <div>
                              <p className="font-semibold text-slate-900">{intent.status}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">{intent.chain}</p>
                              <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] ${rowBadge === "LIVE"
                              ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-700"
                              : rowBadge === "SYNCING"
                                  ? "border border-blue-400/20 bg-blue-400/10 text-blue-700"
                                  : rowBadge === "DONE"
                                      ? "border border-slate-300 bg-white/80 text-slate-600"
                                      : rowBadge === "FAILED"
                                          ? "border border-rose-400/20 bg-rose-400/10 text-rose-700"
                                          : "border border-amber-400/20 bg-amber-100/40 text-amber-700"}`}>
                                {rowBadge}
                              </span>
                            </div>
                              <div>
                                <p className="font-medium text-slate-900">{intent.route}</p>
                                <p className="mt-1 text-[11px] text-slate-500">{intent.amountUsd}</p>
                              </div>
                              <span className="font-mono text-[11px] text-slate-500">{intent.walletAddress}</span>
                              <span>{intent.privateRelayRequired ? "required" : intent.privateRelayRequested ? "requested" : "optional"}</span>
                              <span>{intent.expiresAt}</span>
                            </button>);
                        })}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-300 bg-white/15 p-4">
                      {selectedExecutionIntent ? (<div className="space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Selected intent</p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">{selectedExecutionIntent.route}</p>
                              <p className="mt-1 text-sm text-slate-600">{selectedExecutionIntent.amountUsd} · {selectedExecutionIntent.chain}</p>
                              <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                                {isRefreshing ? "Refreshing live intent status..." : `Synced · ${formatStableTime(dashboardSnapshot.lastScan)}`}
                              </p>
                            </div>
                            <span className="rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-600">
                              {selectedExecutionIntent.status}
                            </span>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 bg-white/60 p-3">
                              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Wallet</p>
                              <p className="mt-2 font-mono text-[11px] text-slate-700">{selectedExecutionIntent.walletAddress}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white/60 p-3">
                              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Relay policy</p>
                              <p className="mt-2 text-sm text-slate-700">
                                {selectedExecutionIntent.privateRelayRequired ? "Required" : selectedExecutionIntent.privateRelayRequested ? "Requested" : "Optional"}
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white/60 p-3">
                              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Created</p>
                              <p className="mt-2 text-sm text-slate-700">{selectedExecutionIntent.createdAt}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white/60 p-3">
                              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Expires</p>
                              <p className="mt-2 text-sm text-slate-700">{selectedExecutionIntent.expiresAt}</p>
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white/60 p-3">
                            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Lifecycle</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {["prepared", "submitted", "confirmed", "failed"].map((state) => (
                                <span key={state} className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${selectedExecutionIntent.status === state ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-700" : "border border-slate-300 bg-white/80 text-slate-500"}`}>
                                  {state}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white/60 p-3">
                            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Relay hashes</p>
                            <div className="mt-3 space-y-2">
                              {selectedExecutionIntent.relayHashes?.length ? selectedExecutionIntent.relayHashes.map((hash) => (<p key={hash} className="font-mono text-[11px] text-slate-700">{hash}</p>)) : (<p className="text-sm text-slate-500">No relay hashes recorded yet.</p>)}
                            </div>
                          </div>
                          {selectedExecutionIntent.txHash ? (<div className="rounded-xl border border-slate-200 bg-white/60 p-3">
                              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Final transaction hash</p>
                              <p className="mt-2 font-mono text-[11px] text-slate-700">{selectedExecutionIntent.txHash}</p>
                            </div>) : null}
                        </div>) : (<div className="text-sm text-slate-600">Select an intent to inspect relay hashes and lifecycle details.</div>)}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="System Logs" subtitle="Recent terminal activity">
                  <div className="terminal-log">
                    {systemLogEntries.map((entry) => (<div key={`${entry.source}-${entry.time}-${entry.message}`} className="terminal-log-line">
                        <span className="text-slate-500">{entry.time}</span>
                        <span className={`level ${entry.level}`}>{entry.source}</span>
                        <span className="text-slate-600">{entry.message}</span>
                      </div>))}
                  </div>
                </SectionCard>
              </div>) : null}

          </main>
        </div>
      </div>
      </div>
    </>);
}
