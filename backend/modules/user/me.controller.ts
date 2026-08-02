import { Body, Controller, Delete, Get, Patch } from "@nestjs/common";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import { UserService } from "./services/user.service";

@Controller({ path: "me", version: "1" })
export class MeController {
  constructor(private readonly userService: UserService) {}

  @Get("profile")
  getProfile(@CurrentUser() user: IdentityContext) {
    return this.userService.getProfile(user.userId);
  }

  @Patch("profile")
  updateProfile(
    @CurrentUser() user: IdentityContext,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.userId, dto);
  }

  @Patch("status")
  updateStatus(
    @CurrentUser() user: IdentityContext,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.userService.updateStatus(user.userId, dto);
  }

  @Delete("status")
  clearStatus(@CurrentUser() user: IdentityContext) {
    return this.userService.clearStatus(user.userId);
  }
}
