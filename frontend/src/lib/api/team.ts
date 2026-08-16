import { apiClient } from "../api-client";

export interface Role {
  id: string;
  displayName: string;
  description: string | null;
  key?: string;
}

export interface Member {
  id: string;
  userId: string;
  roleId: string;
  roleName: string;
  roles?: Array<{
    id: string;
    key: string;
    name: string;
  }>;
  status: "ACTIVE" | "INACTIVE";
  joinedAt: string;
  version: number;
  name: string | null;
  email: string | null;
  mobileNumber: string | null;
  avatarUrl: string | null;
  clientId?: string | null;
  client?: {
    id: string;
    name: string;
    displayName: string;
  } | null;
}

export interface InviteMemberParams {
  email: string;
  mobileNumber?: string;
  roleId: string;
  roleIds?: string[];
  clientId?: string;
}

export type InvitationStatus =
  "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED" | "DECLINED";

export interface TeamInvitation {
  id: string;
  agencyId: string;
  email: string | null;
  mobileNumber: string | null;
  roleId: string;
  roleName: string | null;
  roles: Array<{
    id: string;
    key?: string;
    name: string;
  }>;
  clientId: string | null;
  client: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  invitedBy: {
    membershipId: string;
    name: string | null;
    email: string | null;
  } | null;
  sentAt: string;
  expiresAt: string;
  lastEmailResentAt: string | null;
  resendAvailableAt: string | null;
  canResendEmail: boolean;
  status: InvitationStatus;
  inviteUrl: string;
}

export async function getRoles(agencyId: string): Promise<Role[]> {
  return apiClient<Role[]>("/organizations/roles", {
    agencyId,
  });
}

export async function getMembers(agencyId: string): Promise<Member[]> {
  return apiClient<Member[]>(`/organizations/${agencyId}/members`, {
    agencyId,
  });
}

export async function inviteMember(
  agencyId: string,
  params: InviteMemberParams,
): Promise<{ invitationId: string; status: string }> {
  return apiClient<{ invitationId: string; status: string }>(
    `/organizations/${agencyId}/invitations`,
    {
      method: "POST",
      agencyId,
      body: JSON.stringify(params),
    },
  );
}

export async function getInvitations(
  agencyId: string,
): Promise<TeamInvitation[]> {
  return apiClient<TeamInvitation[]>(`/organizations/${agencyId}/invitations`, {
    agencyId,
  });
}

export async function resendInvitation(
  agencyId: string,
  invitationId: string,
): Promise<TeamInvitation> {
  return apiClient<TeamInvitation>(
    `/organizations/${agencyId}/invitations/${invitationId}/resend`,
    {
      method: "POST",
      agencyId,
    },
  );
}

export async function revokeInvitation(
  agencyId: string,
  invitationId: string,
): Promise<TeamInvitation> {
  return apiClient<TeamInvitation>(
    `/organizations/${agencyId}/invitations/${invitationId}`,
    {
      method: "DELETE",
      agencyId,
    },
  );
}

export async function updateMemberRole(
  agencyId: string,
  membershipId: string,
  params: {
    roleId: string;
    roleIds?: string[];
    version: number;
    clientId?: string;
  },
): Promise<Member> {
  return apiClient<Member>(
    `/organizations/${agencyId}/members/${membershipId}/role`,
    {
      method: "PATCH",
      agencyId,
      body: JSON.stringify(params),
    },
  );
}

export async function removeMember(
  agencyId: string,
  membershipId: string,
  version: number,
): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(
    `/organizations/${agencyId}/members/${membershipId}?version=${version}`,
    {
      method: "DELETE",
      agencyId,
    },
  );
}
