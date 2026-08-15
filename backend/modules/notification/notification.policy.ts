import { DomainEvents } from "@packages/events/domain-event";

export enum NotificationDeliveryIntent {
  Awareness = "AWARENESS",
  ActionRequired = "ACTION_REQUIRED",
  TimeSensitiveAction = "TIME_SENSITIVE_ACTION",
  ClientActionRequired = "CLIENT_ACTION_REQUIRED",
  Onboarding = "ONBOARDING",
}

export type NotificationRecipientType = "EMPLOYEE" | "MANAGER" | "CLIENT";
export type NotificationChannel = "IN_APP" | "EMAIL" | "CALENDAR";

export interface NotificationPolicyInput {
  eventType: string;
  deliveryIntent?: NotificationDeliveryIntent;
  recipientType?: NotificationRecipientType;
  metadata?: Record<string, unknown>;
}

export interface NotificationDeliveryPolicy {
  intent: NotificationDeliveryIntent;
  channels: NotificationChannel[];
  reason: string;
}

const MATERIAL_ASSIGNMENT_UPDATE_TYPES = new Set([
  "ASSIGNEE_CHANGED",
  "DUE_DATE_CHANGED",
  "PRIORITY_CHANGED",
  "INSTRUCTIONS_CHANGED",
  "REVISION_REQUESTED",
  "REVIEW_REQUIRED",
  "APPROVAL_GRANTED_NEXT_ACTION",
  "APPROVAL_REJECTED",
  "WORKFLOW_HANDOFF",
  "TASK_REOPENED",
]);

const DEFAULT_EVENT_INTENTS = new Map<string, NotificationDeliveryIntent>([
  [DomainEvents.MemberInvited, NotificationDeliveryIntent.Onboarding],

  [
    DomainEvents.WorkOrderCreated,
    NotificationDeliveryIntent.TimeSensitiveAction,
  ],
  ["WorkOrderAssigned", NotificationDeliveryIntent.TimeSensitiveAction],
  [DomainEvents.WorkOrderSubmitted, NotificationDeliveryIntent.ActionRequired],
  [
    DomainEvents.WorkOrderChangesRequested,
    NotificationDeliveryIntent.TimeSensitiveAction,
  ],

  [
    DomainEvents.ContentAssigned,
    NotificationDeliveryIntent.TimeSensitiveAction,
  ],
  ["WorkflowTaskAssigned", NotificationDeliveryIntent.TimeSensitiveAction],
  [DomainEvents.SubmissionCreated, NotificationDeliveryIntent.ActionRequired],
  [
    DomainEvents.ChangesRequested,
    NotificationDeliveryIntent.TimeSensitiveAction,
  ],
  [
    DomainEvents.ApprovalRejected,
    NotificationDeliveryIntent.TimeSensitiveAction,
  ],
  ["ActionableApproval", NotificationDeliveryIntent.TimeSensitiveAction],

  ["ClientApprovalRequired", NotificationDeliveryIntent.ClientActionRequired],
  ["ClientFeedbackRequested", NotificationDeliveryIntent.ClientActionRequired],
  [
    "ClientRevisionClarificationRequired",
    NotificationDeliveryIntent.ClientActionRequired,
  ],
]);

const AWARENESS_ONLY_EVENTS = new Set<string>([
  DomainEvents.CampaignCreated,
  DomainEvents.CampaignUpdated,
  DomainEvents.CampaignTeamMemberAssigned,
  DomainEvents.CampaignTeamMemberRemoved,
  DomainEvents.ContentAssetCreated,
  DomainEvents.ContentAssetUpdated,
  DomainEvents.WorkflowStageChanged,
  DomainEvents.ApprovalGranted,
  DomainEvents.WorkOrderUpdated,
  DomainEvents.PublishingSlotCreated,
  DomainEvents.PublishingSlotUpdated,
  DomainEvents.PublishingSlotPublished,
]);

export function resolveNotificationDeliveryPolicy(
  input: NotificationPolicyInput,
): NotificationDeliveryPolicy {
  const intent =
    input.deliveryIntent ??
    materialUpdateIntent(input) ??
    DEFAULT_EVENT_INTENTS.get(input.eventType) ??
    NotificationDeliveryIntent.Awareness;

  const recipientType = input.recipientType ?? "EMPLOYEE";
  const channels = channelsForIntent(intent, recipientType);
  const reason =
    AWARENESS_ONLY_EVENTS.has(input.eventType) &&
    intent === NotificationDeliveryIntent.Awareness
      ? "visibility_only"
      : intent.toLowerCase();

  return { intent, channels, reason };
}

export function isEmailChannelRequired(
  input: NotificationPolicyInput | string,
): boolean {
  const normalized = typeof input === "string" ? { eventType: input } : input;
  return resolveNotificationDeliveryPolicy(normalized).channels.includes(
    "EMAIL",
  );
}

function materialUpdateIntent(input: NotificationPolicyInput) {
  if (input.eventType !== DomainEvents.WorkOrderUpdated) return null;

  const materialUpdateType = input.metadata?.materialUpdateType;
  if (
    typeof materialUpdateType === "string" &&
    MATERIAL_ASSIGNMENT_UPDATE_TYPES.has(materialUpdateType)
  ) {
    return materialUpdateType === "DUE_DATE_CHANGED" ||
      materialUpdateType === "TASK_REOPENED"
      ? NotificationDeliveryIntent.TimeSensitiveAction
      : NotificationDeliveryIntent.ActionRequired;
  }

  return null;
}

function channelsForIntent(
  intent: NotificationDeliveryIntent,
  recipientType: NotificationRecipientType,
): NotificationChannel[] {
  if (intent === NotificationDeliveryIntent.Awareness) return ["IN_APP"];

  if (intent === NotificationDeliveryIntent.ClientActionRequired) {
    return ["IN_APP", "EMAIL"];
  }

  if (intent === NotificationDeliveryIntent.Onboarding) return ["EMAIL"];

  if (
    intent === NotificationDeliveryIntent.TimeSensitiveAction &&
    recipientType !== "CLIENT"
  ) {
    return ["IN_APP", "EMAIL", "CALENDAR"];
  }

  return ["IN_APP", "EMAIL"];
}
