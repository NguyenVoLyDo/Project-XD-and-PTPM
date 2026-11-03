import { Module } from '@nestjs/common';
import { FulfillmentController } from './api/fulfillment.controller';
import { FulfillmentService } from './application/fulfillment.service';
import { PaymentsModule } from '../payments/payments.module';
import { SettlementsModule } from '../settlements/settlements.module';

@Module({
  imports: [PaymentsModule, SettlementsModule],
  controllers: [FulfillmentController],
  providers: [FulfillmentService],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}

