import { Module } from "@nestjs/common";
import { CryptoModule } from "@packages/crypto/crypto.module";
import { DatabaseModule } from "@packages/database/database.module";
import { EventBusModule } from "@packages/events/event-bus.module";
import { NotificationModule } from "@modules/notification/notification.module";
import { ClientAnalyticsService } from "./client-analytics.service";
import {
  ClientAnalyticsController,
  ClientReportNotificationScheduleController,
} from "./client-analytics.controller";
import { R2StorageService } from "./r2-storage.service";
import { ReportScheduleCalculatorService } from "./services/report-schedule-calculator.service";

@Module({
  imports: [DatabaseModule, EventBusModule, NotificationModule, CryptoModule],
  controllers: [
    ClientAnalyticsController,
    ClientReportNotificationScheduleController,
  ],
  providers: [ClientAnalyticsService, R2StorageService, ReportScheduleCalculatorService],
  exports: [ClientAnalyticsService, R2StorageService, ReportScheduleCalculatorService],
})
export class ClientAnalyticsModule {}
