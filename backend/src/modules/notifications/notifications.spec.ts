import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from './application/notification.service.js';
import {
  ForbiddenAppException,
  NotFoundAppException,
} from '../../common/errors/app-exception.js';

describe('NotificationService (docs/contracts/notifications.md)', () => {
  let service: NotificationService;
  let notificationRepo: any;

  beforeEach(() => {
    notificationRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn((dto) => ({ ...dto, id: 'notif-uuid-1' })),
      save: vi.fn(async (entity) => ({ ...entity, id: entity.id || 'notif-uuid-1' })),
    };

    service = new NotificationService(notificationRepo);
  });

  it('dispatches new notification successfully', async () => {
    notificationRepo.findOne.mockResolvedValue(null);

    const result = await service.dispatch({
      eventId: '11111111-1111-4111-8111-111111111111',
      eventType: 'FulfillmentShipped',
      recipientUserId: 'user-1',
      payload: { trackingNo: 'TRACK-001' },
    });

    expect(result.deduplicated).toBe(false);
    expect(result.notificationId).toBe('notif-uuid-1');
    expect(notificationRepo.save).toHaveBeenCalled();
  });

  it('deduplicates events with the same eventId, recipientUserId, and templateKey', async () => {
    const existing = {
      id: 'existing-notif-id',
      eventId: '11111111-1111-4111-8111-111111111111',
      recipientUserId: 'user-1',
      templateKey: 'tpl_FulfillmentShipped',
    };
    notificationRepo.findOne.mockResolvedValue(existing);

    const result = await service.dispatch({
      eventId: '11111111-1111-4111-8111-111111111111',
      eventType: 'FulfillmentShipped',
      recipientUserId: 'user-1',
      payload: { trackingNo: 'TRACK-001' },
    });

    expect(result.deduplicated).toBe(true);
    expect(result.notificationId).toBe('existing-notif-id');
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });

  it('lists notifications by userId', async () => {
    const items = [
      { id: '1', title: 'Test 1', recipientUserId: 'user-1' },
      { id: '2', title: 'Test 2', recipientUserId: 'user-1' },
    ];
    notificationRepo.find.mockResolvedValue(items);

    const result = await service.listByUserId('user-1', 10);
    expect(result).toHaveLength(2);
    expect(notificationRepo.find).toHaveBeenCalledWith({
      where: { recipientUserId: 'user-1' },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  });

  it('marks notification as read idempotently for owner', async () => {
    const item = {
      id: 'notif-1',
      recipientUserId: 'user-1',
      isRead: false,
      readAt: null,
    };
    notificationRepo.findOne.mockResolvedValue(item);

    const res = await service.markAsRead('notif-1', 'user-1');
    expect(res.isRead).toBe(true);
    expect(item.isRead).toBe(true);
    expect(item.readAt).toBeDefined();
    expect(notificationRepo.save).toHaveBeenCalled();

    // Repeated call should be idempotent
    notificationRepo.save.mockClear();
    const res2 = await service.markAsRead('notif-1', 'user-1');
    expect(res2.isRead).toBe(true);
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });

  it('throws ForbiddenAppException if actor is not the recipient', async () => {
    const item = {
      id: 'notif-1',
      recipientUserId: 'user-other',
      isRead: false,
    };
    notificationRepo.findOne.mockResolvedValue(item);

    await expect(service.markAsRead('notif-1', 'user-1')).rejects.toThrow(
      ForbiddenAppException,
    );
  });

  it('throws NotFoundAppException if notification does not exist', async () => {
    notificationRepo.findOne.mockResolvedValue(null);

    await expect(service.markAsRead('notif-missing', 'user-1')).rejects.toThrow(
      NotFoundAppException,
    );
  });
});
