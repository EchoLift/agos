"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getMembers, getRoles, Member, removeMember, Role, updateMemberRole } from "@/lib/api/team";
import { useAgency } from "@/components/AgencyProvider";
import { statusPillClasses } from "@/lib/status-style";
import { roleAccessLabels } from "@/lib/workspace-access";

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [filters, setFilters] = useState({ search: "", roleId: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    member: Member;
    selectedRoleIds: string[];
    blockedReason?: string;
  } | null>(null);
  const { agency, agencyId, agencySlug } = useAgency();
  const activeOwnerCount = members.filter((member) => memberHasRole(member, "OWNER")).length;
  const currentRoleKeys = agency?.roles?.map((role) => role.key) ?? [];
  const canChangeRoles = currentRoleKeys.includes("OWNER") || currentRoleKeys.includes("MANAGER") || agency?.role === "OWNER" || agency?.role === "MANAGER";
  const isManagerOnly = !currentRoleKeys.includes("OWNER") && agency?.role !== "OWNER" && (currentRoleKeys.includes("MANAGER") || agency?.role === "MANAGER");
  const canUseSelfRoleTestingOverride = (member: Member) => member.id === agency?.membershipId;

  const loadTeam = (options: { showLoading?: boolean } = {}) => {
    if (!agencyId) return;

    if (options.showLoading) {
      setLoading(true);
    }
    Promise.all([getMembers(agencyId), getRoles(agencyId)])
      .then(([memberData, roleData]) => {
        setMembers(memberData);
        setRoles(roleData);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load team.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!agencyId) return;
    let isMounted = true;

    Promise.all([getMembers(agencyId), getRoles(agencyId)])
      .then(([memberData, roleData]) => {
        if (!isMounted) return;
        setMembers(memberData);
        setRoles(roleData);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load team.");
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [agencyId]);

  const selectedRoles = pendingRoleChange
    ? roles.filter((role) => pendingRoleChange.selectedRoleIds.includes(role.id))
    : [];
  const filteredMembers = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesSearch = !search || [member.name, member.email, member.mobileNumber].some((value) => value?.toLowerCase().includes(search));
      const matchesRole = !filters.roleId || member.roles?.some((role) => role.id === filters.roleId) || member.roleId === filters.roleId;
      const matchesStatus = !filters.status || member.status === filters.status;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [filters, members]);

  const requestRoleChange = (member: Member) => {
    const selectedRoleIds = member.roles?.length ? member.roles.map((role) => role.id) : [member.roleId];

    const selfRoleTestingOverride = canUseSelfRoleTestingOverride(member);

    if (!canChangeRoles && !selfRoleTestingOverride) {
      setPendingRoleChange({
        member,
        selectedRoleIds,
        blockedReason: "Only Owners and Managers can change roles.",
      });
      return;
    }

    const isSelfChangeByManager = isManagerOnly && member.id === agency?.membershipId && !selfRoleTestingOverride;
    const isOwnerTargetByManager = isManagerOnly && memberHasRole(member, "OWNER") && !selfRoleTestingOverride;

    setPendingRoleChange({
      member,
      selectedRoleIds,
      blockedReason:
        (isSelfChangeByManager && "Managers cannot change their own role.") ||
        (isOwnerTargetByManager && "Managers cannot change an Owner role.") ||
        undefined,
    });
  };

  const togglePendingRole = (roleId: string) => {
    setPendingRoleChange((current) => {
      if (!current || current.blockedReason) return current;
      const next = new Set(current.selectedRoleIds);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }

      return {
        ...current,
        selectedRoleIds: Array.from(next),
      };
    });
  };

  const confirmRoleChange = async () => {
    if (!agencyId || !pendingRoleChange) return;
    if (pendingRoleChange.blockedReason) {
      setPendingRoleChange(null);
      return;
    }

    const { member, selectedRoleIds } = pendingRoleChange;
    if (selectedRoleIds.length === 0) {
      setError("Select at least one role.");
      return;
    }

    const primaryRole = roles.find((role) => selectedRoleIds.includes(role.id));
    if (!primaryRole) {
      setError("Select a valid role.");
      return;
    }

    const assignsOwner = selectedRoles.some((role) => role.key === "OWNER");
    const isOwnerDemotion = memberHasRole(member, "OWNER") && !assignsOwner;
    const selfRoleTestingOverride = canUseSelfRoleTestingOverride(member);
    const isOwnerAssignmentByManager = isManagerOnly && assignsOwner && !selfRoleTestingOverride;

    if (isOwnerAssignmentByManager) {
      setError("Managers cannot assign the Owner role.");
      return;
    }

    if (isOwnerDemotion && activeOwnerCount <= 1 && !selfRoleTestingOverride) {
      setError("This member is the last Owner. Add or promote another Owner before changing this role.");
      return;
    }

    setBusyMemberId(member.id);
    setError(null);
    try {
      const updated = await updateMemberRole(agencyId, member.id, {
        roleId: primaryRole.id,
        roleIds: selectedRoleIds,
        version: member.version,
      });
      setMembers((current) => current.map((item) => (item.id === member.id ? updated : item)));
      setPendingRoleChange(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change role.");
      loadTeam();
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRemove = async (member: Member) => {
    if (!agencyId) return;

    const memberName = member.name || member.email || member.mobileNumber || "this member";
    const agencyName = agency?.displayName || agency?.name || "this agency";
    const confirmed = window.confirm(`Remove ${memberName} from ${agencyName}?`);
    if (!confirmed) return;

    setBusyMemberId(member.id);
    setError(null);
    try {
      await removeMember(agencyId, member.id, member.version);
      setMembers((current) => current.filter((item) => item.id !== member.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove member.");
      loadTeam();
    } finally {
      setBusyMemberId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Team</h1>
          <p className="mt-2 text-sm text-zinc-400">Manage your agency members and roles.</p>
          <Link href="/help/team-access/roles" className="mt-2 inline-flex text-sm font-medium text-indigo-300 hover:text-indigo-200">
            Roles and workspace access
          </Link>
        </div>
        <Link
          href={`/${agencySlug}/team/new`}
          className="rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          Invite Member
        </Link>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-2xl shadow-black/20">
        <div className="grid gap-3 md:grid-cols-4">
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search name, email, mobile" className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 md:col-span-2" />
          <select value={filters.roleId} onChange={(event) => setFilters((current) => ({ ...current, roleId: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500">
            <option value="">All roles</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.displayName}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500">
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl shadow-black/20">
        {error ? (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-zinc-400">Loading team...</div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-zinc-900 p-4">
              <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-white">No team members</h3>
            <p className="mt-1 text-sm text-zinc-500">Get started by inviting your team.</p>
            <Link
              href={`/${agencySlug}/team/new`}
              className="mt-6 rounded-full bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-400 hover:bg-indigo-500/20"
            >
              Invite Member
            </Link>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">No team members match these filters.</div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="border-b border-zinc-800/50 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="pb-4 font-medium">Name / Email</th>
                  <th className="pb-4 font-medium">Role</th>
                  <th className="pb-4 font-medium">Status</th>
                  <th className="pb-4 font-medium">Joined</th>
                  <th className="pb-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="transition-colors hover:bg-zinc-900/30">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 overflow-hidden rounded-full bg-zinc-800 flex items-center justify-center">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-medium text-zinc-400">
                              {(member.name || member.email || "?").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-zinc-200">{member.name || "Unknown"}</div>
                          <div className="max-w-xl truncate text-xs text-zinc-500">{member.email || member.mobileNumber || "No contact"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex max-w-xs flex-wrap gap-1.5">
                        {(member.roles?.length ? member.roles : [{ id: member.roleId, name: member.roleName, key: member.roleName.toUpperCase() }]).map((role) => (
                          <span
                            key={role.id}
                            className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200"
                          >
                            {role.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={statusPillClasses(member.status, "sm")}>
                        {member.status}
                      </span>
                    </td>
                    <td className="py-4">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={busyMemberId === member.id || (!canChangeRoles && !canUseSelfRoleTestingOverride(member))}
                          onClick={() => requestRoleChange(member)}
                          className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Edit roles
                        </button>
                        <button
                          type="button"
                          disabled={busyMemberId === member.id}
                          onClick={() => handleRemove(member)}
                          className="rounded-full border border-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingRoleChange ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
            <h2 className="text-lg font-semibold text-white">
              {pendingRoleChange.blockedReason ? "Cannot change roles" : "Edit roles"}
            </h2>
            {pendingRoleChange.blockedReason ? (
              <p className="mt-3 text-sm leading-6 text-zinc-400">{pendingRoleChange.blockedReason}</p>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-6 text-zinc-400">
                  Select the roles for{" "}
                  <span className="text-zinc-200">
                    {pendingRoleChange.member.name || pendingRoleChange.member.email || "this member"}
                  </span>
                  .
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {roles.map((role) => {
                    const isChecked = pendingRoleChange.selectedRoleIds.includes(role.id);
                    const isOwnerRole = role.key === "OWNER";
                    const disabled = isManagerOnly && isOwnerRole && !canUseSelfRoleTestingOverride(pendingRoleChange.member);
                    const accessLabels = roleAccessLabels(role.key || role.displayName);

                    return (
                      <label
                        key={role.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                          isChecked
                            ? "border-indigo-500/60 bg-indigo-500/10 text-white"
                            : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900"
                        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={disabled}
                          onChange={() => togglePendingRole(role.id)}
                          className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-zinc-950"
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold">{role.displayName}</span>
                          <span className="mt-1 block text-xs leading-5 text-zinc-500">
                            Access: {accessLabels.join(" • ")}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {pendingRoleChange.selectedRoleIds.length === 0 ? (
                  <p className="text-xs text-red-400">Select at least one role.</p>
                ) : null}
                {isManagerOnly ? (
                  <p className="text-xs text-zinc-500">Managers can edit skills, but cannot assign or change Owner access.</p>
                ) : null}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busyMemberId === pendingRoleChange.member.id}
                onClick={() => setPendingRoleChange(null)}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:opacity-60"
              >
                {pendingRoleChange.blockedReason ? "Close" : "Cancel"}
              </button>
              {!pendingRoleChange.blockedReason ? (
                <button
                  type="button"
                  disabled={busyMemberId === pendingRoleChange.member.id || pendingRoleChange.selectedRoleIds.length === 0}
                  onClick={confirmRoleChange}
                  className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
                >
                  {busyMemberId === pendingRoleChange.member.id ? "Saving..." : "Save roles"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function memberHasRole(member: Member, roleName: string) {
  return member.roles?.some((role) => role.name === roleName || role.key === roleName.toUpperCase()) || member.roleName === roleName;
}
