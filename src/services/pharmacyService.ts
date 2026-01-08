// ============================================
// Service de gestion de la pharmacie
// ============================================

import { httpClient } from './httpClient';
import type { 
  PharmacyProduct, 
  PharmacyOrder,
  CreateProductData, 
  UpdateProductData,
  CreateOrderData,
  PaginatedResponse,
  PaginationParams,
  ApiResponse
} from '@/types';

class PharmacyService {
  private readonly basePath = '/pharmacy';

  // Products
  async getProducts(params?: PaginationParams): Promise<PaginatedResponse<PharmacyProduct>> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);

    return httpClient.get<PaginatedResponse<PharmacyProduct>>(`${this.basePath}/products`, queryParams);
  }

  async getProductById(id: string): Promise<PharmacyProduct> {
    return httpClient.get<PharmacyProduct>(`${this.basePath}/products/${id}`);
  }

  async createProduct(data: CreateProductData): Promise<PharmacyProduct> {
    return httpClient.post<PharmacyProduct>(`${this.basePath}/products`, data);
  }

  async updateProduct(id: string, data: UpdateProductData): Promise<PharmacyProduct> {
    return httpClient.put<PharmacyProduct>(`${this.basePath}/products/${id}`, data);
  }

  async deleteProduct(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete<ApiResponse<void>>(`${this.basePath}/products/${id}`);
  }

  async getLowStockProducts(): Promise<PharmacyProduct[]> {
    return httpClient.get<PharmacyProduct[]>(`${this.basePath}/products/low-stock`);
  }

  async updateStock(id: string, quantity: number): Promise<PharmacyProduct> {
    return httpClient.patch<PharmacyProduct>(`${this.basePath}/products/${id}/stock`, { quantity });
  }

  // Orders
  async getOrders(params?: PaginationParams): Promise<PaginatedResponse<PharmacyOrder>> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);

    return httpClient.get<PaginatedResponse<PharmacyOrder>>(`${this.basePath}/orders`, queryParams);
  }

  async getOrderById(id: string): Promise<PharmacyOrder> {
    return httpClient.get<PharmacyOrder>(`${this.basePath}/orders/${id}`);
  }

  async createOrder(data: CreateOrderData): Promise<PharmacyOrder> {
    return httpClient.post<PharmacyOrder>(`${this.basePath}/orders`, data);
  }

  async updateOrderStatus(id: string, status: PharmacyOrder['status']): Promise<PharmacyOrder> {
    return httpClient.patch<PharmacyOrder>(`${this.basePath}/orders/${id}/status`, { status });
  }

  async cancelOrder(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete<ApiResponse<void>>(`${this.basePath}/orders/${id}`);
  }

  async getPendingOrders(): Promise<PharmacyOrder[]> {
    return httpClient.get<PharmacyOrder[]>(`${this.basePath}/orders/pending`);
  }
}

export const pharmacyService = new PharmacyService();
