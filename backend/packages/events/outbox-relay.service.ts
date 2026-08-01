import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@packages/database/prisma.service';
import { RabbitMQService } from './rabbitmq.service';

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processOutboxEvents() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingEvents = await this.prisma.outboxEvent.findMany({
        where: { status: 'PENDING' },
        take: 50,
        orderBy: { createdAt: 'asc' },
      });

      for (const event of pendingEvents) {
        const domainEvent = {
          eventId: event.id,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          agencyId: event.agencyId,
          correlationId: event.correlationId,
          payload: event.payload,
          occurredAt: event.createdAt.toISOString(),
        };

        const routingKey = `event.${event.eventType}`;
        
        const success = await this.rabbitmq.publish(routingKey, domainEvent);

        if (success) {
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: 'PUBLISHED', publishedAt: new Date() },
          });
        }
      }
    } catch (error) {
      this.logger.error('Error processing outbox events', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
