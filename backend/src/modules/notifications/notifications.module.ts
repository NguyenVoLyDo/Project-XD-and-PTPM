import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './domain/notification.entity.js';
import { NotificationService } from './application/notification.service.js';
import { NotificationController } from './api/notification.controller.js';
import { NotificationPort } from './application/ports/notification.port.js';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    {
      provide: NotificationPort,
      useExisting: NotificationService,
    },
  ],
  exports: [NotificationService, NotificationPort],
})
export class NotificationsModule {}
