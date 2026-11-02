import { DatabaseModule } from './common/database/database.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ListingsModule } from './modules/listings/listings.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { IntegrationModule } from './integration/integration.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
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
    DatabaseModule,
    CatalogModule,
    ListingsModule,
    InventoryModule,
    IntegrationModule,
    CartModule,
    OrdersModule,
    CommonModule,
    IdentityModule,
    AdminModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
