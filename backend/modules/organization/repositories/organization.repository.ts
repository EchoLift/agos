import { Injectable } from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";
import { Agency, Membership, Role, Invitation, Prisma } from "@prisma/client";

export const SYSTEM_ROLES = {
  OWNER: "OWNER",
  CLIENT: "CLIENT",
  MANAGER: "MANAGER",
  MEMBER: "MEMBER",
};

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Seeds the system roles into the agency's roles table
  private async provisionAgencyRoles(
    tx: Prisma.TransactionClient,
    agencyId: string,
  ): Promise<Record<string, Role>> {
    const systemRoles = await tx.systemRole.findMany();
    if (systemRoles.length === 0) {
      throw new Error(
        "SystemRoles are not seeded. Cannot provision agency roles.",
      );
    }

    const createdRoles = await Promise.all(
      systemRoles.map((sr) =>
        tx.role.create({
          data: {
            agencyId,
            systemRoleId: sr.id,
            displayName: sr.displayName,
            description: sr.description,
          },
        }),
      ),
    );

    const roleMap: Record<string, Role> = {};
    for (let i = 0; i < systemRoles.length; i++) {
      roleMap[systemRoles[i].key] = createdRoles[i];
    }
    return roleMap;
  }

  async createAgencyWithOwner(
    displayName: string,
    slug: string,
    userId: string,
    authUserId: string,
    sessionId?: string,
    correlationId?: string,
  ): Promise<{ agency: Agency; membership: Membership }> {
    return this.prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: {
          name: slug, // slug is used as the canonical name (subdomain identifier)
          displayName, // human-readable display name
          slug,
        },
      });

      // Provision all system roles for this new agency
      const agencyRoles = await this.provisionAgencyRoles(tx, agency.id);
      const ownerRole = agencyRoles[SYSTEM_ROLES.OWNER];

      if (!ownerRole) {
        throw new Error("OWNER SystemRole is missing");
      }

      const membership = await tx.membership.create({
        data: {
          agencyId: agency.id,
          userId,
          roleId: ownerRole.id,
          status: "ACTIVE",
          roles: {
            create: {
              roleId: ownerRole.id,
            },
          },
        },
      });

      if (sessionId) {
        await tx.session.update({
          where: { id: sessionId },
          data: { activeAgencyId: agency.id },
        });
      }

      await tx.outboxEvent.create({
        data: {
          aggregateId: agency.id,
          aggregateType: "Agency",
          eventType: "AgencyCreated",
          payload: {
            agencyId: agency.id,
            ownerMembershipId: membership.id,
            createdBy: authUserId,
            slug: agency.slug,
            displayName: agency.displayName,
            occurredAt: new Date().toISOString(),
            correlationId,
          },
          correlationId,
        },
      });

      return { agency, membership };
    });
  }

  async findMembershipsByUserId(userId: string): Promise<any[]> {
    return this.prisma.membership.findMany({
      where: { userId, status: "ACTIVE" },
      include: {
        agency: true,
        client: { include: { primaryContactUser: true } },
        user: {
          include: {
            clientAccesses: {
              include: {
                client: {
                  include: { primaryContactUser: true },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        role: { include: { systemRole: true } },
        roles: { include: { role: { include: { systemRole: true } } } },
      },
    });
  }

  async findMembersByAgencyId(agencyId: string): Promise<any[]> {
    return this.findMembers(agencyId);
  }

  async findMembership(
    agencyId: string,
    userId: string,
  ): Promise<Membership | null> {
    return this.prisma.membership.findUnique({
      where: {
        agencyId_userId: { agencyId, userId },
      },
      include: {
        role: {
          include: {
            systemRole: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
        client: { include: { primaryContactUser: true } },
        user: {
          include: {
            clientAccesses: {
              where: { agencyId },
              include: {
                client: {
                  include: { primaryContactUser: true },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        roles: {
          include: {
            role: {
              include: {
                systemRole: {
                  include: { permissions: { include: { permission: true } } },
                },
              },
            },
          },
        },
      },
    });
  }

  async findMembershipById(
    agencyId: string,
    membershipId: string,
  ): Promise<any | null> {
    return this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        agencyId,
      },
      include: {
        role: { include: { systemRole: true } },
        client: { include: { primaryContactUser: true } },
        roles: { include: { role: { include: { systemRole: true } } } },
        user: {
          include: {
            clientAccesses: {
              where: { agencyId },
              include: {
                client: {
                  include: { primaryContactUser: true },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
  }

  async findAgencyBySlug(slug: string): Promise<Agency | null> {
    return this.prisma.agency.findUnique({
      where: { slug },
    });
  }

  async findAgencyById(id: string): Promise<Agency | null> {
    return this.prisma.agency.findUnique({
      where: { id },
    });
  }

  async findActiveSessionAgency(sessionId: string): Promise<string | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { activeAgencyId: true },
    });
    return session?.activeAgencyId ?? null;
  }

  async activateSessionAgency(
    sessionId: string,
    agencyId: string,
    membershipId: string,
    correlationId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.update({
        where: { id: sessionId },
        data: {
          activeAgencyId: agencyId,
          lastUsedAt: new Date(),
        },
      });

      await tx.outboxEvent.create({
        data: {
          agencyId,
          aggregateId: sessionId,
          aggregateType: "Session",
          eventType: "WorkspaceActivated",
          payload: {
            sessionId,
            agencyId,
            membershipId,
            occurredAt: new Date().toISOString(),
          },
          correlationId,
        },
      });

      return session;
    });
  }

  async createInvitation(
    agencyId: string,
    emailHash: string,
    roleId: string,
    invitedByMembershipId: string,
    token: string,
    expiresAt: Date,
    roleIds: string[] = [roleId],
    mobileNumber: string | null = null,
    clientId: string | null = null,
    clientIds: string[] = clientId ? [clientId] : [],
    correlationId?: string,
    emailEncrypted?: string | null,
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const uniqueRoleIds = [...new Set([roleId, ...roleIds])];
      const invitation = await tx.invitation.create({
        data: {
          agencyId,
          clientId,
          emailHash,
          emailEncrypted,
          roleId,
          invitedByMembershipId,
          token,
          expiresAt,
          mobileNumber,
          status: "PENDING",
          roles: {
            create: uniqueRoleIds.map((id) => ({ roleId: id })),
          },
        },
      });

      const uniqueClientIds = [...new Set(clientIds.filter(Boolean))];
      if (uniqueClientIds.length > 0) {
        await tx.invitationClientAccess.createMany({
          data: uniqueClientIds.map((id) => ({
            agencyId,
            invitationId: invitation.id,
            clientId: id,
          })),
          skipDuplicates: true,
        });
      }

      await tx.outboxEvent.create({
        data: {
          aggregateId: invitation.id,
          aggregateType: "Invitation",
          eventType: "MemberInvited",
          payload: {
            invitationId: invitation.id,
            agencyId,
            emailHash,
            mobileNumber,
            roleId,
            roleIds: uniqueRoleIds,
            clientId,
            clientIds: uniqueClientIds,
            invitedByMembershipId,
            occurredAt: new Date().toISOString(),
          },
          correlationId,
        },
      });

      return invitation;
    });
  }

  async findInvitationByToken(token: string): Promise<any | null> {
    return this.prisma.invitation.findFirst({
      where: {
        token,
        status: { in: ["PENDING", "ACCEPTED"] },
        expiresAt: { gt: new Date() },
      },
      include: {
        role: { include: { systemRole: true } },
        roles: { include: { role: { include: { systemRole: true } } } },
        agency: true,
        client: { include: { primaryContactUser: true } },
        clientAccesses: {
          include: { client: { include: { primaryContactUser: true } } },
        },
      },
    });
  }

  async acceptInvitation(
    invitationId: string,
    agencyId: string,
    userId: string,
    roleId: string,
    roleIds: string[] = [roleId],
    clientId: string | null = null,
    clientIds: string[] = clientId ? [clientId] : [],
    correlationId?: string,
  ): Promise<Membership> {
    return this.prisma.$transaction(async (tx) => {
      const uniqueRoleIds = [...new Set([roleId, ...roleIds])];

      const accepted = await tx.invitation.updateMany({
        where: { id: invitationId, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });

      const membership = await tx.membership.upsert({
        where: {
          agencyId_userId: { agencyId, userId },
        },
        update: {
          status: "ACTIVE",
          deletedAt: null,
          clientId,
        },
        create: {
          agencyId,
          userId,
          roleId,
          clientId,
          status: "ACTIVE",
        },
      });

      const uniqueClientIds = [...new Set(clientIds.filter(Boolean))];
      if (uniqueClientIds.length > 0) {
        await tx.clientUserAccess.createMany({
          data: uniqueClientIds.map((id) => ({
            agencyId,
            clientId: id,
            userId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.membershipRole.createMany({
        data: uniqueRoleIds.map((id) => ({
          membershipId: membership.id,
          roleId: id,
        })),
        skipDuplicates: true,
      });

      if (accepted.count > 0) {
        await tx.outboxEvent.create({
          data: {
            aggregateId: membership.id,
            aggregateType: "Membership",
            eventType: "MemberJoined",
            payload: {
              membershipId: membership.id,
              agencyId,
              userId,
              roleId,
              roleIds: uniqueRoleIds,
              clientId,
              clientIds: uniqueClientIds,
              occurredAt: new Date().toISOString(),
            },
            correlationId,
          },
        });
      }

      return tx.membership.findUniqueOrThrow({
        where: { id: membership.id },
        include: {
          role: { include: { systemRole: true } },
          client: { include: { primaryContactUser: true } },
          roles: { include: { role: { include: { systemRole: true } } } },
          user: {
            include: {
              clientAccesses: {
                where: { agencyId },
                include: {
                  client: {
                    include: { primaryContactUser: true },
                  },
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });
    });
  }

  async findRoleById(roleId: string): Promise<Role | null> {
    return this.prisma.role.findUnique({
      where: { id: roleId },
    });
  }

  async findAgencyRoleById(
    agencyId: string,
    roleId: string,
  ): Promise<any | null> {
    return this.prisma.role.findFirst({
      where: {
        id: roleId,
        agencyId,
        deletedAt: null,
      },
      include: { systemRole: true },
    });
  }

  async findAgencyRolesByIds(
    agencyId: string,
    roleIds: string[],
  ): Promise<any[]> {
    return this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
        agencyId,
        deletedAt: null,
      },
      include: { systemRole: true },
    });
  }

  async updateMembershipRole(
    agencyId: string,
    membershipId: string,
    roleId: string,
    roleIds: string[],
    version: number,
    clientId: string | null,
    clientIds: string[],
    primaryContactClientIds: string[],
    actorAuthUserId: string,
    correlationId?: string,
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const uniqueRoleIds = [...new Set([roleId, ...roleIds])];
      const updated = await tx.membership.updateMany({
        where: {
          id: membershipId,
          agencyId,
          version,
          status: "ACTIVE",
        },
        data: {
          roleId,
          clientId,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        return null;
      }

      await tx.membershipRole.deleteMany({ where: { membershipId } });
      await tx.membershipRole.createMany({
        data: uniqueRoleIds.map((id) => ({
          membershipId,
          roleId: id,
        })),
      });

      const membershipUser = await tx.membership.findUniqueOrThrow({
        where: { id: membershipId },
        select: { userId: true, user: { select: { name: true } } },
      });
      const uniqueClientIds = [...new Set(clientIds.filter(Boolean))];
      await tx.clientUserAccess.deleteMany({
        where: {
          agencyId,
          userId: membershipUser.userId,
        },
      });
      if (uniqueClientIds.length > 0) {
        await tx.clientUserAccess.createMany({
          data: uniqueClientIds.map((id) => ({
            agencyId,
            clientId: id,
            userId: membershipUser.userId,
          })),
          skipDuplicates: true,
        });
      }

      for (const id of [...new Set(primaryContactClientIds.filter(Boolean))]) {
        await tx.client.updateMany({
          where: { id, agencyId, deletedAt: null },
          data: {
            primaryContactUserId: membershipUser.userId,
            primaryContactName: membershipUser.user?.name ?? null,
          },
        });
      }

      const membership = await tx.membership.findUniqueOrThrow({
        where: { id: membershipId },
        include: {
          role: { include: { systemRole: true } },
          client: { include: { primaryContactUser: true } },
          roles: { include: { role: { include: { systemRole: true } } } },
          user: {
            include: {
              authUser: {
                select: { emailEncrypted: true },
              },
              clientAccesses: {
                where: { agencyId },
                include: {
                  client: {
                    include: { primaryContactUser: true },
                  },
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });

      await tx.outboxEvent.create({
        data: {
          agencyId,
          aggregateId: membershipId,
          aggregateType: "Membership",
          eventType: "MemberRoleChanged",
          payload: {
            membershipId,
            agencyId,
            roleId,
            roleIds: uniqueRoleIds,
            clientId,
            clientIds: uniqueClientIds,
            changedBy: actorAuthUserId,
            version: membership.version,
            occurredAt: new Date().toISOString(),
          },
          correlationId,
        },
      });

      return membership;
    });
  }

  async removeMembership(
    agencyId: string,
    membershipId: string,
    version: number,
    actorAuthUserId: string,
    correlationId?: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.membership.updateMany({
        where: {
          id: membershipId,
          agencyId,
          version,
          status: "ACTIVE",
        },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        return false;
      }

      const membershipUser = await tx.membership.findUniqueOrThrow({
        where: { id: membershipId },
        select: { userId: true },
      });
      await tx.clientUserAccess.deleteMany({
        where: { agencyId, userId: membershipUser.userId },
      });

      await tx.outboxEvent.create({
        data: {
          agencyId,
          aggregateId: membershipId,
          aggregateType: "Membership",
          eventType: "MemberRemoved",
          payload: {
            membershipId,
            agencyId,
            removedBy: actorAuthUserId,
            occurredAt: new Date().toISOString(),
          },
          correlationId,
        },
      });

      return true;
    });
  }

  async countActiveOwners(agencyId: string): Promise<number> {
    return this.prisma.membership.count({
      where: {
        agencyId,
        status: "ACTIVE",
        deletedAt: null,
        OR: [
          {
            role: {
              systemRole: {
                key: SYSTEM_ROLES.OWNER,
              },
            },
          },
          {
            roles: {
              some: {
                role: {
                  systemRole: {
                    key: SYSTEM_ROLES.OWNER,
                  },
                },
              },
            },
          },
        ],
      },
    });
  }

  async findRoles(agencyId: string): Promise<any[]> {
    return this.prisma.role.findMany({
      where: { agencyId },
      include: { systemRole: true },
      orderBy: { displayName: "asc" },
    });
  }

  async findMembers(agencyId: string): Promise<any[]> {
    return this.prisma.membership.findMany({
      where: { agencyId, status: "ACTIVE" },
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true,
            authUser: { select: { emailEncrypted: true } },
            clientAccesses: {
              where: { agencyId },
              include: {
                client: {
                  include: { primaryContactUser: true },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        role: { include: { systemRole: true } },
        client: { include: { primaryContactUser: true } },
        roles: { include: { role: { include: { systemRole: true } } } },
      },
      orderBy: { joinedAt: "desc" },
    });
  }
}
