import { Controller, Get } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { ActivationService } from "./activation.service";

@ApiTags("Activation")
@ApiBearerAuth()
@Controller({ path: "activation", version: "1" })
export class ActivationController {
  constructor(private readonly activationService: ActivationService) {}

  @Get()
  @ApiOperation({ summary: "Get derived workspace activation state" })
  @ApiResponse({
    status: 200,
    description: "Activation state derived from real agency data",
  })
  getActivation(@CurrentUser() user: IdentityContext) {
    return this.activationService.getActivation(user.agencyId ?? "");
  }
}
