-- ============================================================
-- Migration 0003: File Source/External + Creates Input
-- ============================================================
-- Changes:
-- 1. files table: add source, external_url columns; make storage_key & url nullable
-- 2. creates table: add input jsonb column for full user input snapshot
-- ============================================================

-- ── 1. files table ──
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "source" varchar(20) DEFAULT 'storage' NOT NULL;
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "external_url" text;
ALTER TABLE "files" ALTER COLUMN "storage_key" DROP NOT NULL;
ALTER TABLE "files" DROP CONSTRAINT IF EXISTS "files_storage_key_unique";
ALTER TABLE "files" ALTER COLUMN "url" DROP NOT NULL;

-- ── 2. creates table ──
ALTER TABLE "creates" ADD COLUMN IF NOT EXISTS "input" jsonb DEFAULT '{}' NOT NULL;
