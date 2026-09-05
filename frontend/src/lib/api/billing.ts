import { apiClient } from "../api-client";
import type { SubscriptionRecord } from "./platform-admin";
export type BillingPeriod="THREE_MONTHS"|"SIX_MONTHS"|"TWELVE_MONTHS";
export type BillingAgency={agency:{id:string;name:string;slug:string};role:"OWNER"|"FINANCE";subscription:SubscriptionRecord|null;activeMembers:number;teamLimit:number|null;renewalAvailableAt:string|null;paymentHistory:Array<{id:string;period:BillingPeriod;amountMinor:number;currency:string;status:string;paidAt:string|null;entitlementEndsAt:string|null;createdAt:string}>};
export const getBillingAgencies=()=>apiClient<BillingAgency[]>("/billing/agencies");
export const getBillingPlans=()=>apiClient<Array<{period:BillingPeriod;months:number;amountMinor:number;teamLimit:number|null;currency:string}>>("/billing/plans");
export const createBillingOrder=(agencyId:string,period:BillingPeriod)=>apiClient<{orderId:string;paymentSessionId:string;environment:"sandbox"|"production"}>(`/billing/agencies/${agencyId}/orders`,{method:"POST",agencyId,body:JSON.stringify({period})});
export const getBillingOrder=(id:string)=>apiClient<{id:string;status:string;agency:{displayName:string;name:string}}>(`/billing/orders/${id}`);
