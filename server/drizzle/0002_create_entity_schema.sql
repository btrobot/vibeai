-- ============================================================
-- Migration 0002: Create Entity Layer + AI Models Schema Overhaul
-- ============================================================
-- Changes:
-- 1. Drop obsolete generation_tasks table (replaced by tasks + creates)
-- 2. Recreate ai_models with new schema (provider_name, modality, sdk_model_id, etc.)
-- 3. Create creates table (Project -> Create -> Task hierarchy)
-- 4. Add new columns to tasks (create_id, capability_slug, credits_cost, etc.)
-- 5. Create provider_attempts table (SDK call audit log)
-- ============================================================

-- ── 1. Drop obsolete generation_tasks table ──
DROP TABLE IF EXISTS "generation_tasks";

-- ── 2. Recreate ai_models with new schema ──
-- The old schema (provider, config, input_types, output_types) is incompatible.
-- Since ai_models is entirely seed-managed, safe to drop and recreate.
DROP TABLE IF EXISTS "ai_models";
--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"provider_name" varchar(100) DEFAULT 'coze' NOT NULL,
	"modality" varchar(50) NOT NULL,
	"sdk_model_id" varchar(200) NOT NULL,
	"sdk_client" varchar(50) DEFAULT 'llm' NOT NULL,
	"capabilities" text[] DEFAULT '{}' NOT NULL,
	"description" text,
	"avatar" text,
	"context_window" integer,
	"max_output_tokens" integer,
	"input_modes" text[] DEFAULT '{}' NOT NULL,
	"output_type" varchar(50) NOT NULL,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"input_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_credits" integer DEFAULT 1 NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_models_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "ai_models_slug_idx" ON "ai_models" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "ai_models_modality_idx" ON "ai_models" USING btree ("modality");
--> statement-breakpoint
CREATE INDEX "ai_models_active_idx" ON "ai_models" USING btree ("is_active");

-- ── 3. Create creates table ──
CREATE TABLE IF NOT EXISTS "creates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"capability_slug" varchar(100) NOT NULL,
	"prompt" text NOT NULL,
	"source_create_id" uuid,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"output" jsonb,
	"model_slug" varchar(100),
	"task_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creates" DROP CONSTRAINT IF EXISTS "creates_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "creates" ADD CONSTRAINT "creates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creates" DROP CONSTRAINT IF EXISTS "creates_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "creates" ADD CONSTRAINT "creates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creates" DROP CONSTRAINT IF EXISTS "creates_source_create_id_creates_id_fk";
--> statement-breakpoint
ALTER TABLE "creates" ADD CONSTRAINT "creates_source_create_id_creates_id_fk" FOREIGN KEY ("source_create_id") REFERENCES "public"."creates"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creates_project_id_idx" ON "creates" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creates_user_id_idx" ON "creates" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creates_status_idx" ON "creates" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creates_source_create_id_idx" ON "creates" USING btree ("source_create_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creates_created_at_idx" ON "creates" USING btree ("created_at");

-- ── 4. Add new columns to tasks ──
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "create_id" uuid;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "capability_slug" varchar(100);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "credits_cost" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "provider_task_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "source_task_id" uuid;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
--> statement-breakpoint
-- Add FK for tasks.create_id -> creates.id
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_create_id_creates_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_create_id_creates_id_fk" FOREIGN KEY ("create_id") REFERENCES "public"."creates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_create_id_idx" ON "tasks" USING btree ("create_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_source_task_id_idx" ON "tasks" USING btree ("source_task_id");

-- ── 5. Create provider_attempts table ──
CREATE TABLE IF NOT EXISTS "provider_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"model_slug" varchar(100) NOT NULL,
	"provider_name" varchar(100) DEFAULT 'coze' NOT NULL,
	"sdk_client" varchar(50) NOT NULL,
	"request_payload" jsonb NOT NULL,
	"response_payload" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"duration_ms" integer,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_attempts" DROP CONSTRAINT IF EXISTS "provider_attempts_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "provider_attempts" ADD CONSTRAINT "provider_attempts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_attempts_task_id_idx" ON "provider_attempts" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_attempts_model_slug_idx" ON "provider_attempts" USING btree ("model_slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_attempts_status_idx" ON "provider_attempts" USING btree ("status");
