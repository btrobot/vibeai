-- Migration: 0013_gpt_image_2_l2_capabilities
-- Description: gpt-image-2 模型 capabilities 补充 L2 后处理能力
--   （白底图/场景合成/模特换装 经独立工具页路由到 gpt-image-2，
--     路由解析校验 ai_models.capabilities @> 能力 slug，缺失会导致路由不命中）
-- 幂等：仅当 capabilities 缺失 background-removal 时执行更新。
UPDATE "ai_models"
SET "capabilities" = ARRAY['image-generation','image-editing','background-removal','scene-composition','model-dressing']::text[]
WHERE "slug" = 'gpt-image-2'
  AND NOT ("capabilities" @> ARRAY['background-removal']::text[]);
