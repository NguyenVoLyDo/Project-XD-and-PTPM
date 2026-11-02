export type RoleType = 'CUSTOMER' | 'SELLER' | 'SUPPLIER' | 'ADMIN';

export type UserStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'LOCKED';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CurrentActor {
  userId: string;
  activeRole: RoleType;
  activeProfileId: string | null;
}

export interface UserProfile {
  userId: string;
  email: string;
  status: UserStatus;
  roles: RoleType[];
  activeRole: RoleType;
  activeProfileId: string | null;
  profiles: {
    supplier: { id: string; legalName: string; approvalStatus: ApprovalStatus } | null;
    seller: { id: string; displayName: string; approvalStatus: ApprovalStatus } | null;
  };
}

export interface AuthResponse {
  accessToken: string;
  userId: string;
  email: string;
  roles: RoleType[];
  activeRole: RoleType;
  activeProfileId: string | null;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; code?: string; message?: string }>;
  };
}
