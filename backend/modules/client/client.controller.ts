import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { ClientService } from "./client.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@ApiTags("Clients")
@ApiBearerAuth()
@Controller({ path: "clients", version: "1" })
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Client playbook created",
  })
  create(@Body() dto: CreateClientDto, @CurrentUser() user: IdentityContext) {
    return this.clientService.create(dto, user.agencyId, user.userId);
  }

  @Get()
  @ApiResponse({ status: HttpStatus.OK, description: "List of clients" })
  findMany(@CurrentUser() user: IdentityContext) {
    return this.clientService.findMany(user.agencyId ?? "");
  }

  @Get(":id")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Role-aware client playbook",
  })
  findById(@Param("id") id: string, @CurrentUser() user: IdentityContext) {
    return this.clientService.findById(id, user.agencyId, user);
  }

  @Patch(":id")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Client playbook updated",
  })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.clientService.update(id, dto, user.agencyId ?? "", user.userId);
  }

  @Post(":id/archive")
  archive(@Param("id") id: string, @CurrentUser() user: IdentityContext) {
    return this.clientService.archive(id, user.agencyId ?? "", user.userId);
  }

  @Post(":id/restore")
  restore(@Param("id") id: string, @CurrentUser() user: IdentityContext) {
    return this.clientService.restore(id, user.agencyId ?? "", user.userId);
  }

  @Post(":id/assign-manager")
  assignManager(
    @Param("id") id: string,
    @Body("membershipId") membershipId: string,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.clientService.assignManager(
      id,
      membershipId,
      user.agencyId ?? "",
      user.userId,
    );
  }
}
