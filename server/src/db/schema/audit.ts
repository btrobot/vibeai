import { pgTable, text, timestamp, uuid, varchar, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ===== Audit Logs Table =====
// 审计日志 - 记录所有管理员操作
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  adminId: uuid('admin_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 50 }).notNull(), // create | update | delete | ban | unban | refund | export | login
  entityType: varchar('entity_type', { length: 50 }).notNull(), // user | order | gallery | announcement | config | product | promo_code
  entityId: varchar('entity_id', { length: 255 }), // 操作对象的 ID（字符串以兼容非 UUID 主键如 config key）
  changes: jsonb('changes'), // 变更前后的值 { before: ..., after: ... }
  status: varchar('status', { length: 20 }).notNull().default('success'), // success | failed
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('audit_logs_admin_id_idx').on(table.adminId),
  index('audit_logs_action_idx').on(table.action),
  index('audit_logs_entity_type_idx').on(table.entityType),
  index('audit_logs_created_at_idx').on(table.createdAt),
]);
