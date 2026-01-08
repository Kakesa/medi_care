// ============================================
// Service de gestion des notifications
// ============================================

import { httpClient } from './httpClient';
import type { 
  Notification, 
  CreateNotificationData,
  PaginatedResponse,
  PaginationParams,
  ApiResponse
} from '@/types';

class NotificationService {
  private readonly basePath = '/notifications';

  async getAll(params?: PaginationParams): Promise<PaginatedResponse<Notification>> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);

    return httpClient.get<PaginatedResponse<Notification>>(this.basePath, queryParams);
  }

  async getUnread(): Promise<Notification[]> {
    return httpClient.get<Notification[]>(`${this.basePath}/unread`);
  }

  async markAsRead(id: string): Promise<Notification> {
    return httpClient.patch<Notification>(`${this.basePath}/${id}/read`, {});
  }

  async markAllAsRead(): Promise<ApiResponse<void>> {
    return httpClient.patch<ApiResponse<void>>(`${this.basePath}/read-all`, {});
  }

  async create(data: CreateNotificationData): Promise<Notification> {
    return httpClient.post<Notification>(this.basePath, data);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete<ApiResponse<void>>(`${this.basePath}/${id}`);
  }

  async deleteAll(): Promise<ApiResponse<void>> {
    return httpClient.delete<ApiResponse<void>>(`${this.basePath}/all`);
  }

  async getUnreadCount(): Promise<number> {
    const response = await httpClient.get<{ count: number }>(`${this.basePath}/unread-count`);
    return response.count;
  }
}

export const notificationService = new NotificationService();
