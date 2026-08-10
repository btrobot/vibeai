import { pgTable, text, timestamp, uuid, varchar, decimal, integer, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ===== Payments Table =====
// 支付记录 - 记录所有支付交易（无论成功与否）
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // 支付金额
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),

  // 支付状态
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // pending | completed | failed | refunded | partially_refunded

  // 支付渠道信息
  provider: varchar('provider', { length: 50 }).notNull().default('stripe'), // stripe | paypal | alipay | wechat
  providerPaymentId: varchar('provider_payment_id', { length: 255 }), // Stripe Payment Intent ID

  // 支付元数据
  metadata: jsonb('metadata').default({}), // 额外信息（如促销码、备注等）

  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  failedAt: timestamp('failed_at'),
  refundedAt: timestamp('refunded_at'),
}, (table) => [
  index('payments_user_id_idx').on(table.userId),
  index('payments_status_idx').on(table.status),
  index('payments_provider_idx').on(table.provider),
  index('payments_provider_payment_id_idx').on(table.providerPaymentId),
  index('payments_created_at_idx').on(table.createdAt),
]);

// ===== Orders Table =====
// 订单记录 - 用户购买的订单（套餐、信用包、订阅）
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // 订单信息
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(), // 如 ORD-20250810-000001

  // 订单类型
  type: varchar('type', { length: 50 }).notNull(),
  // credit_pack | subscription | product | service

  // 订单金额和积分
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // 折扣后实付金额
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  credits: integer('credits').notNull().default(0), // 购买积分数

  // 促销码折扣
  originalAmount: decimal('original_amount', { precision: 10, scale: 2 }), // 折扣前金额（有促销码时记录）
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).notNull().default('0'), // 折扣金额
  promoCodeId: uuid('promo_code_id'), // 关联 promo_codes.id（应用层校验，避免 schema 循环依赖）

  // 订单状态
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // pending | paid | processing | completed | expired | cancelled | failed

  // 支付关联
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),

  // 订单元数据
  metadata: jsonb('metadata').default({}), // 产品信息、促销码等

  // 过期时间（订单有效期）
  expiresAt: timestamp('expires_at'),

  // 完成时间
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),

  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('orders_user_id_idx').on(table.userId),
  index('orders_status_idx').on(table.status),
  index('orders_type_idx').on(table.type),
  index('orders_payment_id_idx').on(table.paymentId),
  index('orders_order_number_idx').on(table.orderNumber),
  index('orders_created_at_idx').on(table.createdAt),
  index('orders_expires_at_idx').on(table.expiresAt),
]);

// ===== Order Items Table =====
// 订单明细 - 一个订单可能包含多个商品（未来扩展）
export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),

  // 商品信息
  itemType: varchar('item_type', { length: 50 }).notNull(), // credit_pack | subscription_plan | product
  itemId: uuid('item_id'), // 关联的商品/套餐/计划 ID

  // 商品描述
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),

  // 数量和单价
  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),

  // 积分数（如果是信用包）
  credits: integer('credits').notNull().default(0),

  // 元数据
  metadata: jsonb('metadata').default({}),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('order_items_order_id_idx').on(table.orderId),
  index('order_items_item_type_idx').on(table.itemType),
]);

// ===== Refunds Table =====
// 退款记录 - 记录所有退款交易
export const refunds = pgTable('refunds', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),

  // 退款金额
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  reason: text('reason').notNull(), // 退款原因

  // 退款状态
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // pending | processing | completed | failed | rejected

  // 支付渠道信息
  providerRefundId: varchar('provider_refund_id', { length: 255 }), // Stripe Refund ID

  // 操作者信息（管理员退款）
  refundedBy: uuid('refunded_by').references(() => users.id, { onDelete: 'set null' }),

  // 元数据
  metadata: jsonb('metadata').default({}),

  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('refunds_user_id_idx').on(table.userId),
  index('refunds_payment_id_idx').on(table.paymentId),
  index('refunds_order_id_idx').on(table.orderId),
  index('refunds_status_idx').on(table.status),
  index('refunds_created_at_idx').on(table.createdAt),
]);
