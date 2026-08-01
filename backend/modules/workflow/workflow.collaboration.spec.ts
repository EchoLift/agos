import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApprovalStatus, BlockerStatus, SubmissionStatus, TaskStatus } from '@prisma/client';
import { WorkflowService } from './workflow.service';
import { DomainEvents } from '@packages/events/domain-event';

describe('WorkflowService collaboration flows', () => {
  let service: WorkflowService;
  let prisma: any;
  let eventBus: any;

  beforeEach(() => {
    prisma = {
      contentAsset: { findUnique: jest.fn() },
      submission: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      workflowTask: { update: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      workflowInstance: { update: jest.fn(), findFirst: jest.fn() },
      approval: { findUnique: jest.fn(), create: jest.fn() },
      blocker: { create: jest.fn(), updateMany: jest.fn() },
      workflowTransition: { create: jest.fn(), findFirst: jest.fn() },
      assignmentHistory: { create: jest.fn() },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(prisma)),
    };
    eventBus = { publish: jest.fn<() => Promise<unknown>>().mockResolvedValue({}) } as any;
    service = new WorkflowService(prisma as any, eventBus as any);
  });

  it('creates a submission and marks the task for review', async () => {
    prisma.contentAsset.findUnique.mockResolvedValue({ id: 'asset-1', agencyId: 'agency-1' });
    prisma.workflowTask.findUnique.mockResolvedValue({
      id: 'task-1',
      agencyId: 'agency-1',
      workflowInstanceId: 'instance-1',
      ownerMembershipId: 'member-1',
      workflowStepId: 'step-1',
      deadlineAt: new Date(),
      workflowInstance: { contentAssetId: 'asset-1' },
      workflowStep: { stage: 'WRITING' },
    });
    prisma.submission.findFirst.mockResolvedValue(null);
    prisma.submission.create.mockResolvedValue({ id: 'submission-1', version: 1 });
    prisma.workflowTask.update.mockResolvedValue({ id: 'task-1' });

    const result = await service.submit('asset-1', {
      actorId: 'member-1',
      workflowTaskId: 'task-1',
      submissionType: 'RAW_FOOTAGE' as any,
      body: 'draft ready',
    });

    expect(result).toEqual(expect.objectContaining({ id: 'submission-1' }));
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.SubmissionCreated,
      expect.objectContaining({ payload: expect.objectContaining({ contentAssetId: 'asset-1' }) }),
    );
  });

  it('marks a submission as seen and publishes a review event', async () => {
    prisma.contentAsset.findUnique.mockResolvedValue({ id: 'asset-1', agencyId: 'agency-1' });
    prisma.submission.findUnique.mockResolvedValue({
      id: 'submission-1',
      agencyId: 'agency-1',
      workflowTaskId: 'task-1',
      status: SubmissionStatus.SUBMITTED,
      seenAt: null,
      workflowTask: { workflowInstance: { contentAssetId: 'asset-1' } },
    });
    prisma.submission.update.mockResolvedValue({
      id: 'submission-1',
      status: SubmissionStatus.SEEN,
      seenAt: new Date(),
    });

    const result = await service.markSubmissionSeen('asset-1', 'submission-1', { actorId: 'manager-1' });

    expect(result).toEqual(expect.objectContaining({ id: 'submission-1', status: SubmissionStatus.SEEN }));
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.SubmissionViewed,
      expect.objectContaining({ payload: expect.objectContaining({ submissionId: 'submission-1' }) }),
    );
  });

  it('records approval and advances the workflow when approved', async () => {
    prisma.contentAsset.findUnique.mockResolvedValue({ id: 'asset-1', agencyId: 'agency-1' });
    prisma.workflowTask.findUnique.mockResolvedValue({
      id: 'task-1',
      agencyId: 'agency-1',
      workflowInstanceId: 'instance-1',
      ownerMembershipId: 'member-1',
      workflowStepId: 'step-1',
      deadlineAt: new Date(),
      workflowInstance: { contentAssetId: 'asset-1' },
      workflowStep: { stage: 'WRITING' },
    });
    prisma.approval.findUnique.mockResolvedValue(null);
    prisma.approval.create.mockResolvedValue({ id: 'approval-1', status: ApprovalStatus.APPROVED });
    prisma.workflowTask.update.mockResolvedValue({ id: 'task-1' });
    prisma.workflowTask.create.mockResolvedValue({ id: 'next-task-1' });
    prisma.workflowInstance.update.mockResolvedValue({ id: 'instance-1' });
    prisma.workflowTransition.create.mockResolvedValue({ id: 'transition-1' });
    prisma.assignmentHistory.create.mockResolvedValue({ id: 'history-1' });

    const result = await service.approve('asset-1', {
      actorId: 'manager-1',
      workflowTaskId: 'task-1',
      comment: 'looks good',
      nextOwnerId: 'member-2',
      nextStage: 'MANAGER_SCRIPT_REVIEW' as any,
      nextWorkflowStepId: 'step-2',
      nextDeadlineAt: new Date().toISOString(),
      idempotencyKey: 'approval-1',
    });

    expect(result).toEqual(expect.objectContaining({ id: 'approval-1' }));
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.ApprovalGranted,
      expect.objectContaining({ payload: expect.objectContaining({ contentAssetId: 'asset-1' }) }),
    );
  });
});
