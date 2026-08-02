import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConfigValidationModule } from "@packages/config/config-validation.module";
import { EventBusModule } from "@packages/events/event-bus.module";
import { RequestContextModule } from "@packages/request-context/request-context.module";
import { RealtimeGateway } from "./realtime.gateway";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ConfigValidationModule,
    EventBusModule,
    RequestContextModule,
  ],
  providers: [RealtimeGateway],
})
export class WebsocketModule {}
