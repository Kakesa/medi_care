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

  async getAccess(): Promise<{ permissions: string[]; currency: string }> {
    return httpClient.get(`${this.basePath}/access`);
  }

  async getMovements(): Promise<Array<{ id: string; type: string; quantity: number; status: string; reason: string; quantityBefore: number; quantityAfter: number }>> {
    return httpClient.get(`${this.basePath}/movements`);
  }

  async createRequest(lines: Array<{ productId: string; quantity: number; reason?: string }>): Promise<{ id: string; status: string; number: string }> {
    return httpClient.post(`${this.basePath}/requests`, { lines });
  }

  async getRequests(): Promise<Array<{ id: string; number: string; status: string; requestedBy: string; lines: Array<{ productName: string; quantity: number }> }>> {
    return httpClient.get(`${this.basePath}/requests`);
  }

  async decideRequest(id: string, decision: 'approve' | 'reject' | 'return'): Promise<{ status: string }> {
    return httpClient.patch(`${this.basePath}/requests/${id}`, { decision });
  }

  async receiveOrder(id: string, data: { quantity: number; lotNumber: string; expiresAt?: string; purchasePrice?: number; idempotencyKey: string }): Promise<PharmacyOrder> {
    return httpClient.post(`${this.basePath}/orders/${id}/receive`, data);
  }

  async createSale(data: {
    kind: 'counter' | 'dispense' | 'ward';
    settlement: 'paid' | 'invoiced' | 'internal';
    paymentMethod?: string;
    idempotencyKey: string;
    lines: Array<{ productId: string; quantity: number }>;
  }): Promise<{ id: string; number: string; total: number }> {
    return httpClient.post(`${this.basePath}/sales`, data);
  }

  async getFinance(): Promise<{ stockValue: number; engaged: number; paid: number; unpaidInvoices: number; salesTotal: number; budgetAmount: number; remaining: number; alert: string }> {
    return httpClient.get(`${this.basePath}/finance`);
  }

  async getOperations(): Promise<{ expiring: Array<{ id: string; lotNumber: string; expiresAt?: string; quantityRemaining: number }> }> {
    return httpClient.get(`${this.basePath}/operations`);
  }
}

export const pharmacyService = new PharmacyService();
