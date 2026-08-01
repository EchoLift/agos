import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ContentStage } from '@prisma/client';
import { WorkflowService } from './workflow.service';
import { DomainEvents } from '@packages/events/domain-event';

describe('WorkflowService stage advancement', () => {
  let service: WorkflowService;
  let prisma: any;
  let eventBus: any;

  beforeEach(() => {
    prisma = {
      contentAsset: { findUnique: jest.fn(), findMany: jest.fn() },
      workflowInstance: { findFirst: jest.fn(), update: jest.fn() },
      workflowTransition: { findFirst: jest.fn(), create: jest.fn() },
    };
    eventBus = { publish: jest.fn<() => Promise<unknown>>().mockResolvedValue({}) } as any;
    service = new WorkflowService(prisma, eventBus);
  });

  it('advances a content asset through a valid workflow stage transition', async () => {
    prisma.contentAsset.findUnique.mockResolvedValue({ id: 'asset-1', agencyId: 'agency-1' });
    prisma.workflowInstance.findFirst.mockResolvedValue({ id: 'instance-1', agencyId: 'agency-1', contentAssetId: 'asset-1' });
    prisma.workflowTransition.findFirst.mockResolvedValue({ toStage: ContentStage.IDEA });
    prisma.workflowTransition.create.mockResolvedValue({ id: 'transition-1', toStage: ContentStage.WRITING });
    prisma.workflowInstance.update.mockResolvedValue({ id: 'instance-1' });

    const result = await service.advanceStage('asset-1', {
      actorId: 'member-1',
      toStage: ContentStage.WRITING,
      reason: 'Ready to draft',
    });

    expect(result).toEqual(expect.objectContaining({ toStage: ContentStage.WRITING }));
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.WorkflowStageChanged,
      expect.objectContaining({ payload: expect.objectContaining({ contentAssetId: 'asset-1' }) }),
    );
  });

  it('builds a stage-grouped workflow board read model', async () => {
    prisma.contentAsset.findMany.mockResolvedValue([
      {
        id: 'asset-1',
        displayCode: 'REEL-021',
        title: 'Launch Reel',
        type: 'REEL',
        clientId: 'client-1',
        campaignId: 'campaign-1',
        updatedAt: new Date('2026-07-31T10:00:00.000Z'),
        client: { name: 'Nike India' },
        campaign: { name: 'Air Max Launch' },
        workflowInstances: [
          {
            id: 'workflow-1',
            riskStatus: 'ON_TRACK',
            deadlineAt: new Date('2026-07-31T18:00:00.000Z'),
            startedAt: new Date('2026-07-31T09:00:00.000Z'),
            currentStep: { stage: 'WRITING' },
            transitions: [],
            manager: { id: 'manager-1', user: { name: 'Priya' }, role: { displayName: 'Manager' } },
            currentTask: {
              id: 'task-1',
              status: 'IN_PROGRESS',
              deadlineAt: new Date('2026-07-31T18:00:00.000Z'),
              updatedAt: new Date('2026-07-31T10:30:00.000Z'),
              owner: { id: 'writer-1', user: { name: 'Rahul' }, role: { displayName: 'Writer' } },
              submissions: [],
              approvals: [],
              blockers: []
            }
          }
        ]
      }
    ]);

    const board = await service.getBoard('agency-1');

    expect(board.summary.active).toBe(1);
    expect(board.columns.find((column) => column.stage === 'WRITING')?.items[0]).toEqual(
      expect.objectContaining({
        displayCode: 'REEL-021',
        clientName: 'Nike India',
        campaignName: 'Air Max Launch',
        owner: expect.objectContaining({ name: 'Rahul' })
      })
    );
  });
});
