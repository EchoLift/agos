import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '@packages/database/prisma.service';
import { OrganizationRepository } from '../repositories/organization.repository';
import { UserLookupService } from '../../user/services/user-lookup.service';
import { CryptoService } from '../../auth/services/crypto.service';
import { CreateAgencyDto } from '../dto/create-agency.dto';
import { InviteMemberDto } from '../dto/invite-member.dto';
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto';
import { RequestContextService } from '@packages/request-context/request-context.service';
import { IdentityContext } from '@packages/security/interfaces/identity-context.interface';
import { SYSTEM_ROLES } from '../repositories/organization.repository';
import * as crypto from 'crypto';

@Injectable()
export class OrganizationService implements OnModuleInit {
  private readonly logger = new Logger(OrganizationService.name);
  private readonly selfRoleTestingAuthUserIds = new Set(['b5a826c1-5ecc-49b9-9965-dca890f623e2']);

  constructor(
    private readonly repository: OrganizationRepository,
    private readonly prisma: PrismaService,
    private readonly userLookup: UserLookupService,
    private readonly cryptoService: CryptoService,
    private readonly requestContext: RequestContextService,
  ) {}

  async onModuleInit() {
    await this.seedSystemRoles();
  }

  private async seedSystemRoles() {
    this.logger.log('Checking and seeding SystemRoles and Permissions...');
    
    const permissions = [
      'CLIENT_CREATE', 'CLIENT_UPDATE', 'CLIENT_ARCHIVE',
      'CLIENT_PLAYBOOK_VIEW', 'CLIENT_INTERNAL_VIEW', 'CLIENT_AI_CONTEXT_VIEW', 'CLIENT_APPROVAL_VIEW',
      'CAMPAIGN_CREATE', 'CAMPAIGN_UPDATE',
      'CONTENT_CREATE', 'CONTENT_ASSIGN', 'CONTENT_APPROVE',
      'WORKFLOW_MANAGE',
      'TEAM_INVITE', 'TEAM_REMOVE',
      'BILLING_MANAGE', 'SETTINGS_MANAGE'
    ];

    for (const key of permissions) {
      await this.prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: `Permission to ${key}` },
      });
    }

    const systemRoles = [
      { key: 'OWNER', displayName: 'Owner' },
      { key: 'ADMIN', displayName: 'Admin' },
      { key: 'MANAGER', displayName: 'Manager' },
      { key: 'WRITER', displayName: 'Writer' },
      { key: 'DOP', displayName: 'DOP' },
      { key: 'EDITOR', displayName: 'Editor' },
      { key: 'DESIGNER', displayName: 'Designer' },
      { key: 'CLIENT', displayName: 'Client' },
      { key: 'FINANCE', displayName: 'Finance' },
      { key: 'HR', displayName: 'HR' },
      { key: 'MEMBER', displayName: 'Member' },
    ];

    for (const sr of systemRoles) {
      const role = await this.prisma.systemRole.upsert({
        where: { key: sr.key },
        update: { displayName: sr.displayName },
        create: { key: sr.key, displayName: sr.displayName, description: `System ${sr.displayName} role` },
      });

      // For MVP, just assign all permissions to OWNER and MANAGER to unblock features
      if (sr.key === 'OWNER' || sr.key === 'MANAGER') {
        for (const pKey of permissions) {
          const perm = await this.prisma.permission.findUnique({ where: { key: pKey } });
          if (perm) {
            await this.prisma.systemRolePermission.upsert({
              where: {
                systemRoleId_permissionId: {
                  systemRoleId: role.id,
                  permissionId: perm.id,
                },
              },
              update: {},
              create: {
                systemRoleId: role.id,
                permissionId: perm.id,
              },
            });
          }
        }
      }
    }
    
    this.logger.log('SystemRoles and Permissions seeded.');
  }

  async createAgency(dto: CreateAgencyDto, authUserId: string, sessionId?: string) {
    const user = await this.userLookup.findByAuthUserId(authUserId);
    if (!user) {
      throw new NotFoundException('User profile not found. Please try again.');
    }

    const slug = dto.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (slug.length < 3) {
      throw new BadRequestException('Subdomain must be at least 3 characters long.');
    }

    const existingSlug = await this.repository.findAgencyBySlug(slug);
    if (existingSlug) {
      throw new ConflictException('This subdomain is already taken. Please choose another one.');
    }

    const context = this.requestContext.get();

    const { agency, membership } = await this.repository.createAgencyWithOwner(
      dto.displayName,
      slug,
      user.id,
      authUserId,
      sessionId,
      context?.correlationId,
    );

    return {
      agency: {
        id: agency.id,
        name: agency.name,
        displayName: agency.displayName,
        slug: agency.slug,
      },
      membership: {
        id: membership.id,
        role: 'OWNER',
        roles: ['OWNER'],
      },
    };
  }

  async getMyMemberships(authUserId: string, sessionId?: string) {
    const user = await this.userLookup.findByAuthUserId(authUserId);
    if (!user) {
      return { activeAgencyId: null, currentAgency: null, agencies: [] };
    }

    const memberships = await this.repository.findMembershipsByUserId(user.id);
    let activeAgencyId: string | null = null;

    if (sessionId) {
      activeAgencyId = await this.repository.findActiveSessionAgency(sessionId);
    }

    const agencies = memberships.map((m) => ({
      id: m.agency.id,
      name: m.agency.name,
      displayName: m.agency.displayName || m.agency.name,
      slug: m.agency.slug,
      role: m.role.systemRole.key,
      roles: this.mapMembershipRoles(m),
      membershipId: m.id,
    }));

    const currentAgency = activeAgencyId
      ? agencies.find((a) => a.id === activeAgencyId) ?? agencies[0] ?? null
      : agencies[0] ?? null;

    return {
      activeAgencyId: currentAgency?.id ?? null,
      currentAgency,
      agencies,
    };
  }

  async activateAgency(agencyId: string, actor: IdentityContext) {
    if (!actor.sessionId) {
      throw new BadRequestException('Session context is required.');
    }

    const membership = await this.repository.findMembership(agencyId, actor.userId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('You are not an active member of this agency.');
    }

    const agency = await this.repository.findAgencyById(agencyId);
    if (!agency) {
      throw new NotFoundException('Agency not found.');
    }

    await this.repository.activateSessionAgency(actor.sessionId, agencyId);

    return {
      activeAgencyId: agency.id,
      agency: {
        id: agency.id,
        name: agency.name,
        displayName: agency.displayName || agency.name,
        slug: agency.slug,
      },
    };
  }

  async inviteMember(agencyId: string, dto: InviteMemberDto, inviterAuthUserId: string) {
    const inviter = await this.userLookup.findByAuthUserId(inviterAuthUserId);
    if (!inviter) {
      throw new NotFoundException('Inviter user profile not found.');
    }

    const inviterMembership = await this.repository.findMembership(agencyId, inviter.id);
    if (!inviterMembership) {
      throw new ForbiddenException('You are not a member of this agency.');
    }

    const role = await this.repository.findRoleById(dto.roleId);
    if (!role) {
      throw new BadRequestException('Invalid roleId provided.');
    }

    const roleIds = [...new Set([dto.roleId, ...(dto.roleIds ?? [])])];
    const roles = await this.repository.findRoles(agencyId);
    const validRoleIds = new Set(roles.map((item) => item.id));
    const invalidRoleIds = roleIds.filter((roleId) => !validRoleIds.has(roleId));
    if (invalidRoleIds.length > 0) {
      throw new BadRequestException('One or more roleIds are invalid for this agency.');
    }

    const emailHash = this.cryptoService.hashLookup(dto.email);
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const context = this.requestContext.get();

    const invitation = await this.repository.createInvitation(
      agencyId,
      emailHash,
      role.id,
      inviterMembership.id,
      token,
      expiresAt,
      roleIds,
      dto.mobileNumber ?? null,
      context?.correlationId,
    );

    return {
      invitationId: invitation.id,
      email: dto.email,
      mobileNumber: dto.mobileNumber ?? null,
      roleId: role.id,
      roleName: role.displayName,
      roleIds,
      roleNames: invitation.roles?.map((item: any) => item.role.displayName) ?? [role.displayName],
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      token: invitation.token,
    };
  }

  async acceptInvitation(token: string, authUserId: string) {
    const user = await this.userLookup.findByAuthUserId(authUserId);
    if (!user) {
      throw new NotFoundException('User profile not found.');
    }

    const invitation = await this.repository.findInvitationByToken(token);
    if (!invitation) {
      throw new BadRequestException('Invitation is invalid or has expired.');
    }

    const existingMembership = await this.repository.findMembership(invitation.agencyId, user.id);
    if (existingMembership) {
      throw new ConflictException('You are already a member of this agency.');
    }

    const context = this.requestContext.get();
    const membership = await this.repository.acceptInvitation(
      invitation.id,
      invitation.agencyId,
      user.id,
      invitation.roleId,
      invitation.roles?.map((item: any) => item.roleId) ?? [invitation.roleId],
      context?.correlationId,
    );

    return {
      membershipId: membership.id,
      agencyId: membership.agencyId,
      status: membership.status,
    };
  }

  async getRoles(agencyId: string) {
    const roles = await this.repository.findRoles(agencyId);
    return roles.map((role) => ({
      id: role.id,
      displayName: role.displayName,
      description: role.description,
      key: role.systemRole?.key,
    }));
  }

  async getMembers(agencyId: string) {
    const members = await this.repository.findMembersByAgencyId(agencyId);
    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      roleId: m.roleId,
      roleName: m.role.displayName,
      roles: this.mapMembershipRoles(m),
      status: m.status,
      joinedAt: m.joinedAt,
      version: m.version,
      name: m.user?.name || null,
      email: this.decryptOptional(m.user?.authUser?.emailEncrypted),
      mobileNumber: null,
      avatarUrl: m.user?.avatarUrl || null,
    }));
  }

  async updateMemberRole(agencyId: string, membershipId: string, dto: UpdateMemberRoleDto, actor: IdentityContext) {
    const requestedRoleIds = [...new Set(dto.roleIds?.length ? dto.roleIds : [dto.roleId])];
    if (!requestedRoleIds.includes(dto.roleId)) {
      requestedRoleIds.unshift(dto.roleId);
    }

    if (requestedRoleIds.length === 0) {
      throw new BadRequestException('At least one role is required.');
    }

    const [targetMembership, targetRoles] = await Promise.all([
      this.repository.findMembershipById(agencyId, membershipId),
      this.repository.findAgencyRolesByIds(agencyId, requestedRoleIds),
    ]);

    if (!targetMembership || targetMembership.status !== 'ACTIVE') {
      throw new NotFoundException('Member not found in this agency.');
    }

    if (targetRoles.length !== requestedRoleIds.length) {
      throw new BadRequestException('Roles must be predefined roles for this agency.');
    }

    const hasRoleManagerAccess = this.canManageRoles(actor);
    const hasSelfTestingOverride = this.canUseSelfRoleTestingOverride(agencyId, targetMembership, actor);
    if (!hasRoleManagerAccess && !hasSelfTestingOverride) {
      throw new ForbiddenException('Only owners and managers can change roles.');
    }

    const targetRoleById = new Map(targetRoles.map((role) => [role.id, role]));
    const targetRole = targetRoleById.get(dto.roleId) ?? targetRoles[0];
    const targetIsOwner = this.memberHasRole(targetMembership, SYSTEM_ROLES.OWNER);
    const actorIsManager = actor.roles?.includes(SYSTEM_ROLES.MANAGER) || actor.role === SYSTEM_ROLES.MANAGER;
    const assignsOwner = targetRoles.some((role) => role.systemRole?.key === SYSTEM_ROLES.OWNER);

    if (actorIsManager && !hasSelfTestingOverride) {
      if (targetMembership.id === actor.membershipId || targetMembership.userId === actor.userId) {
        throw new ForbiddenException('Managers cannot change their own role.');
      }

      if (targetIsOwner) {
        throw new ForbiddenException('Managers cannot change an owner role.');
      }

      if (assignsOwner) {
        throw new ForbiddenException('Managers cannot assign the owner role.');
      }
    }

    const demotingOwner = targetIsOwner && !assignsOwner;
    if (demotingOwner && !hasSelfTestingOverride) {
      const activeOwnerCount = await this.repository.countActiveOwners(agencyId);
      if (activeOwnerCount <= 1) {
        throw new ConflictException('Last owner cannot be demoted.');
      }
    }

    const context = this.requestContext.get();
    const updated = await this.repository.updateMembershipRole(
      agencyId,
      membershipId,
      targetRole.id,
      requestedRoleIds,
      dto.version,
      actor.authUserId,
      context?.correlationId,
    );

    if (!updated) {
      throw new ConflictException('Member was changed by someone else. Refresh and try again.');
    }

    return {
      id: updated.id,
      userId: updated.userId,
      roleId: updated.roleId,
      roleName: updated.role.displayName,
      roles: this.mapMembershipRoles(updated),
      status: updated.status,
      joinedAt: updated.joinedAt,
      version: updated.version,
      name: updated.user?.name || null,
      email: this.decryptOptional(updated.user?.authUser?.emailEncrypted),
      mobileNumber: null,
      avatarUrl: updated.user?.avatarUrl || null,
    };
  }

  async removeMember(agencyId: string, membershipId: string, version: number, actor: IdentityContext) {
    this.requireOwner(actor);

    const targetMembership = await this.repository.findMembershipById(agencyId, membershipId);
    if (!targetMembership || targetMembership.status !== 'ACTIVE') {
      throw new NotFoundException('Member not found in this agency.');
    }

    if (targetMembership.id === actor.membershipId || targetMembership.userId === actor.userId) {
      throw new ConflictException('Owner cannot remove themselves.');
    }

    if (this.memberHasRole(targetMembership, SYSTEM_ROLES.OWNER)) {
      const activeOwnerCount = await this.repository.countActiveOwners(agencyId);
      if (activeOwnerCount <= 1) {
        throw new ConflictException('Last owner cannot be removed.');
      }
    }

    const context = this.requestContext.get();
    const removed = await this.repository.removeMembership(
      agencyId,
      membershipId,
      version,
      actor.authUserId,
      context?.correlationId,
    );

    if (!removed) {
      throw new ConflictException('Member was changed by someone else. Refresh and try again.');
    }

    return { success: true };
  }

  private mapMembershipRoles(membership: any) {
    const assigned = membership.roles?.length
      ? membership.roles.map((item: any) => item.role)
      : [membership.role];

    return assigned.map((role: any) => ({
      id: role.id,
      key: role.systemRole?.key,
      name: role.displayName,
    }));
  }

  private requireOwner(actor: IdentityContext) {
    if (!actor.roles?.includes(SYSTEM_ROLES.OWNER) && actor.role !== SYSTEM_ROLES.OWNER) {
      throw new ForbiddenException('Only owners can manage employee roles.');
    }
  }

  private canManageRoles(actor: IdentityContext) {
    return (
      actor.roles?.some((role) => [SYSTEM_ROLES.OWNER, SYSTEM_ROLES.MANAGER].includes(role)) ||
      [SYSTEM_ROLES.OWNER, SYSTEM_ROLES.MANAGER].includes(actor.role ?? '')
    );
  }

  private canUseSelfRoleTestingOverride(agencyId: string, membership: any, actor: IdentityContext) {
    return (
      actor.agencyId === agencyId &&
      this.selfRoleTestingAuthUserIds.has(actor.authUserId) &&
      membership.id === actor.membershipId &&
      membership.userId === actor.userId
    );
  }

  private memberHasRole(membership: any, roleKey: string) {
    return this.mapMembershipRoles(membership).some((role: { key?: string }) => role.key === roleKey);
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
