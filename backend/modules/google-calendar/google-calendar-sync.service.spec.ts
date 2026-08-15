import { ConfigService } from "@nestjs/config";
import {
  GoogleCalendarSourceType,
  WorkOrderStatus,
  WorkOrderType,
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
});
