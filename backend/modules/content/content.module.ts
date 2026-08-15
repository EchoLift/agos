import { Module } from "@nestjs/common";
import { GoogleCalendarModule } from "@modules/google-calendar/google-calendar.module";
import { ContentController } from "./content.controller";
import { ContentService } from "./content.service";

@Module({
  imports: [GoogleCalendarModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
