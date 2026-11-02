import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../domain/user.entity.js';
import { UserRoleMembership } from '../domain/user-role-membership.entity.js';
import { SupplierProfile } from '../domain/supplier-profile.entity.js';
import { SellerProfile } from '../domain/seller-profile.entity.js';
import { UserSession } from '../domain/user-session.entity.js';
import { PasswordHasherService } from '../infrastructure/password-hasher.service.js';
import { TokenService } from '../infrastructure/token.service.js';
import { RegisterDto } from '../api/dtos/register.dto.js';
import { LoginDto } from '../api/dtos/login.dto.js';
import { SwitchActiveRoleDto } from '../api/dtos/switch-role.dto.js';
import { ApplyProfileDto } from '../api/dtos/apply-profile.dto.js';
import { CurrentActor, RoleType, ApprovalStatus } from '../../../common/auth/current-actor.interface.js';
import {
  ConflictAppException,
  ForbiddenAppException,
  NotFoundAppException,
  UnauthorizedAppException,
} from '../../../common/errors/app-exception.js';
import { ApproveProfileResult, IdentityPort } from './ports/identity.port.js';
import { UserStatusValidator } from '../../../common/auth/user-status-validator.js';
import { AuditService } from '../../../common/audit/audit.service.js';

@Injectable()
export class IdentityService implements IdentityPort, UserStatusValidator {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRoleMembership)
    private readonly roleRepo: Repository<UserRoleMembership>,
    @InjectRepository(SupplierProfile)
    private readonly supplierRepo: Repository<SupplierProfile>,
    @InjectRepository(SellerProfile)
    private readonly sellerRepo: Repository<SellerProfile>,
    @InjectRepository(UserSession)
    private readonly sessionRepo: Repository<UserSession>,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  /**
   * Registers a new user account with hashed password and initial role memberships
   */
  async register(dto: RegisterDto): Promise<{ userId: string; email: string; status: string; roles: RoleType[] }> {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new ConflictAppException('EMAIL_IN_USE', 'Email này đã được sử dụng');
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);
    const user = this.userRepo.create({
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      status: 'ACTIVE',
    });
    const savedUser = await this.userRepo.save(user);

    // Every user has CUSTOMER role by default. If a specific role is requested, add it as well.
    const requestedRole = dto.role || 'CUSTOMER';
    const rolesToAdd = new Set<RoleType>(['CUSTOMER']);
    rolesToAdd.add(requestedRole);

    for (const role of rolesToAdd) {
      const membership = this.roleRepo.create({
        userId: savedUser.id,
        role,
        status: 'ACTIVE',
      });
      await this.roleRepo.save(membership);
    }

    // Auto-create pending profile for Supplier or Seller per docs/README_PhamKienTrung_4_10.md line 45
    if (requestedRole === 'SUPPLIER') {
      const profile = this.supplierRepo.create({
        userId: savedUser.id,
        legalName: 'Nhà cung cấp mới',
        approvalStatus: 'PENDING',
      });
      await this.supplierRepo.save(profile);
    } else if (requestedRole === 'SELLER') {
      const profile = this.sellerRepo.create({
        userId: savedUser.id,
        displayName: 'Gian hàng mới',
        approvalStatus: 'PENDING',
      });
      await this.sellerRepo.save(profile);
    }

    return {
      userId: savedUser.id,
      email: savedUser.email,
      status: savedUser.status,
      roles: Array.from(rolesToAdd),
    };
  }

  /**
   * Authenticates user credentials, chooses activeRole, and issues access/refresh tokens
   */
  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
      userId: string;
      email: string;
      roles: RoleType[];
      activeRole: RoleType;
      activeProfileId: string | null;
    };
  }> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase().trim() },
      relations: { roleMemberships: true, supplierProfile: true, sellerProfile: true },
    });

    if (!user) {
      throw new UnauthorizedAppException('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác');
    }

    const isValid = await this.passwordHasher.verify(user.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedAppException('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác');
    }

    if (user.status === 'LOCKED') {
      throw new ForbiddenAppException('ACCOUNT_LOCKED', 'Tài khoản của bạn đã bị khóa');
    }

    const roles = user.roleMemberships?.map((m) => m.role) || ['CUSTOMER'];

    // Rule: "Login không tự chọn quyền Supplier/Seller chưa APPROVED."
    let activeRole: RoleType = 'CUSTOMER';
    let activeProfileId: string | null = null;

    if (roles.includes('CUSTOMER')) {
      activeRole = 'CUSTOMER';
      activeProfileId = null;
    } else if (roles.includes('ADMIN')) {
      activeRole = 'ADMIN';
      activeProfileId = null;
    } else if (roles.includes('SELLER') && user.sellerProfile?.approvalStatus === 'APPROVED') {
      activeRole = 'SELLER';
      activeProfileId = user.sellerProfile.id;
    } else if (roles.includes('SUPPLIER') && user.supplierProfile?.approvalStatus === 'APPROVED') {
      activeRole = 'SUPPLIER';
      activeProfileId = user.supplierProfile.id;
    }

    const accessToken = await this.tokenService.generateAccessToken({
      userId: user.id,
      email: user.email,
      roles,
      activeRole,
      activeProfileId,
    });

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.sessionRepo.save(
      this.sessionRepo.create({
        userId: user.id,
        refreshTokenHash: tokenHash,
        isRevoked: false,
        expiresAt,
      }),
    );

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        userId: user.id,
        email: user.email,
        roles,
        activeRole,
        activeProfileId,
      },
    };
  }

  /**
   * Refreshes access token with Refresh Token Rotation
   */
  async refresh(rawRefreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    activeRole: RoleType;
    activeProfileId: string | null;
  }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedAppException('SESSION_EXPIRED', 'Thiếu refresh token');
    }

    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const session = await this.sessionRepo.findOne({
      where: { refreshTokenHash: tokenHash, isRevoked: false },
      relations: { user: true },
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedAppException('SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ');
    }

    const user = await this.userRepo.findOne({
      where: { id: session.userId },
      relations: { roleMemberships: true, supplierProfile: true, sellerProfile: true },
    });

    if (!user || user.status === 'LOCKED') {
      throw new ForbiddenAppException('ACCOUNT_LOCKED', 'Tài khoản đã bị khóa');
    }

    // Invalidate old session
    session.isRevoked = true;
    await this.sessionRepo.save(session);

    // Issue new refresh token (Rotation)
    const newRefreshToken = this.tokenService.generateRefreshToken();
    const newHash = this.tokenService.hashRefreshToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.sessionRepo.save(
      this.sessionRepo.create({
        userId: user.id,
        refreshTokenHash: newHash,
        isRevoked: false,
        expiresAt: newExpiresAt,
      }),
    );

    const roles = user.roleMemberships?.map((m) => m.role) || ['CUSTOMER'];
    let activeRole: RoleType = 'CUSTOMER';
    let activeProfileId: string | null = null;

    if (roles.includes('CUSTOMER')) {
      activeRole = 'CUSTOMER';
      activeProfileId = null;
    } else if (roles.includes('ADMIN')) {
      activeRole = 'ADMIN';
      activeProfileId = null;
    } else if (roles.includes('SELLER') && user.sellerProfile?.approvalStatus === 'APPROVED') {
      activeRole = 'SELLER';
      activeProfileId = user.sellerProfile.id;
    } else if (roles.includes('SUPPLIER') && user.supplierProfile?.approvalStatus === 'APPROVED') {
      activeRole = 'SUPPLIER';
      activeProfileId = user.supplierProfile.id;
    }

    const accessToken = await this.tokenService.generateAccessToken({
      userId: user.id,
      email: user.email,
      roles,
      activeRole,
      activeProfileId,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      activeRole,
      activeProfileId,
    };
  }

  /**
   * Logs out user by revoking refresh token session
   */
  async logout(userId?: string, rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
      const session = await this.sessionRepo.findOne({
        where: { refreshTokenHash: tokenHash },
      });
      if (session) {
        session.isRevoked = true;
        await this.sessionRepo.save(session);
      }
    } else if (userId) {
      await this.sessionRepo.update({ userId, isRevoked: false }, { isRevoked: true });
    }
  }

  /**
   * Retrieves profile and actor details for CurrentActor (identity.md line 63, 71)
   */
  async getMe(actor: CurrentActor): Promise<{
    userId: string;
    email: string;
    status: string;
    roles: RoleType[];
    activeRole: RoleType;
    activeProfileId: string | null;
    profiles: {
      supplier: { id: string; legalName: string; approvalStatus: ApprovalStatus } | null;
      seller: { id: string; displayName: string; approvalStatus: ApprovalStatus } | null;
    };
  }> {
    const user = await this.userRepo.findOne({
      where: { id: actor.userId },
      relations: { roleMemberships: true, supplierProfile: true, sellerProfile: true },
    });

    if (!user) {
      throw new NotFoundAppException('USER_NOT_FOUND', 'Người dùng không tồn tại');
    }

    return {
      userId: user.id,
      email: user.email,
      status: user.status,
      roles: user.roleMemberships?.map((m) => m.role) || [],
      activeRole: actor.activeRole,
      activeProfileId: actor.activeProfileId,
      profiles: {
        supplier: user.supplierProfile
          ? {
              id: user.supplierProfile.id,
              legalName: user.supplierProfile.legalName,
              approvalStatus: user.supplierProfile.approvalStatus,
            }
          : null,
        seller: user.sellerProfile
          ? {
              id: user.sellerProfile.id,
              displayName: user.sellerProfile.displayName,
              approvalStatus: user.sellerProfile.approvalStatus,
            }
          : null,
      },
    };
  }

  /**
   * Switches active role for the current user session (identity.md line 64)
   */
  async switchActiveRole(
    userId: string,
    dto: SwitchActiveRoleDto,
  ): Promise<{ accessToken: string; userId: string; activeRole: RoleType; activeProfileId: string | null }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { roleMemberships: true, supplierProfile: true, sellerProfile: true },
    });

    if (!user) {
      throw new NotFoundAppException('USER_NOT_FOUND', 'Người dùng không tồn tại');
    }

    const roles = user.roleMemberships?.map((m) => m.role) || [];
    if (!roles.includes(dto.role)) {
      throw new ForbiddenAppException('FORBIDDEN', 'Bạn không sở hữu vai trò này');
    }

    let activeProfileId: string | null = null;

    if (dto.role === 'SELLER') {
      if (!user.sellerProfile || user.sellerProfile.approvalStatus !== 'APPROVED') {
        throw new ForbiddenAppException('PROFILE_NOT_APPROVED', 'Hồ sơ người bán chưa được phê duyệt');
      }
      activeProfileId = user.sellerProfile.id;
    } else if (dto.role === 'SUPPLIER') {
      if (!user.supplierProfile || user.supplierProfile.approvalStatus !== 'APPROVED') {
        throw new ForbiddenAppException('PROFILE_NOT_APPROVED', 'Hồ sơ nhà cung cấp chưa được phê duyệt');
      }
      activeProfileId = user.supplierProfile.id;
    }

    const accessToken = await this.tokenService.generateAccessToken({
      userId: user.id,
      email: user.email,
      roles,
      activeRole: dto.role,
      activeProfileId,
    });

    return {
      accessToken,
      userId: user.id,
      activeRole: dto.role,
      activeProfileId,
    };
  }

  /**
   * Submits a Supplier or Seller profile application (identity.md line 65)
   */
  async applyProfile(
    userId: string,
    dto: ApplyProfileDto,
  ): Promise<{ profileId: string; role: RoleType; approvalStatus: ApprovalStatus }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { supplierProfile: true, sellerProfile: true, roleMemberships: true },
    });

    if (!user) {
      throw new NotFoundAppException('USER_NOT_FOUND', 'Người dùng không tồn tại');
    }

    if (dto.role === 'SUPPLIER') {
      if (user.supplierProfile) {
        throw new ConflictAppException('PROFILE_ALREADY_EXISTS', 'Hồ sơ nhà cung cấp đã tồn tại');
      }
      const profile = this.supplierRepo.create({
        userId,
        legalName: dto.legalName || 'Nhà cung cấp mới',
        payoutAccountRef: dto.payoutAccountRef || null,
        approvalStatus: 'PENDING',
      });
      const saved = await this.supplierRepo.save(profile);

      const hasRole = user.roleMemberships?.some((m) => m.role === 'SUPPLIER');
      if (!hasRole) {
        await this.roleRepo.save(
          this.roleRepo.create({
            userId,
            role: 'SUPPLIER',
            status: 'ACTIVE',
          }),
        );
      }

      return { profileId: saved.id, role: 'SUPPLIER', approvalStatus: saved.approvalStatus };
    }

    if (dto.role === 'SELLER') {
      if (user.sellerProfile) {
        throw new ConflictAppException('PROFILE_ALREADY_EXISTS', 'Hồ sơ người bán đã tồn tại');
      }
      const profile = this.sellerRepo.create({
        userId,
        displayName: dto.displayName || 'Gian hàng mới',
        approvalStatus: 'PENDING',
      });
      const saved = await this.sellerRepo.save(profile);

      const hasRole = user.roleMemberships?.some((m) => m.role === 'SELLER');
      if (!hasRole) {
        await this.roleRepo.save(
          this.roleRepo.create({
            userId,
            role: 'SELLER',
            status: 'ACTIVE',
          }),
        );
      }

      return { profileId: saved.id, role: 'SELLER', approvalStatus: saved.approvalStatus };
    }

    throw new ForbiddenAppException('INVALID_ROLE', 'Vai trò không được hỗ trợ để mở hồ sơ');
  }

  // --- IdentityPort implementations ---

  async approveProfile(
    profileId: string,
    decision: 'APPROVED' | 'REJECTED',
    reasonCode?: string,
    actorId?: string,
    _txContext?: any,
  ): Promise<ApproveProfileResult> {
    const decidedAt = new Date().toISOString();

    // 1. Try SupplierProfile
    const supplier = await this.supplierRepo.findOne({ where: { id: profileId } });
    if (supplier) {
      if (supplier.approvalStatus === decision) {
        // Idempotent repeated decision with same result
        return { profileId, role: 'SUPPLIER', status: decision, decidedAt };
      }
      if (supplier.approvalStatus !== 'PENDING') {
        // Opposing decision after finalized: DECISION_CONFLICT (admin.md)
        throw new ConflictAppException('DECISION_CONFLICT', 'Hồ sơ đã có quyết định khác trước đó');
      }

      supplier.approvalStatus = decision;
      await this.supplierRepo.save(supplier);

      if (this.auditService) {
        await this.auditService.record({
          actorId,
          action: decision === 'APPROVED' ? 'PROFILE_APPROVED' : 'PROFILE_REJECTED',
          entityType: 'SUPPLIER_PROFILE',
          entityId: profileId,
          reason: reasonCode || null,
        });
      }

      return { profileId, role: 'SUPPLIER', status: decision, decidedAt };
    }

    // 2. Try SellerProfile
    const seller = await this.sellerRepo.findOne({ where: { id: profileId } });
    if (seller) {
      if (seller.approvalStatus === decision) {
        return { profileId, role: 'SELLER', status: decision, decidedAt };
      }
      if (seller.approvalStatus !== 'PENDING') {
        throw new ConflictAppException('DECISION_CONFLICT', 'Hồ sơ đã có quyết định khác trước đó');
      }

      seller.approvalStatus = decision;
      await this.sellerRepo.save(seller);

      if (this.auditService) {
        await this.auditService.record({
          actorId,
          action: decision === 'APPROVED' ? 'PROFILE_APPROVED' : 'PROFILE_REJECTED',
          entityType: 'SELLER_PROFILE',
          entityId: profileId,
          reason: reasonCode || null,
        });
      }

      return { profileId, role: 'SELLER', status: decision, decidedAt };
    }

    throw new NotFoundAppException('PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ tương ứng');
  }

  async assertUserActive(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedAppException('UNAUTHORIZED', 'Người dùng không tồn tại');
    }
    if (user.status === 'LOCKED') {
      await this.sessionRepo.update({ userId, isRevoked: false }, { isRevoked: true });
      throw new ForbiddenAppException('ACCOUNT_LOCKED', 'Tài khoản của bạn đã bị khóa');
    }
  }

  async findActorById(userId: string): Promise<CurrentActor | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { roleMemberships: true, supplierProfile: true, sellerProfile: true },
    });
    if (!user) return null;

    const roles = user.roleMemberships?.map((m) => m.role) || ['CUSTOMER'];
    return {
      userId: user.id,
      activeRole: roles[0] || 'CUSTOMER',
      activeProfileId: null,
    };
  }

  async isProfileApproved(profileId: string): Promise<boolean> {
    const supplier = await this.supplierRepo.findOne({ where: { id: profileId } });
    if (supplier) return supplier.approvalStatus === 'APPROVED';

    const seller = await this.sellerRepo.findOne({ where: { id: profileId } });
    if (seller) return seller.approvalStatus === 'APPROVED';

    return false;
  }

  async listUsers(
    page = 1,
    limit = 20,
    search?: string,
    status?: string,
    role?: string,
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const users = await this.userRepo.find({
      relations: { roleMemberships: true, supplierProfile: true, sellerProfile: true },
      order: { createdAt: 'DESC' },
    });

    let filtered = users;
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter((u) => u.email.toLowerCase().includes(term));
    }
    if (status) {
      filtered = filtered.filter((u) => u.status === status);
    }
    if (role) {
      filtered = filtered.filter((u) => u.roleMemberships?.some((m) => m.role === role));
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paged = filtered.slice(startIndex, startIndex + limit);

    const items = paged.map((u) => ({
      id: u.id,
      email: u.email,
      status: u.status,
      roles: u.roleMemberships?.map((m) => m.role) || ['CUSTOMER'],
      createdAt: u.createdAt,
      supplierProfile: u.supplierProfile
        ? { id: u.supplierProfile.id, status: u.supplierProfile.approvalStatus }
        : null,
      sellerProfile: u.sellerProfile
        ? { id: u.sellerProfile.id, status: u.sellerProfile.approvalStatus }
        : null,
    }));

    return { items, total, page, limit };
  }

  async setUserStatus(
    userId: string,
    status: 'ACTIVE' | 'LOCKED',
    actorId?: string,
    reason?: string,
  ): Promise<{ userId: string; status: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundAppException('USER_NOT_FOUND', 'Người dùng không tồn tại');
    }

    const previousStatus = user.status;
    user.status = status;
    await this.userRepo.save(user);

    if (status === 'LOCKED') {
      // Invalidate all active sessions immediately
      await this.sessionRepo.update({ userId, isRevoked: false }, { isRevoked: true });
    }

    if (this.auditService) {
      await this.auditService.record({
        actorId,
        action: status === 'LOCKED' ? 'USER_LOCKED' : 'USER_UNLOCKED',
        entityType: 'USER',
        entityId: userId,
        reason: reason || null,
        metadata: { previousStatus, newStatus: status },
      });
    }

    return { userId, status };
  }

  async listProfiles(
    role?: 'SUPPLIER' | 'SELLER',
    status?: ApprovalStatus,
  ): Promise<any[]> {
    const results: any[] = [];

    if (!role || role === 'SUPPLIER') {
      const suppliers = await this.supplierRepo.find({
        relations: { user: true },
        order: { createdAt: 'DESC' },
      });
      const filtered = status ? suppliers.filter((s) => s.approvalStatus === status) : suppliers;
      for (const s of filtered) {
        results.push({
          id: s.id,
          userId: s.userId,
          role: 'SUPPLIER',
          name: s.legalName,
          email: s.user?.email,
          status: s.approvalStatus,
          createdAt: s.createdAt,
        });
      }
    }

    if (!role || role === 'SELLER') {
      const sellers = await this.sellerRepo.find({
        relations: { user: true },
        order: { createdAt: 'DESC' },
      });
      const filtered = status ? sellers.filter((s) => s.approvalStatus === status) : sellers;
      for (const s of filtered) {
        results.push({
          id: s.id,
          userId: s.userId,
          role: 'SELLER',
          name: s.displayName,
          email: s.user?.email,
          status: s.approvalStatus,
          createdAt: s.createdAt,
        });
      }
    }

    return results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}

