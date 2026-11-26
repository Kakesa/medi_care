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
  async getProducts(params?: PaginationParams & { search?: string; category?: string; status?: string; kind?: string }): Promise<PaginatedResponse<PharmacyProduct>> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.search) queryParams.search = params.search;
    if (params?.category) queryParams.category = params.category;
    if (params?.status) queryParams.status = params.status;
    if (params?.kind) queryParams.kind = params.kind;

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

  async getDashboard(): Promise<PharmacyDashboard> {
    return httpClient.get(`${this.basePath}/dashboard`);
  }

  async getStockSheet(id: string): Promise<PharmacyStockSheet> {
    return httpClient.get(`${this.basePath}/products/${id}/sheet`);
  }

  async exportProducts(params?: { search?: string; category?: string; status?: string }): Promise<{ filename: string; csv: string }> {
    const queryParams: Record<string, string> = {};
    if (params?.search) queryParams.search = params.search;
    if (params?.category) queryParams.category = params.category;
    if (params?.status) queryParams.status = params.status;
    return httpClient.get(`${this.basePath}/products/export`, queryParams);
  }

  async importProducts(rows: Array<Record<string, string | number>>): Promise<{ created: number; errors: Array<{ row: number; message: string }> }> {
    return httpClient.post(`${this.basePath}/products/import`, { rows });
  }
}

export interface PharmacyDashboard {
  currency: string;
  counts: {
    medications: number;
    available: number;
    outOfStock: number;
    belowAlert: number;
    nearExpiry: number;
    stockValue: number;
    pendingPrescriptions: number;
    dispensesToday: number;
    salesToday: number;
    pendingOrders: number;
  };
  alerts: {
    outOfStock: Array<{ id: string; name: string }>;
    belowAlert: Array<{ id: string; name: string; quantity: number; threshold: number }>;
    nearExpiry: Array<{ name: string; lotNumber: string; expiresAt: string; quantityRemaining: number }>;
  };
  salesByDay: Array<{ date: string; count: number; amount: number | null }>;
  topProducts: Array<{ name: string; quantity: number }>;
  movementsByDay: Array<{ date: string; inbound: number; outbound: number }>;
  stockValueByDay: Array<{ date: string; value: number }>;
  financial: null | {
    salesTodayAmount: number;
    purchasesMonth: number;
    expensesMonth: number;
    collectedMonth: number;
    billedMonth: number;
    financeByMonth: Array<{ month: string; collected: number; expenses: number; purchases: number }>;
  };
}

export interface PharmacyStockSheet {
  product: PharmacyProduct;
  lots: Array<{
    id: string;
    lotNumber: string;
    supplierName: string;
    expiresAt?: string;
    quantityReceived: number;
    quantityRemaining: number;
    purchasePrice: number;
    status: string;
  }>;
  lines: Array<{
    date: string;
    reference: string;
    lotNumber: string;
    origin: string;
    destination: string;
    quantityIn: number;
    unitCost: number;
    expiresAt?: string | null;
    quantityOut: number;
    remaining: number;
  }>;
}

export const pharmacyService = new PharmacyService();
