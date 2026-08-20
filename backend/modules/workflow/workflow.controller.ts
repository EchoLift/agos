import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { ApproveContentDto } from "./dto/approve-content.dto";
import { AssignContentDto } from "./dto/assign-content.dto";
import { BlockContentDto } from "./dto/block-content.dto";
import { CreateContentAssetDto } from "./dto/create-content-asset.dto";
import { RequestChangesDto } from "./dto/request-changes.dto";
import { AdvanceWorkflowStageDto } from "./dto/advance-workflow-stage.dto";
import { WorkflowActionDto } from "./dto/workflow-action.dto";
import { WorkflowService } from "./workflow.service";

@Controller({ path: "content-assets", version: "1" })
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  create(@Body() dto: CreateContentAssetDto) {
    return this.workflowService.createContentAsset(dto);
  }

  @Get(":id")
  findById(@Param("id") id: string, @CurrentUser() user: IdentityContext) {
    return this.workflowService.findById(id, user);
  }

  @Patch(":id")
  updateBrief(
    @Param("id") id: string,
    @Body() dto: Partial<CreateContentAssetDto>,
  ) {
    return this.workflowService.updateBrief(id, dto);
  }

  @Post(":id/advance-stage")
  advanceStage(@Param("id") id: string, @Body() dto: AdvanceWorkflowStageDto) {
    return this.workflowService.advanceStage(id, dto);
  }

  @Post(":id/assign")
  assign(@Param("id") id: string, @Body() dto: AssignContentDto) {
    return this.workflowService.assign(id, dto);
  }

  @Post(":id/actions")
  performAction(
    @Param("id") id: string,
    @Body() dto: WorkflowActionDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.workflowService.performAction(id, dto, user);
  }

  @Post(":id/recall-submission")
  recallSubmission(
    @Param("id") id: string,
    @Body() dto: { actorId: string; submissionId: string },
  ) {
    return this.workflowService.recallSubmission(id, dto);
  }

  @Post(":id/submissions/:submissionId/seen")
  markSubmissionSeen(
    @Param("id") id: string,
    @Param("submissionId") submissionId: string,
    @Body() dto: { actorId: string },
  ) {
    return this.workflowService.markSubmissionSeen(id, submissionId, dto);
  }

  @Post(":id/approve")
  approve(@Param("id") id: string, @Body() dto: ApproveContentDto) {
    return this.workflowService.approve(id, dto);
  }

  @Post(":id/request-changes")
  requestChanges(@Param("id") id: string, @Body() dto: RequestChangesDto) {
    return this.workflowService.requestChanges(id, dto);
  }

  @Post(":id/block")
  block(@Param("id") id: string, @Body() dto: BlockContentDto) {
    return this.workflowService.block(id, dto);
  }

  @Post(":id/unblock")
  unblock(@Param("id") id: string, @Body() dto: { actorId: string }) {
    return this.workflowService.unblock(id, dto.actorId);
  }
}
