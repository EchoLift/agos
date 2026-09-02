import type { Profile } from "./api/me";

export const PLATFORM_ADMIN_PATH = "/platform-admin";

export function canShowPlatformAdministration(
  profile: Pick<Profile, "platformRole"> | null | undefined,
): boolean {
  return profile?.platformRole === "ADMIN";
}

export function platformAdministrationMenuItem(
  centralHref: (path: string) => string,
) {
  return {
    label: "Platform Administration",
    href: centralHref(PLATFORM_ADMIN_PATH),
    target: "_blank" as const,
    rel: "noopener noreferrer",
  };
}
