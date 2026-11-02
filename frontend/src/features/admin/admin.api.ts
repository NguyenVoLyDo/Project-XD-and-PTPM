import { API_BASE } from '@/lib/api-base';
import { AdminAuditLog, AdminProfile, AdminUser } from './types';

const API_BASE_URL = API_BASE.replace(/\/api\/v1$/, '');

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
      const json = await res.json();
      return json.data !== undefined ? json.data : json;
    } catch (error) {
      throw error;
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
      const json = await res.json();
      return json.data !== undefined ? json.data : json;
    } catch (error) {
      throw error;
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
      const json = await res.json();
      return json.data !== undefined ? json.data : json;
    } catch (error) {
      throw error;
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
      const json = await res.json();
      return json.data !== undefined ? json.data : json;
    } catch (error) {
      throw error;
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
      const json = await res.json();
      return json.data !== undefined ? json.data : json;
    } catch (error) {
      throw error;
    }
  }
}

export const adminApi = new AdminApiClient();
