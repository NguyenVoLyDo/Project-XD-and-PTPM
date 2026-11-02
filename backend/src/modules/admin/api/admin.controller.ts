import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  NotImplementedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/auth/roles.guard.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { CurrentActor, ApprovalStatus } from '../../../common/auth/current-actor.interface.js';
import { IdentityPort } from '../../identity/application/ports/identity.port.js';
import { AdminProfileDecisionDto } from './dtos/admin-profile-decision.dto.js';
import { AdminDisputeDecisionDto } from './dtos/admin-dispute-decision.dto.js';
import { AdminUserStatusDto } from './dtos/admin-user-status.dto.js';
import { AuditService } from '../../../common/audit/audit.service.js';

import { positiveInteger } from '../../../common/http/positive-integer';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdminController {

  constructor(
    private readonly identityPort: IdentityPort,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Approves or rejects a Supplier/Seller profile (docs/contracts/admin.md line 9)
   */
  @Post('profiles/:profileId/decision')
  @HttpCode(HttpStatus.OK)
  async decideProfile(
    @Param('profileId', new ParseUUIDPipe({ version: '4' })) profileId: string,
    @Body() dto: AdminProfileDecisionDto,
    @CurrentUser() actor: CurrentActor,
  ) {
    const result = await this.identityPort.approveProfile(
      profileId,
      dto.decision,
      dto.reasonCode,
      actor?.userId,
    );

    return {
      profileId: result.profileId,
      approvalStatus: result.status,
      decidedAt: result.decidedAt,
    };
  }

  /**
   * Approves or rejects a Dispute/ReturnRequest (docs/contracts/admin.md line 10)
   */
  @Post('disputes/:returnRequestId/decision')
  @HttpCode(HttpStatus.OK)
  async decideDispute(
    @Param('returnRequestId', new ParseUUIDPipe({ version: '4' })) returnRequestId: string,
    @Body() dto: AdminDisputeDecisionDto,
    @CurrentUser() actor: CurrentActor,
  ) {
    throw new NotImplementedException('Disputes module is not integrated; no decision has been recorded');
  }

  /**
   * Lists users for Admin management
   */
  @Get('users')
  async getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
  ) {
    return this.identityPort.listUsers(
      positiveInteger(page, 1, 1000000),
      positiveInteger(limit, 20),
      search,
      status,
      role,
    );
  }

  /**
   * Locks or unlocks a user account
   */
  @Patch('users/:userId/status')
  async updateUserStatus(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: AdminUserStatusDto,
    @CurrentUser() actor: CurrentActor,
  ) {
    return this.identityPort.setUserStatus(userId, dto.status, actor?.userId, dto.reason);
  }

  /**
   * Lists profiles for Admin moderation
   */
  @Get('profiles')
  async getProfiles(
    @Query('role') role?: 'SUPPLIER' | 'SELLER',
    @Query('status') status?: ApprovalStatus,
  ) {
    return this.identityPort.listProfiles(role, status);
  }

  /**
   * Queries audit logs with masked PII (docs/contracts/admin.md line 11)
   */
  @Get('audit')
  async getAuditLogs(
    @Query('limit') limit = 50,
    @Query('cursor') cursor?: string,
  ) {
    return this.auditService.findRecent(positiveInteger(limit, 50), cursor);
  }
}
