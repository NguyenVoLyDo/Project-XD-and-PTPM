import { Module } from '@nestjs/common';
import { AdminController } from './api/admin.controller.js';
import { IdentityModule } from '../identity/identity.module.js';
import { DisputesModule } from '../disputes/disputes.module.js';

@Module({
  imports: [IdentityModule, DisputesModule],
  controllers: [AdminController],
})
export class AdminModule { }
