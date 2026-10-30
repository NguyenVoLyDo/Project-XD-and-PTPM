import { Injectable, CanActivate, ExecutionContext, Inject, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StoreService } from '../database/store.service';
import { RoleType } from '../database/types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(StoreService) private readonly store: StoreService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers ?? {};
    let userId: string | undefined;
    let activeRole: RoleType | undefined;
    // The existing role switcher is a local demo, not production authentication.
    const demo = process.env.NODE_ENV !== 'production' && process.env.DEMO_AUTH_ENABLED !== 'false';
    if (typeof headers.authorization === 'string') {
      if (!headers.authorization.startsWith('Bearer ')) throw new UnauthorizedException('Invalid authorization');
      try {
        const payload = this.jwtService.verify(headers.authorization.slice(7));
        userId = payload.sub;
        activeRole = payload.role;
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }
    } else if (demo && typeof headers['x-user-id'] === 'string') {
      userId = headers['x-user-id'];
      activeRole = headers['x-role'];
    }
    const user = this.store.users.find((item) => item.id === userId && item.status === 'ACTIVE');
    if (!user) throw new UnauthorizedException('Authentication required');
    const memberships = this.store.userRoles.filter((item) => item.userId === user.id && item.status === 'ACTIVE');
    activeRole = activeRole ?? memberships[0]?.role;
    if (!activeRole || !memberships.some((item) => item.role === activeRole)) {
      throw new ForbiddenException('Role does not belong to this user');
    }
    const supplier = this.store.supplierProfiles.find((item) => item.userId === user.id);
    const seller = this.store.sellerProfiles.find((item) => item.userId === user.id);
    if (activeRole === 'SUPPLIER' && supplier?.approvalStatus !== 'APPROVED'
      || activeRole === 'SELLER' && seller?.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException('Approved profile required');
    }
    request.user = { userId: user.id, email: user.email, role: activeRole,
      supplierProfileId: supplier?.id, sellerProfileId: seller?.id };
    return true;
  }
}
