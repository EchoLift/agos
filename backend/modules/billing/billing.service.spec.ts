import { PaymentOrderStatus } from "@prisma/client";
import { BillingService } from "./billing.service";

describe("BillingService payment return reconciliation", () => {
  it("marks a dropped payment cancelled even when Cashfree omits payment_time", async () => {
    const order = {
      id: "internal-order",
      agencyId: "agency-1",
      cashfreeOrderId: "cashfree-order",
      status: PaymentOrderStatus.PENDING,
      agency: { displayName: "Agency", name: "Agency" },
    };
    const prisma = {
      agencyPaymentOrder: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...order, ...data }),
          ),
      },
      membership: {
        findUnique: jest.fn().mockResolvedValue({
          id: "membership-1",
          status: "ACTIVE",
          deletedAt: null,
          roles: [],
          role: { systemRole: { key: "OWNER" } },
        }),
      },
    };
    const cashfree = {
      getOrderPayments: jest.fn().mockResolvedValue([
        {
          cf_payment_id: "6418665698",
          payment_status: "USER_DROPPED",
          payment_message: "User left checkout",
        },
      ]),
    };
    const service = new BillingService(
      prisma as never,
      cashfree as never,
      {} as never,
      {} as never,
    );

    await expect(service.order("user-1", order.id)).resolves.toMatchObject({
      status: PaymentOrderStatus.CANCELLED,
    });
    expect(prisma.agencyPaymentOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentOrderStatus.CANCELLED,
          providerFailureReason: "User left checkout",
        }),
      }),
    );
  });
});
