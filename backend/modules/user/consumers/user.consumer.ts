import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { RabbitMQService } from "@packages/events/rabbitmq.service";
import { UserService } from "../services/user.service";

@Injectable()
export class UserConsumer implements OnModuleInit {
  private readonly logger = new Logger(UserConsumer.name);

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly userService: UserService,
  ) {}

  async onModuleInit() {
    await this.rabbitmq.subscribe(
      "user_module.user_registered",
      "event.UserRegistered",
      async (msg) => {
        if (!msg) return;

        try {
          const content = msg.content.toString();
          const event = JSON.parse(content);

          this.logger.log(
            `Consuming UserRegistered event for aggregateId: ${event.aggregateId}`,
          );

          const authUserId = event.aggregateId;
          if (!authUserId) {
            throw new Error("UserRegistered event missing aggregateId");
          }

          await this.userService.provisionUser(authUserId);
        } catch (error) {
          this.logger.error("Failed to process UserRegistered event", error);
          throw error;
        }
      },
    );
  }
}
