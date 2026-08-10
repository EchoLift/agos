import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import {
  ReviewWorkOrderDto,
  SubmitWorkOrderDto,
} from "./dto/work-order-action.dto";
import { UpdateWorkOrderDto } from "./dto/update-work-order.dto";
import { WorkOrderService } from "./work-order.service";

@ApiTags("Work Orders")
@ApiBearerAuth()
@Controller({ path: "work-orders", version: "1" })
export class WorkOrderController {
  constructor(private readonly workOrderService: WorkOrderService) {}

  @Post()
  @ApiOperation({ summary: "Create a standalone gig/work order" })
  create(
    @Body() dto: CreateWorkOrderDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.workOrderService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: "List visible work orders for the active agency" })
  findMany(@CurrentUser() user: IdentityContext) {
    return this.workOrderService.findMany(user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a work order" })
  findById(@Param("id") id: string, @CurrentUser() user: IdentityContext) {
    return this.workOrderService.findById(id, user);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a work order before completion" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateWorkOrderDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.workOrderService.update(id, dto, user);
  }

  @Post(":id/submit")
  @ApiOperation({ summary: "Submit work for review" })
  submit(
    @Param("id") id: string,
    @Body() dto: SubmitWorkOrderDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.workOrderService.submit(id, dto, user);
  }

  @Post(":id/approve")
  @ApiOperation({ summary: "Approve submitted work" })
  approve(
    @Param("id") id: string,
    @Body() dto: ReviewWorkOrderDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.workOrderService.approve(id, dto, user);
  }

  @Post(":id/request-changes")
  @ApiOperation({ summary: "Request changes on submitted work" })
  requestChanges(
    @Param("id") id: string,
    @Body() dto: ReviewWorkOrderDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.workOrderService.requestChanges(id, dto, user);
  }
}
