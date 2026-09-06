import { apiClient } from "../api-client";
import type { SubscriptionRecord } from "./platform-admin";

export type BillingPlan = {
  id: string;
  code: string;
  name: string;
  durationMonths: number;
  priceAmountMinor: number;
  finalAmountMinor: number;
  currency: "INR";
  teamLimit: number | null;
  displayOrder: number;
  discount: { name: string; amountMinor: number } | null;
};

export type BillingAgency = {
  agency: { id: string; name: string; slug: string };
  role: "OWNER" | "FINANCE";
  subscription: SubscriptionRecord | null;
  activeMembers: number;
  teamLimit: number | null;
  renewalAvailableAt: string | null;
  paymentHistory: Array<{
    id: string;
    planCodeSnapshot: string | null;
    planNameSnapshot: string | null;
    period: string | null;
    amountMinor: number;
    currency: string;
    status: string;
    paidAt: string | null;
    entitlementEndsAt: string | null;
    createdAt: string;
  }>;
};

export const getBillingAgencies = () =>
  apiClient<BillingAgency[]>("/billing/agencies");
export const getBillingPlans = (agencyId?: string) =>
  apiClient<BillingPlan[]>(
    `/billing/plans${agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : ""}`,
  );
export const createBillingOrder = (agencyId: string, planId: string) =>
  apiClient<{
    orderId: string;
    paymentSessionId: string;
    environment: "sandbox" | "production";
  }>(`/billing/agencies/${agencyId}/orders`, {
    method: "POST",
    agencyId,
    body: JSON.stringify({ planId }),
  });
export const getBillingOrder = (id: string) =>
  apiClient<{
    id: string;
    status: string;
    agency: { displayName: string | null; name: string; slug: string };
  }>(`/billing/orders/${id}`);
