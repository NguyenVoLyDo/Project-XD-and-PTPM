import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../domain/notification.entity.js';
import { NotificationEvent, NotificationPort } from './ports/notification.port.js';
import {
  ForbiddenAppException,
  NotFoundAppException,
} from '../../../common/errors/app-exception.js';

@Injectable()
export class NotificationService implements NotificationPort {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  /**
   * Dispatches an in-app notification with deduplication by (eventId, recipientUserId, templateKey)
   * per docs/contracts/notifications.md line 9.
   */
  async dispatch(
    event: NotificationEvent,
  ): Promise<{ notificationId: string; deduplicated: boolean }> {
    const templateKey = event.templateKey || `tpl_${event.eventType}`;

    // Check for duplicate event
    const existing = await this.notificationRepo.findOne({
      where: {
        eventId: event.eventId,
        recipientUserId: event.recipientUserId,
        templateKey,
      },
    });

    if (existing) {
      this.logger.debug(
        `Deduplicated event ${event.eventId} for user ${event.recipientUserId}`,
      );
      return { notificationId: existing.id, deduplicated: true };
    }

    const { title, content } = this.formatContent(event.eventType, event.payload);

    const notification = this.notificationRepo.create({
      eventId: event.eventId,
      recipientUserId: event.recipientUserId,
      templateKey,
      eventType: event.eventType,
      title,
      content,
      payload: event.payload || {},
      isRead: false,
      readAt: null,
    });

    try {
      const saved = await this.notificationRepo.save(notification);
      return { notificationId: saved.id, deduplicated: false };
    } catch (error) {
      if (error.code !== '23505') throw error;
      const duplicate = await this.notificationRepo.findOne({where: {eventId: event.eventId, recipientUserId: event.recipientUserId, templateKey}});
      if (!duplicate) throw error;
      return {notificationId: duplicate.id, deduplicated: true};
    }
  }

  /**
   * Retrieves notifications for current actor's userId (docs/contracts/notifications.md line 16)
   */
  async listByUserId(userId: string, limit = 50): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { recipientUserId: userId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
    });
  }

  /**
   * Marks a notification as read idempotently, verifying ownership (docs/contracts/notifications.md line 16)
   */
  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<{ notificationId: string; isRead: boolean; readAt: string }> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundAppException(
        'NOTIFICATION_NOT_FOUND',
        'Không tìm thấy thông báo',
      );
    }

    if (notification.recipientUserId !== userId) {
      throw new ForbiddenAppException(
        'FORBIDDEN',
        'Bạn không có quyền thao tác trên thông báo này',
      );
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await this.notificationRepo.save(notification);
    }

    return {
      notificationId: notification.id,
      isRead: true,
      readAt: notification.readAt ? notification.readAt.toISOString() : new Date().toISOString(),
    };
  }

  private formatContent(
    eventType: string,
    payload: Record<string, any>,
  ): { title: string; content: string } {
    switch (eventType) {
      case 'OrderConfirmed':
        return {
          title: 'Đơn hàng đã được xác nhận',
          content: `Đơn hàng #${payload.orderId || payload.aggregateId || ''} đã được tiếp nhận thành công.`,
        };
      case 'PaymentSucceeded':
        return {
          title: 'Thanh toán thành công',
          content: `Giao dịch thanh toán cho đơn hàng đã hoàn tất.`,
        };
      case 'FulfillmentShipped':
        return {
          title: 'Đơn hàng đang được giao',
          content: `Mã vận đơn ${payload.trackingNo || ''} đang trên đường giao tới bạn.`,
        };
      case 'FulfillmentDelivered':
        return {
          title: 'Giao hàng thành công',
          content: `Đơn hàng đã được giao thành công đến địa chỉ người nhận.`,
        };
      case 'ProfileApproved':
        return {
          title: 'Hồ sơ đã được phê duyệt',
          content: `Hồ sơ ${payload.role || ''} của bạn đã được Admin phê duyệt. Bạn có thể bắt đầu hoạt động.`,
        };
      case 'ProfileRejected':
        return {
          title: 'Hồ sơ bị từ chối',
          content: `Hồ sơ ${payload.role || ''} bị từ chối. Lý do: ${payload.reason || 'Thông tin chưa đầy đủ'}.`,
        };
      default:
        return {
          title: `Thông báo hệ thống: ${eventType}`,
          content: 'Bạn có một thông báo mới từ hệ thống DropConnect.',
        };
    }
  }
}
