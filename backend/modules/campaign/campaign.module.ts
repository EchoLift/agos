import { Module } from "@nestjs/common";
import { GoogleCalendarModule } from "@modules/google-calendar/google-calendar.module";
import { CampaignController } from "./campaign.controller";
import { CampaignService } from "./campaign.service";

@Module({
  imports: [GoogleCalendarModule],
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
