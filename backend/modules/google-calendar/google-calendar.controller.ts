import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "@packages/security/decorators/public.decorator";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { ConnectGoogleCalendarDto } from "./dto/connect-google-calendar.dto";
import { GoogleCalendarService } from "./google-calendar.service";

@ApiTags("Google Calendar Integration")
@ApiBearerAuth()
@Controller({ path: "integrations/google-calendar", version: "1" })
export class GoogleCalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get("status")
  @ApiOperation({ summary: "Get Google Calendar integration status" })
  status(@CurrentUser() user: IdentityContext) {
    return this.googleCalendarService.status(user);
  }

  @Post("connect")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Start Google Calendar OAuth consent" })
  connect(
    @Body() dto: ConnectGoogleCalendarDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.googleCalendarService.connect(dto, user);
  }

  @Public()
  @Get("callback")
  @ApiOperation({ summary: "Handle Google Calendar OAuth callback" })
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response,
  ) {
    if (error || !code || !state) {
      return res.redirect(
        this.googleCalendarService.callbackErrorRedirect(state),
      );
    }

    try {
      const redirectUrl =
        await this.googleCalendarService.completeOAuthCallback(code, state);
      return res.redirect(redirectUrl);
    } catch {
      return res.redirect(
        this.googleCalendarService.callbackErrorRedirect(state),
      );
    }
  }

  @Post("sync")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Sync current user's assigned AGENCIE work to Google Calendar",
  })
  sync(@CurrentUser() user: IdentityContext) {
    return this.googleCalendarService.syncNow(user);
  }

  @Delete("disconnect")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Disconnect Google Calendar integration" })
  disconnect(@CurrentUser() user: IdentityContext) {
    return this.googleCalendarService.disconnect(user);
  }
}
