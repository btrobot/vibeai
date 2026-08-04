import { pgTable, text, timestamp, uuid, integer, varchar, boolean, index } from 'drizzle-orm/pg-core';

// ===== Users Table =====
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  avatar: text('avatar'),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  credits: integer('credits').notNull().default(100),
  isActive: boolean('is_active').notNull().default(true),
  isEmailVerified: boolean('is_email_verified').notNull().default(false),
  lastLoginAt: timestamp('last_login_at'),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('users_email_idx').on(table.email),
]);

// ===== Sessions Table =====
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshToken: text('refresh_token').notNull().unique(),
  deviceInfo: text('device_info'),
  ipAddress: varchar('ip_address', { length: 45 }),
  expiresAt: timestamp('expires_at').notNull(),
  isRevoked: boolean('is_revoked').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
  index('sessions_refresh_token_idx').on(table.refreshToken),
]);

// ===== OAuth Accounts Table =====
export const oauthAccounts = pgTable('oauth_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 50 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  providerData: text('provider_data'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('oauth_accounts_user_id_idx').on(table.userId),
  index('oauth_accounts_provider_idx').on(table.provider, table.providerAccountId),
]);

// ===== Login Logs Table =====
export const loginLogs = pgTable('login_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: varchar('email', { length: 255 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(), // login, logout, failed, refresh
  ipAddress: varchar('ip_address', { length: 45 }),
  deviceInfo: text('device_info'),
  success: boolean('success').notNull(),
  failReason: text('fail_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('login_logs_user_id_idx').on(table.userId),
  index('login_logs_created_at_idx').on(table.createdAt),
]);
