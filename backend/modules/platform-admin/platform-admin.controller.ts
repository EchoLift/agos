import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { SkipEntitlement } from "@packages/security/decorators/skip-entitlement.decorator";
import { SkipTenant } from "@packages/security/decorators/skip-tenant.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { PlatformAdminService } from "./platform-admin.service";
import { UpdateEntitlementDto } from "./dto/update-entitlement.dto";
import {
  CreatePricingPlanDto,
  UpdatePricingPlanDto,
} from "./dto/pricing-plan.dto";
import {
  CreatePricingDiscountDto,
  UpdatePricingDiscountDto,
} from "./dto/pricing-discount.dto";

@ApiTags("Platform Admin")
@ApiBearerAuth()
@Controller({ path: "platform-admin", version: "1" })
@SkipEntitlement()
@SkipTenant()
@UseGuards(PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly service: PlatformAdminService) {}

  @Get("overview")
  @ApiOperation({ summary: "Get platform adoption overview" })
  overview() {
    return this.service.getOverview();
  }

  @Get("pricing/plans")
  pricingPlans() {
    return this.service.listPricingPlans();
  }

  @Post("pricing/plans")
  createPricingPlan(
    @Body() dto: CreatePricingPlanDto,
    @CurrentUser() actor: IdentityContext,
  ) {
    return this.service.createPricingPlan(dto, actor.userId);
  }

  @Patch("pricing/plans/:planId")
  updatePricingPlan(
    @Param("planId") planId: string,
    @Body() dto: UpdatePricingPlanDto,
    @CurrentUser() actor: IdentityContext,
  ) {
    return this.service.updatePricingPlan(planId, dto, actor.userId);
  }

  @Get("pricing/discounts")
  pricingDiscounts() {
    return this.service.listPricingDiscounts();
  }

  @Post("pricing/discounts")
  createPricingDiscount(
    @Body() dto: CreatePricingDiscountDto,
    @CurrentUser() actor: IdentityContext,
  ) {
    return this.service.createPricingDiscount(dto, actor.userId);
  }

  @Patch("pricing/discounts/:discountId")
  updatePricingDiscount(
    @Param("discountId") discountId: string,
    @Body() dto: UpdatePricingDiscountDto,
    @CurrentUser() actor: IdentityContext,
  ) {
    return this.service.updatePricingDiscount(discountId, dto, actor.userId);
  }

  @Get("agencies")
  @ApiOperation({
    summary: "List agencies with entitlement and adoption aggregates",
  })
  agencies(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.service.listAgencies(Number(page) || 1, Number(pageSize) || 25);
  }

  @Get("agencies/:agencyId")
  @ApiOperation({ summary: "Get one agency's operational aggregates" })
  agency(@Param("agencyId") agencyId: string) {
    return this.service.getAgency(agencyId);
  }

  @Patch("agencies/:agencyId/entitlement")
  @ApiOperation({ summary: "Manually update an agency entitlement" })
  entitlement(
    @Param("agencyId") agencyId: string,
    @Body() dto: UpdateEntitlementDto,
    @CurrentUser() actor: IdentityContext,
  ) {
    return this.service.updateEntitlement(agencyId, dto, actor.userId);
  }
}
