import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { CalendarService } from "./calendar.service";
import { CalendarEventsQueryDto } from "./dto/calendar-events-query.dto";

@ApiTags("Calendar")
@ApiBearerAuth()
@Controller({ path: "calendar", version: "1" })
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("events")
  @ApiOperation({
    summary: "Get role-aware calendar events for the active agency",
  })
  getEvents(
    @Query() query: CalendarEventsQueryDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.calendarService.getEvents(query, user);
  }
}
