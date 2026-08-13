import { Suspense } from "react";
import LoginClient from "./LoginClient";

function LoginFallback() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-24">
        <div className="w-full rounded-3xl border border-zinc-800 bg-zinc-950/80 p-10 shadow-2xl shadow-black/30">
          <p className="text-center text-sm text-zinc-400">
            Loading sign in…
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}