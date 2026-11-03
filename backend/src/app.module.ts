import { PostgresCommerceModule } from './integration/postgres/commerce.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { FulfillmentModule } from './modules/fulfillment/fulfillment.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { HealthController } from './health/health.controller';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { User } from './modules/identity/domain/user.entity.js';
import { UserRoleMembership } from './modules/identity/domain/user-role-membership.entity.js';
import { SupplierProfile } from './modules/identity/domain/supplier-profile.entity.js';
import { SellerProfile } from './modules/identity/domain/seller-profile.entity.js';
import { UserSession } from './modules/identity/domain/user-session.entity.js';
import { AuditLog } from './common/audit/audit-log.entity.js';
import { Notification } from './modules/notifications/domain/notification.entity.js';
import { UploadController } from './common/upload/upload.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'backend/.env', '.env.example', 'backend/.env.example'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>(
          'DATABASE_URL',
          'postgres://dropconnect:change-me@localhost:5432/dropconnect',
        ),
        ssl: configService.get<string>('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        entities: [User, UserRoleMembership, SupplierProfile, SellerProfile, UserSession, AuditLog, Notification],
        synchronize: false,
      }),
    }),
    PostgresCommerceModule,
    CartModule,
    OrdersModule,
    CommonModule,
    IdentityModule,
    AdminModule,
    NotificationsModule,
    PaymentsModule,
    FulfillmentModule,
    SettlementsModule,
    DisputesModule,
  ],
  controllers: [HealthController, UploadController],
})
export class AppModule {}
