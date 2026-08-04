import { pgTable, text, timestamp, uuid, varchar, jsonb, index, boolean, integer } from 'drizzle-orm/pg-core';
import { tasks } from './task-engine';

// ===== AI Capabilities Table =====
export const aiCapabilities = pgTable('ai_capabilities', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(), // text_generation, image_generation, video_generation
  icon: text('icon'),
  inputSchema: jsonb('input_schema').default({}),
  outputSchema: jsonb('output_schema').default({}),
  config: jsonb('config').default({}),
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
  name: varchar('name', { length: 255 }).notNull(),
  providerName: varchar('provider_name', { length: 100 }).notNull().default('coze'),
  modality: varchar('modality', { length: 50 }).notNull(), // text_generation | image_generation | video_generation
  sdkModelId: varchar('sdk_model_id', { length: 200 }).notNull(),
  sdkClient: varchar('sdk_client', { length: 50 }).notNull().default('llm'), // llm | image_generation | video_generation
  capabilitySlug: varchar('capability_slug', { length: 100 }).notNull(),
  description: text('description'),
  avatar: text('avatar'),
  contextWindow: integer('context_window'),
  maxOutputTokens: integer('max_output_tokens'),
  inputModes: text('input_modes').array().default([]), // text | image_url | video_url
  outputType: varchar('output_type', { length: 50 }).notNull(), // text | image | video
  constraints: jsonb('constraints').default({}),
  inputSchema: jsonb('input_schema').default({}),
  defaultParams: jsonb('default_params').default({}),
  costCredits: integer('cost_credits').notNull().default(1),
  tags: text('tags').array().default([]),
  isActive: boolean('is_active').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('ai_models_slug_idx').on(table.slug),
  index('ai_models_capability_slug_idx').on(table.capabilitySlug),
  index('ai_models_modality_idx').on(table.modality),
  index('ai_models_active_idx').on(table.isActive),
]);

// ===== Provider Attempts Table (SDK 调用审计日志) =====
export const providerAttempts = pgTable('provider_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  modelSlug: varchar('model_slug', { length: 100 }).notNull(),
  providerName: varchar('provider_name', { length: 100 }).notNull().default('coze'),
  sdkClient: varchar('sdk_client', { length: 50 }).notNull(),
  requestPayload: jsonb('request_payload').notNull(),
  responsePayload: jsonb('response_payload'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | success | failed | timeout
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  attemptNumber: integer('attempt_number').notNull().default(1),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('provider_attempts_task_id_idx').on(table.taskId),
  index('provider_attempts_model_slug_idx').on(table.modelSlug),
  index('provider_attempts_status_idx').on(table.status),
]);
