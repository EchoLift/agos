import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  CampaignAssignmentRole,
  ContentStage,
  SubmissionStatus,
  SubmissionType,
  TaskStatus,
} from "@prisma/client";
import { ForbiddenException } from "@nestjs/common";
import { WorkflowService } from "./workflow.service";
import { DomainEvents } from "@packages/events/domain-event";

const AGENCY = "agency-1";
const INSTANCE = "instance-1";
const ASSET = "asset-1";
const STEP_SHOOT = "step-shoot";
const STEP_INTAKE = "step-intake";
const STEP_EDITING = "step-editing";

function makePrisma() {
  const prisma: any = {
    contentAsset: { findUnique: jest.fn() },
    submission: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workflowTask: {
      update: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    workflowInstance: {
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    approval: { findUnique: jest.fn(), create: jest.fn() },
    workflowTransition: { create: jest.fn(), findFirst: jest.fn() },
    workflowStep: { findFirst: jest.fn() },
    assignmentHistory: { create: jest.fn() },
    membership: { findFirst: jest.fn() },
    notification: { create: jest.fn() },
    notificationDelivery: {
      create: jest.fn(async () => ({ id: "delivery-1" })),
    },
    publishingSchedule: { findFirst: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
  };
  return prisma;
}

function makeEventBus() {
  return {
    publish: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
    publishWithinTransaction: jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({}),
  } as any;
}

describe("Workflow - Handover and Review Permissions", () => {
  let prisma: any;
  let eventBus: any;
  let service: WorkflowService;

  beforeEach(() => {
    prisma = makePrisma();
    eventBus = makeEventBus();
    service = new WorkflowService(prisma as any, eventBus as any);

    prisma.approval.findUnique.mockResolvedValue(null);
    prisma.approval.create.mockResolvedValue({
      id: "approval-1",
      status: "APPROVED",
    });
    prisma.workflowTask.update.mockResolvedValue({ id: "task-intake" });
    prisma.workflowTask.create.mockResolvedValue({ id: "task-editing" });
    prisma.workflowInstance.update.mockResolvedValue({ id: INSTANCE });
    prisma.workflowInstance.findUnique.mockResolvedValue({
      id: INSTANCE,
      templateId: "template-1",
    });
    prisma.workflowTransition.create.mockResolvedValue({ id: "trans-1" });
    prisma.workflowTransition.findFirst.mockResolvedValue(null);
    prisma.workflowStep.findFirst.mockResolvedValue({ id: STEP_EDITING });
    prisma.membership.findFirst.mockResolvedValue({ userId: "user-editor" });
    prisma.notification.create.mockResolvedValue({ id: "notif-1" });
  });

  it("1. DOP submits with editor A -> EDITOR_INTAKE owned by A", async () => {
    const shootTask = {
      id: "task-shoot",
      agencyId: AGENCY,
      workflowInstanceId: INSTANCE,
      workflowStepId: STEP_SHOOT,
      ownerMembershipId: "dop-1",
      status: TaskStatus.IN_PROGRESS,
      deadlineAt: new Date("2026-09-01T18:00:00Z"),
      workflowStep: { stage: ContentStage.SHOOT },
      owner: { id: "dop-1", user: { name: "DOP" } },
      workflowInstance: {
        id: INSTANCE,
        templateId: "template-1",
        managerMembershipId: "manager-1",
        contentAsset: {
          displayCode: "REEL-001",
          campaign: {
            teamAssignments: [
              { membershipId: "editor-a", assignmentRole: CampaignAssignmentRole.EDITOR },
            ],
            publishingSchedules: [{ scheduledAt: new Date("2026-09-05T10:00:00Z") }],
          },
          client: null,
        },
      },
    };

    prisma.workflowInstance.findFirst.mockResolvedValue({
      id: INSTANCE,
      agencyId: AGENCY,
      contentAssetId: ASSET,
      currentTaskId: "task-shoot",
      currentTask: shootTask,
    });
    prisma.submission.create.mockResolvedValue({
      id: "sub-footage",
      submissionType: "RAW_FOOTAGE",
    });

    await service.performAction(
      ASSET,
      {
        action: "SUBMIT_FOR_REVIEW" as any,
        idempotencyKey: "key-footage",
        externalLink: "https://drive.google.com/footage",
      },
      { agencyId: AGENCY, membershipId: "dop-1" } as any,
    );

    // EDITOR_INTAKE task created for Editor A
    expect(prisma.workflowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerMembershipId: "editor-a" }),
      }),
    );
  });

  it("5 & 7. Assigned editor accepts handover -> EDITOR_INTAKE completed, EDITING created for editor, events emitted", async () => {
    const intakeTask = {
      id: "task-intake",
      agencyId: AGENCY,
      workflowInstanceId: INSTANCE,
      workflowStepId: STEP_INTAKE,
      ownerMembershipId: "editor-a",
      status: TaskStatus.WAITING_REVIEW,
      deadlineAt: new Date("2026-09-01T18:00:00Z"),
      workflowStep: { stage: ContentStage.EDITOR_INTAKE },
      owner: { id: "editor-a", user: { name: "Editor A" } },
      workflowInstance: {
        id: INSTANCE,
        templateId: "template-1",
        managerMembershipId: "manager-1",
        contentAsset: {
          id: ASSET,
          displayCode: "REEL-001",
          campaign: {
            teamAssignments: [
              { membershipId: "editor-a", assignmentRole: CampaignAssignmentRole.EDITOR },
            ],
            publishingSchedules: [{ scheduledAt: new Date("2026-09-05T10:00:00Z") }],
          },
          client: null,
        },
      },
    };

    prisma.workflowInstance.findFirst.mockResolvedValue({
      id: INSTANCE,
      agencyId: AGENCY,
      contentAssetId: ASSET,
      currentTaskId: "task-intake",
      currentTask: intakeTask,
    });
    prisma.workflowStep.findFirst.mockResolvedValue({ id: STEP_EDITING });
    prisma.workflowTask.create.mockResolvedValue({ id: "task-editing" });

    // Editor A calls ACCEPT_HANDOVER
    await service.performAction(
      ASSET,
      {
        action: "ACCEPT_HANDOVER" as any,
        idempotencyKey: "key-accept-1",
        comment: "Footage looks great, starting edit",
      },
      { agencyId: AGENCY, membershipId: "editor-a", role: "MEMBER" } as any,
    );

    // EDITOR_INTAKE completed
    expect(prisma.workflowTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-intake" },
        data: expect.objectContaining({ status: TaskStatus.COMPLETED }),
      }),
    );

    // EDITING task created and assigned to Editor A
    expect(prisma.workflowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerMembershipId: "editor-a",
          status: TaskStatus.TODO,
        }),
      }),
    );

    // SubmissionAccepted event emitted
    expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      DomainEvents.SubmissionAccepted,
      expect.objectContaining({
        payload: expect.objectContaining({ contentAssetId: ASSET }),
      }),
    );

    // WorkflowStageChanged event emitted
    expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      DomainEvents.WorkflowStageChanged,
      expect.objectContaining({
        payload: expect.objectContaining({
          fromStage: ContentStage.EDITOR_INTAKE,
          toStage: ContentStage.EDITING,
        }),
      }),
    );
  });

  it("6. Non-editor / non-owner attempting ACCEPT_HANDOVER throws ForbiddenException", async () => {
    const intakeTask = {
      id: "task-intake",
      agencyId: AGENCY,
      workflowInstanceId: INSTANCE,
      workflowStepId: STEP_INTAKE,
      ownerMembershipId: "editor-a",
      status: TaskStatus.WAITING_REVIEW,
      deadlineAt: new Date("2026-09-01T18:00:00Z"),
      workflowStep: { stage: ContentStage.EDITOR_INTAKE },
      owner: { id: "editor-a", user: { name: "Editor A" } },
      workflowInstance: {
        id: INSTANCE,
        templateId: "template-1",
        managerMembershipId: "manager-1",
        contentAsset: {
          id: ASSET,
          displayCode: "REEL-001",
          campaign: {
            teamAssignments: [
              { membershipId: "editor-a", assignmentRole: CampaignAssignmentRole.EDITOR },
              { membershipId: "writer-1", assignmentRole: CampaignAssignmentRole.WRITER },
            ],
            publishingSchedules: [{ scheduledAt: new Date("2026-09-05T10:00:00Z") }],
          },
          client: null,
        },
      },
    };

    prisma.workflowInstance.findFirst.mockResolvedValue({
      id: INSTANCE,
      agencyId: AGENCY,
      contentAssetId: ASSET,
      currentTaskId: "task-intake",
      currentTask: intakeTask,
    });

    // Writer tries to accept handover
    await expect(
      service.performAction(
        ASSET,
        {
          action: "ACCEPT_HANDOVER" as any,
          idempotencyKey: "key-writer-hack",
        },
        { agencyId: AGENCY, membershipId: "writer-1", role: "MEMBER" } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("8. Editor requests changes on EDITOR_INTAKE -> returns to SHOOT with actual DOP submitter as owner", async () => {
    const intakeTask = {
      id: "task-intake",
      agencyId: AGENCY,
      workflowInstanceId: INSTANCE,
      workflowStepId: STEP_INTAKE,
      ownerMembershipId: "editor-a",
      status: TaskStatus.WAITING_REVIEW,
      deadlineAt: new Date("2026-09-01T18:00:00Z"),
      workflowStep: { stage: ContentStage.EDITOR_INTAKE },
      owner: { id: "editor-a", user: { name: "Editor A" } },
      workflowInstance: {
        id: INSTANCE,
        templateId: "template-1",
        managerMembershipId: "manager-1",
        contentAsset: {
          id: ASSET,
          displayCode: "REEL-001",
          campaign: {
            teamAssignments: [
              { membershipId: "editor-a", assignmentRole: CampaignAssignmentRole.EDITOR },
              { membershipId: "dop-campaign-member", assignmentRole: CampaignAssignmentRole.DOP },
            ],
            publishingSchedules: [{ scheduledAt: new Date("2026-09-05T10:00:00Z") }],
          },
          client: null,
        },
      },
    };

    prisma.workflowInstance.findFirst.mockResolvedValue({
      id: INSTANCE,
      agencyId: AGENCY,
      contentAssetId: ASSET,
      currentTaskId: "task-intake",
      currentTask: intakeTask,
    });

    // Actual footage submitter is dop-actual
    prisma.submission.findFirst.mockResolvedValue({
      submittedBy: "dop-actual",
      submissionType: SubmissionType.RAW_FOOTAGE,
    });
    prisma.workflowStep.findFirst.mockResolvedValue({ id: STEP_SHOOT });
    prisma.workflowTask.create.mockResolvedValue({ id: "task-shoot-returned" });

    // Editor A rejects / requests changes
    await service.performAction(
      ASSET,
      {
        action: "REJECT" as any,
        idempotencyKey: "key-reject-1",
        comment: "Audio track missing from take 2",
      },
      { agencyId: AGENCY, membershipId: "editor-a" } as any,
    );

    // Return task created with owner = actual submitter (dop-actual)
    expect(prisma.workflowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerMembershipId: "dop-actual",
          status: TaskStatus.TODO,
        }),
      }),
    );
  });
});
