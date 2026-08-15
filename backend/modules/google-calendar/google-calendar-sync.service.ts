import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import {
  GoogleCalendarConnection,
  GoogleCalendarSourceType,
  WorkOrderStatus,
} from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@packages/database/prisma.service";
import { GoogleCalendarOAuthService } from "./google-calendar-oauth.service";
import * as crypto from "crypto";

type WorkOrderForSync = any;

@Injectable()
export class GoogleCalendarSyncService {
  private readonly logger = new Logger(GoogleCalendarSyncService.name);
  private readonly sourceType = GoogleCalendarSourceType.WORK_ORDER;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly oauth: GoogleCalendarOAuthService,
  ) {}

  async syncUser(userId: string) {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (
      !connection ||
      !connection.syncEnabled ||
      connection.revokedAt ||
      !connection.googleCalendarId
    ) {
      return { synced: false, created: 0, updated: 0, deleted: 0 };
    }

    const accessToken = await this.accessToken(connection);
    const workOrders = await this.findRelevantWorkOrders(userId);
    const changed = { synced: true, created: 0, updated: 0, deleted: 0 };

    for (const workOrder of workOrders) {
      const result = await this.syncWorkOrder(
        connection,
        accessToken,
        workOrder,
      );
      changed.created += result.created;
      changed.updated += result.updated;
    }

    const deleted = await this.removeStaleMappings(
      connection,
      accessToken,
      workOrders,
    );
    changed.deleted += deleted;

    await this.prisma.googleCalendarConnection.update({
      where: { userId },
      data: { lastSyncAt: new Date() },
    });

    return changed;
  }

  queueWorkOrderSync(workOrderId: string) {
    setImmediate(() => {
      void this.syncAffectedWorkOrderUsers(workOrderId).catch((error) => {
        this.logger.warn(
          `Google Calendar sync failed for work order ${workOrderId}: ${this.safeError(error)}`,
        );
      });
    });
  }

  async syncAffectedWorkOrderUsers(workOrderId: string) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        assignee: { select: { userId: true } },
        reviewer: { select: { userId: true } },
      },
    });
    const existingMappings = await this.prisma.googleCalendarEvent.findMany({
      where: {
        sourceType: this.sourceType,
        sourceId: workOrderId,
      },
      select: { userId: true },
    });
    const userIds = [
      ...new Set(
        [
          workOrder?.assignee.userId,
          workOrder?.reviewer?.userId,
          ...existingMappings.map((mapping) => mapping.userId),
        ].filter((value): value is string => Boolean(value)),
      ),
    ];

    await Promise.all(
      userIds.map((userId) =>
        this.syncUser(userId).catch((error) => {
          this.logger.warn(
            `Google Calendar sync failed for user ${userId}: ${this.safeError(error)}`,
          );
        }),
      ),
    );
  }

  private async syncWorkOrder(
    connection: GoogleCalendarConnection,
    accessToken: string,
    workOrder: WorkOrderForSync,
  ) {
    const googleCalendarId = connection.googleCalendarId;
    if (!googleCalendarId) return { created: 0, updated: 0 };

    const event = this.toGoogleEvent(workOrder);
    const sourceHash = this.hashEvent(event);
    const mapping = await this.prisma.googleCalendarEvent.findUnique({
      where: {
        userId_sourceType_sourceId: {
          userId: connection.userId,
          sourceType: this.sourceType,
          sourceId: workOrder.id,
        },
      },
    });

    if (mapping && !mapping.deletedAt && mapping.sourceHash === sourceHash) {
      return { created: 0, updated: 0 };
    }

    if (mapping && !mapping.deletedAt) {
      await this.oauth.updateEvent(
        accessToken,
        googleCalendarId,
        mapping.googleEventId,
        event,
      );
      await this.prisma.googleCalendarEvent.update({
        where: { id: mapping.id },
        data: {
          agencyId: workOrder.agencyId,
          googleCalendarId,
          lastSyncedAt: new Date(),
          sourceUpdatedAt: workOrder.updatedAt,
          sourceHash,
        },
      });
      return { created: 0, updated: 1 };
    }

    const googleEventId = await this.oauth.createEvent(
      accessToken,
      googleCalendarId,
      event,
    );
    await this.prisma.googleCalendarEvent.upsert({
      where: {
        userId_sourceType_sourceId: {
          userId: connection.userId,
          sourceType: this.sourceType,
          sourceId: workOrder.id,
        },
      },
      create: {
        userId: connection.userId,
        agencyId: workOrder.agencyId,
        sourceType: this.sourceType,
        sourceId: workOrder.id,
        googleCalendarId,
        googleEventId,
        lastSyncedAt: new Date(),
        sourceUpdatedAt: workOrder.updatedAt,
        sourceHash,
      },
      update: {
        agencyId: workOrder.agencyId,
        googleCalendarId,
        googleEventId,
        lastSyncedAt: new Date(),
        sourceUpdatedAt: workOrder.updatedAt,
        sourceHash,
        deletedAt: null,
      },
    });

    return { created: 1, updated: 0 };
  }

  private async removeStaleMappings(
    connection: GoogleCalendarConnection,
    accessToken: string,
    currentWorkOrders: WorkOrderForSync[],
  ) {
    const googleCalendarId = connection.googleCalendarId;
    if (!googleCalendarId) return 0;

    const activeSourceIds = new Set(currentWorkOrders.map((item) => item.id));
    const mappings = await this.prisma.googleCalendarEvent.findMany({
      where: {
        userId: connection.userId,
        sourceType: this.sourceType,
        deletedAt: null,
      },
    });
    const staleMappings = mappings.filter(
      (mapping) => !activeSourceIds.has(mapping.sourceId),
    );
    if (!staleMappings.length) return 0;

    const workOrders = await this.prisma.workOrder.findMany({
      where: { id: { in: staleMappings.map((mapping) => mapping.sourceId) } },
      include: this.workOrderInclude(),
    });
    const workOrdersById = new Map(workOrders.map((item) => [item.id, item]));
    let deleted = 0;

    for (const mapping of staleMappings) {
      const source = workOrdersById.get(mapping.sourceId);
      if (source?.status === WorkOrderStatus.COMPLETED) {
        await this.syncCompletedWorkOrder(
          connection,
          accessToken,
          mapping.id,
          mapping.googleEventId,
          source,
        );
        continue;
      }

      await this.oauth.deleteEvent(
        accessToken,
        mapping.googleCalendarId,
        mapping.googleEventId,
      );
      await this.prisma.googleCalendarEvent.update({
        where: { id: mapping.id },
        data: { deletedAt: new Date(), lastSyncedAt: new Date() },
      });
      deleted += 1;
    }

    return deleted;
  }

  private async syncCompletedWorkOrder(
    connection: GoogleCalendarConnection,
    accessToken: string,
    mappingId: string,
    googleEventId: string,
    workOrder: WorkOrderForSync,
  ) {
    const googleCalendarId = connection.googleCalendarId;
    if (!googleCalendarId) return;

    const event = this.toGoogleEvent(workOrder, true);
    const sourceHash = this.hashEvent(event);
    await this.oauth.updateEvent(
      accessToken,
      googleCalendarId,
      googleEventId,
      event,
    );
    await this.prisma.googleCalendarEvent.update({
      where: { id: mappingId },
      data: {
        lastSyncedAt: new Date(),
        sourceUpdatedAt: workOrder.updatedAt,
        sourceHash,
      },
    });
  }

  private findRelevantWorkOrders(userId: string) {
    const now = new Date();
    const to = new Date(now);
    to.setDate(to.getDate() + this.syncWindowDays());

    return this.prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        dueAt: { gte: now, lte: to },
        status: {
          in: [
            WorkOrderStatus.ASSIGNED,
            WorkOrderStatus.IN_PROGRESS,
            WorkOrderStatus.SUBMITTED,
            WorkOrderStatus.CHANGES_REQUESTED,
          ],
        },
        OR: [
          { assignee: { userId, status: "ACTIVE" } },
          { reviewer: { userId, status: "ACTIVE" } },
        ],
      },
      include: this.workOrderInclude(),
      orderBy: { dueAt: "asc" },
    });
  }

  private workOrderInclude() {
    return {
      agency: true,
      client: true,
      assignee: { include: { user: true } },
      reviewer: { include: { user: true } },
    };
  }

  private toGoogleEvent(workOrder: WorkOrderForSync, completed = false) {
    const titlePrefix = completed ? "[Completed] [AGENCIE]" : "[AGENCIE]";
    const summary = `${titlePrefix} ${this.labelize(workOrder.workType)} - ${workOrder.title}`;
    const link = `https://${workOrder.agency.slug}.${this.rootDomain()}/gigs/${workOrder.id}`;
    const description = [
      `Agency: ${workOrder.agency.displayName || workOrder.agency.name}`,
      workOrder.client
        ? `Client: ${workOrder.client.displayName ?? workOrder.client.name}`
        : null,
      `Gig: ${workOrder.title}`,
      `Type: ${this.labelize(workOrder.workType)}`,
      `Status: ${this.labelize(workOrder.status)}`,
      workOrder.assignee?.user?.name
        ? `Assignee: ${workOrder.assignee.user.name}`
        : null,
      workOrder.reviewer?.user?.name
        ? `Reviewer: ${workOrder.reviewer.user.name}`
        : null,
      "",
      "Open in AGENCIE:",
      link,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    return {
      summary,
      description,
      ...this.eventDates(workOrder),
      source: {
        title: "AGENCIE",
        url: link,
      },
      extendedProperties: {
        private: {
          agencieSourceType: this.sourceType,
          agencieSourceId: workOrder.id,
          agencieAgencyId: workOrder.agencyId,
        },
      },
    };
  }

  private eventDates(workOrder: WorkOrderForSync) {
    const timezone = workOrder.assignee.user.timezone ?? "UTC";
    if (this.isDateOnly(workOrder.dueAt)) {
      const start = this.isoDate(workOrder.dueAt);
      const end = new Date(workOrder.dueAt);
      end.setUTCDate(end.getUTCDate() + 1);
      return {
        start: { date: start },
        end: { date: this.isoDate(end) },
      };
    }

    const start = workOrder.dueAt;
    const end = new Date(start);
    end.setMinutes(
      end.getMinutes() + Math.max(30, (workOrder.estimatedHours ?? 1) * 60),
    );

    return {
      start: { dateTime: start.toISOString(), timeZone: timezone },
      end: { dateTime: end.toISOString(), timeZone: timezone },
    };
  }

  private async accessToken(connection: GoogleCalendarConnection) {
    try {
      const token = await this.oauth.refreshAccessToken(connection);
      if (!token.access_token) {
        throw new UnauthorizedException(
          "Google did not return an access token",
        );
      }
      return token.access_token;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.prisma.googleCalendarConnection.update({
          where: { userId: connection.userId },
          data: { syncEnabled: false, revokedAt: new Date() },
        });
      }
      throw error;
    }
  }

  private hashEvent(event: unknown) {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(event))
      .digest("hex");
  }

  private isDateOnly(date: Date) {
    return (
      date.getUTCHours() === 0 &&
      date.getUTCMinutes() === 0 &&
      date.getUTCSeconds() === 0 &&
      date.getUTCMilliseconds() === 0
    );
  }

  private isoDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private labelize(value: string) {
    return value
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private syncWindowDays() {
    return Number(this.config.get<string>("GOOGLE_CALENDAR_SYNC_DAYS") ?? 90);
  }

  private rootDomain() {
    return this.config.get<string>("ROOT_DOMAIN") ?? "agencie.in";
  }

  private safeError(error: unknown) {
    return error instanceof Error ? error.message : "Unknown error";
  }
}
