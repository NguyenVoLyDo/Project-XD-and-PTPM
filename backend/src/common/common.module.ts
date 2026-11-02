import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { CurrentActorProvider } from './auth/current-actor.provider.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { HttpExceptionFilter } from './errors/http-exception.filter.js';
import { AuditLog } from './audit/audit-log.entity.js';
import { AuditService } from './audit/audit.service.js';
import { CorrelationIdMiddleware } from './http/correlation-id.middleware.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dropconnect-secret-key-development-2026',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [
    CurrentActorProvider,
    JwtAuthGuard,
    RolesGuard,
    HttpExceptionFilter,
    AuditService,
    CorrelationIdMiddleware,
  ],
  exports: [
    CurrentActorProvider,
    JwtAuthGuard,
    RolesGuard,
    HttpExceptionFilter,
    AuditService,
    JwtModule,
    TypeOrmModule,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

