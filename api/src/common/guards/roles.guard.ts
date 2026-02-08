import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../prisma/generated/client/client.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { RequestUser } from '../../auth/decorators/current-user.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: RequestUser }>();

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
