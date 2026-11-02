import { CanActivate, ExecutionContext, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { CurrentActor, JwtPayload } from './current-actor.interface.js';
import { MOCK_TOKENS_MAP } from './mock-tokens.js';
import { AppException, UnauthorizedAppException } from '../errors/app-exception.js';
import { UserStatusValidator } from './user-status-validator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    @Optional() private readonly userStatusValidator?: UserStatusValidator,
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

    if (!token) {
      throw new UnauthorizedAppException('UNAUTHORIZED', 'Chưa cung cấp token xác thực');
    }

    // Support mock tokens for cross-team integration & testing
    if (MOCK_TOKENS_MAP[token]) {
      (request as any).user = MOCK_TOKENS_MAP[token];
      return true;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

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
      (request as any).user = actor;
      return true;
    } catch (err: any) {
      if (err instanceof AppException) {
        throw err;
      }
      const code = err?.name === 'TokenExpiredError' ? 'SESSION_EXPIRED' : 'UNAUTHORIZED';
      throw new UnauthorizedAppException(code, 'Token không hợp lệ hoặc đã hết hạn');
    }
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
