import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { JwtPayload, RoleType } from '../../../common/auth/current-actor.interface.js';

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  async generateAccessToken(params: {
    userId: string;
    email: string;
    roles: RoleType[];
    activeRole: RoleType;
    activeProfileId: string | null;
  }): Promise<string> {
    const payload: JwtPayload = {
      sub: params.userId,
      email: params.email,
      roles: params.roles,
      activeRole: params.activeRole,
      activeProfileId: params.activeProfileId,
    };
    return this.jwtService.signAsync(payload, { expiresIn: '15m' });
  }

  generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token);
  }
}
