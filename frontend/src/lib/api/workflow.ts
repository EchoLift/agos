import { apiClient } from "../api-client";

export interface WorkflowBoardSummary {
  active: number;
  waitingReview: number;
  blocked: number;
  overdue: number;
  dueToday: number;
}

export interface WorkflowBoardMember {
  membershipId: string;
  name: string;
  role: string | null;
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

export interface WorkflowBoardItem {
  contentAssetId: string;
  workflowInstanceId: string | null;
  workflowTaskId: string | null;
  displayCode: string;
  title: string;
  type: string;
  clientId: string;
  clientName: string;
  clientSummary?: WorkflowClientSummary;
  campaignId: string;
  campaignName: string;
  stage: string;
  owner: WorkflowBoardMember | null;
  manager: WorkflowBoardMember | null;
  deadlineAt: string | null;
  riskStatus: string;
  taskStatus: string | null;
  submissionStatus: string | null;
  approvalStatus: string | null;
  hasActiveBlocker: boolean;
  blockerCount: number;
  lastActivityAt: string;
}

export interface WorkflowBoardColumn {
  stage: string;
  label: string;
  count: number;
  items: WorkflowBoardItem[];
}

export interface WorkflowBoard {
  summary: WorkflowBoardSummary;
  columns: WorkflowBoardColumn[];
}

export interface WorkflowBoardFilters {
  clientId?: string;
  campaignId?: string;
  ownerId?: string;
  risk?: string;
  search?: string;
}

export type WorkflowActionType =
  | "SUBMIT_FOR_REVIEW"
  | "APPROVE"
  | "ACCEPT_HANDOVER"
  | "REQUEST_CHANGES"
  | "REJECT"
  | "BLOCK"
  | "UNBLOCK";

export interface WorkflowActionInput {
  action: WorkflowActionType;
  idempotencyKey: string;
  body?: string;
  externalLink?: string;
  comment?: string;
  reason?: string;
  allowMissingAssignee?: boolean;
}

export async function getWorkflowBoard(agencyId: string, filters: WorkflowBoardFilters = {}): Promise<WorkflowBoard> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiClient<WorkflowBoard>(`/workflow/board${suffix}`, {
    method: "GET",
    agencyId,
  });
}

export async function performWorkflowAction(agencyId: string, contentAssetId: string, input: WorkflowActionInput) {
  return apiClient(`/content-assets/${contentAssetId}/actions`, {
    method: "POST",
    agencyId,
    body: JSON.stringify(input),
  });
}
