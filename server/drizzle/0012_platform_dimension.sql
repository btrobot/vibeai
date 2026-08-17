-- Migration: 0012_platform_dimension
-- Description: 平台维度重构（无兼容负担，项目未上线）。
--   ai_platforms   : 平台共享账号（baseUrl + apiKey 的默认存放处）
--   model_channels : 平台 × 逻辑模型 × 协议 的渠道实例
--   数据搬迁：model_providers.provider_name 去重 → ai_platforms；
--             行数据 → model_channels；全平台共享同一套 baseUrl/apiKey 时提升到平台。
--   完成后删除 model_providers 旧表。

-- ===== 1. 平台表 =====
CREATE TABLE IF NOT EXISTS "ai_platforms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "base_url" varchar(500),
  "api_key" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_platforms_name_uidx" ON "ai_platforms" ("name");
CREATE INDEX IF NOT EXISTS "ai_platforms_active_idx" ON "ai_platforms" ("is_active");

-- ===== 2. 渠道表 =====
CREATE TABLE IF NOT EXISTS "model_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "platform_id" uuid NOT NULL REFERENCES "ai_platforms"("id") ON DELETE CASCADE,
  "model_slug" varchar(100) NOT NULL REFERENCES "ai_models"("slug") ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS "model_channels_platform_id_idx" ON "model_channels" ("platform_id");
CREATE INDEX IF NOT EXISTS "model_channels_model_slug_idx" ON "model_channels" ("model_slug");
CREATE INDEX IF NOT EXISTS "model_channels_active_idx" ON "model_channels" ("is_active");
CREATE INDEX IF NOT EXISTS "model_channels_model_priority_idx" ON "model_channels" ("model_slug", "priority");
CREATE UNIQUE INDEX IF NOT EXISTS "model_channels_identity_uidx" ON "model_channels" ("platform_id", "model_slug", "sdk_model_id");

-- ===== 3. 数据搬迁（仅当旧表存在且有数据时） =====
DO $$
DECLARE
  p record;
  c record;
  plat_id uuid;
  uniform boolean;
  distinct_base bigint;
  distinct_key bigint;
  sample_base text;
  sample_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'model_providers') THEN
    RETURN;
  END IF;

  FOR p IN SELECT DISTINCT provider_name AS name FROM model_providers LOOP
    -- 该平台所有渠道是否共享同一套账号（baseUrl/apiKey 各自 ≤1 种取值）
    SELECT count(DISTINCT coalesce(config->>'baseUrl', '')) INTO distinct_base FROM model_providers WHERE provider_name = p.name;
    SELECT count(DISTINCT coalesce(config->>'apiKey', '')) INTO distinct_key FROM model_providers WHERE provider_name = p.name;
    uniform := (distinct_base <= 1 AND distinct_key <= 1);

    -- 建平台
    INSERT INTO ai_platforms (name) VALUES (p.name)
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO plat_id;
    IF plat_id IS NULL THEN
      SELECT id INTO plat_id FROM ai_platforms WHERE name = p.name;
    END IF;

    -- 共享账号 → 提升到平台
    IF uniform THEN
      SELECT max(config->>'baseUrl') INTO sample_base
        FROM model_providers WHERE provider_name = p.name AND config->>'baseUrl' IS NOT NULL AND config->>'baseUrl' <> '';
      SELECT max(config->>'apiKey') INTO sample_key
        FROM model_providers WHERE provider_name = p.name AND config->>'apiKey' IS NOT NULL AND config->>'apiKey' <> '';
      UPDATE ai_platforms
        SET base_url = coalesce(sample_base, base_url),
            api_key = coalesce(sample_key, api_key),
            updated_at = now()
        WHERE id = plat_id;
    END IF;

    -- 搬迁渠道（共享账号已提升的平台，渠道 config 清空继承平台；否则保留渠道自身 config）
    FOR c IN SELECT * FROM model_providers WHERE provider_name = p.name LOOP
      INSERT INTO model_channels
        (platform_id, model_slug, sdk_model_id, sdk_client, priority, cost_per_call, cost_per_second, config, is_active, created_at, updated_at)
      VALUES
        (plat_id, c.model_slug, c.sdk_model_id, c.sdk_client, c.priority, c.cost_per_call, c.cost_per_second,
         CASE WHEN uniform THEN '{}'::jsonb ELSE coalesce(c.config, '{}'::jsonb) END,
         c.is_active, c.created_at, c.updated_at)
      ON CONFLICT (platform_id, model_slug, sdk_model_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ===== 4. 删除旧表 =====
DROP TABLE IF EXISTS "model_providers";
