import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import * as crypto from "crypto";
import { PrismaService } from "@packages/database/prisma.service";
import { DomainEvents } from "@packages/events/domain-event";
import { EventBusService } from "@packages/events/event-bus.service";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import {
  assertClientScope,
  isClientUser,
  requireClientScope,
} from "@packages/security/client-scope";
import { CryptoService } from "@modules/auth/services/crypto.service";
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
    @Optional()
    private readonly cryptoService?: CryptoService,
  ) {}

  async create(
    dto: CreateClientDto,
    agencyId?: string,
    actorId?: string,
    actorMembershipId?: string,
  ) {
    const resolvedAgencyId = agencyId ?? dto.agencyId;

    if (!resolvedAgencyId) {
      throw new BadRequestException("Agency context is required");
    }

    const primaryContactName = this.nullIfBlank(dto.primaryContactName);
    const primaryContactEmail = this.nullIfBlank(dto.primaryContactEmail);
    if (!primaryContactName || !primaryContactEmail) {
      throw new BadRequestException(
        "Primary contact name and email are required.",
      );
    }

    const invitePrimaryContact = dto.invitePrimaryContact !== false;
    const result = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          agencyId: resolvedAgencyId,
          name: dto.name,
          industry: dto.industry,
          ...this.optionalClientData(dto),
          status: "ACTIVE",
        },
      });

      await this.createPrimaryContact(tx, client.id, resolvedAgencyId, dto);

      const invitation = invitePrimaryContact
        ? await this.createPrimaryContactInvitation(
            tx,
            client.id,
            resolvedAgencyId,
            primaryContactEmail,
            actorMembershipId,
          )
        : null;

      return { client, invitation };
    });

    await this.eventBus.publish(DomainEvents.ClientCreated, {
      agencyId: result.client.agencyId,
      actorId: actorId ?? dto.actorId ?? null,
      payload: {
        clientId: result.client.id,
        name: result.client.name,
        primaryContactInvitationId: result.invitation?.id ?? null,
      },
    });

    return {
      ...result.client,
      primaryContactInvitationId: result.invitation?.id ?? null,
    };
  }

  private async createPrimaryContact(
    tx: any,
    clientId: string,
    agencyId: string,
    dto: CreateClientDto,
  ) {
    const primaryContactName = this.nullIfBlank(dto.primaryContactName);
    const primaryContactEmail = this.nullIfBlank(dto.primaryContactEmail);
    if (!primaryContactName || !primaryContactEmail || !this.cryptoService) {
      return null;
    }

    const emailNormalized =
      this.cryptoService.normalizeEmail(primaryContactEmail);
    const phoneNormalized = this.nullIfBlank(dto.primaryContactPhone);
    const whatsappNormalized = this.nullIfBlank(dto.primaryContactWhatsapp);

    const contact = await tx.clientContact.create({
      data: {
        agencyId,
        clientId,
        name: primaryContactName,
        designation: this.nullIfBlank(dto.primaryContactDesignation),
        emailEncrypted: this.cryptoService.encrypt(emailNormalized),
        emailHash: this.cryptoService.hashEmailLookup(emailNormalized),
        phoneEncrypted: phoneNormalized
          ? this.cryptoService.encrypt(phoneNormalized)
          : null,
        phoneHash: phoneNormalized
          ? this.cryptoService.hashLookup(phoneNormalized)
          : null,
        whatsappEncrypted: whatsappNormalized
          ? this.cryptoService.encrypt(whatsappNormalized)
          : null,
        whatsappHash: whatsappNormalized
          ? this.cryptoService.hashLookup(whatsappNormalized)
          : null,
        role: "PRIMARY",
        isPrimary: true,
        preferredContactMethod: dto.preferredContactMethod || null,
        status: "ACTIVE",
      },
    });

    await tx.outboxEvent.create({
      data: {
        agencyId,
        aggregateId: contact.id,
        aggregateType: "ClientContact",
        eventType: DomainEvents.ClientContactCreated,
        payload: {
          contactId: contact.id,
          clientId,
          name: contact.name,
          role: contact.role,
          isPrimary: contact.isPrimary,
        },
      },
    });

    return contact;
  }

  private async createPrimaryContactInvitation(
    tx: any,
    clientId: string,
    agencyId: string,
    email: string,
    invitedByMembershipId?: string,
  ) {
    if (!this.cryptoService) {
      throw new BadRequestException("Invitation encryption is not configured.");
    }
    if (!invitedByMembershipId) {
      throw new BadRequestException("Inviter membership context is required.");
    }

    const role = await tx.role.findFirst({
      where: {
        agencyId,
        deletedAt: null,
        systemRole: { key: "CLIENT" },
      },
      include: { systemRole: true },
    });
    if (!role) {
      throw new BadRequestException("CLIENT role is not configured.");
    }

    const normalizedEmail = this.cryptoService.normalizeEmail(email);
    const emailHash = this.cryptoService.hashEmailLookup(normalizedEmail);
    const invitation = await tx.invitation.create({
      data: {
        agencyId,
        clientId,
        emailHash,
        emailEncrypted: this.cryptoService.encrypt(normalizedEmail),
        roleId: role.id,
        invitedByMembershipId,
        token: crypto.randomBytes(24).toString("hex"),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "PENDING",
        roles: {
          create: [{ roleId: role.id }],
        },
      },
    });

    await tx.outboxEvent.create({
      data: {
        agencyId,
        aggregateId: invitation.id,
        aggregateType: "Invitation",
        eventType: DomainEvents.MemberInvited,
        payload: {
          invitationId: invitation.id,
          agencyId,
          emailHash,
          roleId: role.id,
          roleIds: [role.id],
          clientId,
          invitedByMembershipId,
          occurredAt: new Date().toISOString(),
        },
      },
    });

    return invitation;
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
    assertClientScope(actor, client.id);

    return this.toVisiblePlaybook(client, actor);
  }

  async findMany(agencyId: string, actor?: IdentityContext) {
    if (actor && isClientUser(actor)) {
      const clientId = requireClientScope(actor);
      return this.prisma.client.findMany({ where: { agencyId, id: clientId } });
    }

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
