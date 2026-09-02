import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { EntitlementService } from "@modules/entitlement/entitlement.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SKIP_ENTITLEMENT_KEY } from "../decorators/skip-entitlement.decorator";
import { IdentityContext } from "../interfaces/identity-context.interface";
import { SecurityErrorCode } from "../constants/error-codes.enum";

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlementService: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bypass = this.reflector.getAllAndOverride<boolean>(
      SKIP_ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (bypass || isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user: IdentityContext | undefined = request.user;
    if (!user?.agencyId) return true;

    const access = await this.entitlementService.checkAgencyAccess(
      user.agencyId,
    );
    if (!access.allowed) {
      throw new ForbiddenException({
        message: "AGENCIE access is not active for this organisation.",
        code: SecurityErrorCode.ENTITLEMENT_REQUIRED,
        entitlement: access,
      });
    }

    return true;
  }
}
