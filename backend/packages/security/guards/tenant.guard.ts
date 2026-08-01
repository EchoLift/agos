import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationRepository } from '@modules/organization/repositories/organization.repository';
import { SecurityContextService } from '../services/security-context.service';
import { RequestContextService } from '@packages/request-context/request-context.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SecurityErrorCode } from '../constants/error-codes.enum';
import { IdentityContext } from '../interfaces/identity-context.interface';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly organizationRepository: OrganizationRepository,
    private readonly securityContextService: SecurityContextService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: IdentityContext = request.user;

    if (!user || !user.userId) {
      return true; // JwtAuthGuard handles missing user
    }

    // Resolve agencyId in priority order: Path -> Header -> Session.
    // Header-scoped workspace APIs must not be shadowed by a stale active session agency.
    const pathAgencyId = request.params?.agencyId;
    const sessionAgencyId = request.session?.activeAgencyId;
    const headerAgencyId = this.firstHeader(request.headers['x-agency-id']);

    const resolvedAgencyId = pathAgencyId || headerAgencyId || sessionAgencyId;

    if (!resolvedAgencyId) {
      return true; // No tenant scope required for this endpoint
    }

    const membership = await this.organizationRepository.findMembership(resolvedAgencyId, user.userId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException({
        message: 'Active membership required for target agency',
        code: SecurityErrorCode.TENANT_MEMBERSHIP_MISSING,
      });
    }

    user.agencyId = resolvedAgencyId;
    user.membershipId = membership.id;
    const assignedRoles = (membership as any).roles?.length
      ? (membership as any).roles.map((item: any) => item.role)
      : [(membership as any).role];

    const roleKeys = assignedRoles
      .map((role: any) => role.systemRole?.key)
      .filter((key: unknown): key is string => typeof key === 'string');
    const permissions = [
      ...new Set(
        assignedRoles.flatMap((role: any) =>
          role.systemRole?.permissions?.map((item: any) => item.permission.key) ?? [],
        ),
      ),
    ].filter((key: unknown): key is string => typeof key === 'string');

    user.roles = roleKeys;
    user.role = roleKeys[0];
    user.permissions = permissions;

    this.securityContextService.append({
      agencyId: resolvedAgencyId,
      membershipId: membership.id,
      role: user.role,
      roles: user.roles,
      permissions: user.permissions,
    });

    this.requestContextService.append({
      agencyId: resolvedAgencyId,
      membershipId: membership.id,
    });

    return true;
  }

  private firstHeader(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
