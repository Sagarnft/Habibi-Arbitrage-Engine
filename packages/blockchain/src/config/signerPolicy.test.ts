import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSignerPolicy } from "./signerPolicy.js";

test("blocks server-key mode in production", () => {
  const result = evaluateSignerPolicy({
    NODE_ENV: "production",
    EXECUTION_SIGNER_MODE: "server-key",
    EXECUTION_SIGNER_PRIVATE_KEY: "0xabc",
    EXECUTION_SIGNER_ALLOW_SERVER_KEY_IN_PRODUCTION: "true",
  });
  assert.equal(result.ready, false);
  assert.equal(result.mode, "server-key");
  assert.equal(result.reason.includes("blocked in production"), true);
});

test("allows kms mode only when key id is configured", () => {
  const missing = evaluateSignerPolicy({
    EXECUTION_SIGNER_MODE: "kms",
  });
  assert.equal(missing.ready, false);

  const configured = evaluateSignerPolicy({
    EXECUTION_SIGNER_MODE: "kms",
    EXECUTION_SIGNER_KMS_KEY_ID: "kms-key-1",
  });
  assert.equal(configured.ready, true);
});

test("defaults to external wallet mode", () => {
  const result = evaluateSignerPolicy({});
  assert.equal(result.mode, "wallet-external");
  assert.equal(result.ready, true);
});
