import { API_BASE } from '@/lib/api-base';
import {
  AuthResponse,
  UserProfile,
  RoleType,
  CurrentActor,
  ApiErrorResponse,
} from '../types';
import { LoginFormData, RegisterFormData } from '../schemas/auth.schema';

const API_BASE_URL = API_BASE.replace(/\/api\/v1$/, '');

class AuthApiClient {
  private accessToken: string | null = null;
  private pendingRefresh: Promise<{ accessToken: string; activeRole: RoleType; activeProfileId: string | null }> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('dc_access_token');
    }
  }

  getSessionGeneration(): string | null {
    return typeof window === 'undefined' ? null : localStorage.getItem('dc_session_generation');
  }

  setAccessToken(token: string | null, preserveSession = false) {
    this.accessToken = token;
    if (typeof window !== 'undefined') {
      if (!preserveSession) localStorage.setItem('dc_session_generation', `${Date.now()}-${Math.random()}`);
      if (token) {
        localStorage.setItem('dc_access_token', token);
      } else {
        localStorage.removeItem('dc_access_token');
      }
    }
  }

  getAccessToken(): string | null {
    return typeof window === 'undefined' ? this.accessToken : localStorage.getItem('dc_access_token');
  }

  private activeRoleFromToken(token: string): RoleType | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return ['CUSTOMER', 'SELLER', 'SUPPLIER', 'ADMIN'].includes(payload.activeRole) ? payload.activeRole : null;
    } catch { return null; }
  }

  private async renewExpiredSession(previousToken: string): Promise<void> {
    // Wait for both rotation and role restoration before retrying protected work.
    try {
      if (this.pendingRefresh) await this.pendingRefresh;
      else if (this.getAccessToken() === previousToken) await this.refresh();
    } catch (error) {
      // A competing tab may have completed rotation while this tab got 401.
      // fetchWithAuth still verifies the logical session before any retry.
      if (!this.getAccessToken() || this.getAccessToken() === previousToken) throw error;
    }
  }

  async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const generation = this.getSessionGeneration();
    if (this.pendingRefresh) {
      try {
        await this.pendingRefresh;
      } catch {
        // Refresh failed (e.g. unauthenticated guest without session). Proceed with request.
      }
    }
    const previousToken = this.getAccessToken();
    if (previousToken && generation && generation !== this.getSessionGeneration()) return new Response(null, { status: 401 });
    const send = () => {
      const headers = new Headers(options.headers);
      const token = this.getAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      else headers.delete('Authorization');
      return fetch(url, { ...options, credentials: 'include', headers });
    };
    let response = await send();
    if (response.status === 401 && previousToken && generation === this.getSessionGeneration()) {
      try { await this.renewExpiredSession(previousToken); if (this.getAccessToken() && generation === this.getSessionGeneration()) response = await send(); }
      catch { /* Return the original unauthorized response to the caller. */ }
    }
    return response;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, recover = true): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.getAccessToken()) {
      headers['Authorization'] = `Bearer ${this.getAccessToken()}`;
    }

    const send = recover && !['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/refresh'].includes(endpoint)
      ? this.fetchWithAuth.bind(this) : fetch;
    const response = await send(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // ensures HttpOnly refreshToken cookie is transmitted
    });

    if (!response.ok) {
      let errorBody: ApiErrorResponse | null = null;
      try {
        errorBody = await response.json();
      } catch {
        // Not a JSON response
      }

      const errorMessage =
        errorBody?.error?.message ||
        `Yêu cầu thất bại với mã lỗi HTTP ${response.status}`;
      const errorCode = errorBody?.error?.code || 'HTTP_ERROR';

      const error = new Error(errorMessage) as Error & {
        code: string;
        details?: any[];
        status: number;
      };
      error.code = errorCode;
      error.details = errorBody?.error?.details;
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return {} as T;
    }

    const json = await response.json();
    return json.data !== undefined ? json.data : json;
  }

  async login(data: LoginFormData): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: data.email, password: data.password }),
    });
    this.setAccessToken(res.accessToken);
    return res;
  }

  async register(data: RegisterFormData): Promise<{ userId: string; email: string; roles: RoleType[] }> {
    return this.request<{ userId: string; email: string; roles: RoleType[] }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        role: data.role,
      }),
    });
  }

  async refresh(): Promise<{ accessToken: string; activeRole: RoleType; activeProfileId: string | null }> {
    if (this.pendingRefresh) return this.pendingRefresh;
    const previous = this.getAccessToken();
    const generation = this.getSessionGeneration();
    const work = async () => {
      if (generation !== this.getSessionGeneration()) throw new Error('Session changed');
      const current = this.getAccessToken();
      if (current && current !== previous) return { accessToken: current, activeRole: this.activeRoleFromToken(current)!, activeProfileId: null };
      return this.refreshOnce();
    };
    const locked = typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('dc-auth-refresh', work) : work();
    this.pendingRefresh = Promise.resolve(locked).catch(error => {
      if ((error.status === 401 || error.status === 403) && this.getAccessToken() === previous && this.getSessionGeneration() === generation) {
        if (previous) {
          this.setAccessToken(null);
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('dc-session-expired'));
        }
      }
      throw error;
    }).finally(() => { this.pendingRefresh = null; });
    return this.pendingRefresh;
  }

  private async refreshOnce(): Promise<{ accessToken: string; activeRole: RoleType; activeProfileId: string | null }> {
    const previous = this.getAccessToken();
    const generation = this.getSessionGeneration();
    const role = previous ? this.activeRoleFromToken(previous) : null;
    const res = await this.request<{ accessToken: string; activeRole: RoleType; activeProfileId: string | null }>(
      '/api/v1/auth/refresh',
      { method: 'POST' },
    );
    if (this.getSessionGeneration() !== generation || this.getAccessToken() !== previous) throw new Error('Session changed');
    this.setAccessToken(res.accessToken, true);
    if (role && role !== res.activeRole) {
      // The server validates role membership; do not recursively refresh here.
      const restored = await this.request<CurrentActor & { accessToken: string }>(
        '/api/v1/me/active-role', { method: 'POST', body: JSON.stringify({ role }) }, false,
      );
      if (this.getSessionGeneration() !== generation || this.getAccessToken() !== res.accessToken) throw new Error('Session changed');
      this.setAccessToken(restored.accessToken, true);
      return restored;
    }
    return res;
  }

  async logout(): Promise<void> {
    // Finish any rotation, then allow a stale access token to recover before revocation.
    if (this.pendingRefresh) await this.pendingRefresh.catch(() => {});
    try {
      await this.request('/api/v1/auth/logout', { method: 'POST' });
    } catch (error) {
      if ((error as { status?: number }).status !== 401) throw error;
      // A rejected refresh means the server session is already invalid.
    }
    this.setAccessToken(null);
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>('/api/v1/me', { method: 'GET' });
  }

  async switchActiveRole(role: RoleType, profileId?: string): Promise<{ accessToken: string; currentActor: CurrentActor }> {
    const res = await this.request<CurrentActor & { accessToken: string }>('/api/v1/me/active-role', {
      method: 'POST',
      body: JSON.stringify({ role, profileId }),
    });
    this.setAccessToken(res.accessToken);
    return { accessToken: res.accessToken, currentActor: { userId: res.userId, activeRole: res.activeRole, activeProfileId: res.activeProfileId } };
  }
}

export const authApi = new AuthApiClient();
