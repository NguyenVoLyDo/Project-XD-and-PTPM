import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './domain/user.entity.js';
import { UserRoleMembership } from './domain/user-role-membership.entity.js';
import { SupplierProfile } from './domain/supplier-profile.entity.js';
import { SellerProfile } from './domain/seller-profile.entity.js';
import { UserSession } from './domain/user-session.entity.js';
import { PasswordHasherService } from './infrastructure/password-hasher.service.js';
import { TokenService } from './infrastructure/token.service.js';
import { IdentityService } from './application/identity.service.js';
import { IdentityPort } from './application/ports/identity.port.js';
import { AuthController } from './api/auth.controller.js';
import { MeController } from './api/me.controller.js';
import { CurrentActorProvider } from '../../common/auth/current-actor.provider.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { UserStatusValidator } from '../../common/auth/user-status-validator.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserRoleMembership,
      SupplierProfile,
      SellerProfile,
      UserSession,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret && config.get('NODE_ENV') === 'production') throw new Error('JWT_SECRET is required');
        return { secret: secret || 'dropconnect-secret-key-development-2026', signOptions: { expiresIn: '15m' as const } };
      },
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [
    PasswordHasherService,
    TokenService,
    IdentityService,
    {
      provide: IdentityPort,
      useExisting: IdentityService,
    },
    {
      provide: UserStatusValidator,
      useExisting: IdentityService,
    },
    CurrentActorProvider,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    IdentityService,
    IdentityPort,
    UserStatusValidator,
    CurrentActorProvider,
    JwtAuthGuard,
    RolesGuard,
    PasswordHasherService,
    TokenService,
    JwtModule,
  ],
})
export class IdentityModule {}
