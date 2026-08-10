import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ClientContact, Prisma } from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";
import { DomainEvents } from "@packages/events/domain-event";
import { EventBusService } from "@packages/events/event-bus.service";
import { CryptoService } from "@modules/auth/services/crypto.service";
import { UserLookupService } from "@modules/user/services/user-lookup.service";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { CreateClientContactDto } from "./dto/create-client-contact.dto";
import { UpdateClientContactDto } from "./dto/update-client-contact.dto";

@Injectable()
export class ClientContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly userLookup: UserLookupService,
    private readonly eventBus: EventBusService,
  ) {}

  async createContact(
    clientId: string,
    dto: CreateClientContactDto,
    agencyId: string,
    actorId?: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException("Agency context is required");
    }

    if (dto.userId) {
      const user = await this.userLookup.findById(dto.userId);
      if (!user) {
        throw new NotFoundException("User profile not found for linkage");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: { id: true, agencyId: true },
      });
      if (!client || client.agencyId !== agencyId) {
        throw new NotFoundException("Client not found");
      }

      if (dto.isPrimary) {
        await tx.clientContact.updateMany({
          where: { agencyId, clientId, isPrimary: true, deletedAt: null },
          data: { isPrimary: false },
        });
      }

      const emailNormalized = dto.email
        ? this.cryptoService.normalizeEmail(dto.email)
        : null;
      const emailEncrypted = emailNormalized
        ? this.cryptoService.encrypt(emailNormalized)
        : null;
      const emailHash = emailNormalized
        ? this.cryptoService.hashEmailLookup(emailNormalized)
        : null;

      const phoneNormalized = dto.phone?.trim() || null;
      const phoneEncrypted = phoneNormalized
        ? this.cryptoService.encrypt(phoneNormalized)
        : null;
      const phoneHash = phoneNormalized
        ? this.cryptoService.hashLookup(phoneNormalized)
        : null;

      const whatsappNormalized = dto.whatsapp?.trim() || null;
      const whatsappEncrypted = whatsappNormalized
        ? this.cryptoService.encrypt(whatsappNormalized)
        : null;
      const whatsappHash = whatsappNormalized
        ? this.cryptoService.hashLookup(whatsappNormalized)
        : null;

      const contact = await tx.clientContact.create({
        data: {
          agencyId,
          clientId,
          userId: dto.userId || null,
          name: dto.name.trim(),
          designation: dto.designation?.trim() || null,
          emailEncrypted,
          emailHash,
          phoneEncrypted,
          phoneHash,
          whatsappEncrypted,
          whatsappHash,
          role: dto.role || "PRIMARY",
          isPrimary: dto.isPrimary ?? false,
          preferredContactMethod: dto.preferredContactMethod || null,
          status: "ACTIVE",
        },
      });

      await this.eventBus.publishWithinTransaction(
        tx,
        DomainEvents.ClientContactCreated,
        {
          agencyId,
          actorId: actorId ?? null,
          aggregateId: contact.id,
          aggregateType: "ClientContact",
          payload: {
            contactId: contact.id,
            clientId,
            name: contact.name,
            role: contact.role,
            isPrimary: contact.isPrimary,
          },
        },
      );

      return this.formatContactResponse(contact);
    });
  }

  async updateContact(
    clientId: string,
    contactId: string,
    dto: UpdateClientContactDto,
    agencyId: string,
    actorId?: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException("Agency context is required");
    }

    if (dto.userId) {
      const user = await this.userLookup.findById(dto.userId);
      if (!user) {
        throw new NotFoundException("User profile not found for linkage");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.clientContact.findUnique({
        where: { id: contactId },
      });
      if (
        !existing ||
        existing.agencyId !== agencyId ||
        existing.clientId !== clientId ||
        existing.deletedAt
      ) {
        throw new NotFoundException("Client contact not found");
      }

      if (dto.isPrimary === true) {
        await tx.clientContact.updateMany({
          where: {
            agencyId,
            clientId,
            isPrimary: true,
            id: { not: contactId },
            deletedAt: null,
          },
          data: { isPrimary: false },
        });
      }

      const data: Prisma.ClientContactUpdateInput = {};

      if (dto.name !== undefined) data.name = dto.name.trim();
      if (dto.designation !== undefined) {
        data.designation = dto.designation?.trim() || null;
      }
      if (dto.role !== undefined) data.role = dto.role;
      if (dto.isPrimary !== undefined) data.isPrimary = dto.isPrimary;
      if (dto.preferredContactMethod !== undefined) {
        data.preferredContactMethod = dto.preferredContactMethod;
      }
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.userId !== undefined) {
        data.user = dto.userId
          ? { connect: { id: dto.userId } }
          : { disconnect: true };
      }

      if (dto.email !== undefined) {
        const emailNorm = dto.email
          ? this.cryptoService.normalizeEmail(dto.email)
          : null;
        data.emailEncrypted = emailNorm
          ? this.cryptoService.encrypt(emailNorm)
          : null;
        data.emailHash = emailNorm
          ? this.cryptoService.hashEmailLookup(emailNorm)
          : null;
      }

      if (dto.phone !== undefined) {
        const phoneNorm = dto.phone?.trim() || null;
        data.phoneEncrypted = phoneNorm
          ? this.cryptoService.encrypt(phoneNorm)
          : null;
        data.phoneHash = phoneNorm
          ? this.cryptoService.hashLookup(phoneNorm)
          : null;
      }

      if (dto.whatsapp !== undefined) {
        const whatsappNorm = dto.whatsapp?.trim() || null;
        data.whatsappEncrypted = whatsappNorm
          ? this.cryptoService.encrypt(whatsappNorm)
          : null;
        data.whatsappHash = whatsappNorm
          ? this.cryptoService.hashLookup(whatsappNorm)
          : null;
      }

      const updated = await tx.clientContact.update({
        where: { id: contactId },
        data: {
          ...data,
          version: { increment: 1 },
        },
      });

      await this.eventBus.publishWithinTransaction(
        tx,
        DomainEvents.ClientContactUpdated,
        {
          agencyId,
          actorId: actorId ?? null,
          aggregateId: updated.id,
          aggregateType: "ClientContact",
          payload: {
            contactId: updated.id,
            clientId,
            changedFields: Object.keys(dto),
          },
        },
      );

      return this.formatContactResponse(updated);
    });
  }

  async archiveContact(
    clientId: string,
    contactId: string,
    agencyId: string,
    actorId?: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException("Agency context is required");
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.clientContact.findUnique({
        where: { id: contactId },
      });
      if (
        !existing ||
        existing.agencyId !== agencyId ||
        existing.clientId !== clientId ||
        existing.deletedAt
      ) {
        throw new NotFoundException("Client contact not found");
      }

      const archived = await tx.clientContact.update({
        where: { id: contactId },
        data: {
          status: "INACTIVE",
          deletedAt: new Date(),
          isPrimary: false,
          version: { increment: 1 },
        },
      });

      await this.eventBus.publishWithinTransaction(
        tx,
        DomainEvents.ClientContactArchived,
        {
          agencyId,
          actorId: actorId ?? null,
          aggregateId: archived.id,
          aggregateType: "ClientContact",
          payload: {
            contactId: archived.id,
            clientId,
            status: archived.status,
          },
        },
      );

      return this.formatContactResponse(archived);
    });
  }

  async linkUser(
    clientId: string,
    contactId: string,
    userId: string,
    agencyId: string,
    actorId?: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException("Agency context is required");
    }
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }

    const user = await this.userLookup.findById(userId);
    if (!user) {
      throw new NotFoundException("User profile not found for linkage");
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.clientContact.findUnique({
        where: { id: contactId },
      });
      if (
        !existing ||
        existing.agencyId !== agencyId ||
        existing.clientId !== clientId ||
        existing.deletedAt
      ) {
        throw new NotFoundException("Client contact not found");
      }

      const updated = await tx.clientContact.update({
        where: { id: contactId },
        data: {
          userId,
          version: { increment: 1 },
        },
      });

      await this.eventBus.publishWithinTransaction(
        tx,
        DomainEvents.ClientContactLinkedToUser,
        {
          agencyId,
          actorId: actorId ?? null,
          aggregateId: updated.id,
          aggregateType: "ClientContact",
          payload: { contactId: updated.id, clientId, userId },
        },
      );

      return this.formatContactResponse(updated);
    });
  }

  async findContactsByClient(
    clientId: string,
    agencyId: string,
    _actor?: IdentityContext,
  ) {
    if (!agencyId) {
      throw new BadRequestException("Agency context is required");
    }

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, agencyId: true },
    });
    if (!client || client.agencyId !== agencyId) {
      throw new NotFoundException("Client not found");
    }

    const contacts = await this.prisma.clientContact.findMany({
      where: { clientId, agencyId, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return contacts.map((contact) => this.formatContactResponse(contact));
  }

  private formatContactResponse(
    contact: ClientContact & {
      user?: {
        id: string;
        name: string | null;
        avatarUrl: string | null;
      } | null;
    },
  ) {
    return {
      id: contact.id,
      agencyId: contact.agencyId,
      clientId: contact.clientId,
      userId: contact.userId,
      name: contact.name,
      designation: contact.designation,
      email: this.decryptOptional(contact.emailEncrypted),
      phone: this.decryptOptional(contact.phoneEncrypted),
      whatsapp: this.decryptOptional(contact.whatsappEncrypted),
      role: contact.role,
      isPrimary: contact.isPrimary,
      preferredContactMethod: contact.preferredContactMethod,
      status: contact.status,
      version: contact.version,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      user: contact.user || null,
    };
  }

  private decryptOptional(value?: string | null) {
    if (!value) return null;
    try {
      return this.cryptoService.decrypt(value);
    } catch {
      return null;
    }
  }
}
