"use client";

import Link from "next/link";
import React from "react";

export default function MobileNav() {
  return (
    <details className="relative z-[110] md:hidden">
      <summary
        className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-none bg-none text-foreground [&::-webkit-details-marker]:hidden"
        aria-label="Open navigation menu"
      >
        <span className="flex flex-col gap-1.5">
          <span className="block h-0.5 w-5 bg-current" />
          <span className="block h-0.5 w-5 bg-current" />
          <span className="block h-0.5 w-5 bg-current" />
        </span>
      </summary>

      <nav className="absolute right-0 top-full z-[120] mt-2 w-52 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-xl">
        <a
          href="#problem"
          onClick={(event) => {
            const details = event.currentTarget.closest("details");
            if (details) (details as HTMLDetailsElement).open = false;
          }}
          className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          Problem
        </a>

        <a
          href="#how-it-works"
          onClick={(event) => {
            const details = event.currentTarget.closest("details");
            if (details) (details as HTMLDetailsElement).open = false;
          }}
          className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          How it works
        </a>

        <a
          href="#features"
          onClick={(event) => {
            const details = event.currentTarget.closest("details");
            if (details) (details as HTMLDetailsElement).open = false;
          }}
          className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          Features
        </a>

        <Link
          href="/help"
          onClick={(event: any) => {
            const details = (event.currentTarget as Element).closest("details");
            if (details) (details as HTMLDetailsElement).open = false;
          }}
          className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          Docs
        </Link>

        <a
          href="#pricing"
          onClick={(event) => {
            const details = event.currentTarget.closest("details");
            if (details) (details as HTMLDetailsElement).open = false;
          }}
          className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          Early Access
        </a>
      </nav>
    </details>
  );
}
