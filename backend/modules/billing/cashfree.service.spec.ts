import { UnauthorizedException } from "@nestjs/common";
import * as crypto from "node:crypto";
import { CashfreeService } from "./cashfree.service";
describe("CashfreeService", () => {
  it("accepts a current valid raw-body signature and rejects tampering", () => {
    const secret = "secret";
    const service = new CashfreeService({
      get: (k: string) => (k === "CASHFREE_CLIENT_SECRET" ? secret : "sandbox"),
    } as never);
    const raw = Buffer.from('{"type":"PAYMENT_SUCCESS_WEBHOOK"}');
    const ts = String(Date.now());
    const sig = crypto
      .createHmac("sha256", secret)
      .update(ts + raw.toString())
      .digest("base64");
    expect(() => service.verifyWebhook(raw, ts, sig)).not.toThrow();
    expect(() => service.verifyWebhook(Buffer.from("{}"), ts, sig)).toThrow(
      UnauthorizedException,
    );
  });

  it("accepts Cashfree dashboard timestamps expressed in Unix seconds", () => {
    const secret = "secret";
    const service = new CashfreeService({
      get: (key: string) =>
        key === "CASHFREE_CLIENT_SECRET" ? secret : "sandbox",
    } as never);
    const raw = Buffer.from('{"type":"TEST"}');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = crypto
      .createHmac("sha256", secret)
      .update(timestamp + raw.toString())
      .digest("base64");

    expect(() =>
      service.verifyWebhook(raw, timestamp, signature),
    ).not.toThrow();
  });
});
