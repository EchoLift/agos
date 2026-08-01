import { apiClient } from "../api-client";

export interface Agency {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  role?: string;
  roles?: Array<{
    id: string;
    key: string;
    name: string;
  }>;
  membershipId?: string;
}

export interface MyMembershipsResponse {
  activeAgencyId: string | null;
  currentAgency: Agency | null;
  agencies: Agency[];
}

export interface CreateAgencyResponse {
  agency: Agency;
  membership: {
    id: string;
    role: string;
    roles?: string[];
  };
}

export async function createAgency(displayName: string, slug: string): Promise<CreateAgencyResponse> {
  return apiClient<CreateAgencyResponse>("/organizations/agencies", {
    method: "POST",
    body: JSON.stringify({ displayName, slug }),
  });
}

export async function getMyMemberships(): Promise<MyMembershipsResponse> {
  return apiClient<MyMembershipsResponse>("/organizations/me", {
    method: "GET",
  });
}

export async function activateAgency(agencyId: string): Promise<{ activeAgencyId: string; agency: Agency }> {
  return apiClient<{ activeAgencyId: string; agency: Agency }>(`/organizations/${agencyId}/activate`, {
    method: "POST",
    agencyId,
  });
}
