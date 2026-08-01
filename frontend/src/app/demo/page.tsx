"use client";

import { useRouter } from "next/navigation";

export default function DemoPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-24">
        <div className="w-full rounded-3xl border border-zinc-800 bg-zinc-950/80 p-10 shadow-2xl shadow-black/30">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Local demo access</p>
          <h1 className="mt-4 text-4xl font-semibold text-white">Jump into the post-login experience</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
            This bypasses OAuth so you can review the agency onboarding and activation flow immediately.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/create-agency")}
              className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
            >
              Continue to agency setup
            </button>
            <button
              onClick={() => router.push("/demo-workspace")}
              className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              Open demo workspace
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
