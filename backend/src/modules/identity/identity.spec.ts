import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PasswordHasherService } from './infrastructure/password-hasher.service.js';
import { TokenService } from './infrastructure/token.service.js';
import { IdentityService } from './application/identity.service.js';
import { CurrentActorProvider } from '../../common/auth/current-actor.provider.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import {
  MOCK_CUSTOMER_ACTOR,
  MOCK_CUSTOMER_TOKEN,
  MOCK_SELLER_ACTOR,
  MOCK_SELLER_TOKEN,
  MOCK_ADMIN_ACTOR,
} from '../../common/auth/mock-tokens.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import {
  ConflictAppException,
  ForbiddenAppException,
  UnauthorizedAppException,
} from '../../common/errors/app-exception.js';
import { Reflector } from '@nestjs/core';
import { AdminController } from '../admin/api/admin.controller.js';

describe('Identity & Authentication Module', () => {
  describe('PasswordHasherService (Argon2id)', () => {
    const hasher = new PasswordHasherService();

    it('hashes passwords and successfully verifies them', async () => {
      const password = 'SecretPassword123!';
      const hash = await hasher.hash(password);
      expect(hash).toBeDefined();
      expect(hash).toContain('$argon2id$');

      const isMatch = await hasher.verify(hash, password);
      expect(isMatch).toBe(true);

      const isWrong = await hasher.verify(hash, 'WrongPassword!');
      expect(isWrong).toBe(false);
    });
  });

  describe('TokenService', () => {
    const mockJwtService: any = {
      signAsync: vi.fn().mockResolvedValue('jwt-mock-token'),
      verifyAsync: vi.fn().mockResolvedValue({
        sub: 'user-1',
        email: 'test@example.com',
        roles: ['CUSTOMER'],
        activeRole: 'CUSTOMER',
        activeProfileId: null,
      }),
    };
    const tokenService = new TokenService(mockJwtService);

    it('generates access token with claims', async () => {
      const token = await tokenService.generateAccessToken({
        userId: 'user-1',
        email: 'test@example.com',
        roles: ['CUSTOMER'],
        activeRole: 'CUSTOMER',
        activeProfileId: null,
      });
      expect(token).toBe('jwt-mock-token');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-1',
          email: 'test@example.com',
          activeRole: 'CUSTOMER',
        }),
        { expiresIn: '15m' },
      );
    });

    it('generates random refresh token and consistent hash', () => {
      const refreshToken = tokenService.generateRefreshToken();
      expect(refreshToken).toHaveLength(80); // 40 bytes hex

      const hash1 = tokenService.hashRefreshToken(refreshToken);
      const hash2 = tokenService.hashRefreshToken(refreshToken);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // sha256 hex
    });
  });

  describe('IdentityService', () => {
    let service: IdentityService;
    let userRepo: any;
    let roleRepo: any;
    let supplierRepo: any;
    let sellerRepo: any;
    let sessionRepo: any;
    let hasher: any;
    let tokenService: any;
    let auditService: any;

    beforeEach(() => {
      userRepo = {
        findOne: vi.fn(),
        create: vi.fn((entity) => ({ ...entity, id: 'user-uuid-1' })),
        save: vi.fn(async (entity) => ({ ...entity, id: entity.id || 'user-uuid-1' })),
      };
      roleRepo = {
        findOne: vi.fn(),
        create: vi.fn((entity) => ({ ...entity, id: 'role-uuid-1' })),
        save: vi.fn(async (entity) => ({ ...entity, id: 'role-uuid-1' })),
      };
      supplierRepo = {
        findOne: vi.fn(),
        create: vi.fn((entity) => ({ ...entity, id: 'supp-uuid-1' })),
        save: vi.fn(async (entity) => ({ ...entity, id: entity.id || 'supp-uuid-1' })),
      };
      sellerRepo = {
        findOne: vi.fn(),
        create: vi.fn((entity) => ({ ...entity, id: 'seller-uuid-1' })),
        save: vi.fn(async (entity) => ({ ...entity, id: entity.id || 'seller-uuid-1' })),
      };
      sessionRepo = {
        findOne: vi.fn(),
        update: vi.fn().mockResolvedValue({ affected: 1 }),
        create: vi.fn((entity) => ({ ...entity, id: 'session-uuid-1' })),
        save: vi.fn(async (entity) => ({ ...entity, id: entity.id || 'session-uuid-1' })),
      };
      hasher = {
        hash: vi.fn().mockResolvedValue('hashed-pass'),
        verify: vi.fn().mockResolvedValue(true),
      };
      tokenService = {
        generateAccessToken: vi.fn().mockResolvedValue('new-access-token'),
        generateRefreshToken: vi.fn().mockReturnValue('raw-refresh-token'),
        hashRefreshToken: vi.fn().mockReturnValue('hashed-refresh-token'),
      };
      auditService = {
        record: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      };

      service = new IdentityService(
        userRepo,
        roleRepo,
        supplierRepo,
        sellerRepo,
        sessionRepo,
        hasher,
        tokenService,
        auditService,
      );
    });

    it('registers user and assigns default CUSTOMER role', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.register({
        email: 'customer@example.com',
        password: 'Password123!',
      });

      expect(result.email).toBe('customer@example.com');
      expect(result.roles).toContain('CUSTOMER');
      expect(hasher.hash).toHaveBeenCalledWith('Password123!');
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('rejects registration if email already exists with 409 EMAIL_IN_USE', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'existing', email: 'taken@example.com' });

      await expect(
        service.register({
          email: 'taken@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictAppException);
    });

    it('logs in user with correct credentials', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u-1',
        email: 'user@example.com',
        passwordHash: 'hashed-pass',
        status: 'ACTIVE',
        roleMemberships: [{ role: 'CUSTOMER' }],
      });
      hasher.verify.mockResolvedValue(true);

      const result = await service.login({
        email: 'user@example.com',
        password: 'Password123!',
      });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('raw-refresh-token');
      expect(result.user.activeRole).toBe('CUSTOMER');
      expect(sessionRepo.save).toHaveBeenCalled();
    });

    it('rejects login with wrong password with 401 INVALID_CREDENTIALS', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u-1',
        email: 'user@example.com',
        passwordHash: 'hashed-pass',
        status: 'ACTIVE',
      });
      hasher.verify.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'user@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedAppException);
    });

    it('rejects login when account is LOCKED with 403 ACCOUNT_LOCKED', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u-1',
        email: 'user@example.com',
        passwordHash: 'hashed-pass',
        status: 'LOCKED',
      });
      hasher.verify.mockResolvedValue(true);

      await expect(
        service.login({
          email: 'user@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ForbiddenAppException);
    });

    it('assertUserActive invalidates sessions and throws 403 when user is locked between requests', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u-1',
        status: 'LOCKED',
      });

      await expect(service.assertUserActive('u-1')).rejects.toThrow(ForbiddenAppException);
      expect(sessionRepo.update).toHaveBeenCalledWith(
        { userId: 'u-1', isRevoked: false },
        { isRevoked: true },
      );
    });

    it('refreshes token and rotates refresh session', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-1',
        userId: 'u-1',
        refreshTokenHash: 'hashed-refresh-token',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 100000),
      });
      userRepo.findOne.mockResolvedValue({
        id: 'u-1',
        email: 'user@example.com',
        status: 'ACTIVE',
        roleMemberships: [{ role: 'CUSTOMER' }],
      });

      const res = await service.refresh('raw-token');
      expect(res.accessToken).toBe('new-access-token');
      expect(res.refreshToken).toBe('raw-refresh-token');
      expect(sessionRepo.save).toHaveBeenCalledTimes(2); // Invalidate old + save new
    });

    it('switches active role to SELLER only if profile is APPROVED', async () => {
      // Case 1: Seller profile is PENDING -> throws 403 PROFILE_NOT_APPROVED
      userRepo.findOne.mockResolvedValue({
        id: 'u-1',
        email: 'user@example.com',
        roleMemberships: [{ role: 'CUSTOMER' }, { role: 'SELLER' }],
        sellerProfile: { id: 'seller-1', approvalStatus: 'PENDING' },
      });

      await expect(
        service.switchActiveRole('u-1', { role: 'SELLER' }),
      ).rejects.toThrow(ForbiddenAppException);

      // Case 2: Seller profile is APPROVED -> success
      userRepo.findOne.mockResolvedValue({
        id: 'u-1',
        email: 'user@example.com',
        roleMemberships: [{ role: 'CUSTOMER' }, { role: 'SELLER' }],
        sellerProfile: { id: 'seller-1', approvalStatus: 'APPROVED' },
      });

      const result = await service.switchActiveRole('u-1', { role: 'SELLER' });
      expect(result.activeRole).toBe('SELLER');
      expect(result.activeProfileId).toBe('seller-1');
      expect(result.accessToken).toBe('new-access-token');
    });

    it('allows Admin to approve profiles through IdentityPort and handles DECISION_CONFLICT', async () => {
      // First approval
      supplierRepo.findOne.mockResolvedValue({
        id: 'supp-1',
        legalName: 'Kho Tổng Miền Bắc',
        approvalStatus: 'PENDING',
      });

      const res = await service.approveProfile('supp-1', 'APPROVED', 'KYC_OK', 'admin-id');
      expect(res.status).toBe('APPROVED');
      expect(res.decidedAt).toBeDefined();
      expect(supplierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ approvalStatus: 'APPROVED' }),
      );

      // Idempotent repeated decision with same status
      supplierRepo.findOne.mockResolvedValue({
        id: 'supp-1',
        approvalStatus: 'APPROVED',
      });
      const idempotentRes = await service.approveProfile('supp-1', 'APPROVED');
      expect(idempotentRes.status).toBe('APPROVED');

      // Opposing decision after finalized throws 409 DECISION_CONFLICT
      await expect(service.approveProfile('supp-1', 'REJECTED')).rejects.toThrow(
        ConflictAppException,
      );
    });
  });

  describe('CurrentActorProvider Port', () => {
    const provider = new CurrentActorProvider();

    it('requireCustomer accepts CUSTOMER role and rejects others with 403', () => {
      const customerReq = { user: MOCK_CUSTOMER_ACTOR };
      expect(provider.requireCustomer(customerReq)).toEqual(MOCK_CUSTOMER_ACTOR);

      const sellerReq = { user: MOCK_SELLER_ACTOR };
      expect(() => provider.requireCustomer(sellerReq)).toThrow(ForbiddenAppException);

      const emptyReq = {};
      expect(() => provider.requireCustomer(emptyReq)).toThrow(UnauthorizedAppException);
    });

    it('requireSeller enforces SELLER role and activeProfileId', () => {
      const sellerReq = { user: MOCK_SELLER_ACTOR };
      expect(provider.requireSeller(sellerReq)).toEqual(MOCK_SELLER_ACTOR);

      const unapprovedSellerReq = {
        user: { ...MOCK_SELLER_ACTOR, activeProfileId: null },
      };
      expect(() => provider.requireSeller(unapprovedSellerReq)).toThrow(ForbiddenAppException);
    });

    it('requireAdmin enforces ADMIN role', () => {
      const adminReq = { user: MOCK_ADMIN_ACTOR };
      expect(provider.requireAdmin(adminReq)).toEqual(MOCK_ADMIN_ACTOR);

      const customerReq = { user: MOCK_CUSTOMER_ACTOR };
      expect(() => provider.requireAdmin(customerReq)).toThrow(ForbiddenAppException);
    });
  });

  describe('RolesGuard & JwtAuthGuard', () => {
    it('RolesGuard validates required roles', () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);

      const guard = new RolesGuard(reflector);

      const mockCtxAdmin: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: MOCK_ADMIN_ACTOR }),
        }),
      };
      expect(guard.canActivate(mockCtxAdmin)).toBe(true);

      const mockCtxCustomer: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: MOCK_CUSTOMER_ACTOR }),
        }),
      };
      expect(() => guard.canActivate(mockCtxCustomer)).toThrow(ForbiddenAppException);
    });

    it('JwtAuthGuard rejects unsigned mock tokens in the integrated runtime', async () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const jwtService: any = { verifyAsync: vi.fn() };
      const guard = new JwtAuthGuard(reflector, jwtService);

      const req: any = {
        headers: { authorization: `Bearer ${MOCK_CUSTOMER_TOKEN}` },
      };
      const ctx: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({ getRequest: () => req }),
      };

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedAppException);
      expect(req.user).toBeUndefined();
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(MOCK_CUSTOMER_TOKEN);
    });

    it('JwtAuthGuard checks active user status and blocks locked users', async () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const jwtService: any = {
        verifyAsync: vi.fn().mockResolvedValue({
          sub: 'locked-user-uuid',
          activeRole: 'CUSTOMER',
        }),
      };
      const userStatusValidator: any = {
        assertUserActive: vi.fn().mockRejectedValue(new ForbiddenAppException('ACCOUNT_LOCKED', 'Khóa')),
      };
      const guard = new JwtAuthGuard(reflector, jwtService, userStatusValidator);

      const req: any = {
        headers: { authorization: 'Bearer some-valid-jwt-token' },
      };
      const ctx: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({ getRequest: () => req }),
      };

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenAppException);
      expect(userStatusValidator.assertUserActive).toHaveBeenCalledWith('locked-user-uuid');
    });
  });

  describe('AdminController (admin.md contract)', () => {
    it('executes profile decision and returns standard response', async () => {
      const mockIdentityPort: any = {
        approveProfile: vi.fn().mockResolvedValue({
          profileId: 'profile-uuid-1',
          status: 'APPROVED',
          decidedAt: '2026-10-01T10:00:00Z',
        }),
      };
      const mockAuditService: any = {
        findRecent: vi.fn().mockResolvedValue([]),
      };

      const adminCtrl = new AdminController(mockIdentityPort, mockAuditService);
      const res = await adminCtrl.decideProfile(
        'profile-uuid-1',
        { role: 'SUPPLIER', decision: 'APPROVED', reasonCode: 'KYC_VERIFIED' },
        MOCK_ADMIN_ACTOR,
      );

      expect(res.profileId).toBe('profile-uuid-1');
      expect(res.approvalStatus).toBe('APPROVED');
      expect(res.decidedAt).toBe('2026-10-01T10:00:00Z');
      expect(mockIdentityPort.approveProfile).toHaveBeenCalledWith(
        'profile-uuid-1',
        'APPROVED',
        'KYC_VERIFIED',
        MOCK_ADMIN_ACTOR.userId,
      );
    });

    it('decides dispute and enforces idempotency and DECISION_CONFLICT', async () => {
      const mockIdentityPort: any = {};
      const mockAuditService: any = { record: vi.fn() };
      const adminCtrl = new AdminController(mockIdentityPort, mockAuditService);

      const reqId = '11111111-1111-4111-8111-111111111111';

      // First decision
      const first = await adminCtrl.decideDispute(
        reqId,
        { decision: 'APPROVED', reasonCode: 'DAMAGED_ITEM' },
        MOCK_ADMIN_ACTOR,
      );
      expect(first.decision).toBe('APPROVED');
      expect(first.returnRequestId).toBe(reqId);
      expect(mockAuditService.record).toHaveBeenCalledTimes(1);

      // Repeated decision is idempotent
      const repeated = await adminCtrl.decideDispute(
        reqId,
        { decision: 'APPROVED', reasonCode: 'DAMAGED_ITEM' },
        MOCK_ADMIN_ACTOR,
      );
      expect(repeated.decision).toBe('APPROVED');
      expect(mockAuditService.record).toHaveBeenCalledTimes(1); // not called again

      // Conflicting decision throws 409 DECISION_CONFLICT
      await expect(
        adminCtrl.decideDispute(
          reqId,
          { decision: 'REJECTED', reasonCode: 'FRAUD' },
          MOCK_ADMIN_ACTOR,
        ),
      ).rejects.toThrow(ConflictAppException);
    });

    it('updates user status and records audit', async () => {
      const mockIdentityPort: any = {
        setUserStatus: vi.fn().mockResolvedValue({ userId: 'user-1', status: 'LOCKED' }),
      };
      const mockAuditService: any = {};
      const adminCtrl = new AdminController(mockIdentityPort, mockAuditService);

      const res = await adminCtrl.updateUserStatus(
        'user-1',
        { status: 'LOCKED', reason: 'Violation of Terms' },
        MOCK_ADMIN_ACTOR,
      );
      expect(res.status).toBe('LOCKED');
      expect(mockIdentityPort.setUserStatus).toHaveBeenCalledWith(
        'user-1',
        'LOCKED',
        MOCK_ADMIN_ACTOR.userId,
        'Violation of Terms',
      );
    });
  });
});
