"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import HelpSearch from "@/components/help/HelpSearch";

type SearchArticle = {
  href: string;
  title: string;
  description: string;
  category: string;
  status: string;
};

type NavigationSection = {
  category: string;
  articles: Array<{
    slug: string;
    href: string;
    title: string;
  }>;
};

export default function HelpDesktopSidebar({
  articles,
  navigation,
  activeSlug,
}: {
  articles: SearchArticle[];
  navigation: NavigationSection[];
  activeSlug?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sticky top-[61px] hidden h-[calc(100vh-61px)] shrink-0 overflow-y-auto border-r border-border bg-muted/30 transition-[width] duration-200 lg:block ${
        collapsed ? "w-16 p-2" : "w-80 p-4"
      }`}
    >
      <div className={`flex ${collapsed ? "justify-center" : "justify-end"}`}>
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? "Expand help sidebar" : "Collapse help sidebar"}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className="mt-3">
            <HelpSearch articles={articles} />
          </div>
          <nav className="mt-4 space-y-5">
            {navigation.map((section) => (
              <div key={section.category}>
                <div className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {section.category}
                </div>
                <div className="mt-2 space-y-1">
                  {section.articles.map((item) => {
                    const isActive = activeSlug === item.slug;
                    return (
                      <Link
                        key={item.slug}
                        href={item.href}
                        className={`block rounded-lg px-3 py-2 text-sm transition ${
                          isActive
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {item.title}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </>
      ) : null}
    </aside>
  );
}
