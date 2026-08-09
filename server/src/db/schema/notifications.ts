import { pgTable, text, timestamp, uuid, boolean, varchar, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ===== Notifications Table =====
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull().default('in_app'), // in_app, email
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  link: text('link'),
  icon: text('icon'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('notifications_user_id_idx').on(table.userId),
  index('notifications_is_read_idx').on(table.isRead),
  index('notifications_created_at_idx').on(table.createdAt),
]);
