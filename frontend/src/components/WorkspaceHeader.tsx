"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAgency } from "@/components/AgencyProvider";
import { logout } from "@/lib/auth";
import { getProfile, Profile } from "@/lib/api/me";
import { activateAgency, Agency, getMyMemberships } from "@/lib/api/organization";
import { visibleWorkspaceNavItems } from "@/lib/workspace-access";
import { clearAgencyScopedUiState } from "@/lib/workspace-cache";

export default function WorkspaceHeader({ agencySlug }: { agencySlug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { agency, agencyDisplayName } = useAgency();
  const displayName = agencyDisplayName || agencySlug;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
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
    router.push(`/${response.agency.slug}`);
    router.refresh();
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
      <div className="flex w-full items-center justify-between px-3 py-3 md:px-4 lg:px-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-500/15 px-3 py-2 font-semibold text-indigo-200 text-sm">
            {displayName}
          </div>
        </div>
        <nav className="hidden items-center gap-1 text-sm text-zinc-400 md:flex">
          {navItems.map((item) => (
            <WorkspaceNavLink
              key={item.label}
              href={item.hrefValue}
              label={item.label}
              isActive={isActivePath(pathname, item.hrefValue, agencySlug)}
            />
          ))}
        </nav>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800"
            aria-label="Open profile menu"
          >
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </button>

          {isMenuOpen ? (
            <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40">
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
                <div className="cursor-not-allowed rounded-xl px-3 py-2 text-sm text-zinc-600">Notifications</div>
              </div>

              <div className="border-b border-zinc-800 p-2">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">Switch Workspace</div>
                {agencies.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchWorkspace(item)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
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
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
    <aside className="fixed left-0 top-[65px] bottom-0 z-20 w-20 border-r border-zinc-800/70 bg-[#09090b]/95 px-2 py-4 backdrop-blur-xl md:hidden">
      <nav className="flex h-full flex-col items-center gap-2">
        {navItems.map((item) => {
          const href = item.hrefValue;
          const isActive = isActivePath(pathname, href, agencySlug);

          return (
            <Link
              key={item.label}
              href={href}
              title={item.label}
              aria-label={item.label}
              className={`flex w-full flex-col items-center rounded-2xl px-2 py-2 text-center transition ${
                isActive
                  ? "bg-indigo-500/15 text-indigo-200"
                  : "text-zinc-500 hover:bg-zinc-900/30 hover:text-white"
              }`}
            >
              <span className="text-xs font-semibold">{item.shortLabel}</span>
              <span className="mt-1 max-w-full truncate text-[10px] leading-3">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
    </>
  );
}

function WorkspaceNavLink({ href, label, isActive }: { href: string; label: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-2 transition ${
        isActive ? "bg-indigo-500/15 text-indigo-200" : "hover:bg-zinc-900 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function MenuLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="block rounded-xl px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white">
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
