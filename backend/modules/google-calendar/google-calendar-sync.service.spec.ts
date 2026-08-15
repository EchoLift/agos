import { ConfigService } from "@nestjs/config";
import {
  ContentAssetStatus,
  ContentStage,
  GoogleCalendarSourceType,
  TaskStatus,
  WorkOrderStatus,
  WorkOrderType,
  WorkflowInstanceStatus,
} from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";
import { GoogleCalendarOAuthService } from "./google-calendar-oauth.service";
import { GoogleCalendarSyncService } from "./google-calendar-sync.service";

describe("GoogleCalendarSyncService", () => {
  let service: GoogleCalendarSyncService;
  let prisma: any;
  let oauth: jest.Mocked<GoogleCalendarOAuthService>;

  const connection = {
    id: "connection-1",
    userId: "user-1",
    googleCalendarId: "calendar-1",
    encryptedRefreshToken: "encrypted-refresh",
    syncEnabled: true,
    revokedAt: null,
  };

  const workOrder = {
    id: "gig-1",
    agencyId: "agency-1",
    title: "Nike Summer Reel Script",
    description: "Write the launch reel script.",
    workType: WorkOrderType.SCRIPT,
    status: WorkOrderStatus.ASSIGNED,
    dueAt: new Date("2026-08-20T10:00:00.000Z"),
    updatedAt: new Date("2026-08-15T08:00:00.000Z"),
    estimatedHours: 2,
    agency: {
      id: "agency-1",
      slug: "socia-expert",
      name: "Socia Expert",
      displayName: "Socia Expert",
    },
    client: { id: "client-1", name: "Nike", displayName: "Nike" },
    assignee: {
      id: "membership-1",
      userId: "user-1",
      user: { id: "user-1", name: "Surya", timezone: "Asia/Kolkata" },
    },
    reviewer: null,
  };

  const workflowTask = {
    id: "task-1",
    agencyId: "agency-1",
    displayName: "Script for IND-1",
    status: TaskStatus.TODO,
    deadlineAt: new Date("2026-08-21T12:00:00.000Z"),
    updatedAt: new Date("2026-08-15T09:00:00.000Z"),
    agency: {
      id: "agency-1",
      slug: "socia-expert",
      name: "Socia Expert",
      displayName: "Socia Expert",
    },
    owner: {
      id: "membership-1",
      userId: "user-1",
      user: { id: "user-1", name: "Surya Teja", timezone: "Asia/Kolkata" },
    },
    workflowStep: {
      id: "step-1",
      stage: ContentStage.WRITING,
      expectedDurationMinutes: 90,
    },
    workflowInstance: {
      id: "workflow-1",
      status: WorkflowInstanceStatus.ACTIVE,
      currentStep: { id: "step-1", stage: ContentStage.WRITING },
      contentAsset: {
        id: "content-1",
        displayCode: "IND-1",
        title: "Independence Day Reel",
        status: ContentAssetStatus.ACTIVE,
        campaign: { id: "campaign-1", name: "August Campaign" },
        client: { id: "client-1", name: "Taaza", displayName: "Taaza" },
      },
    },
  };

  beforeEach(() => {
    prisma = {
      googleCalendarConnection: {
        findUnique: jest.fn().mockResolvedValue(connection),
        update: jest.fn().mockResolvedValue({}),
      },
      googleCalendarEvent: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      workOrder: {
        findMany: jest.fn().mockResolvedValue([workOrder]),
        findUnique: jest.fn(),
      },
      workflowTask: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
    };
    oauth = {
      refreshAccessToken: jest
        .fn()
        .mockResolvedValue({ access_token: "access" }),
      createEvent: jest.fn().mockResolvedValue("google-event-1"),
      updateEvent: jest.fn().mockResolvedValue(undefined),
      deleteEvent: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<GoogleCalendarOAuthService>;

    service = new GoogleCalendarSyncService(
      prisma as PrismaService,
      {
        get: jest.fn((key: string) =>
          key === "ROOT_DOMAIN" ? "agencie.in" : "90",
        ),
      } as unknown as ConfigService,
      oauth,
    );
  });

  it("creates one Google event and mapping for an assigned gig", async () => {
    prisma.googleCalendarEvent.findUnique.mockResolvedValue(null);

    const result = await service.syncUser("user-1");

    expect(result).toEqual({
      synced: true,
      created: 1,
      updated: 0,
      deleted: 0,
    });
    expect(oauth.createEvent).toHaveBeenCalledTimes(1);
    expect(prisma.googleCalendarEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_sourceType_sourceId: {
            userId: "user-1",
            sourceType: GoogleCalendarSourceType.WORK_ORDER,
            sourceId: "gig-1",
          },
        },
        create: expect.objectContaining({
          userId: "user-1",
          agencyId: "agency-1",
          googleEventId: "google-event-1",
        }),
      }),
    );
    expect(oauth.createEvent.mock.calls[0][2]).toEqual(
      expect.objectContaining({
        source: {
          title: "AGENCIE",
          url: "https://socia-expert.agencie.in/gigs/gig-1",
        },
      }),
    );
  });

  it("does not create duplicates when the source hash is unchanged", async () => {
    prisma.googleCalendarEvent.findUnique.mockResolvedValue(null);
    await service.syncUser("user-1");
    const sourceHash =
      prisma.googleCalendarEvent.upsert.mock.calls[0][0].create.sourceHash;

    oauth.createEvent.mockClear();
    prisma.googleCalendarEvent.findUnique.mockResolvedValue({
      id: "mapping-1",
      userId: "user-1",
      sourceType: GoogleCalendarSourceType.WORK_ORDER,
      sourceId: "gig-1",
      googleCalendarId: "calendar-1",
      googleEventId: "google-event-1",
      sourceHash,
      deletedAt: null,
    });

    const result = await service.syncUser("user-1");

    expect(result).toEqual({
      synced: true,
      created: 0,
      updated: 0,
      deleted: 0,
    });
    expect(oauth.createEvent).not.toHaveBeenCalled();
    expect(oauth.updateEvent).not.toHaveBeenCalled();
  });

  it("updates the existing Google event when gig details change", async () => {
    prisma.googleCalendarEvent.findUnique.mockResolvedValue({
      id: "mapping-1",
      userId: "user-1",
      sourceType: GoogleCalendarSourceType.WORK_ORDER,
      sourceId: "gig-1",
      googleCalendarId: "calendar-1",
      googleEventId: "google-event-1",
      sourceHash: "old-hash",
      deletedAt: null,
    });

    const result = await service.syncUser("user-1");

    expect(result).toEqual({
      synced: true,
      created: 0,
      updated: 1,
      deleted: 0,
    });
    expect(oauth.createEvent).not.toHaveBeenCalled();
    expect(oauth.updateEvent).toHaveBeenCalledWith(
      "access",
      "calendar-1",
      "google-event-1",
      expect.objectContaining({
        summary: "[AGENCIE] Script - Nike Summer Reel Script",
      }),
    );
  });

  it("creates one Google event and mapping for an actionable workflow task", async () => {
    prisma.workOrder.findMany.mockResolvedValue([]);
    prisma.workflowTask.findMany.mockResolvedValue([workflowTask]);
    prisma.googleCalendarEvent.findUnique.mockResolvedValue(null);

    const result = await service.syncUser("user-1");

    expect(result).toEqual({
      synced: true,
      created: 1,
      updated: 0,
      deleted: 0,
    });
    expect(oauth.createEvent).toHaveBeenCalledWith(
      "access",
      "calendar-1",
      expect.objectContaining({
        summary: "[AGENCIE] Writing - Independence Day Reel",
        source: {
          title: "AGENCIE",
          url: "https://socia-expert.agencie.in/workflow/content-1",
        },
        extendedProperties: {
          private: expect.objectContaining({
            agencieSourceType: GoogleCalendarSourceType.WORKFLOW_TASK,
            agencieSourceId: "task-1",
          }),
        },
      }),
    );
    expect(prisma.googleCalendarEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_sourceType_sourceId: {
            userId: "user-1",
            sourceType: GoogleCalendarSourceType.WORKFLOW_TASK,
            sourceId: "task-1",
          },
        },
        create: expect.objectContaining({
          agencyId: "agency-1",
          googleEventId: "google-event-1",
        }),
      }),
    );
  });

  it("updates the existing workflow task event when task timing changes", async () => {
    prisma.workOrder.findMany.mockResolvedValue([]);
    prisma.workflowTask.findMany.mockResolvedValue([workflowTask]);
    prisma.googleCalendarEvent.findUnique.mockResolvedValue({
      id: "mapping-task-1",
      userId: "user-1",
      sourceType: GoogleCalendarSourceType.WORKFLOW_TASK,
      sourceId: "task-1",
      googleCalendarId: "calendar-1",
      googleEventId: "google-task-event-1",
      sourceHash: "old-hash",
      deletedAt: null,
    });

    const result = await service.syncUser("user-1");

    expect(result).toEqual({
      synced: true,
      created: 0,
      updated: 1,
      deleted: 0,
    });
    expect(oauth.updateEvent).toHaveBeenCalledWith(
      "access",
      "calendar-1",
      "google-task-event-1",
      expect.objectContaining({
        start: {
          dateTime: "2026-08-21T12:00:00.000Z",
          timeZone: "Asia/Kolkata",
        },
      }),
    );
  });

  it("does not let stale workflow task cleanup touch work order mappings", async () => {
    prisma.workOrder.findMany.mockResolvedValue([workOrder]);
    prisma.workflowTask.findMany.mockResolvedValue([]);
    prisma.googleCalendarEvent.findUnique.mockResolvedValue(null);
    prisma.googleCalendarEvent.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "task-mapping-1",
          userId: "user-1",
          sourceType: GoogleCalendarSourceType.WORKFLOW_TASK,
          sourceId: "task-stale",
          googleCalendarId: "calendar-1",
          googleEventId: "google-task-stale",
          deletedAt: null,
        },
      ]);
    prisma.workflowTask.findMany.mockResolvedValueOnce([]);

    const result = await service.syncUser("user-1");

    expect(result.deleted).toBe(1);
    expect(oauth.deleteEvent).toHaveBeenCalledWith(
      "access",
      "calendar-1",
      "google-task-stale",
    );
    expect(prisma.googleCalendarEvent.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          sourceType: GoogleCalendarSourceType.WORK_ORDER,
        }),
      }),
    );
    expect(prisma.googleCalendarEvent.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          sourceType: GoogleCalendarSourceType.WORKFLOW_TASK,
        }),
      }),
    );
  });
});
