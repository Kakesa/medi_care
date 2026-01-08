// ============================================
// Service d'authentification
// ============================================

import { httpClient } from './httpClient';
import { setAuthToken, removeAuthToken } from './config';
import type { 
  User, 
  LoginCredentials, 
  RegisterData, 
  AuthResponse,
  ApiResponse 
} from '@/types';

class AuthService {
  private readonly basePath = '/auth';

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await httpClient.post<AuthResponse>(
      `${this.basePath}/login`,
      credentials
    );
    if (response.token) {
      setAuthToken(response.token);
    }
    return response;
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await httpClient.post<AuthResponse>(
      `${this.basePath}/register`,
      data
    );
    if (response.token) {
      setAuthToken(response.token);
    }
    return response;
  }

  async logout(): Promise<void> {
    try {
      await httpClient.post(`${this.basePath}/logout`);
    } finally {
      removeAuthToken();
    }
  }

  async getCurrentUser(): Promise<User> {
    return httpClient.get<User>(`${this.basePath}/me`);
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return httpClient.put<User>(`${this.basePath}/profile`, data);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return httpClient.post<ApiResponse<void>>(`${this.basePath}/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  async resetPassword(email: string): Promise<ApiResponse<void>> {
    return httpClient.post<ApiResponse<void>>(`${this.basePath}/reset-password`, { email });
  }
}

export const authService = new AuthService();
