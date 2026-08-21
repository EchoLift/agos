import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  ApprovalStatus,
  CampaignAssignmentRole,
  ContentStage,
} from "@prisma/client";
import { ForbiddenException } from "@nestjs/common";
import { WorkflowService } from "./workflow.service";
import { WorkflowActionType } from "./dto/workflow-action.dto";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";

describe("WorkflowService authorization handling", () => {
  let service: WorkflowService;
  let prisma: any;
  let eventBus: any;

  beforeEach(() => {
    prisma = {
      contentAsset: { findUnique: jest.fn() },
      workflowInstance: {
        findFirst: jest.fn(),
        findUnique: jest.fn(async () => ({
          id: "instance-1",
          templateId: "template-1",
        })),
        update: jest.fn(),
      },
      workflowTask: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      approval: { findUnique: jest.fn(), create: jest.fn() },
      submission: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      assignmentHistory: { create: jest.fn() },
      workflowTransition: { create: jest.fn(), findFirst: jest.fn() },
      workflowStep: { findFirst: jest.fn(), findUnique: jest.fn() },
      notification: { create: jest.fn() },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) =>
        callback(prisma),
      ),
    };
    eventBus = {
      publish: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
      publishWithinTransaction: jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue({}),
    } as any;
    service = new WorkflowService(prisma, eventBus);
  });

  function createActor(membershipId: string, role = "MEMBER"): IdentityContext {
    return {
      authUserId: `auth-${membershipId}`,
      userId: `user-${membershipId}`,
      sessionId: `session-${membershipId}`,
      agencyId: "agency-1",
      membershipId,
      role,
      roles: [role],
      permissions: [],
    };
  }

  function setupTaskMock({
    ownerMembershipId = "owner-member",
    managerMembershipId = "inst-manager-member",
    managerUserName = "Instance Manager User",
    teamAssignments = [] as Array<{
      membershipId: string;
      assignmentRole: CampaignAssignmentRole;
      membership?: { user?: { name?: string } };
    }>,
    stage = ContentStage.MANAGER_SCRIPT_REVIEW,
  } = {}) {
    const task = {
      id: "task-1",
      agencyId: "agency-1",
      workflowInstanceId: "instance-1",
      ownerMembershipId,
      workflowStepId: "step-1",
      deadlineAt: new Date(),
      workflowStep: { stage },
      owner: { id: ownerMembershipId, user: { name: "Task Owner" } },
      workflowInstance: {
        id: "instance-1",
        agencyId: "agency-1",
        contentAssetId: "asset-1",
        templateId: "template-1",
        managerMembershipId,
        manager: managerMembershipId
          ? {
              id: managerMembershipId,
              user: managerUserName ? { name: managerUserName } : null,
            }
          : null,
        contentAsset: {
          id: "asset-1",
          displayCode: "REEL-001",
          campaign: {
            id: "campaign-1",
            teamAssignments,
            publishingSchedules: [{ scheduledAt: new Date() }],
          },
          client: null,
        },
      },
    };

    prisma.workflowInstance.findFirst.mockResolvedValue({
      id: "instance-1",
      agencyId: "agency-1",
      contentAssetId: "asset-1",
      currentTaskId: "task-1",
      currentTask: task,
    });

    prisma.workflowStep.findFirst.mockResolvedValue({ id: "step-shoot", stage: ContentStage.SHOOT });
    prisma.approval.findUnique.mockResolvedValue(null);
    prisma.approval.create.mockResolvedValue({
      id: "approval-1",
      status: ApprovalStatus.APPROVED,
    });
    prisma.workflowTask.update.mockResolvedValue({ id: "task-1" });
    prisma.workflowTask.create.mockResolvedValue({ id: "next-task-1" });
    prisma.workflowInstance.update.mockResolvedValue({ id: "instance-1" });
    prisma.workflowTransition.create.mockResolvedValue({ id: "trans-1" });
    prisma.assignmentHistory.create.mockResolvedValue({ id: "hist-1" });

    return task;
  }

  it("allows authorized campaign manager to approve", async () => {
    setupTaskMock({
      ownerMembershipId: "writer-1",
      teamAssignments: [
        {
          membershipId: "cm-1",
          assignmentRole: CampaignAssignmentRole.CAMPAIGN_MANAGER,
          membership: { user: { name: "Surya Writings" } },
        },
      ],
    });

    const result = await service.performAction(
      "asset-1",
      {
        action: WorkflowActionType.APPROVE,
        idempotencyKey: "key-1",
        allowMissingAssignee: false,
      },
      createActor("cm-1"),
    );

    expect(result).toBeDefined();
    expect((result as any).id).toBe("approval-1");
  });

  it("allows authorized campaign reviewer (EDITOR) to approve", async () => {
    setupTaskMock({
      ownerMembershipId: "writer-1",
      teamAssignments: [
        {
          membershipId: "cm-1",
          assignmentRole: CampaignAssignmentRole.CAMPAIGN_MANAGER,
          membership: { user: { name: "Surya Writings" } },
        },
        {
          membershipId: "editor-1",
          assignmentRole: CampaignAssignmentRole.EDITOR,
          membership: { user: { name: "Editor User" } },
        },
      ],
    });

    const result = await service.performAction(
      "asset-1",
      {
        action: WorkflowActionType.APPROVE,
        idempotencyKey: "key-2",
        allowMissingAssignee: false,
      },
      createActor("editor-1"),
    );

    expect(result).toBeDefined();
    expect((result as any).id).toBe("approval-1");
  });

  it("throws structured 403 ForbiddenException when unauthorized member attempts APPROVE", async () => {
    setupTaskMock({
      ownerMembershipId: "writer-1",
      teamAssignments: [
        {
          membershipId: "cm-1",
          assignmentRole: CampaignAssignmentRole.CAMPAIGN_MANAGER,
          membership: { user: { name: "Surya Writings" } },
        },
        {
          membershipId: "unauthorized-1",
          assignmentRole: CampaignAssignmentRole.WRITER,
          membership: { user: { name: "Random Writer" } },
        },
      ],
    });

    try {
      await service.performAction(
        "asset-1",
        {
          action: WorkflowActionType.APPROVE,
          idempotencyKey: "key-3",
        },
        createActor("unauthorized-1"),
      );
      throw new Error("Expected performAction to throw ForbiddenException");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = err.getResponse();
      expect(response).toEqual({
        code: "CAMPAIGN_REVIEW_ACCESS_REQUIRED",
        message: "You don't have approval access for this campaign.",
        currentCampaignManager: {
          membershipId: "cm-1",
          name: "Surya Writings",
        },
        suggestion:
          "Ask to be added as a campaign manager or reviewer, or contact Surya Writings.",
      });
    }
  });

  it("falls back atomically to workflowInstance.manager when CAMPAIGN_MANAGER is not assigned", async () => {
    setupTaskMock({
      ownerMembershipId: "writer-1",
      managerMembershipId: "inst-mgr-1",
      managerUserName: "Fallback Instance Manager",
      teamAssignments: [
        {
          membershipId: "writer-1",
          assignmentRole: CampaignAssignmentRole.WRITER,
          membership: { user: { name: "Writer" } },
        },
      ],
    });

    try {
      await service.performAction(
        "asset-1",
        {
          action: WorkflowActionType.APPROVE,
          idempotencyKey: "key-4",
        },
        createActor("unauthorized-1"),
      );
      throw new Error("Expected performAction to throw ForbiddenException");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = err.getResponse();
      expect(response).toEqual({
        code: "CAMPAIGN_REVIEW_ACCESS_REQUIRED",
        message: "You don't have approval access for this campaign.",
        currentCampaignManager: {
          membershipId: "inst-mgr-1",
          name: "Fallback Instance Manager",
        },
        suggestion:
          "Ask to be added as a campaign manager or reviewer, or contact Fallback Instance Manager.",
      });
    }
  });

  it("handles missing manager data gracefully without throwing 500", async () => {
    setupTaskMock({
      ownerMembershipId: "writer-1",
      managerMembershipId: "",
      managerUserName: "",
      teamAssignments: [],
    });

    try {
      await service.performAction(
        "asset-1",
        {
          action: WorkflowActionType.APPROVE,
          idempotencyKey: "key-5",
        },
        createActor("unauthorized-1"),
      );
      throw new Error("Expected performAction to throw ForbiddenException");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = err.getResponse();
      expect(response).toEqual({
        code: "CAMPAIGN_REVIEW_ACCESS_REQUIRED",
        message: "You don't have approval access for this campaign.",
        currentCampaignManager: {
          membershipId: null,
          name: "the campaign manager",
        },
        suggestion:
          "Ask to be added as a campaign manager or reviewer, or contact the current campaign manager.",
      });
    }
  });

  it("throws identical structured 403 ForbiddenException for REQUEST_CHANGES when unauthorized", async () => {
    setupTaskMock({
      ownerMembershipId: "writer-1",
      teamAssignments: [
        {
          membershipId: "cm-1",
          assignmentRole: CampaignAssignmentRole.CAMPAIGN_MANAGER,
          membership: { user: { name: "Surya Writings" } },
        },
      ],
    });

    try {
      await service.performAction(
        "asset-1",
        {
          action: WorkflowActionType.REQUEST_CHANGES,
          idempotencyKey: "key-6",
          reason: "Needs more work",
        },
        createActor("unauthorized-1"),
      );
      throw new Error("Expected performAction to throw ForbiddenException");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = err.getResponse();
      expect(response).toEqual({
        code: "CAMPAIGN_REVIEW_ACCESS_REQUIRED",
        message: "You don't have approval access for this campaign.",
        currentCampaignManager: {
          membershipId: "cm-1",
          name: "Surya Writings",
        },
        suggestion:
          "Ask to be added as a campaign manager or reviewer, or contact Surya Writings.",
      });
    }
  });

  it("throws identical structured 403 ForbiddenException for REJECT when unauthorized", async () => {
    setupTaskMock({
      ownerMembershipId: "writer-1",
      teamAssignments: [
        {
          membershipId: "cm-1",
          assignmentRole: CampaignAssignmentRole.CAMPAIGN_MANAGER,
          membership: { user: { name: "Surya Writings" } },
        },
      ],
    });

    try {
      await service.performAction(
        "asset-1",
        {
          action: WorkflowActionType.REJECT,
          idempotencyKey: "key-7",
          reason: "Rejected completely",
        },
        createActor("unauthorized-1"),
      );
      throw new Error("Expected performAction to throw ForbiddenException");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = err.getResponse();
      expect(response).toEqual({
        code: "CAMPAIGN_REVIEW_ACCESS_REQUIRED",
        message: "You don't have approval access for this campaign.",
        currentCampaignManager: {
          membershipId: "cm-1",
          name: "Surya Writings",
        },
        suggestion:
          "Ask to be added as a campaign manager or reviewer, or contact Surya Writings.",
      });
    }
  });
});
