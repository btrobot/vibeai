-- ============================================================
-- Migration 0004: Gallery Works fileId Foreign Keys
-- ============================================================
-- Add image_file_id and video_file_id columns to gallery_works
-- These reference files(id) and replace the legacy image_url/video_url columns
-- Old columns are kept for backward compatibility during transition
-- ============================================================

ALTER TABLE "gallery_works" ADD COLUMN IF NOT EXISTS "image_file_id" uuid REFERENCES "files"("id") ON DELETE SET NULL;
ALTER TABLE "gallery_works" ADD COLUMN IF NOT EXISTS "video_file_id" uuid REFERENCES "files"("id") ON DELETE SET NULL;
