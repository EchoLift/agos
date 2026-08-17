"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAgency } from "@/components/AgencyProvider";
import { getRoles, inviteMember, Role } from "@/lib/api/team";
import { invalidateWorkspaceQueries, queryKeys, useClientsQuery } from "@/lib/query";
import { getWorkspaceHref } from "@/lib/workspace-url";

export default function InviteMemberPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { agencyId, agencySlug } = useAgency();

  const [roles, setRoles] = useState<Role[]>([]);
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [rolesError, setRolesError] = useState("");
  const safeAgencySlug = agencySlug ?? "";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const clientsQuery = useClientsQuery(agencyId);
  const clients = clientsQuery.data ?? [];
  const selectedRoles = useMemo(
    () => roles.filter((role) => selectedRoleIds.includes(role.id)),
    [roles, selectedRoleIds],
  );
  const requiresClient = selectedRoles.some((role) => role.key === "CLIENT");

  useEffect(() => {
    if (!agencyId) return;

    getRoles(agencyId)
      .then((data) => {
        setRoles(data);
        if (data.length > 0) setSelectedRoleIds([data[0].id]);
        setRolesError("");
      })
      .catch((err: unknown) => {
        setRolesError(err instanceof Error ? err.message : "Unable to load roles.");
      })
      .finally(() => setIsLoadingRoles(false));
  }, [agencyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) return;

    setIsSubmitting(true);
    setError("");

    try {
      const primaryRoleId = selectedRoleIds[0];
      if (!primaryRoleId) {
        setError("Select at least one role.");
        setIsSubmitting(false);
        return;
      }
      if (requiresClient && !selectedClientId) {
        setError("Select the business client this CLIENT user represents.");
        setIsSubmitting(false);
        return;
      }

      await inviteMember(agencyId, {
        email,
        mobileNumber: mobileNumber || undefined,
        roleId: primaryRoleId,
        roleIds: selectedRoleIds,
        clientId: requiresClient ? selectedClientId : undefined,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.invitations(agencyId),
      });
      invalidateWorkspaceQueries(queryClient, agencyId, ["invitations"]);
      router.push(getWorkspaceHref(safeAgencySlug, "/team?tab=invitations"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
      setIsSubmitting(false);
    }
  };

  const toggleRole = (roleId: string) => {
    const nextRoleIds = selectedRoleIds.includes(roleId)
      ? selectedRoleIds.filter((id) => id !== roleId)
      : [...selectedRoleIds, roleId];
    setSelectedRoleIds(nextRoleIds);

    const nextRequiresClient = roles
      .filter((role) => nextRoleIds.includes(role.id))
      .some((role) => role.key === "CLIENT");
    if (!nextRequiresClient) {
      setSelectedClientId("");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Invite Team Member</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Send an invitation to join your workspace.
          </p>
        </div>
        <Link
          href={getWorkspaceHref(safeAgencySlug, "/team")}
          className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
        >
          Close
        </Link>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl shadow-black/20">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@agency.com"
              className="mt-2 block w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Mobile Number</label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="+1 555 123 4567"
              className="mt-2 block w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-2 text-xs text-zinc-500">
              Optional: include a phone number so the invitation can be reached via mobile too.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Roles</label>
            {rolesError ? (
              <div className="mt-3 rounded-xl bg-red-500/10 p-4 text-sm text-red-400">
                {rolesError}
              </div>
            ) : isLoadingRoles ? (
              <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-5 text-sm text-zinc-400">
                Loading available roles…
              </div>
            ) : roles.length === 0 ? (
              <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-5 text-sm text-zinc-400">
                No roles are available for this workspace. Please check your organization settings.
              </div>
            ) : (
              <div className="mt-2 grid gap-1 sm:grid-cols-4 grid-cols-3">
                {roles.map((r) => (
                  <label
                    key={r.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(r.id)}
                      onChange={() => toggleRole(r.id)}
                      className="h-4 w-4 accent-indigo-500"
                    />
                    <span>{r.displayName}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              A person can hold multiple skills, like Writer and Editor.
            </p>
          </div>

          {requiresClient ? (
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Business Client
              </label>
              {clientsQuery.isLoading && !clientsQuery.data ? (
                <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-400">
                  Loading clients...
                </div>
              ) : clientsQuery.error ? (
                <div className="mt-2 rounded-xl bg-red-500/10 p-4 text-sm text-red-400">
                  {clientsQuery.error instanceof Error
                    ? clientsQuery.error.message
                    : "Unable to load clients."}
                </div>
              ) : clients.length === 0 ? (
                <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-400">
                  Create a business client before inviting a CLIENT user.
                </div>
              ) : (
                <select
                  required
                  value={selectedClientId}
                  onChange={(event) => setSelectedClientId(event.target.value)}
                  className="mt-2 block w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select a business client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.displayName || client.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || (requiresClient && !selectedClientId)}
              className="w-full rounded-full bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {isSubmitting ? "Sending Invitation..." : "Send Invitation"}
            </button>
            <button
              type="button"
              onClick={() => router.push(getWorkspaceHref(safeAgencySlug, "/team"))}
              className="mt-3 w-full rounded-full border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
            >
              Back to team
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
