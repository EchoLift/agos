import { apiClient } from '../api-client';

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
  status: 'ACTIVE' | 'INACTIVE';
  joinedAt: string;
  version: number;
  name: string | null;
  email: string | null;
  mobileNumber: string | null;
  avatarUrl: string | null;
}

export interface InviteMemberParams {
  email: string;
  mobileNumber?: string;
  roleId: string;
  roleIds?: string[];
}

export async function getRoles(agencyId: string): Promise<Role[]> {
  return apiClient<Role[]>('/organizations/roles', {
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
  params: InviteMemberParams
): Promise<{ invitationId: string; status: string }> {
  return apiClient<{ invitationId: string; status: string }>(`/organizations/${agencyId}/invitations`, {
    method: 'POST',
    agencyId,
    body: JSON.stringify(params),
  });
}

export async function updateMemberRole(
  agencyId: string,
  membershipId: string,
  params: { roleId: string; roleIds?: string[]; version: number }
): Promise<Member> {
  return apiClient<Member>(`/organizations/${agencyId}/members/${membershipId}/role`, {
    method: 'PATCH',
    agencyId,
    body: JSON.stringify(params),
  });
}

export async function removeMember(
  agencyId: string,
  membershipId: string,
  version: number
): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(`/organizations/${agencyId}/members/${membershipId}?version=${version}`, {
    method: 'DELETE',
    agencyId,
  });
}
