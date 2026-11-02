export interface NotificationEvent {
  eventId: string;
  eventType: string;
  recipientUserId: string;
  templateKey?: string;
  payload: Record<string, any>;
  occurredAt?: string;
  correlationId?: string;
}

export abstract class NotificationPort {
  abstract dispatch(
    event: NotificationEvent,
  ): Promise<{ notificationId: string; deduplicated: boolean }>;
}
