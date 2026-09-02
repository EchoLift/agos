import { apiClient } from "../api-client";
export {
  SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
} from "../subscription-status";
import type { SubscriptionStatus } from "../subscription-status";

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
  clientId?: string | null;
  client?: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  clientAccess?: Array<{
    clientId: string;
    clientName: string | null;
    isPrimaryContact?: boolean;
    primaryContactUserId?: string | null;
    primaryContactName?: string | null;
  }>;
  entitlement?: AgencyEntitlement;
}

export interface AgencyEntitlement {
  allowed: boolean;
  status: SubscriptionStatus | null;
  plan: string | null;
  trialEndsAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  reason: string | null;
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
  clientId?: string | null;
  clientIds?: string[];
  clientAccess?: Array<{
    clientId: string;
    clientName: string | null;
    isPrimaryContact?: boolean;
    primaryContactUserId?: string | null;
    primaryContactName?: string | null;
  }>;
  agency: Agency;
}

export async function createAgency(
  displayName: string,
  slug: string,
): Promise<CreateAgencyResponse> {
  return apiClient<CreateAgencyResponse>("/organizations/agencies", {
    method: "POST",
    body: JSON.stringify({ displayName, slug }),
  });
}

export async function acceptInvitation(
  token: string,
): Promise<AcceptInvitationResponse> {
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

export async function activateAgency(
  agencyId: string,
): Promise<ActivateAgencyResponse> {
  return apiClient<ActivateAgencyResponse>(
    `/organizations/${agencyId}/activate`,
    {
      method: "POST",
      agencyId,
    },
  );
}
