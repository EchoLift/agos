"use client";

import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";

type NavigationSection = {
  category: string;
  articles: Array<{
    slug: string;
    href: string;
    title: string;
  }>;
};

export default function HelpMobileNavigation({
  navigation,
  activeSlug,
}: {
  navigation: NavigationSection[];
  activeSlug?: string;
}) {
  const activeCategory = navigation.find((section) =>
    section.articles.some((article) => article.slug === activeSlug),
  )?.category;
  const [isOpen, setIsOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(activeCategory ?? null);

  return (
    <div className="mt-3 lg:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex min-h-11 w-full items-center justify-between rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground"
      >
        <span className="flex items-center gap-2">
          {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          Browse help topics
        </span>
        <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {isOpen ? (
        <nav className="mt-2 max-h-[55vh] overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-lg">
          {navigation.map((section) => {
            const expanded = openCategory === section.category;
            return (
              <div key={section.category} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenCategory(expanded ? null : section.category)}
                  className="flex min-h-11 w-full items-center justify-between px-2 text-left text-sm font-semibold text-foreground"
                >
                  {section.category}
                  <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {expanded ? (
                  <div className="pb-2">
                    {section.articles.map((article) => (
                      <Link
                        key={article.slug}
                        href={article.href}
                        onClick={() => setIsOpen(false)}
                        className={`block min-h-11 rounded-md px-3 py-3 text-sm ${
                          article.slug === activeSlug ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {article.title}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
