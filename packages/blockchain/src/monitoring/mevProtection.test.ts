import assert from "node:assert/strict";
import { MevProtectionGuard } from "./mevProtection.js";

const guard = new MevProtectionGuard();

const allowed = guard.evaluate(100, 1000n);
assert.equal(allowed.allowed, true);
assert.equal(allowed.score, 92);

const blockedBySlippage = guard.evaluate(1600, 1000n);
assert.equal(blockedBySlippage.allowed, false);
assert.equal(blockedBySlippage.reason, "slippage exceeds mev protection threshold");

const blockedByProfit = guard.evaluate(100, 0n);
assert.equal(blockedByProfit.allowed, false);
assert.equal(blockedByProfit.reason, "profitability is non-positive");

console.log("mev protection smoke test passed");
