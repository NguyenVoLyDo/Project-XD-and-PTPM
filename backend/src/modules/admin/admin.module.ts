import { Module } from '@nestjs/common';
import { AdminController } from './api/admin.controller.js';
import { IdentityModule } from '../identity/identity.module.js';

@Module({
  imports: [IdentityModule],
  controllers: [AdminController],
})
export class AdminModule {}
