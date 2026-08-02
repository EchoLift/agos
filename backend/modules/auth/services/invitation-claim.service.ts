import { Injectable } from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";
import { Prisma } from "@prisma/client";

interface ClaimInvitationsInput {
  authUserId: string;
  userId: string;
  emailHash: string;
  correlationId?: string;
  requestId?: string;
}

@Injectable()
export class InvitationClaimService {
  constructor(private readonly prisma: PrismaService) {}

  async claimPendingInvitationsForUser(
    input: ClaimInvitationsInput,
  ): Promise<{ claimed: number; membershipIds: string[] }> {
    return this.prisma.$transaction(async (tx) => {
      const invitations = await tx.invitation.findMany({
        where: {
          emailHash: input.emailHash,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        include: {
          roles: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const membershipIds: string[] = [];
      let claimed = 0;

      for (const invitation of invitations) {
        const accepted = await tx.invitation.updateMany({
          where: {
            id: invitation.id,
            status: "PENDING",
          },
          data: { status: "ACCEPTED" },
        });

        if (accepted.count === 0) {
          continue;
        }

        const primaryRoleId = invitation.roleId;
        const roleIds = this.uniqueRoleIds(
          primaryRoleId,
          invitation.roles.map((role) => role.roleId),
        );
        const existingMembership = await tx.membership.findUnique({
          where: {
            agencyId_userId: {
              agencyId: invitation.agencyId,
              userId: input.userId,
            },
          },
          include: { roles: true },
        });

        const membership = existingMembership
          ? await this.reactivateMembershipIfNeeded(
              tx,
              existingMembership,
              primaryRoleId,
            )
          : await tx.membership.create({
              data: {
                agencyId: invitation.agencyId,
                userId: input.userId,
                roleId: primaryRoleId,
                status: "ACTIVE",
              },
            });

        const authoritativeRoleIds = this.uniqueRoleIds(
          membership.roleId,
          roleIds,
        );
        await tx.membershipRole.createMany({
          data: authoritativeRoleIds.map((roleId) => ({
            membershipId: membership.id,
            roleId,
          })),
          skipDuplicates: true,
        });

        const eventBasePayload = {
          invitationId: invitation.id,
          agencyId: invitation.agencyId,
          membershipId: membership.id,
          userId: input.userId,
          authUserId: input.authUserId,
          roleId: primaryRoleId,
          roleIds: authoritativeRoleIds,
          requestId: input.requestId ?? null,
          correlationId: input.correlationId ?? null,
          occurredAt: new Date().toISOString(),
        };

        await tx.outboxEvent.createMany({
          data: [
            {
              agencyId: invitation.agencyId,
              aggregateId: invitation.id,
              aggregateType: "Invitation",
              eventType: "InvitationAccepted",
              payload: eventBasePayload,
              correlationId: input.correlationId,
            },
            {
              agencyId: invitation.agencyId,
              aggregateId: membership.id,
              aggregateType: "Membership",
              eventType: existingMembership
                ? "MemberInvitationClaimed"
                : "MemberJoined",
              payload: eventBasePayload,
              correlationId: input.correlationId,
            },
          ],
        });

        claimed += 1;
        membershipIds.push(membership.id);
      }

      return { claimed, membershipIds };
    });
  }

  private async reactivateMembershipIfNeeded(
    tx: Prisma.TransactionClient,
    membership: {
      id: string;
      roleId: string;
      status: string;
      deletedAt: Date | null;
    },
    fallbackRoleId: string,
  ) {
    if (membership.status === "ACTIVE" && !membership.deletedAt) {
      return membership;
    }

    return tx.membership.update({
      where: { id: membership.id },
      data: {
        status: "ACTIVE",
        deletedAt: null,
        roleId: membership.roleId ?? fallbackRoleId,
        version: { increment: 1 },
      },
    });
  }

  private uniqueRoleIds(primaryRoleId: string, roleIds: string[]) {
    return [...new Set([primaryRoleId, ...roleIds].filter(Boolean))];
  }
}
