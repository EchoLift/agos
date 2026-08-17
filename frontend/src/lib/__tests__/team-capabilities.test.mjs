import assert from "node:assert";
import { getTeamCapabilities } from "../team-capabilities.ts";

console.log("Running team-capabilities unit assertions...");

function agencyWithRoles(roleKeys) {
  return {
    id: "agency-1",
    name: "Socia Expert",
    displayName: "Socia Expert",
    slug: "socia-expert",
    role: roleKeys[0],
    roles: roleKeys.map((roleKey) => ({
      id: `role-${roleKey}`,
      key: roleKey,
      name: roleKey,
    })),
  };
}

for (const role of [
  "WRITER",
  "DOP",
  "EDITOR",
  "DESIGNER",
  "SOCIAL_MEDIA_MANAGER",
  "MEMBER",
  "HR",
]) {
  const capabilities = getTeamCapabilities(agencyWithRoles([role]));
  assert.strictEqual(capabilities.canInviteMembers, false, role);
  assert.strictEqual(capabilities.canManageInvitations, false, role);
  assert.strictEqual(capabilities.canChangeRoles, false, role);
  assert.strictEqual(capabilities.canRemoveMembers, false, role);
  assert.strictEqual(capabilities.hasManagementAccess, false, role);
}

const client = getTeamCapabilities(agencyWithRoles(["CLIENT"]));
assert.strictEqual(client.hasManagementAccess, false);

const owner = getTeamCapabilities(agencyWithRoles(["OWNER"]));
assert.strictEqual(owner.canInviteMembers, true);
assert.strictEqual(owner.canManageInvitations, true);
assert.strictEqual(owner.canChangeRoles, true);
assert.strictEqual(owner.canRemoveMembers, true);

const admin = getTeamCapabilities(agencyWithRoles(["ADMIN"]));
assert.strictEqual(admin.canInviteMembers, true);
assert.strictEqual(admin.canManageInvitations, true);
assert.strictEqual(admin.canChangeRoles, false);
assert.strictEqual(admin.canRemoveMembers, false);

const manager = getTeamCapabilities(agencyWithRoles(["MANAGER"]));
assert.strictEqual(manager.canInviteMembers, true);
assert.strictEqual(manager.canManageInvitations, false);
assert.strictEqual(manager.canChangeRoles, true);
assert.strictEqual(manager.canRemoveMembers, false);

console.log("✓ All team-capabilities assertions passed successfully.");
