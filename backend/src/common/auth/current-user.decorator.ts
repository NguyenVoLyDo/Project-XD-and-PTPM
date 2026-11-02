import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentActor as IdentityActor } from './current-actor.interface.js';
export interface CurrentActor extends IdentityActor {
  role: IdentityActor['activeRole'];
  email?: string;
  supplierProfileId?: string;
  sellerProfileId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentActor | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user || null;
  },
);
