import { apiClient } from "../api-client";

export interface ContentAsset {
  id: string;
  campaignId: string;
  clientId: string;
  clientSummary?: WorkflowClientSummary;
  campaignSummary?: {
    id: string;
    name: string;
    status?: string | null;
    campaignType?: string | null;
    goal?: string | null;
    keyMessage?: string | null;
    cta?: string | null;
  };
  displayCode?: string;
  title: string;
  type: string;
  brief?: string;
  status: string;
  stage: string | null;
  currentTask?: {
    id: string;
    ownerMembershipId: string | null;
    status: string | null;
  } | null;
  latestSubmission?: WorkflowSubmissionSummary | null;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowSubmissionSummary {
  id: string;
  submissionType: string;
  version: number;
  body?: string | null;
  externalLink?: string | null;
  status: string;
  createdAt: string;
}

export interface WorkflowClientSummary {
  id: string;
  name: string;
  legalName: string;
  industry: string | null;
  website: string | null;
  description: string | null;
  brandVoice: string | null;
  brandPersonality: string | null;
  tagline: string | null;
  audience: string | null;
  audienceLocations: string | null;
  audiencePainPoints: string | null;
  contentGoals: string | null;
  socialLinks?: {
    instagram?: string | null;
    youtube?: string | null;
    linkedin?: string | null;
  };
}

export interface CreateContentInput {
  campaignId: string;
  clientId: string;
  title: string;
  type: string;
  brief: string;
  assigneeId?: string | null;
  deadlineAt?: string | null;
}

export interface UpdateContentInput {
  title?: string;
  type?: string;
  brief?: string;
  displayCode?: string;
}

export interface UpdateContentPlanningInput {
  assigneeId?: string | null;
  deadlineAt?: string | null;
}

export async function getContentAssets(agencyId: string): Promise<ContentAsset[]> {
  return apiClient<ContentAsset[]>("/content-assets", {
    method: "GET",
    agencyId,
  });
}

export async function getCampaignContentAssets(
  agencyId: string,
  campaignId: string,
): Promise<ContentAsset[]> {
  return apiClient<ContentAsset[]>(
    `/content-assets?campaignId=${encodeURIComponent(campaignId)}`,
    {
      method: "GET",
      agencyId,
    },
  );
}

export async function createContentAsset(agencyId: string, data: CreateContentInput): Promise<ContentAsset> {
  return apiClient<ContentAsset>("/content-assets", {
    method: "POST",
    agencyId,
    body: JSON.stringify(data),
  });
}

export async function getContentAsset(agencyId: string, contentAssetId: string): Promise<ContentAsset> {
  return apiClient<ContentAsset>(`/content-assets/${contentAssetId}`, {
    method: "GET",
    agencyId,
  });
}

export async function updateContentAsset(agencyId: string, contentAssetId: string, data: UpdateContentInput): Promise<ContentAsset> {
  return apiClient<ContentAsset>(`/content-assets/${contentAssetId}`, {
    method: "PATCH",
    agencyId,
    body: JSON.stringify(data),
  });
}

export async function updateContentPlanningFields(
  agencyId: string,
  contentAssetId: string,
  data: UpdateContentPlanningInput,
): Promise<ContentAsset> {
  return apiClient<ContentAsset>(`/content-assets/${contentAssetId}/planning`, {
    method: "PATCH",
    agencyId,
    body: JSON.stringify(data),
  });
}
