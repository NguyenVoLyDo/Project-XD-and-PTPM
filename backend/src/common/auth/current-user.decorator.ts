import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentActor } from './current-actor.interface.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentActor | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user || null;
  },
);
