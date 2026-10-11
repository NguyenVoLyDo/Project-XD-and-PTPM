import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StoreService } from '../database/store.service';
import { RoleType } from '../database/types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly store: StoreService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const customUserId = request.headers['x-user-id'] as string;
    const customRole = request.headers['x-role'] as RoleType;

    let userId: string | null = null;
    let activeRole: RoleType = customRole || 'CUSTOMER';

    if (customUserId) {
      userId = customUserId;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = this.jwtService.decode(token) as any;
        if (decoded && decoded.sub) {
          userId = decoded.sub;
          if (decoded.role) activeRole = decoded.role;
        }
      } catch {
        // fallback
      }
    }

    // Default to customer C if not specified (for convenient browsing), or reject if strict
    if (!userId) {
      const defaultCustomer = this.store.users.find(u => u.email === 'customer@gmail.com');
      userId = defaultCustomer ? defaultCustomer.id : 'u-customer-c';
    }

    const user = this.store.users.find(u => u.id === userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const suppProf = this.store.supplierProfiles.find(s => s.userId === user.id);
    const sellProf = this.store.sellerProfiles.find(s => s.userId === user.id);

    // If active role not explicitly chosen, pick highest role membership
    const memberships = this.store.userRoles.filter(r => r.userId === user.id);
    if (!customRole && memberships.length > 0) {
      if (memberships.some(m => m.role === 'ADMIN')) activeRole = 'ADMIN';
      else if (memberships.some(m => m.role === 'SUPPLIER')) activeRole = 'SUPPLIER';
      else if (memberships.some(m => m.role === 'SELLER')) activeRole = 'SELLER';
      else activeRole = 'CUSTOMER';
    }

    request.user = {
      userId: user.id,
      email: user.email,
      role: activeRole,
      supplierProfileId: suppProf?.id,
      sellerProfileId: sellProf?.id,
    };

    return true;
  }
}
