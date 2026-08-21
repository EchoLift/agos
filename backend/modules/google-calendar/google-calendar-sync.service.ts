import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import {
  ContentAssetStatus,
  GoogleCalendarConnection,
  GoogleCalendarSourceType,
  TaskStatus,
  WorkOrderStatus,
  WorkflowInstanceStatus,
} from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@packages/database/prisma.service";
import { GoogleCalendarOAuthService } from "./google-calendar-oauth.service";
import * as crypto from "crypto";

type WorkOrderForSync = any;
type WorkflowTaskForSync = any;
type GoogleEventPayload = Record<string, unknown>;

const ACTIVE_WORK_ORDER_STATUSES = [
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.SUBMITTED,
  WorkOrderStatus.CHANGES_REQUESTED,
];

const ACTIVE_WORKFLOW_TASK_STATUSES = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.WAITING_REVIEW,
  TaskStatus.WAITING_HANDOFF_ACCEPTANCE,
  TaskStatus.BLOCKED,
];

@Injectable()
export class GoogleCalendarSyncService {
  private readonly logger = new Logger(GoogleCalendarSyncService.name);

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
    const [workOrders, workflowTasks] = await Promise.all([
      this.findRelevantWorkOrders(userId),
      this.findRelevantWorkflowTasks(userId),
    ]);
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

    for (const workflowTask of workflowTasks) {
      const result = await this.syncWorkflowTask(
        connection,
        accessToken,
        workflowTask,
      );
      changed.created += result.created;
      changed.updated += result.updated;
    }

    changed.deleted += await this.removeStaleWorkOrderMappings(
      connection,
      accessToken,
      workOrders,
    );
    changed.deleted += await this.removeStaleWorkflowTaskMappings(
      connection,
      accessToken,
      workflowTasks,
    );

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

  queueWorkflowTaskSync(workflowTaskId: string) {
    setImmediate(() => {
      void this.syncAffectedWorkflowTaskUsers(workflowTaskId).catch((error) => {
        this.logger.warn(
          `Google Calendar sync failed for workflow task ${workflowTaskId}: ${this.safeError(error)}`,
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
        sourceType: GoogleCalendarSourceType.WORK_ORDER,
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

  async syncAffectedWorkflowTaskUsers(workflowTaskId: string) {
    const workflowTask = await this.prisma.workflowTask.findUnique({
      where: { id: workflowTaskId },
      select: {
        owner: { select: { userId: true } },
      },
    });
    const existingMappings = await this.prisma.googleCalendarEvent.findMany({
      where: {
        sourceType: GoogleCalendarSourceType.WORKFLOW_TASK,
        sourceId: workflowTaskId,
      },
      select: { userId: true },
    });
    const userIds = [
      ...new Set(
        [
          workflowTask?.owner?.userId,
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

  private syncWorkOrder(
    connection: GoogleCalendarConnection,
    accessToken: string,
    workOrder: WorkOrderForSync,
  ) {
    return this.syncSourceEvent(
      connection,
      accessToken,
      GoogleCalendarSourceType.WORK_ORDER,
      {
        id: workOrder.id,
        agencyId: workOrder.agencyId,
        updatedAt: workOrder.updatedAt,
      },
      this.toWorkOrderGoogleEvent(workOrder),
    );
  }

  private syncWorkflowTask(
    connection: GoogleCalendarConnection,
    accessToken: string,
    workflowTask: WorkflowTaskForSync,
  ) {
    return this.syncSourceEvent(
      connection,
      accessToken,
      GoogleCalendarSourceType.WORKFLOW_TASK,
      {
        id: workflowTask.id,
        agencyId: workflowTask.agencyId,
        updatedAt: workflowTask.updatedAt,
      },
      this.toWorkflowTaskGoogleEvent(workflowTask),
    );
  }

  private async syncSourceEvent(
    connection: GoogleCalendarConnection,
    accessToken: string,
    sourceType: GoogleCalendarSourceType,
    source: { id: string; agencyId: string; updatedAt?: Date | null },
    event: GoogleEventPayload,
  ) {
    const googleCalendarId = connection.googleCalendarId;
    if (!googleCalendarId) return { created: 0, updated: 0 };

    const sourceHash = this.hashEvent(event);
    const mapping = await this.prisma.googleCalendarEvent.findUnique({
      where: {
        userId_sourceType_sourceId: {
          userId: connection.userId,
          sourceType,
          sourceId: source.id,
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
          agencyId: source.agencyId,
          googleCalendarId,
          lastSyncedAt: new Date(),
          sourceUpdatedAt: source.updatedAt ?? null,
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
          sourceType,
          sourceId: source.id,
        },
      },
      create: {
        userId: connection.userId,
        agencyId: source.agencyId,
        sourceType,
        sourceId: source.id,
        googleCalendarId,
        googleEventId,
        lastSyncedAt: new Date(),
        sourceUpdatedAt: source.updatedAt ?? null,
        sourceHash,
      },
      update: {
        agencyId: source.agencyId,
        googleCalendarId,
        googleEventId,
        lastSyncedAt: new Date(),
        sourceUpdatedAt: source.updatedAt ?? null,
        sourceHash,
        deletedAt: null,
      },
    });

    return { created: 1, updated: 0 };
  }

  private removeStaleWorkOrderMappings(
    connection: GoogleCalendarConnection,
    accessToken: string,
    currentWorkOrders: WorkOrderForSync[],
  ) {
    return this.removeStaleMappings(
      connection,
      accessToken,
      GoogleCalendarSourceType.WORK_ORDER,
      currentWorkOrders.map((item) => item.id),
      (sourceIds) =>
        this.prisma.workOrder
          .findMany({
            where: { id: { in: sourceIds } },
            include: this.workOrderInclude(),
          })
          .then(
            (workOrders) => new Map(workOrders.map((item) => [item.id, item])),
          ),
      async (mapping, source) => {
        if (source?.status !== WorkOrderStatus.COMPLETED) return false;
        await this.syncCompletedSourceEvent(
          connection,
          accessToken,
          mapping.id,
          mapping.googleEventId,
          source.updatedAt,
          this.toWorkOrderGoogleEvent(source, true),
        );
        return true;
      },
    );
  }

  private removeStaleWorkflowTaskMappings(
    connection: GoogleCalendarConnection,
    accessToken: string,
    currentWorkflowTasks: WorkflowTaskForSync[],
  ) {
    return this.removeStaleMappings(
      connection,
      accessToken,
      GoogleCalendarSourceType.WORKFLOW_TASK,
      currentWorkflowTasks.map((item) => item.id),
      (sourceIds) =>
        this.prisma.workflowTask
          .findMany({
            where: { id: { in: sourceIds } },
            include: this.workflowTaskInclude(),
          })
          .then(
            (workflowTasks) =>
              new Map(workflowTasks.map((item) => [item.id, item])),
          ),
      async (mapping, source) => {
        if (source?.status !== TaskStatus.COMPLETED) return false;
        await this.syncCompletedSourceEvent(
          connection,
          accessToken,
          mapping.id,
          mapping.googleEventId,
          source.updatedAt,
          this.toWorkflowTaskGoogleEvent(source, true),
        );
        return true;
      },
    );
  }

  private async removeStaleMappings<TSource extends { id: string }>(
    connection: GoogleCalendarConnection,
    accessToken: string,
    sourceType: GoogleCalendarSourceType,
    activeSourceIdsList: string[],
    loadSources: (sourceIds: string[]) => Promise<Map<string, TSource>>,
    keepCompleted: (
      mapping: { id: string; googleEventId: string },
      source: TSource | undefined,
    ) => Promise<boolean>,
  ) {
    const googleCalendarId = connection.googleCalendarId;
    if (!googleCalendarId) return 0;

    const activeSourceIds = new Set(activeSourceIdsList);
    const mappings = await this.prisma.googleCalendarEvent.findMany({
      where: {
        userId: connection.userId,
        sourceType,
        deletedAt: null,
      },
    });
    const staleMappings = mappings.filter(
      (mapping) => !activeSourceIds.has(mapping.sourceId),
    );
    if (!staleMappings.length) return 0;

    const sourcesById = await loadSources(
      staleMappings.map((mapping) => mapping.sourceId),
    );
    let deleted = 0;

    for (const mapping of staleMappings) {
      const source = sourcesById.get(mapping.sourceId);
      if (
        await keepCompleted(
          {
            id: mapping.id,
            googleEventId: mapping.googleEventId,
          },
          source,
        )
      ) {
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

  private async syncCompletedSourceEvent(
    connection: GoogleCalendarConnection,
    accessToken: string,
    mappingId: string,
    googleEventId: string,
    sourceUpdatedAt: Date | null | undefined,
    event: GoogleEventPayload,
  ) {
    const googleCalendarId = connection.googleCalendarId;
    if (!googleCalendarId) return;

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
        sourceUpdatedAt: sourceUpdatedAt ?? null,
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
        status: { in: ACTIVE_WORK_ORDER_STATUSES },
        OR: [
          { assignee: { userId, status: "ACTIVE" } },
          { reviewer: { userId, status: "ACTIVE" } },
        ],
      },
      include: this.workOrderInclude(),
      orderBy: { dueAt: "asc" },
    });
  }

  private findRelevantWorkflowTasks(userId: string) {
    const now = new Date();
    const to = new Date(now);
    to.setDate(to.getDate() + this.syncWindowDays());

    return this.prisma.workflowTask.findMany({
      where: {
        owner: { userId, status: "ACTIVE" },
        deadlineAt: { gte: now, lte: to },
        status: { in: ACTIVE_WORKFLOW_TASK_STATUSES },
        currentForWorkflowInstance: {
          some: { status: WorkflowInstanceStatus.ACTIVE },
        },
        workflowInstance: {
          status: WorkflowInstanceStatus.ACTIVE,
          contentAsset: {
            status: ContentAssetStatus.ACTIVE,
          },
        },
      },
      include: this.workflowTaskInclude(),
      orderBy: { deadlineAt: "asc" },
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

  private workflowTaskInclude() {
    return {
      owner: { include: { user: true } },
      workflowStep: true,
      workflowInstance: {
        include: {
          currentStep: true,
          contentAsset: {
            include: {
              agency: true,
              campaign: true,
              client: true,
            },
          },
        },
      },
    };
  }

  private toWorkOrderGoogleEvent(
    workOrder: WorkOrderForSync,
    completed = false,
  ) {
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
      ...this.workOrderEventDates(workOrder),
      source: {
        title: "AGENCIE",
        url: link,
      },
      extendedProperties: {
        private: {
          agencieSourceType: GoogleCalendarSourceType.WORK_ORDER,
          agencieSourceId: workOrder.id,
          agencieAgencyId: workOrder.agencyId,
        },
      },
    };
  }

  private toWorkflowTaskGoogleEvent(
    workflowTask: WorkflowTaskForSync,
    completed = false,
  ) {
    const contentAsset = workflowTask.workflowInstance.contentAsset;
    const agency = contentAsset.agency;
    const stage =
      workflowTask.workflowStep?.stage ??
      workflowTask.workflowInstance.currentStep?.stage ??
      "WORKFLOW_TASK";
    const titlePrefix = completed ? "[Completed] [AGENCIE]" : "[AGENCIE]";
    const contentTitle = contentAsset.title || contentAsset.displayCode;
    const summary = `${titlePrefix} ${this.labelize(stage)} - ${contentTitle}`;
    const link = `https://${agency.slug}.${this.rootDomain()}/workflow/${contentAsset.id}`;
    const description = [
      `Agency: ${agency.displayName || agency.name}`,
      contentAsset.client
        ? `Client: ${contentAsset.client.displayName ?? contentAsset.client.name}`
        : null,
      contentAsset.campaign ? `Campaign: ${contentAsset.campaign.name}` : null,
      `Content: ${contentTitle}`,
      `Stage: ${this.labelize(stage)}`,
      `Status: ${this.labelize(workflowTask.status)}`,
      workflowTask.owner?.user?.name
        ? `Assignee: ${workflowTask.owner.user.name}`
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
      ...this.workflowTaskEventDates(workflowTask),
      source: {
        title: "AGENCIE",
        url: link,
      },
      extendedProperties: {
        private: {
          agencieSourceType: GoogleCalendarSourceType.WORKFLOW_TASK,
          agencieSourceId: workflowTask.id,
          agencieAgencyId: workflowTask.agencyId,
        },
      },
    };
  }

  private workOrderEventDates(workOrder: WorkOrderForSync) {
    const timezone = workOrder.assignee?.user?.timezone ?? "UTC";
    if (this.isDateOnly(workOrder.dueAt)) {
      return this.allDayDates(workOrder.dueAt);
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

  private workflowTaskEventDates(workflowTask: WorkflowTaskForSync) {
    const timezone = workflowTask.owner?.user?.timezone ?? "UTC";
    if (this.isDateOnly(workflowTask.deadlineAt)) {
      return this.allDayDates(workflowTask.deadlineAt);
    }

    const start = workflowTask.deadlineAt;
    const end = new Date(start);
    end.setMinutes(
      end.getMinutes() +
        Math.max(30, workflowTask.workflowStep?.expectedDurationMinutes ?? 60),
    );

    return {
      start: { dateTime: start.toISOString(), timeZone: timezone },
      end: { dateTime: end.toISOString(), timeZone: timezone },
    };
  }

  private allDayDates(date: Date) {
    const start = this.isoDate(date);
    const end = new Date(date);
    end.setUTCDate(end.getUTCDate() + 1);
    return {
      start: { date: start },
      end: { date: this.isoDate(end) },
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
