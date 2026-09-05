import type { ChainName } from "../../chains.js";


export interface ScanRequest {

  chain: ChainName;

  amountIn: bigint;

  tokens: readonly `0x${string}`[];

}

export interface ScanPairCandidate {
  chain: ChainName;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
}

export interface Opportunity {
  chain: ChainName;

  tokenIn: `0x${string}`;

  tokenOut: `0x${string}`;


  buyDex: string;

  sellDex: string;


  buyAmount: bigint;

  sellAmount: bigint;


  grossProfit: bigint;

  gasCost: bigint;

  netProfit: bigint;

  tokenInDecimals: number;
  tokenOutDecimals: number;

  routeLabel?: string;

  legs?: Array<{
    dex: string;
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
  }>;

  profitable: boolean;

  slippageBps?: number;
  gasImpactBps?: number;

  quoteAgeMs?: number;
  blockAge?: number;

}



export interface ScanResult {

  opportunities: Opportunity[];

  scannedPairs: number;

  failedPairs: number;

  scanWindow?: {
    active: boolean;
    currentSecond: number;
    startSecond: number;
    endSecond: number;
    reason?: string;
  };

  dexActivity?: Array<{
    dex: string;
    quotes: number;
    pairs: number;
    opportunities: number;
  }>;

}