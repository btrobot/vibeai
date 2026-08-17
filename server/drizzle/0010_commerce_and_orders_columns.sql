-- Migration: 0010_commerce_and_orders_columns
-- Description: Orders 促销字段补齐（original_amount/discount_amount/promo_code_id）
--              + Phase 2 ecommerce 表：product_categories, products, promo_codes, user_promo_uses

-- ===== Orders 补列 =====
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "original_amount" decimal(10,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_amount" decimal(10,2) NOT NULL DEFAULT '0';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "promo_code_id" uuid;

-- ===== Product Categories =====
CREATE TABLE IF NOT EXISTS "product_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "parent_id" uuid,
  "slug" varchar(100) NOT NULL UNIQUE,
  "icon" varchar(255),
  "attributes" jsonb DEFAULT '{}'::jsonb,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "product_categories_parent_id_idx" ON "product_categories" ("parent_id");
CREATE INDEX IF NOT EXISTS "product_categories_slug_idx" ON "product_categories" ("slug");
CREATE INDEX IF NOT EXISTS "product_categories_is_active_idx" ON "product_categories" ("is_active");

-- ===== Products =====
CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(200) NOT NULL,
  "description" text,
  "category_id" uuid REFERENCES "product_categories"("id") ON DELETE SET NULL,
  "images" jsonb DEFAULT '[]'::jsonb,
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "products_user_id_idx" ON "products" ("user_id");
CREATE INDEX IF NOT EXISTS "products_category_id_idx" ON "products" ("category_id");
CREATE INDEX IF NOT EXISTS "products_status_idx" ON "products" ("status");
CREATE INDEX IF NOT EXISTS "products_created_at_idx" ON "products" ("created_at");

-- ===== Promo Codes =====
CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(50) NOT NULL UNIQUE,
  "type" varchar(20) NOT NULL,
  "value" decimal(10,2) NOT NULL,
  "max_uses" integer,
  "used_count" integer NOT NULL DEFAULT 0,
  "valid_from" timestamp NOT NULL DEFAULT now(),
  "valid_until" timestamp,
  "min_amount" decimal(10,2),
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "promo_codes_code_idx" ON "promo_codes" ("code");
CREATE INDEX IF NOT EXISTS "promo_codes_is_active_idx" ON "promo_codes" ("is_active");
CREATE INDEX IF NOT EXISTS "promo_codes_valid_from_idx" ON "promo_codes" ("valid_from");
CREATE INDEX IF NOT EXISTS "promo_codes_valid_until_idx" ON "promo_codes" ("valid_until");

-- ===== User Promo Uses =====
CREATE TABLE IF NOT EXISTS "user_promo_uses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "promo_code_id" uuid NOT NULL REFERENCES "promo_codes"("id") ON DELETE CASCADE,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "used_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "user_promo_uses_user_id_idx" ON "user_promo_uses" ("user_id");
CREATE INDEX IF NOT EXISTS "user_promo_uses_promo_code_id_idx" ON "user_promo_uses" ("promo_code_id");
CREATE INDEX IF NOT EXISTS "user_promo_uses_order_id_idx" ON "user_promo_uses" ("order_id");
CREATE INDEX IF NOT EXISTS "user_promo_uses_used_at_idx" ON "user_promo_uses" ("used_at");
