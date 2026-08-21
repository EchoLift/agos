import { Module } from "@nestjs/common";
import { DatabaseModule } from "@packages/database/database.module";
import { EventBusModule } from "@packages/events/event-bus.module";
import { ClientAnalyticsService } from "./client-analytics.service";
import { ClientAnalyticsController } from "./client-analytics.controller";
import { R2StorageService } from "./r2-storage.service";

@Module({
  imports: [DatabaseModule, EventBusModule],
  controllers: [ClientAnalyticsController],
  providers: [ClientAnalyticsService, R2StorageService],
  exports: [ClientAnalyticsService, R2StorageService],
})
export class ClientAnalyticsModule {}
