"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  Files,
  FolderKanban,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Agency } from "@/lib/api/organization";
import type { WorkspaceNavItem } from "@/lib/workspace-access";
import { hasAnyRole } from "@/lib/workspace-access";
import { getHelpHref, getWorkspaceHref } from "@/lib/workspace-url";

type VisibleNavItem = WorkspaceNavItem & {
  baseHrefValue?: string;
  hrefValue: string;
};

export default function MobileWorkspaceNav({
  agency,
  pathname,
  navItems,
}: {
  agency: Agency | null;
  pathname: string;
  navItems: VisibleNavItem[];
}) {
  const [sheet, setSheet] = useState<"create" | "more" | null>(null);
  const home = navItems.find((item) => item.key === "dashboard");
  const campaigns = navItems.find((item) => item.key === "campaigns");
  const calendar = navItems.find((item) => item.key === "calendar");
  const workflow = navItems.find((item) => item.key === "workflow");
  const visibleKeys = new Set(navItems.map((item) => item.key));
  const pinned = [home, campaigns, calendar ?? workflow].filter(
    (item): item is VisibleNavItem => Boolean(item),
  );
  const pinnedKeys = new Set(pinned.map((item) => item.key));
  const remaining = navItems.filter((item) => !pinnedKeys.has(item.key));
  const safeAgencySlug = agency?.slug ?? "";
  const createLinks = [
    {
      label: "New Gig",
      href: getWorkspaceHref(safeAgencySlug, "/gigs/new"),
      visible: visibleKeys.has("gigs"),
    },
    {
      label: "New Campaign",
      href: getWorkspaceHref(safeAgencySlug, "/campaigns/new"),
      visible: visibleKeys.has("campaigns"),
    },
    {
      label: "New Client",
      href: getWorkspaceHref(safeAgencySlug, "/clients/new"),
      visible: visibleKeys.has("clients"),
    },
  ].filter((item) => item.visible);
  const canCreate =
    hasAnyRole(agency, ["OWNER", "ADMIN", "MANAGER"]) && createLinks.length > 0;

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl lg:hidden"
        aria-label="Workspace navigation"
      >
        <div
          className={`grid min-h-14 items-stretch ${canCreate ? "grid-cols-5" : "grid-cols-4"}`}
        >
          {pinned.slice(0, 2).map((item) => (
            <MobileNavLink key={item.key} item={item} pathname={pathname} />
          ))}
          {canCreate ? (
            <button
              type="button"
              onClick={() => setSheet("create")}
              className="flex min-h-14 flex-col items-center justify-center text-primary transition hover:text-primary/80"
              aria-label="Quick create"
            >
              <Plus aria-hidden="true" className="h-5 w-5" />
              <span className="mt-1 text-[10px] font-medium">Create</span>
            </button>
          ) : pinned[2] ? (
            <MobileNavLink item={pinned[2]} pathname={pathname} />
          ) : (
            <span />
          )}
          {canCreate && pinned[2] ? (
            <MobileNavLink item={pinned[2]} pathname={pathname} />
          ) : null}
          <button
            type="button"
            onClick={() => setSheet("more")}
            className="flex min-h-14 flex-col items-center justify-center text-primary transition hover:text-primary/80"
            aria-label="More navigation"
          >
            <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
            <span className="mt-1 text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {sheet ? (
        <div
          className="fixed inset-0 z-[60] bg-black/55 lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute inset-0"
            aria-label="Close menu"
            onClick={() => setSheet(null)}
          />
          <section className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-lg border-t border-border bg-popover px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 text-popover-foreground shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                {sheet === "create" ? "Quick create" : "More"}
              </h2>
              <button
                type="button"
                onClick={() => setSheet(null)}
                className="min-h-11 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(sheet === "create" ? createLinks : remaining).map((item) => (
                <Link
                  key={item.label}
                  href={"hrefValue" in item ? item.hrefValue : item.href}
                  onClick={() => setSheet(null)}
                  className="flex min-h-12 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
                >
                  {item.label}
                </Link>
              ))}
              {sheet === "more" ? (
                <Link
                  href={getHelpHref()}
                  onClick={() => setSheet(null)}
                  className="flex min-h-12 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
                >
                  Help
                </Link>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function MobileNavLink({
  item,
  pathname,
}: {
  item: VisibleNavItem;
  pathname: string;
}) {
  const active =
    (item.baseHrefValue ?? item.hrefValue) === "/"
      ? pathname === "/"
      : pathname === (item.baseHrefValue ?? item.hrefValue) ||
        pathname.startsWith(`${item.baseHrefValue ?? item.hrefValue}/`);
  const Icon = mobileNavIcons[item.key] ?? FolderKanban;
  return (
    <Link
      href={item.hrefValue}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-14 flex-col items-center justify-center transition ${
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
      <span className="mt-1 max-w-[68px] truncate text-[10px] font-medium">
        {item.label}
      </span>
    </Link>
  );
}

const mobileNavIcons: Partial<Record<WorkspaceNavItem["key"], LucideIcon>> = {
  dashboard: LayoutDashboard,
  campaigns: FolderKanban,
  files: Files,
  gigs: BriefcaseBusiness,
  workflow: Workflow,
  calendar: CalendarDays,
  team: Users,
};
