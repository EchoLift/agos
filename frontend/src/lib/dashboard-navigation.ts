import type { Agency, MyMembershipsResponse } from "@/lib/api/organization";

export function resolveDashboardAgency(
  memberships: MyMembershipsResponse,
  preferredAgencyId?: string | null,
): Agency | null {
  const activeAgencies = memberships.agencies;
  if (activeAgencies.length === 0) return null;

  if (preferredAgencyId) {
    const preferredAgency = activeAgencies.find(
      (agency) => agency.id === preferredAgencyId,
    );
    if (preferredAgency) return preferredAgency;
  }

  if (memberships.activeAgencyId) {
    const activeAgency = activeAgencies.find(
      (agency) => agency.id === memberships.activeAgencyId,
    );
    if (activeAgency) return activeAgency;
  }

  if (memberships.currentAgency) {
    const currentAgency = activeAgencies.find(
      (agency) => agency.id === memberships.currentAgency?.id,
    );
    if (currentAgency) return currentAgency;
  }

  return activeAgencies[0] ?? null;
}
