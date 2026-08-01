import { ClientService } from './client.service';
import { DomainEvents } from '@packages/events/domain-event';

describe('ClientService', () => {
  let service: ClientService;
  let prisma: any;
  let eventBus: any;

  beforeEach(() => {
    prisma = {
      client: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue({}),
    };

    service = new ClientService(prisma, eventBus);
  });

  it('creates a client in the current agency and publishes a domain event', async () => {
    const dto = {
      agencyId: 'agency-1',
      name: 'Northwind Studios',
      industry: 'E-commerce',
      brandVoice: 'Confident',
      audience: 'Founders',
      competitors: 'Acme, Globex',
    };

    prisma.client.create.mockResolvedValue({
      id: 'client-1',
      agencyId: 'agency-1',
      name: dto.name,
      industry: dto.industry,
      status: 'ACTIVE',
    });

    const client = await service.create(dto, 'agency-1', 'user-1');

    expect(prisma.client.create).toHaveBeenCalledWith({
      data: {
        agencyId: 'agency-1',
        name: dto.name,
        industry: dto.industry,
        brandVoice: dto.brandVoice,
        audience: dto.audience,
        competitors: dto.competitors,
        status: 'ACTIVE',
      },
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.ClientCreated,
      expect.objectContaining({
        agencyId: 'agency-1',
        actorId: 'user-1',
        payload: expect.objectContaining({ clientId: 'client-1' }),
      }),
    );
    expect(client).toEqual(expect.objectContaining({ id: 'client-1' }));
  });

  it('archives a client and publishes an archive event', async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: 'client-1',
      agencyId: 'agency-1',
    });
    prisma.client.update.mockResolvedValue({
      id: 'client-1',
      agencyId: 'agency-1',
      status: 'ARCHIVED',
    });

    const client = await service.archive('client-1', 'agency-1', 'user-1');

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: { status: 'ARCHIVED' },
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      DomainEvents.ClientArchived,
      expect.objectContaining({
        agencyId: 'agency-1',
        actorId: 'user-1',
        payload: expect.objectContaining({ clientId: 'client-1' }),
      }),
    );
    expect(client).toEqual(expect.objectContaining({ status: 'ARCHIVED' }));
  });
});
