"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type SearchArticle = {
  href: string;
  title: string;
  description: string;
  category: string;
  status: string;
};

export default function HelpSearch({ articles }: { articles: SearchArticle[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    return articles
      .filter((article) =>
        [article.title, article.description, article.category, article.status]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 10);
  }, [articles, query]);

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Search Help</label>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search setup, campaigns, workflow..."
        className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
      />
      {query.trim() ? <div className="mt-3 space-y-2">
        {results.map((article) => (
          <Link
            key={article.href}
            href={article.href}
            className="block rounded-xl border border-border bg-background p-3 transition hover:border-primary/50 hover:bg-primary/10"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{article.title}</span>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                {article.status.replace("_", " ")}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.description}</p>
          </Link>
        ))}
        {results.length === 0 ? <p className="px-1 py-2 text-sm text-muted-foreground">No help articles found.</p> : null}
      </div> : null}
    </div>
  );
}
