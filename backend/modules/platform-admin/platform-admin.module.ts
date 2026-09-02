import { Module } from "@nestjs/common";
import { DatabaseModule } from "@packages/database/database.module";
import { PlatformAdminController } from "./platform-admin.controller";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { PlatformAdminService } from "./platform-admin.service";

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminGuard, PlatformAdminService],
})
export class PlatformAdminModule {}
