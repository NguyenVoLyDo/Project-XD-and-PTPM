import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from './common/database/database.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ListingsModule } from './modules/listings/listings.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { IntegrationModule } from './integration/integration.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { HealthController } from './health/health.controller';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { UploadController } from './common/upload/upload.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'backend/.env', '.env.example', 'backend/.env.example'],
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dropconnect_demo_secret_2026' : undefined),
    }),
    DatabaseModule,
    CatalogModule,
    ListingsModule,
    InventoryModule,
    IntegrationModule,
    CartModule,
    OrdersModule,
  ],
  providers: [JwtAuthGuard, RolesGuard],
  controllers: [HealthController, UploadController],
})
export class DemoAppModule {}
