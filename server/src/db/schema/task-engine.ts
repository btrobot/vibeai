import { pgTable, text, timestamp, uuid, integer, varchar, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './index';

// ===== Projects Table =====
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  coverImage: text('cover_image'),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft | active | archived
  template: varchar('template', { length: 50 }),
  tags: text('tags').array().default([]),
  metadata: jsonb('metadata').default({}),
  totalTasks: integer('total_tasks').notNull().default(0),
  completedTasks: integer('completed_tasks').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('projects_user_id_idx').on(table.userId),
  index('projects_status_idx').on(table.status),
  index('projects_created_at_idx').on(table.createdAt),
]);

// ===== Tasks Table =====
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // text-generation, image-generation, etc.
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | queued | running | completed | failed | cancelled
  priority: integer('priority').notNull().default(0),
  progress: integer('progress').notNull().default(0), // 0-100
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  result: jsonb('result'),
  modelSlug: varchar('model_slug', { length: 100 }),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  estimatedCompletionAt: timestamp('estimated_completion_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('tasks_project_id_idx').on(table.projectId),
  index('tasks_user_id_idx').on(table.userId),
  index('tasks_status_idx').on(table.status),
  index('tasks_type_idx').on(table.type),
  index('tasks_created_at_idx').on(table.createdAt),
]);

// ===== Execution States Table =====
export const executionStates = pgTable('execution_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  step: varchar('step', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | running | completed | failed
  progress: integer('progress').notNull().default(0),
  message: text('message'),
  metadata: jsonb('metadata').default({}),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('execution_states_task_id_idx').on(table.taskId),
  index('execution_states_step_idx').on(table.step),
]);