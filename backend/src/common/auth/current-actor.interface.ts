export type RoleType = 'CUSTOMER' | 'SELLER' | 'SUPPLIER' | 'ADMIN';

export type UserStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'LOCKED';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * CurrentActor v1 according to docs/contracts/identity.md & docs/contracts/common.md
 * {
 *   userId: string; // unique User ID (UUID)
 *   activeRole: RoleType; // active role executing the request
 *   activeProfileId: string | null; // Supplier/Seller profile ID if activeRole is SUPPLIER/SELLER, otherwise null
 * }
 */
export interface CurrentActor {
  userId: string;
  activeRole: RoleType;
  activeProfileId: string | null;
}

export interface JwtPayload {
  sub: string; // userId
  email: string;
  roles: RoleType[];
  activeRole: RoleType;
  activeProfileId: string | null;
  sessionId?: string;
  iat?: number;
  exp?: number;
}
