import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@packages/database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: {
    agencyId: string;
    actorId?: string | null;
    eventType: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.auditEvent.create({
      data: {
        agencyId: input.agencyId,
        actorId: input.actorId,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        metadataJson: (input.metadata ?? {}) as Prisma.InputJsonValue
      }
    });
  }
}
