import { pgTable, text, timestamp, uuid, integer, varchar, boolean, bigint, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalName: varchar('original_name', { length: 1024 }).notNull(),
  mimeType: varchar('mime_type', { length: 255 }).notNull().default('application/octet-stream'),
  size: bigint('size', { mode: 'number' }).notNull().default(0),
  category: varchar('category', { length: 20 }).notNull().default('temp'),
  // source: 'storage' = physical file in local/S3; 'external' = virtual, only externalUrl
  source: varchar('source', { length: 20 }).notNull().default('storage'),
  // storage: physical path (nullable for external files)
  storageKey: text('storage_key'),
  // external: the original URL (nullable for storage files)
  externalUrl: text('external_url'),
  // legacy url column (deprecated — use resolveUrl() at runtime instead)
  url: text('url'),
  isPublic: boolean('is_public').notNull().default(false),
  width: integer('width'),
  height: integer('height'),
  duration: integer('duration'),
  thumbnailKey: text('thumbnail_key'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('files_user_id_idx').on(table.userId),
  index('files_category_idx').on(table.category),
  index('files_storage_key_idx').on(table.storageKey),
  index('files_created_at_idx').on(table.createdAt),
]);