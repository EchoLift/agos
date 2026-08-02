import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";
import { RequestContextService } from "@packages/request-context/request-context.service";
import {
  DomainEvent,
  DomainEventName,
  DomainEventPayload,
} from "./domain-event";

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async publish<TPayload extends DomainEventPayload>(
    eventType: DomainEventName,
    input: {
      agencyId: string;
      actorId?: string | null;
      correlationId?: string;
      requestId?: string;
      aggregateId?: string;
      aggregateType?: string;
      payload: TPayload;
    },
  ): Promise<DomainEvent<TPayload>> {
    const event = this.buildEvent(eventType, input);

    await this.persistOutbox(this.prisma, event, {
      aggregateId: input.aggregateId ?? input.agencyId,
      aggregateType: input.aggregateType ?? eventType,
    });

    this.logger.log(`Published ${event.eventType} ${event.eventId}`);
    return event;
  }

  async publishWithinTransaction<TPayload extends DomainEventPayload>(
    tx: Prisma.TransactionClient,
    eventType: DomainEventName,
    input: {
      agencyId: string;
      actorId?: string | null;
      correlationId?: string;
      requestId?: string;
      aggregateId: string;
      aggregateType: string;
      payload: TPayload;
    },
  ): Promise<DomainEvent<TPayload>> {
    const event = this.buildEvent(eventType, input);
    await this.persistOutbox(tx, event, {
      aggregateId: input.aggregateId,
      aggregateType: input.aggregateType,
    });
    return event;
  }

  private buildEvent<TPayload extends DomainEventPayload>(
    eventType: DomainEventName,
    input: {
      agencyId: string;
      actorId?: string | null;
      correlationId?: string;
      requestId?: string;
      payload: TPayload;
    },
  ): DomainEvent<TPayload> {
    const context = this.requestContext.get();

    return {
      eventId: randomUUID(),
      eventType,
      eventVersion: 1,
      agencyId: input.agencyId,
      actorId: input.actorId ?? null,
      occurredAt: new Date().toISOString(),
      correlationId:
        input.correlationId ?? context?.correlationId ?? randomUUID(),
      requestId: input.requestId ?? context?.requestId,
      payload: input.payload,
    };
  }

  private async persistOutbox<TPayload extends DomainEventPayload>(
    client: PrismaService | Prisma.TransactionClient,
    event: DomainEvent<TPayload>,
    aggregate: { aggregateId: string; aggregateType: string },
  ) {
    await client.outboxEvent.create({
      data: {
        id: event.eventId,
        agencyId: event.agencyId,
        aggregateId: aggregate.aggregateId,
        aggregateType: aggregate.aggregateType,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
