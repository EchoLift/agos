import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from '@modules/auth/services/token.service';
import { AuthUserRepository } from '@modules/auth/repositories/auth-user.repository';
import { UserLookupService } from '@modules/user/services/user-lookup.service';
import { SecurityContextService } from '../services/security-context.service';
import { RequestContextService } from '@packages/request-context/request-context.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SecurityErrorCode } from '../constants/error-codes.enum';
import { IdentityContext } from '../interfaces/identity-context.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly authUserRepository: AuthUserRepository,
    private readonly userLookupService: UserLookupService,
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
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        message: 'Missing or invalid Authorization header',
        code: SecurityErrorCode.AUTH_TOKEN_MISSING,
      });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;

    try {
      payload = this.tokenService.verifyAccessToken(token);
    } catch (e: any) {
      const code = e?.name === 'TokenExpiredError'
        ? SecurityErrorCode.AUTH_TOKEN_EXPIRED
        : SecurityErrorCode.AUTH_TOKEN_INVALID;
      throw new UnauthorizedException({
        message: 'Token verification failed',
        code,
      });
    }

    const authUserId = payload.sub;
    const sessionId = payload.sid;

    if (!authUserId || !sessionId) {
      throw new UnauthorizedException({
        message: 'Invalid token payload format',
        code: SecurityErrorCode.AUTH_TOKEN_INVALID,
      });
    }

    // Verify session status
    const session = await this.authUserRepository.findSessionById(sessionId);

    // If session lookup by ID fails or isn't active
    if (!session || session.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        message: 'Session has been revoked or expired',
        code: SecurityErrorCode.AUTH_SESSION_REVOKED,
      });
    }

    const user = await this.userLookupService.findByAuthUserId(authUserId);
    if (!user) {
      throw new UnauthorizedException({
        message: 'User profile not found',
        code: SecurityErrorCode.AUTH_TOKEN_INVALID,
      });
    }

    const identity: IdentityContext = {
      authUserId,
      userId: user.id,
      sessionId: session.id,
      permissions: [],
    };

    request.user = identity;
    request.session = session;
    this.securityContextService.run(identity, () => {});
    this.requestContextService.append({ userId: user.id });

    return true;
  }
}
