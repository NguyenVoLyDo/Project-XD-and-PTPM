import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { StoreService } from '../../../common/database/store.service';
import { VerifiedWebhookEvent } from '../domain/payment-provider.interface';

export interface WebhookLogEntry {
  id: string;
  provider: string;
  eventId: string;
  orderId: string;
  status: string;
  signatureVerified: boolean;
  rawPayload: any;
  receivedAt: string;
  processedAt?: string;
  isDuplicate: boolean;
}

/**
 * WebhookLogService — Lưu lịch sử webhook & đảm bảo Idempotency (chống replay/trùng lặp).
 */
@Injectable()
export class WebhookLogService {
  private readonly logs: WebhookLogEntry[] = [];
  private readonly processedEventKeys = new Set<string>();

  constructor(@Inject(StoreService) private readonly store: StoreService) {}

  /**
   * Kiểm tra xem event ID này đã từng được xử lý hay chưa
   */
  isDuplicate(provider: string, eventId: string): boolean {
    const key = `${provider}:${eventId}`;
    return this.processedEventKeys.has(key);
  }

  /**
   * Ghi nhận event mới đã xử lý thành công
   */
  recordEvent(event: VerifiedWebhookEvent, provider: string): WebhookLogEntry {
    const key = `${provider}:${event.eventId}`;
    const isDuplicate = this.processedEventKeys.has(key);

    const logEntry: WebhookLogEntry = {
      id: this.store.generateUuid(),
      provider,
      eventId: event.eventId,
      orderId: event.orderId,
      status: event.status,
      signatureVerified: true,
      rawPayload: event.rawPayload,
      receivedAt: event.processedAt,
      processedAt: new Date().toISOString(),
      isDuplicate,
    };

    this.logs.unshift(logEntry);
    this.processedEventKeys.add(key);

    this.store.logAudit(
      null,
      'WEBHOOK_RECEIVED',
      'PAYMENT_WEBHOOK',
      logEntry.id,
      `Received ${provider} webhook for order ${event.orderId}. Status: ${event.status}`,
      { provider, eventId: event.eventId, status: event.status },
    );

    return logEntry;
  }

  /**
   * Lấy lịch sử webhook để audit
   */
  getRecentLogs(limit = 50): WebhookLogEntry[] {
    return this.logs.slice(0, limit);
  }
}

