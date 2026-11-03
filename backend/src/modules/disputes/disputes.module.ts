import { Module } from '@nestjs/common';
import { DisputesService } from './disputes.service.js';
import { DatabaseModule } from '../../common/database/database.module.js';

@Module({
  imports: [DatabaseModule],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
