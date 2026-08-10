-- 订单表新增促销码折扣字段
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code_id UUID;

-- 索引：按促销码查询订单
CREATE INDEX IF NOT EXISTS orders_promo_code_id_idx ON orders (promo_code_id);

-- 注释
COMMENT ON COLUMN orders.original_amount IS '折扣前原始金额（有促销码时记录）';
COMMENT ON COLUMN orders.discount_amount IS '促销码折扣金额';
COMMENT ON COLUMN orders.promo_code_id IS '关联 promo_codes.id（应用层校验）';
