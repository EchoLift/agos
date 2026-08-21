import assert from "node:assert";
import {
  allowedNavKeys,
  canAccessWorkspacePath,
  visibleWorkspaceNavItems,
} from "../workspace-access.ts";
import type { Agency } from "../api/organization.ts";

console.log("Running client-analytics-navigation unit assertions...");

const clientAgency: Agency = {
  id: "agency-1",
  name: "Acme Agency",
  displayName: "Acme Agency",
  slug: "acme",
  role: "CLIENT",
  roles: [{ id: "r1", key: "CLIENT", name: "Client" }],
  clientId: "client-abc-123",
  client: {
    id: "client-abc-123",
    name: "50-Brains",
    displayName: "50-Brains",
  },
};

const ownerAgency: Agency = {
  id: "agency-1",
  name: "Acme Agency",
  displayName: "Acme Agency",
  slug: "acme",
  role: "OWNER",
  roles: [{ id: "r2", key: "OWNER", name: "Owner" }],
};

const adminAgency: Agency = {
  id: "agency-1",
  name: "Acme Agency",
  displayName: "Acme Agency",
  slug: "acme",
  role: "ADMIN",
  roles: [{ id: "r3", key: "ADMIN", name: "Admin" }],
};

// 1. CLIENT role navigation keys include files, dashboard, campaigns, calendar
const clientKeys = allowedNavKeys(clientAgency);
assert.strictEqual(clientKeys.has("files"), true);
assert.strictEqual(clientKeys.has("dashboard"), true);
assert.strictEqual(clientKeys.has("campaigns"), true);
assert.strictEqual(clientKeys.has("calendar"), true);
assert.strictEqual(clientKeys.has("clients"), false);
assert.strictEqual(clientKeys.has("team"), false);
assert.strictEqual(clientKeys.has("workflow"), false);
assert.strictEqual(clientKeys.has("gigs"), false);

// 2. Visible navigation items for CLIENT are ordered: Dashboard -> Campaigns -> Files -> Calendar
const clientNav = visibleWorkspaceNavItems(clientAgency, "acme");
const clientNavKeys = clientNav.map((n) => n.key);
assert.deepStrictEqual(clientNavKeys, [
  "dashboard",
  "campaigns",
  "files",
  "calendar",
]);

// 3. Agency staff roles do NOT get the top-level files nav item (they have "clients")
const ownerKeys = allowedNavKeys(ownerAgency);
assert.strictEqual(ownerKeys.has("files"), false);
assert.strictEqual(ownerKeys.has("clients"), true);

const adminKeys = allowedNavKeys(adminAgency);
assert.strictEqual(adminKeys.has("files"), false);
assert.strictEqual(adminKeys.has("clients"), true);

const ownerNav = visibleWorkspaceNavItems(ownerAgency, "acme");
assert.strictEqual(
  ownerNav.some((n) => n.key === "files"),
  false,
);

// 4. Path authorization: /files is allowed for CLIENT role
assert.strictEqual(
  canAccessWorkspacePath("/acme/files", clientAgency, "acme"),
  true,
);

// 5. Path authorization: /clients is NOT allowed for CLIENT role
assert.strictEqual(
  canAccessWorkspacePath("/acme/clients", clientAgency, "acme"),
  false,
);

// 6. Path authorization: /team is NOT allowed for CLIENT role
assert.strictEqual(
  canAccessWorkspacePath("/acme/team", clientAgency, "acme"),
  false,
);

// 7. Path authorization: /gigs is NOT allowed for CLIENT role
assert.strictEqual(
  canAccessWorkspacePath("/acme/gigs", clientAgency, "acme"),
  false,
);

console.log(
  "✓ All client-analytics-navigation assertions passed successfully.",
);
