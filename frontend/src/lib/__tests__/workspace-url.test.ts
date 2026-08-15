import assert from "node:assert";
import {
  parseSubdomainFromHost,
  isReservedSubdomain,
  getCentralAppHref,
  getHelpHref,
  getWorkspaceUrl,
} from "../workspace-url";

console.log("Running workspace-url unit assertions...");

// 1. parseSubdomainFromHost
process.env.NEXT_PUBLIC_ROOT_DOMAIN = "agencie.in";

assert.strictEqual(
  parseSubdomainFromHost("socia-expert.agencie.in"),
  "socia-expert",
);

assert.strictEqual(
  parseSubdomainFromHost("pixel-creative.agencie.in"),
  "pixel-creative",
);

assert.strictEqual(
  parseSubdomainFromHost("agency-b.agencie.in:443"),
  "agency-b",
);

assert.strictEqual(
  parseSubdomainFromHost("www.agencie.in"),
  null,
);

assert.strictEqual(
  parseSubdomainFromHost("api.agencie.in"),
  null,
);

assert.strictEqual(
  parseSubdomainFromHost("app.agencie.in"),
  null,
);

assert.strictEqual(
  parseSubdomainFromHost("help.agencie.in"),
  null,
);

assert.strictEqual(parseSubdomainFromHost("localhost:3000"), null);
assert.strictEqual(parseSubdomainFromHost("127.0.0.1:3000"), null);
assert.strictEqual(parseSubdomainFromHost("agencie.in"), null);

// 2. isReservedSubdomain
assert.strictEqual(isReservedSubdomain("www"), true);
assert.strictEqual(isReservedSubdomain("API"), true);
assert.strictEqual(isReservedSubdomain("app"), true);
assert.strictEqual(isReservedSubdomain("socia-expert"), false);

// 3. getWorkspaceUrl
(process.env as Record<string, string | undefined>).NODE_ENV =
  "development";

assert.strictEqual(
  getWorkspaceUrl("socia-expert", "campaigns"),
  "http://localhost:3000/socia-expert/campaigns",
);

assert.strictEqual(getCentralAppHref("/help/team-access/roles"), "/help/team-access/roles");
assert.strictEqual(getHelpHref("campaigns/campaign-planning"), "/help/campaigns/campaign-planning");

(process.env as Record<string, string | undefined>).NODE_ENV =
  "production";

process.env.NEXT_PUBLIC_ROOT_DOMAIN = "agencie.in";

assert.strictEqual(
  getWorkspaceUrl("socia-expert", "campaigns"),
  "https://socia-expert.agencie.in/campaigns",
);

assert.strictEqual(
  getCentralAppHref("/help/team-access/roles"),
  "https://app.agencie.in/help/team-access/roles",
);

assert.strictEqual(
  getHelpHref("campaigns/campaign-planning"),
  "https://app.agencie.in/help/campaigns/campaign-planning",
);

console.log("✓ All workspace-url assertions passed successfully.");
