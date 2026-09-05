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

  it("retrieves payment attempts for return-page reconciliation", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          payment_status: "USER_DROPPED",
          payment_time: "2026-09-05T20:00:00+05:30",
        },
      ],
    } as Response);
    const service = new CashfreeService({
      get: (key: string) =>
        ({
          CASHFREE_CLIENT_ID: "client-id",
          CASHFREE_CLIENT_SECRET: "secret",
          CASHFREE_ENVIRONMENT: "sandbox",
        })[key],
    } as never);

    await expect(service.getOrderPayments("agencie/order id")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ payment_status: "USER_DROPPED" }),
      ]),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox.cashfree.com/pg/orders/agencie%2Forder%20id/payments",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-api-version": CashfreeService.apiVersion,
          "x-client-id": "client-id",
        }),
      }),
    );
    fetchMock.mockRestore();
  });
});
