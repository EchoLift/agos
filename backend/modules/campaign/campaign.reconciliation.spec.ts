import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  CampaignAssignmentRole,
  ContentAssetStatus,
  ContentStage,
  TaskStatus,
  WorkflowInstanceStatus,
} from "@prisma/client";
import { CampaignService } from "./campaign.service";
import { DomainEvents } from "@packages/events/domain-event";

const AGENCY = "agency-1";
const CAMPAIGN = "campaign-1";
const USER_ACTOR = "user-1";
const ACTOR = {
  agencyId: AGENCY,
  userId: USER_ACTOR,
  membershipId: "member-manager",
  role: "MANAGER",
};

describe("CampaignService - Pending Task Reconciliation", () => {
  let service: CampaignService;
  let prisma: any;
  let eventBus: any;
  let googleCalendarSync: any;

  beforeEach(() => {
    prisma = {
      campaign: {
        findUnique: jest.fn(async () => ({
          id: CAMPAIGN,
          agencyId: AGENCY,
          status: "ACTIVE",
          version: 1,
        })),
        findFirst: jest.fn(async () => ({
          id: CAMPAIGN,
          agencyId: AGENCY,
          status: "ACTIVE",
          version: 1,
        })),
        update: jest.fn(),
      },
      campaignTeamAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      membership: {
        findFirst: jest.fn(async () => ({ id: "mem-1", agencyId: AGENCY })),
      },
      workflowInstance: {
        findMany: jest.fn(),
      },
      workflowTask: {
        update: jest.fn(async () => ({ id: "task-1" })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      assignmentHistory: {
        create: jest.fn(async () => ({ id: "hist-1" })),
      },
      notification: {
        create: jest.fn(async () => ({ id: "notif-1" })),
      },
      notificationDelivery: {
        create: jest.fn(async () => ({ id: "del-1" })),
      },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    eventBus = {
      publish: jest.fn(async () => ({})),
      publishWithinTransaction: jest.fn(async () => ({})),
    };

    googleCalendarSync = {
      queueWorkflowTaskSync: jest.fn(),
    };

    service = new CampaignService(
      prisma as any,
      eventBus as any,
      googleCalendarSync as any,
    );
  });

  it("2. While EDITOR_INTAKE is pending, replace editor A with editor B -> task owner becomes B", async () => {
    // Existing assignment was Editor A
    prisma.campaignTeamAssignment.findFirst.mockResolvedValue({
      id: "assign-1",
      campaignId: CAMPAIGN,
      agencyId: AGENCY,
      membershipId: "editor-a",
      assignmentRole: CampaignAssignmentRole.EDITOR,
      version: 1,
    });
    // Updated to Editor B
    prisma.campaignTeamAssignment.update.mockResolvedValue({
      id: "assign-1",
      campaignId: CAMPAIGN,
      agencyId: AGENCY,
      membershipId: "editor-b",
      assignmentRole: CampaignAssignmentRole.EDITOR,
      version: 2,
    });
    // findMany for current assignments returns only Editor B
    prisma.campaignTeamAssignment.findMany.mockResolvedValue([
      {
        id: "assign-1",
        campaignId: CAMPAIGN,
        agencyId: AGENCY,
        membershipId: "editor-b",
        assignmentRole: CampaignAssignmentRole.EDITOR,
      },
    ]);

    // Active workflow instance with pending EDITOR_INTAKE task owned by Editor A
    prisma.workflowInstance.findMany.mockResolvedValue([
      {
        id: "instance-1",
        agencyId: AGENCY,
        status: WorkflowInstanceStatus.ACTIVE,
        contentAsset: {
          id: "asset-1",
          campaignId: CAMPAIGN,
          displayCode: "REEL-001",
          type: "REEL",
          status: ContentAssetStatus.ACTIVE,
        },
        currentStep: { stage: ContentStage.EDITOR_INTAKE },
        currentTask: {
          id: "task-intake",
          ownerMembershipId: "editor-a",
          status: TaskStatus.WAITING_REVIEW,
          workflowStepId: "step-intake",
          deadlineAt: new Date("2026-09-01T18:00:00Z"),
        },
        transitions: [],
      },
    ]);

    await service.updateTeamAssignment(
      CAMPAIGN,
      "assign-1",
      { membershipId: "editor-b", version: 1 },
      ACTOR as any,
    );

    // WorkflowTask updated with new owner Editor B
    expect(prisma.workflowTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-intake" },
        data: expect.objectContaining({ ownerMembershipId: "editor-b" }),
      }),
    );

    // Assignment history recorded from Editor A to Editor B
    expect(prisma.assignmentHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromMembershipId: "editor-a",
          toMembershipId: "editor-b",
        }),
      }),
    );

    // ContentAssigned event emitted for Editor B
    expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      DomainEvents.ContentAssigned,
      expect.objectContaining({
        payload: expect.objectContaining({ assigneeId: "editor-b" }),
      }),
    );

    // Google Calendar sync queued for task
    expect(googleCalendarSync.queueWorkflowTaskSync).toHaveBeenCalledWith("task-intake");
  });

  it("3. Remove only editor with no replacement -> pending EDITOR_INTAKE becomes unassigned", async () => {
    prisma.campaignTeamAssignment.findFirst.mockResolvedValue({
      id: "assign-1",
      campaignId: CAMPAIGN,
      agencyId: AGENCY,
      membershipId: "editor-a",
      assignmentRole: CampaignAssignmentRole.EDITOR,
    });
    prisma.campaignTeamAssignment.delete.mockResolvedValue({ id: "assign-1" });
    // After deletion, 0 editors on campaign
    prisma.campaignTeamAssignment.findMany.mockResolvedValue([]);

    prisma.workflowInstance.findMany.mockResolvedValue([
      {
        id: "instance-1",
        agencyId: AGENCY,
        status: WorkflowInstanceStatus.ACTIVE,
        contentAsset: {
          id: "asset-1",
          campaignId: CAMPAIGN,
          displayCode: "REEL-001",
          type: "REEL",
          status: ContentAssetStatus.ACTIVE,
        },
        currentStep: { stage: ContentStage.EDITOR_INTAKE },
        currentTask: {
          id: "task-intake",
          ownerMembershipId: "editor-a",
          status: TaskStatus.WAITING_REVIEW,
          workflowStepId: "step-intake",
          deadlineAt: new Date("2026-09-01T18:00:00Z"),
        },
        transitions: [],
      },
    ]);

    await service.removeTeamAssignment(CAMPAIGN, "assign-1", ACTOR as any);

    // WorkflowTask updated with null owner (unassigned)
    expect(prisma.workflowTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-intake" },
        data: expect.objectContaining({ ownerMembershipId: null }),
      }),
    );

    // No assignmentHistory with null toMembershipId
    expect(prisma.assignmentHistory.create).not.toHaveBeenCalled();

    // Google Calendar sync queued to remove old event
    expect(googleCalendarSync.queueWorkflowTaskSync).toHaveBeenCalledWith("task-intake");
  });

  it("4. Multiple editors on campaign -> pending task becomes unassigned (no arbitrary pick)", async () => {
    prisma.campaignTeamAssignment.create.mockResolvedValue({
      id: "assign-2",
      campaignId: CAMPAIGN,
      agencyId: AGENCY,
      membershipId: "editor-c",
      assignmentRole: CampaignAssignmentRole.EDITOR,
    });
    // Now there are 2 editors
    prisma.campaignTeamAssignment.findMany.mockResolvedValue([
      { id: "assign-1", membershipId: "editor-b", assignmentRole: CampaignAssignmentRole.EDITOR },
      { id: "assign-2", membershipId: "editor-c", assignmentRole: CampaignAssignmentRole.EDITOR },
    ]);

    prisma.workflowInstance.findMany.mockResolvedValue([
      {
        id: "instance-1",
        agencyId: AGENCY,
        status: WorkflowInstanceStatus.ACTIVE,
        contentAsset: {
          id: "asset-1",
          campaignId: CAMPAIGN,
          displayCode: "REEL-001",
          type: "REEL",
          status: ContentAssetStatus.ACTIVE,
        },
        currentStep: { stage: ContentStage.EDITOR_INTAKE },
        currentTask: {
          id: "task-intake",
          ownerMembershipId: "editor-b",
          status: TaskStatus.WAITING_REVIEW,
          workflowStepId: "step-intake",
          deadlineAt: new Date("2026-09-01T18:00:00Z"),
        },
        transitions: [],
      },
    ]);

    await service.assignTeamMember(
      CAMPAIGN,
      { membershipId: "editor-c", assignmentRole: CampaignAssignmentRole.EDITOR },
      ACTOR as any,
    );

    // Must set owner to null because 2 editors is ambiguous
    expect(prisma.workflowTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-intake" },
        data: expect.objectContaining({ ownerMembershipId: null }),
      }),
    );
  });

  it("9. Campaign editor changes after EDITING is already actively IN_PROGRESS -> do NOT steal active work", async () => {
    prisma.campaignTeamAssignment.findFirst.mockResolvedValue({
      id: "assign-1",
      campaignId: CAMPAIGN,
      agencyId: AGENCY,
      membershipId: "editor-a",
      assignmentRole: CampaignAssignmentRole.EDITOR,
      version: 1,
    });
    prisma.campaignTeamAssignment.update.mockResolvedValue({
      id: "assign-1",
      campaignId: CAMPAIGN,
      agencyId: AGENCY,
      membershipId: "editor-b",
      assignmentRole: CampaignAssignmentRole.EDITOR,
      version: 2,
    });
    prisma.campaignTeamAssignment.findMany.mockResolvedValue([
      { id: "assign-1", membershipId: "editor-b", assignmentRole: CampaignAssignmentRole.EDITOR },
    ]);

    // Active EDITING task in IN_PROGRESS (editor A already started working)
    prisma.workflowInstance.findMany.mockResolvedValue([
      {
        id: "instance-1",
        agencyId: AGENCY,
        status: WorkflowInstanceStatus.ACTIVE,
        contentAsset: {
          id: "asset-1",
          campaignId: CAMPAIGN,
          displayCode: "REEL-001",
          type: "REEL",
          status: ContentAssetStatus.ACTIVE,
        },
        currentStep: { stage: ContentStage.EDITING },
        currentTask: {
          id: "task-editing",
          ownerMembershipId: "editor-a",
          status: TaskStatus.IN_PROGRESS, // in progress!
          workflowStepId: "step-editing",
          deadlineAt: new Date("2026-09-01T18:00:00Z"),
        },
        transitions: [],
      },
    ]);

    await service.updateTeamAssignment(
      CAMPAIGN,
      "assign-1",
      { membershipId: "editor-b", version: 1 },
      ACTOR as any,
    );

    // Must NOT update the task owner because it is actively in progress
    expect(prisma.workflowTask.update).not.toHaveBeenCalled();
  });
});
