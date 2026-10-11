import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RoleType } from '../database/types';

export interface CurrentActor {
  userId: string;
  email: string;
  role: RoleType;
  supplierProfileId?: string;
  sellerProfileId?: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentActor => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
