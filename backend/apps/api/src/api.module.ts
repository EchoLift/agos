import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "@modules/auth/auth.module";
import { AuditModule } from "@modules/audit/audit.module";
import { ActivationModule } from "@modules/activation/activation.module";
import { CalendarModule } from "@modules/calendar/calendar.module";
import { CampaignModule } from "@modules/campaign/campaign.module";
import { ClientModule } from "@modules/client/client.module";
import { ContentModule } from "@modules/content/content.module";
import { DashboardModule } from "@modules/dashboard/dashboard.module";
import { FileModule } from "@modules/file/file.module";
import { GoogleCalendarModule } from "@modules/google-calendar/google-calendar.module";
import { NotificationModule } from "@modules/notification/notification.module";
import { OrganizationModule } from "@modules/organization/organization.module";
import { UserModule } from "@modules/user/user.module";
import { WorkflowModule } from "@modules/workflow/workflow.module";
import { WorkOrderModule } from "@modules/work-order/work-order.module";
import { ConfigValidationModule } from "@packages/config/config-validation.module";
import { DatabaseModule } from "@packages/database/database.module";
import { EventBusModule } from "@packages/events/event-bus.module";
import { RequestContextModule } from "@packages/request-context/request-context.module";
import { LoggerModule } from "@packages/logger/logger.module";
import { ExceptionFilterModule } from "@packages/exception-filter/exception-filter.module";
import { SecurityModule } from "@packages/security/security.module";
import { APP_GUARD } from "@nestjs/core";
import { JwtAuthGuard } from "@packages/security/guards/jwt-auth.guard";
import { TenantGuard } from "@packages/security/guards/tenant.guard";
import { PermissionsGuard } from "@packages/security/guards/permissions.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ConfigValidationModule,
    DatabaseModule,
    EventBusModule,
    RequestContextModule,
    ActivationModule,
    LoggerModule,
    ExceptionFilterModule,
    AuthModule,
    UserModule,
    OrganizationModule,
    CalendarModule,
    ClientModule,
    CampaignModule,
    ContentModule,
    DashboardModule,
    WorkflowModule,
    WorkOrderModule,
    NotificationModule,
    AuditModule,
    FileModule,
    GoogleCalendarModule,
    SecurityModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class ApiModule {}
