import { Module } from "@nestjs/common";
import { WorkflowBoardController } from "./workflow-board.controller";
import { WorkflowController } from "./workflow.controller";
import { WorkflowService } from "./workflow.service";

@Module({
  controllers: [WorkflowController, WorkflowBoardController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
