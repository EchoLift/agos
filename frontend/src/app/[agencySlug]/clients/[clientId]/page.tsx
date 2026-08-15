"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ClientFormActions, ClientPlaybookForm, normalizeClientPayload } from "@/components/ClientPlaybookForm";
import { useAgency } from "@/components/AgencyProvider";
import { Client, ClientPlaybookResponse, CreateClientInput, updateClient } from "@/lib/api/clients";
import { statusPillClasses } from "@/lib/status-style";
import { invalidateWorkspaceQueries, queryKeys, setListItem, useClientQuery } from "@/lib/query";

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams<{ clientId: string }>();
  const queryClient = useQueryClient();
  const { agencyId } = useAgency();
  const playbookQuery = useClientQuery(agencyId, params.clientId);
  const playbook = playbookQuery.data ?? null;
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState, setValue, watch, reset } = useForm<CreateClientInput>({ mode: "onChange" });
  const isLoading = playbookQuery.isLoading && !playbook;
  const firstLoadError = !playbook && playbookQuery.error
    ? playbookQuery.error instanceof Error
      ? playbookQuery.error.message
      : "Failed to load client."
    : null;

  useEffect(() => {
    if (!playbook) return;
    reset(toFormValues(playbook.client));
  }, [playbook, reset]);

  const save = async (data: CreateClientInput) => {
    if (!agencyId || !playbook?.client.id) return;
    setIsSaving(true);
    setError(null);
    try {
      const updatedClient = await updateClient(agencyId, playbook.client.id, normalizeClientPayload(data));
      const updated: ClientPlaybookResponse = { ...playbook, client: updatedClient };
      queryClient.setQueryData(queryKeys.client(agencyId, updatedClient.id), updated);
      queryClient.setQueryData(queryKeys.clients(agencyId), (current: Client[] | undefined) => setListItem(current, updatedClient));
      invalidateWorkspaceQueries(queryClient, agencyId, ["clients"]);
      reset(toFormValues(updatedClient));
      setIsEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save client.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.push(`/clients`)} className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white">←</button>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Client Playbook</p>
            <h1 className="mt-1 text-3xl font-semibold text-white">{playbook?.client.name || (isLoading ? "Loading..." : "Client")}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {playbook ? `${playbook.sections.length} visible sections for your role.` : "Loading role-aware client context."}
            </p>
          </div>
        </div>
        {playbook?.canEdit ? (
          <button type="button" onClick={() => setIsEditing((value) => !value)} className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900">
            {isEditing ? "Cancel" : "Edit"}
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 text-sm text-zinc-500">Loading client...</div>
      ) : firstLoadError ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{firstLoadError}</div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : playbook ? (
        isEditing ? (
          <form className="space-y-6" onSubmit={handleSubmit(save)}>
            <ClientPlaybookForm register={register} setValue={setValue} watch={watch} />
            <ClientFormActions>
              <button type="button" onClick={() => setIsEditing(false)} className="rounded-full border border-zinc-800 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white">
                Cancel
              </button>
              <button type="submit" disabled={!formState.isValid || isSaving} className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? "Saving..." : "Save Client"}
              </button>
            </ClientFormActions>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl shadow-black/20">
              <span className={statusPillClasses(playbook.client.status, "sm")}>{playbook.client.status}</span>
              <span className="text-xs text-zinc-600">ID {playbook.client.id.slice(0, 8)}</span>
              <span className="text-xs text-zinc-600">Created {formatDate(playbook.client.createdAt)}</span>
            </div>
            {playbook.sections.map((section) => (
              <section key={section.id} className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">{section.title}</h2>
                  <span className="rounded-full border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-600">{section.permission}</span>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {section.fields.map((field) => (
                    <Detail key={String(field.key)} label={field.label} value={field.value} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{formatValue(value)}</div>
    </div>
  );
}

function formatValue(value?: string | null) {
  if (!value) return "— Not provided";
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
  return value;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function toFormValues(client: Partial<Client>): CreateClientInput {
  return {
    name: client.name || "",
    displayName: client.displayName || "",
    website: client.website || "",
    industry: client.industry || "Technology",
    businessDescription: client.businessDescription || "",
    businessSize: client.businessSize || "",
    brandVoice: client.brandVoice || "",
    brandPersonality: client.brandPersonality || "",
    mission: client.mission || "",
    vision: client.vision || "",
    usp: client.usp || "",
    brandStory: client.brandStory || "",
    tagline: client.tagline || "",
    dos: client.dos || "",
    donts: client.donts || "",
    audience: client.audience || "",
    secondaryAudience: client.secondaryAudience || "",
    audienceAge: client.audienceAge || "",
    audienceGender: client.audienceGender || "",
    audienceLocations: client.audienceLocations || "",
    audienceIncome: client.audienceIncome || "",
    audienceOccupation: client.audienceOccupation || "",
    audiencePainPoints: client.audiencePainPoints || "",
    audienceInterests: client.audienceInterests || "",
    buyingBehavior: client.buyingBehavior || "",
    competitors: client.competitors || "",
    primaryContactName: client.primaryContactName || "",
    primaryContactDesignation: client.primaryContactDesignation || "",
    primaryContactEmail: client.primaryContactEmail || "",
    primaryContactPhone: client.primaryContactPhone || "",
    primaryContactWhatsapp: client.primaryContactWhatsapp || "",
    preferredContactMethod: client.preferredContactMethod || "",
    workingHours: client.workingHours || "",
    availableDays: client.availableDays || "",
    instagramUrl: client.instagramUrl || "",
    facebookUrl: client.facebookUrl || "",
    linkedinUrl: client.linkedinUrl || "",
    youtubeUrl: client.youtubeUrl || "",
    twitterUrl: client.twitterUrl || "",
    googleBusinessUrl: client.googleBusinessUrl || "",
    whatsappBusinessNumber: client.whatsappBusinessNumber || "",
    contentGoals: client.contentGoals || "",
    contentTypes: client.contentTypes || "",
    postingFrequency: client.postingFrequency || "",
    approvalSla: client.approvalSla || "",
    revisionLimit: client.revisionLimit || "",
    priority: client.priority || "",
    engagementModel: client.engagementModel || "",
    billingCycle: client.billingCycle || "",
    deliverables: client.deliverables || "",
    aiWritingInstructions: client.aiWritingInstructions || "",
    forbiddenWords: client.forbiddenWords || "",
    preferredCta: client.preferredCta || "",
    brandDictionary: client.brandDictionary || "",
    productKnowledge: client.productKnowledge || "",
    faqs: client.faqs || "",
    internalNotes: client.internalNotes || "",
    startDate: client.startDate ? new Date(client.startDate).toISOString().slice(0, 10) : "",
    timezone: client.timezone || "Asia/Kolkata",
  };
}
