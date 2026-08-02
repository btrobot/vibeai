import { pgTable, text, timestamp, uuid, varchar, jsonb, index, boolean, integer } from 'drizzle-orm/pg-core';
import { users } from './index';

// ===== AI Capabilities Table =====
export const aiCapabilities = pgTable('ai_capabilities', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).notNull(), // text, image, video, analysis
  icon: varchar('icon', { length: 50 }).notNull().default('sparkles'),
  inputSchema: jsonb('input_schema').notNull().default({}),
  outputSchema: jsonb('output_schema').notNull().default({}),
  config: jsonb('config').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('ai_capabilities_slug_idx').on(table.slug),
  index('ai_capabilities_category_idx').on(table.category),
]);

// ===== AI Models Table =====
export const aiModels = pgTable('ai_models', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  provider: varchar('provider', { length: 100 }).notNull(),
  description: text('description').notNull(),
  capabilities: jsonb('capabilities').notNull().default([]), // array of capability slugs
  config: jsonb('config').notNull().default({}),
  inputTypes: jsonb('input_types').notNull().default([]), // text, image, video
  outputTypes: jsonb('output_types').notNull().default(['text']),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('ai_models_slug_idx').on(table.slug),
  index('ai_models_provider_idx').on(table.provider),
]);

// ===== Generation Tasks Table =====
export const generationTasks = pgTable('generation_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  capabilitySlug: varchar('capability_slug', { length: 100 }).notNull(),
  modelSlug: varchar('model_slug', { length: 100 }).notNull(),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  errorMessage: text('error_message'),
  creditsCost: integer('credits_cost').notNull().default(0),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('generation_tasks_user_id_idx').on(table.userId),
  index('generation_tasks_status_idx').on(table.status),
  index('generation_tasks_created_at_idx').on(table.createdAt),
]);