-- Migration: 0006_payments_and_orders
-- Description: Add payments, orders, order_items, and refunds tables for Stripe integration

-- ===== Payments Table =====
CREATE TABLE "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" decimal(10,2) NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'USD',
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "provider" varchar(50) NOT NULL DEFAULT 'stripe',
  "provider_payment_id" varchar(255),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "completed_at" timestamp,
  "failed_at" timestamp,
  "refunded_at" timestamp
);

CREATE INDEX "payments_user_id_idx" ON "payments" ("user_id");
CREATE INDEX "payments_status_idx" ON "payments" ("status");
CREATE INDEX "payments_provider_idx" ON "payments" ("provider");
CREATE INDEX "payments_provider_payment_id_idx" ON "payments" ("provider_payment_id");
CREATE INDEX "payments_created_at_idx" ON "payments" ("created_at");

-- ===== Orders Table =====
CREATE TABLE "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "order_number" varchar(50) UNIQUE NOT NULL,
  "type" varchar(50) NOT NULL,
  "amount" decimal(10,2) NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'USD',
  "credits" integer NOT NULL DEFAULT 0,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "payment_id" uuid REFERENCES "payments"("id") ON DELETE SET NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "expires_at" timestamp,
  "completed_at" timestamp,
  "cancelled_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "orders_user_id_idx" ON "orders" ("user_id");
CREATE INDEX "orders_status_idx" ON "orders" ("status");
CREATE INDEX "orders_type_idx" ON "orders" ("type");
CREATE INDEX "orders_payment_id_idx" ON "orders" ("payment_id");
CREATE INDEX "orders_order_number_idx" ON "orders" ("order_number");
CREATE INDEX "orders_created_at_idx" ON "orders" ("created_at");
CREATE INDEX "orders_expires_at_idx" ON "orders" ("expires_at");

-- ===== Order Items Table =====
CREATE TABLE "order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "item_type" varchar(50) NOT NULL,
  "item_id" uuid,
  "name" varchar(200) NOT NULL,
  "description" text,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_price" decimal(10,2) NOT NULL,
  "total_price" decimal(10,2) NOT NULL,
  "credits" integer NOT NULL DEFAULT 0,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "order_items_order_id_idx" ON "order_items" ("order_id");
CREATE INDEX "order_items_item_type_idx" ON "order_items" ("item_type");

-- ===== Refunds Table =====
CREATE TABLE "refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "payment_id" uuid NOT NULL REFERENCES "payments"("id") ON DELETE CASCADE,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "amount" decimal(10,2) NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'USD',
  "reason" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "provider_refund_id" varchar(255),
  "refunded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "completed_at" timestamp
);

CREATE INDEX "refunds_user_id_idx" ON "refunds" ("user_id");
CREATE INDEX "refunds_payment_id_idx" ON "refunds" ("payment_id");
CREATE INDEX "refunds_order_id_idx" ON "refunds" ("order_id");
CREATE INDEX "refunds_status_idx" ON "refunds" ("status");
CREATE INDEX "refunds_created_at_idx" ON "refunds" ("created_at");
