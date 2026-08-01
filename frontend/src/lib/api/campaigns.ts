import { apiClient } from "../api-client";

export interface Campaign {
  id: string;
  agencyId?: string;
  clientId: string;
  name: string;
  campaignCode?: string | null;
  campaignType?: string | null;
  priority?: string | null;
  objectives?: string | null;
  goal?: string | null;
  primaryKpi?: string | null;
  targetAudience?: string | null;
  useClientAudience?: boolean;
  keyMessage?: string | null;
  cta?: string | null;
  reviewFrequency?: string | null;
  workingDays?: string | null;
  launchDate?: string | null;
  timezone?: string | null;
  workflowTemplate?: string | null;
  clientApprover?: string | null;
  agencyApproverMembershipId?: string | null;
  approvalSla?: string | null;
  revisionLimit?: string | null;
  references?: string | null;
  moodBoardUrl?: string | null;
  driveFolderUrl?: string | null;
  internalNotes?: string | null;
  autoGenerateCalendar?: boolean;
  postingDays?: string | null;
  postingWindows?: string | null;
  blackoutDates?: string | null;
  platformMix?: string | null;
  startDate?: string;
  endDate?: string;
  version?: number;
  brief: string | null;
  budget: number | null;
  targetLaunchDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string; displayName?: string | null };
  deliverablePlans?: CampaignDeliverablePlan[];
  publishingSchedules?: PublishingSchedule[];
  assignedMemberships?: Array<{
    id: string;
    name?: string | null;
    user?: { name?: string | null; email?: string | null };
    role?: { displayName?: string | null };
    roles?: Array<{ role?: { displayName?: string | null; systemRole?: { name?: string | null } } }>;
  }>;
  teamAssignments?: CampaignTeamAssignment[];
  agencyApprover?: {
    id: string;
    user?: { name?: string | null };
    role?: { displayName?: string | null };
  } | null;
  contentAssets?: Array<{ id: string; displayCode?: string; title?: string; status: string; riskStatus?: string | null }>;
}

export type CampaignAssignmentRole =
  | "CAMPAIGN_MANAGER"
  | "RELATIONSHIP_MANAGER"
  | "WRITER"
  | "EDITOR"
  | "DESIGNER"
  | "DOP"
  | "SOCIAL_MEDIA_MANAGER"
  | "CLIENT_APPROVER"
  | "AGENCY_APPROVER";

export interface CampaignTeamAssignment {
  id: string;
  agencyId: string;
  campaignId: string;
  membershipId: string;
  assignmentRole: CampaignAssignmentRole;
  createdAt: string;
  updatedAt: string;
  version: number;
  membership: {
    id: string;
    name?: string | null;
    user?: { name?: string | null; email?: string | null };
    role?: { displayName?: string | null; systemRole?: { key?: string | null; displayName?: string | null } };
    roles?: Array<{ role?: { displayName?: string | null; systemRole?: { key?: string | null; displayName?: string | null } } }>;
  };
}

export interface CampaignActivityItem {
  id: string;
  eventType: string;
  occurredAt: string;
  actor: { id: string; name: string } | null;
  message: string;
  metadata: Record<string, unknown>;
}

export interface CampaignActivityResponse {
  items: CampaignActivityItem[];
}

export interface CampaignDeliverablePlan {
  id?: string;
  contentType: string;
  quantity: number;
  frequency?: string | null;
  preferredDays?: string | null;
  preferredTime?: string | null;
  platform?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface PublishingSchedule {
  id?: string;
  platform: string;
  scheduledAt: string;
  status?: string;
  riskStatus?: string;
  readiness?: string;
  readinessReason?: string | null;
  timezone?: string | null;
  caption?: string | null;
  note?: string | null;
  cancellationReason?: string | null;
  publishedAt?: string | null;
  publishedUrl?: string | null;
  version?: number;
  contentAssetId?: string | null;
  contentAsset?: { id: string; displayCode: string; title: string; status: string } | null;
  workflow?: {
    id: string;
    status: string;
    stage?: string | null;
    taskStatus?: string | null;
    owner?: { membershipId: string; name: string } | null;
  } | null;
}

export interface PublishingScheduleAgendaResponse {
  summary: {
    upcoming: number;
    ready: number;
    atRisk: number;
    missed: number;
  };
  items: PublishingSchedule[];
}

export interface CreateCampaignInput {
  clientId: string;
  name: string;
  brief?: string;
  budget?: number;
  targetLaunchDate?: string;
  startDate: string;
  endDate: string;
  objective?: string;
  campaignType?: string | null;
  priority?: string | null;
  goal?: string | null;
  primaryKpi?: string | null;
  targetAudience?: string | null;
  useClientAudience?: boolean;
  keyMessage?: string | null;
  cta?: string | null;
  reviewFrequency?: string | null;
  workingDays?: string | null;
  launchDate?: string | null;
  timezone?: string | null;
  workflowTemplate?: string | null;
  clientApprover?: string | null;
  agencyApproverMembershipId?: string | null;
  approvalSla?: string | null;
  revisionLimit?: string | null;
  references?: string | null;
  moodBoardUrl?: string | null;
  driveFolderUrl?: string | null;
  internalNotes?: string | null;
  autoGenerateCalendar?: boolean;
  postingDays?: string | null;
  postingWindows?: string | null;
  blackoutDates?: string | null;
  platformMix?: string | null;
  assignedMembershipIds?: string[];
  deliverablePlans?: CampaignDeliverablePlan[];
  publishingSchedules?: PublishingSchedule[];
}

export type UpdateCampaignInput = Partial<CreateCampaignInput> & { version?: number };

export async function getCampaigns(agencyId: string): Promise<Campaign[]> {
  return apiClient<Campaign[]>("/campaigns", {
    method: "GET",
    agencyId,
  });
}

export async function getCampaign(agencyId: string, campaignId: string): Promise<Campaign> {
  return apiClient<Campaign>(`/campaigns/${campaignId}`, {
    method: "GET",
    agencyId,
  });
}

export async function createCampaign(agencyId: string, data: CreateCampaignInput): Promise<Campaign> {
  return apiClient<Campaign>("/campaigns", {
    method: "POST",
    agencyId,
    body: JSON.stringify(data),
  });
}

export async function updateCampaign(agencyId: string, campaignId: string, data: UpdateCampaignInput): Promise<Campaign> {
  return apiClient<Campaign>(`/campaigns/${campaignId}`, {
    method: "PATCH",
    agencyId,
    body: JSON.stringify(data),
  });
}

export async function activateCampaign(agencyId: string, campaignId: string, version?: number): Promise<Campaign> {
  return apiClient<Campaign>(`/campaigns/${campaignId}/activate`, {
    method: "POST",
    agencyId,
    body: JSON.stringify({ version }),
  });
}

export async function pauseCampaign(agencyId: string, campaignId: string, version?: number): Promise<Campaign> {
  return apiClient<Campaign>(`/campaigns/${campaignId}/pause`, {
    method: "POST",
    agencyId,
    body: JSON.stringify({ version }),
  });
}

export async function resumeCampaign(agencyId: string, campaignId: string, version?: number): Promise<Campaign> {
  return apiClient<Campaign>(`/campaigns/${campaignId}/resume`, {
    method: "POST",
    agencyId,
    body: JSON.stringify({ version }),
  });
}

export async function completeCampaign(agencyId: string, campaignId: string, version?: number): Promise<Campaign> {
  return apiClient<Campaign>(`/campaigns/${campaignId}/complete`, {
    method: "POST",
    agencyId,
    body: JSON.stringify({ version }),
  });
}

export async function archiveCampaign(agencyId: string, campaignId: string, version?: number): Promise<Campaign> {
  return apiClient<Campaign>(`/campaigns/${campaignId}/archive`, {
    method: "POST",
    agencyId,
    body: JSON.stringify({ version }),
  });
}

export async function restoreCampaign(agencyId: string, campaignId: string, version?: number): Promise<Campaign> {
  return apiClient<Campaign>(`/campaigns/${campaignId}/restore`, {
    method: "POST",
    agencyId,
    body: JSON.stringify({ version }),
  });
}

export async function getCampaignTeam(agencyId: string, campaignId: string): Promise<CampaignTeamAssignment[]> {
  return apiClient<CampaignTeamAssignment[]>(`/campaigns/${campaignId}/team`, {
    method: "GET",
    agencyId,
  });
}

export async function getCampaignActivity(agencyId: string, campaignId: string): Promise<CampaignActivityResponse> {
  return apiClient<CampaignActivityResponse>(`/campaigns/${campaignId}/activity`, {
    method: "GET",
    agencyId,
  });
}

export async function getPublishingSchedules(agencyId: string, campaignId: string): Promise<PublishingScheduleAgendaResponse> {
  return apiClient<PublishingScheduleAgendaResponse>(`/campaigns/${campaignId}/publishing-schedules`, {
    method: "GET",
    agencyId,
  });
}

export async function createPublishingSchedule(
  agencyId: string,
  campaignId: string,
  data: {
    platform: string;
    scheduledAt: string;
    timezone: string;
    contentAssetId?: string | null;
    caption?: string | null;
    note?: string | null;
  },
): Promise<PublishingSchedule> {
  return apiClient<PublishingSchedule>(`/campaigns/${campaignId}/publishing-schedules`, {
    method: "POST",
    agencyId,
    body: JSON.stringify(data),
  });
}

export async function updatePublishingSchedule(
  agencyId: string,
  campaignId: string,
  scheduleId: string,
  data: {
    platform?: string;
    scheduledAt?: string;
    timezone?: string;
    contentAssetId?: string | null;
    caption?: string | null;
    note?: string | null;
    version: number;
  },
): Promise<PublishingSchedule> {
  return apiClient<PublishingSchedule>(`/campaigns/${campaignId}/publishing-schedules/${scheduleId}`, {
    method: "PATCH",
    agencyId,
    body: JSON.stringify(data),
  });
}

export async function cancelPublishingSchedule(
  agencyId: string,
  campaignId: string,
  scheduleId: string,
  data: { version: number; cancellationReason: string },
): Promise<PublishingSchedule> {
  return apiClient<PublishingSchedule>(`/campaigns/${campaignId}/publishing-schedules/${scheduleId}/cancel`, {
    method: "POST",
    agencyId,
    body: JSON.stringify(data),
  });
}

export async function markPublishingSchedulePublished(
  agencyId: string,
  campaignId: string,
  scheduleId: string,
  data: { version: number; publishedUrl: string; publishedAt?: string },
): Promise<PublishingSchedule> {
  return apiClient<PublishingSchedule>(`/campaigns/${campaignId}/publishing-schedules/${scheduleId}/mark-published`, {
    method: "POST",
    agencyId,
    body: JSON.stringify(data),
  });
}

export async function generatePublishingProduction(
  agencyId: string,
  campaignId: string,
  scheduleId: string,
  data: {
    contentType: string;
    title: string;
    brief?: string | null;
    managerMembershipId?: string;
    writerMembershipId?: string;
    scriptDueAt?: string;
  },
): Promise<PublishingSchedule> {
  return apiClient<PublishingSchedule>(`/campaigns/${campaignId}/publishing-schedules/${scheduleId}/generate-production`, {
    method: "POST",
    agencyId,
    body: JSON.stringify(data),
  });
}

export async function assignCampaignTeamMember(
  agencyId: string,
  campaignId: string,
  data: { membershipId: string; assignmentRole: CampaignAssignmentRole },
): Promise<CampaignTeamAssignment> {
  return apiClient<CampaignTeamAssignment>(`/campaigns/${campaignId}/team`, {
    method: "POST",
    agencyId,
    body: JSON.stringify(data),
  });
}

export async function updateCampaignTeamAssignment(
  agencyId: string,
  campaignId: string,
  assignmentId: string,
  data: { membershipId?: string; assignmentRole?: CampaignAssignmentRole; version: number },
): Promise<CampaignTeamAssignment> {
  return apiClient<CampaignTeamAssignment>(`/campaigns/${campaignId}/team/${assignmentId}`, {
    method: "PATCH",
    agencyId,
    body: JSON.stringify(data),
  });
}

export async function removeCampaignTeamAssignment(
  agencyId: string,
  campaignId: string,
  assignmentId: string,
): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(`/campaigns/${campaignId}/team/${assignmentId}`, {
    method: "DELETE",
    agencyId,
  });
}
