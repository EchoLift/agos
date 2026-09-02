import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "@packages/database/prisma.service";
import { SecurityErrorCode } from "@packages/security/constants/error-codes.enum";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: IdentityContext | undefined = request.user;
    const platformUser = user?.userId
      ? await this.prisma.user.findUnique({
          where: { id: user.userId },
          select: { platformRole: true, deletedAt: true },
        })
      : null;

    if (
      !platformUser ||
      platformUser.deletedAt ||
      platformUser.platformRole !== "ADMIN"
    ) {
      throw new ForbiddenException({
        message: "Platform administrator access required.",
        code: SecurityErrorCode.PLATFORM_ADMIN_REQUIRED,
      });
    }
    return true;
  }
}
