# Phase 2 - Commerce Database Migration Guide

## 概述

本文档说明如何运行 Phase 2 电商功能的数据库迁移。

## 新增表

Phase 2 引入以下新表：

1. **product_categories** - 商品分类表
2. **products** - 商品表
3. **promo_codes** - 促销码表
4. **user_promo_uses** - 用户促销码使用记录表

## 迁移方式

### 方式 1: 使用 Drizzle-kit (推荐在本地开发环境)

```bash
# 1. 确保数据库连接正常
echo $DATABASE_URL

# 2. 生成迁移文件（需要在交互式终端运行）
cd server
pnpm drizzle-kit generate

# 3. 应用迁移
pnpm tsx src/scripts/migrate-commerce.ts
```

### 方式 2: 使用手动 SQL (生产环境)

直接执行以下 SQL 创建表：

```sql
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
  type VARCHAR(20) NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP,
  min_amount DECIMAL(10, 2),
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
```

### 方式 3: 使用 tsx 直接执行 SQL

创建一个临时脚本执行 SQL：

```bash
cd server
cat > migrate-commerce-manual.ts << 'EOF'
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibeai');

async function migrate() {
  // 在这里粘贴上面的 SQL 语句
  await sql.unsafe(`
    -- 粘贴 SQL 内容
  `);
  console.log('Migration completed!');
  await sql.end();
}

migrate().catch(console.error);
EOF

pnpm tsx migrate-commerce-manual.ts
```

## 回滚

如果需要回滚迁移：

```sql
-- 删除表（注意顺序：先删除有外键依赖的表）
DROP TABLE IF EXISTS user_promo_uses CASCADE;
DROP TABLE IF EXISTS promo_codes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
```

## 验证

运行以下命令验证表是否创建成功：

```sql
-- 查看所有新表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('product_categories', 'products', 'promo_codes', 'user_promo_uses');

-- 查看表结构
\d product_categories
\d products
\d promo_codes
\d user_promo_uses
```

## 注意事项

1. **外键依赖**：`user_promo_uses` 表依赖 `users`, `orders`, `promo_codes` 表，确保这些表已存在
2. **CASCADE 行为**：
   - 删除用户会级联删除其促销码使用记录
   - 删除促销码会级联删除所有使用记录
   - 删除订单会保留使用记录（order_id 设为 NULL）
3. **索引**：所有外键和常用查询字段都已创建索引，确保查询性能
4. **JSONB 字段**：`attributes`, `images`, `metadata` 使用 JSONB 类型，支持灵活的结构化数据

## 下一步

迁移完成后，可以运行 seed 脚本填充初始数据（可选）：

```bash
cd server
pnpm tsx src/scripts/seed-commerce.ts
```
