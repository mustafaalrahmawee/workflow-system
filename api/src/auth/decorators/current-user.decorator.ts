import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../../../prisma/generated/client/client.js';

export interface RequestUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    const user = request.user;

    return data ? user[data] : user;
  },
);
