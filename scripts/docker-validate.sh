#!/bin/bash
# Docker 构建本地预检脚本
# 在无法使用 Docker 的环境中模拟 Dockerfile 的生产阶段步骤
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=========================================="
echo "  Docker 构建预检"
echo "=========================================="
echo ""

# 1. 检查关键工具是否可用
echo "--- 1/5 工具链检查 ---"
command -v node >/dev/null 2>&1 || { echo "❌ node 未安装"; exit 1; }
echo "  ✅ node $(node -v)"
echo ""

# 2. 模拟生产阶段 pnpm install (root)
echo "--- 2/5 生产依赖安装 (root) ---"
pnpm install --frozen-lockfile --prefer-offline --prod --ignore-scripts 2>&1 | tail -3
echo "  ✅ 根目录生产依赖安装成功"
echo ""

# 3. 模拟生产阶段 pnpm install (server)
echo "--- 3/5 生产依赖安装 (server) ---"
cd server && pnpm install --frozen-lockfile --prefer-offline --prod --ignore-scripts 2>&1 | tail -3
cd "$ROOT_DIR"
echo "  ✅ 后端生产依赖安装成功"
echo ""

# 4. 验证 serve 可用
echo "--- 4/5 静态服务验证 ---"
npx serve --version >/dev/null 2>&1 || { echo "❌ serve 未安装，尝试全局安装..."; npm install -g serve; }
echo "  ✅ serve $(npx serve --version)"
echo ""

# 5. 构建前端 + 后端（模拟构建阶段）
echo "--- 5/5 构建产物验证 ---"
cd "$ROOT_DIR" && pnpm build 2>&1 | tail -5
echo "  ✅ 构建成功（dist/ + server/dist/）"

echo ""
echo "=========================================="
echo "  ✅ 所有预检步骤通过"
echo "  注意: 无法模拟 node:24-alpine 环境差异"
echo "  （如缺少 corepack、glibc 兼容性等）"
echo "=========================================="