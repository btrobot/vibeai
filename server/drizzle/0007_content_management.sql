-- Phase 3: Content Management - Announcements, System Settings, Gallery Publications

-- Announcements table
CREATE TABLE IF NOT EXISTS "announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(200) NOT NULL,
  "content" text NOT NULL,
  "type" varchar(20) DEFAULT 'info' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "scheduled_at" timestamp,
  "expires_at" timestamp,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "announcements_is_active_idx" ON "announcements" ("is_active");
CREATE INDEX IF NOT EXISTS "announcements_type_idx" ON "announcements" ("type");
CREATE INDEX IF NOT EXISTS "announcements_scheduled_at_idx" ON "announcements" ("scheduled_at");
CREATE INDEX IF NOT EXISTS "announcements_created_at_idx" ON "announcements" ("created_at");

-- System Settings table
CREATE TABLE IF NOT EXISTS "system_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(100) NOT NULL,
  "value" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "category" varchar(50) DEFAULT 'general' NOT NULL,
  "description" text,
  "is_public" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "system_settings_key_unique" UNIQUE ("key")
);
CREATE INDEX IF NOT EXISTS "system_settings_key_idx" ON "system_settings" ("key");
CREATE INDEX IF NOT EXISTS "system_settings_category_idx" ON "system_settings" ("category");
CREATE INDEX IF NOT EXISTS "system_settings_is_public_idx" ON "system_settings" ("is_public");

-- Gallery Publications table
CREATE TABLE IF NOT EXISTS "gallery_publications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "work_id" uuid NOT NULL REFERENCES "gallery_works"("id") ON DELETE CASCADE,
  "published_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp,
  "is_featured" boolean DEFAULT false NOT NULL,
  "featured_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "gallery_publications_work_id_idx" ON "gallery_publications" ("work_id");
CREATE INDEX IF NOT EXISTS "gallery_publications_is_featured_idx" ON "gallery_publications" ("is_featured");
CREATE INDEX IF NOT EXISTS "gallery_publications_published_at_idx" ON "gallery_publications" ("published_at");
