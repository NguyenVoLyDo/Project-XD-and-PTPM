import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentActorProvider } from './auth/current-actor.provider.js';
import { HttpExceptionFilter } from './errors/http-exception.filter.js';
import { AuditLog } from './audit/audit-log.entity.js';
import { AuditService } from './audit/audit.service.js';
import { CorrelationIdMiddleware } from './http/correlation-id.middleware.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
  ],
  providers: [
    CurrentActorProvider,
    HttpExceptionFilter,
    AuditService,
    CorrelationIdMiddleware,
  ],
  exports: [
    CurrentActorProvider,
    HttpExceptionFilter,
    AuditService,
    TypeOrmModule,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
