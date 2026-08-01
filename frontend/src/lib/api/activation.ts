import { apiClient } from "../api-client";

export type ActivationStepId = "agency" | "team" | "client" | "campaign" | "content" | "workflow";

export interface ActivationState {
  completed: boolean;
  progress: number;
  steps: Record<ActivationStepId, boolean>;
  nextStep: "CREATE_CLIENT" | "CREATE_CAMPAIGN" | "CREATE_CONTENT" | "START_WORKFLOW" | null;
}

export async function getActivation(agencyId: string): Promise<ActivationState> {
  return apiClient<ActivationState>("/activation", {
    method: "GET",
    agencyId,
  });
}
