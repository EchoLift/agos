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

export interface PlatformActivity { id: string; eventType: string; entityType: string; entityId: string; createdAt: string }
export interface AdminAgency { id: string; name: string; displayName: string; slug: string; status: string; createdAt: string; subscription: SubscriptionRecord | null; memberCount: number; lastActivity: { eventType: string; createdAt: string } | null }

export const getPlatformOverview = () => apiClient<{
  totalAgencies: number; entitledAgencies: number; activeAgencies: number; trialAgencies: number;
  suspendedAgencies: number; totalUsers: number; totalMemberships: number; recentActivity: Array<PlatformActivity & { agencyId: string; agency: { displayName: string; name: string; slug: string } }>;
}>("/platform-admin/overview");

export const getPlatformAgencies = (page = 1) => apiClient<{ items: AdminAgency[]; page: number; total: number; totalPages: number }>(`/platform-admin/agencies?page=${page}&pageSize=25`);

export const getPlatformAgency = (agencyId: string) => apiClient<{
  agency: Omit<AdminAgency, "memberCount" | "lastActivity">;
  metrics: Record<string, number>;
  members: Array<{ id: string; joinedAt: string; user: { id: string; name: string | null; avatarUrl: string | null }; role: { displayName: string; systemRole: { key: string } } }>;
  recentActivity: PlatformActivity[];
}>(`/platform-admin/agencies/${agencyId}`);

export const updateAgencyEntitlement = (agencyId: string, input: {
  status: SubscriptionStatus; plan: string; trialEndsAt?: string | null; startsAt?: string | null; endsAt?: string | null;
}) => apiClient<SubscriptionRecord>(`/platform-admin/agencies/${agencyId}/entitlement`, { method: "PATCH", body: JSON.stringify(input) });
