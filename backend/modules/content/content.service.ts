import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentAssetStatus, ContentStage } from '@prisma/client';
import { PrismaService } from '@packages/database/prisma.service';
import { DomainEvents } from '@packages/events/domain-event';
import { EventBusService } from '@packages/events/event-bus.service';
import { CreateContentAssetDto } from './dto/create-content-asset.dto';
import { UpdateContentAssetDto } from './dto/update-content-asset.dto';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateContentAssetDto, agencyId?: string, actorId?: string) {
    const resolvedAgencyId = agencyId ?? dto.agencyId;
    if (!resolvedAgencyId) {
      throw new BadRequestException('Agency context is required');
    }

    const [campaign, client] = await Promise.all([
      this.prisma.campaign.findUnique({ where: { id: dto.campaignId } }),
      this.prisma.client.findUnique({ where: { id: dto.clientId } }),
    ]);

    if (!campaign || campaign.agencyId !== resolvedAgencyId) {
      throw new ConflictException('Campaign does not belong to the current agency');
    }

    if (!client || client.agencyId !== resolvedAgencyId || client.id !== dto.clientId) {
      throw new ConflictException('Client does not belong to the current agency');
    }

    if (campaign.clientId !== dto.clientId) {
      throw new ConflictException('Campaign and client do not belong to the same agency context');
    }

    const displayCode = dto.displayCode ?? this.generateDisplayCode(resolvedAgencyId, dto.type);

    const contentAsset = await this.prisma.contentAsset.create({
      data: {
        agencyId: resolvedAgencyId,
        clientId: dto.clientId,
        campaignId: dto.campaignId,
        displayCode,
        type: dto.type,
        title: dto.title,
        brief: dto.brief,
        status: 'ACTIVE',
      },
    });

    await this.eventBus.publish(DomainEvents.ContentAssetCreated, {
      agencyId: contentAsset.agencyId,
      actorId: actorId ?? null,
      payload: { contentAssetId: contentAsset.id, campaignId: contentAsset.campaignId, displayCode: contentAsset.displayCode },
    });

    return contentAsset;
  }

  async update(id: string, dto: UpdateContentAssetDto, agencyId: string, actorId?: string) {
    const existing = await this.prisma.contentAsset.findUnique({ where: { id } });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException('Content asset not found');
    }

    const contentAsset = await this.prisma.contentAsset.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.brief !== undefined ? { brief: dto.brief } : {}),
        ...(dto.displayCode ? { displayCode: dto.displayCode } : {}),
        ...(dto.type ? { type: dto.type } : {}),
      },
    });

    await this.eventBus.publish(DomainEvents.ContentAssetUpdated, {
      agencyId,
      actorId: actorId ?? null,
      payload: { contentAssetId: contentAsset.id, displayCode: contentAsset.displayCode },
    });

    return contentAsset;
  }

  async findById(id: string, agencyId: string) {
    const contentAsset = await this.prisma.contentAsset.findUnique({
      where: { id },
      include: {
        client: true,
        campaign: true,
        workflowInstances: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: {
            currentStep: true,
            currentTask: {
              include: {
                submissions: { orderBy: { createdAt: 'desc' }, take: 1 },
              },
            },
            tasks: {
              include: {
                submissions: { orderBy: { createdAt: 'desc' }, take: 1 },
              },
            },
            transitions: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    if (!contentAsset || contentAsset.agencyId !== agencyId) {
      throw new NotFoundException('Content asset not found');
    }

    return this.withProjectedStage(contentAsset);
  }

  async findMany(agencyId: string) {
    const assets = await this.prisma.contentAsset.findMany({
      where: { agencyId, status: { not: 'DELETED' } },
      include: {
        client: true,
        campaign: true,
        workflowInstances: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: {
            currentStep: true,
            transitions: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    return assets.map((asset) => this.withProjectedStage(asset));
  }

  async archive(id: string, agencyId: string, actorId?: string) {
    const existing = await this.prisma.contentAsset.findUnique({ where: { id } });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException('Content asset not found');
    }

    const contentAsset = await this.prisma.contentAsset.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await this.eventBus.publish(DomainEvents.ContentAssetArchived, {
      agencyId,
      actorId: actorId ?? null,
      payload: { contentAssetId: contentAsset.id },
    });

    return contentAsset;
  }

  async restore(id: string, agencyId: string, actorId?: string) {
    const existing = await this.prisma.contentAsset.findUnique({ where: { id } });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException('Content asset not found');
    }

    const contentAsset = await this.prisma.contentAsset.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await this.eventBus.publish(DomainEvents.ContentAssetRestored, {
      agencyId,
      actorId: actorId ?? null,
      payload: { contentAssetId: contentAsset.id },
    });

    return contentAsset;
  }

  private generateDisplayCode(agencyId: string, type: string) {
    const prefix = type.toUpperCase().slice(0, 4);
    return `${prefix}-${agencyId.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;
  }

  private withProjectedStage<T extends {
    status: ContentAssetStatus;
    client?: {
      id: string;
      name: string;
      displayName?: string | null;
      industry?: string | null;
      website?: string | null;
      businessDescription?: string | null;
      brandVoice?: string | null;
      brandPersonality?: string | null;
      tagline?: string | null;
      audience?: string | null;
      audienceLocations?: string | null;
      audiencePainPoints?: string | null;
      contentGoals?: string | null;
      instagramUrl?: string | null;
      youtubeUrl?: string | null;
      linkedinUrl?: string | null;
    } | null;
    campaign?: {
      id: string;
      name: string;
      status: string;
      campaignType?: string | null;
      goal?: string | null;
      keyMessage?: string | null;
      cta?: string | null;
    } | null;
    workflowInstances?: Array<{
      currentStep?: { stage: ContentStage } | null;
      currentTask?: {
        submissions?: Array<{
          id: string;
          submissionType: string;
          version: number;
          body?: string | null;
          externalLink?: string | null;
          status: string;
          createdAt: Date;
        }>;
      } | null;
      tasks?: Array<{
        submissions?: Array<{
          id: string;
          submissionType: string;
          version: number;
          body?: string | null;
          externalLink?: string | null;
          status: string;
          createdAt: Date;
        }>;
      }>;
      transitions?: Array<{ toStage: ContentStage | null }>;
    }>;
  }>(asset: T) {
    const workflow = asset.workflowInstances?.[0];
    const latestSubmission = this.latestWorkflowSubmission(workflow);
    const stage = this.projectContentStage(asset.status, workflow?.currentStep?.stage ?? workflow?.transitions?.[0]?.toStage ?? null);
    const { workflowInstances, client, campaign, ...contentAsset } = asset;
    return {
      ...contentAsset,
      stage,
      ...(latestSubmission
        ? {
            latestSubmission: {
              id: latestSubmission.id,
              submissionType: latestSubmission.submissionType,
              version: latestSubmission.version,
              body: latestSubmission.body,
              externalLink: latestSubmission.externalLink,
              status: latestSubmission.status,
              createdAt: latestSubmission.createdAt,
            },
          }
        : {}),
      ...(client ? { clientSummary: this.clientWorkSummary(client) } : {}),
      ...(campaign
        ? {
            campaignSummary: {
              id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              campaignType: campaign.campaignType,
              goal: campaign.goal,
              keyMessage: campaign.keyMessage,
              cta: campaign.cta,
            },
          }
        : {}),
    };
  }

  private latestWorkflowSubmission(workflow?: {
    currentTask?: {
      submissions?: Array<{
        id: string;
        submissionType: string;
        version: number;
        body?: string | null;
        externalLink?: string | null;
        status: string;
        createdAt: Date;
      }>;
    } | null;
    tasks?: Array<{
      submissions?: Array<{
        id: string;
        submissionType: string;
        version: number;
        body?: string | null;
        externalLink?: string | null;
        status: string;
        createdAt: Date;
      }>;
    }>;
  }) {
    const submissions = [
      ...(workflow?.currentTask?.submissions ?? []),
      ...(workflow?.tasks?.flatMap((task) => task.submissions ?? []) ?? []),
    ];

    return submissions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
  }

  private projectContentStage(status: ContentAssetStatus, workflowStage: ContentStage | null) {
    if (status === ContentAssetStatus.PUBLISHED || status === ContentAssetStatus.COMPLETED) {
      return ContentStage.PUBLISHED;
    }

    if (status === ContentAssetStatus.ARCHIVED || status === ContentAssetStatus.DELETED) {
      return ContentStage.ARCHIVED;
    }

    return workflowStage ?? ContentStage.IDEA;
  }

  private clientWorkSummary(client: {
    id: string;
    name: string;
    displayName?: string | null;
    industry?: string | null;
    website?: string | null;
    businessDescription?: string | null;
    brandVoice?: string | null;
    brandPersonality?: string | null;
    tagline?: string | null;
    audience?: string | null;
    audienceLocations?: string | null;
    audiencePainPoints?: string | null;
    contentGoals?: string | null;
    instagramUrl?: string | null;
    youtubeUrl?: string | null;
    linkedinUrl?: string | null;
  }) {
    return {
      id: client.id,
      name: client.displayName || client.name,
      legalName: client.name,
      industry: client.industry,
      website: client.website,
      description: client.businessDescription,
      brandVoice: client.brandVoice,
      brandPersonality: client.brandPersonality,
      tagline: client.tagline,
      audience: client.audience,
      audienceLocations: client.audienceLocations,
      audiencePainPoints: client.audiencePainPoints,
      contentGoals: client.contentGoals,
      socialLinks: {
        instagram: client.instagramUrl,
        youtube: client.youtubeUrl,
        linkedin: client.linkedinUrl,
      },
    };
  }
}
