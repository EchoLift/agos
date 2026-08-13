"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAgency } from "@/components/AgencyProvider";
import { ContentAsset, getContentAsset, updateContentAsset } from "@/lib/api/content";
import { statusPillClasses } from "@/lib/status-style";

const contentTypes = ["REEL", "CAROUSEL", "STATIC", "STORY", "BLOG", "YOUTUBE", "AD", "OTHER"];

export default function ContentDetailPage() {
  const router = useRouter();
  const params = useParams<{ contentId: string }>();
  const { agencyId, agencySlug } = useAgency();
  const [asset, setAsset] = useState<ContentAsset | null>(null);
  const [draft, setDraft] = useState({ title: "", type: "REEL", brief: "" });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agencyId || !params.contentId) return;
    let isMounted = true;

    getContentAsset(agencyId, params.contentId)
      .then((data) => {
        if (!isMounted) return;
        setAsset(data);
        setDraft({ title: data.title || "", type: data.type || "REEL", brief: data.brief || "" });
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load content.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [agencyId, params.contentId]);

  const save = async () => {
    if (!agencyId || !asset) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateContentAsset(agencyId, asset.id, draft);
      setAsset(updated);
      setDraft({ title: updated.title || "", type: updated.type || "REEL", brief: updated.brief || "" });
      setIsEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save content.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push(`/content`)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            ←
          </button>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Content</p>
            <h1 className="mt-1 text-3xl font-semibold text-white">{asset?.title || (isLoading ? "Loading..." : "Content")}</h1>
          </div>
        </div>
        {asset ? (
          <button
            type="button"
            onClick={() => setIsEditing((value) => !value)}
            className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
        ) : null}
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20 sm:p-8">
        {isLoading ? (
          <div className="text-sm text-zinc-500">Loading content...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
        ) : asset ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className={statusPillClasses(asset.type, "sm")}>{asset.type}</span>
              <span className={statusPillClasses(asset.status, "sm")}>{asset.status}</span>
              <span className="text-xs text-zinc-600">{asset.displayCode || asset.id.slice(0, 8)}</span>
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-zinc-300">
                  Title
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500"
                  />
                </label>
                <label className="block text-sm font-medium text-zinc-300">
                  Type
                  <select
                    value={draft.type}
                    onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500"
                  >
                    {contentTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-zinc-300">
                  Brief
                  <textarea
                    value={draft.brief}
                    onChange={(event) => setDraft((current) => ({ ...current, brief: event.target.value }))}
                    rows={5}
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500"
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isSaving || !draft.title.trim()}
                    onClick={save}
                    className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Detail label="Campaign ID" value={asset.campaignId} mono />
                  <Detail label="Client ID" value={asset.clientId} mono />
                  <Detail label="Created" value={formatDate(asset.createdAt)} />
                  <Detail label="Updated" value={formatDate(asset.updatedAt)} />
                </div>
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Brief</h2>
                  <p className="rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4 text-sm leading-6 text-zinc-300">
                    {asset.brief || "No brief added yet."}
                  </p>
                </section>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0b0b11] p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-600">{label}</div>
      <div className={`mt-2 truncate text-sm text-zinc-200 ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}
