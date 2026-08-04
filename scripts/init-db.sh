#!/bin/bash
# 数据库初始化脚本
# 用于首次部署时创建数据库、运行迁移、导入种子数据

set -e

echo "=== VibeAI 数据库初始化 ==="

# 检查环境变量
if [ -z "${DATABASE_URL}" ]; then
  echo "错误：DATABASE_URL 未设置"
  exit 1
fi

echo "数据库连接：${DATABASE_URL}"

# 1. 检查数据库连接
echo ""
echo "1. 检查数据库连接..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1').then(() => {
  console.log('✓ 数据库连接成功');
  pool.end();
}).catch(e => {
  console.error('✗ 数据库连接失败:', e.message);
  process.exit(1);
});
"

# 2. 运行迁移
echo ""
echo "2. 运行数据库迁移..."
node -e "
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
migrate(db, { migrationsFolder: './server/drizzle' }).then(() => {
  console.log('✓ 迁移完成');
  pool.end();
}).catch(e => {
  console.error('✗ 迁移失败:', e.message);
  pool.end();
  process.exit(1);
});
"

# 3. 运行种子数据
echo ""
echo "3. 导入种子数据..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT COUNT(*) FROM users').then(r => {
  const count = parseInt(r.rows[0].count);
  if (count > 0) {
    console.log('✓ 种子数据已存在 (' + count + ' 个用户)，跳过');
  } else {
    console.log('种子数据不存在，需要运行 seed 脚本');
    console.log('请手动运行：cd server && npx tsx scripts/seed.ts');
  }
  pool.end();
}).catch(e => {
  console.error('检查种子数据失败:', e.message);
  pool.end();
});
"

echo ""
echo "=== 数据库初始化完成 ==="
