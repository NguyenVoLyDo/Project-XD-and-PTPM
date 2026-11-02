import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { CurrentActor } from '../../../common/auth/current-actor.interface.js';
import { NotificationService } from '../application/notification.service.js';
import { positiveInteger } from '../../../common/http/positive-integer';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Retrieves notifications for CurrentActor (docs/contracts/notifications.md line 16)
   */
  @Get()
  async getNotifications(
    @CurrentUser() actor: CurrentActor,
    @Query('limit') limit = 50,
  ) {
    const notifications = await this.notificationService.listByUserId(
      actor.userId,
      positiveInteger(limit, 50),
    );

    return {
      items: notifications.map((n) => ({
        id: n.id,
        eventType: n.eventType,
        title: n.title,
        content: n.content,
        isRead: n.isRead,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      total: notifications.length,
    };
  }

  /**
   * Marks notification as read idempotently with ownership check (docs/contracts/notifications.md line 16)
   */
  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: CurrentActor,
  ) {
    return this.notificationService.markAsRead(id, actor.userId);
  }
}
