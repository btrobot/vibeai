// ===== Order Types =====

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum OrderType {
  CREDIT_PACK = 'credit_pack',
  SUBSCRIPTION = 'subscription',
  PRODUCT = 'product',
  SERVICE = 'service',
}

export interface OrderResponse {
  id: string;
  userId: string;
  orderNumber: string;
  type: OrderType;
  amount: string;
  currency: string;
  credits: number;
  status: OrderStatus;
  paymentId: string | null;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderResponse {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  credits: number;
  status: OrderStatus;
  paymentId?: string;
}
