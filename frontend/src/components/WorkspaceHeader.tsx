"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useAgency } from "@/components/AgencyProvider";
import { logout } from "@/lib/auth";
import { Agency } from "@/lib/api/organization";
import {
  useActivateAgencyMutation,
  useMembershipsQuery,
  useProfileQuery,
} from "@/lib/query";
import { visibleWorkspaceNavItems } from "@/lib/workspace-access";
import {
  getWorkspaceUrl,
  getRootDomainUrl,
  getWorkspaceHref,
  getHelpHref,
  getCentralAppHref,
} from "@/lib/workspace-url";
import {
  canShowPlatformAdministration,
  platformAdministrationMenuItem,
} from "@/lib/profile-menu";
import { clearAgencyScopedUiState } from "@/lib/workspace-cache";
import {
  rememberedEntityKey,
  useRememberedEntityId,
} from "@/lib/remembered-tab";
import { useDialog } from "@/components/ui/DialogProvider";
import { AgencieLoader } from "@/components/ui/AgencieLoader";
import GlobalSearch from "@/components/GlobalSearch";
import MobileWorkspaceNav from "@/components/MobileWorkspaceNav";
import { billingExpiryWarning, hasBillingRole } from "@/lib/billing-ui";

export default function WorkspaceHeader({
  agencySlug,
}: {
  agencySlug: string;
}) {
  const pathname = usePathname();
  const dialog = useDialog();
  const { agency, agencyDisplayName } = useAgency();
  const displayName = agencyDisplayName || agencySlug;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: profile } = useProfileQuery();
  const { data: memberships } = useMembershipsQuery();
  const activateAgencyMutation = useActivateAgencyMutation();
  const agencies = memberships?.agencies ?? [];
  const canBillAnyAgency = agencies.some(hasBillingRole);
  const accessWarning = agency ? billingExpiryWarning(agency) : null;
  const baseNavItems = visibleWorkspaceNavItems(
    agency,
    agencySlug,
    profile?.id,
  );
  const rememberedClientId = useRememberedEntityId(
    rememberedEntityKey("client", agency?.id),
  );
  const rememberedCampaignId = useRememberedEntityId(
    rememberedEntityKey("campaign", agency?.id),
  );
  const rememberedGigId = useRememberedEntityId(
    rememberedEntityKey("gig", agency?.id),
  );
  const rememberedWorkflowId = useRememberedEntityId(
    rememberedEntityKey("workflow", agency?.id),
  );

  const navItems = useMemo(() => {
    const rememberedByKey = {
      clients: rememberedClientId
        ? `/clients/${rememberedClientId}`
        : "/clients",
      campaigns: rememberedCampaignId
        ? `/campaigns/${rememberedCampaignId}`
        : "/campaigns",
      gigs: rememberedGigId ? `/gigs/${rememberedGigId}` : "/gigs",
      workflow: rememberedWorkflowId
        ? `/workflow/${rememberedWorkflowId}`
        : `/workflow`,
    };

    return baseNavItems.map((item) => {
      const rememberedPath =
        rememberedByKey[item.key as keyof typeof rememberedByKey];

      return {
        ...item,
        baseHrefValue: getWorkspaceHref(agencySlug, item.href),
        hrefValue: rememberedPath
          ? getWorkspaceHref(agencySlug, rememberedPath)
          : item.hrefValue,
      };
    });
  }, [
    agencySlug,
    baseNavItems,
    rememberedCampaignId,
    rememberedClientId,
    rememberedGigId,
    rememberedWorkflowId,
  ]);
  const [switchingAgencyId, setSwitchingAgencyId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node))
        return;
      setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const roleLabel =
    agency?.roles?.map((role) => role.key).join(", ") ||
    agency?.role ||
    "Member";
  const isOwner =
    agency?.roles?.some((role) => role.key === "OWNER") ||
    agency?.role === "OWNER";
  const profileName = profile?.name || "My Profile";
  const initials = profileName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const platformAdministrationItem =
    platformAdministrationMenuItem(getCentralAppHref);

  const switchWorkspace = async (targetAgency: Agency) => {
    if (targetAgency.id === agency?.id) {
      setIsMenuOpen(false);
      return;
    }

    setSwitchingAgencyId(targetAgency.id);
    setIsMenuOpen(false);

    try {
      const previousAgencyId = agency?.id;

      const response = await activateAgencyMutation.mutateAsync(
        targetAgency.id,
      );

      clearAgencyScopedUiState(previousAgencyId, response.activeAgencyId);

      window.location.assign(getWorkspaceUrl(response.agency.slug));
    } catch (error) {
      setSwitchingAgencyId(null);

      console.error("Failed to switch workspace", error);

      void dialog.alert({
        title: "Unable to switch workspace",
        description: "Please check your network connection and try again.",
        variant: "error",
      });
    }
  };

  const confirmLogout = async () => {
    const confirmed = await dialog.confirm({
      title: "Logout from AGENCIE?",
      description: "You will be signed out of your current session.",
      confirmText: "Logout",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (confirmed) {
      logout();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-zinc-800/70 bg-[#09090b]/95 backdrop-blur-xl">
        {accessWarning && (
          <div className="flex min-h-10 items-center justify-center gap-3 bg-amber-400/10 px-3 text-center text-sm text-amber-800">
            <span>{accessWarning}</span>
            {agency ? (
              <Link
                className="font-semibold underline"
                href={getCentralAppHref(`/billing?agencyId=${agency.id}`)}
              >
                Extend access
              </Link>
            ) : null}
          </div>
        )}
        <div className="flex min-h-14 w-full items-center justify-between px-3 py-1.5 md:px-4 lg:px-5">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-indigo-500/15 px-3 py-2 text-sm font-semibold text-indigo-200">
              {displayName}
            </div>
          </div>
          <nav className="hidden items-center gap-1 text-sm text-zinc-400 lg:flex">
            {navItems.map((item) => (
              <WorkspaceNavLink
                key={item.label}
                href={item.hrefValue}
                label={item.label}
                isActive={isActivePath(pathname, item.baseHrefValue)}
              />
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex min-h-11 items-center rounded-md px-3 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
              aria-label="Search AGENCIE"
            >
              <Search aria-hidden="true" className="h-5 w-5 lg:hidden" />
              <span className="hidden lg:inline">
                Search
                <kbd className="ml-2 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  ⌘K
                </kbd>
              </span>
            </button>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((value) => !value)}
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800"
                aria-label="Open profile menu"
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </button>

              {isMenuOpen ? (
                <div className="fixed inset-x-2 top-16 z-[100] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-3 md:w-80">
                  <div className="border-b border-zinc-800 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-indigo-500/15 text-sm font-semibold text-indigo-200">
                        {profile?.avatarUrl ? (
                          <img
                            src={profile.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {profileName}
                        </div>
                        <div className="truncate text-xs uppercase tracking-wider text-zinc-500">
                          {roleLabel} • {displayName}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {profile?.email || "Email unavailable"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-zinc-800 p-2">
                    <MenuLink
                      href={getWorkspaceHref(agencySlug, "/settings/profile")}
                      label="My Profile"
                      onClick={() => setIsMenuOpen(false)}
                    />

                    <MenuLink
                      href={getWorkspaceHref(agencySlug, "/settings/status")}
                      label="Status"
                      onClick={() => setIsMenuOpen(false)}
                    />

                    <MenuLink
                      href={getWorkspaceHref(
                        agencySlug,
                        "/settings/appearance",
                      )}
                      label="Appearance"
                      onClick={() => setIsMenuOpen(false)}
                    />
                    <div className="flex min-h-11 cursor-not-allowed items-center rounded-md px-3 text-sm text-zinc-600">
                      Notifications
                    </div>
                    {canShowPlatformAdministration(profile) ? (
                      <div className="mt-2 border-t border-zinc-800 pt-2">
                        <MenuLink
                          href={platformAdministrationItem.href}
                          label={platformAdministrationItem.label}
                          onClick={() => setIsMenuOpen(false)}
                          openInNewTab
                        />
                      </div>
                    ) : null}
                    {canBillAnyAgency ? (
                      <MenuLink
                        href={getCentralAppHref(
                          `/billing?agencyId=${encodeURIComponent(agency?.id ?? "")}`,
                        )}
                        label="Billing & Plans"
                        onClick={() => setIsMenuOpen(false)}
                      />
                    ) : null}
                  </div>

                  <div className="border-b border-zinc-800 p-2">
                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                      Switch Workspace
                    </div>
                    {agencies.map((item) => {
                      const isSwitching = switchingAgencyId === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={switchingAgencyId !== null}
                          onClick={() => switchWorkspace(item)}
                          className="flex min-h-11 w-full items-center justify-between rounded-md px-3 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white disabled:cursor-wait disabled:opacity-60"
                        >
                          <span>{item.displayName || item.name}</span>

                          {item.id === agency?.id ? (
                            <span className="text-xs text-indigo-300">
                              Active
                            </span>
                          ) : isSwitching ? (
                            <span className="text-xs text-zinc-400">
                              Switching…
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    <MenuLink
                      href={`${getRootDomainUrl()}/create-agency`}
                      label="+ Create another agency"
                      onClick={() => setIsMenuOpen(false)}
                    />
                    {isOwner ? (
                      <MenuLink
                        href={getWorkspaceHref(agencySlug, "/settings/agency")}
                        label="Agency Settings"
                        onClick={() => setIsMenuOpen(false)}
                      />
                    ) : null}
                  </div>

                  <div className="p-2">
                    <MenuLink
                      href={getHelpHref()}
                      label="Help & Support"
                      onClick={() => setIsMenuOpen(false)}
                    />
                    <button
                      type="button"
                      onClick={confirmLogout}
                      className="min-h-11 w-full rounded-md px-3 text-left text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : null}
              {switchingAgencyId ? (
                <AgencieLoader
                  variant="overlay"
                  label="Switching workspace"
                  sublabel="Opening your agency…"
                />
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <MobileWorkspaceNav
        agency={agency}
        pathname={pathname}
        navItems={navItems}
      />
      <GlobalSearch
        agency={agency}
        userId={profile?.id}
        agencySlug={agencySlug}
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
      />
    </>
  );
}

function WorkspaceNavLink({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 transition ${
        isActive
          ? "bg-indigo-500/15 text-indigo-200"
          : "hover:bg-zinc-900 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function MenuLink({
  href,
  label,
  onClick,
  openInNewTab = false,
}: {
  href: string;
  label: string;
  onClick: () => void;
  openInNewTab?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
      className="flex min-h-11 items-center rounded-md px-3 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
    >
      {label}
    </Link>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
