import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { WorkflowBoardQueryDto } from "./dto/workflow-board-query.dto";
import { WorkflowService } from "./workflow.service";

@ApiTags("Workflow")
@ApiBearerAuth()
@Controller({ path: "workflow", version: "1" })
export class WorkflowBoardController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get("board")
  getBoard(
    @CurrentUser() user: IdentityContext,
    @Query() query: WorkflowBoardQueryDto,
  ) {
    return this.workflowService.getBoard(user.agencyId ?? "", query, user);
  }
}
