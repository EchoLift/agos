import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "node:crypto";

@Injectable()
export class CashfreeService {
  static readonly apiVersion = "2026-01-01";
  constructor(private readonly config: ConfigService) {}
  get environment() {
    return this.config.get("CASHFREE_ENVIRONMENT") === "production"
      ? "production"
      : "sandbox";
  }
  private get baseUrl() {
    return this.environment === "production"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";
  }
  private get clientId() {
    return (
      this.config.get<string>("CASHFREE_CLIENT_ID") ||
      this.config.get<string>("CASHFREE_APPID")
    );
  }
  private get clientSecret() {
    return (
      this.config.get<string>("CASHFREE_CLIENT_SECRET") ||
      this.config.get<string>("CASHFREE_SECRET_KEY")
    );
  }
  private headers(idempotencyKey?: string) {
    const clientId = this.clientId;
    const secret = this.clientSecret;
    if (!clientId || !secret)
      throw new InternalServerErrorException("Cashfree is not configured.");
    return {
      "content-type": "application/json",
      "x-api-version": CashfreeService.apiVersion,
      "x-client-id": clientId,
      "x-client-secret": secret,
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
    };
  }
  async createOrder(body: object, idempotencyKey: string) {
    const response = await fetch(`${this.baseUrl}/orders`, {
      method: "POST",
      headers: this.headers(idempotencyKey),
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as any;
    if (!response.ok)
      throw new InternalServerErrorException({
        message: "Unable to create Cashfree order.",
        providerCode: data?.code,
      });
    return data as {
      order_id: string;
      cf_order_id: string;
      payment_session_id: string;
    };
  }
  async getOrderPayments(orderId: string) {
    const response = await fetch(
      `${this.baseUrl}/orders/${encodeURIComponent(orderId)}/payments`,
      { headers: this.headers() },
    );
    const data = (await response.json()) as any;
    if (!response.ok)
      throw new InternalServerErrorException({
        message: "Unable to retrieve Cashfree payment status.",
        providerCode: data?.code,
      });
    return data as Array<{
      payment_status: string;
      payment_time?: string;
      payment_message?: string;
      error_details?: {
        error_code?: string;
        error_description?: string;
      } | null;
    }>;
  }
  verifyWebhook(rawBody: Buffer, timestamp: string, signature: string) {
    const secret = this.clientSecret;
    if (!secret || !timestamp || !signature)
      throw new UnauthorizedException("Invalid Cashfree webhook signature.");
    const timestampValue = Number(timestamp);
    const timestampMs =
      timestampValue < 1_000_000_000_000
        ? timestampValue * 1_000
        : timestampValue;
    if (
      !Number.isFinite(timestampValue) ||
      Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000
    )
      throw new UnauthorizedException("Stale Cashfree webhook timestamp.");
    const expected = crypto
      .createHmac("sha256", secret)
      .update(timestamp + rawBody.toString("utf8"))
      .digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
      throw new UnauthorizedException("Invalid Cashfree webhook signature.");
  }
}
