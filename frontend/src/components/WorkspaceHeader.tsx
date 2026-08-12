"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useAgency } from "@/components/AgencyProvider";
import { logout } from "@/lib/auth";
import { getProfile, Profile } from "@/lib/api/me";
import { activateAgency, Agency, getMyMemberships } from "@/lib/api/organization";
import { visibleWorkspaceNavItems } from "@/lib/workspace-access";
import { getWorkspaceUrl } from "@/lib/workspace-url";
import { clearAgencyScopedUiState } from "@/lib/workspace-cache";
import GlobalSearch from "@/components/GlobalSearch";
import MobileWorkspaceNav from "@/components/MobileWorkspaceNav";

export default function WorkspaceHeader({ agencySlug }: { agencySlug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { agency, agencyDisplayName } = useAgency();
  const displayName = agencyDisplayName || agencySlug;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navItems = visibleWorkspaceNavItems(agency, agencySlug, profile?.id);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getProfile(), getMyMemberships()])
      .then(([profileData, membershipData]) => {
        if (!isMounted) return;
        setProfile(profileData);
        setAgencies(membershipData.agencies);
      })
      .catch(() => {
        if (!isMounted) return;
        setProfile(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return;
      setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const roleLabel = agency?.roles?.map((role) => role.key).join(", ") || agency?.role || "Member";
  const isOwner = agency?.roles?.some((role) => role.key === "OWNER") || agency?.role === "OWNER";
  const profileName = profile?.name || "My Profile";
  const initials = profileName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const switchWorkspace = async (targetAgency: Agency) => {
    const previousAgencyId = agency?.id;
    const response = await activateAgency(targetAgency.id);
    clearAgencyScopedUiState(previousAgencyId, response.activeAgencyId);
    setAgencies((items) => items.map((item) => (item.id === response.agency.id ? { ...item, ...response.agency } : item)));
    setIsMenuOpen(false);
    const targetUrl = getWorkspaceUrl(response.agency.slug);
    if (typeof window !== "undefined") {
      window.location.href = targetUrl;
    } else {
      router.push(`/${response.agency.slug}`);
    }
  };

  const confirmLogout = () => {
    const confirmed = window.confirm("Logout from AGOS?");
    if (confirmed) {
      logout();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-zinc-800/70 bg-[#09090b]/95 backdrop-blur-xl">
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
                isActive={isActivePath(pathname, item.hrefValue, agencySlug)}
              />
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex min-h-11 items-center rounded-md px-3 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
              aria-label="Search AGOS"
            >
              <Search aria-hidden="true" className="h-5 w-5 lg:hidden" />
              <span className="hidden lg:inline">
                Search
                <kbd className="ml-2 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">⌘K</kbd>
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
                  <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </button>

          {isMenuOpen ? (
            <div className="fixed inset-x-2 top-16 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-3 md:w-80">
              <div className="border-b border-zinc-800 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-indigo-500/15 text-sm font-semibold text-indigo-200">
                    {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{profileName}</div>
                    <div className="truncate text-xs uppercase tracking-wider text-zinc-500">{roleLabel} • {displayName}</div>
                    <div className="truncate text-xs text-zinc-500">{profile?.email || "Email unavailable"}</div>
                  </div>
                </div>
              </div>

              <div className="border-b border-zinc-800 p-2">
                <MenuLink href={`/${agencySlug}/settings/profile`} label="My Profile" onClick={() => setIsMenuOpen(false)} />
                <MenuLink href={`/${agencySlug}/settings/status`} label="Status" onClick={() => setIsMenuOpen(false)} />
                <MenuLink href={`/${agencySlug}/settings/appearance`} label="Appearance" onClick={() => setIsMenuOpen(false)} />
                <div className="flex min-h-11 cursor-not-allowed items-center rounded-md px-3 text-sm text-zinc-600">Notifications</div>
              </div>

              <div className="border-b border-zinc-800 p-2">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">Switch Workspace</div>
                {agencies.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchWorkspace(item)}
                    className="flex min-h-11 w-full items-center justify-between rounded-md px-3 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                  >
                    <span>{item.displayName || item.name}</span>
                    {item.id === agency?.id ? <span className="text-xs text-indigo-300">Active</span> : null}
                  </button>
                ))}
                <MenuLink href="/create-agency" label="+ Create another agency" onClick={() => setIsMenuOpen(false)} />
                {isOwner ? (
                  <MenuLink href={`/${agencySlug}/settings/agency`} label="Agency Settings" onClick={() => setIsMenuOpen(false)} />
                ) : null}
              </div>

              <div className="p-2">
                <MenuLink href="/help" label="Help & Support" onClick={() => setIsMenuOpen(false)} />
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
            </div>
          </div>
        </div>
      </header>
      <MobileWorkspaceNav agency={agency} agencySlug={agencySlug} pathname={pathname} navItems={navItems} />
      <GlobalSearch agency={agency} agencySlug={agencySlug} userId={profile?.id} open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  );
}

function WorkspaceNavLink({ href, label, isActive }: { href: string; label: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 transition ${
        isActive ? "bg-indigo-500/15 text-indigo-200" : "hover:bg-zinc-900 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function MenuLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex min-h-11 items-center rounded-md px-3 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white">
      {label}
    </Link>
  );
}

function isActivePath(pathname: string, href: string, agencySlug: string) {
  if (href === `/${agencySlug}`) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
