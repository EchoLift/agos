import { apiClient } from "../api-client";

export type WorkOrderType =
  | "SCRIPT"
  | "EDIT"
  | "DESIGN"
  | "SHOOT"
  | "THUMBNAIL"
  | "CAPTION"
  | "RESEARCH"
  | "OTHER";

export type WorkOrderPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type WorkOrderStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "CHANGES_REQUESTED"
  | "COMPLETED"
  | "CANCELLED";

export interface WorkOrder {
  id: string;
  clientId: string | null;
  client: { id: string; name: string; industry: string | null } | null;
  title: string;
  description: string;
  workType: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  dueAt: string;
  estimatedHours: number | null;
  rewardAmount: string | null;
  rewardCurrency: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  version: number;
  assignee: { id: string; name: string } | null;
  reviewer: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  submissions: Array<{
    id: string;
    version: number;
    body: string | null;
    externalLink: string | null;
    status: string;
    reviewComment: string | null;
    reviewedAt: string | null;
    createdAt: string;
    submittedBy: { id: string; name: string } | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkOrderInput {
  clientId?: string | null;
  title: string;
  description: string;
  workType?: WorkOrderType;
  priority?: WorkOrderPriority;
  assigneeMembershipId: string;
  reviewerMembershipId?: string | null;
  dueAt: string;
  estimatedHours?: number | null;
  rewardAmount?: number | null;
  rewardCurrency?: string | null;
}

export type UpdateWorkOrderInput = Partial<CreateWorkOrderInput>;

export async function getWorkOrders(agencyId: string): Promise<WorkOrder[]> {
  return apiClient<WorkOrder[]>("/work-orders", { agencyId });
}

export async function getWorkOrder(
  agencyId: string,
  workOrderId: string,
): Promise<WorkOrder> {
  return apiClient<WorkOrder>(`/work-orders/${workOrderId}`, { agencyId });
}

export async function createWorkOrder(
  agencyId: string,
  input: CreateWorkOrderInput,
): Promise<WorkOrder> {
  return apiClient<WorkOrder>("/work-orders", {
    method: "POST",
    agencyId,
    body: JSON.stringify(input),
  });
}

export async function updateWorkOrder(
  agencyId: string,
  workOrderId: string,
  input: UpdateWorkOrderInput,
): Promise<WorkOrder> {
  return apiClient<WorkOrder>(`/work-orders/${workOrderId}`, {
    method: "PATCH",
    agencyId,
    body: JSON.stringify(input),
  });
}

export async function submitWorkOrder(
  agencyId: string,
  workOrderId: string,
  input: { body?: string; externalLink?: string },
): Promise<WorkOrder> {
  return apiClient<WorkOrder>(`/work-orders/${workOrderId}/submit`, {
    method: "POST",
    agencyId,
    body: JSON.stringify(input),
  });
}

export async function approveWorkOrder(
  agencyId: string,
  workOrderId: string,
  input: { comment?: string },
): Promise<WorkOrder> {
  return apiClient<WorkOrder>(`/work-orders/${workOrderId}/approve`, {
    method: "POST",
    agencyId,
    body: JSON.stringify(input),
  });
}

export async function requestWorkOrderChanges(
  agencyId: string,
  workOrderId: string,
  input: { comment?: string },
): Promise<WorkOrder> {
  return apiClient<WorkOrder>(`/work-orders/${workOrderId}/request-changes`, {
    method: "POST",
    agencyId,
    body: JSON.stringify(input),
  });
}
