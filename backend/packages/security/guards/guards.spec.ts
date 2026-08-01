import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantGuard } from './tenant.guard';
import { PermissionsGuard } from './permissions.guard';
import { TokenService } from '@modules/auth/services/token.service';
import { AuthUserRepository } from '@modules/auth/repositories/auth-user.repository';
import { UserLookupService } from '@modules/user/services/user-lookup.service';
import { SecurityContextService } from '../services/security-context.service';
import { RequestContextService } from '@packages/request-context/request-context.service';
import { OrganizationRepository } from '@modules/organization/repositories/organization.repository';
import { UnauthorizedException, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { SecurityErrorCode } from '../constants/error-codes.enum';

describe('Security Guards Integration', () => {
  let jwtGuard: JwtAuthGuard;
  let tenantGuard: TenantGuard;
  let permissionsGuard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;
  let tokenService: jest.Mocked<TokenService>;
  let authUserRepository: jest.Mocked<AuthUserRepository>;
  let userLookupService: jest.Mocked<UserLookupService>;
  let organizationRepository: jest.Mocked<OrganizationRepository>;

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const mockTokenService = {
      verifyAccessToken: jest.fn(),
    };

    const mockAuthUserRepo = {
      findSessionById: jest.fn(),
    };

    const mockUserLookup = {
      findByAuthUserId: jest.fn(),
    };

    const mockOrgRepo = {
      findMembership: jest.fn(),
    };

    const mockSecurityContext = {
      run: jest.fn((ctx, cb) => cb()),
      append: jest.fn(),
    };

    const mockRequestContext = {
      append: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        TenantGuard,
        PermissionsGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: TokenService, useValue: mockTokenService },
        { provide: AuthUserRepository, useValue: mockAuthUserRepo },
        { provide: UserLookupService, useValue: mockUserLookup },
        { provide: OrganizationRepository, useValue: mockOrgRepo },
        { provide: SecurityContextService, useValue: mockSecurityContext },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    jwtGuard = module.get(JwtAuthGuard);
    tenantGuard = module.get(TenantGuard);
    permissionsGuard = module.get(PermissionsGuard);
    reflector = module.get(Reflector) as any;
    tokenService = module.get(TokenService) as any;
    authUserRepository = module.get(AuthUserRepository) as any;
    userLookupService = module.get(UserLookupService) as any;
    organizationRepository = module.get(OrganizationRepository) as any;
  });

  const createMockContext = (headers: any = {}, params: any = {}, user: any = {}, session: any = {}): ExecutionContext => {
    const req = { headers, params, user, session };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as any;
  };

  describe('JwtAuthGuard', () => {
    it('should bypass authentication if route is @Public()', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const ctx = createMockContext();
      const result = await jwtGuard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should throw AUTH_TOKEN_MISSING if Authorization header is absent', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const ctx = createMockContext();
      await expect(jwtGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw AUTH_SESSION_REVOKED if session is revoked or inactive', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      tokenService.verifyAccessToken.mockReturnValue({ sub: 'auth-1', sid: 'session-1' });
      authUserRepository.findSessionById.mockResolvedValue({ id: 'session-1', status: 'REVOKED' } as any);

      const ctx = createMockContext({ authorization: 'Bearer valid-jwt' });
      await expect(jwtGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should authenticate user and set req.user if token and session are valid', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      tokenService.verifyAccessToken.mockReturnValue({ sub: 'auth-1', sid: 'session-1' });
      authUserRepository.findSessionById.mockResolvedValue({ id: 'session-1', status: 'ACTIVE' } as any);
      userLookupService.findByAuthUserId.mockResolvedValue({ id: 'user-1', authUserId: 'auth-1' } as any);

      const ctx = createMockContext({ authorization: 'Bearer valid-jwt' });
      const result = await jwtGuard.canActivate(ctx);

      expect(result).toBe(true);
      const req = ctx.switchToHttp().getRequest();
      expect(req.user.userId).toBe('user-1');
      expect(req.user.sessionId).toBe('session-1');
    });
  });

  describe('TenantGuard', () => {
    it('should resolve agencyId in priority order (Path > Header > Session)', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      organizationRepository.findMembership.mockResolvedValue({
        id: 'mem-1',
        status: 'ACTIVE',
        role: { name: 'MANAGER' },
      } as any);

      // Path param priority check
      const ctxPath = createMockContext(
        { 'x-agency-id': 'header-agency' },
        { agencyId: 'path-agency' },
        { userId: 'user-1' },
        { activeAgencyId: 'session-agency' }
      );
      await tenantGuard.canActivate(ctxPath);
      expect(organizationRepository.findMembership).toHaveBeenCalledWith('path-agency', 'user-1');

      // Header should beat stale active session agency for workspace APIs.
      const ctxHeader = createMockContext(
        { 'x-agency-id': 'header-agency' },
        {},
        { userId: 'user-1' },
        { activeAgencyId: 'session-agency' }
      );
      await tenantGuard.canActivate(ctxHeader);
      expect(organizationRepository.findMembership).toHaveBeenCalledWith('header-agency', 'user-1');

      // Session remains the fallback when no path/header agency is present.
      const ctxSession = createMockContext(
        {},
        {},
        { userId: 'user-1' },
        { activeAgencyId: 'session-agency' }
      );
      await tenantGuard.canActivate(ctxSession);
      expect(organizationRepository.findMembership).toHaveBeenCalledWith('session-agency', 'user-1');
    });

    it('should throw TENANT_MEMBERSHIP_MISSING if user has no active membership in target agency', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      organizationRepository.findMembership.mockResolvedValue(null);

      const ctx = createMockContext({}, { agencyId: 'agency-forbidden' }, { userId: 'user-1' });
      await expect(tenantGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('PermissionsGuard', () => {
    it('should allow OWNER system role to bypass permission check', () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === 'isPublic') return false;
        if (key === 'permissions') return ['CLIENT_CREATE'];
        return undefined;
      });

      const ctx = createMockContext({}, {}, { role: 'OWNER', permissions: [] });
      const result = permissionsGuard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should throw PERMISSION_DENIED if required permission is missing', () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === 'isPublic') return false;
        if (key === 'permissions') return ['CLIENT_DELETE'];
        return undefined;
      });

      const ctx = createMockContext({}, {}, { role: 'MEMBER', permissions: ['CLIENT_READ'] });
      expect(() => permissionsGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });
});
