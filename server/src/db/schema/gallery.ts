import { pgTable, text, timestamp, uuid, integer, varchar, boolean, index, foreignKey } from 'drizzle-orm/pg-core';
import { users } from './index';

// ===== Gallery Works Table =====
export const galleryWorks = pgTable('gallery_works', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull().default(''),
  imageUrl: text('image_url'),
  videoUrl: text('video_url'),
  type: varchar('type', { length: 20 }).notNull().default('image'), // image, video, text
  prompt: text('prompt'),
  modelSlug: varchar('model_slug', { length: 100 }),
  capabilitySlug: varchar('capability_slug', { length: 100 }),
  thumbnailUrl: text('thumbnail_url'),
  likes: integer('likes').notNull().default(0),
  views: integer('views').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('gallery_works_user_id_idx').on(table.userId),
  index('gallery_works_type_idx').on(table.type),
  index('gallery_works_is_published_idx').on(table.isPublished),
  index('gallery_works_created_at_idx').on(table.createdAt),
  index('gallery_works_likes_idx').on(table.likes),
]);

// ===== Gallery Likes Table =====
export const galleryLikes = pgTable('gallery_likes', {
  id: uuid('id').defaultRandom().primaryKey(),
  workId: uuid('work_id').notNull().references(() => galleryWorks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('gallery_likes_work_id_idx').on(table.workId),
  index('gallery_likes_user_id_idx').on(table.userId),
  index('gallery_likes_work_user_unique_idx').on(table.workId, table.userId),
]);