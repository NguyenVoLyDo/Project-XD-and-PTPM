import { CurrentActor, RoleType, ApprovalStatus } from '../../../../common/auth/current-actor.interface.js';

export interface ApproveProfileResult {
  profileId: string;
  role: RoleType;
  status: ApprovalStatus;
  decidedAt: string;
}

export abstract class IdentityPort {
  /**
   * Called by Admin module to approve or reject a Supplier/Seller profile
   * Adheres to docs/contracts/admin.md and docs/contracts/identity.md
   */
  abstract approveProfile(
    profileId: string,
    decision: 'APPROVED' | 'REJECTED',
    reasonCode?: string,
    actorId?: string,
    txContext?: any,
  ): Promise<ApproveProfileResult>;

  /**
   * Retrieves CurrentActor state for a given userId
   */
  abstract findActorById(userId: string): Promise<CurrentActor | null>;

  /**
   * Checks whether a profile ID is approved
   */
  abstract isProfileApproved(profileId: string): Promise<boolean>;

  /**
   * Validates that user exists and is not LOCKED.
   * If LOCKED, revokes active sessions immediately and throws 403.
   */
  abstract assertUserActive(userId: string): Promise<void>;

  /**
   * Lists users with pagination and filters for Admin management
   */
  abstract listUsers(
    page?: number,
    limit?: number,
    search?: string,
    status?: string,
    role?: string,
  ): Promise<{ items: any[]; total: number; page: number; limit: number }>;

  /**
   * Sets user status (e.g., ACTIVE or LOCKED) and logs audit
   */
  abstract setUserStatus(
    userId: string,
    status: 'ACTIVE' | 'LOCKED',
    actorId?: string,
    reason?: string,
  ): Promise<{ userId: string; status: string }>;

  /**
   * Lists profiles for Admin moderation
   */
  abstract listProfiles(
    role?: 'SUPPLIER' | 'SELLER',
    status?: ApprovalStatus,
  ): Promise<any[]>;
}

