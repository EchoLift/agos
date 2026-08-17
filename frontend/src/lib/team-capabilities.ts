import type { Agency } from "./api/organization";

const inviteRoles = ["OWNER", "ADMIN", "MANAGER"];
const invitationManagerRoles = ["OWNER", "ADMIN"];
const roleManagerRoles = ["OWNER", "MANAGER"];
const removeRoles = ["OWNER"];

export type TeamCapabilities = {
  canInviteMembers: boolean;
  canManageInvitations: boolean;
  canChangeRoles: boolean;
  canRemoveMembers: boolean;
  hasManagementAccess: boolean;
};

export function getTeamCapabilities(
  agency: Agency | null | undefined,
): TeamCapabilities {
  const roleKeys = getTeamRoleKeys(agency);

  const canInviteMembers = hasAnyRoleKey(roleKeys, inviteRoles);
  const canManageInvitations = hasAnyRoleKey(roleKeys, invitationManagerRoles);
  const canChangeRoles = hasAnyRoleKey(roleKeys, roleManagerRoles);
  const canRemoveMembers = hasAnyRoleKey(roleKeys, removeRoles);

  return {
    canInviteMembers,
    canManageInvitations,
    canChangeRoles,
    canRemoveMembers,
    hasManagementAccess:
      canInviteMembers ||
      canManageInvitations ||
      canChangeRoles ||
      canRemoveMembers,
  };
}

function hasAnyRoleKey(roleKeys: string[], allowed: string[]) {
  return roleKeys.some((roleKey) => allowed.includes(roleKey));
}

function getTeamRoleKeys(agency: Agency | null | undefined) {
  return [
    agency?.role,
    ...(agency?.roles?.flatMap((role) => [role.key, role.name]) ?? []),
  ]
    .filter((role): role is string => Boolean(role))
    .map((role) => role.toUpperCase().replace(/[\s-]+/g, "_"));
}
