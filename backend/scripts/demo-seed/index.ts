import 'dotenv/config';
import {
  ApprovalStatus,
  AuthProvider,
  AuthUserStatus,
  BlockerStatus,
  CampaignAssignmentRole,
  CampaignStatus,
  ClientStatus,
  ContentAssetStatus,
  ContentRisk,
  ContentStage,
  ContentType,
  MembershipStatus,
  NotificationDeliveryChannel,
  NotificationDeliveryStatus,
  NotificationStatus,
  OutboxStatus,
  PresenceStatus,
  Prisma,
  PrismaClient,
  PublishingPlatform,
  PublishingStatus,
  SessionStatus,
  StorageProvider,
  SubmissionStatus,
  SubmissionType,
  TaskStatus,
  WorkLocation,
  WorkflowInstanceStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : undefined;
}

const DEMO_AGENCY = {
  name: process.env.DEMO_AGENCY_NAME ?? 'SocialExpert',
  displayName: process.env.DEMO_AGENCY_DISPLAY_NAME ?? 'SocialExpert',
  slug: argValue('--agency-slug') ?? process.env.DEMO_AGENCY_SLUG ?? 'socialexpert',
};

const PERMISSIONS = [
  'CLIENT_CREATE',
  'CLIENT_UPDATE',
  'CLIENT_ARCHIVE',
  'CLIENT_PLAYBOOK_VIEW',
  'CLIENT_INTERNAL_VIEW',
  'CLIENT_AI_CONTEXT_VIEW',
  'CLIENT_APPROVAL_VIEW',
  'CAMPAIGN_CREATE',
  'CAMPAIGN_UPDATE',
  'CONTENT_CREATE',
  'CONTENT_ASSIGN',
  'CONTENT_APPROVE',
  'WORKFLOW_MANAGE',
  'TEAM_INVITE',
  'TEAM_REMOVE',
  'BILLING_MANAGE',
  'SETTINGS_MANAGE',
  'PUBLISHING_VIEW',
  'PUBLISHING_CREATE',
  'PUBLISHING_UPDATE',
  'PUBLISHING_CANCEL',
  'PUBLISHING_MARK_PUBLISHED',
  'PUBLISHING_LINK_CONTENT',
];

const SYSTEM_ROLES = [
  { key: 'OWNER', displayName: 'Owner' },
  { key: 'MANAGER', displayName: 'Manager' },
  { key: 'WRITER', displayName: 'Writer' },
  { key: 'DOP', displayName: 'DOP' },
  { key: 'EDITOR', displayName: 'Editor' },
  { key: 'DESIGNER', displayName: 'Designer' },
  { key: 'SOCIAL_MEDIA_MANAGER', displayName: 'Social Media Manager' },
  { key: 'MEMBER', displayName: 'Member' },
];

const TEAM = [
  {
    key: 'owner',
    name: 'Esha Rao',
    email: 'owner@demo.agos.local',
    mobile: '+919100001001',
    primaryRole: 'OWNER',
    roles: ['OWNER', 'MANAGER'],
    jobTitle: 'Founder',
    location: WorkLocation.WFO,
  },
  {
    key: 'manager1',
    name: 'Priya Menon',
    email: 'manager1@demo.agos.local',
    mobile: '+919100001002',
    primaryRole: 'MANAGER',
    roles: ['MANAGER'],
    jobTitle: 'Campaign Manager',
    location: WorkLocation.WFH,
  },
  {
    key: 'manager2',
    name: 'Arjun Varma',
    email: 'manager2@demo.agos.local',
    mobile: '+919100001003',
    primaryRole: 'MANAGER',
    roles: ['MANAGER', 'WRITER'],
    jobTitle: 'Relationship Manager',
    location: WorkLocation.REMOTE,
  },
  {
    key: 'writer1',
    name: 'Anjali Script Writer',
    email: 'writer1@demo.agos.local',
    mobile: '+919100001004',
    primaryRole: 'WRITER',
    roles: ['WRITER'],
    jobTitle: 'Script Writer',
    location: WorkLocation.WFO,
  },
  {
    key: 'writer2',
    name: 'Kabir Creative Writer',
    email: 'writer2@demo.agos.local',
    mobile: '+919100001005',
    primaryRole: 'WRITER',
    roles: ['WRITER', 'EDITOR'],
    jobTitle: 'Copywriter',
    location: WorkLocation.WFH,
  },
  {
    key: 'writer3',
    name: 'Meera Content Writer',
    email: 'writer3@demo.agos.local',
    mobile: '+919100001006',
    primaryRole: 'WRITER',
    roles: ['WRITER'],
    jobTitle: 'Content Strategist',
    location: WorkLocation.REMOTE,
  },
  {
    key: 'dop1',
    name: 'Ravi DOP',
    email: 'dop1@demo.agos.local',
    mobile: '+919100001007',
    primaryRole: 'DOP',
    roles: ['DOP'],
    jobTitle: 'Cinematographer',
    location: WorkLocation.WFO,
  },
  {
    key: 'dop2',
    name: 'Nikhil Camera Lead',
    email: 'dop2@demo.agos.local',
    mobile: '+919100001008',
    primaryRole: 'DOP',
    roles: ['DOP', 'EDITOR'],
    jobTitle: 'Camera Operator',
    location: WorkLocation.WFO,
  },
  {
    key: 'editor1',
    name: 'Kiran Video Editor',
    email: 'editor1@demo.agos.local',
    mobile: '+919100001009',
    primaryRole: 'EDITOR',
    roles: ['EDITOR'],
    jobTitle: 'Video Editor',
    location: WorkLocation.REMOTE,
  },
  {
    key: 'editor2',
    name: 'Divya Cut Studio',
    email: 'editor2@demo.agos.local',
    mobile: '+919100001010',
    primaryRole: 'EDITOR',
    roles: ['EDITOR'],
    jobTitle: 'Senior Editor',
    location: WorkLocation.WFH,
  },
  {
    key: 'editor3',
    name: 'Omar Motion Editor',
    email: 'editor3@demo.agos.local',
    mobile: '+919100001011',
    primaryRole: 'EDITOR',
    roles: ['EDITOR', 'DESIGNER'],
    jobTitle: 'Motion Editor',
    location: WorkLocation.REMOTE,
  },
  {
    key: 'designer1',
    name: 'Tara Brand Designer',
    email: 'designer1@demo.agos.local',
    mobile: '+919100001012',
    primaryRole: 'DESIGNER',
    roles: ['DESIGNER'],
    jobTitle: 'Designer',
    location: WorkLocation.WFO,
  },
  {
    key: 'social1',
    name: 'Sanjay Social Manager',
    email: 'social@demo.agos.local',
    mobile: '+919100001013',
    primaryRole: 'SOCIAL_MEDIA_MANAGER',
    roles: ['SOCIAL_MEDIA_MANAGER'],
    jobTitle: 'Social Media Manager',
    location: WorkLocation.WFH,
  },
] as const;

type TeamKey = (typeof TEAM)[number]['key'];

const CLIENTS = [
  {
    key: 'mukunda',
    name: 'Mukunda Jewellery',
    industry: 'Fashion',
    description: 'Premium jewellery brand focused on bridal, festive and daily-wear gold collections.',
    voice: 'Luxury',
    audience: 'Women aged 24-45 in Hyderabad and Vijayawada planning weddings or festive purchases.',
    competitors: 'Tanishq, Kalyan Jewellers, local boutique gold stores',
    goals: 'Brand Awareness, Sales, Education',
  },
  {
    key: 'aarogya',
    name: 'Aarogya Fitness',
    industry: 'Fitness',
    description: 'Transformation-focused gym and wellness studio with personal coaching programs.',
    voice: 'Inspirational',
    audience: 'Working professionals aged 22-38 who want visible fitness progress in 30 days.',
    competitors: 'Cult Fit, local premium gyms, online fitness coaches',
    goals: 'Lead Generation, Community Growth, Sales',
  },
  {
    key: 'urbanNest',
    name: 'Urban Nest Realty',
    industry: 'Real Estate',
    description: 'Real estate firm selling luxury apartments and gated community projects.',
    voice: 'Premium',
    audience: 'Families and NRI buyers looking for high-trust residential property investments.',
    competitors: 'MyHome, Aparna, Prestige, local brokers',
    goals: 'Leads, Sales, Brand Awareness',
  },
  {
    key: 'brewDistrict',
    name: 'Brew District Cafe',
    industry: 'Food & Beverage',
    description: 'Neighbourhood cafe known for cold brews, weekend brunches and live acoustic evenings.',
    voice: 'Playful',
    audience: 'College students, young professionals and weekend groups near Jubilee Hills.',
    competitors: 'Third Wave Coffee, Roastery, local cafes',
    goals: 'Engagement, Footfall, Community Growth',
  },
  {
    key: 'novaSkin',
    name: 'Nova Skin Clinic',
    industry: 'Beauty',
    description: 'Dermatology clinic offering acne, pigmentation and bridal skin-care treatments.',
    voice: 'Educational',
    audience: 'Women and men aged 18-35 seeking trustworthy dermatologist-led skin care.',
    competitors: 'Oliva, Kaya, local dermatology clinics',
    goals: 'Education, Lead Generation, Retention',
  },
] as const;

const CAMPAIGNS = [
  {
    key: 'mukundaBridal',
    clientKey: 'mukunda',
    name: 'Festive Bridal Collection',
    type: 'Festival',
    goal: 'Sales',
    kpi: 'Leads',
    priority: 'High',
    manager: 'manager1' as TeamKey,
    relationship: 'manager2' as TeamKey,
    writers: ['writer1', 'writer2'] as TeamKey[],
    dops: ['dop1'] as TeamKey[],
    editors: ['editor1', 'editor2'] as TeamKey[],
    designer: 'designer1' as TeamKey,
    social: 'social1' as TeamKey,
  },
  {
    key: 'mukundaEducation',
    clientKey: 'mukunda',
    name: 'Daily Gold Education',
    type: 'Awareness',
    goal: 'Education',
    kpi: 'Views',
    priority: 'Medium',
    manager: 'manager2' as TeamKey,
    relationship: 'manager1' as TeamKey,
    writers: ['writer3'] as TeamKey[],
    dops: ['dop2'] as TeamKey[],
    editors: ['editor3'] as TeamKey[],
    designer: 'designer1' as TeamKey,
    social: 'social1' as TeamKey,
  },
  {
    key: 'aarogya30',
    clientKey: 'aarogya',
    name: '30 Day Transformation',
    type: 'Branding',
    goal: 'Leads',
    kpi: 'Conversions',
    priority: 'High',
    manager: 'manager1' as TeamKey,
    relationship: 'manager1' as TeamKey,
    writers: ['writer2', 'writer3'] as TeamKey[],
    dops: ['dop1'] as TeamKey[],
    editors: ['editor2'] as TeamKey[],
    designer: 'designer1' as TeamKey,
    social: 'social1' as TeamKey,
  },
  {
    key: 'urbanLaunch',
    clientKey: 'urbanNest',
    name: 'Luxury Apartments Launch',
    type: 'Launch',
    goal: 'Leads',
    kpi: 'Clicks',
    priority: 'Critical',
    manager: 'manager2' as TeamKey,
    relationship: 'manager2' as TeamKey,
    writers: ['writer1'] as TeamKey[],
    dops: ['dop2'] as TeamKey[],
    editors: ['editor1', 'editor3'] as TeamKey[],
    designer: 'designer1' as TeamKey,
    social: 'social1' as TeamKey,
  },
  {
    key: 'brewWeekend',
    clientKey: 'brewDistrict',
    name: 'Weekend Footfall Campaign',
    type: 'Sales',
    goal: 'Engagement',
    kpi: 'Reach',
    priority: 'Medium',
    manager: 'manager1' as TeamKey,
    relationship: 'manager2' as TeamKey,
    writers: ['writer2'] as TeamKey[],
    dops: ['dop1', 'dop2'] as TeamKey[],
    editors: ['editor2'] as TeamKey[],
    designer: 'designer1' as TeamKey,
    social: 'social1' as TeamKey,
  },
  {
    key: 'novaAcne',
    clientKey: 'novaSkin',
    name: 'Acne Awareness Month',
    type: 'Awareness',
    goal: 'Education',
    kpi: 'Leads',
    priority: 'High',
    manager: 'manager2' as TeamKey,
    relationship: 'manager1' as TeamKey,
    writers: ['writer3', 'writer1'] as TeamKey[],
    dops: ['dop2'] as TeamKey[],
    editors: ['editor3'] as TeamKey[],
    designer: 'designer1' as TeamKey,
    social: 'social1' as TeamKey,
  },
] as const;

type DemoState =
  | 'PUBLISHED'
  | 'READY'
  | 'EDITING'
  | 'EDITOR_INTAKE'
  | 'SHOOT'
  | 'SCRIPT_REVIEW'
  | 'WRITING'
  | 'BLOCKED'
  | 'OVERDUE'
  | 'MISSED'
  | 'CHANGES_REQUESTED'
  | 'DOP_REJECTED';

const STATE_SEQUENCE: DemoState[] = [
  'PUBLISHED',
  'PUBLISHED',
  'READY',
  'EDITING',
  'EDITOR_INTAKE',
  'SHOOT',
  'SCRIPT_REVIEW',
  'WRITING',
  'BLOCKED',
  'OVERDUE',
  'MISSED',
  'CHANGES_REQUESTED',
  'DOP_REJECTED',
  'PUBLISHED',
  'READY',
  'EDITING',
  'EDITING',
  'SHOOT',
  'WRITING',
  'PUBLISHED',
  'READY',
  'SCRIPT_REVIEW',
  'EDITOR_INTAKE',
  'EDITING',
  'PUBLISHED',
  'READY',
  'BLOCKED',
  'SHOOT',
  'WRITING',
  'OVERDUE',
  'PUBLISHED',
  'READY',
  'EDITING',
  'SCRIPT_REVIEW',
  'EDITOR_INTAKE',
  'PUBLISHED',
  'READY',
  'EDITING',
  'SHOOT',
  'WRITING',
  'PUBLISHED',
  'READY',
  'EDITING',
  'MISSED',
  'SCRIPT_REVIEW',
  'PUBLISHED',
  'READY',
  'BLOCKED',
  'EDITING',
  'SHOOT',
  'WRITING',
  'PUBLISHED',
];

const CONTENT_TYPES: ContentType[] = [
  ContentType.REEL,
  ContentType.REEL,
  ContentType.CAROUSEL,
  ContentType.STATIC,
  ContentType.STORY,
  ContentType.AD,
  ContentType.REEL,
  ContentType.CAROUSEL,
];

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for encrypted demo seed data.`);
  }
  return value;
}

function encryptionKey() {
  const secret = process.env.ENCRYPTION_SECRET ?? process.env.FIELD_ENCRYPTION_KEY_BASE64;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET or FIELD_ENCRYPTION_KEY_BASE64 is required.');
  }
  return crypto.createHash('sha256').update(secret).digest('hex').substring(0, 64);
}

function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(encryptionKey(), 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function hashLookup(text: string) {
  return crypto.createHmac('sha256', requiredEnv('FIELD_LOOKUP_SECRET')).update(text.toLowerCase()).digest('hex');
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(base: Date, days: number, hour = 10, minute = 0) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function addHours(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

function label(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function contentPrefix(type: ContentType) {
  const prefixes: Record<ContentType, string> = {
    REEL: 'REEL',
    CAROUSEL: 'CAR',
    STATIC: 'POST',
    STORY: 'STORY',
    BLOG: 'BLOG',
    YOUTUBE: 'YT',
    AD: 'AD',
    OTHER: 'CNT',
  };
  return prefixes[type];
}

async function deleteDemoDataset(preserveAgency: boolean) {
  const agency = await prisma.agency.findUnique({ where: { slug: DEMO_AGENCY.slug } });
  const emailHashes = TEAM.map((person) => hashLookup(person.email));
  const authUsers = await prisma.authUser.findMany({
    where: { emailHash: { in: emailHashes } },
    select: { id: true },
  });
  const authUserIds = authUsers.map((user) => user.id);
  const demoUsers = authUserIds.length
    ? await prisma.user.findMany({
      where: { authUserId: { in: authUserIds } },
      select: { id: true },
    })
    : [];
  const demoUserIds = demoUsers.map((user) => user.id);

  if (agency) {
    const agencyId = agency.id;
    const demoClientNames = CLIENTS.map((client) => client.name);
    const demoCampaignNames = CAMPAIGNS.map((campaign) => campaign.name);
    const scopedClients = preserveAgency
      ? await prisma.client.findMany({
        where: { agencyId, name: { in: demoClientNames } },
        select: { id: true },
      })
      : [];
    const scopedClientIds = scopedClients.map((client) => client.id);
    const scopedCampaigns = preserveAgency
      ? await prisma.campaign.findMany({
        where: {
          agencyId,
          OR: [
            { name: { in: demoCampaignNames } },
            ...(scopedClientIds.length > 0 ? [{ clientId: { in: scopedClientIds } }] : []),
          ],
        },
        select: { id: true },
      })
      : [];
    const scopedCampaignIds = scopedCampaigns.map((campaign) => campaign.id);
    const scopedContentAssets = preserveAgency
      ? await prisma.contentAsset.findMany({
        where: {
          agencyId,
          OR: [
            ...(scopedCampaignIds.length > 0 ? [{ campaignId: { in: scopedCampaignIds } }] : []),
            ...(scopedClientIds.length > 0 ? [{ clientId: { in: scopedClientIds } }] : []),
          ],
        },
        select: { id: true },
      })
      : [];
    const scopedContentAssetIds = scopedContentAssets.map((asset) => asset.id);
    const scopedWorkflowInstances = preserveAgency
      ? await prisma.workflowInstance.findMany({
        where: {
          agencyId,
          ...(scopedContentAssetIds.length > 0 ? { contentAssetId: { in: scopedContentAssetIds } } : { id: '__none__' }),
        },
        select: { id: true },
      })
      : [];
    const scopedWorkflowInstanceIds = scopedWorkflowInstances.map((workflow) => workflow.id);
    const scopedWorkflowTasks = preserveAgency
      ? await prisma.workflowTask.findMany({
        where: {
          agencyId,
          ...(scopedWorkflowInstanceIds.length > 0 ? { workflowInstanceId: { in: scopedWorkflowInstanceIds } } : { id: '__none__' }),
        },
        select: { id: true },
      })
      : [];
    const scopedWorkflowTaskIds = scopedWorkflowTasks.map((task) => task.id);
    const contentFilter = preserveAgency
      ? scopedContentAssetIds.length > 0
        ? { agencyId, contentAssetId: { in: scopedContentAssetIds } }
        : { agencyId, id: '__none__' }
      : { agencyId };
    const taskFilter = preserveAgency
      ? scopedWorkflowTaskIds.length > 0
        ? { agencyId, workflowTaskId: { in: scopedWorkflowTaskIds } }
        : { agencyId, id: '__none__' }
      : { agencyId };
    const workflowFilter = preserveAgency
      ? scopedWorkflowInstanceIds.length > 0
        ? { agencyId, workflowInstanceId: { in: scopedWorkflowInstanceIds } }
        : { agencyId, id: '__none__' }
      : { agencyId };
    const campaignFilter = preserveAgency
      ? scopedCampaignIds.length > 0
        ? { agencyId, campaignId: { in: scopedCampaignIds } }
        : { agencyId, id: '__none__' }
      : { agencyId };
    const clientFilter = preserveAgency
      ? scopedClientIds.length > 0
        ? { agencyId, id: { in: scopedClientIds } }
        : { agencyId, id: '__none__' }
      : { agencyId };

    await prisma.workflowInstance.updateMany({
      where: preserveAgency
        ? scopedWorkflowInstanceIds.length > 0
          ? { agencyId, id: { in: scopedWorkflowInstanceIds } }
          : { agencyId, id: '__none__' }
        : { agencyId },
      data: { currentTaskId: null, currentStepId: null },
    });
    await prisma.notificationDelivery.deleteMany({
      where: {
        agencyId,
        notification: preserveAgency
          ? {
            OR: [
              ...(demoUserIds.length > 0 ? [{ userId: { in: demoUserIds } }] : []),
              { eventType: { in: ['DemoDigest', 'TaskAssigned', 'PublishingSlotPublished', 'CampaignTeamMemberAssigned'] } },
            ],
          }
          : undefined,
      },
    });
    await prisma.notification.deleteMany({
      where: preserveAgency
        ? {
          agencyId,
          OR: [
            ...(demoUserIds.length > 0 ? [{ userId: { in: demoUserIds } }] : []),
            { eventType: { in: ['DemoDigest', 'TaskAssigned', 'PublishingSlotPublished', 'CampaignTeamMemberAssigned'] } },
          ],
        }
        : { agencyId },
    });
    await prisma.fileAsset.deleteMany({ where: contentFilter });
    await prisma.blocker.deleteMany({ where: taskFilter });
    await prisma.approval.deleteMany({ where: taskFilter });
    await prisma.submission.deleteMany({ where: taskFilter });
    await prisma.assignmentHistory.deleteMany({ where: workflowFilter });
    await prisma.workflowTransition.deleteMany({ where: workflowFilter });
    await prisma.workflowTask.deleteMany({
      where: preserveAgency
        ? scopedWorkflowTaskIds.length > 0
          ? { agencyId, id: { in: scopedWorkflowTaskIds } }
          : { agencyId, id: '__none__' }
        : { agencyId },
    });
    await prisma.workflowInstance.deleteMany({
      where: preserveAgency
        ? scopedWorkflowInstanceIds.length > 0
          ? { agencyId, id: { in: scopedWorkflowInstanceIds } }
          : { agencyId, id: '__none__' }
        : { agencyId },
    });
    await prisma.publishingSchedule.deleteMany({
      where: preserveAgency
        ? {
          agencyId,
          OR: [
            ...(scopedCampaignIds.length > 0 ? [{ campaignId: { in: scopedCampaignIds } }] : []),
            ...(scopedContentAssetIds.length > 0 ? [{ contentAssetId: { in: scopedContentAssetIds } }] : []),
          ],
        }
        : { agencyId },
    });
    await prisma.campaignTeamAssignment.deleteMany({ where: campaignFilter });
    await prisma.campaignDeliverablePlan.deleteMany({ where: campaignFilter });
    await prisma.contentAsset.deleteMany({
      where: preserveAgency
        ? scopedContentAssetIds.length > 0
          ? { agencyId, id: { in: scopedContentAssetIds } }
          : { agencyId, id: '__none__' }
        : { agencyId },
    });
    await prisma.campaign.deleteMany({
      where: preserveAgency
        ? scopedCampaignIds.length > 0
          ? { agencyId, id: { in: scopedCampaignIds } }
          : { agencyId, id: '__none__' }
        : { agencyId },
    });
    await prisma.client.deleteMany({ where: clientFilter });
    await prisma.invitationRole.deleteMany({
      where: {
        invitation: {
          agencyId,
          OR: [
            { token: { startsWith: `demo-${agencyId}` } },
            { emailHash: { in: emailHashes } },
          ],
        },
      },
    });
    await prisma.invitation.deleteMany({
      where: {
        agencyId,
        OR: [
          { token: { startsWith: `demo-${agencyId}` } },
          { emailHash: { in: emailHashes } },
        ],
      },
    });
    await prisma.membershipRole.deleteMany({
      where: {
        membership: preserveAgency
          ? { agencyId, user: { authUser: { emailHash: { in: emailHashes } } } }
          : { agencyId },
      },
    });
    await prisma.membership.deleteMany({
      where: preserveAgency
        ? { agencyId, user: { authUser: { emailHash: { in: emailHashes } } } }
        : { agencyId },
    });
    if (!preserveAgency) {
      await prisma.role.deleteMany({ where: { agencyId } });
    }
    await prisma.contentAssetSequence.deleteMany({ where: { agencyId } });
    await prisma.workflowStep.deleteMany({
      where: preserveAgency ? { agencyId, template: { name: 'Standard Reel' } } : { agencyId },
    });
    await prisma.workflowTemplate.deleteMany({
      where: preserveAgency ? { agencyId, name: 'Standard Reel' } : { agencyId },
    });
    await prisma.auditEvent.deleteMany({
      where: preserveAgency
        ? {
          agencyId,
          OR: [
            ...(scopedCampaignIds.length > 0 ? [{ entityId: { in: scopedCampaignIds } }] : []),
            ...(scopedContentAssetIds.length > 0 ? [{ entityId: { in: scopedContentAssetIds } }] : []),
            { requestId: { startsWith: 'demo-' } },
          ],
        }
        : { agencyId },
    });
    await prisma.outboxEvent.deleteMany({
      where: preserveAgency
        ? {
          agencyId,
          OR: [
            ...(scopedCampaignIds.length > 0 ? [{ aggregateId: { in: scopedCampaignIds } }] : []),
            ...(scopedContentAssetIds.length > 0 ? [{ aggregateId: { in: scopedContentAssetIds } }] : []),
            ...(scopedWorkflowInstanceIds.length > 0 ? [{ aggregateId: { in: scopedWorkflowInstanceIds } }] : []),
            { correlationId: { startsWith: 'demo-' } },
          ],
        }
        : { agencyId },
    });
    if (!preserveAgency) {
      await prisma.agency.delete({ where: { id: agencyId } });
    }
  }

  if (!preserveAgency && authUserIds.length > 0) {
    await prisma.authIdentity.deleteMany({ where: { authUserId: { in: authUserIds } } });
    await prisma.session.deleteMany({ where: { authUserId: { in: authUserIds } } });
    await prisma.user.deleteMany({ where: { authUserId: { in: authUserIds } } });
    await prisma.authUser.deleteMany({ where: { id: { in: authUserIds } } });
  }
}

async function seedSystemRoles() {
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: `Permission to ${key}` },
    });
  }

  for (const role of SYSTEM_ROLES) {
    const systemRole = await prisma.systemRole.upsert({
      where: { key: role.key },
      update: { displayName: role.displayName },
      create: {
        key: role.key,
        displayName: role.displayName,
        description: `System ${role.displayName} role`,
      },
    });

    if (['OWNER', 'MANAGER', 'SOCIAL_MEDIA_MANAGER'].includes(role.key)) {
      for (const permissionKey of PERMISSIONS) {
        const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permissionKey } });
        await prisma.systemRolePermission.upsert({
          where: {
            systemRoleId_permissionId: {
              systemRoleId: systemRole.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            systemRoleId: systemRole.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }
}

async function getOrCreateAgencyAndRoles() {
  const agency =
    (await prisma.agency.findUnique({ where: { slug: DEMO_AGENCY.slug } })) ??
    (await prisma.agency.create({
      data: {
        name: DEMO_AGENCY.name,
        displayName: DEMO_AGENCY.displayName,
        slug: DEMO_AGENCY.slug,
        status: 'ACTIVE',
      },
    }));

  const roles = new Map<string, { id: string; displayName: string }>();
  for (const systemRoleConfig of SYSTEM_ROLES) {
    const systemRole = await prisma.systemRole.findUniqueOrThrow({ where: { key: systemRoleConfig.key } });
    const existingRole = await prisma.role.findFirst({
      where: {
        agencyId: agency.id,
        systemRoleId: systemRole.id,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    const role =
      existingRole ??
      (await prisma.role.create({
        data: {
          agencyId: agency.id,
          systemRoleId: systemRole.id,
          displayName: systemRole.displayName,
          description: `${agency.displayName || agency.name} ${systemRole.displayName}`,
        },
      }));
    roles.set(systemRoleConfig.key, role);
  }

  return { agency, roles };
}

async function findExistingOwnerMembership(agencyId: string) {
  return prisma.membership.findFirst({
    where: {
      agencyId,
      status: MembershipStatus.ACTIVE,
      deletedAt: null,
      roles: {
        some: {
          role: {
            systemRole: {
              key: 'OWNER',
            },
          },
        },
      },
    },
    include: {
      user: true,
      roles: {
        include: {
          role: {
            include: {
              systemRole: true,
            },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });
}

async function createTeam(
  agencyId: string,
  roles: Map<string, { id: string; displayName: string }>,
  existingOwner?: Awaited<ReturnType<typeof findExistingOwnerMembership>>,
) {
  const memberships = new Map<TeamKey, { id: string; userId: string; roleKeys: string[] }>();
  if (existingOwner) {
    memberships.set('owner', {
      id: existingOwner.id,
      userId: existingOwner.userId,
      roleKeys: existingOwner.roles.map((item) => item.role.systemRole.key),
    });
  }

  for (const person of TEAM) {
    if (person.key === 'owner' && existingOwner) {
      continue;
    }

    const primaryRole = roles.get(person.primaryRole);
    if (!primaryRole) {
      throw new Error(`Missing role ${person.primaryRole}`);
    }

    const emailHash = hashLookup(person.email);
    const authUser = await prisma.authUser.upsert({
      where: { emailHash },
      update: {
        emailEncrypted: encrypt(person.email),
        status: AuthUserStatus.ACTIVE,
        deletedAt: null,
      },
      create: {
        emailHash,
        emailEncrypted: encrypt(person.email),
        passwordHash: null,
        status: AuthUserStatus.ACTIVE,
      },
    });

    await prisma.authIdentity.upsert({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.GOOGLE,
          providerUserId: `demo-google-${person.email}`,
        },
      },
      update: {
        authUserId: authUser.id,
        emailHash,
      },
      create: {
        authUserId: authUser.id,
        provider: AuthProvider.GOOGLE,
        providerUserId: `demo-google-${person.email}`,
        emailHash,
      },
    });

    const user = await prisma.user.upsert({
      where: { authUserId: authUser.id },
      update: {
        name: person.name,
        mobileNumberEncrypted: encrypt(person.mobile),
        mobileNumberHash: hashLookup(person.mobile),
        timezone: 'Asia/Kolkata',
        language: 'en',
        jobTitle: person.jobTitle,
        presenceStatus: PresenceStatus.AVAILABLE,
        workLocation: person.location,
        statusMessage: `${person.location} today`,
        deletedAt: null,
      },
      create: {
        authUserId: authUser.id,
        name: person.name,
        mobileNumberEncrypted: encrypt(person.mobile),
        mobileNumberHash: hashLookup(person.mobile),
        timezone: 'Asia/Kolkata',
        language: 'en',
        jobTitle: person.jobTitle,
        presenceStatus: PresenceStatus.AVAILABLE,
        workLocation: person.location,
        statusMessage: `${person.location} today`,
      },
    });

    const roleIds = [...new Set(person.roles.map((roleKey) => roles.get(roleKey)?.id).filter(Boolean))] as string[];
    const existingMembership = await prisma.membership.findUnique({
      where: {
        agencyId_userId: {
          agencyId,
          userId: user.id,
        },
      },
    });
    const membership = existingMembership
      ? await prisma.membership.update({
        where: { id: existingMembership.id },
        data: {
          roleId: primaryRole.id,
          status: MembershipStatus.ACTIVE,
          deletedAt: null,
          roles: {
            deleteMany: {},
            create: roleIds.map((roleId) => ({ roleId })),
          },
        },
      })
      : await prisma.membership.create({
        data: {
          agencyId,
          userId: user.id,
          roleId: primaryRole.id,
          status: MembershipStatus.ACTIVE,
          roles: {
            create: roleIds.map((roleId) => ({ roleId })),
          },
        },
      });

    memberships.set(person.key, { id: membership.id, userId: user.id, roleKeys: [...person.roles] });

    const refreshTokenHash = crypto.createHash('sha256').update(`demo-session-${person.email}`).digest('hex');
    await prisma.session.upsert({
      where: { refreshTokenHash },
      update: {
        activeAgencyId: agencyId,
        status: SessionStatus.ACTIVE,
        lastUsedAt: new Date(),
        expiresAt: addDays(startOfToday(), 30),
        revokedAt: null,
      },
      create: {
        authUserId: authUser.id,
        activeAgencyId: agencyId,
        refreshTokenHash,
        refreshTokenFamilyId: `demo-family-${person.key}`,
        deviceLabel: 'Demo browser',
        status: SessionStatus.ACTIVE,
        lastUsedAt: new Date(),
        expiresAt: addDays(startOfToday(), 30),
      },
    });
  }

  const manager1 = memberships.get('manager1')?.id;
  const manager2 = memberships.get('manager2')?.id;
  if (manager1 && manager2) {
    await prisma.membership.updateMany({
      where: { id: { in: ['writer1', 'writer2', 'dop1', 'editor1', 'editor2', 'designer1'].map((key) => memberships.get(key as TeamKey)?.id).filter(Boolean) as string[] } },
      data: { managerMembershipId: manager1 },
    });
    await prisma.membership.updateMany({
      where: { id: { in: ['writer3', 'dop2', 'editor3', 'social1'].map((key) => memberships.get(key as TeamKey)?.id).filter(Boolean) as string[] } },
      data: { managerMembershipId: manager2 },
    });
  }

  return memberships;
}

async function createClients(agencyId: string, memberships: Map<TeamKey, { id: string; userId: string; roleKeys: string[] }>) {
  const clients = new Map<string, { id: string; name: string; audience: string }>();

  for (let index = 0; index < CLIENTS.length; index += 1) {
    const config = CLIENTS[index];
    const manager = memberships.get(index % 2 === 0 ? 'manager1' : 'manager2');
    const client = await prisma.client.create({
      data: {
        agencyId,
        assignedManagerMembershipId: manager?.id,
        name: config.name,
        displayName: config.name,
        website: `https://${config.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example.com`,
        industry: config.industry,
        businessDescription: config.description,
        businessSize: index === 2 ? 'Medium Business' : 'Small Business',
        brandVoice: config.voice,
        brandPersonality: `${config.voice}, clear and conversion-aware`,
        mission: `Make ${config.industry.toLowerCase()} communication useful, trustworthy and memorable.`,
        vision: `Become the most recalled ${config.industry.toLowerCase()} brand in its city.`,
        usp: `Strong local trust with polished digital storytelling.`,
        brandStory: `${config.name} wants content that feels native to Indian social feeds without sounding generic.`,
        tagline: index === 0 ? 'Every moment deserves gold' : undefined,
        dos: 'Keep copy specific, simple and local. Use proof points wherever possible.',
        donts: 'Avoid exaggerated claims, lazy hooks and competitor attacks.',
        audience: config.audience,
        secondaryAudience: 'Influencers, family decision-makers and returning customers.',
        audienceAge: '22-45',
        audienceGender: 'All',
        audienceLocations: 'Hyderabad, Vijayawada, Bengaluru',
        audienceIncome: 'Middle to upper-middle income',
        audienceOccupation: 'Students, professionals, founders and families',
        audiencePainPoints: 'Low trust, too many choices, unclear offers and limited time.',
        audienceInterests: 'Local events, lifestyle, education, offers and practical tips.',
        buyingBehavior: 'Researches on Instagram, asks on WhatsApp, then converts after trust-building content.',
        competitors: config.competitors,
        primaryContactName: ['Lakshmi', 'Rohit', 'Sameer', 'Nisha', 'Dr Kavya'][index],
        primaryContactDesignation: ['Founder', 'Marketing Lead', 'Sales Head', 'Cafe Manager', 'Dermatologist'][index],
        primaryContactEmail: `contact-${config.key}@demo.client.local`,
        primaryContactPhone: `+91920000200${index}`,
        primaryContactWhatsapp: `+91920000200${index}`,
        preferredContactMethod: 'WhatsApp',
        workingHours: '10 AM - 7 PM',
        availableDays: 'Mon-Sat',
        instagramUrl: `https://instagram.com/${config.key}`,
        youtubeUrl: `https://youtube.com/@${config.key}`,
        googleBusinessUrl: `https://business.google.com/${config.key}`,
        whatsappBusinessNumber: `+91920000300${index}`,
        contentGoals: config.goals,
        contentTypes: 'Reels, Carousels, Stories, Static Posts',
        postingFrequency: index === 0 ? 'Daily' : 'Weekly',
        approvalSla: index === 3 ? '12 Hours' : '24 Hours',
        revisionLimit: index === 1 ? '3' : '2',
        priority: index === 2 ? 'Critical' : 'High',
        engagementModel: 'Monthly Retainer',
        billingCycle: 'Monthly',
        deliverables: 'Monthly reels, carousel explainers, stories and publishing support.',
        aiWritingInstructions: `Write for ${config.name} in a ${config.voice.toLowerCase()} voice. Keep hooks specific and avoid translated English.`,
        forbiddenWords: 'cheap, guaranteed cure, best in India',
        preferredCta: index === 2 ? 'Book Site Visit' : 'DM',
        brandDictionary: 'Use local city references, simple Telugu-English phrasing when helpful.',
        productKnowledge: config.description,
        faqs: 'Pricing, availability, offer validity, booking process, turnaround time.',
        internalNotes: 'Client prefers concise updates and needs approval context in one message.',
        startDate: addDays(startOfToday(), -30 + index),
        timezone: 'Asia/Kolkata',
        status: ClientStatus.ACTIVE,
      },
    });
    clients.set(config.key, { id: client.id, name: client.name, audience: config.audience });
  }

  return clients;
}

async function createWorkflowTemplate(agencyId: string, roles: Map<string, { id: string; displayName: string }>) {
  const template = await prisma.workflowTemplate.create({
    data: {
      agencyId,
      name: 'Standard Reel',
      description: 'Demo workflow for script, shoot, edit, review and publishing readiness.',
      contentType: ContentType.REEL,
      isActive: true,
    },
  });

  const stepConfigs = [
    { stage: ContentStage.WRITING, role: 'WRITER', sortOrder: 10, duration: 1440 },
    { stage: ContentStage.MANAGER_SCRIPT_REVIEW, role: 'MANAGER', sortOrder: 20, duration: 360, approval: true },
    { stage: ContentStage.SHOOT, role: 'DOP', sortOrder: 30, duration: 1440 },
    { stage: ContentStage.EDITOR_INTAKE, role: 'EDITOR', sortOrder: 40, duration: 180, acceptance: true },
    { stage: ContentStage.EDITING, role: 'EDITOR', sortOrder: 50, duration: 1440 },
    { stage: ContentStage.MANAGER_EDIT_REVIEW, role: 'MANAGER', sortOrder: 60, duration: 360, approval: true },
    { stage: ContentStage.CLIENT_APPROVAL, role: 'MANAGER', sortOrder: 70, duration: 1440, approval: true },
    { stage: ContentStage.SCHEDULED, role: 'SOCIAL_MEDIA_MANAGER', sortOrder: 80, duration: 120 },
    { stage: ContentStage.PUBLISHED, role: 'SOCIAL_MEDIA_MANAGER', sortOrder: 90, duration: 0 },
  ];

  const steps = new Map<ContentStage, { id: string; stage: ContentStage }>();
  for (const config of stepConfigs) {
    const step = await prisma.workflowStep.create({
      data: {
        agencyId,
        templateId: template.id,
        stage: config.stage,
        sortOrder: config.sortOrder,
        roleId: roles.get(config.role)?.id,
        expectedDurationMinutes: config.duration,
        requiresAcceptance: config.acceptance ?? false,
        requiresApproval: config.approval ?? false,
      },
    });
    steps.set(config.stage, { id: step.id, stage: step.stage });
  }

  return { template, steps };
}

async function createCampaigns(
  agencyId: string,
  clients: Map<string, { id: string; name: string; audience: string }>,
  memberships: Map<TeamKey, { id: string; userId: string; roleKeys: string[] }>,
) {
  const campaigns = new Map<string, { id: string; clientId: string; name: string; config: (typeof CAMPAIGNS)[number] }>();
  const today = startOfToday();

  for (let index = 0; index < CAMPAIGNS.length; index += 1) {
    const config = CAMPAIGNS[index];
    const client = clients.get(config.clientKey);
    const creator = memberships.get(config.manager);
    const agencyApprover = memberships.get('owner');
    if (!client || !creator || !agencyApprover) {
      throw new Error(`Missing client or creator for ${config.name}`);
    }

    const campaign = await prisma.campaign.create({
      data: {
        agencyId,
        clientId: client.id,
        name: config.name,
        campaignCode: `CMP-${String(index + 1).padStart(3, '0')}`,
        campaignType: config.type,
        priority: config.priority,
        strategy: `${config.name} uses educational hooks, local proof and clear CTAs to move audiences from interest to enquiry.`,
        objectives: `${config.goal} for ${client.name}`,
        goal: config.goal,
        primaryKpi: config.kpi,
        targetAudience: client.audience,
        useClientAudience: true,
        keyMessage: `Make ${client.name} easier to trust before the audience speaks to sales.`,
        cta: config.clientKey === 'urbanNest' ? 'Book Site Visit' : 'DM',
        tone: 'Brand-safe, sharp and simple',
        deliverables: 'Reels, carousels, stories and publishing support.',
        reviewFrequency: 'Weekly',
        workingDays: 'Mon-Fri',
        launchDate: addDays(today, index - 2, 10),
        timezone: 'Asia/Kolkata',
        workflowTemplate: 'Standard Reel',
        agencyApproverMembershipId: agencyApprover.id,
        approvalSla: '24 Hours',
        revisionLimit: index % 2 === 0 ? '2' : '3',
        references: 'Competitor reels, customer FAQs, product photos and festive mood boards.',
        moodBoardUrl: `https://drive.google.com/demo/${config.key}/mood-board`,
        driveFolderUrl: `https://drive.google.com/demo/${config.key}`,
        internalNotes: 'Keep client updates crisp. Escalate approval delays after 24 hours.',
        autoGenerateCalendar: true,
        postingDays: 'Mon, Wed, Fri',
        postingWindows: '7 PM, 12 PM',
        blackoutDates: index === 4 ? 'Avoid Monday cafe maintenance hours' : undefined,
        platformMix: 'Instagram, YouTube',
        startDate: addDays(today, -15 + index),
        endDate: addDays(today, 15 + index),
        status: index === 0 || index === 2 || index === 3 ? CampaignStatus.ACTIVE : index === 4 ? CampaignStatus.PAUSED : CampaignStatus.DRAFT,
        createdByMembershipId: creator.id,
      },
    });

    const assignmentData: Prisma.CampaignTeamAssignmentCreateManyInput[] = [
      { agencyId, campaignId: campaign.id, membershipId: memberships.get(config.manager)!.id, assignmentRole: CampaignAssignmentRole.CAMPAIGN_MANAGER },
      { agencyId, campaignId: campaign.id, membershipId: memberships.get(config.relationship)!.id, assignmentRole: CampaignAssignmentRole.RELATIONSHIP_MANAGER },
      { agencyId, campaignId: campaign.id, membershipId: memberships.get(config.designer)!.id, assignmentRole: CampaignAssignmentRole.DESIGNER },
      { agencyId, campaignId: campaign.id, membershipId: memberships.get(config.social)!.id, assignmentRole: CampaignAssignmentRole.SOCIAL_MEDIA_MANAGER },
      { agencyId, campaignId: campaign.id, membershipId: agencyApprover.id, assignmentRole: CampaignAssignmentRole.AGENCY_APPROVER },
      ...config.writers.map((key) => ({ agencyId, campaignId: campaign.id, membershipId: memberships.get(key)!.id, assignmentRole: CampaignAssignmentRole.WRITER })),
      ...config.dops.map((key) => ({ agencyId, campaignId: campaign.id, membershipId: memberships.get(key)!.id, assignmentRole: CampaignAssignmentRole.DOP })),
      ...config.editors.map((key) => ({ agencyId, campaignId: campaign.id, membershipId: memberships.get(key)!.id, assignmentRole: CampaignAssignmentRole.EDITOR })),
    ];

    await prisma.campaignTeamAssignment.createMany({ data: assignmentData, skipDuplicates: true });
    const connectedMembershipIds = [...new Set(assignmentData.map((item) => item.membershipId))];
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        assignedMemberships: {
          connect: connectedMembershipIds.map((id) => ({ id })),
        },
      },
    });

    await prisma.campaignDeliverablePlan.createMany({
      data: [
        {
          agencyId,
          campaignId: campaign.id,
          contentType: ContentType.REEL,
          quantity: index === 0 ? 12 : 8,
          frequency: '3 per week',
          preferredDays: 'Mon, Wed, Fri',
          preferredTime: '19:00',
          platform: 'Instagram',
          startDate: campaign.startDate,
          endDate: campaign.endDate,
        },
        {
          agencyId,
          campaignId: campaign.id,
          contentType: index % 2 === 0 ? ContentType.CAROUSEL : ContentType.STATIC,
          quantity: 4,
          frequency: 'Weekly',
          preferredDays: 'Thu',
          preferredTime: '12:00',
          platform: 'Instagram',
          startDate: campaign.startDate,
          endDate: campaign.endDate,
        },
      ],
    });

    campaigns.set(config.key, { id: campaign.id, clientId: client.id, name: campaign.name, config });
  }

  return campaigns;
}

function pickMember(keys: readonly TeamKey[], index: number, memberships: Map<TeamKey, { id: string; userId: string; roleKeys: string[] }>) {
  return memberships.get(keys[index % keys.length])!;
}

function stageForState(state: DemoState) {
  const map: Record<DemoState, ContentStage> = {
    PUBLISHED: ContentStage.PUBLISHED,
    READY: ContentStage.SCHEDULED,
    EDITING: ContentStage.EDITING,
    EDITOR_INTAKE: ContentStage.EDITOR_INTAKE,
    SHOOT: ContentStage.SHOOT,
    SCRIPT_REVIEW: ContentStage.MANAGER_SCRIPT_REVIEW,
    WRITING: ContentStage.WRITING,
    BLOCKED: ContentStage.EDITING,
    OVERDUE: ContentStage.WRITING,
    MISSED: ContentStage.EDITING,
    CHANGES_REQUESTED: ContentStage.WRITING,
    DOP_REJECTED: ContentStage.SHOOT,
  };
  return map[state];
}

function workflowStatusForState(state: DemoState) {
  return state === 'PUBLISHED' || state === 'READY' ? WorkflowInstanceStatus.COMPLETED : WorkflowInstanceStatus.ACTIVE;
}

function contentStatusForState(state: DemoState) {
  if (state === 'PUBLISHED') return ContentAssetStatus.PUBLISHED;
  if (state === 'READY') return ContentAssetStatus.COMPLETED;
  return ContentAssetStatus.ACTIVE;
}

function publishingStatusForState(state: DemoState, scheduledAt: Date) {
  if (state === 'PUBLISHED') return PublishingStatus.PUBLISHED;
  if (state === 'READY') return PublishingStatus.READY;
  if (state === 'MISSED') return PublishingStatus.MISSED;
  if (scheduledAt < new Date() && ['WRITING', 'OVERDUE', 'BLOCKED'].includes(state)) return PublishingStatus.MISSED;
  return scheduledAt > new Date() ? PublishingStatus.PLANNED : PublishingStatus.SCHEDULED;
}

function riskForState(state: DemoState, scheduledAt?: Date) {
  if (state === 'BLOCKED') return ContentRisk.BLOCKED;
  if (state === 'OVERDUE' || state === 'MISSED') return ContentRisk.OVERDUE;
  if (state === 'EDITOR_INTAKE' || state === 'SCRIPT_REVIEW' || (scheduledAt && scheduledAt < addDays(startOfToday(), 2))) {
    return ContentRisk.NEEDS_ATTENTION;
  }
  if (state === 'EDITING') return ContentRisk.AT_RISK;
  return ContentRisk.ON_TRACK;
}

function taskStatusForStage(stage: ContentStage, targetStage: ContentStage, state: DemoState) {
  if (state === 'BLOCKED' && stage === targetStage) return TaskStatus.BLOCKED;
  if (state === 'OVERDUE' && stage === targetStage) return TaskStatus.IN_PROGRESS;
  if (stage !== targetStage) return TaskStatus.COMPLETED;
  if (stage === ContentStage.MANAGER_SCRIPT_REVIEW || stage === ContentStage.MANAGER_EDIT_REVIEW) return TaskStatus.WAITING_REVIEW;
  if (stage === ContentStage.EDITOR_INTAKE) return TaskStatus.WAITING_HANDOFF_ACCEPTANCE;
  if (state === 'CHANGES_REQUESTED') return TaskStatus.IN_PROGRESS;
  return TaskStatus.IN_PROGRESS;
}

async function createTransition(
  agencyId: string,
  workflowInstanceId: string,
  fromStage: ContentStage | null,
  toStage: ContentStage,
  changedById: string,
  reason: string,
  createdAt: Date,
) {
  await prisma.workflowTransition.create({
    data: {
      agencyId,
      workflowInstanceId,
      fromStage: fromStage ?? undefined,
      toStage,
      changedById,
      reason,
      durationMs: fromStage ? 6 * 60 * 60 * 1000 : undefined,
      requestId: `demo-${workflowInstanceId.slice(0, 8)}-${toStage}`,
      correlationId: `demo-correlation-${workflowInstanceId.slice(0, 8)}`,
      createdAt,
    },
  });
}

async function createOutbox(
  agencyId: string,
  aggregateId: string,
  aggregateType: string,
  eventType: string,
  payload: Prisma.InputJsonValue,
  offset: number,
) {
  await prisma.outboxEvent.create({
    data: {
      agencyId,
      aggregateId,
      aggregateType,
      eventType,
      payload,
      status: offset % 5 === 0 ? OutboxStatus.PUBLISHED : OutboxStatus.PENDING,
      publishedAt: offset % 5 === 0 ? addDays(startOfToday(), -1, 9, offset % 60) : undefined,
      correlationId: `demo-${aggregateType}-${offset}`,
    },
  });
}

async function createNotification(
  agencyId: string,
  userId: string,
  eventType: string,
  title: string,
  body: string,
  read: boolean,
  createdAt: Date,
) {
  const notification = await prisma.notification.create({
    data: {
      agencyId,
      userId,
      eventType,
      title,
      body,
      status: read ? NotificationStatus.READ : NotificationStatus.UNREAD,
      readAt: read ? addHours(createdAt, 2) : undefined,
      createdAt,
    },
  });

  await prisma.notificationDelivery.create({
    data: {
      agencyId,
      notificationId: notification.id,
      channel: NotificationDeliveryChannel.IN_APP,
      status: NotificationDeliveryStatus.SENT,
      provider: 'agos-demo',
      providerMessageId: `demo-${notification.id}`,
      sentAt: createdAt,
      createdAt,
    },
  });
}

async function createWorkflowForAsset(params: {
  agencyId: string;
  campaign: { id: string; clientId: string; name: string; config: (typeof CAMPAIGNS)[number] };
  contentAssetId: string;
  displayCode: string;
  title: string;
  state: DemoState;
  scheduledAt: Date;
  templateId: string;
  steps: Map<ContentStage, { id: string; stage: ContentStage }>;
  memberships: Map<TeamKey, { id: string; userId: string; roleKeys: string[] }>;
  index: number;
}) {
  const targetStage = stageForState(params.state);
  const manager = params.memberships.get(params.campaign.config.manager)!;
  const writer = pickMember(params.campaign.config.writers, params.index, params.memberships);
  const dop = pickMember(params.campaign.config.dops, params.index, params.memberships);
  const editor = pickMember(params.campaign.config.editors, params.index, params.memberships);
  const social = params.memberships.get(params.campaign.config.social)!;
  const owner = params.memberships.get('owner')!;
  const deadlineAt =
    params.state === 'OVERDUE' || params.state === 'MISSED'
      ? addDays(startOfToday(), -2, 18)
      : params.state === 'READY'
        ? addDays(startOfToday(), 1, 18)
        : addDays(params.scheduledAt, -1, 18);

  const workflow = await prisma.workflowInstance.create({
    data: {
      agencyId: params.agencyId,
      contentAssetId: params.contentAssetId,
      templateId: params.templateId,
      currentStepId: params.steps.get(targetStage)?.id,
      managerMembershipId: manager.id,
      riskStatus: riskForState(params.state, params.scheduledAt),
      deadlineAt,
      status: workflowStatusForState(params.state),
      startedAt: addDays(params.scheduledAt, -5, 9),
      completedAt: workflowStatusForState(params.state) === WorkflowInstanceStatus.COMPLETED ? addDays(params.scheduledAt, -1, 17) : undefined,
    },
  });

  const stageOwners = new Map<ContentStage, { id: string; userId: string; roleKeys: string[] }>([
    [ContentStage.WRITING, writer],
    [ContentStage.MANAGER_SCRIPT_REVIEW, manager],
    [ContentStage.SHOOT, dop],
    [ContentStage.EDITOR_INTAKE, editor],
    [ContentStage.EDITING, editor],
    [ContentStage.MANAGER_EDIT_REVIEW, manager],
    [ContentStage.CLIENT_APPROVAL, manager],
    [ContentStage.SCHEDULED, social],
    [ContentStage.PUBLISHED, social],
  ]);

  const orderedStages: ContentStage[] = [
    ContentStage.WRITING,
    ContentStage.MANAGER_SCRIPT_REVIEW,
    ContentStage.SHOOT,
    ContentStage.EDITOR_INTAKE,
    ContentStage.EDITING,
    ContentStage.MANAGER_EDIT_REVIEW,
    ContentStage.CLIENT_APPROVAL,
    ContentStage.SCHEDULED,
    ContentStage.PUBLISHED,
  ];
  const targetIndex = orderedStages.indexOf(targetStage);
  const stagesToCreate = orderedStages.slice(0, Math.max(targetIndex + 1, 1));
  let currentTaskId: string | null = null;
  let previousOwnerId: string | null = null;
  let previousStage: ContentStage | null = null;

  for (let stageIndex = 0; stageIndex < stagesToCreate.length; stageIndex += 1) {
    const stage = stagesToCreate[stageIndex];
    const owner = stageOwners.get(stage)!;
    const step = params.steps.get(stage);
    const taskStatus = taskStatusForStage(stage, targetStage, params.state);
    const taskDeadline = addDays(params.scheduledAt, -5 + stageIndex, stage === ContentStage.SCHEDULED ? 11 : 18);
    const task = await prisma.workflowTask.create({
      data: {
        agencyId: params.agencyId,
        workflowInstanceId: workflow.id,
        workflowStepId: step?.id,
        displayName: `${label(stage)} for ${params.displayCode}`,
        ownerMembershipId: owner.id,
        status: taskStatus,
        deadlineAt: params.state === 'OVERDUE' && stage === targetStage ? addDays(startOfToday(), -2, 18) : taskDeadline,
        acceptedAt:
          stage === ContentStage.EDITOR_INTAKE &&
            (taskStatus === TaskStatus.WAITING_HANDOFF_ACCEPTANCE || taskStatus === TaskStatus.COMPLETED)
            ? addHours(taskDeadline, -5)
            : undefined,
        completedAt: taskStatus === TaskStatus.COMPLETED ? addHours(taskDeadline, -2) : undefined,
        createdAt: addDays(params.scheduledAt, -6 + stageIndex, 10),
      },
    });

    if (stage === targetStage || stageIndex === stagesToCreate.length - 1) {
      currentTaskId = task.id;
    }

    await prisma.assignmentHistory.create({
      data: {
        agencyId: params.agencyId,
        workflowInstanceId: workflow.id,
        workflowTaskId: task.id,
        fromMembershipId: previousOwnerId ?? undefined,
        toMembershipId: owner.id,
        workflowStepId: step?.id,
        changedByMembershipId: manager.id,
        reason: `Assigned ${label(stage)} work`,
        requestId: `demo-assignment-${workflow.id.slice(0, 8)}-${stageIndex}`,
        createdAt: addDays(params.scheduledAt, -6 + stageIndex, 11),
      },
    });
    previousOwnerId = owner.id;

    await createTransition(
      params.agencyId,
      workflow.id,
      previousStage,
      stage,
      manager.id,
      `Demo transition to ${label(stage)}`,
      addDays(params.scheduledAt, -6 + stageIndex, 12),
    );
    previousStage = stage;

    if (stage === ContentStage.WRITING && (taskStatus === TaskStatus.COMPLETED || params.state === 'SCRIPT_REVIEW' || params.state === 'CHANGES_REQUESTED')) {
      const version = params.state === 'CHANGES_REQUESTED' ? 2 : 1;
      if (params.state === 'CHANGES_REQUESTED') {
        await prisma.submission.create({
          data: {
            agencyId: params.agencyId,
            workflowTaskId: task.id,
            submittedBy: writer.id,
            submissionType: SubmissionType.SCRIPT,
            version: 1,
            body: 'First hook was too generic. Needs sharper product proof.',
            externalLink: `https://docs.google.com/document/d/demo-${params.displayCode}-v1`,
            status: SubmissionStatus.SEEN,
            seenAt: addDays(params.scheduledAt, -4, 14),
            createdAt: addDays(params.scheduledAt, -4, 12),
          },
        });
        await prisma.approval.create({
          data: {
            agencyId: params.agencyId,
            workflowTaskId: task.id,
            approverId: manager.id,
            status: ApprovalStatus.CHANGES_REQUESTED,
            comment: 'Make the opening more emotional and add one client-specific proof point.',
            idempotencyKey: `demo-${params.displayCode}-script-change-request`,
            requestId: `demo-${params.displayCode}-script-change-request`,
            createdAt: addDays(params.scheduledAt, -4, 15),
          },
        });
      }

      await prisma.submission.create({
        data: {
          agencyId: params.agencyId,
          workflowTaskId: task.id,
          submittedBy: writer.id,
          submissionType: SubmissionType.SCRIPT,
          version,
          body: `${params.title} script with hook, scene notes, CTA and creator references.`,
          externalLink: `https://docs.google.com/document/d/demo-${params.displayCode}-v${version}`,
          status: taskStatus === TaskStatus.COMPLETED ? SubmissionStatus.ACCEPTED : SubmissionStatus.SUBMITTED,
          seenAt: taskStatus === TaskStatus.COMPLETED ? addDays(params.scheduledAt, -4, 16) : undefined,
          createdAt: addDays(params.scheduledAt, -4, 13),
        },
      });
    }

    if (stage === ContentStage.SHOOT && (taskStatus === TaskStatus.COMPLETED || params.state === 'DOP_REJECTED')) {
      await prisma.submission.create({
        data: {
          agencyId: params.agencyId,
          workflowTaskId: task.id,
          submittedBy: dop.id,
          submissionType: SubmissionType.RAW_FOOTAGE,
          version: 1,
          body: params.state === 'DOP_REJECTED' ? 'Drive folder missing product close-up shots.' : 'Raw footage uploaded with scene folders.',
          externalLink: `https://drive.google.com/demo/raw/${params.displayCode}`,
          status: params.state === 'DOP_REJECTED' ? SubmissionStatus.REJECTED : SubmissionStatus.ACCEPTED,
          seenAt: addDays(params.scheduledAt, -2, 15),
          createdAt: addDays(params.scheduledAt, -2, 14),
        },
      });
      await prisma.fileAsset.create({
        data: {
          agencyId: params.agencyId,
          contentAssetId: params.contentAssetId,
          uploaderId: dop.id,
          storageProvider: StorageProvider.GOOGLE_DRIVE,
          filename: `${params.displayCode}-raw-footage`,
          externalUrl: `https://drive.google.com/demo/raw/${params.displayCode}`,
          fileType: 'google-drive-folder',
          createdAt: addDays(params.scheduledAt, -2, 14),
        },
      });
      if (params.state === 'DOP_REJECTED') {
        await prisma.approval.create({
          data: {
            agencyId: params.agencyId,
            workflowTaskId: task.id,
            approverId: editor.id,
            status: ApprovalStatus.REJECTED,
            comment: 'Missing vertical establishing shot and final product close-up.',
            idempotencyKey: `demo-${params.displayCode}-dop-rejected`,
            requestId: `demo-${params.displayCode}-dop-rejected`,
            createdAt: addDays(params.scheduledAt, -2, 16),
          },
        });
      }
    }

    if (stage === ContentStage.EDITING && (taskStatus === TaskStatus.COMPLETED || stage === targetStage)) {
      await prisma.submission.create({
        data: {
          agencyId: params.agencyId,
          workflowTaskId: task.id,
          submittedBy: editor.id,
          submissionType: SubmissionType.FINAL_CUT,
          version: 1,
          body: taskStatus === TaskStatus.COMPLETED ? 'Final edit with captions, music and logo outro.' : 'Draft edit in progress.',
          externalLink: `https://frame.io/demo/${params.displayCode}`,
          status: taskStatus === TaskStatus.COMPLETED ? SubmissionStatus.ACCEPTED : SubmissionStatus.SUBMITTED,
          createdAt: addDays(params.scheduledAt, -1, 16),
        },
      });
      await prisma.fileAsset.create({
        data: {
          agencyId: params.agencyId,
          contentAssetId: params.contentAssetId,
          uploaderId: editor.id,
          storageProvider: StorageProvider.EXTERNAL_URL,
          filename: `${params.displayCode}-draft-cut`,
          externalUrl: `https://frame.io/demo/${params.displayCode}`,
          fileType: 'video-link',
          createdAt: addDays(params.scheduledAt, -1, 16),
        },
      });
    }

    if ((stage === ContentStage.MANAGER_SCRIPT_REVIEW || stage === ContentStage.MANAGER_EDIT_REVIEW) && taskStatus === TaskStatus.COMPLETED) {
      await prisma.approval.create({
        data: {
          agencyId: params.agencyId,
          workflowTaskId: task.id,
          approverId: manager.id,
          status: ApprovalStatus.APPROVED,
          comment: `${label(stage)} approved for next stage.`,
          idempotencyKey: `demo-${params.displayCode}-${stage}-approved`,
          requestId: `demo-${params.displayCode}-${stage}-approved`,
          createdAt: addDays(params.scheduledAt, -1, 17),
        },
      });
    }
  }

  if (params.state === 'BLOCKED' && currentTaskId) {
    await prisma.blocker.create({
      data: {
        agencyId: params.agencyId,
        workflowTaskId: currentTaskId,
        blockedBy: editor.id,
        reason: 'WAITING_ASSETS',
        details: 'Client has not shared product packshots for the edit.',
        status: BlockerStatus.ACTIVE,
        createdAt: addDays(startOfToday(), -1, 15),
      },
    });
  }

  await prisma.workflowInstance.update({
    where: { id: workflow.id },
    data: { currentTaskId },
  });

  const assignee = stageOwners.get(targetStage) ?? manager;
  await createNotification(
    params.agencyId,
    assignee.userId,
    params.state === 'PUBLISHED' ? 'PublishingSlotPublished' : 'TaskAssigned',
    params.state === 'PUBLISHED' ? `${params.displayCode} published` : `${params.displayCode} needs ${label(targetStage)}`,
    `${params.title} is ${label(targetStage)} in ${params.campaign.name}.`,
    params.index % 3 === 0,
    addDays(startOfToday(), params.index % 10 - 5, 10),
  );

  await createOutbox(
    params.agencyId,
    workflow.id,
    'WorkflowInstance',
    params.state === 'PUBLISHED' ? 'WorkflowCompleted' : 'WorkflowAdvanced',
    {
      workflowInstanceId: workflow.id,
      contentAssetId: params.contentAssetId,
      displayCode: params.displayCode,
      currentStage: targetStage,
      state: params.state,
    },
    params.index,
  );

  return workflow;
}

async function createContentAndWorkflows(params: {
  agencyId: string;
  clients: Map<string, { id: string; name: string; audience: string }>;
  campaigns: Map<string, { id: string; clientId: string; name: string; config: (typeof CAMPAIGNS)[number] }>;
  memberships: Map<TeamKey, { id: string; userId: string; roleKeys: string[] }>;
  templateId: string;
  steps: Map<ContentStage, { id: string; stage: ContentStage }>;
}) {
  const counters = new Map<ContentType, number>();
  const today = startOfToday();
  const campaignEntries = [...params.campaigns.values()];

  for (let index = 0; index < STATE_SEQUENCE.length; index += 1) {
    const state = STATE_SEQUENCE[index];
    const campaign = campaignEntries[index % campaignEntries.length];
    const client = [...params.clients.values()].find((item) => item.id === campaign.clientId);
    const type = CONTENT_TYPES[index % CONTENT_TYPES.length];
    const next = (counters.get(type) ?? 0) + 1;
    counters.set(type, next);
    const displayCode = `${contentPrefix(type)}-${String(next).padStart(3, '0')}`;
    const scheduledAt = addDays(today, -15 + (index % 31), index % 2 === 0 ? 19 : 12, index % 4 === 0 ? 30 : 0);
    const title = `${label(type)} ${next} - ${campaign.name}`;

    const asset = await prisma.contentAsset.create({
      data: {
        agencyId: params.agencyId,
        clientId: campaign.clientId,
        campaignId: campaign.id,
        displayCode,
        type,
        title,
        brief: `Create ${label(type).toLowerCase()} for ${client?.name ?? 'client'} focused on ${campaign.config.goal.toLowerCase()} and ${campaign.config.kpi.toLowerCase()}.`,
        status: contentStatusForState(state),
        createdAt: addDays(scheduledAt, -6, 9),
      },
    });

    const workflow = await createWorkflowForAsset({
      agencyId: params.agencyId,
      campaign,
      contentAssetId: asset.id,
      displayCode,
      title,
      state,
      scheduledAt,
      templateId: params.templateId,
      steps: params.steps,
      memberships: params.memberships,
      index,
    });

    const publishingStatus = publishingStatusForState(state, scheduledAt);
    await prisma.publishingSchedule.create({
      data: {
        agencyId: params.agencyId,
        campaignId: campaign.id,
        contentAssetId: asset.id,
        platform: index % 5 === 0 ? PublishingPlatform.YOUTUBE : PublishingPlatform.INSTAGRAM,
        scheduledAt,
        status: publishingStatus,
        riskStatus: riskForState(state, scheduledAt),
        timezone: 'Asia/Kolkata',
        caption: `${client?.name ?? 'Client'} ${label(type).toLowerCase()} caption for ${campaign.name}.`,
        note: state === 'MISSED' ? 'Missed because production was not ready before publishing time.' : 'Demo publishing slot linked to production workflow.',
        publishedAt: publishingStatus === PublishingStatus.PUBLISHED ? addHours(scheduledAt, 1) : undefined,
        publishedUrl: publishingStatus === PublishingStatus.PUBLISHED ? `https://instagram.com/p/demo-${displayCode.toLowerCase()}` : undefined,
      },
    });

    await prisma.auditEvent.create({
      data: {
        agencyId: params.agencyId,
        actorId: params.memberships.get(campaign.config.manager)?.id,
        requestId: `demo-audit-${displayCode}`,
        correlationId: `demo-correlation-${displayCode}`,
        eventType: state === 'PUBLISHED' ? 'PublishingSlotPublished' : 'ContentAssetSeeded',
        entityType: 'ContentAsset',
        entityId: asset.id,
        metadataJson: {
          displayCode,
          state,
          workflowInstanceId: workflow.id,
        },
        createdAt: addDays(scheduledAt, -1, 12),
      },
    });
  }

  for (const [type, next] of counters.entries()) {
    await prisma.contentAssetSequence.create({
      data: {
        agencyId: params.agencyId,
        type,
        nextSequence: next + 1,
      },
    });
  }

  const unlinkedCampaign = campaignEntries[0];
  await prisma.publishingSchedule.create({
    data: {
      agencyId: params.agencyId,
      campaignId: unlinkedCampaign.id,
      platform: PublishingPlatform.INSTAGRAM,
      scheduledAt: addDays(today, 5, 19),
      status: PublishingStatus.PLANNED,
      riskStatus: ContentRisk.ON_TRACK,
      timezone: 'Asia/Kolkata',
      caption: 'Unlinked bridal styling reel slot waiting for production generation.',
      note: 'Intentional demo edge case: no content asset linked yet.',
    },
  });
}

async function createCampaignAndTeamEvents(
  agencyId: string,
  campaigns: Map<string, { id: string; clientId: string; name: string; config: (typeof CAMPAIGNS)[number] }>,
  memberships: Map<TeamKey, { id: string; userId: string; roleKeys: string[] }>,
) {
  let index = 0;
  for (const campaign of campaigns.values()) {
    const manager = memberships.get(campaign.config.manager)!;
    await createOutbox(
      agencyId,
      campaign.id,
      'Campaign',
      'CampaignCreated',
      { campaignId: campaign.id, name: campaign.name },
      index,
    );
    await createOutbox(
      agencyId,
      campaign.id,
      'Campaign',
      campaign.name.includes('Weekend') ? 'CampaignPaused' : 'CampaignActivated',
      { campaignId: campaign.id, name: campaign.name, managerMembershipId: manager.id },
      index + 20,
    );
    await createNotification(
      agencyId,
      manager.userId,
      'CampaignTeamMemberAssigned',
      `You manage ${campaign.name}`,
      `${campaign.name} is assigned to you as campaign manager.`,
      index % 2 === 0,
      addDays(startOfToday(), -12 + index, 11),
    );
    index += 1;
  }

  for (const person of TEAM) {
    const member = memberships.get(person.key);
    if (!member) continue;
    await createNotification(
      agencyId,
      member.userId,
      'DemoDigest',
      'Demo workspace ready',
      `Your ${DEMO_AGENCY.displayName} demo queue includes realistic assignments, approvals and publishing slots.`,
      person.key === 'owner',
      addDays(startOfToday(), -1, 9),
    );
  }
}

async function main() {
  const reset = process.argv.includes('--reset');
  const existingAgency = await prisma.agency.findUnique({ where: { slug: DEMO_AGENCY.slug } });
  const preserveAgency = Boolean(existingAgency);
  console.log(`${reset ? 'Resetting' : 'Seeding'} AGENCIE demo data for agency slug: ${DEMO_AGENCY.slug}`);
  console.log('Window: rolling 15 days before today through 15 days after today.');
  if (preserveAgency) {
    console.log(`Preserving existing agency and OAuth memberships: ${existingAgency?.displayName || existingAgency?.name}`);
  }

  await seedSystemRoles();
  await deleteDemoDataset(preserveAgency);
  const { agency, roles } = await getOrCreateAgencyAndRoles();
  const existingOwner = preserveAgency ? await findExistingOwnerMembership(agency.id) : null;
  const memberships = await createTeam(agency.id, roles, existingOwner);
  const clients = await createClients(agency.id, memberships);
  const { template, steps } = await createWorkflowTemplate(agency.id, roles);
  const campaigns = await createCampaigns(agency.id, clients, memberships);
  await createContentAndWorkflows({
    agencyId: agency.id,
    clients,
    campaigns,
    memberships,
    templateId: template.id,
    steps,
  });
  await createCampaignAndTeamEvents(agency.id, campaigns, memberships);

  console.log('Demo seed complete.');
  console.log(`Agency: ${agency.displayName} (${agency.slug})`);
  console.log(`Team members: ${memberships.size}`);
  console.log(`Clients: ${CLIENTS.length}`);
  console.log(`Campaigns: ${CAMPAIGNS.length}`);
  console.log(`Content assets: ${STATE_SEQUENCE.length}`);
  console.log('Edge cases: changes requested, DOP handover rejected, blocked workflow, missed slot, ready-to-publish item, unlinked slot.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
