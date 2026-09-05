import assert from "node:assert/strict";

const originalApiKey = process.env.EXECUTION_API_KEY;
const originalUnsafeBypass = process.env.EXECUTION_API_ALLOW_UNSAFE_WITHOUT_KEY;
const originalWebhook = process.env.ALERT_WEBHOOK_URL;
const originalRelayArbitrum = process.env.PRIVATE_RELAY_RPC_URL_ARBITRUM;
const originalRelayBnb = process.env.PRIVATE_RELAY_RPC_URL_BNB;
const originalRelayBase = process.env.PRIVATE_RELAY_RPC_URL_BASE;
const originalRequiredChains = process.env.RELAY_REQUIRED_CHAINS;

try {
  process.env.RELAY_REQUIRED_CHAINS = "arbitrum,bnb,base";
  process.env.PRIVATE_RELAY_RPC_URL_ARBITRUM = "https://relay.arbitrum";
  process.env.PRIVATE_RELAY_RPC_URL_BNB = "https://relay.bnb";
  process.env.PRIVATE_RELAY_RPC_URL_BASE = "https://relay.base";
  process.env.EXECUTION_API_KEY = "test-key";
  process.env.EXECUTION_API_ALLOW_UNSAFE_WITHOUT_KEY = "false";
  process.env.ALERT_WEBHOOK_URL = "https://alerts.example.com";

  const { buildRelayRpcDrillStatus } = await import("./server.js");
  const passing = buildRelayRpcDrillStatus({
    signerReady: true,
    rpcHealth: [
      { chain: "arbitrum", selectedUrl: "https://rpc.arbitrum", latestBlock: 1, total: 2, healthy: 2, offline: 0, overall: "healthy", endpoints: [] },
      { chain: "bnb", selectedUrl: "https://rpc.bnb", latestBlock: 1, total: 2, healthy: 2, offline: 0, overall: "healthy", endpoints: [] },
      { chain: "base", selectedUrl: "https://rpc.base", latestBlock: 1, total: 2, healthy: 2, offline: 0, overall: "healthy", endpoints: [] },
    ],
  });
  assert.equal(passing.overallPass, true);
  assert.equal(passing.relay.missingChains.length, 0);
  assert.equal(passing.rpc.lowRedundancyChains.length, 0);

  process.env.PRIVATE_RELAY_RPC_URL_BASE = "not-a-url";
  const misconfigured = buildRelayRpcDrillStatus({
    signerReady: true,
    rpcHealth: [
      { chain: "arbitrum", selectedUrl: "https://rpc.arbitrum", latestBlock: 1, total: 2, healthy: 2, offline: 0, overall: "healthy", endpoints: [] },
      { chain: "bnb", selectedUrl: "https://rpc.bnb", latestBlock: 1, total: 2, healthy: 2, offline: 0, overall: "healthy", endpoints: [] },
      { chain: "base", selectedUrl: "https://rpc.base", latestBlock: 1, total: 2, healthy: 2, offline: 0, overall: "healthy", endpoints: [] },
    ],
  });
  assert.equal(misconfigured.overallPass, false);
  assert.equal(misconfigured.reason.includes("misconfigured"), true);

  const failing = buildRelayRpcDrillStatus({
    signerReady: false,
    rpcHealth: [
      { chain: "arbitrum", selectedUrl: "https://rpc.arbitrum", latestBlock: 0, total: 1, healthy: 0, offline: 1, overall: "offline", endpoints: [] },
    ],
    webhookConfigured: false,
  });
  assert.equal(failing.overallPass, false);
  assert.equal(failing.rpc.pass, false);
  assert.equal(failing.failClosed.pass, false);

  console.log("relay+rpc drill regression test passed");
} finally {
  if (originalApiKey === undefined) {
    delete process.env.EXECUTION_API_KEY;
  } else {
    process.env.EXECUTION_API_KEY = originalApiKey;
  }
  if (originalUnsafeBypass === undefined) {
    delete process.env.EXECUTION_API_ALLOW_UNSAFE_WITHOUT_KEY;
  } else {
    process.env.EXECUTION_API_ALLOW_UNSAFE_WITHOUT_KEY = originalUnsafeBypass;
  }
  if (originalWebhook === undefined) {
    delete process.env.ALERT_WEBHOOK_URL;
  } else {
    process.env.ALERT_WEBHOOK_URL = originalWebhook;
  }
  if (originalRelayArbitrum === undefined) {
    delete process.env.PRIVATE_RELAY_RPC_URL_ARBITRUM;
  } else {
    process.env.PRIVATE_RELAY_RPC_URL_ARBITRUM = originalRelayArbitrum;
  }
  if (originalRelayBnb === undefined) {
    delete process.env.PRIVATE_RELAY_RPC_URL_BNB;
  } else {
    process.env.PRIVATE_RELAY_RPC_URL_BNB = originalRelayBnb;
  }
  if (originalRelayBase === undefined) {
    delete process.env.PRIVATE_RELAY_RPC_URL_BASE;
  } else {
    process.env.PRIVATE_RELAY_RPC_URL_BASE = originalRelayBase;
  }
  if (originalRequiredChains === undefined) {
    delete process.env.RELAY_REQUIRED_CHAINS;
  } else {
    process.env.RELAY_REQUIRED_CHAINS = originalRequiredChains;
  }
}
