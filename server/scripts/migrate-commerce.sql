-- Phase 2 Commerce Tables Migration SQL
-- Execute this SQL to create all commerce-related tables

-- ===== 商品分类表 =====
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(255),
  attributes JSONB DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS product_categories_parent_id_idx ON product_categories(parent_id);
CREATE INDEX IF NOT EXISTS product_categories_slug_idx ON product_categories(slug);
CREATE INDEX IF NOT EXISTS product_categories_is_active_idx ON product_categories(is_active);

-- ===== 商品表 =====
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  images JSONB DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS products_user_id_idx ON products(user_id);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
CREATE INDEX IF NOT EXISTS products_created_at_idx ON products(created_at);

-- ===== 促销码表 =====
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('fixed', 'percentage')),
  value DECIMAL(10, 2) NOT NULL CHECK (value >= 0),
  max_uses INTEGER CHECK (max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP CHECK (valid_until > valid_from),
  min_amount DECIMAL(10, 2) CHECK (min_amount >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS promo_codes_code_idx ON promo_codes(code);
CREATE INDEX IF NOT EXISTS promo_codes_is_active_idx ON promo_codes(is_active);
CREATE INDEX IF NOT EXISTS promo_codes_valid_from_idx ON promo_codes(valid_from);
CREATE INDEX IF NOT EXISTS promo_codes_valid_until_idx ON promo_codes(valid_until);

-- ===== 用户促销码使用记录表 =====
CREATE TABLE IF NOT EXISTS user_promo_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  used_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS user_promo_uses_user_id_idx ON user_promo_uses(user_id);
CREATE INDEX IF NOT EXISTS user_promo_uses_promo_code_id_idx ON user_promo_uses(promo_code_id);
CREATE INDEX IF NOT EXISTS user_promo_uses_order_id_idx ON user_promo_uses(order_id);
CREATE INDEX IF NOT EXISTS user_promo_uses_used_at_idx ON user_promo_uses(used_at);

-- Comments for documentation
COMMENT ON TABLE product_categories IS 'Product categories with hierarchical structure';
COMMENT ON TABLE products IS 'Product catalog';
COMMENT ON TABLE promo_codes IS 'Promotional codes for discounts';
COMMENT ON TABLE user_promo_uses IS 'User promo code usage tracking';
