import assert from "node:assert";
import { resolveDashboardAgency } from "../dashboard-navigation.ts";
import type { Agency, MyMembershipsResponse } from "../api/organization.ts";

console.log("Running dashboard-navigation unit assertions...");

const socia = agency("agency-socia", "socia-expert");
const infinitum = agency("agency-infinitum", "infinitum-media");
const revoked = agency("agency-revoked", "revoked-agency");

assert.strictEqual(
  resolveDashboardAgency(memberships({ agencies: [] })),
  null,
);

assert.strictEqual(
  resolveDashboardAgency(memberships({ agencies: [socia] }))?.slug,
  "socia-expert",
);

assert.strictEqual(
  resolveDashboardAgency(
    memberships({
      activeAgencyId: "agency-infinitum",
      currentAgency: infinitum,
      agencies: [socia, infinitum],
    }),
  )?.slug,
  "infinitum-media",
);

assert.strictEqual(
  resolveDashboardAgency(
    memberships({
      activeAgencyId: "agency-infinitum",
      currentAgency: infinitum,
      agencies: [socia, infinitum],
    }),
    "agency-socia",
  )?.slug,
  "socia-expert",
);

assert.strictEqual(
  resolveDashboardAgency(
    memberships({
      activeAgencyId: "agency-revoked",
      currentAgency: revoked,
      agencies: [socia],
    }),
  )?.slug,
  "socia-expert",
);

assert.strictEqual(
  resolveDashboardAgency(
    memberships({
      currentAgency: infinitum,
      agencies: [socia, infinitum],
    }),
  )?.slug,
  "infinitum-media",
);

assert.strictEqual(
  resolveDashboardAgency(
    memberships({
      currentAgency: revoked,
      agencies: [socia, infinitum],
    }),
  )?.slug,
  "socia-expert",
);

console.log("✓ All dashboard-navigation assertions passed successfully.");

function memberships({
  activeAgencyId = null,
  agencies,
  currentAgency = null,
}: {
  activeAgencyId?: string | null;
  agencies: Agency[];
  currentAgency?: Agency | null;
}): MyMembershipsResponse {
  return {
    activeAgencyId,
    agencies,
    currentAgency,
  };
}

function agency(id: string, slug: string): Agency {
  return {
    id,
    slug,
    name: slug,
    displayName: slug,
  };
}
