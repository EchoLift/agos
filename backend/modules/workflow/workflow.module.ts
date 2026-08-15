import { Module } from "@nestjs/common";
import { GoogleCalendarModule } from "@modules/google-calendar/google-calendar.module";
import { WorkflowBoardController } from "./workflow-board.controller";
import { WorkflowController } from "./workflow.controller";
import { WorkflowService } from "./workflow.service";

@Module({
  imports: [GoogleCalendarModule],
  controllers: [WorkflowController, WorkflowBoardController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
