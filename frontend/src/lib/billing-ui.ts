import type { Agency } from "./api/organization";
export const hasBillingRole = (agency: Agency) =>
  [agency.role, ...(agency.roles?.map((r) => r.key) ?? [])].some(
    (r) => r === "OWNER" || r === "FINANCE",
  );
export function expiryWarning(agency: Agency, now = new Date()) {
  const raw =
    agency.entitlement?.status === "TRIAL"
      ? agency.entitlement.trialEndsAt
      : agency.entitlement?.endsAt;
  if (!raw) return null;
  const end = new Date(raw);
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const endDay = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );
  const days = Math.round((endDay - today) / 86400000);
  if (days < 0 || days > 5) return null;
  return days === 0
    ? "Your AGENCIE access expires today."
    : days === 1
      ? "Your AGENCIE access expires tomorrow."
      : `Your AGENCIE access expires in ${days} days.`;
}

export function billingExpiryWarning(agency: Agency, now = new Date()) {
  return hasBillingRole(agency) ? expiryWarning(agency, now) : null;
}
