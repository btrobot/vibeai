import { pgTable, text, timestamp, uuid, varchar, boolean, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { galleryWorks } from './gallery';

// ===== Announcements Table =====
// 公告系统 - 平台级公告管理
export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  type: varchar('type', { length: 20 }).notNull().default('info'), // info | warning | maintenance
  isActive: boolean('is_active').notNull().default(true),
  isPinned: boolean('is_pinned').notNull().default(false), // 置顶公告
  // 定时发布
  scheduledAt: timestamp('scheduled_at'), // null = 立即发布
  expiresAt: timestamp('expires_at'), // null = 永不过期
  // 操作者
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('announcements_is_active_idx').on(table.isActive),
  index('announcements_type_idx').on(table.type),
  index('announcements_scheduled_at_idx').on(table.scheduledAt),
  index('announcements_created_at_idx').on(table.createdAt),
]);

// ===== System Settings Table =====
// 系统配置 - 键值对存储，支持首页配置、SEO 等
export const systemSettings = pgTable('system_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(), // 如 homepage.carousel, seo.title
  value: jsonb('value').notNull().default('{}'), // JSON 值
  category: varchar('category', { length: 50 }).notNull().default('general'), // homepage | seo | general | feature
  description: text('description'),
  isPublic: boolean('is_public').notNull().default(true), // 是否允许未登录用户读取
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('system_settings_key_idx').on(table.key),
  index('system_settings_category_idx').on(table.category),
  index('system_settings_is_public_idx').on(table.isPublic),
]);

// ===== Gallery Publications Table =====
// Gallery 公开投影表 - 精细化的发布控制（发布时间、过期时间）
export const galleryPublications = pgTable('gallery_publications', {
  id: uuid('id').defaultRandom().primaryKey(),
  workId: uuid('work_id').notNull().references(() => galleryWorks.id, { onDelete: 'cascade' }),
  publishedAt: timestamp('published_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // null = 永久公开
  // 发布范围
  isFeatured: boolean('is_featured').notNull().default(false), // 推荐作品
  featuredOrder: integer('featured_order').notNull().default(0), // 推荐排序
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('gallery_publications_work_id_idx').on(table.workId),
  index('gallery_publications_is_featured_idx').on(table.isFeatured),
  index('gallery_publications_published_at_idx').on(table.publishedAt),
]);
