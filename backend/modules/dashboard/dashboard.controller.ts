import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@packages/security/decorators/current-user.decorator';
import { IdentityContext } from '@packages/security/interfaces/identity-context.interface';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(@CurrentUser() user: IdentityContext) {
    return this.dashboardService.getDashboard(user.agencyId ?? '', user);
  }
}
