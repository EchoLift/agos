import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createInAppNotification(input: {
    agencyId: string;
    userId: string;
    title: string;
    body: string;
    eventType: string;
  }) {
    this.logger.log(`Creating notification for ${input.userId}`);
    return this.prisma.notification.create({ data: input });
  }
}
