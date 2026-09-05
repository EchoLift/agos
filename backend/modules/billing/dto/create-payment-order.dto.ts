import { BillingPeriod } from "@prisma/client";
import { IsEnum } from "class-validator";
export class CreatePaymentOrderDto {
  @IsEnum(BillingPeriod) period!: BillingPeriod;
}
