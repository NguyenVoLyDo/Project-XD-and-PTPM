const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiClient {
  private static getHeaders(userId?: string, role?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('dc_token');
      const storedUserId = userId || localStorage.getItem('dc_user_id');
      const storedRole = role || localStorage.getItem('dc_active_role');

      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
      if (storedUserId) headers['x-user-id'] = storedUserId;
      if (storedRole) headers['x-role'] = storedRole;
    }
    return headers;
  }

  static async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
      });
    }

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `API error: ${res.statusText}`);
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
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `API error: ${res.statusText}`);
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
      const res = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `API error: ${res.statusText}`);
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
      const res = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `API error: ${res.statusText}`);
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
      const res = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `API error: ${res.statusText}`);
      }
      return json.data !== undefined ? json.data : json;
    } catch (err: any) {
      console.warn(`[API DELETE ${endpoint}] error:`, err.message);
      throw err;
    }
  }
}
