import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { Public } from "@packages/security/decorators/public.decorator";
import { SkipEntitlement } from "@packages/security/decorators/skip-entitlement.decorator";
import { SkipTenant } from "@packages/security/decorators/skip-tenant.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { BillingService } from "./billing.service";
import { CashfreeService } from "./cashfree.service";
import { CreatePaymentOrderDto } from "./dto/create-payment-order.dto";

@ApiTags("Billing")
@ApiBearerAuth()
@Controller({ path: "billing", version: "1" })
@SkipEntitlement()
export class BillingController {
  constructor(
    private service: BillingService,
    private cashfree: CashfreeService,
  ) {}
  @Get("agencies") @SkipTenant() agencies(@CurrentUser() u: IdentityContext) {
    return this.service.listEligible(u.userId);
  }
  @Get("plans") @SkipTenant() plans(
    @CurrentUser() u: IdentityContext,
    @Query("agencyId") agencyId?: string,
  ) {
    return this.service.plans(u.userId, agencyId);
  }
  @Post("agencies/:agencyId/orders") create(
    @Param("agencyId") id: string,
    @Body() dto: CreatePaymentOrderDto,
    @CurrentUser() u: IdentityContext,
  ) {
    return this.service.createOrder(id, u.userId, dto.planId);
  }
  @Get("orders/:orderId") @SkipTenant() order(
    @Param("orderId") id: string,
    @CurrentUser() u: IdentityContext,
  ) {
    return this.service.order(u.userId, id);
  }
  @Get("cashfree/webhook")
  @Public()
  webhookHealth() {
    return { ok: true, service: "cashfree-webhook" };
  }
  @Post("cashfree/webhook") @Public() async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-webhook-timestamp") ts: string,
    @Headers("x-webhook-signature") sig: string,
  ) {
    if (!req.rawBody?.length)
      throw new UnauthorizedException("Invalid Cashfree webhook payload.");
    this.cashfree.verifyWebhook(req.rawBody, ts, sig);
    return this.service.webhook(req.body);
  }
}
