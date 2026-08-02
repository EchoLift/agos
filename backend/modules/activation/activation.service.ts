import { Injectable } from "@nestjs/common";
import {
  CampaignStatus,
  ClientStatus,
  ContentAssetStatus,
  WorkflowInstanceStatus,
} from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";

type ActivationStep =
  "agency" | "team" | "client" | "campaign" | "content" | "workflow";
type NextStep =
  | "CREATE_CLIENT"
  | "CREATE_CAMPAIGN"
  | "CREATE_CONTENT"
  | "START_WORKFLOW"
  | null;

@Injectable()
export class ActivationService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivation(agencyId: string) {
    const [
      agencyCount,
      activeMemberships,
      activeClients,
      activeCampaigns,
      activeContentAssets,
      activeWorkflowInstances,
    ] = await Promise.all([
      this.prisma.agency.count({ where: { id: agencyId, deletedAt: null } }),
      this.prisma.membership.count({
        where: { agencyId, status: "ACTIVE", deletedAt: null },
      }),
      this.prisma.client.count({
        where: { agencyId, status: ClientStatus.ACTIVE, deletedAt: null },
      }),
      this.prisma.campaign.count({
        where: {
          agencyId,
          status: { in: [CampaignStatus.ACTIVE, CampaignStatus.DRAFT] },
          deletedAt: null,
        },
      }),
      this.prisma.contentAsset.count({
        where: {
          agencyId,
          status: ContentAssetStatus.ACTIVE,
          deletedAt: null,
        },
      }),
      this.prisma.workflowInstance.count({
        where: {
          agencyId,
          status: WorkflowInstanceStatus.ACTIVE,
        },
      }),
    ]);

    const steps: Record<ActivationStep, boolean> = {
      agency: agencyCount > 0,
      team: activeMemberships > 1,
      client: activeClients > 0,
      campaign: activeCampaigns > 0,
      content: activeContentAssets > 0,
      workflow: activeWorkflowInstances > 0,
    };

    const stepValues = Object.values(steps);
    const progress = Math.round(
      (stepValues.filter(Boolean).length / stepValues.length) * 100,
    );
    const completed =
      steps.agency &&
      steps.client &&
      steps.campaign &&
      steps.content &&
      steps.workflow;

    return {
      completed,
      progress,
      steps,
      nextStep: this.getNextStep(steps),
    };
  }

  private getNextStep(steps: Record<ActivationStep, boolean>): NextStep {
    if (!steps.client) return "CREATE_CLIENT";
    if (!steps.campaign) return "CREATE_CAMPAIGN";
    if (!steps.content) return "CREATE_CONTENT";
    if (!steps.workflow) return "START_WORKFLOW";
    return null;
  }
}
