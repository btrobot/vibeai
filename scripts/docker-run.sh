#!/bin/bash
# =============================================================================
# docker-run.sh — Docker 容器运行脚本
# 用法: ./scripts/docker-run.sh [--port=PORT] [--env-file=FILE] [--detach] [--region=cn|global]
# =============================================================================
set -euo pipefail

# ─── 默认值 ───
PROJECT_NAME="vibeai"
PROJECT_VERSION="1.0.0"
IMAGE_TAG="${PROJECT_NAME}:${PROJECT_VERSION}"
CONTAINER_NAME="${PROJECT_NAME}"
HOST_PORT="5000"
CONTAINER_PORT="5000"
ENV_FILE=""
DETACH=""
DEPLOY_REGION="auto"
EXTRA_ENV=""

# ─── 日志函数（输出到 stderr）───
info()  { echo "[INFO] $1" >&2; }
ok()    { echo "[OK] $1" >&2; }
error() { echo "[ERROR] $1" >&2; }

# ─── 参数解析（while 循环，非 for）───
while [ $# -gt 0 ]; do
  case $1 in
    --port=*)       HOST_PORT="${1#*=}"; shift ;;
    --port)         HOST_PORT="$2"; shift 2 ;;
    --env-file=*)   ENV_FILE="${1#*=}"; shift ;;
    --env-file)     ENV_FILE="$2"; shift 2 ;;
    --detach|-d)    DETACH="--detach"; shift ;;
    --region=*)     DEPLOY_REGION="${1#*=}"; shift ;;
    --region)       DEPLOY_REGION="$2"; shift 2 ;;
    --env=*)        EXTRA_ENV="${EXTRA_ENV} --env ${1#*=}"; shift ;;
    --help|-h)
      echo "用法: $0 [选项]" >&2
      echo "" >&2
      echo "选项:" >&2
      echo "  --port       宿主机端口 (默认: 5000)" >&2
      echo "  --env-file   环境变量文件 (默认: .env.local → .env)" >&2
      echo "  --detach     后台运行" >&2
      echo "  --region     部署区域: auto | cn | global" >&2
      echo "  --env=KEY=VALUE  额外环境变量 (可多次使用)" >&2
      exit 0
      ;;
    *)
      error "未知参数: $1"
      exit 1
      ;;
  esac
done

# ─── 预检 ───
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "  Docker 运行预检"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 检查镜像存在
if ! docker image inspect "${IMAGE_TAG}" >/dev/null 2>&1; then
  error "镜像不存在: ${IMAGE_TAG}"
  error "请先运行: ./scripts/docker-build.sh"
  exit 1
fi
ok "镜像存在: ${IMAGE_TAG}"

# 2. 查找环境变量文件
if [ -z "$ENV_FILE" ]; then
  if [ -f ".env.local" ]; then
    ENV_FILE=".env.local"
  elif [ -f ".env" ]; then
    ENV_FILE=".env"
  fi
fi

if [ -n "$ENV_FILE" ]; then
  if [ ! -f "$ENV_FILE" ]; then
    error "环境变量文件不存在: ${ENV_FILE}"
    exit 1
  fi
  ok "环境变量文件: ${ENV_FILE}"
else
  info "未找到环境变量文件，使用默认配置"
fi

# 3. 检查端口是否被占用
if command -v ss >/dev/null 2>&1; then
  if ss -tlnp "sport = :${HOST_PORT}" 2>/dev/null | grep -q LISTEN; then
    error "端口 ${HOST_PORT} 已被占用"
    exit 1
  fi
fi
ok "端口 ${HOST_PORT} 可用"

# 4. 清理同名旧容器（如存在）
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  info "清理旧容器: ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1
fi

info ""
info "运行参数:"
info "  镜像: ${IMAGE_TAG}"
info "  容器: ${CONTAINER_NAME}"
info "  端口: ${HOST_PORT}:${CONTAINER_PORT}"
info "  环境: ${ENV_FILE:-默认}"
info "  模式: ${DETACH:-前台}"
info ""

# ─── 构建 docker run 命令 ───
RUN_ARGS=(
  --name "${CONTAINER_NAME}"
  -p "${HOST_PORT}:${CONTAINER_PORT}"
  --restart unless-stopped
)

# 添加环境变量文件
if [ -n "$ENV_FILE" ]; then
  RUN_ARGS+=(--env-file "${ENV_FILE}")
fi

# 添加后台运行标志
if [ -n "$DETACH" ]; then
  RUN_ARGS+=(--detach)
fi

# 添加额外环境变量
if [ -n "$EXTRA_ENV" ]; then
  # shellcheck disable=SC2086
  RUN_ARGS+=($EXTRA_ENV)
fi

# ─── 启动容器 ───
info "启动容器..."
docker run "${RUN_ARGS[@]}" "${IMAGE_TAG}"

# ─── 后台模式: 等待就绪并输出状态 ───
if [ -n "$DETACH" ]; then
  info "等待服务就绪..."
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:${HOST_PORT}/api/health" >/dev/null 2>&1; then
      ok "服务已就绪!"
      info ""
      info "访问地址: http://localhost:${HOST_PORT}"
      info "查看日志: docker logs -f ${CONTAINER_NAME}"
      info "停止服务: docker stop ${CONTAINER_NAME}"
      exit 0
    fi
    sleep 1
  done
  error "服务启动超时 (30s)"
  error "查看日志: docker logs ${CONTAINER_NAME}"
  exit 1
fi
