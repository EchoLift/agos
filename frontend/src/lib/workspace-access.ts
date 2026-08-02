import { Agency } from "@/lib/api/organization";

export type WorkspaceNavKey = "dashboard" | "clients" | "campaigns" | "content" | "workflow" | "calendar" | "team";

export interface WorkspaceNavItem {
  key: WorkspaceNavKey;
  label: string;
  shortLabel: string;
  href: (slug: string) => string;
}

export const workspaceNavItems: WorkspaceNavItem[] = [
  { key: "dashboard", label: "Dashboard", shortLabel: "DB", href: (slug) => `/${slug}` },
  { key: "clients", label: "Clients", shortLabel: "CL", href: (slug) => `/${slug}/clients` },
  { key: "campaigns", label: "Campaigns", shortLabel: "CP", href: (slug) => `/${slug}/campaigns` },
  { key: "content", label: "Content", shortLabel: "CT", href: (slug) => `/${slug}/content` },
  { key: "workflow", label: "Workflow", shortLabel: "WF", href: (slug) => `/${slug}/workflow` },
  { key: "calendar", label: "Calendar", shortLabel: "CA", href: (slug) => `/${slug}/calendar` },
  { key: "team", label: "Team", shortLabel: "TM", href: (slug) => `/${slug}/team` },
];

const navByKey = new Map(workspaceNavItems.map((item) => [item.key, item]));

const roleTestingUserIds = new Set(
  (process.env.NEXT_PUBLIC_DEV_ROLE_TESTING_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

const isRoleTestingOverrideEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DEV_ROLE_TESTING_OVERRIDE_ENABLED === "true";

const roleAccess: Record<string, WorkspaceNavKey[]> = {
  OWNER: ["dashboard", "clients", "campaigns", "content", "workflow", "calendar", "team"],
  ADMIN: ["dashboard", "clients", "campaigns", "content", "workflow", "calendar", "team"],
  MANAGER: ["dashboard", "campaigns", "workflow", "calendar", "team"],
  WRITER: ["dashboard", "campaigns", "workflow", "calendar"],
  DOP: ["dashboard", "campaigns", "workflow", "calendar"],
  EDITOR: ["dashboard", "campaigns", "workflow", "calendar"],
  DESIGNER: ["dashboard", "campaigns", "workflow", "calendar"],
  SOCIAL_MEDIA_MANAGER: ["dashboard", "campaigns", "calendar"],
  FINANCE: ["dashboard", "clients"],
  HR: ["dashboard", "team"],
  CLIENT: ["dashboard", "campaigns", "calendar"],
  MEMBER: ["dashboard", "campaigns", "workflow", "calendar"],
};

export function visibleWorkspaceNavItems(agency: Agency | null, slug: string, userId?: string | null) {
  const keys = allowedNavKeys(agency, userId);
  return workspaceNavItems.filter((item) => keys.has(item.key)).map((item) => ({
    ...item,
    label: item.key === "dashboard" ? workspaceHomeLabel(agency) : item.label,
    shortLabel: item.key === "dashboard" ? workspaceHomeShortLabel(agency) : item.shortLabel,
    hrefValue: item.href(slug),
  }));
}

export function allowedNavKeys(agency: Agency | null, userId?: string | null) {
  const roleKeys = getAgencyRoleKeys(agency);
  const keys = new Set<WorkspaceNavKey>(["dashboard"]);

  roleKeys.forEach((roleKey) => {
    roleAccess[roleKey]?.forEach((navKey) => keys.add(navKey));
  });

  if (isRoleTestingOverrideEnabled && userId && roleTestingUserIds.has(userId)) {
    keys.add("team");
  }

  return keys;
}

export function roleAccessLabels(roleKeyOrName: string) {
  const key = normalizeRoleKey(roleKeyOrName);
  const access = roleAccess[key] ?? roleAccess.MEMBER;
  return access.map((item) => navByKey.get(item)?.label).filter((label): label is string => Boolean(label));
}

export function canAccessWorkspacePath(pathname: string, agency: Agency | null, slug: string, userId?: string | null) {
  const relativePath = pathname.replace(`/${slug}`, "") || "/";
  const allowed = allowedNavKeys(agency, userId);

  if (relativePath === "/") return true;
  if (relativePath.startsWith("/settings/profile") || relativePath.startsWith("/settings/status") || relativePath.startsWith("/settings/appearance")) {
    return true;
  }
  if (relativePath.startsWith("/settings/agency")) return hasAnyRole(agency, ["OWNER", "ADMIN"]);
  if (relativePath === "/campaigns/new") return hasAnyRole(agency, ["OWNER", "ADMIN", "MANAGER"]);
  if (relativePath === "/clients/new") return hasAnyRole(agency, ["OWNER", "ADMIN", "MANAGER"]);
  if (relativePath === "/content/new") return hasAnyRole(agency, ["OWNER", "ADMIN", "MANAGER"]);
  if (relativePath === "/team/new") return hasAnyRole(agency, ["OWNER", "ADMIN", "MANAGER"]);

  if (relativePath.startsWith("/clients")) return allowed.has("clients");
  if (relativePath.startsWith("/campaigns")) return allowed.has("campaigns");
  if (relativePath.startsWith("/content")) return allowed.has("content");
  if (relativePath.startsWith("/workflow")) return allowed.has("workflow");
  if (relativePath.startsWith("/calendar")) return allowed.has("calendar");
  if (relativePath.startsWith("/team")) return allowed.has("team");

  return true;
}

export function hasAnyRole(agency: Agency | null, roleKeys: string[]) {
  const normalized = new Set(roleKeys.map(normalizeRoleKey));
  return getAgencyRoleKeys(agency).some((roleKey) => normalized.has(roleKey));
}

export function isBusinessDashboardRole(agency: Agency | null) {
  return hasAnyRole(agency, ["OWNER", "ADMIN", "MANAGER"]);
}

export function isProductionWorkspaceRole(agency: Agency | null) {
  return hasAnyRole(agency, ["WRITER", "DOP", "EDITOR", "DESIGNER", "SOCIAL_MEDIA_MANAGER", "MEMBER"]) && !isBusinessDashboardRole(agency);
}

export function workspaceHomeLabel(agency: Agency | null) {
  return isProductionWorkspaceRole(agency) ? "My Work" : "Dashboard";
}

export function workspaceHomeShortLabel(agency: Agency | null) {
  return isProductionWorkspaceRole(agency) ? "MW" : "DB";
}

export function getAgencyRoleKeys(agency: Agency | null) {
  const rawRoles = [
    agency?.role,
    ...(agency?.roles?.flatMap((role) => [role.key, role.name]) ?? []),
  ].filter((role): role is string => Boolean(role));

  return Array.from(new Set(rawRoles.map(normalizeRoleKey)));
}

export function normalizeRoleKey(role: string) {
  return role.trim().replace(/[\s-]+/g, "_").toUpperCase();
}
