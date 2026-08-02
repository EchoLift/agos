import { Module } from "@nestjs/common";
import { DatabaseModule } from "@packages/database/database.module";
import { EventBusModule } from "@packages/events/event-bus.module";
import { UserRepository } from "./repositories/user.repository";
import { UserService } from "./services/user.service";
import { UserLookupService } from "./services/user-lookup.service";
import { UserConsumer } from "./consumers/user.consumer";
import { UserController } from "./user.controller";
import { MeController } from "./me.controller";

@Module({
  imports: [DatabaseModule, EventBusModule],
  controllers: [UserController, MeController],
  providers: [UserRepository, UserService, UserLookupService, UserConsumer],
  exports: [UserService, UserLookupService],
})
export class UserModule {}
