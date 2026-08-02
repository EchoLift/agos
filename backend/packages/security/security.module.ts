import { Module, Global } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthModule } from "@modules/auth/auth.module";
import { UserModule } from "@modules/user/user.module";
import { OrganizationModule } from "@modules/organization/organization.module";
import { RequestContextModule } from "@packages/request-context/request-context.module";
import { SecurityContextService } from "./services/security-context.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { TenantGuard } from "./guards/tenant.guard";
import { PermissionsGuard } from "./guards/permissions.guard";

@Global()
@Module({
  imports: [AuthModule, UserModule, OrganizationModule, RequestContextModule],
  providers: [
    SecurityContextService,
    JwtAuthGuard,
    TenantGuard,
    PermissionsGuard,
    Reflector,
  ],
  exports: [
    SecurityContextService,
    JwtAuthGuard,
    TenantGuard,
    PermissionsGuard,
  ],
})
export class SecurityModule {}
