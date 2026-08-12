import assert from "node:assert";
import {
  parseSubdomainFromHost,
  isReservedSubdomain,
  getWorkspaceUrl,
} from "../workspace-url";

console.log("Running workspace-url unit assertions...");

// 1. parseSubdomainFromHost
process.env.NEXT_PUBLIC_ROOT_DOMAIN = "client-agos.calcie.fun";
assert.strictEqual(
  parseSubdomainFromHost("socia-expert.client-agos.calcie.fun"),
  "socia-expert",
);
assert.strictEqual(
  parseSubdomainFromHost("pixel-creative.client-agos.calcie.fun"),
  "pixel-creative",
);
assert.strictEqual(
  parseSubdomainFromHost("agency-b.client-agos.calcie.fun:443"),
  "agency-b",
);

assert.strictEqual(
  parseSubdomainFromHost("www.client-agos.calcie.fun"),
  null,
);
assert.strictEqual(
  parseSubdomainFromHost("api.client-agos.calcie.fun"),
  null,
);
assert.strictEqual(
  parseSubdomainFromHost("app.client-agos.calcie.fun"),
  null,
);
assert.strictEqual(
  parseSubdomainFromHost("help.client-agos.calcie.fun"),
  null,
);

assert.strictEqual(parseSubdomainFromHost("localhost:3000"), null);
assert.strictEqual(parseSubdomainFromHost("127.0.0.1:3000"), null);
assert.strictEqual(parseSubdomainFromHost("client-agos.calcie.fun"), null);

// 2. isReservedSubdomain
assert.strictEqual(isReservedSubdomain("www"), true);
assert.strictEqual(isReservedSubdomain("API"), true);
assert.strictEqual(isReservedSubdomain("socia-expert"), false);

// 3. getWorkspaceUrl
(process.env as Record<string, string | undefined>).NODE_ENV = "development";
assert.strictEqual(
  getWorkspaceUrl("socia-expert", "campaigns"),
  "http://localhost:3000/socia-expert/campaigns",
);

(process.env as Record<string, string | undefined>).NODE_ENV = "production";
process.env.NEXT_PUBLIC_ROOT_DOMAIN = "client-agos.calcie.fun";
assert.strictEqual(
  getWorkspaceUrl("socia-expert", "campaigns"),
  "https://socia-expert.client-agos.calcie.fun/campaigns",
);

console.log("✓ All workspace-url assertions passed successfully.");
