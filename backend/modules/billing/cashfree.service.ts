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
  private headers(idempotencyKey?: string) {
    const clientId = this.config.get<string>("CASHFREE_CLIENT_ID");
    const secret = this.config.get<string>("CASHFREE_CLIENT_SECRET");
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
  verifyWebhook(rawBody: Buffer, timestamp: string, signature: string) {
    const secret = this.config.get<string>("CASHFREE_CLIENT_SECRET");
    if (!secret || !timestamp || !signature)
      throw new UnauthorizedException("Invalid Cashfree webhook signature.");
    const timestampMs = Number(timestamp);
    if (
      !Number.isFinite(timestampMs) ||
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
