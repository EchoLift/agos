import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  CampaignAssignmentRole,
  ContentStage,
  TaskStatus,
} from "@prisma/client";
import { WorkflowService } from "./workflow.service";
import { DomainEvents } from "@packages/events/domain-event";

/**
 * Downstream-assignee non-blocking tests.
 *
 * Core product rule: a worker who successfully completes the current stage
 * must NOT be blocked because the next stage has no assignee.
 *
 * campaignAssigneeOrNull contract:
 *   0 members  → null
 *   1 member   → that member's ID
 *   >1 members → null (explicit content-level split required)
 */

const AGENCY = "agency-1";
const INSTANCE = "instance-1";
const ASSET = "asset-1";
const STEP_SHOOT = "step-shoot";
const STEP_SCRIPT_REVIEW = "step-script-review";

function makePrisma() {
  const prisma: any = {
    contentAsset: { findUnique: jest.fn() },
    submission: { findFirst: jest.fn(), create: jest.fn() },
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

function makeShootTask(
  teamAssignments: Array<{
    membershipId: string;
    assignmentRole: CampaignAssignmentRole;
  }>,
) {
  return {
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
          teamAssignments,
          publishingSchedules: [
            { scheduledAt: new Date("2026-09-05T10:00:00Z") },
          ],
        },
        client: null,
      },
    },
  };
}

function makeScriptReviewTask(
  teamAssignments: Array<{
    membershipId: string;
    assignmentRole: CampaignAssignmentRole;
  }>,
) {
  return {
    id: "task-review",
    agencyId: AGENCY,
    workflowInstanceId: INSTANCE,
    workflowStepId: STEP_SCRIPT_REVIEW,
    ownerMembershipId: "manager-1",
    status: TaskStatus.WAITING_REVIEW,
    deadlineAt: new Date("2026-08-28T18:00:00Z"),
    workflowStep: { stage: ContentStage.MANAGER_SCRIPT_REVIEW },
    owner: { id: "manager-1", user: { name: "Manager" } },
    workflowInstance: {
      id: INSTANCE,
      templateId: "template-1",
      managerMembershipId: "manager-1",
      contentAsset: {
        displayCode: "REEL-001",
        campaign: {
          teamAssignments,
          publishingSchedules: [
            { scheduledAt: new Date("2026-09-05T10:00:00Z") },
          ],
        },
        client: null,
      },
    },
  };
}

describe("Workflow: downstream-assignee non-blocking", () => {
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
    prisma.workflowTask.update.mockResolvedValue({ id: "task-shoot" });
    prisma.workflowTask.create.mockResolvedValue({ id: "task-next" });
    prisma.workflowInstance.update.mockResolvedValue({ id: INSTANCE });
    prisma.workflowInstance.findUnique.mockResolvedValue({
      id: INSTANCE,
      templateId: "template-1",
    });
    prisma.workflowTransition.create.mockResolvedValue({ id: "transition-1" });
    prisma.workflowTransition.findFirst.mockResolvedValue(null);
    prisma.workflowStep.findFirst.mockResolvedValue({ id: "step-next" });
    prisma.submission.findFirst.mockResolvedValue(null);
    prisma.membership.findFirst.mockResolvedValue({ userId: "user-manager" });
    prisma.notification.create.mockResolvedValue({ id: "notif-1" });
  });

  it("10. campaignAssigneeOrNull: 0 → null, 1 → id, >1 → null (no arbitrary pick)", () => {
    const svc = service as any;

    expect(svc.campaignAssigneeOrNull([], CampaignAssignmentRole.DOP)).toBeNull();

    expect(
      svc.campaignAssigneeOrNull(
        [{ membershipId: "dop-1", assignmentRole: CampaignAssignmentRole.DOP }],
        CampaignAssignmentRole.DOP,
      ),
    ).toBe("dop-1");

    expect(
      svc.campaignAssigneeOrNull(
        [
          { membershipId: "dop-1", assignmentRole: CampaignAssignmentRole.DOP },
          { membershipId: "dop-2", assignmentRole: CampaignAssignmentRole.DOP },
        ],
        CampaignAssignmentRole.DOP,
      ),
    ).toBeNull();
  });

  it("2. DOP submits SHOOT with exactly one editor → EDITOR_INTAKE assigned", async () => {
    const task = makeShootTask([
      {
        membershipId: "editor-1",
        assignmentRole: CampaignAssignmentRole.EDITOR,
      },
    ]);

    prisma.workflowInstance.findFirst.mockResolvedValue({
      id: INSTANCE,
      agencyId: AGENCY,
      contentAssetId: ASSET,
      currentTaskId: "task-shoot",
      currentTask: task,
    });
    prisma.submission.create.mockResolvedValue({
      id: "sub-1",
      submissionType: "RAW_FOOTAGE",
    });

    await service.performAction(
      ASSET,
      {
        action: "SUBMIT_FOR_REVIEW" as any,
        idempotencyKey: "key-2",
        externalLink: "https://example.com/footage",
      },
      { agencyId: AGENCY, membershipId: "dop-1" } as any,
    );

    expect(prisma.workflowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerMembershipId: "editor-1" }),
      }),
    );
    expect(prisma.assignmentHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ toMembershipId: "editor-1" }),
      }),
    );
    expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      DomainEvents.ContentAssigned,
      expect.objectContaining({
        payload: expect.objectContaining({ assigneeId: "editor-1" }),
      }),
    );
  });

  it("3. DOP submits SHOOT with NO editor → submission succeeds, EDITOR_INTAKE unassigned", async () => {
    const task = makeShootTask([]);

    prisma.workflowInstance.findFirst.mockResolvedValue({
      id: INSTANCE,
      agencyId: AGENCY,
      contentAssetId: ASSET,
      currentTaskId: "task-shoot",
      currentTask: task,
    });
    prisma.submission.create.mockResolvedValue({
      id: "sub-1",
      submissionType: "RAW_FOOTAGE",
    });

    await expect(
      service.performAction(
        ASSET,
        {
          action: "SUBMIT_FOR_REVIEW" as any,
          idempotencyKey: "key-3",
          externalLink: "https://example.com/footage",
        },
        { agencyId: AGENCY, membershipId: "dop-1" } as any,
      ),
    ).resolves.toBeDefined();

    expect(prisma.workflowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerMembershipId: null }),
      }),
    );

    expect(eventBus.publishWithinTransaction).not.toHaveBeenCalledWith(
      expect.anything(),
      DomainEvents.ContentAssigned,
      expect.anything(),
    );

    expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      DomainEvents.SubmissionCreated,
      expect.objectContaining({
        payload: expect.objectContaining({ contentAssetId: ASSET }),
      }),
    );

    expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      DomainEvents.WorkflowStageChanged,
      expect.anything(),
    );

    const calls: any[] = prisma.assignmentHistory.create.mock.calls;
    const nullAssignment = calls.find(
      (c: any[]) => c[0]?.data?.toMembershipId === null,
    );
    expect(nullAssignment).toBeUndefined();
  });

  it("4. Multiple editors → EDITOR_INTAKE unassigned (no arbitrary selection)", async () => {
    const task = makeShootTask([
      {
        membershipId: "editor-1",
        assignmentRole: CampaignAssignmentRole.EDITOR,
      },
      {
        membershipId: "editor-2",
        assignmentRole: CampaignAssignmentRole.EDITOR,
      },
    ]);

    prisma.workflowInstance.findFirst.mockResolvedValue({
      id: INSTANCE,
      agencyId: AGENCY,
      contentAssetId: ASSET,
      currentTaskId: "task-shoot",
      currentTask: task,
    });
    prisma.submission.create.mockResolvedValue({
      id: "sub-1",
      submissionType: "RAW_FOOTAGE",
    });

    await service.performAction(
      ASSET,
      {
        action: "SUBMIT_FOR_REVIEW" as any,
        idempotencyKey: "key-4",
        externalLink: "https://example.com/footage",
      },
      { agencyId: AGENCY, membershipId: "dop-1" } as any,
    );

    const createCall = prisma.workflowTask.create.mock.calls[0][0];
    expect(createCall.data.ownerMembershipId).toBeNull();

    expect(eventBus.publishWithinTransaction).not.toHaveBeenCalledWith(
      expect.anything(),
      DomainEvents.ContentAssigned,
      expect.anything(),
    );
  });

  it("5. Manager approves script with exactly one DOP → SHOOT assigned", async () => {
    const task = makeScriptReviewTask([
      { membershipId: "dop-1", assignmentRole: CampaignAssignmentRole.DOP },
    ]);

    prisma.workflowInstance.findFirst.mockResolvedValue({
      id: INSTANCE,
      agencyId: AGENCY,
      contentAssetId: ASSET,
      currentTaskId: "task-review",
      currentTask: task,
    });

    await service.performAction(
      ASSET,
      { action: "APPROVE" as any, idempotencyKey: "key-5" },
      { agencyId: AGENCY, membershipId: "manager-1" } as any,
    );

    expect(prisma.workflowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerMembershipId: "dop-1" }),
      }),
    );
    expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      DomainEvents.ContentAssigned,
      expect.objectContaining({
        payload: expect.objectContaining({ assigneeId: "dop-1" }),
      }),
    );
  });

  it("6. Manager approves script with NO DOP → SHOOT unassigned, approval succeeds", async () => {
    const task = makeScriptReviewTask([]);

    prisma.workflowInstance.findFirst.mockResolvedValue({
      id: INSTANCE,
      agencyId: AGENCY,
      contentAssetId: ASSET,
      currentTaskId: "task-review",
      currentTask: task,
    });

    await expect(
      service.performAction(
        ASSET,
        { action: "APPROVE" as any, idempotencyKey: "key-6" },
        { agencyId: AGENCY, membershipId: "manager-1" } as any,
      ),
    ).resolves.toBeDefined();

    expect(prisma.workflowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerMembershipId: null }),
      }),
    );
    expect(eventBus.publishWithinTransaction).not.toHaveBeenCalledWith(
      expect.anything(),
      DomainEvents.ContentAssigned,
      expect.anything(),
    );
  });

  it("7. Multiple DOPs → SHOOT task unassigned (no arbitrary DOP selected)", async () => {
    const task = makeScriptReviewTask([
      { membershipId: "dop-1", assignmentRole: CampaignAssignmentRole.DOP },
      { membershipId: "dop-2", assignmentRole: CampaignAssignmentRole.DOP },
    ]);

    prisma.workflowInstance.findFirst.mockResolvedValue({
      id: INSTANCE,
      agencyId: AGENCY,
      contentAssetId: ASSET,
      currentTaskId: "task-review",
      currentTask: task,
    });

    await service.performAction(
      ASSET,
      { action: "APPROVE" as any, idempotencyKey: "key-7" },
      { agencyId: AGENCY, membershipId: "manager-1" } as any,
    );

    const createCall = prisma.workflowTask.create.mock.calls[0][0];
    expect(createCall.data.ownerMembershipId).toBeNull();
  });

  it("9. Request changes → returned to actual previous submitter, not arbitrary campaign member", async () => {
    const task = makeScriptReviewTask([
      {
        membershipId: "writer-campaign",
        assignmentRole: CampaignAssignmentRole.WRITER,
      },
    ]);

    prisma.workflowInstance.findFirst.mockResolvedValue({
      id: INSTANCE,
      agencyId: AGENCY,
      contentAssetId: ASSET,
      currentTaskId: "task-review",
      currentTask: task,
    });

    prisma.submission.findFirst.mockResolvedValue({
      submittedBy: "writer-actual",
    });

    await service.performAction(
      ASSET,
      {
        action: "REQUEST_CHANGES" as any,
        idempotencyKey: "key-9",
        comment: "needs more detail",
      },
      { agencyId: AGENCY, membershipId: "manager-1" } as any,
    );

    expect(prisma.workflowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerMembershipId: "writer-actual" }),
      }),
    );
    expect(prisma.assignmentHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ toMembershipId: "writer-actual" }),
      }),
    );
  });
});
