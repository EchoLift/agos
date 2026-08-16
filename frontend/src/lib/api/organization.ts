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

export interface AcceptInvitationResponse {
  membershipId: string;
  agencyId: string;
  status: string;
  agency: Agency;
}

export async function createAgency(displayName: string, slug: string): Promise<CreateAgencyResponse> {
  return apiClient<CreateAgencyResponse>("/organizations/agencies", {
    method: "POST",
    body: JSON.stringify({ displayName, slug }),
  });
}

export async function acceptInvitation(token: string): Promise<AcceptInvitationResponse> {
  return apiClient<AcceptInvitationResponse>(
    `/organizations/invitations/${encodeURIComponent(token)}/accept`,
    {
      method: "POST",
    },
  );
}

export async function getMyMemberships(): Promise<MyMembershipsResponse> {
  return apiClient<MyMembershipsResponse>("/organizations/me", {
    method: "GET",
  });
}

export interface ActivateAgencyResponse {
  activeAgencyId: string;
  agency: Agency;
}

export async function activateAgency(agencyId: string): Promise<ActivateAgencyResponse> {
  return apiClient<ActivateAgencyResponse>(`/organizations/${agencyId}/activate`, {
    method: "POST",
    agencyId,
  });
}
