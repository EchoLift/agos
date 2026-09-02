export const SUBSCRIPTION_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELLED",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
