import assert from "node:assert/strict";
import test from "node:test";

import { scoreOpportunity } from "./opportunity.js";
import type { Opportunity } from "./types.js";

test("fresh quotes outrank stale ones", () => {
  const freshOpportunity: Opportunity = {
    chain: "arbitrum",
    tokenIn: "0x0000000000000000000000000000000000000001",
    tokenOut: "0x0000000000000000000000000000000000000002",
    buyDex: "uniswap",
    sellDex: "sushiswap",
    buyAmount: 1_000_000n,
    sellAmount: 1_010_000n,
    grossProfit: 10_000n,
    gasCost: 1_000n,
    netProfit: 9_000n,
    tokenInDecimals: 18,
    tokenOutDecimals: 18,
    profitable: true,
    slippageBps: 18,
    gasImpactBps: 12,
    quoteAgeMs: 750,
    blockAge: 1,
  };

  const staleOpportunity: Opportunity = {
    ...freshOpportunity,
    quoteAgeMs: 45_000,
    blockAge: 9,
  };

  assert.ok(scoreOpportunity(freshOpportunity) > scoreOpportunity(staleOpportunity));
});
