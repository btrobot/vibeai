/**
 * Shared types for admin tab components.
 * Mirrors backend DTOs from announcement / system-config / order / commerce modules.
 */

// ===== Announcement =====
export type AnnouncementType = 'info' | 'warning' | 'maintenance';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  isActive: boolean;
  isPinned: boolean;
  scheduledAt: string | null;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ===== System Config =====
export type SettingCategory = 'homepage' | 'seo' | 'feature' | 'general';

export interface SystemSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  category: SettingCategory;
  description: string | null;
  isPublic: boolean;
  updatedAt: string;
}

// ===== Order =====
export type OrderType = 'credit_pack' | 'subscription' | 'product' | 'service';
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'failed';

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  type: OrderType;
  amount: string;
  originalAmount: string | null;
  discountAmount: string;
  promoCodeId: string | null;
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

export interface OrderStats {
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  totalRevenue: number;
}

// ===== Product =====
export type ProductStatus = 'draft' | 'active' | 'archived';

export interface Product {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  images: string[];
  status: ProductStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  parentId: string | null;
  slug: string;
  icon: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== Promo Code =====
export type PromoCodeType = 'fixed' | 'percentage';

export interface PromoCode {
  id: string;
  code: string;
  type: PromoCodeType;
  value: number;
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string | null;
  minAmount: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromoCodeUsageStats {
  totalUses: number;
  totalDiscountAmount: number;
  maxUses?: number;
  remainingUses?: number;
  isExhausted: boolean;
}

// ===== Helpers =====
export function getAuthHeaders(): Record<string, string> {
  const stored = localStorage.getItem('auth_tokens');
  if (!stored) return {};
  try {
    const { accessToken } = JSON.parse(stored);
    return { Authorization: `Bearer ${accessToken}` };
  } catch {
    return {};
  }
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Unwrap API response: handles both {success, data} and direct returns */
export function unwrap<T>(result: T & { data?: unknown; success?: boolean }): T {
  if (result && typeof result === 'object' && 'data' in result && result.data !== undefined) {
    return result.data as T;
  }
  return result;
}
