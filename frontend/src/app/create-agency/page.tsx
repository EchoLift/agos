"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { createAgency } from "@/lib/api/organization";

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

type FormValues = {
  displayName: string;
  slug: string;
};

export default function CreateAgencyPage() {
  const router = useRouter();
  const { register, handleSubmit, control, setValue, formState } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: { displayName: "", slug: "" },
  });

  const slug = useWatch({ control, name: "slug" }) ?? "";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: FormValues) => {
    const finalSlug = normalizeSlug(data.slug || data.displayName);
    if (finalSlug.length < 3) {
      setError("Agency subdomain must be at least 3 characters.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await createAgency(data.displayName, finalSlug);
      router.push(`/${response.agency.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create agency.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-10 shadow-2xl shadow-black/30">
          {/* Header */}
          <div className="mb-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>
              New Workspace
            </div>
            <h1 className="text-3xl font-semibold text-white">Set up your agency</h1>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Give your agency a display name and choose a unique subdomain for your workspace URL.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Display Name
              </label>
              <p className="mt-1 text-xs text-zinc-500">Shown in the header across your workspace</p>
              <input
                {...register("displayName", {
                  required: true,
                  minLength: 2,
                  onChange: (e) => {
                    if (!formState.dirtyFields.slug) {
                      setValue("slug", normalizeSlug(e.target.value), { shouldValidate: true });
                    }
                  },
                })}
                className="mt-3 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3.5 text-base text-white placeholder-zinc-600 outline-none transition focus:border-indigo-500"
                placeholder="Social Expert Media"
              />
            </div>

            {/* Agency Name / Subdomain */}
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Agency Subdomain
              </label>
              <p className="mt-1 text-xs text-zinc-500">Unique identifier used for your workspace URL — lowercase letters, numbers, hyphens only</p>
              <div className="mt-3 flex items-center rounded-2xl border border-zinc-800 bg-[#0b0b11] transition focus-within:border-indigo-500 overflow-hidden">
                <input
                  {...register("slug", {
                    required: true,
                    minLength: 3,
                    onChange: (e) => {
                      setValue("slug", normalizeSlug(e.target.value), { shouldValidate: true, shouldDirty: true });
                    },
                  })}
                  className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-base text-white placeholder-zinc-600 outline-none"
                  placeholder="social-expert"
                />
                <span className="flex-shrink-0 pr-4 text-sm text-zinc-500 select-none">.agos.com</span>
              </div>
              {slug && (
                <p className="mt-2 text-xs text-zinc-500">
                  Workspace URL: <span className="text-indigo-400">https://{slug}.agos.com</span>
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="mt-2 w-full rounded-full bg-indigo-500 px-6 py-4 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!formState.isValid || !slug || isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating agency…
                </span>
              ) : (
                "Create agency and continue →"
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
