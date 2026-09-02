import type { SubscriptionRecord } from "./api/platform-admin";
import type { SubscriptionStatus } from "./subscription-status";

export type EntitlementEditorValues = {
  status: SubscriptionStatus;
  plan: string;
  trialEndsAt: string;
  startsAt: string | null;
  endsAt: string;
};

export type EntitlementAction = "SUSPEND" | "CANCEL" | "REACTIVATE";

export function entitlementActions(
  status: SubscriptionStatus | null,
): EntitlementAction[] {
  if (status === "TRIAL" || status === "ACTIVE") {
    return ["SUSPEND", "CANCEL"];
  }
  if (status === "SUSPENDED" || status === "PAST_DUE") {
    return ["REACTIVATE", "CANCEL"];
  }
  if (status === "CANCELLED") return ["REACTIVATE"];
  return [];
}

export function entitlementEditorValues(
  subscription: SubscriptionRecord | null,
): EntitlementEditorValues {
  return {
    status: subscription?.status ?? "TRIAL",
    plan: subscription?.plan ?? "PILOT",
    trialEndsAt: toLocalDateTime(subscription?.trialEndsAt),
    startsAt: subscription?.startsAt ?? null,
    endsAt: toLocalDateTime(subscription?.endsAt),
  };
}

export function validateEntitlementEditor(
  values: EntitlementEditorValues,
  now = new Date(),
): string | null {
  if (!values.plan.trim()) return "Plan is required.";
  if (values.status !== "TRIAL") return null;
  if (!values.trialEndsAt) return "A trial end date is required for TRIAL.";

  const trialEndsAt = new Date(values.trialEndsAt);
  if (!Number.isFinite(trialEndsAt.getTime()) || trialEndsAt <= now) {
    return "Trial end date must be in the future for TRIAL.";
  }
  return null;
}

export function entitlementPatchPayload(values: EntitlementEditorValues) {
  return {
    status: values.status,
    plan: values.plan.trim(),
    // Existing dates stay in the payload when status changes so suspension or
    // cancellation does not erase subscription history.
    trialEndsAt: toIsoOrNull(values.trialEndsAt),
    startsAt: values.startsAt,
    endsAt: toIsoOrNull(values.endsAt),
  };
}

export function entitlementActionPayload(
  subscription: SubscriptionRecord,
  status: SubscriptionStatus,
) {
  return entitlementPatchPayload({
    ...entitlementEditorValues(subscription),
    status,
  });
}

export async function runConfirmedEntitlementAction<T>(input: {
  confirmed: boolean;
  payload: ReturnType<typeof entitlementPatchPayload>;
  mutate: (payload: ReturnType<typeof entitlementPatchPayload>) => Promise<T>;
}): Promise<T | null> {
  if (!input.confirmed) return null;
  return input.mutate(input.payload);
}

export function validateReactivation(
  values: EntitlementEditorValues,
  now = new Date(),
): string | null {
  if (values.status !== "TRIAL" && values.status !== "ACTIVE") {
    return "Choose TRIAL or ACTIVE when reactivating access.";
  }
  const baseError = validateEntitlementEditor(values, now);
  if (baseError) return baseError;
  if (values.status === "ACTIVE" && values.endsAt) {
    const endsAt = new Date(values.endsAt);
    if (!Number.isFinite(endsAt.getTime()) || endsAt <= now) {
      return "Choose a future subscription end date, or clear it for open-ended ACTIVE access.";
    }
  }
  return null;
}

export const platformEntitlementQueryKeys = (agencyId: string) => [
  ["platform-admin", "agency", agencyId] as const,
  ["platform-admin", "overview"] as const,
  ["platform-admin", "agencies"] as const,
];

export async function invalidatePlatformEntitlementQueries(
  agencyId: string,
  invalidate: (queryKey: readonly string[]) => Promise<unknown>,
) {
  await Promise.all(
    platformEntitlementQueryKeys(agencyId).map((queryKey) =>
      invalidate(queryKey),
    ),
  );
}

function toIsoOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function toLocalDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
