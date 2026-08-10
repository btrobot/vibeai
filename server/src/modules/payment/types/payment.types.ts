// ===== Payment Types =====

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  ALIPAY = 'alipay',
  WECHAT = 'wechat',
}

export interface PaymentResponse {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerPaymentId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
}

export interface CreatePaymentResponse {
  paymentId: string;
  clientSecret?: string; // Stripe Payment Intent client secret
  amount: number;
  currency: string;
  status: PaymentStatus;
}

export interface WebhookEvent {
  type: string;
  data: {
    object: {
      id: string;
      amount: number;
      currency: string;
      status: string;
      metadata?: Record<string, unknown>;
    };
  };
}
