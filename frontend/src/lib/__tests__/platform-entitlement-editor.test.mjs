import assert from "node:assert";
import { SUBSCRIPTION_STATUSES } from "../subscription-status.ts";
import {
  entitlementActionPayload,
  entitlementActions,
  entitlementEditorValues,
  entitlementPatchPayload,
  invalidatePlatformEntitlementQueries,
  runConfirmedEntitlementAction,
  validateEntitlementEditor,
  validateReactivation,
} from "../platform-entitlement-editor.ts";

const now = new Date("2026-09-02T12:00:00.000Z");
const expiredTrial = "2026-09-01T12:00";

assert.ok(SUBSCRIPTION_STATUSES.includes("CANCELLED"));

const cancelled = {
  status: "CANCELLED",
  plan: "PILOT",
  trialEndsAt: expiredTrial,
  startsAt: "2026-06-01T00:00:00.000Z",
  endsAt: "",
};
assert.strictEqual(validateEntitlementEditor(cancelled, now), null);
assert.deepStrictEqual(entitlementPatchPayload(cancelled), {
  status: "CANCELLED",
  plan: "PILOT",
  trialEndsAt: new Date(expiredTrial).toISOString(),
  startsAt: "2026-06-01T00:00:00.000Z",
  endsAt: null,
});

assert.match(
  validateEntitlementEditor({ ...cancelled, status: "TRIAL" }, now) ?? "",
  /future/,
);
assert.strictEqual(
  validateEntitlementEditor({ ...cancelled, status: "SUSPENDED" }, now),
  null,
);
assert.strictEqual(
  validateEntitlementEditor({ ...cancelled, status: "CANCELLED" }, now),
  null,
);

const existing = entitlementEditorValues({
  id: "sub-1",
  agencyId: "agency-1",
  status: "TRIAL",
  plan: "PILOT",
  trialEndsAt: "2026-09-01T12:00:00.000Z",
  startsAt: "2026-06-01T00:00:00.000Z",
  endsAt: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  version: 1,
});
assert.strictEqual(
  validateEntitlementEditor({ ...existing, status: "SUSPENDED" }, now),
  null,
);
assert.strictEqual(
  validateEntitlementEditor({ ...existing, status: "CANCELLED" }, now),
  null,
);

assert.deepStrictEqual(entitlementActions("TRIAL"), ["SUSPEND", "CANCEL"]);
assert.deepStrictEqual(entitlementActions("ACTIVE"), ["SUSPEND", "CANCEL"]);
assert.deepStrictEqual(entitlementActions("SUSPENDED"), [
  "REACTIVATE",
  "CANCEL",
]);
assert.deepStrictEqual(entitlementActions("CANCELLED"), ["REACTIVATE"]);

let sentPayload = null;
const mutate = async (payload) => {
  sentPayload = payload;
  return payload;
};
await runConfirmedEntitlementAction({
  confirmed: false,
  payload: entitlementActionPayload(
    { ...existing, status: "TRIAL" },
    "CANCELLED",
  ),
  mutate,
});
assert.strictEqual(sentPayload, null, "cancel must not PATCH without confirmation");
await runConfirmedEntitlementAction({
  confirmed: true,
  payload: entitlementActionPayload(
    { ...existing, status: "TRIAL" },
    "CANCELLED",
  ),
  mutate,
});
assert.strictEqual(sentPayload.status, "CANCELLED");

const suspendedPayload = entitlementActionPayload(
  { ...existing, status: "ACTIVE" },
  "SUSPENDED",
);
assert.strictEqual(suspendedPayload.status, "SUSPENDED");
assert.strictEqual(suspendedPayload.startsAt, existing.startsAt);
assert.strictEqual(
  suspendedPayload.trialEndsAt,
  new Date(existing.trialEndsAt).toISOString(),
);

assert.match(
  validateReactivation(
    { ...existing, status: "TRIAL", trialEndsAt: expiredTrial },
    now,
  ) ?? "",
  /future/,
);
assert.strictEqual(
  validateReactivation(
    { ...existing, status: "ACTIVE", endsAt: "" },
    now,
  ),
  null,
);
assert.match(
  validateReactivation(
    { ...existing, status: "ACTIVE", endsAt: expiredTrial },
    now,
  ) ?? "",
  /future/,
);

const invalidated = [];
await invalidatePlatformEntitlementQueries("agency-1", async (queryKey) => {
  invalidated.push(queryKey);
});
assert.deepStrictEqual(invalidated, [
  ["platform-admin", "agency", "agency-1"],
  ["platform-admin", "overview"],
  ["platform-admin", "agencies"],
]);

console.log("✓ Platform entitlement editor assertions passed.");
