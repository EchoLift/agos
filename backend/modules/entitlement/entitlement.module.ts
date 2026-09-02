import { Global, Module } from "@nestjs/common";
import { DatabaseModule } from "@packages/database/database.module";
import { EntitlementService } from "./entitlement.service";

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [EntitlementService],
  exports: [EntitlementService],
})
export class EntitlementModule {}
