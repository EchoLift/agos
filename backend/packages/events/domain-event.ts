export type DomainEventPayload = Record<string, unknown>;

export interface DomainEvent<TPayload extends DomainEventPayload = DomainEventPayload> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  agencyId: string;
  actorId: string | null;
  occurredAt: string;
  correlationId: string;
  requestId?: string;
  payload: TPayload;
}

export const DomainEvents = {
  AgencyCreated: 'AgencyCreated',
  UserRegistered: 'UserRegistered',
  MemberInvited: 'MemberInvited',
  UserJoinedAgency: 'UserJoinedAgency',
  MemberRoleChanged: 'MemberRoleChanged',
  MemberRemoved: 'MemberRemoved',
  RoleChanged: 'RoleChanged',
  ManagerAssigned: 'ManagerAssigned',
  ClientCreated: 'ClientCreated',
  ClientUpdated: 'ClientUpdated',
  ClientArchived: 'ClientArchived',
  ClientRestored: 'ClientRestored',
  ClientManagerAssigned: 'ClientManagerAssigned',
  CampaignCreated: 'CampaignCreated',
  CampaignUpdated: 'CampaignUpdated',
  CampaignActivated: 'CampaignActivated',
  CampaignPaused: 'CampaignPaused',
  CampaignResumed: 'CampaignResumed',
  CampaignCompleted: 'CampaignCompleted',
  CampaignArchived: 'CampaignArchived',
  CampaignRestored: 'CampaignRestored',
  CampaignTeamMemberAssigned: 'CampaignTeamMemberAssigned',
  CampaignTeamMemberRemoved: 'CampaignTeamMemberRemoved',
  CampaignManagerChanged: 'CampaignManagerChanged',
  PublishingSlotCreated: 'PublishingSlotCreated',
  PublishingSlotUpdated: 'PublishingSlotUpdated',
  PublishingSlotRescheduled: 'PublishingSlotRescheduled',
  PublishingSlotCancelled: 'PublishingSlotCancelled',
  PublishingSlotPublished: 'PublishingSlotPublished',
  PublishingSlotMissed: 'PublishingSlotMissed',
  PublishingSlotProductionGenerated: 'PublishingSlotProductionGenerated',
  ContentAssetCreated: 'ContentAssetCreated',
  ContentAssetUpdated: 'ContentAssetUpdated',
  ContentAssetPublished: 'ContentAssetPublished',
  ContentAssetArchived: 'ContentAssetArchived',
  ContentAssetRestored: 'ContentAssetRestored',
  ContentAssigned: 'ContentAssigned',
  WorkflowStageChanged: 'WorkflowStageChanged',
  SubmissionCreated: 'SubmissionCreated',
  SubmissionViewed: 'SubmissionViewed',
  SubmissionRecalled: 'SubmissionRecalled',
  SubmissionAccepted: 'SubmissionAccepted',
  SubmissionRejected: 'SubmissionRejected',
  ApprovalGranted: 'ApprovalGranted',
  ApprovalRejected: 'ApprovalRejected',
  ChangesRequested: 'ChangesRequested',
  BlockerRaised: 'BlockerRaised',
  BlockerResolved: 'BlockerResolved',
  DeadlineMissed: 'DeadlineMissed',
  NotificationQueued: 'NotificationQueued',
  NotificationSent: 'NotificationSent',
  NotificationFailed: 'NotificationFailed',
  WebhookReceived: 'WebhookReceived',
  AuditRecorded: 'AuditRecorded'
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];
