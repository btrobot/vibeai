-- Add cost_per_call column to provider_attempts for GTW-010 (provider cost tracking)
ALTER TABLE "provider_attempts" ADD COLUMN "cost_per_call" numeric(10,4);

-- Create model_providers table (multi-provider routing)
CREATE TABLE "model_providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "model_slug" varchar(100) NOT NULL REFERENCES "ai_models"("slug") ON DELETE CASCADE,
  "provider_name" varchar(100) NOT NULL,
  "sdk_model_id" varchar(200) NOT NULL,
  "sdk_client" varchar(50) NOT NULL,
  "priority" integer NOT NULL DEFAULT 1,
  "cost_per_call" numeric(10,4),
  "cost_per_second" numeric(10,4),
  "config" jsonb DEFAULT '{}'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "model_providers_model_slug_idx" ON "model_providers" ("model_slug");
CREATE INDEX "model_providers_active_idx" ON "model_providers" ("is_active");
CREATE INDEX "model_providers_model_priority_idx" ON "model_providers" ("model_slug", "priority");
