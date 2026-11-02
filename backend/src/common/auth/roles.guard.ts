import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';
import { RoleType } from './current-actor.interface.js';
import { ForbiddenAppException, UnauthorizedAppException } from '../errors/app-exception.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new UnauthorizedAppException('UNAUTHORIZED', 'Chưa đăng nhập');
    }

    const hasRole = requiredRoles.includes(user.activeRole);
    if (!hasRole) {
      throw new ForbiddenAppException(
        'ACTIVE_ROLE_REQUIRED',
        `Yêu cầu vai trò: ${requiredRoles.join(', ')}. Vai trò hiện tại: ${user.activeRole}`,
      );
    }

    return true;
  }
}
