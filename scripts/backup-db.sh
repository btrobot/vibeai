#!/bin/bash
# ─────────────────────────────────────────────────────────────
# 数据库每日备份脚本（PostgreSQL 逻辑备份）
#
# 功能:
#   - pg_dump 全量导出 + gzip 压缩
#   - 默认保留 7 天（BACKUP_RETENTION_DAYS 可覆盖）
#   - 自动清理过期备份
#   - 支持 --install-cron 安装每日定时任务
#
# 用法:
#   ./scripts/backup-db.sh                 # 立即执行一次备份
#   ./scripts/backup-db.sh --install-cron  # 安装每日 02:00 定时备份
#   ./scripts/backup-db.sh --dry-run       # 只打印将执行的命令，不实际备份
#
# 环境变量:
#   DATABASE_URL         连接串（postgres://user:pass@host:port/dbname）
#   BACKUP_DIR           备份目录（默认 <workspace>/backups/db）
#   BACKUP_RETENTION_DAYS 保留天数（默认 7）
# ─────────────────────────────────────────────────────────────
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "${COZE_WORKSPACE_PATH}"

# ── 参数解析 ──
INSTALL_CRON=false
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --install-cron) INSTALL_CRON=true ;;
    --dry-run) DRY_RUN=true ;;
    *) echo "[backup] 未知参数: $arg（支持 --install-cron / --dry-run）" >&2; exit 1 ;;
  esac
done

# ── 加载连接配置（.env.local > .env > 环境变量）──
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . .env.local
  set +a
fi
if [ -z "${DATABASE_URL:-}" ] && [ -f server/.env ]; then
  DB_URL_FROM_ENV=$(grep -E '^DATABASE_URL=' server/.env | tail -1 | cut -d= -f2- | tr -d '"')
  if [ -n "${DB_URL_FROM_ENV:-}" ]; then
    DATABASE_URL="${DB_URL_FROM_ENV}"
    echo "[backup] DATABASE_URL 取自 server/.env"
  fi
fi
if [ -z "${DATABASE_URL:-}" ] && [ -n "${PGDATABASE_URL:-}" ]; then
  DATABASE_URL="${PGDATABASE_URL}"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] 错误: 未找到 DATABASE_URL（请设置环境变量或在 .env.local/server/.env 中配置）" >&2
  exit 1
fi

# ── 目录与保留策略 ──
BACKUP_DIR="${BACKUP_DIR:-${COZE_WORKSPACE_PATH}/backups/db}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
mkdir -p "${BACKUP_DIR}"

if [ "${DRY_RUN}" = true ]; then
  echo "[backup] [dry-run] 备份目录: ${BACKUP_DIR}"
  echo "[backup] [dry-run] 保留天数: ${RETENTION_DAYS}"
  echo "[backup] [dry-run] 将执行: pg_dump \"\${DATABASE_URL}\" | gzip > ${BACKUP_DIR}/vibeai-<时间戳>.sql.gz"
  exit 0
fi

# ── 执行备份 ──
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/vibeai-${TIMESTAMP}.sql.gz"

echo "[backup] 开始备份 → ${BACKUP_FILE}"
if ! pg_dump --no-owner "${DATABASE_URL}" 2> >(grep -v "warning" >&2) | gzip > "${BACKUP_FILE}"; then
  echo "[backup] 错误: pg_dump 失败" >&2
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# ── 完整性校验 ──
if ! gzip -t "${BACKUP_FILE}" 2>/dev/null; then
  echo "[backup] 错误: gzip 完整性校验失败，备份文件已删除" >&2
  rm -f "${BACKUP_FILE}"
  exit 1
fi
SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[backup] ✅ 备份完成: ${BACKUP_FILE} (${SIZE})"

# ── 清理过期备份 ──
CLEANED=0
while IFS= read -r old; do
  rm -f "${old}"
  CLEANED=$((CLEANED + 1))
done < <(find "${BACKUP_DIR}" -name 'vibeai-*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" 2>/dev/null)
if [ "${CLEANED}" -gt 0 ]; then
  echo "[backup] 已清理 ${CLEANED} 个超过 ${RETENTION_DAYS} 天的旧备份"
fi

# ── 列出当前备份 ──
echo "[backup] 当前备份列表:"
find "${BACKUP_DIR}" -name 'vibeai-*.sql.gz' -type f -printf '  %f (%s bytes)\n' | sort -r

# ── 安装 cron（每日 02:00 UTC）──
if [ "${INSTALL_CRON}" = true ]; then
  CRON_LINE="0 2 * * * cd ${COZE_WORKSPACE_PATH} && ./scripts/backup-db.sh >> ${BACKUP_DIR}/backup.log 2>&1"
  if crontab -l 2>/dev/null | grep -q "scripts/backup-db.sh"; then
    echo "[backup] cron 已存在，跳过安装"
  else
    ( crontab -l 2>/dev/null; echo "${CRON_LINE}" ) | crontab -
    echo "[backup] ✅ cron 已安装: ${CRON_LINE}"
  fi
fi

echo "[backup] 完成"
