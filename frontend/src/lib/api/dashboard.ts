import { apiClient } from "../api-client";

export interface DashboardData {
  myTasks: Array<{
    id: string;
    title: string;
    contentAssetId: string | null;
    displayCode: string | null;
    campaignId: string | null;
    clientId: string | null;
    contentAssetTitle: string;
    status: string;
    deadlineAt: string | null;
    stage: string | null;
  }>;
  pendingApprovals: number;
  blockedContent: number;
  overdueContent: number;
  publishingToday: number;
  activity: Array<{
    id: string;
    contentAssetId: string | null;
    displayCode: string | null;
    campaignId: string | null;
    clientId: string | null;
    contentAssetTitle: string;
    toStage: string | null;
    createdAt: string;
  }>;
  riskSummary: {
    activeClients: number;
    activeCampaigns: number;
    activeContent: number;
    blockedItems: number;
  };
}

export async function getDashboardData(agencyId: string): Promise<DashboardData> {
  return apiClient<DashboardData>("/dashboard", {
    method: "GET",
    agencyId,
  });
}
