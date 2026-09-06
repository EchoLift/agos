import { apiClient } from "../api-client";
import { SubscriptionStatus } from "./organization";

export interface SubscriptionRecord {
  id: string;
  agencyId: string;
  status: SubscriptionStatus;
  plan: string;
  trialEndsAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PlatformActivity {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}
export interface AdminAgency {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  status: string;
  createdAt: string;
  subscription: SubscriptionRecord | null;
  memberCount: number;
  lastActivity: { eventType: string; createdAt: string } | null;
}

export const getPlatformOverview = () =>
  apiClient<{
    totalAgencies: number;
    entitledAgencies: number;
    activeAgencies: number;
    trialAgencies: number;
    suspendedAgencies: number;
    totalUsers: number;
    totalMemberships: number;
    recentActivity: Array<
      PlatformActivity & {
        agencyId: string;
        agency: { displayName: string; name: string; slug: string };
      }
    >;
  }>("/platform-admin/overview");

export const getPlatformAgencies = (page = 1) =>
  apiClient<{
    items: AdminAgency[];
    page: number;
    total: number;
    totalPages: number;
  }>(`/platform-admin/agencies?page=${page}&pageSize=25`);

export const getPlatformAgency = (agencyId: string) =>
  apiClient<{
    agency: Omit<AdminAgency, "memberCount" | "lastActivity">;
    metrics: Record<string, number>;
    members: Array<{
      id: string;
      joinedAt: string;
      user: { id: string; name: string | null; avatarUrl: string | null };
      role: { displayName: string; systemRole: { key: string } };
    }>;
    recentActivity: PlatformActivity[];
  }>(`/platform-admin/agencies/${agencyId}`);

export const updateAgencyEntitlement = (
  agencyId: string,
  input: {
    status: SubscriptionStatus;
    plan: string;
    trialEndsAt?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
  },
) =>
  apiClient<SubscriptionRecord>(
    `/platform-admin/agencies/${agencyId}/entitlement`,
    { method: "PATCH", body: JSON.stringify(input) },
  );

export type AdminPricingPlan = {
  id: string;
  code: string;
  name: string;
  durationMonths: number;
  priceAmountMinor: number;
  currency: string;
  teamLimit: number | null;
  isActive: boolean;
  displayOrder: number;
  archivedAt: string | null;
  _count: { paymentOrders: number };
};
export type AdminPricingDiscount = {
  id: string;
  name: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  maxRedemptions: number | null;
  maxRedemptionsPerAgency: number | null;
  plans: Array<{ plan: AdminPricingPlan }>;
  _count: { redemptions: number };
};
export type PricingPlanInput = {
  code?: string;
  name: string;
  durationMonths: number;
  priceAmountMinor: number;
  teamLimit: number | null;
  isActive: boolean;
  displayOrder: number;
};
export type PricingDiscountInput = {
  name: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  maxRedemptions: number | null;
  maxRedemptionsPerAgency: number | null;
  planIds: string[];
};
export const getAdminPricingPlans = () =>
  apiClient<AdminPricingPlan[]>("/platform-admin/pricing/plans");
export const createAdminPricingPlan = (
  input: PricingPlanInput & { code: string },
) =>
  apiClient<AdminPricingPlan>("/platform-admin/pricing/plans", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const updateAdminPricingPlan = (
  id: string,
  input: Partial<PricingPlanInput>,
) =>
  apiClient<AdminPricingPlan>(`/platform-admin/pricing/plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
export const getAdminPricingDiscounts = () =>
  apiClient<AdminPricingDiscount[]>("/platform-admin/pricing/discounts");
export const createAdminPricingDiscount = (input: PricingDiscountInput) =>
  apiClient<AdminPricingDiscount>("/platform-admin/pricing/discounts", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const updateAdminPricingDiscount = (
  id: string,
  input: Partial<PricingDiscountInput>,
) =>
  apiClient<AdminPricingDiscount>(`/platform-admin/pricing/discounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
