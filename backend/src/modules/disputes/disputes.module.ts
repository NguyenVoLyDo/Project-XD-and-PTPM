import { Module } from '@nestjs/common';
import { DisputesController } from './api/disputes.controller';
import { DisputesService } from './application/disputes.service';
import { PaymentsModule } from '../payments/payments.module';
import { SettlementsModule } from '../settlements/settlements.module';

@Module({
  imports: [PaymentsModule, SettlementsModule],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}

