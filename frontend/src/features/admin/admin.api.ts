import { AdminAuditLog, AdminProfile, AdminUser } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Initial Phase A Mock Fixtures
const MOCK_USERS: AdminUser[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@dropconnect.vn',
    status: 'ACTIVE',
    roles: ['CUSTOMER', 'ADMIN'],
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'supplier.hanoi@khohang.vn',
    status: 'ACTIVE',
    roles: ['CUSTOMER', 'SUPPLIER'],
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    supplierProfile: { id: 'prof-supp-1', status: 'PENDING' },
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'seller.shop99@gmail.com',
    status: 'ACTIVE',
    roles: ['CUSTOMER', 'SELLER'],
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    sellerProfile: { id: 'prof-sell-1', status: 'PENDING' },
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'customer.locked@spam.com',
    status: 'LOCKED',
    roles: ['CUSTOMER'],
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

const MOCK_PROFILES: AdminProfile[] = [
  {
    id: 'prof-supp-1',
    userId: '22222222-2222-4222-8222-222222222222',
    role: 'SUPPLIER',
    name: 'Công ty TNHH Kho Vận & Phân Phối Hà Nội',
    email: 'supplier.hanoi@khohang.vn',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'prof-sell-1',
    userId: '33333333-3333-4333-8333-333333333333',
    role: 'SELLER',
    name: 'Shop Thời Trang & Tiện Ích 99',
    email: 'seller.shop99@gmail.com',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

const MOCK_AUDIT_LOGS: AdminAuditLog[] = [
  {
    id: 'audit-log-1',
    actorId: '11111111-1111-4111-8111-111111111111',
    action: 'USER_LOCKED',
    entityType: 'USER',
    entityId: '44444444-4444-4444-8444-444444444444',
    reason: 'Vi phạm chính sách nền tảng (Spam đơn ảo)',
    metadata: { previousStatus: 'ACTIVE', newStatus: 'LOCKED' },
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'audit-log-2',
    actorId: '11111111-1111-4111-8111-111111111111',
    action: 'PROFILE_APPROVED',
    entityType: 'SUPPLIER_PROFILE',
    entityId: 'prof-supp-0',
    reason: 'KYC_VERIFIED',
    metadata: {},
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
];

class AdminApiClient {
  private getAuthHeader(): Record<string, string> {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('dc_access_token')
        : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getUsers(params?: {
    search?: string;
    status?: string;
    role?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: AdminUser[]; total: number }> {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.status) query.set('status', params.status);
      if (params?.role) query.set('role', params.role);
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/users?${query.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
        credentials: 'include',
      });

      if (!res.ok) throw new Error('API error');
      return await res.json();
    } catch {
      // Fallback in-memory filter
      let filtered = [...MOCK_USERS];
      if (params?.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter((u) => u.email.toLowerCase().includes(s));
      }
      if (params?.status) {
        filtered = filtered.filter((u) => u.status === params.status);
      }
      if (params?.role) {
        filtered = filtered.filter((u) => u.roles.includes(params.role!));
      }
      return { items: filtered, total: filtered.length };
    }
  }

  async updateUserStatus(
    userId: string,
    status: 'ACTIVE' | 'LOCKED',
    reason?: string,
  ): Promise<{ userId: string; status: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
        body: JSON.stringify({ status, reason }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('API error');
      return await res.json();
    } catch {
      const user = MOCK_USERS.find((u) => u.id === userId);
      if (user) user.status = status;
      return { userId, status };
    }
  }

  async getProfiles(
    role?: 'SUPPLIER' | 'SELLER',
    status?: string,
  ): Promise<AdminProfile[]> {
    try {
      const query = new URLSearchParams();
      if (role) query.set('role', role);
      if (status) query.set('status', status);

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/profiles?${query.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('API error');
      return await res.json();
    } catch {
      let filtered = [...MOCK_PROFILES];
      if (role) filtered = filtered.filter((p) => p.role === role);
      if (status) filtered = filtered.filter((p) => p.status === status);
      return filtered;
    }
  }

  async decideProfile(
    profileId: string,
    decision: 'APPROVED' | 'REJECTED',
    reasonCode?: string,
    role: 'SUPPLIER' | 'SELLER' = 'SUPPLIER',
  ): Promise<{ profileId: string; approvalStatus: string; decidedAt: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/profiles/${profileId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
        body: JSON.stringify({ role, decision, reasonCode }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('API error');
      return await res.json();
    } catch {
      const profile = MOCK_PROFILES.find((p) => p.id === profileId);
      if (profile) profile.status = decision;
      return {
        profileId,
        approvalStatus: decision,
        decidedAt: new Date().toISOString(),
      };
    }
  }

  async getAuditLogs(limit = 50): Promise<AdminAuditLog[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/audit?limit=${limit}`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('API error');
      return await res.json();
    } catch {
      return [...MOCK_AUDIT_LOGS];
    }
  }
}

export const adminApi = new AdminApiClient();
