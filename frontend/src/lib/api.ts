import { API_BASE } from './api-base';
import { authApi } from '../features/auth/api/auth.api';

export class ApiClient {
  private static getHeaders(userId?: string, role?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('dc_access_token');
      const storedUserId = userId || localStorage.getItem('dc_user_id') || 'u-customer-c';
      const storedRole = role || localStorage.getItem('dc_active_role') || 'CUSTOMER';

      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
      if (!storedToken && process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true') {
        if (storedUserId) headers['x-user-id'] = storedUserId;
        if (storedRole) headers['x-role'] = storedRole;
      }
    }
    return headers;
  }

  private static extractErrorMessage(json: any, fallback: string): string {
    if (!json) return fallback;
    if (typeof json.message === 'string') return json.message;
    if (json.message && typeof json.message.message === 'string') return json.message.message;
    if (json.errorCode && typeof json.errorCode.message === 'string') return json.errorCode.message;
    if (json.error && typeof json.error.message === 'string') return json.error.message;
    if (json.error && typeof json.error.code === 'string') return json.error.code;
    return fallback;
  }

  private static apiError(json: any, response: Response) {
    return Object.assign(new Error(this.extractErrorMessage(json, `API error: ${response.statusText}`)), {
      code: json?.error?.code || 'HTTP_ERROR', status: response.status, details: json?.error?.details,
    });
  }

  static async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
      });
    }

    try {
      const res = await authApi.fetchWithAuth(url.toString(), {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const json = await res.json();
      if (!res.ok) {
        throw this.apiError(json, res);
      }
      return json.data !== undefined ? json.data : json;
    } catch (err: any) {
      console.warn(`[API GET ${endpoint}] fallback or error:`, err.message);
      throw err;
    }
  }

  static async post<T>(endpoint: string, body?: any, customHeaders?: Record<string, string>): Promise<T> {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    try {
      const headers = { ...this.getHeaders(), ...customHeaders };
      const res = await authApi.fetchWithAuth(url, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        throw this.apiError(json, res);
      }
      return json.data !== undefined ? json.data : json;
    } catch (err: any) {
      console.warn(`[API POST ${endpoint}] error:`, err.message);
      throw err;
    }
  }

  static async put<T>(endpoint: string, body?: any): Promise<T> {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    try {
      const res = await authApi.fetchWithAuth(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        throw this.apiError(json, res);
      }
      return json.data !== undefined ? json.data : json;
    } catch (err: any) {
      console.warn(`[API PUT ${endpoint}] error:`, err.message);
      throw err;
    }
  }

  static async patch<T>(endpoint: string, body?: any): Promise<T> {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    try {
      const res = await authApi.fetchWithAuth(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        throw this.apiError(json, res);
      }
      return json.data !== undefined ? json.data : json;
    } catch (err: any) {
      console.warn(`[API PATCH ${endpoint}] error:`, err.message);
      throw err;
    }
  }

  static async delete<T>(endpoint: string): Promise<T> {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    try {
      const res = await authApi.fetchWithAuth(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      const json = await res.json();
      if (!res.ok) {
        throw this.apiError(json, res);
      }
      return json.data !== undefined ? json.data : json;
    } catch (err: any) {
      console.warn(`[API DELETE ${endpoint}] error:`, err.message);
      throw err;
    }
  }

  static async uploadFile(file: File): Promise<{ url: string; filename: string; size: number; mimetype: string }> {
    const url = `${API_BASE}/uploads`;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await authApi.fetchWithAuth(url, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw this.apiError(json, res);
      }
      return json.data !== undefined ? json.data : json;
    } catch (err: any) {
      console.warn(`[API UPLOAD] error:`, err.message);
      throw err;
    }
  }
}

