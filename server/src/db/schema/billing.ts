import { pgTable, text, timestamp, uuid, integer, bigint, varchar, boolean, jsonb, decimal, index } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { tasks } from './task-engine';

// ===== Subscription Plans Table =====
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 50 }).notNull().unique(), // free | starter | pro | enterprise
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  credits: integer('credits').notNull().default(0), // monthly credits
  priceMonthly: decimal('price_monthly', { precision: 10, scale: 2 }).notNull().default('0'),
  priceYearly: decimal('price_yearly', { precision: 10, scale: 2 }),
  maxProjects: integer('max_projects').notNull().default(5),
  maxStorageBytes: bigint('max_storage_bytes', { mode: 'number' }).notNull().default(104857600), // 100MB
  maxConcurrentTasks: integer('max_concurrent_tasks').notNull().default(1),
  capabilities: text('capabilities').array().default([]),
  features: jsonb('features').default({}),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('plans_slug_idx').on(table.slug),
]);

// ===== Subscriptions Table =====
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').notNull().references(() => subscriptionPlans.id),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active | cancelled | expired | trialing
  billingCycle: varchar('billing_cycle', { length: 10 }).notNull().default('monthly'), // monthly | yearly
  creditsRemaining: integer('credits_remaining').notNull().default(0),
  creditsUsed: integer('credits_used').notNull().default(0),
  currentPeriodStart: timestamp('current_period_start').notNull().defaultNow(),
  currentPeriodEnd: timestamp('current_period_end'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeCustomerId: text('stripe_customer_id'),
  cancelledAt: timestamp('cancelled_at'),
  trialEndsAt: timestamp('trial_ends_at'),
  autoRenew: boolean('auto_renew').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('subs_user_id_idx').on(table.userId),
  index('subs_plan_id_idx').on(table.planId),
  index('subs_status_idx').on(table.status),
]);

// ===== Credit Usage Table =====
export const creditUsage = pgTable('credit_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  credits: integer('credits').notNull(), // positive = deduction, negative = refund
  action: varchar('action', { length: 50 }).notNull(), // task_execution, task_refund, plan_upgrade, admin_adjust
  description: text('description'),
  balanceAfter: integer('balance_after').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('usage_user_id_idx').on(table.userId),
  index('usage_subscription_id_idx').on(table.subscriptionId),
  index('usage_task_id_idx').on(table.taskId),
  index('usage_created_at_idx').on(table.createdAt),
]);

// ===== Invoices Table =====
export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  stripeInvoiceId: text('stripe_invoice_id'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('cny'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | paid | failed | refunded
  description: text('description'),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  paidAt: timestamp('paid_at'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('invoices_user_id_idx').on(table.userId),
  index('invoices_subscription_id_idx').on(table.subscriptionId),
  index('invoices_status_idx').on(table.status),
]);