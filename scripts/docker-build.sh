#!/bin/bash
# =============================================================================
# docker-build.sh — Docker 镜像构建脚本
# 用法: ./scripts/docker-build.sh [--region=cn|global|auto] [--tag=TAG] [--no-cache]
# =============================================================================
set -euo pipefail

# ─── 默认值 ───
PROJECT_NAME="vibeai"
PROJECT_VERSION="1.0.0"
DEPLOY_REGION="auto"
IMAGE_TAG=""
NO_CACHE=""
DOCKERFILE="Dockerfile"

# ─── 日志函数（输出到 stderr）───
info()  { echo "[INFO] $1" >&2; }
ok()    { echo "[OK] $1" >&2; }
error() { echo "[ERROR] $1" >&2; }

# ─── 参数解析（while 循环，非 for）───
while [ $# -gt 0 ]; do
  case $1 in
    --region=*)   DEPLOY_REGION="${1#*=}"; shift ;;
    --region)     DEPLOY_REGION="$2"; shift 2 ;;
    --tag=*)      IMAGE_TAG="${1#*=}"; shift ;;
    --tag)        IMAGE_TAG="$2"; shift 2 ;;
    --no-cache)   NO_CACHE="--no-cache"; shift ;;
    --help|-h)
      echo "用法: $0 [--region=cn|global|auto] [--tag=TAG] [--no-cache]" >&2
      echo "" >&2
      echo "选项:" >&2
      echo "  --region    部署区域: auto(自动检测) | cn(国内) | global(国际)" >&2
      echo "  --tag       镜像标签 (默认: ${PROJECT_NAME}:${PROJECT_VERSION})" >&2
      echo "  --no-cache  不使用构建缓存" >&2
      exit 0
      ;;
    *)
      error "未知参数: $1"
      exit 1
      ;;
  esac
done

# ─── 默认标签 ───
if [ -z "$IMAGE_TAG" ]; then
  IMAGE_TAG="${PROJECT_NAME}:${PROJECT_VERSION}"
fi

# ─── 预检 ───
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "  Docker 构建预检"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 检查 Docker 服务
if ! docker info >/dev/null 2>&1; then
  error "Docker 服务未运行"
  exit 1
fi
ok "Docker 服务正常"

# 2. 检查磁盘空间（至少 5GB）
AVAILABLE_GB=$(df -BG . | tail -1 | awk '{print $4}' | tr -d 'G')
if [ "$AVAILABLE_GB" -lt 5 ]; then
  error "磁盘空间不足: ${AVAILABLE_GB}GB 可用 (需要至少 5GB)"
  exit 1
fi
ok "磁盘空间: ${AVAILABLE_GB}GB 可用"

# 3. 检查 Dockerfile
if [ ! -f "$DOCKERFILE" ]; then
  error "Dockerfile 不存在"
  exit 1
fi
ok "Dockerfile 存在"

# 4. 检查 .dockerignore
if [ ! -f ".dockerignore" ]; then
  error ".dockerignore 不存在"
  exit 1
fi
ok ".dockerignore 存在"

# 5. 检查 detect-mirror.sh
if [ ! -f "scripts/detect-mirror.sh" ]; then
  error "scripts/detect-mirror.sh 不存在"
  exit 1
fi
ok "detect-mirror.sh 存在"

info ""
info "构建参数:"
info "  镜像: ${IMAGE_TAG}"
info "  区域: ${DEPLOY_REGION}"
info "  缓存: ${NO_CACHE:-启用}"
info ""

# ─── 获取 Git 信息 ───
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ─── 构建 ───
info "开始构建..."
docker build \
  --build-arg PROJECT_NAME="${PROJECT_NAME}" \
  --build-arg PROJECT_VERSION="${PROJECT_VERSION}" \
  --build-arg BUILD_DATE="${BUILD_DATE}" \
  --build-arg GIT_COMMIT="${GIT_COMMIT}" \
  --build-arg DEPLOY_REGION="${DEPLOY_REGION}" \
  --tag "${IMAGE_TAG}" \
  ${NO_CACHE} \
  -f "${DOCKERFILE}" \
  .

info ""
ok "构建完成: ${IMAGE_TAG}"
info ""
info "镜像信息:"
docker images "${IMAGE_TAG}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
