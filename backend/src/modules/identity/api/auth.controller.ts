import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { IdentityService } from '../application/identity.service.js';
import { RegisterDto } from './dtos/register.dto.js';
import { LoginDto } from './dtos/login.dto.js';
import { Public } from '../../../common/auth/public.decorator.js';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { CurrentActor } from '../../../common/auth/current-actor.interface.js';

@Controller('api/v1/auth')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthController {
  constructor(private readonly identityService: IdentityService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.identityService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.identityService.login(dto);

    // Set HttpOnly cookie for refresh token as required by identity.md
    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      accessToken: result.accessToken,
      userId: result.user.userId,
      email: result.user.email,
      roles: result.user.roles,
      activeRole: result.user.activeRole,
      activeProfileId: result.user.activeProfileId,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rawRefreshToken = request.cookies?.refreshToken || (request.body as any)?.refreshToken;
    const result = await this.identityService.refresh(rawRefreshToken);

    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken: result.accessToken,
      activeRole: result.activeRole,
      activeProfileId: result.activeProfileId,
    };
  }

  /**
   * Logout requires active authentication (identity.md line 62: 401 nếu chưa xác thực)
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() actor: CurrentActor,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rawRefreshToken = request.cookies?.refreshToken || (request.body as any)?.refreshToken;
    await this.identityService.logout(actor?.userId, rawRefreshToken);

    response.clearCookie('refreshToken', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }
}
