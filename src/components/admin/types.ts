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

// ===== Audit Log =====
export interface AuditLog {
  id: string;
  adminId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: Record<string, unknown> | null;
  status: 'success' | 'failed';
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogStats {
  total: number;
  failed: number;
  byAction: Record<string, number>;
  byEntityType: Record<string, number>;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  ban: '封禁',
  unban: '解禁',
  refund: '退款',
  export: '导出',
  update_role: '角色变更',
  notify: '通知',
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  user: '用户',
  order: '订单',
  gallery: '画廊',
  announcement: '公告',
  config: '配置',
  product: '商品',
  promo_code: '促销码',
  category: '分类',
  unknown: '未知',
};

export const SETTING_CATEGORY_LABELS: Record<string, string> = {
  homepage: '首页',
  seo: 'SEO',
  feature: '功能',
  general: '通用',
  site: '站点',
  register: '注册',
  security: '安全',
  ai: 'AI',
  email: '邮件',
  storage: '存储',
  payment: '支付',
};
