import {
  AuthResponse,
  UserProfile,
  RoleType,
  CurrentActor,
  ApiErrorResponse,
} from '../types';
import { LoginFormData, RegisterFormData } from '../schemas/auth.schema';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class AuthApiClient {
  private accessToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('dc_access_token');
    }
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('dc_access_token', token);
      } else {
        localStorage.removeItem('dc_access_token');
      }
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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

    return response.json();
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
    const res = await this.request<{ accessToken: string; activeRole: RoleType; activeProfileId: string | null }>(
      '/api/v1/auth/refresh',
      { method: 'POST' },
    );
    this.setAccessToken(res.accessToken);
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      this.setAccessToken(null);
    }
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>('/api/v1/me', { method: 'GET' });
  }

  async switchActiveRole(role: RoleType, profileId?: string): Promise<{ accessToken: string; currentActor: CurrentActor }> {
    const res = await this.request<{ accessToken: string; currentActor: CurrentActor }>('/api/v1/me/active-role', {
      method: 'POST',
      body: JSON.stringify({ role, profileId }),
    });
    this.setAccessToken(res.accessToken);
    return res;
  }
}

export const authApi = new AuthApiClient();
