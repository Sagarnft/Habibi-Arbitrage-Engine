import assert from "node:assert/strict";
import { AaveFlashloanProvider } from "./aave.js";

const originalReceiver = process.env.FLASHLOAN_RECEIVER_ADDRESS;

try {
  process.env.FLASHLOAN_RECEIVER_ADDRESS = "0x1111111111111111111111111111111111111111";

  const provider = new AaveFlashloanProvider();
  const result = await provider.requestFlashloan({
    chain: "arbitrum",
    token: "0x2222222222222222222222222222222222222222",
    amount: 1000000000000000000n,
    beneficiary: "0x3333333333333333333333333333333333333333",
    calls: [
      {
        to: "0x4444444444444444444444444444444444444444",
        data: "0x1234",
        value: 0n,
      },
    ],
  });

  assert.equal(result.success, true);
  assert.equal(result.receiver, "0x1111111111111111111111111111111111111111");
  assert.ok(result.transaction);
  assert.equal(result.transaction?.to, "0x1111111111111111111111111111111111111111");

  console.log("aave flashloan provider regression test passed");
} finally {
  if (originalReceiver === undefined) {
    delete process.env.FLASHLOAN_RECEIVER_ADDRESS;
  } else {
    process.env.FLASHLOAN_RECEIVER_ADDRESS = originalReceiver;
  }
}
