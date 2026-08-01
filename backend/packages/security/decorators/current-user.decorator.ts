import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IdentityContext } from '../interfaces/identity-context.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof IdentityContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: IdentityContext = request.user;

    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
