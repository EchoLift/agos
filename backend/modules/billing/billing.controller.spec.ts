import { UnauthorizedException } from "@nestjs/common";
import { BillingController } from "./billing.controller";

describe("BillingController webhook", () => {
  const service = { webhook: jest.fn() } as any;
  const cashfree = { verifyWebhook: jest.fn() } as any;
  const controller = new BillingController(service, cashfree);

  beforeEach(() => jest.clearAllMocks());

  it("rejects an empty webhook body as unauthorized", async () => {
    await expect(
      controller.webhook({ body: {} } as any, "timestamp", "signature"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cashfree.verifyWebhook).not.toHaveBeenCalled();
  });

  it("verifies the exact raw body before processing", async () => {
    const rawBody = Buffer.from('{"type":"TEST"}');
    service.webhook.mockResolvedValue({ accepted: true });

    await expect(
      controller.webhook(
        { rawBody, body: { type: "TEST" } } as any,
        "timestamp",
        "signature",
      ),
    ).resolves.toEqual({ accepted: true });
    expect(cashfree.verifyWebhook).toHaveBeenCalledWith(
      rawBody,
      "timestamp",
      "signature",
    );
  });
});
