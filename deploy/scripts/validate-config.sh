#!/bin/bash
# VibeAI 配置验证脚本
# 用法: ./deploy/scripts/validate-config.sh [.env 路径]
set -Eeuo pipefail

ENV_FILE="${1:-.env}"
[ -f "${ENV_FILE}" ] || { echo "❌ 配置缺失: ${ENV_FILE}（请先 cp .env.example .env）"; exit 1; }

# shellcheck disable=SC1090
set -a; . "${ENV_FILE}"; set +a

echo "🔍 验证 ${ENV_FILE} ..."
FAILED=0
check() { # name, condition, hint
  if eval "$2"; then echo "  ✓ $1"; else echo "  ❌ $1 $3"; FAILED=1; fi
}

check "DATABASE_URL 已设置"        '[ -n "${DATABASE_URL:-}" ]' "(DATABASE_URL)"
check "JWT_SECRET 为强密钥(≥32)"   '[ ${#JWT_SECRET:-0} -ge 32 ]' "(长度 ${#JWT_SECRET:-0})"
check "JWT_SECRET 非占位密钥"      '[[ "${JWT_SECRET:-}" != *"change"* && "${JWT_SECRET:-}" != *"vibeai-"* ]]' "(含占位关键字)"
check "PORT 已设置"                '[ -n "${PORT:-}" ]' "(PORT)"

if [ "${FAILED}" = 1 ]; then
  echo "❌ 配置验证未通过（见上方 ❌ 项）"
  exit 1
fi
echo "✅ 配置验证通过"
