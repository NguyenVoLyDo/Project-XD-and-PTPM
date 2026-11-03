import { Module } from '@nestjs/common';
import { SettlementsService } from './application/settlements.service';
import { SettlementsController } from './api/settlements.controller';

@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}

