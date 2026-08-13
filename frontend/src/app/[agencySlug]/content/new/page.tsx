"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useAgency } from "@/components/AgencyProvider";
import { createContentAsset, CreateContentInput } from "@/lib/api/content";
import { getCampaigns, Campaign } from "@/lib/api/campaigns";
import Link from "next/link";

export default function NewContentPage() {
  const router = useRouter();
  const { agencyId, agencySlug } = useAgency();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    if (!agencyId) return;
    getCampaigns(agencyId).then(setCampaigns).catch(console.error);
  }, [agencyId]);

  const { register, handleSubmit, formState } = useForm<CreateContentInput>({
    defaultValues: {
      campaignId: "",
      clientId: "",
      title: "",
      type: "REEL",
      brief: "",
    },
  });

  const onSubmit = async (data: CreateContentInput) => {
    if (!agencyId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const selectedCampaign = campaigns.find(c => c.id === data.campaignId);
      if (!selectedCampaign) throw new Error("Invalid campaign selected");

      data.clientId = selectedCampaign.clientId;

      await createContentAsset(agencyId, data);
      router.push(`/content`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create content asset.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          ←
        </button>
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">New Content</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Add Content Asset</h1>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl shadow-black/20">
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <label className="block text-sm font-medium text-zinc-300">
            Campaign *
            <select
              {...register("campaignId", { required: true })}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500"
            >
              <option value="">Select a campaign...</option>
              {campaigns.map(campaign => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Asset Title *
            <input
              {...register("title", { required: true, minLength: 2 })}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500"
              placeholder="Q4 Instagram Reel 1"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Type *
            <select
              {...register("type", { required: true })}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500"
            >
              <option value="REEL">Reel</option>
              <option value="CAROUSEL">Carousel</option>
              <option value="STATIC">Static</option>
              <option value="STORY">Story</option>
              <option value="BLOG">Blog</option>
              <option value="YOUTUBE">YouTube</option>
              <option value="AD">Ad</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Brief *
            <textarea
              {...register("brief", { required: true })}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500"
              placeholder="Instructions and requirements..."
              rows={4}
            />
          </label>

          {error && (
            <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Link
              href={`/content`}
              className="rounded-full border border-zinc-800 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!formState.isValid || isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Save Content Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
