export interface AdminUser {
  id: string;
  email: string;
  status: 'ACTIVE' | 'LOCKED';
  roles: string[];
  createdAt: string;
  supplierProfile?: { id: string; status: string } | null;
  sellerProfile?: { id: string; status: string } | null;
}

export interface AdminProfile {
  id: string;
  userId: string;
  role: 'SUPPLIER' | 'SELLER';
  name: string;
  email: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}
