"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Member,
  removeMember,
  resendInvitation,
  revokeInvitation,
  TeamInvitation,
  updateMemberRole,
} from "@/lib/api/team";
import { useAgency } from "@/components/AgencyProvider";
import { statusPillClasses } from "@/lib/status-style";
import {
  canUseRoleTestingOverride,
  roleAccessLabels,
} from "@/lib/workspace-access";
import { getHelpHref, getWorkspaceHref } from "@/lib/workspace-url";
import { getTeamCapabilities } from "@/lib/team-capabilities";
import {
  invalidateWorkspaceQueries,
  queryKeys,
  useClientsQuery,
  useInvitationsQuery,
  useProfileQuery,
  useRolesQuery,
  useTeamQuery,
} from "@/lib/query";
import { rememberedTabKey, useRememberedTab } from "@/lib/remembered-tab";

type TeamTab = "members" | "invitations";

const memberTabs: readonly TeamTab[] = ["members"];
const invitationTabs: readonly TeamTab[] = ["members", "invitations"];

export default function TeamPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({
    search: "",
    roleId: "",
    status: "",
  });
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    member: Member;
    selectedRoleIds: string[];
    selectedClientId: string;
    blockedReason?: string;
  } | null>(null);
  const { agency, agencyId, agencySlug } = useAgency();
  const profileQuery = useProfileQuery();
  const teamQuery = useTeamQuery(agencyId);
  const rolesQuery = useRolesQuery(agencyId);
  const clientsQuery = useClientsQuery(agencyId);
  const members = useMemo(() => teamQuery.data ?? [], [teamQuery.data]);
  const roles = rolesQuery.data ?? [];
  const activeClients = useMemo(
    () =>
      (clientsQuery.data ?? []).filter(
        (client) => client.status === "ACTIVE",
      ),
    [clientsQuery.data],
  );
  const loading =
    (teamQuery.isLoading || rolesQuery.isLoading) &&
    !teamQuery.data &&
    !rolesQuery.data;
  const activeOwnerCount = members.filter((member) =>
    memberHasRole(member, "OWNER"),
  ).length;
  const currentRoleKeys = agency?.roles?.map((role) => role.key) ?? [];
  const teamCapabilities = useMemo(
    () => getTeamCapabilities(agency),
    [agency],
  );
  const {
    canInviteMembers,
    canManageInvitations,
    canChangeRoles,
    canRemoveMembers,
    hasManagementAccess,
  } = teamCapabilities;
  const teamTabs = canManageInvitations ? invitationTabs : memberTabs;
  const [activeTab, setActiveTab] = useRememberedTab<TeamTab>({
    defaultTab: "members",
    storageKey: agencyId ? rememberedTabKey("team", agencyId) : null,
    urlTab: searchParams.get("tab"),
    validTabs: teamTabs,
  });
  const invitationsQuery = useInvitationsQuery(agencyId, canManageInvitations);
  const invitations = invitationsQuery.data ?? [];
  const isManagerOnly =
    !currentRoleKeys.includes("OWNER") &&
    agency?.role !== "OWNER" &&
    (currentRoleKeys.includes("MANAGER") || agency?.role === "MANAGER");
  const canUseSelfRoleTestingOverrideForCurrentUser =
    canUseRoleTestingOverride(profileQuery.data?.id);
  const canUseSelfRoleTestingOverride = (member: Member) =>
    canUseSelfRoleTestingOverrideForCurrentUser &&
    member.id === agency?.membershipId;
  const canEditRolesForMember = (member: Member) =>
    canChangeRoles || canUseSelfRoleTestingOverride(member);
  const canShowMemberActions =
    canChangeRoles ||
    canRemoveMembers ||
    canUseSelfRoleTestingOverrideForCurrentUser;
  const safeAgencySlug = agencySlug ?? "";

  const loadTeam = () => {
    if (!agencyId) return;
    invalidateWorkspaceQueries(queryClient, agencyId, ["team", "roles"]);
  };

  const loadInvitations = () => {
    if (!agencyId) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.invitations(agencyId),
    });
  };

  const selectedRoles = pendingRoleChange
    ? roles.filter((role) =>
        pendingRoleChange.selectedRoleIds.includes(role.id),
      )
    : [];
  const roleChangeRequiresClient = selectedRoles.some(
    (role) => role.key === "CLIENT",
  );
  const filteredMembers = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesSearch =
        !search ||
        [member.name, member.email, member.mobileNumber].some((value) =>
          value?.toLowerCase().includes(search),
        );
      const matchesRole =
        !filters.roleId ||
        member.roles?.some((role) => role.id === filters.roleId) ||
        member.roleId === filters.roleId;
      const matchesStatus = !filters.status || member.status === filters.status;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [filters, members]);

  const requestRoleChange = (member: Member) => {
    const selectedRoleIds = member.roles?.length
      ? member.roles.map((role) => role.id)
      : [member.roleId];

    const selfRoleTestingOverride = canUseSelfRoleTestingOverride(member);

    if (!canChangeRoles && !selfRoleTestingOverride) {
      return;
    }

    const isSelfChangeByManager =
      isManagerOnly &&
      member.id === agency?.membershipId &&
      !selfRoleTestingOverride;
    const isOwnerTargetByManager =
      isManagerOnly &&
      memberHasRole(member, "OWNER") &&
      !selfRoleTestingOverride;

    setPendingRoleChange({
      member,
      selectedRoleIds,
      selectedClientId: member.clientId ?? "",
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
      const selectedRoleIds = Array.from(next);
      const nextRequiresClient = roles
        .filter((role) => selectedRoleIds.includes(role.id))
        .some((role) => role.key === "CLIENT");

      return {
        ...current,
        selectedRoleIds,
        selectedClientId: nextRequiresClient ? current.selectedClientId : "",
      };
    });
  };

  const selectPendingClient = (clientId: string) => {
    setPendingRoleChange((current) =>
      current ? { ...current, selectedClientId: clientId } : current,
    );
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
    const isOwnerAssignmentByManager =
      isManagerOnly && assignsOwner && !selfRoleTestingOverride;

    if (isOwnerAssignmentByManager) {
      setError("Managers cannot assign the Owner role.");
      return;
    }

    const assignsClient = selectedRoles.some((role) => role.key === "CLIENT");
    if (assignsClient && !pendingRoleChange.selectedClientId) {
      setError("Select the business client this CLIENT member represents.");
      return;
    }

    if (isOwnerDemotion && activeOwnerCount <= 1 && !selfRoleTestingOverride) {
      setError(
        "This member is the last Owner. Add or promote another Owner before changing this role.",
      );
      return;
    }

    setBusyMemberId(member.id);
    setError(null);
    try {
      const updated = await updateMemberRole(agencyId, member.id, {
        roleId: primaryRole.id,
        roleIds: selectedRoleIds,
        version: member.version,
        clientId: assignsClient
          ? pendingRoleChange.selectedClientId
          : undefined,
      });
      queryClient.setQueryData(
        queryKeys.team(agencyId),
        (current: Member[] | undefined) =>
          current?.map((item) => (item.id === member.id ? updated : item)),
      );
      invalidateWorkspaceQueries(queryClient, agencyId, [
        "team",
        "dashboard",
        "workflow",
        "calendar",
        "campaigns",
        "gigs",
      ]);
      if (updated.id === agency?.membershipId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.memberships() });
      }
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

    const memberName =
      member.name || member.email || member.mobileNumber || "this member";
    const agencyName = agency?.displayName || agency?.name || "this agency";
    const confirmed = window.confirm(
      `Remove ${memberName} from ${agencyName}?`,
    );
    if (!confirmed) return;

    setBusyMemberId(member.id);
    setError(null);
    try {
      await removeMember(agencyId, member.id, member.version);
      queryClient.setQueryData(
        queryKeys.team(agencyId),
        (current: Member[] | undefined) =>
          current?.filter((item) => item.id !== member.id),
      );
      invalidateWorkspaceQueries(queryClient, agencyId, [
        "team",
        "dashboard",
        "workflow",
        "calendar",
        "campaigns",
        "gigs",
      ]);
      if (member.id === agency?.membershipId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.memberships() });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove member.");
      loadTeam();
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleResendInvitation = async (invitation: TeamInvitation) => {
    if (!agencyId) return;
    setBusyInvitationId(invitation.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await resendInvitation(agencyId, invitation.id);
      queryClient.setQueryData(
        queryKeys.invitations(agencyId),
        (current: TeamInvitation[] | undefined) =>
          current?.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice("Invitation resent.");
      invalidateWorkspaceQueries(queryClient, agencyId, ["invitations"]);
    } catch (err: unknown) {
      setError(
        applicationErrorMessage(err, "Unable to resend invitation right now."),
      );
      loadInvitations();
    } finally {
      setBusyInvitationId(null);
    }
  };

  const handleRevokeInvitation = async (invitation: TeamInvitation) => {
    if (!agencyId) return;
    const label = invitation.email || "this invitation";
    if (!window.confirm(`Revoke invitation for ${label}?`)) return;

    setBusyInvitationId(invitation.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await revokeInvitation(agencyId, invitation.id);
      queryClient.setQueryData(
        queryKeys.invitations(agencyId),
        (current: TeamInvitation[] | undefined) =>
          current?.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice("Invitation revoked.");
      invalidateWorkspaceQueries(queryClient, agencyId, ["invitations"]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to revoke invite.");
      loadInvitations();
    } finally {
      setBusyInvitationId(null);
    }
  };

  const shareInvitationLink = async (invitation: TeamInvitation) => {
    if (!canUseInvitationLink(invitation)) return;
    if (typeof navigator.share !== "function") {
      await copyInvitationLink(invitation);
      return;
    }

    try {
      await navigator.share({
        title: "AGENCIE invitation",
        text: `Join ${agency?.displayName || agency?.name || "this agency"} on AGENCIE.`,
        url: invitation.inviteUrl,
      });
      setNotice("Invite shared.");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      await copyInvitationLink(invitation);
    }
  };

  const copyInvitationLink = async (invitation: TeamInvitation) => {
    if (!canUseInvitationLink(invitation)) {
      setError("Only valid pending invitations can be copied.");
      return;
    }

    try {
      await navigator.clipboard.writeText(invitation.inviteUrl);
      setNotice("Invite link copied.");
    } catch {
      setError("Unable to copy invite link.");
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-clip sm:space-y-6 lg:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            Team
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {hasManagementAccess
              ? "Manage your agency members and roles."
              : "View the people working in your agency."}
          </p>
          <Link
            href={getHelpHref("team-access/roles")}
            className="mt-2 inline-flex text-sm font-medium text-indigo-300 hover:text-indigo-200"
          >
            Roles and workspace access
          </Link>
        </div>
        {canInviteMembers ? (
          <Link
            href={getWorkspaceHref(safeAgencySlug, "/team/new")}
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-indigo-500 px-3 text-sm font-semibold text-white hover:bg-indigo-400 sm:px-5"
          >
            Invite Member
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2 shadow-lg shadow-black/20">
        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`min-h-10 rounded-md px-4 text-sm font-semibold transition ${
            activeTab === "members"
              ? "bg-indigo-500 text-white"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          }`}
        >
          Members
        </button>
        {canManageInvitations ? (
          <button
            type="button"
            onClick={() => setActiveTab("invitations")}
            className={`min-h-10 rounded-md px-4 text-sm font-semibold transition ${
              activeTab === "invitations"
                ? "bg-indigo-500 text-white"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            Invitations
          </button>
        ) : null}
      </div>

      {activeTab === "members" ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 shadow-lg shadow-black/20 sm:p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Search name, email, mobile"
              className="min-h-11 min-w-0 rounded-lg border border-zinc-800 bg-[#0b0b11] px-3 text-sm text-white outline-none transition focus:border-indigo-500 md:col-span-2"
            />
            <select
              value={filters.roleId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  roleId: event.target.value,
                }))
              }
              className="min-h-11 min-w-0 rounded-lg border border-zinc-800 bg-[#0b0b11] px-3 text-sm text-white outline-none transition focus:border-indigo-500"
            >
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.displayName}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              className="min-h-11 min-w-0 rounded-lg border border-zinc-800 bg-[#0b0b11] px-3 text-sm text-white outline-none transition focus:border-indigo-500"
            >
              <option value="">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      ) : null}

      <div className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 shadow-lg shadow-black/20 sm:p-4 lg:p-8">
        {error ? (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {notice}
          </div>
        ) : null}

        {activeTab === "invitations" ? (
          <InvitationsPanel
            invitations={invitations}
            isLoading={invitationsQuery.isLoading && !invitations.length}
            error={invitationsQuery.error}
            busyInvitationId={busyInvitationId}
            onResend={handleResendInvitation}
            onShare={shareInvitationLink}
            onRevoke={handleRevokeInvitation}
            onCopy={copyInvitationLink}
          />
        ) : loading ? (
          <div className="text-sm text-zinc-400">Loading team...</div>
        ) : (teamQuery.error || rolesQuery.error) && !members.length ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            Failed to load team.
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-zinc-900 p-4">
              <svg
                className="h-6 w-6 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-white">
              No team members
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {canInviteMembers
                ? "Get started by inviting your team."
                : "No team members are visible yet."}
            </p>
            {canInviteMembers ? (
              <Link
                href={getWorkspaceHref(safeAgencySlug, "/team/new")}
                className="mt-6 rounded-full bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-400 hover:bg-indigo-500/20"
              >
                Invite Member
              </Link>
            ) : null}
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            No team members match these filters.
          </div>
        ) : (
          <>
            <div className="space-y-2 lg:hidden">
              {filteredMembers.map((member) => (
                <article
                  key={member.id}
                  className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-medium text-zinc-400">
                          {(member.name || member.email || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="truncate font-semibold text-zinc-100">
                            {member.name || "Unknown"}
                          </h2>
                          <p className="truncate text-sm text-zinc-500">
                            {member.email ||
                              member.mobileNumber ||
                              "No contact"}
                          </p>
                        </div>
                        <span
                          className={statusPillClasses(member.status, "sm")}
                        >
                          {member.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(member.roles?.length
                          ? member.roles
                          : [
                              {
                                id: member.roleId,
                                name: member.roleName,
                                key: member.roleName.toUpperCase(),
                              },
                            ]
                        ).map((role) => (
                          <span
                            key={role.id}
                            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-200"
                          >
                            {role.name}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {canEditRolesForMember(member) || canRemoveMembers ? (
                    <div
                      className={`mt-3 grid gap-2 border-t border-zinc-800 pt-3 ${
                        canEditRolesForMember(member) && canRemoveMembers
                          ? "grid-cols-2"
                          : "grid-cols-1"
                      }`}
                    >
                      {canEditRolesForMember(member) ? (
                        <button
                          type="button"
                          disabled={busyMemberId === member.id}
                          onClick={() => requestRoleChange(member)}
                          className="min-h-11 rounded-lg border border-zinc-700 px-3 text-sm font-semibold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Edit roles
                        </button>
                      ) : null}
                      {canRemoveMembers ? (
                        <button
                          type="button"
                          disabled={busyMemberId === member.id}
                          onClick={() => handleRemove(member)}
                          className="min-h-11 rounded-lg border border-red-500/30 px-3 text-sm font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="hidden overflow-hidden lg:block">
              <table className="w-full text-left text-sm text-zinc-400">
                <thead className="border-b border-zinc-800/50 text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="pb-4 font-medium">Name / Email</th>
                    <th className="pb-4 font-medium">Role</th>
                    <th className="pb-4 font-medium">Status</th>
                    <th className="pb-4 font-medium">Joined</th>
                    {canShowMemberActions ? (
                      <th className="pb-4 text-right font-medium">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      className="transition-colors hover:bg-zinc-900/30"
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 overflow-hidden rounded-full bg-zinc-800 flex items-center justify-center">
                            {member.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-medium text-zinc-400">
                                {(member.name || member.email || "?")
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-zinc-200">
                              {member.name || "Unknown"}
                            </div>
                            <div className="max-w-xl truncate text-xs text-zinc-500">
                              {member.email ||
                                member.mobileNumber ||
                                "No contact"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex max-w-xs flex-wrap gap-1.5">
                          {(member.roles?.length
                            ? member.roles
                            : [
                                {
                                  id: member.roleId,
                                  name: member.roleName,
                                  key: member.roleName.toUpperCase(),
                                },
                              ]
                          ).map((role) => (
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
                        <span
                          className={statusPillClasses(member.status, "sm")}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="py-4">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                      {canShowMemberActions ? (
                        <td className="py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {canEditRolesForMember(member) ? (
                              <button
                                type="button"
                                disabled={busyMemberId === member.id}
                                onClick={() => requestRoleChange(member)}
                                className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Edit roles
                              </button>
                            ) : null}
                            {canRemoveMembers ? (
                              <button
                                type="button"
                                disabled={busyMemberId === member.id}
                                onClick={() => handleRemove(member)}
                                className="rounded-full border border-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {pendingRoleChange ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-4">
          <div className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-t-lg border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/40 sm:rounded-lg sm:p-6">
            <h2 className="text-lg font-semibold text-white">
              {pendingRoleChange.blockedReason
                ? "Cannot change roles"
                : "Edit roles"}
            </h2>
            {pendingRoleChange.blockedReason ? (
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {pendingRoleChange.blockedReason}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-6 text-zinc-400">
                  Select the roles for{" "}
                  <span className="text-zinc-200">
                    {pendingRoleChange.member.name ||
                      pendingRoleChange.member.email ||
                      "this member"}
                  </span>
                  .
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {roles.map((role) => {
                    const isChecked =
                      pendingRoleChange.selectedRoleIds.includes(role.id);
                    const isOwnerRole = role.key === "OWNER";
                    const disabled =
                      isManagerOnly &&
                      isOwnerRole &&
                      !canUseSelfRoleTestingOverride(pendingRoleChange.member);
                    const accessLabels = roleAccessLabels(
                      role.key || role.displayName,
                    );

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
                          <span className="block font-semibold">
                            {role.displayName}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-zinc-500">
                            Access: {accessLabels.join(" • ")}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {pendingRoleChange.selectedRoleIds.length === 0 ? (
                  <p className="text-xs text-red-400">
                    Select at least one role.
                  </p>
                ) : null}
                {roleChangeRequiresClient ? (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Business Client *
                    </label>
                    {clientsQuery.isLoading && !clientsQuery.data ? (
                      <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3 text-sm text-zinc-400">
                        Loading clients...
                      </div>
                    ) : clientsQuery.error ? (
                      <div className="mt-2 rounded-xl bg-red-500/10 px-3 py-3 text-sm text-red-400">
                        Failed to load clients.
                      </div>
                    ) : activeClients.length === 0 ? (
                      <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3 text-sm text-zinc-400">
                        Create an active business client before assigning the
                        CLIENT role.
                      </div>
                    ) : (
                      <select
                        required
                        value={pendingRoleChange.selectedClientId}
                        onChange={(event) =>
                          selectPendingClient(event.target.value)
                        }
                        className="mt-2 min-h-11 w-full rounded-xl border border-zinc-800 bg-[#0b0b11] px-3 text-sm text-white outline-none transition focus:border-indigo-500"
                      >
                        <option value="">Select business client...</option>
                        {activeClients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.displayName || client.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : null}
                {isManagerOnly ? (
                  <p className="text-xs text-zinc-500">
                    Managers can edit skills, but cannot assign or change Owner
                    access.
                  </p>
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
                  disabled={
                    busyMemberId === pendingRoleChange.member.id ||
                    pendingRoleChange.selectedRoleIds.length === 0 ||
                    (roleChangeRequiresClient &&
                      !pendingRoleChange.selectedClientId)
                  }
                  onClick={confirmRoleChange}
                  className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
                >
                  {busyMemberId === pendingRoleChange.member.id
                    ? "Saving..."
                    : "Save roles"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InvitationsPanel({
  invitations,
  isLoading,
  error,
  busyInvitationId,
  onResend,
  onShare,
  onRevoke,
  onCopy,
}: {
  invitations: TeamInvitation[];
  isLoading: boolean;
  error: unknown;
  busyInvitationId: string | null;
  onResend: (invitation: TeamInvitation) => void;
  onShare: (invitation: TeamInvitation) => void;
  onRevoke: (invitation: TeamInvitation) => void;
  onCopy: (invitation: TeamInvitation) => void;
}) {
  if (isLoading) {
    return <div className="text-sm text-zinc-400">Loading invitations...</div>;
  }

  if (error && !invitations.length) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        Failed to load invitations.
      </div>
    );
  }

  if (!invitations.length) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500">
        No invitations have been sent yet.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 lg:hidden">
        {invitations.map((invitation) => (
          <article
            key={invitation.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-zinc-100">
                  {invitation.email || "Email unavailable"}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Invited by{" "}
                  {invitation.invitedBy?.name ||
                    invitation.invitedBy?.email ||
                    "Unknown"}
                </p>
              </div>
              <span className={statusPillClasses(invitation.status, "sm")}>
                {invitation.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {invitation.roles.map((role) => (
                <span
                  key={role.id}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-200"
                >
                  {role.name}
                </span>
              ))}
            </div>
            <div className="mt-3 grid gap-1 text-xs text-zinc-500">
              <span>Sent {formatDateTime(invitation.sentAt)}</span>
              <span>Expires {formatDateTime(invitation.expiresAt)}</span>
            </div>
            <InvitationActions
              invitation={invitation}
              busyInvitationId={busyInvitationId}
              onResend={onResend}
              onShare={onShare}
              onRevoke={onRevoke}
              onCopy={onCopy}
              className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3"
            />
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden lg:block">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="border-b border-zinc-800/50 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="pb-4 font-medium">Email</th>
              <th className="pb-4 font-medium">Roles</th>
              <th className="pb-4 font-medium">Invited by</th>
              <th className="pb-4 font-medium">Sent</th>
              <th className="pb-4 font-medium">Expires</th>
              <th className="pb-4 font-medium">Status</th>
              <th className="pb-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {invitations.map((invitation) => (
              <tr
                key={invitation.id}
                className="transition-colors hover:bg-zinc-900/30"
              >
                <td className="py-4">
                  <div className="font-medium text-zinc-200">
                    {invitation.email || "Email unavailable"}
                  </div>
                  {invitation.mobileNumber ? (
                    <div className="text-xs text-zinc-500">
                      {invitation.mobileNumber}
                    </div>
                  ) : null}
                </td>
                <td className="py-4">
                  <div className="flex max-w-xs flex-wrap gap-1.5">
                    {invitation.roles.map((role) => (
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
                  {invitation.invitedBy?.name ||
                    invitation.invitedBy?.email ||
                    "Unknown"}
                </td>
                <td className="py-4">{formatDateTime(invitation.sentAt)}</td>
                <td className="py-4">{formatDateTime(invitation.expiresAt)}</td>
                <td className="py-4">
                  <span className={statusPillClasses(invitation.status, "sm")}>
                    {invitation.status}
                  </span>
                </td>
                <td className="py-4 text-right">
                  <InvitationActions
                    invitation={invitation}
                    busyInvitationId={busyInvitationId}
                    onResend={onResend}
                    onShare={onShare}
                    onRevoke={onRevoke}
                    onCopy={onCopy}
                    className="flex justify-end gap-2"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function InvitationActions({
  invitation,
  busyInvitationId,
  onResend,
  onShare,
  onRevoke,
  onCopy,
  className,
}: {
  invitation: TeamInvitation;
  busyInvitationId: string | null;
  onResend: (invitation: TeamInvitation) => void;
  onShare: (invitation: TeamInvitation) => void;
  onRevoke: (invitation: TeamInvitation) => void;
  onCopy: (invitation: TeamInvitation) => void;
  className: string;
}) {
  const isBusy = busyInvitationId === invitation.id;
  const canUseLink = canUseInvitationLink(invitation);
  const canResend = canUseLink;
  const canRevoke = invitation.status === "PENDING";
  const resendLabel =
    canResend && !invitation.canResendEmail
      ? `Resend available in ${formatResendWait(invitation.resendAvailableAt)}`
      : "Resend email";

  if (!canUseLink && !canRevoke) {
    return <div className={className} />;
  }

  return (
    <div className={className}>
      {canUseLink ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onShare(invitation)}
          className="min-h-10 rounded-full border border-zinc-700 px-3 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Share
        </button>
      ) : null}
      {canUseLink ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onCopy(invitation)}
          className="min-h-10 rounded-full border border-zinc-700 px-3 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Copy link
        </button>
      ) : null}
      {canResend ? (
        <button
          type="button"
          disabled={isBusy || !invitation.canResendEmail}
          onClick={() => onResend(invitation)}
          className="min-h-10 rounded-full border border-zinc-700 px-3 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? "Working..." : resendLabel}
        </button>
      ) : null}
      {canRevoke ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onRevoke(invitation)}
          className="min-h-10 rounded-full border border-red-500/20 px-3 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Revoke
        </button>
      ) : null}
    </div>
  );
}

function applicationErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (/unique constraint|prisma|p2002/i.test(error.message)) return fallback;
  return error.message || fallback;
}

function canUseInvitationLink(invitation: TeamInvitation) {
  return (
    invitation.status === "PENDING" &&
    new Date(invitation.expiresAt).getTime() > Date.now()
  );
}

function formatResendWait(value: string | null) {
  if (!value) return "48h";
  const diffMs = new Date(value).getTime() - Date.now();
  if (diffMs <= 0) return "now";
  const hours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (hours >= 1) return `${hours}h`;
  return `${Math.ceil(diffMs / (60 * 1000))}m`;
}

function memberHasRole(member: Member, roleName: string) {
  return (
    member.roles?.some(
      (role) => role.name === roleName || role.key === roleName.toUpperCase(),
    ) || member.roleName === roleName
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}
