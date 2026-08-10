import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb, index, decimal } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { orders } from './payments';

// ===== Product Categories Table =====
export const productCategories = pgTable('product_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  parentId: uuid('parent_id'),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  icon: varchar('icon', { length: 255 }),
  attributes: jsonb('attributes').default('{}'), // { size: [...], color: [...], material: [...] }
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('product_categories_parent_id_idx').on(table.parentId),
  index('product_categories_slug_idx').on(table.slug),
  index('product_categories_is_active_idx').on(table.isActive),
]);

// ===== Products Table =====
export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  categoryId: uuid('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
  images: jsonb('images').default('[]'), // array of file IDs or URLs
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft | active | archived
  metadata: jsonb('metadata').default('{}'), // custom fields, specs, etc.
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('products_user_id_idx').on(table.userId),
  index('products_category_id_idx').on(table.categoryId),
  index('products_status_idx').on(table.status),
  index('products_created_at_idx').on(table.createdAt),
]);

// ===== Promo Codes Table =====
export const promoCodes = pgTable('promo_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  type: varchar('type', { length: 20 }).notNull(), // fixed | percentage
  value: decimal('value', { precision: 10, scale: 2 }).notNull(), // fixed amount or percentage
  maxUses: integer('max_uses'), // null = unlimited
  usedCount: integer('used_count').notNull().default(0),
  validFrom: timestamp('valid_from').notNull().defaultNow(),
  validUntil: timestamp('valid_until'),
  minAmount: decimal('min_amount', { precision: 10, scale: 2 }), // minimum order amount
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('promo_codes_code_idx').on(table.code),
  index('promo_codes_is_active_idx').on(table.isActive),
  index('promo_codes_valid_from_idx').on(table.validFrom),
  index('promo_codes_valid_until_idx').on(table.validUntil),
]);

// ===== User Promo Uses Table =====
export const userPromoUses = pgTable('user_promo_uses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  promoCodeId: uuid('promo_code_id').notNull().references(() => promoCodes.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  usedAt: timestamp('used_at').notNull().defaultNow(),
}, (table) => [
  index('user_promo_uses_user_id_idx').on(table.userId),
  index('user_promo_uses_promo_code_id_idx').on(table.promoCodeId),
  index('user_promo_uses_order_id_idx').on(table.orderId),
  index('user_promo_uses_used_at_idx').on(table.usedAt),
]);
