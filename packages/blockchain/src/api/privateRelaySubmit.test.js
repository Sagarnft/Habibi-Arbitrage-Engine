import assert from "node:assert/strict";
import { resolvePrivateRelayRpcUrl, submitSignedTransactionsToPrivateRelay } from "./server.js";

const originalFetch = globalThis.fetch;
const originalDefaultRelay = process.env.PRIVATE_RELAY_RPC_URL;
const originalBnbRelay = process.env.PRIVATE_RELAY_RPC_URL_BNB;

try {
  process.env.PRIVATE_RELAY_RPC_URL = "https://relay.default";
  process.env.PRIVATE_RELAY_RPC_URL_BNB = "https://relay.bnb";
  assert.equal(resolvePrivateRelayRpcUrl("bnb"), "https://relay.bnb");
  assert.equal(resolvePrivateRelayRpcUrl("arbitrum"), "https://relay.default");

  delete process.env.PRIVATE_RELAY_RPC_URL;
  delete process.env.PRIVATE_RELAY_RPC_URL_BNB;
  process.env.PRIVATE_RELAY_RPC_URL_BNB = "not-a-url";
  assert.equal(resolvePrivateRelayRpcUrl("bnb"), undefined);
  await assert.rejects(
    submitSignedTransactionsToPrivateRelay("bnb", ["0x1234"]),
    /Private relay RPC URL is invalid for bnb\./,
  );

  delete process.env.PRIVATE_RELAY_RPC_URL_BNB;
  await assert.rejects(
    submitSignedTransactionsToPrivateRelay("bnb", ["0x1234"]),
    /Private relay RPC URL is not configured for bnb\./,
  );

  process.env.PRIVATE_RELAY_RPC_URL_BNB = "https://relay.bnb";
  const sentBodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    sentBodies.push(body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ result: "0x1111111111111111111111111111111111111111111111111111111111111111" }),
    };
  };

  const submitted = await submitSignedTransactionsToPrivateRelay("bnb", ["0xabcd", "0xdef0"]);
  assert.equal(submitted.relayUrl, "https://relay.bnb");
  assert.equal(submitted.hashes.length, 2);
  assert.equal(sentBodies.length, 2);
  assert.equal(sentBodies.every((body) => body.method === "eth_sendRawTransaction"), true);

  console.log("private relay submit regression test passed");
} finally {
  globalThis.fetch = originalFetch;
  if (originalDefaultRelay === undefined) {
    delete process.env.PRIVATE_RELAY_RPC_URL;
  } else {
    process.env.PRIVATE_RELAY_RPC_URL = originalDefaultRelay;
  }
  if (originalBnbRelay === undefined) {
    delete process.env.PRIVATE_RELAY_RPC_URL_BNB;
  } else {
    process.env.PRIVATE_RELAY_RPC_URL_BNB = originalBnbRelay;
  }
}
