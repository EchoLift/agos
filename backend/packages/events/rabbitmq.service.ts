import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: any = null;
  private channel: any = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }

  private async connect() {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) {
      this.logger.warn('RABBITMQ_URL not set. Event messaging may not work.');
      return;
    }

    try {
      this.connection = await amqplib.connect(url);
      this.channel = await this.connection.createChannel();
      
      // Define main exchange
      await this.channel.assertExchange('agency_os.events', 'topic', { durable: true });
      this.logger.log('Connected to RabbitMQ and asserted exchange: agency_os.events');
    } catch (err) {
      this.logger.error('Failed to connect to RabbitMQ', err);
    }
  }

  async publish(routingKey: string, payload: any): Promise<boolean> {
    if (!this.channel) {
      this.logger.warn('RabbitMQ channel not available to publish');
      return false;
    }

    const messageBuffer = Buffer.from(JSON.stringify(payload));
    return this.channel.publish('agency_os.events', routingKey, messageBuffer, {
      persistent: true,
      contentType: 'application/json',
    });
  }

  async subscribe(queueName: string, routingKey: string, handler: (msg: amqplib.ConsumeMessage | null) => Promise<void>) {
    if (!this.channel) {
      this.logger.warn('RabbitMQ channel not available to subscribe');
      return;
    }

    await this.channel.assertQueue(queueName, { durable: true });
    await this.channel.bindQueue(queueName, 'agency_os.events', routingKey);

    await this.channel.consume(queueName, async (msg: amqplib.ConsumeMessage | null) => {
      try {
        await handler(msg);
        if (msg) this.channel?.ack(msg);
      } catch (err) {
        this.logger.error(`Error processing message from queue ${queueName}`, err);
        if (msg) this.channel?.nack(msg, false, false); // Reject and drop (DLQ requires queue config)
      }
    });

    this.logger.log(`Subscribed to queue: ${queueName} with routing key: ${routingKey}`);
  }
}
