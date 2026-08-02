import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";
import { DomainEvents } from "@packages/events/domain-event";
import { EventBusService } from "@packages/events/event-bus.service";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

type ClientRecord = NonNullable<
  Awaited<ReturnType<PrismaService["client"]["findUnique"]>>
>;

const CLIENT_SECTIONS: Array<{
  id: string;
  title: string;
  permission: string;
  roles: string[];
  fields: Array<{ key: keyof ClientRecord; label: string }>;
}> = [
  {
    id: "general",
    title: "General",
    permission: "CLIENT_PLAYBOOK_VIEW",
    roles: [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "WRITER",
      "DOP",
      "EDITOR",
      "DESIGNER",
      "MEMBER",
    ],
    fields: [
      { key: "name", label: "Client Name" },
      { key: "displayName", label: "Display Name" },
      { key: "website", label: "Website" },
      { key: "industry", label: "Industry" },
      { key: "businessDescription", label: "Business Description" },
      { key: "businessSize", label: "Business Size" },
      { key: "startDate", label: "Start Date" },
      { key: "timezone", label: "Timezone" },
      { key: "status", label: "Status" },
    ],
  },
  {
    id: "brand",
    title: "Brand",
    permission: "CLIENT_PLAYBOOK_VIEW",
    roles: [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "WRITER",
      "DOP",
      "EDITOR",
      "DESIGNER",
      "MEMBER",
    ],
    fields: [
      { key: "brandVoice", label: "Brand Voice" },
      { key: "brandPersonality", label: "Brand Personality" },
      { key: "mission", label: "Mission" },
      { key: "vision", label: "Vision" },
      { key: "usp", label: "USP" },
      { key: "brandStory", label: "Brand Story" },
      { key: "tagline", label: "Tagline" },
      { key: "dos", label: "Do's" },
      { key: "donts", label: "Don'ts" },
      { key: "competitors", label: "Competitors" },
    ],
  },
  {
    id: "contacts",
    title: "Contacts",
    permission: "CLIENT_PLAYBOOK_VIEW",
    roles: ["OWNER", "ADMIN", "MANAGER", "WRITER"],
    fields: [
      { key: "primaryContactName", label: "Primary Contact" },
      { key: "primaryContactDesignation", label: "Designation" },
      { key: "primaryContactEmail", label: "Email" },
      { key: "primaryContactPhone", label: "Phone" },
      { key: "primaryContactWhatsapp", label: "WhatsApp" },
      { key: "preferredContactMethod", label: "Preferred Contact Method" },
      { key: "workingHours", label: "Working Hours" },
      { key: "availableDays", label: "Available Days" },
    ],
  },
  {
    id: "audience",
    title: "Audience",
    permission: "CLIENT_PLAYBOOK_VIEW",
    roles: [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "WRITER",
      "DOP",
      "EDITOR",
      "DESIGNER",
      "MEMBER",
    ],
    fields: [
      { key: "audience", label: "Primary Audience" },
      { key: "secondaryAudience", label: "Secondary Audience" },
      { key: "audienceAge", label: "Age" },
      { key: "audienceGender", label: "Gender" },
      { key: "audienceLocations", label: "Locations" },
      { key: "audienceIncome", label: "Income" },
      { key: "audienceOccupation", label: "Occupation" },
      { key: "audiencePainPoints", label: "Pain Points" },
      { key: "audienceInterests", label: "Interests" },
      { key: "buyingBehavior", label: "Buying Behaviour" },
    ],
  },
  {
    id: "social",
    title: "Social Presence",
    permission: "CLIENT_PLAYBOOK_VIEW",
    roles: [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "WRITER",
      "DOP",
      "EDITOR",
      "DESIGNER",
      "MEMBER",
    ],
    fields: [
      { key: "instagramUrl", label: "Instagram" },
      { key: "facebookUrl", label: "Facebook" },
      { key: "linkedinUrl", label: "LinkedIn" },
      { key: "youtubeUrl", label: "YouTube" },
      { key: "twitterUrl", label: "Twitter / X" },
      { key: "googleBusinessUrl", label: "Google Business" },
      { key: "whatsappBusinessNumber", label: "WhatsApp Business" },
    ],
  },
  {
    id: "strategy",
    title: "Content Strategy",
    permission: "CLIENT_PLAYBOOK_VIEW",
    roles: [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "WRITER",
      "DOP",
      "EDITOR",
      "DESIGNER",
      "MEMBER",
    ],
    fields: [
      { key: "contentGoals", label: "Goals" },
      { key: "contentTypes", label: "Content Types" },
      { key: "postingFrequency", label: "Posting Frequency" },
      { key: "deliverables", label: "Deliverables" },
    ],
  },
  {
    id: "approvals",
    title: "Approvals & Operations",
    permission: "CLIENT_APPROVAL_VIEW",
    roles: ["OWNER", "ADMIN", "MANAGER"],
    fields: [
      { key: "approvalSla", label: "Approval SLA" },
      { key: "revisionLimit", label: "Revision Limit" },
      { key: "priority", label: "Priority" },
      { key: "engagementModel", label: "Engagement Model" },
      { key: "billingCycle", label: "Billing Cycle" },
    ],
  },
  {
    id: "ai",
    title: "AI Context",
    permission: "CLIENT_AI_CONTEXT_VIEW",
    roles: ["OWNER", "ADMIN", "MANAGER"],
    fields: [
      { key: "aiWritingInstructions", label: "AI Instructions" },
      { key: "forbiddenWords", label: "Forbidden Words" },
      { key: "preferredCta", label: "Preferred CTA" },
      { key: "brandDictionary", label: "Brand Dictionary" },
      { key: "productKnowledge", label: "Product Knowledge" },
      { key: "faqs", label: "FAQs" },
    ],
  },
  {
    id: "internal",
    title: "Internal Notes",
    permission: "CLIENT_INTERNAL_VIEW",
    roles: ["OWNER", "ADMIN", "MANAGER"],
    fields: [{ key: "internalNotes", label: "Internal Notes" }],
  },
];

@Injectable()
export class ClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateClientDto, agencyId?: string, actorId?: string) {
    const resolvedAgencyId = agencyId ?? dto.agencyId;

    if (!resolvedAgencyId) {
      throw new BadRequestException("Agency context is required");
    }

    const client = await this.prisma.client.create({
      data: {
        agencyId: resolvedAgencyId,
        name: dto.name,
        industry: dto.industry,
        ...this.optionalClientData(dto),
        status: "ACTIVE",
      },
    });

    await this.eventBus.publish(DomainEvents.ClientCreated, {
      agencyId: client.agencyId,
      actorId: actorId ?? dto.actorId ?? null,
      payload: { clientId: client.id, name: client.name },
    });

    return client;
  }

  async update(
    id: string,
    dto: UpdateClientDto,
    agencyId: string,
    actorId?: string,
  ) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException("Client not found");
    }

    const client = await this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.industry ? { industry: dto.industry } : {}),
        ...this.optionalClientData(dto),
      },
    });

    await this.eventBus.publish(DomainEvents.ClientUpdated, {
      agencyId,
      actorId: actorId ?? null,
      payload: { clientId: client.id, changedFields: Object.keys(dto) },
    });

    return client;
  }

  async archive(id: string, agencyId: string, actorId?: string) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException("Client not found");
    }

    const client = await this.prisma.client.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    await this.eventBus.publish(DomainEvents.ClientArchived, {
      agencyId,
      actorId: actorId ?? null,
      payload: { clientId: client.id, status: client.status },
    });

    return client;
  }

  async restore(id: string, agencyId: string, actorId?: string) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException("Client not found");
    }

    const client = await this.prisma.client.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    await this.eventBus.publish(DomainEvents.ClientRestored, {
      agencyId,
      actorId: actorId ?? null,
      payload: { clientId: client.id, status: client.status },
    });

    return client;
  }

  async assignManager(
    id: string,
    membershipId: string,
    agencyId: string,
    actorId?: string,
  ) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing || existing.agencyId !== agencyId) {
      throw new NotFoundException("Client not found");
    }

    const client = await this.prisma.client.update({
      where: { id },
      data: { assignedManagerMembershipId: membershipId },
    });

    await this.eventBus.publish(DomainEvents.ClientManagerAssigned, {
      agencyId,
      actorId: actorId ?? null,
      payload: {
        clientId: client.id,
        assignedManagerMembershipId: membershipId,
      },
    });

    return client;
  }

  async findById(id: string, agencyId?: string, actor?: IdentityContext) {
    const client = await this.prisma.client.findUnique({ where: { id } });

    if (!client) {
      throw new NotFoundException("Client not found");
    }

    if (agencyId && client.agencyId !== agencyId) {
      throw new NotFoundException("Client not found");
    }

    return this.toVisiblePlaybook(client, actor);
  }

  async findMany(agencyId: string) {
    return this.prisma.client.findMany({ where: { agencyId } });
  }

  private nullIfBlank(value?: string | null) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private optionalClientData(dto: Partial<CreateClientDto>) {
    const textFields: Array<keyof CreateClientDto> = [
      "displayName",
      "website",
      "businessDescription",
      "businessSize",
      "brandVoice",
      "brandPersonality",
      "mission",
      "vision",
      "usp",
      "brandStory",
      "tagline",
      "dos",
      "donts",
      "audience",
      "secondaryAudience",
      "audienceAge",
      "audienceGender",
      "audienceLocations",
      "audienceIncome",
      "audienceOccupation",
      "audiencePainPoints",
      "audienceInterests",
      "buyingBehavior",
      "competitors",
      "primaryContactName",
      "primaryContactDesignation",
      "primaryContactEmail",
      "primaryContactPhone",
      "primaryContactWhatsapp",
      "preferredContactMethod",
      "workingHours",
      "availableDays",
      "instagramUrl",
      "facebookUrl",
      "linkedinUrl",
      "youtubeUrl",
      "twitterUrl",
      "googleBusinessUrl",
      "whatsappBusinessNumber",
      "contentGoals",
      "contentTypes",
      "postingFrequency",
      "approvalSla",
      "revisionLimit",
      "priority",
      "engagementModel",
      "billingCycle",
      "deliverables",
      "aiWritingInstructions",
      "forbiddenWords",
      "preferredCta",
      "brandDictionary",
      "productKnowledge",
      "faqs",
      "internalNotes",
      "timezone",
    ];

    const data: Record<string, string | Date | null> = {};

    if (dto.assignedManagerMembershipId !== undefined) {
      data.assignedManagerMembershipId = dto.assignedManagerMembershipId;
    }

    textFields.forEach((field) => {
      if (dto[field] !== undefined) {
        data[field] =
          this.nullIfBlank(dto[field] as string | null | undefined) ?? null;
      }
    });

    if (dto.startDate !== undefined) {
      const normalized = this.nullIfBlank(dto.startDate);
      data.startDate = normalized ? new Date(normalized) : null;
    }

    return data;
  }

  private toVisiblePlaybook(client: ClientRecord, actor?: IdentityContext) {
    const roleKeys = new Set(
      [...(actor?.roles ?? []), actor?.role].filter(Boolean) as string[],
    );
    const permissionKeys = new Set(actor?.permissions ?? []);
    const isOwner = roleKeys.has("OWNER");
    const canEdit =
      isOwner ||
      permissionKeys.has("CLIENT_UPDATE") ||
      roleKeys.has("MANAGER") ||
      roleKeys.has("ADMIN");

    const visibleSections = CLIENT_SECTIONS.filter((section) => {
      if (isOwner) return true;
      return (
        section.roles.some((role) => roleKeys.has(role)) ||
        permissionKeys.has(section.permission)
      );
    });

    const allowedFields = new Set<keyof ClientRecord>([
      "id",
      "name",
      "status",
      "createdAt",
      "updatedAt",
    ]);
    visibleSections.forEach((section) =>
      section.fields.forEach((field) => allowedFields.add(field.key)),
    );

    const visibleClient = Object.fromEntries(
      Object.entries(client).filter(([key]) =>
        allowedFields.has(key as keyof ClientRecord),
      ),
    );

    return {
      client: visibleClient,
      sections: visibleSections.map((section) => ({
        id: section.id,
        title: section.title,
        permission: section.permission,
        fields: section.fields.map((field) => ({
          key: field.key,
          label: field.label,
          value: this.displayValue(client[field.key]),
        })),
      })),
      canEdit,
      visiblePermissions: Array.from(
        new Set(visibleSections.map((section) => section.permission)),
      ),
    };
  }

  private displayValue(value: unknown) {
    if (value === null || value === undefined || value === "") return null;
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }
}
