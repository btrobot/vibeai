#!/bin/bash
# ============================================================
# 镜像源自动检测脚本 — detect-mirror.sh
# 功能：自动检测当前网络环境，选择最优镜像源
# 用法：./detect-mirror.sh [--force-cn|--force-global|--clear-cache]
# ============================================================
set -euo pipefail

# ─── 镜像源配置 ───
NPM_MIRROR_CN="https://mirrors.cloud.tencent.com/npm"
NPM_MIRROR_GLOBAL="https://registry.npmjs.org"

APT_MIRROR_CN="mirrors.ustc.edu.cn"
APT_MIRROR_GLOBAL="deb.debian.org"
APT_SECURITY_CN="mirrors.ustc.edu.cn"
APT_SECURITY_GLOBAL="security.debian.org"

# 检测结果标记文件
DETECT_FLAG="/tmp/.mirror_detected"

# ─── 颜色 ───
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
info()  { echo -e "${BLUE}[detect]${NC} $1" >&2; }
ok()    { echo -e "${GREEN}[detect]${NC} $1" >&2; }
warn()  { echo -e "${YELLOW}[detect]${NC} $1" >&2; }

# ─── 检测网络环境 ───
detect_region() {
  # 清除缓存开关（必须在缓存判断之前）
  if [ "${1:-}" = "--clear-cache" ]; then
    rm -f "$DETECT_FLAG"
    info "缓存已清除，重新检测..."
    # 去掉 --clear-cache 参数，递归调用自身
    detect_region ""
    return $?
  fi

  # 如果已有标记，跳过检测
  if [ -f "$DETECT_FLAG" ]; then
    cat "$DETECT_FLAG"
    return
  fi

  # 强制参数覆盖
  if [ "${1:-}" = "--force-cn" ]; then
    echo "cn" > "$DETECT_FLAG"
    echo "cn"
    return
  fi
  if [ "${1:-}" = "--force-global" ]; then
    echo "global" > "$DETECT_FLAG"
    echo "global"
    return
  fi

  # 自动检测：尝试访问国内镜像（3 秒超时）
  info "检测网络环境..."
  if curl -s --max-time 3 "${NPM_MIRROR_CN}/-/ping" > /dev/null 2>&1; then
    ok "检测到国内网络环境，使用国内镜像源"
    echo "cn" > "$DETECT_FLAG"
    echo "cn"
  else
    info "国内镜像不可达，使用全球官方源"
    echo "global" > "$DETECT_FLAG"
    echo "global"
  fi
}

# ─── 配置 npm/pnpm registry ───
setup_npm() {
  local region="$1"
  if [ "$region" = "cn" ]; then
    info "设置 npm registry → $NPM_MIRROR_CN"
    npm config set registry "$NPM_MIRROR_CN"
    npm config set fetch-retries 5
    npm config set fetch-retry-mintimeout 10000
    npm config set fetch-retry-maxtimeout 60000
    # pnpm 也使用同一 registry
    if command -v pnpm &>/dev/null; then
      pnpm config set registry "$NPM_MIRROR_CN" 2>/dev/null || true
    fi
    # 导出环境变量供后续使用
    export COREPACK_REGISTRY="$NPM_MIRROR_CN"
    ok "npm registry 已配置"
  else
    info "使用官方 npm registry"
    npm config set registry "$NPM_MIRROR_GLOBAL"
    export COREPACK_REGISTRY=""
  fi
}

# ─── 配置 apt 镜像源 (Debian) ───
setup_apt() {
  local region="$1"
  local sources
  # 查找 debian.sources 或 sources.list
  if [ -f /etc/apt/sources.list.d/debian.sources ]; then
    sources="/etc/apt/sources.list.d/debian.sources"
  elif [ -f /etc/apt/sources.list ]; then
    sources="/etc/apt/sources.list"
  else
    warn "未找到 apt 源配置文件，跳过"
    return
  fi

  if [ "$region" = "cn" ]; then
    info "配置 apt 镜像源 → $APT_MIRROR_CN"
    if echo "$sources" | grep -q "debian.sources"; then
      sed -i "s|${APT_MIRROR_GLOBAL}|${APT_MIRROR_CN}|g" "$sources" 2>/dev/null || true
      sed -i "s|${APT_SECURITY_GLOBAL}|${APT_SECURITY_CN}|g" "$sources" 2>/dev/null || true
    else
      sed -i "s|${APT_MIRROR_GLOBAL}|${APT_MIRROR_CN}|g" "$sources" 2>/dev/null || true
      sed -i "s|${APT_SECURITY_GLOBAL}|${APT_SECURITY_CN}|g" "$sources" 2>/dev/null || true
    fi
    ok "apt 镜像源已配置"
  else
    # 如果是从 CN 改回 global，需要恢复
    info "使用官方 apt 源"
    if echo "$sources" | grep -q "debian.sources"; then
      sed -i "s|${APT_MIRROR_CN}|${APT_MIRROR_GLOBAL}|g" "$sources" 2>/dev/null || true
      sed -i "s|${APT_SECURITY_CN}|${APT_SECURITY_GLOBAL}|g" "$sources" 2>/dev/null || true
    fi
  fi
}

# ─── 引擎入口 ───
main() {
  local region
  region=$(detect_region "${1:-}")

  echo "" >&2
  info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if [ "$region" = "cn" ]; then
    info "  🌏 环境: 国内 (China)"
    info "  📦 npm:   ${NPM_MIRROR_CN}"
    info "  📦 apt:   ${APT_MIRROR_CN}"
  else
    info "  🌏 环境: 全球 (Global)"
    info "  📦 npm:   ${NPM_MIRROR_GLOBAL} (官方)"
    info "  📦 apt:   ${APT_MIRROR_GLOBAL} (官方)"
  fi
  info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "" >&2

  setup_npm "$region"
  setup_apt "$region"

  ok "镜像源配置完成"
  echo "" >&2
}

main "$@"