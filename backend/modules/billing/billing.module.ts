import { Module } from "@nestjs/common";
import { DatabaseModule } from "@packages/database/database.module";
import { AuthModule } from "@modules/auth/auth.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { CashfreeService } from "./cashfree.service";
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [BillingController],
  providers: [BillingService, CashfreeService],
  exports: [BillingService],
})
export class BillingModule {}
