import { Module } from "@nestjs/common";
import { GoogleCalendarModule } from "@modules/google-calendar/google-calendar.module";
import { WorkOrderController } from "./work-order.controller";
import { WorkOrderService } from "./work-order.service";

@Module({
  imports: [GoogleCalendarModule],
  controllers: [WorkOrderController],
  providers: [WorkOrderService],
  exports: [WorkOrderService],
})
export class WorkOrderModule {}
