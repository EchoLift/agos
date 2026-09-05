import assert from "node:assert";
import {
  billingExpiryWarning,
  expiryWarning,
  hasBillingRole,
} from "../billing-ui.ts";
const agency = (role, roles = [], end = "2026-09-10T00:00:00Z") => ({
  role,
  roles: roles.map((key) => ({ key })),
  entitlement: { status: "ACTIVE", endsAt: end },
});
assert.strictEqual(hasBillingRole(agency("OWNER")), true);
assert.strictEqual(hasBillingRole(agency("FINANCE")), true);
assert.strictEqual(hasBillingRole(agency("MANAGER")), false);
assert.strictEqual(hasBillingRole(agency("ADMIN")), false);
assert.strictEqual(
  billingExpiryWarning(
    agency("MANAGER", [], "2026-09-06T00:00:00Z"),
    new Date("2026-09-05T00:00:00Z"),
  ),
  null,
);
assert.strictEqual(
  billingExpiryWarning(
    agency("OWNER", [], "2026-09-06T00:00:00Z"),
    new Date("2026-09-05T00:00:00Z"),
  ),
  "Your AGENCIE access expires tomorrow.",
);
assert.strictEqual(
  expiryWarning(
    agency("OWNER", [], "2026-09-10T00:00:00Z"),
    new Date("2026-09-05T00:00:00Z"),
  ),
  "Your AGENCIE access expires in 5 days.",
);
assert.strictEqual(
  expiryWarning(
    agency("OWNER", [], "2026-09-06T00:00:00Z"),
    new Date("2026-09-05T00:00:00Z"),
  ),
  "Your AGENCIE access expires tomorrow.",
);
assert.strictEqual(
  expiryWarning(
    agency("OWNER", [], "2026-09-05T12:00:00Z"),
    new Date("2026-09-05T00:00:00Z"),
  ),
  "Your AGENCIE access expires today.",
);
console.log("✓ Billing UI assertions passed.");
