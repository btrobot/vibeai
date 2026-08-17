-- Migration: 0011_model_configuration_chain
-- Description: Database-backed capability routing and unique Provider identities.

CREATE TABLE IF NOT EXISTS "capability_model_routes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "capability_slug" varchar(100) NOT NULL,
  "model_slug" varchar(100) NOT NULL REFERENCES "ai_models"("slug") ON DELETE CASCADE,
  "priority" integer NOT NULL DEFAULT 1,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "capability_model_routes_capability_model_uidx"
  ON "capability_model_routes" ("capability_slug", "model_slug");
CREATE INDEX IF NOT EXISTS "capability_model_routes_lookup_idx"
  ON "capability_model_routes" ("capability_slug", "is_active", "priority");

ALTER TABLE "provider_attempts"
  ADD COLUMN IF NOT EXISTS "cost_per_second" numeric(10,4);

-- Fail safely instead of silently choosing which administrator configuration to keep.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "model_providers"
    GROUP BY "model_slug", "provider_name", "sdk_client", "sdk_model_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate model provider identities exist; reconcile them before applying migration 0011';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "model_providers_identity_uidx"
  ON "model_providers" ("model_slug", "provider_name", "sdk_client", "sdk_model_id");
