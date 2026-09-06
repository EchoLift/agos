import { PaymentOrderStatus } from "@prisma/client";
import { BillingService } from "./billing.service";

describe("BillingService payment return reconciliation", () => {
  const makeService = (prisma: any = {}, cashfree: any = {}) =>
    new BillingService(prisma, cashfree, {} as never, {} as never);

  it("calculates percentage and fixed discounts in integer minor units", () => {
    const service = makeService() as any;
    expect(
      service.calculatePrice(999900, { type: "PERCENTAGE", value: 2000 }),
    ).toEqual({ discountAmountMinor: 199980, finalAmountMinor: 799920 });
    expect(
      service.calculatePrice(999900, {
        type: "FIXED_AMOUNT",
        value: 100000,
      }),
    ).toEqual({ discountAmountMinor: 100000, finalAmountMinor: 899900 });
  });

  it("chooses the single discount producing the lowest amount", async () => {
    const service = makeService() as any;
    const result = await service.bestDiscount(
      { agencyPaymentOrder: { count: jest.fn().mockResolvedValue(0) } },
      {
        priceAmountMinor: 100000,
        discounts: [
          {
            discount: {
              id: "b",
              name: "Ten percent",
              type: "PERCENTAGE",
              value: 1000,
              isActive: true,
            },
          },
          {
            discount: {
              id: "a",
              name: "Twenty percent",
              type: "PERCENTAGE",
              value: 2000,
              isActive: true,
            },
          },
        ],
      },
      "agency-1",
    );
    expect(result.id).toBe("a");
  });

  it("ignores inactive, future and expired discounts", async () => {
    const service = makeService() as any;
    const result = await service.bestDiscount(
      { agencyPaymentOrder: { count: jest.fn().mockResolvedValue(0) } },
      {
        priceAmountMinor: 100000,
        discounts: [
          {
            discount: {
              id: "inactive",
              type: "FIXED_AMOUNT",
              value: 90000,
              isActive: false,
            },
          },
          {
            discount: {
              id: "future",
              type: "FIXED_AMOUNT",
              value: 90000,
              isActive: true,
              startsAt: new Date(Date.now() + 60_000),
            },
          },
          {
            discount: {
              id: "expired",
              type: "FIXED_AMOUNT",
              value: 90000,
              isActive: true,
              endsAt: new Date(Date.now() - 60_000),
            },
          },
        ],
      },
      "agency-1",
    );
    expect(result).toBeUndefined();
  });

  it("enforces global and per-agency redemption limits", async () => {
    const service = makeService() as any;
    const plan = {
      priceAmountMinor: 100000,
      discounts: [
        {
          discount: {
            id: "limited",
            type: "FIXED_AMOUNT",
            value: 10000,
            isActive: true,
            maxRedemptions: 5,
            maxRedemptionsPerAgency: 1,
          },
        },
      ],
    };
    const db = {
      agencyPaymentOrder: {
        count: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(1),
      },
    };
    await expect(
      service.bestDiscount(db, plan, "agency-1", false),
    ).resolves.toBeUndefined();
  });

  it("uses only a temporary order reservation for scarce discounts", async () => {
    const service = makeService() as any;
    const count = jest.fn().mockResolvedValue(0);
    await service.bestDiscount(
      { agencyPaymentOrder: { count } },
      {
        priceAmountMinor: 100000,
        discounts: [
          {
            discount: {
              id: "limited",
              type: "FIXED_AMOUNT",
              value: 10000,
              isActive: true,
              maxRedemptions: 1,
            },
          },
        ],
      },
      "agency-1",
      true,
    );
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        discountId: "limited",
        OR: expect.arrayContaining([
          { status: "PAID" },
          expect.objectContaining({
            status: { in: ["CREATING", "PENDING"] },
            createdAt: { gt: expect.any(Date) },
          }),
        ]),
      }),
    });
  });

  it("creates an arbitrary-duration order from database terms and sends only the discounted total to Cashfree", async () => {
    const createdOrder = {
      id: "internal-order",
      amountMinor: 120000,
      currency: "INR",
      planCodeSnapshot: "FOUR_MONTHS",
    };
    const tx = {
      pricingPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: "11111111-1111-4111-8111-111111111111",
          code: "FOUR_MONTHS",
          name: "4 Months",
          durationMonths: 4,
          priceAmountMinor: 150000,
          currency: "INR",
          teamLimit: 40,
          discounts: [
            {
              discount: {
                id: "discount-1",
                name: "Launch",
                type: "PERCENTAGE",
                value: 2000,
                isActive: true,
              },
            },
          ],
        }),
      },
      agencySubscription: { findUnique: jest.fn().mockResolvedValue(null) },
      membership: { count: jest.fn().mockResolvedValue(12) },
      agencyPaymentOrder: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(createdOrder),
      },
    };
    const prisma = {
      membership: {
        findUnique: jest.fn().mockResolvedValue({
          id: "membership-1",
          status: "ACTIVE",
          deletedAt: null,
          roles: [],
          role: { systemRole: { key: "OWNER" } },
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user-1",
          name: "Owner",
          mobileNumberEncrypted: null,
          authUser: { emailEncrypted: "encrypted-email" },
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
      agencyPaymentOrder: { update: jest.fn().mockResolvedValue({}) },
    };
    const cashfree = {
      environment: "sandbox",
      createOrder: jest.fn().mockResolvedValue({
        cf_order_id: "cf-order",
        payment_session_id: "session",
      }),
    };
    const cryptoService = {
      decrypt: jest.fn().mockReturnValue("owner@example.com"),
    };
    const config = {
      get: jest.fn().mockReturnValue("https://app.example.com"),
    };
    const service = new BillingService(
      prisma as never,
      cashfree as never,
      cryptoService as never,
      config as never,
    );

    await expect(
      service.createOrder(
        "agency-1",
        "user-1",
        "11111111-1111-4111-8111-111111111111",
      ),
    ).resolves.toMatchObject({ paymentSessionId: "session" });

    expect(tx.agencyPaymentOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        period: null,
        planCodeSnapshot: "FOUR_MONTHS",
        planNameSnapshot: "4 Months",
        durationMonths: 4,
        baseAmountMinor: 150000,
        discountAmountMinor: 30000,
        amountMinor: 120000,
        teamLimitSnapshot: 40,
      }),
    });
    expect(cashfree.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ order_amount: 1200, order_currency: "INR" }),
      "internal-order",
    );
  });

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
