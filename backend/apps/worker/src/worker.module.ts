import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuditModule } from "@modules/audit/audit.module";
import { NotificationModule } from "@modules/notification/notification.module";
import { ClientAnalyticsModule } from "@modules/client-analytics/client-analytics.module";
import { ConfigValidationModule } from "@packages/config/config-validation.module";
import { DatabaseModule } from "@packages/database/database.module";
import { EventBusModule } from "@packages/events/event-bus.module";
import { RequestContextModule } from "@packages/request-context/request-context.module";
import { UserModule } from "@modules/user/user.module";
import { ScheduleModule } from "@nestjs/schedule";
import { CryptoModule } from "@packages/crypto/crypto.module";
import { NotificationConsumer } from "./consumers/notification.consumer";
import { ReportNotificationSchedulerService } from "./schedulers/report-notification.scheduler";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ConfigValidationModule,
    DatabaseModule,
    EventBusModule,
    RequestContextModule,
    NotificationModule,
    AuditModule,
    UserModule,
    ClientAnalyticsModule,
    CryptoModule,
    ScheduleModule.forRoot(),
  ],
  providers: [NotificationConsumer, ReportNotificationSchedulerService],
})
export class WorkerModule {}
