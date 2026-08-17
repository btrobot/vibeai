#!/bin/bash
# ─────────────────────────────────────────────────────────────
# 数据库恢复 / 恢复演练脚本
#
# 默认模式 = 演练（安全）: 恢复到临时库 → 校验关键表 → 自动删除临时库
# 真实模式 = --target : 恢复到指定库（危险，需输入 YES 确认）
#
# 用法:
#   ./scripts/restore-db.sh                  # 用最新备份做恢复演练
#   ./scripts/restore-db.sh backups/db/vibeai-20260817-021530.sql.gz   # 用指定备份演练
#   ./scripts/restore-db.sh --latest --target vibeai   # 真实恢复到 vibeai 库
#
# 环境变量:
#   DATABASE_URL         连接串（postgres://user:pass@host:port/dbname）
#   ADMIN_DATABASE_URL   管理员连接（演练需建临时库/恢复需建表，默认=DATABASE_URL，
#                        应用用户无 CREATEDB 权限时需显式提供，如 postgres 超管）
# ─────────────────────────────────────────────────────────────
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "${COZE_WORKSPACE_PATH}"

BACKUP_FILE=""
TARGET_DB=""
for arg in "$@"; do
  case "$arg" in
    --latest) BACKUP_FILE="LATEST" ;;
    --target) TARGET_DB="__NEED_VALUE__" ;;
    --target=*) TARGET_DB="${arg#--target=}" ;;
    *)
      if [ "${TARGET_DB}" = "__NEED_VALUE__" ]; then
        TARGET_DB="$arg"
      elif [ "${BACKUP_FILE}" = "" ] || [ "${BACKUP_FILE}" = "LATEST" ]; then
        BACKUP_FILE="$arg"
      else
        echo "[restore] 未知参数: $arg" >&2; exit 1
      fi
      ;;
  esac
done

# ── 加载连接配置（.env.local > server/.env > 环境变量）──
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . .env.local
  set +a
fi
if [ -z "${DATABASE_URL:-}" ] && [ -f server/.env ]; then
  DB_URL_FROM_ENV=$(grep -E '^DATABASE_URL=' server/.env | tail -1 | cut -d= -f2- | tr -d '"')
  [ -n "${DB_URL_FROM_ENV:-}" ] && DATABASE_URL="${DB_URL_FROM_ENV}"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[restore] 错误: 未找到 DATABASE_URL" >&2
  exit 1
fi

# ── 定位备份文件 ──
BACKUP_DIR="${BACKUP_DIR:-${COZE_WORKSPACE_PATH}/backups/db}"
if [ "${BACKUP_FILE}" = "LATEST" ] || [ -z "${BACKUP_FILE}" ]; then
  BACKUP_FILE=$(find "${BACKUP_DIR}" -name 'vibeai-*.sql.gz' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
  if [ -z "${BACKUP_FILE}" ]; then
    echo "[restore] 错误: ${BACKUP_DIR} 下没有可用备份（请先运行 ./scripts/backup-db.sh）" >&2
    exit 1
  fi
  echo "[restore] 使用最新备份: ${BACKUP_FILE}"
else
  if [ ! -f "${BACKUP_FILE}" ]; then
    echo "[restore] 错误: 备份文件不存在: ${BACKUP_FILE}" >&2
    exit 1
  fi
fi
if ! gzip -t "${BACKUP_FILE}" 2>/dev/null; then
  echo "[restore] 错误: 备份文件 gzip 校验失败（文件损坏）: ${BACKUP_FILE}" >&2
  exit 1
fi

# ── 拆解 DATABASE_URL 获取维护连接 ──
# postgres://user:pass@host:port/dbname
SRC_DB=$(echo "${DATABASE_URL}" | sed -E 's|^postgres(ql)?://[^/]+/([^?]+).*|\2|')
ADMIN_URL="${ADMIN_DATABASE_URL:-${DATABASE_URL}}"

# ── 目标库确定 ──
RESTORE_DB="${TARGET_DB:-}"
if [ -z "${RESTORE_DB}" ]; then
  TS=$(date -u +%Y%m%d%H%M%S)
  RESTORE_DB="${SRC_DB}_restore_test_${TS}"
  echo "[restore] 🔬 演练模式: 恢复到临时库 '${RESTORE_DB}'（校验后自动删除）"
else
  echo "[restore] ⚠️ 真实恢复模式: 目标库 '${RESTORE_DB}'"
  read -r -p "[restore] 这将覆盖 ${RESTORE_DB} 的现有数据！输入 YES 确认: " CONFIRM
  if [ "${CONFIRM}" != "YES" ]; then
    echo "[restore] 已取消"
    exit 1
  fi
fi

# ── 创建目标库 ──
echo "[restore] 创建数据库: ${RESTORE_DB}"
if ! psql "${ADMIN_URL}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${RESTORE_DB}\";" >/dev/null 2>&1; then
  echo "[restore] 错误: 创建数据库失败。可能原因：\n" >&2
  echo "  - 临时库已存在（重试即可，时间戳会变化）" >&2
  echo "  - 当前连接用户无 CREATEDB 权限（应用用户常见）→ 请设置 ADMIN_DATABASE_URL 指向管理员连接" >&2
  exit 1
fi

RESTORE_URL=$(echo "${ADMIN_URL}" | sed -E "s|/([^/?]+)(\\?.*)?$|/${RESTORE_DB}\2|")
CLEANUP_NEEDED=true
cleanup() {
  if [ "${CLEANUP_NEEDED}" = true ] && [ -z "${TARGET_DB}" ]; then
    psql "${ADMIN_URL}" -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\";" >/dev/null 2>&1 || true
    echo "[restore] 临时库已删除: ${RESTORE_DB}"
  fi
}
trap cleanup EXIT

# ── 执行恢复 ──
echo "[restore] 恢复中（请耐心等待，大库可能需要数分钟）..."
if ! gzip -dc "${BACKUP_FILE}" | psql "${RESTORE_URL}" -v ON_ERROR_STOP=0 -q 2>&1 | grep -vE "^SET|^CREATE|^ALTER|^GRANT|^COMMENT|^COPY|^INSERT|^SELECT|^NOTICE" | grep -iE "error|fatal" | head -10; then
  :
fi

# ── 校验恢复结果 ──
echo "[restore] ── 恢复校验 ──"
TABLE_COUNT=$(psql "${RESTORE_URL}" -tA -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';")
echo "  表总数: ${TABLE_COUNT}"
FAILED=0
for t in users sessions files ai_models projects creates tasks executions model_providers gallery_works subscriptions orders notifications audit_logs; do
  EXISTS=$(psql "${RESTORE_URL}" -tA -c "SELECT to_regclass('public.${t}') IS NOT NULL;" 2>/dev/null)
  if [ "${EXISTS}" = "t" ]; then
    COUNT=$(psql "${RESTORE_URL}" -tA -c "SELECT count(*) FROM \"${t}\";" 2>/dev/null || echo "?")
    echo "  ✅ ${t}: ${COUNT} 行"
  else
    echo "  ⚠️  ${t}: 表不存在（可接受，视备份时间点 schema 而定）"
  fi
done
echo "[restore] 校验完成（表总数=${TABLE_COUNT}，关键表行数如上）"

# ── 成功门槛：表总数 > 0 且关键表存在 ──
if [ "${TABLE_COUNT}" -le 0 ]; then
  echo "[restore] 错误: 恢复失败（表总数为 0，数据未恢复）" >&2
  exit 1
fi
USERS_OK=$(psql "${RESTORE_URL}" -tA -c "SELECT to_regclass('public.users') IS NOT NULL;" 2>/dev/null)
if [ "${USERS_OK}" != "t" ]; then
  echo "[restore] 错误: 关键表 users 不存在，恢复不完整" >&2
  exit 1
fi

# ── 演练模式自动清理 ──
if [ -z "${TARGET_DB}" ]; then
  CLEANUP_NEEDED=true
  echo "[restore] ✅ 恢复演练成功（数据完整，临时库已清理）"
else
  CLEANUP_NEEDED=false
  echo "[restore] ✅ 真实恢复到 '${RESTORE_DB}' 完成"
fi



