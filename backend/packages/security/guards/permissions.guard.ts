import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SecurityErrorCode } from "../constants/error-codes.enum";
import { IdentityContext } from "../interfaces/identity-context.interface";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: IdentityContext = request.user;

    if (!user) {
      throw new ForbiddenException({
        message: "Permission check failed: unauthenticated",
        code: SecurityErrorCode.PERMISSION_DENIED,
      });
    }

    // Owner system role bypasses permission check
    if (user.roles?.includes("OWNER") || user.role === "OWNER") {
      return true;
    }

    const userPermissions = new Set(user.permissions || []);
    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.has(perm),
    );

    if (!hasAll) {
      throw new ForbiddenException({
        message: `Missing required permission(s): ${requiredPermissions.join(", ")}`,
        code: SecurityErrorCode.PERMISSION_DENIED,
      });
    }

    return true;
  }
}
