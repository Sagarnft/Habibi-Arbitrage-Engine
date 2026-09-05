export interface QuoteResult {
  dex: string;
  chain: string;
  chainId: number;
  protocol: string;
  pair: `0x${string}`;
  poolAddress: `0x${string}`;
  amountOut: bigint;
  amountIn: bigint;
  executablePrice: number;
  liquidity: bigint;
  priceImpact: number;
  fee: {
    bps: number;
    amount: bigint;
  };
  reserveIn: bigint;
  reserveOut: bigint;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  tokenInDecimals: number;
  tokenOutDecimals: number;
  timestamp: string;
  quoteTimestamp: number;
  quoteAgeMs: number;
  blockNumber: number;
  blockAge: number;
  source: string;
  status: QuoteStatus;
  confidence: number;
  derivedDexes?: string[];
}

export type QuoteStatus =
  | "LIVE"
  | "STALE"
  | "INVALID"
  | "UNVERIFIED"
  | "ERROR"
  | "DATA_UNAVAILABLE";

export interface QuoteDiagnosticsRow {
  dex: string;
  dexId: string;
  chain: string;
  chainId?: number;
  protocol: string;
  priceSource: string;
  quoteSource: string;
  status: QuoteStatus;
  source: string;
  lastSuccessfulFetch?: string;
  quoteTimestamp?: number;
  quoteAgeMs?: number;
  blockNumber?: number;
  blockAge?: number;
  poolAddress?: `0x${string}`;
  liquidity?: string;
  error?: string;
  latencyMs?: number;
}

export interface SupportMatrixRow {
  dex: string;
  chain: string;
  protocol: string;
  priceSource: string;
  quoteSource: string;
  status: QuoteStatus;
  lastSuccessfulQuote?: string;
}