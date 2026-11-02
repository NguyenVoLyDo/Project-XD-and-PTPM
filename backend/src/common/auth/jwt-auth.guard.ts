import { CanActivate, ExecutionContext, Injectable, Inject, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { StoreService } from '../database/store.service';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { CurrentActor, JwtPayload } from './current-actor.interface.js';
import { AppException, UnauthorizedAppException } from '../errors/app-exception.js';
import { UserStatusValidator } from './user-status-validator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Optional() @Inject(UserStatusValidator) private readonly userStatusValidator?: UserStatusValidator,
    @Optional() @Inject(StoreService) private readonly store?: StoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token && process.env.NODE_ENV !== 'production' && process.env.DEMO_AUTH_ENABLED === 'true' && !this.userStatusValidator && this.store) {
      const user = this.store.users.find(u => u.id === request.headers['x-user-id'] && u.status === 'ACTIVE');
      if (user) {
        const role = request.headers['x-role'] as CurrentActor['activeRole'];
        const membership = this.store.userRoles.some(m => m.userId === user.id && m.role === role && m.status === 'ACTIVE');
        const supplier = this.store.supplierProfiles.find(p => p.userId === user.id && p.approvalStatus === 'APPROVED');
        const seller = this.store.sellerProfiles.find(p => p.userId === user.id && p.approvalStatus === 'APPROVED');
        if (!membership || role === 'SELLER' && !seller || role === 'SUPPLIER' && !supplier) throw new AppException(403, 'ACTIVE_ROLE_REQUIRED', 'Approved role required');
        (request as any).user = this.compatibleActor({ userId: user.id, activeRole: role, activeProfileId: role === 'SELLER' ? seller!.id : role === 'SUPPLIER' ? supplier!.id : null });
        return true;
      }
    }
    if (!token) {
      throw new UnauthorizedAppException('UNAUTHORIZED', 'Chưa cung cấp token xác thực');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (!payload.sub || !['CUSTOMER', 'SELLER', 'SUPPLIER', 'ADMIN'].includes(payload.activeRole)) throw new UnauthorizedAppException('UNAUTHORIZED', 'Invalid actor');
      // Enforce docs/contracts/identity.md line 33, 52:
      // "User bị khóa giữa hai request | Session bị vô hiệu trước request nghiệp vụ tiếp theo"
      if (this.userStatusValidator) {
        await this.userStatusValidator.assertUserActive(payload.sub);
      }

      const actor: CurrentActor = {
        userId: payload.sub,
        activeRole: payload.activeRole,
        activeProfileId: payload.activeProfileId || null,
      };
      (request as any).user = this.compatibleActor(actor);
      return true;
    } catch (err: any) {
      if (err instanceof AppException) {
        throw err;
      }
      const code = err?.name === 'TokenExpiredError' ? 'SESSION_EXPIRED' : 'UNAUTHORIZED';
      throw new UnauthorizedAppException(code, 'Token không hợp lệ hoặc đã hết hạn');
    }
  }

  private compatibleActor(actor: CurrentActor) {
    return { ...actor, role: actor.activeRole,
      supplierProfileId: actor.activeRole === 'SUPPLIER' ? actor.activeProfileId : undefined,
      sellerProfileId: actor.activeRole === 'SELLER' ? actor.activeProfileId : undefined };
  }
  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    if (request.cookies && request.cookies.accessToken) {
      return request.cookies.accessToken;
    }
    return null;
  }
}
