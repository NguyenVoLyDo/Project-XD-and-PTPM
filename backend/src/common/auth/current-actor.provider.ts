import { Injectable } from '@nestjs/common';
import { CurrentActor } from './current-actor.interface.js';
import { ForbiddenAppException, UnauthorizedAppException } from '../errors/app-exception.js';

export interface RequestWithActor {
  user?: CurrentActor;
  [key: string]: any;
}

@Injectable()
export class CurrentActorProvider {
  /**
   * Retrieves CurrentActor if present on request, otherwise null.
   */
  getActor(request: RequestWithActor): CurrentActor | null {
    return request?.user || null;
  }

  /**
   * Ensures an actor is authenticated.
   */
  requireActor(request: RequestWithActor): CurrentActor {
    const actor = this.getActor(request);
    if (!actor || !actor.userId) {
      throw new UnauthorizedAppException('UNAUTHORIZED', 'Yêu cầu đăng nhập để thực hiện thao tác này');
    }
    return actor;
  }

  /**
   * Enforces CUSTOMER active role. Throws 401 if unauthenticated, 403 ACTIVE_ROLE_REQUIRED if not customer.
   */
  requireCustomer(request: RequestWithActor): CurrentActor {
    const actor = this.requireActor(request);
    if (actor.activeRole !== 'CUSTOMER') {
      throw new ForbiddenAppException(
        'ACTIVE_ROLE_REQUIRED',
        'Cần chuyển vai trò sang CUSTOMER để thực hiện thao tác này',
      );
    }
    return actor;
  }

  /**
   * Enforces SELLER active role and approved profile.
   */
  requireSeller(request: RequestWithActor): CurrentActor {
    const actor = this.requireActor(request);
    if (actor.activeRole !== 'SELLER') {
      throw new ForbiddenAppException(
        'ACTIVE_ROLE_REQUIRED',
        'Cần chuyển vai trò sang SELLER để thực hiện thao tác này',
      );
    }
    if (!actor.activeProfileId) {
      throw new ForbiddenAppException(
        'PROFILE_NOT_APPROVED',
        'Hồ sơ người bán chưa được phê duyệt',
      );
    }
    return actor;
  }

  /**
   * Enforces SUPPLIER active role and approved profile.
   */
  requireSupplier(request: RequestWithActor): CurrentActor {
    const actor = this.requireActor(request);
    if (actor.activeRole !== 'SUPPLIER') {
      throw new ForbiddenAppException(
        'ACTIVE_ROLE_REQUIRED',
        'Cần chuyển vai trò sang SUPPLIER để thực hiện thao tác này',
      );
    }
    if (!actor.activeProfileId) {
      throw new ForbiddenAppException(
        'PROFILE_NOT_APPROVED',
        'Hồ sơ nhà cung cấp chưa được phê duyệt',
      );
    }
    return actor;
  }

  /**
   * Enforces ADMIN active role.
   */
  requireAdmin(request: RequestWithActor): CurrentActor {
    const actor = this.requireActor(request);
    if (actor.activeRole !== 'ADMIN') {
      throw new ForbiddenAppException(
        'FORBIDDEN',
        'Yêu cầu quyền quản trị viên',
      );
    }
    return actor;
  }
}
