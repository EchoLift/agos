import { Module } from "@nestjs/common";
import { AuthModule } from "@modules/auth/auth.module";
import { GoogleCalendarController } from "./google-calendar.controller";
import { GoogleCalendarOAuthService } from "./google-calendar-oauth.service";
import { GoogleCalendarService } from "./google-calendar.service";
import { GoogleCalendarSyncService } from "./google-calendar-sync.service";

@Module({
  imports: [AuthModule],
  controllers: [GoogleCalendarController],
  providers: [
    GoogleCalendarOAuthService,
    GoogleCalendarService,
    GoogleCalendarSyncService,
  ],
  exports: [GoogleCalendarSyncService],
})
export class GoogleCalendarModule {}
