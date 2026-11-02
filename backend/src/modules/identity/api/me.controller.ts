import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IdentityService } from '../application/identity.service.js';
import { SwitchActiveRoleDto } from './dtos/switch-role.dto.js';
import { ApplyProfileDto } from './dtos/apply-profile.dto.js';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { CurrentActor } from '../../../common/auth/current-actor.interface.js';

@Controller('api/v1/me')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MeController {
  constructor(private readonly identityService: IdentityService) {}

  @Get()
  async getProfile(@CurrentUser() actor: CurrentActor) {
    return this.identityService.getMe(actor);
  }

  @Post('active-role')
  @HttpCode(HttpStatus.OK)
  async switchActiveRole(
    @CurrentUser() actor: CurrentActor,
    @Body() dto: SwitchActiveRoleDto,
  ) {
    return this.identityService.switchActiveRole(actor.userId, dto);
  }

  @Post('profile-applications')
  @HttpCode(HttpStatus.CREATED)
  async applyProfile(
    @CurrentUser() actor: CurrentActor,
    @Body() dto: ApplyProfileDto,
  ) {
    return this.identityService.applyProfile(actor.userId, dto);
  }
}
