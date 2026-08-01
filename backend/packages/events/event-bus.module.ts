import { Global, Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import { RabbitMQService } from './rabbitmq.service';
import { OutboxRelayService } from './outbox-relay.service';

@Global()
@Module({
  providers: [EventBusService, RabbitMQService, OutboxRelayService],
  exports: [EventBusService, RabbitMQService, OutboxRelayService]
})
export class EventBusModule {}

