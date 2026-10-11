import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './common/database/database.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ListingsModule } from './modules/listings/listings.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    DatabaseModule,
    CatalogModule,
    ListingsModule,
    InventoryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
