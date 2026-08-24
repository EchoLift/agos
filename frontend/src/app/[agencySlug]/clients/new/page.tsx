"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { ClientFormActions, ClientPlaybookForm, normalizeClientPayload } from "@/components/ClientPlaybookForm";
import { useAgency } from "@/components/AgencyProvider";
import { Client, createClient, CreateClientInput } from "@/lib/api/clients";
import { invalidateWorkspaceQueries, queryKeys, setListItem, useTeamQuery } from "@/lib/query";
import { getWorkspaceHref } from "@/lib/workspace-url";

export default function NewClientPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { agencyId } = useAgency();
  const teamQuery = useTeamQuery(agencyId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const safeAgencySlug = useAgency().agencySlug ?? "";
  const { register, handleSubmit, formState, setValue, watch } = useForm<CreateClientInput>({
    mode: "onChange",
    defaultValues: {
      name: "",
      displayName: "",
      website: "",
      industry: "Technology",
      primaryContactName: "",
      primaryContactUserId: "",
      primaryContactEmail: "",
      invitePrimaryContact: true,
      businessDescription: "",
      businessSize: "",
      timezone: "Asia/Kolkata",
      brandVoice: "",
      audience: "",
      competitors: "",
    },
  });

  const onSubmit = async (data: CreateClientInput) => {
    if (!agencyId) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const client = await createClient(agencyId, {
        ...normalizeClientPayload(data),
        invitePrimaryContact: data.invitePrimaryContact !== false,
      });
      queryClient.setQueryData(queryKeys.clients(agencyId), (current: Client[] | undefined) => setListItem(current, client));
      invalidateWorkspaceQueries(queryClient, agencyId, [
        "clients",
        "dashboard",
        "campaigns",
        "calendar",
        "workflow",
        "invitations",
      ]);
      router.push(getWorkspaceHref(safeAgencySlug, "/clients"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create client.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          ←
        </button>
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">New Client</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Add Client Playbook</h1>
          <p className="mt-2 text-sm text-zinc-400">Capture enough context for the whole agency to work with this client.</p>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <ClientPlaybookForm
          register={register}
          setValue={setValue}
          watch={watch}
          primaryContactUsers={teamQuery.data ?? []}
        />

        <label className="flex items-start gap-3 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 text-sm text-zinc-300">
          <input
            type="checkbox"
            {...register("invitePrimaryContact")}
            className="mt-1 h-4 w-4 accent-indigo-500"
          />
          <span>
            <span className="block font-medium text-white">
              Invite primary contact to the client portal
            </span>
            <span className="mt-1 block text-zinc-500">
              Creates a CLIENT invitation linked to this business client.
            </span>
          </span>
        </label>

        {error ? <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-400">{error}</div> : null}

        <ClientFormActions>
          <Link href={getWorkspaceHref(safeAgencySlug, "/clients")} className="rounded-full border border-zinc-800 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white">
            Cancel
          </Link>
          <button type="submit" className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={!formState.isValid || isSubmitting}>
            {isSubmitting ? "Creating..." : "Save Client"}
          </button>
        </ClientFormActions>
      </form>
    </div>
  );
}
