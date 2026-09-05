import assert from "node:assert/strict";
import { isExecutionApiAuthorized } from "./server.js";

type MockResponse = {
  statusCode?: number;
  payload?: unknown;
  status: (code: number) => MockResponse;
  json: (value: unknown) => MockResponse;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: undefined,
    payload: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      this.payload = value;
      return this;
    },
  };
}

const originalApiKey = process.env.EXECUTION_API_KEY;
const originalUnsafeBypass = process.env.EXECUTION_API_ALLOW_UNSAFE_WITHOUT_KEY;

try {
  delete process.env.EXECUTION_API_KEY;
  delete process.env.EXECUTION_API_ALLOW_UNSAFE_WITHOUT_KEY;
  const unconfiguredRes = createMockResponse();
  const unconfiguredReq = { header: (_name: string) => undefined } as any;
  assert.equal(isExecutionApiAuthorized(unconfiguredReq, unconfiguredRes as any), false);
  assert.equal(unconfiguredRes.statusCode, 503);

  process.env.EXECUTION_API_ALLOW_UNSAFE_WITHOUT_KEY = "true";
  const bypassRes = createMockResponse();
  assert.equal(isExecutionApiAuthorized(unconfiguredReq, bypassRes as any), true);

  process.env.EXECUTION_API_KEY = "secret-key";
  delete process.env.EXECUTION_API_ALLOW_UNSAFE_WITHOUT_KEY;

  const invalidRes = createMockResponse();
  const invalidReq = { header: (name: string) => (name === "x-execution-key" ? "wrong" : undefined) } as any;
  assert.equal(isExecutionApiAuthorized(invalidReq, invalidRes as any), false);
  assert.equal(invalidRes.statusCode, 401);

  const validRes = createMockResponse();
  const validReq = { header: (name: string) => (name === "x-execution-key" ? "secret-key" : undefined) } as any;
  assert.equal(isExecutionApiAuthorized(validReq, validRes as any), true);

  console.log("execution auth regression test passed");
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
}
