import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderSubmissionStatus,
  WorkOrderType,
} from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";
import { EventBusService } from "@packages/events/event-bus.service";
import { WorkOrderService } from "./work-order.service";

describe("WorkOrderService", () => {
  let service: WorkOrderService;
  let prisma: any;
  let eventBus: jest.Mocked<EventBusService>;

  const manager = {
    authUserId: "auth-manager",
    userId: "user-manager",
    sessionId: "session-manager",
    agencyId: "agency-1",
    membershipId: "manager-1",
    role: "MANAGER",
    roles: ["MANAGER"],
    permissions: [],
  };

  const assignee = {
    authUserId: "auth-writer",
    userId: "user-writer",
    sessionId: "session-writer",
    agencyId: "agency-1",
    membershipId: "writer-1",
    role: "WRITER",
    roles: ["WRITER"],
    permissions: [],
  };

  beforeEach(async () => {
    let mockPrisma: any;
    mockPrisma = {
      client: {
        findFirst: jest.fn(),
      },
      membership: {
        findFirst: jest.fn(),
      },
      workOrder: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      workOrderSubmission: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: any) => unknown) =>
        callback(mockPrisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrderService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: EventBusService,
          useValue: { publishWithinTransaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(WorkOrderService);
    prisma = module.get(PrismaService);
    eventBus = module.get(EventBusService) as jest.Mocked<EventBusService>;
  });

  it("allows managers to create standalone gigs and emits an outbox event", async () => {
    prisma.membership.findFirst.mockResolvedValueOnce({ id: "writer-1" });
    prisma.workOrder.create.mockResolvedValue(workOrderFixture());

    const result = await service.create(
      {
        title: "Need 5 IPL meme scripts",
        description: "Write short, youth-focused scripts.",
        workType: WorkOrderType.SCRIPT,
        priority: WorkOrderPriority.HIGH,
        assigneeMembershipId: "writer-1",
        dueAt: "2026-08-09T12:30:00.000Z",
      },
      manager,
    );

    expect(result.title).toBe("Need 5 IPL meme scripts");
    expect(prisma.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agencyId: "agency-1",
          assigneeMembershipId: "writer-1",
          createdByMembershipId: "manager-1",
        }),
      }),
    );
    expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
      prisma,
      "WorkOrderCreated",
      expect.objectContaining({
        aggregateId: "gig-1",
        aggregateType: "WorkOrder",
      }),
    );
  });

  it("treats empty optional reward fields as absent when creating gigs", async () => {
    prisma.membership.findFirst.mockResolvedValueOnce({ id: "writer-1" });
    prisma.workOrder.create.mockResolvedValue(workOrderFixture());

    await service.create(
      {
        title: "Need 8 scripts",
        description: "Need 8 scripts for Jewellery",
        workType: WorkOrderType.SCRIPT,
        priority: WorkOrderPriority.HIGH,
        assigneeMembershipId: "writer-1",
        dueAt: "2026-08-12T11:13:00.000Z",
        rewardAmount: null as unknown as number,
        rewardCurrency: "INR",
        estimatedHours: null as unknown as number,
      },
      manager,
    );

    expect(prisma.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estimatedHours: null,
          rewardAmount: undefined,
          rewardCurrency: undefined,
        }),
      }),
    );
  });

  it("rejects gig creation for production employees", async () => {
    await expect(
      service.create(
        {
          title: "Hidden admin action",
          description: "Should not be allowed",
          assigneeMembershipId: "writer-1",
          dueAt: "2026-08-09T12:30:00.000Z",
        },
        assignee,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("only lets the assignee submit and rejects empty submissions", async () => {
    prisma.workOrder.findFirst.mockResolvedValue(workOrderFixture());

    await expect(
      service.submit("gig-1", { body: "   " }, assignee),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.workOrderSubmission.create).not.toHaveBeenCalled();
  });

  it("submits work, versions the submission, and emits an event", async () => {
    prisma.workOrder.findFirst.mockResolvedValue(workOrderFixture());
    prisma.workOrderSubmission.findFirst.mockResolvedValue({ version: 1 });
    prisma.workOrderSubmission.create.mockResolvedValue({
      id: "submission-2",
      version: 2,
    });
    prisma.workOrder.update.mockResolvedValue(
      workOrderFixture({ status: WorkOrderStatus.SUBMITTED }),
    );

    const result = await service.submit(
      "gig-1",
      { externalLink: "https://docs.google.com/demo" },
      assignee,
    );

    expect(result.status).toBe(WorkOrderStatus.SUBMITTED);
    expect(prisma.workOrderSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 2,
        submittedById: "writer-1",
        externalLink: "https://docs.google.com/demo",
      }),
    });
    expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
      prisma,
      "WorkOrderSubmitted",
      expect.objectContaining({ aggregateId: "gig-1" }),
    );
  });

  it("lets the reviewer approve a submitted gig", async () => {
    prisma.workOrder.findFirst.mockResolvedValue(
      workOrderFixture({
        status: WorkOrderStatus.SUBMITTED,
        reviewerMembershipId: "manager-1",
      }),
    );
    prisma.workOrderSubmission.findFirst.mockResolvedValue({
      id: "submission-1",
      version: 1,
    });
    prisma.workOrder.update.mockResolvedValue(
      workOrderFixture({ status: WorkOrderStatus.COMPLETED }),
    );

    const result = await service.approve(
      "gig-1",
      { comment: "Good to go" },
      manager,
    );

    expect(result.status).toBe(WorkOrderStatus.COMPLETED);
    expect(prisma.workOrderSubmission.update).toHaveBeenCalledWith({
      where: { id: "submission-1" },
      data: expect.objectContaining({
        status: WorkOrderSubmissionStatus.ACCEPTED,
        reviewComment: "Good to go",
      }),
    });
    expect(eventBus.publishWithinTransaction).toHaveBeenCalledWith(
      prisma,
      "WorkOrderApproved",
      expect.objectContaining({ aggregateId: "gig-1" }),
    );
  });

  it("scopes regular users to assigned or reviewed gigs", async () => {
    prisma.workOrder.findMany.mockResolvedValue([]);

    await service.findMany(assignee);

    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          agencyId: "agency-1",
          OR: [
            { assigneeMembershipId: "writer-1" },
            { reviewerMembershipId: "writer-1" },
          ],
        }),
      }),
    );
  });
});

function workOrderFixture(overrides: Record<string, unknown> = {}) {
  const date = new Date("2026-08-09T12:30:00.000Z");
  return {
    id: "gig-1",
    agencyId: "agency-1",
    clientId: null,
    client: null,
    title: "Need 5 IPL meme scripts",
    description: "Write short, youth-focused scripts.",
    workType: WorkOrderType.SCRIPT,
    priority: WorkOrderPriority.HIGH,
    status: WorkOrderStatus.ASSIGNED,
    assigneeMembershipId: "writer-1",
    reviewerMembershipId: "manager-1",
    createdByMembershipId: "manager-1",
    dueAt: date,
    estimatedHours: null,
    rewardAmount: null,
    rewardCurrency: null,
    completedAt: null,
    cancelledAt: null,
    version: 1,
    assignee: { id: "writer-1", user: { name: "Anjali Writer" } },
    reviewer: { id: "manager-1", user: { name: "Priya Manager" } },
    createdBy: { id: "manager-1", user: { name: "Priya Manager" } },
    submissions: [],
    createdAt: date,
    updatedAt: date,
    ...overrides,
  };
}
