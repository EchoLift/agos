import { ContentService } from './content.service';
import { DomainEvents } from '@packages/events/domain-event';

describe('ContentService', () => {
  let service: ContentService;
  let prisma: any;
  let eventBus: any;

  beforeEach(() => {
    prisma = {
      campaign: { findUnique: jest.fn() },
      client: { findUnique: jest.fn() },
      contentAsset: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    eventBus = { publish: jest.fn().mockResolvedValue({}) };
    service = new ContentService(prisma, eventBus);
  });

  it('creates a content asset under the current agency and publishes an event', async () => {
    prisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1', agencyId: 'agency-1', clientId: 'client-1' });
    prisma.client.findUnique.mockResolvedValue({ id: 'client-1', agencyId: 'agency-1' });
    prisma.contentAsset.create.mockResolvedValue({
      id: 'asset-1',
      agencyId: 'agency-1',
      clientId: 'client-1',
      campaignId: 'campaign-1',
      displayCode: 'REEL-TEST',
      type: 'REEL',
      title: 'Launch Reel',
      brief: 'Need a sharp launch reel',
      status: 'ACTIVE',
    });

    const asset = await service.create(
      {
        clientId: 'client-1',
        campaignId: 'campaign-1',
        displayCode: 'REEL-TEST',
        type: 'REEL' as any,
        title: 'Launch Reel',
        brief: 'Need a sharp launch reel',
      },
      'agency-1',
      'user-1',
    );

    expect(prisma.contentAsset.create).toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.ContentAssetCreated,
      expect.objectContaining({ agencyId: 'agency-1' }),
    );
    expect(asset).toEqual(expect.objectContaining({ id: 'asset-1' }));
  });
});
