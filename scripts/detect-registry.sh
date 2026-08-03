#!/usr/bin/env bash
# =============================================================================
# detect-registry.sh — 自动检测环境并输出构建参数
#
# 功能:
#   1. 检测是否在腾讯云/阿里云/中国网络环境
#   2. 输出合适的 NPM_REGISTRY 和 NODE_IMAGE 值
#   3. 支持显式覆盖 (FORCE_NPM_REGISTRY / FORCE_NODE_IMAGE)
#
# 用法:
#   eval $(bash scripts/detect-registry.sh)
#   docker compose build $(bash scripts/detect-registry.sh --build-args)
#   bash scripts/detect-registry.sh --json
#
# 输出模式:
#   (默认)  export 格式:  export NPM_REGISTRY=...  export NODE_IMAGE=...
#   --build-args:  --build-arg NPM_REGISTRY=... --build-arg NODE_IMAGE=...
#   --json:       {"npm_registry":"...","node_image":"...","region":"..."}
# =============================================================================

set -euo pipefail

# ---- 默认值 ----
NPM_REGISTRY_DEFAULT="https://registry.npmjs.org"
NPM_REGISTRY_CN="https://registry.npmmirror.com"
NODE_IMAGE_DEFAULT="node:24-alpine"
NODE_IMAGE_CN="node:24-alpine"  # 基础镜像不受地域影响，保留

# ---- 1. 优先检查环境变量覆盖 ----
if [ -n "${FORCE_NPM_REGISTRY:-}" ]; then
  NPM_REGISTRY="$FORCE_NPM_REGISTRY"
  REGION="forced"
elif [ -n "${FORCE_NODE_IMAGE:-}" ]; then
  NODE_IMAGE="$FORCE_NODE_IMAGE"
fi

# ---- 2. 检测函数 ----

# 检测云厂商 metadata endpoint
detect_cloud_provider() {
  # 腾讯云: metadata.tencentyun.com (内网可达)
  if curl -s --connect-timeout 2 http://metadata.tencentyun.com/ >/dev/null 2>&1; then
    echo "tencent"
    return
  fi
  # 阿里云: 100.100.100.200
  if curl -s --connect-timeout 2 http://100.100.100.200/latest/meta-data/ >/dev/null 2>&1; then
    echo "alibaba"
    return
  fi
  # AWS: 169.254.169.254
  if curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/ >/dev/null 2>&1; then
    echo "aws"
    return
  fi
  # 华为云: 169.254.169.254 (与 AWS 共享，但 headers 不同)
  # 不做特殊判断，跟随 AWS 走国际
  echo "unknown"
}

# 检测是否在中国网络环境
is_china_network() {
  # 方法 1: 尝试连接 registry.npmjs.org，看是否超时或缓慢
  local start_time
  start_time=$(date +%s%N)
  if ! curl -s --max-time 5 --connect-timeout 3 https://registry.npmjs.org/ >/dev/null 2>&1; then
    # 连接失败，大概率在中国
    return 0
  fi
  local end_time
  end_time=$(date +%s%N)
  local elapsed=$(( (end_time - start_time) / 1000000 ))
  # 如果连接耗时 > 1.5s，说明延迟高，可能在中国
  if [ "$elapsed" -gt 1500 ]; then
    return 0
  fi
  # 方法 2: 检查 DNS 是否解析到国内 IP
  if command -v dig &>/dev/null; then
    local ips
    ips=$(dig +short registry.npmjs.org 2>/dev/null | head -5)
    for ip in $ips; do
      # 检查是否为国内 IP 段 (简化: 只看 114. 等典型国内段)
      if [[ "$ip" =~ ^114\. ]] || [[ "$ip" =~ ^223\. ]] || [[ "$ip" =~ ^180\. ]]; then
        return 0
      fi
    done
  fi
  return 1
}

# ---- 3. 执行检测 ----
if [ -z "${NPM_REGISTRY:-}" ]; then
  REGION="unknown"
  PROVIDER=$(detect_cloud_provider)

  case "$PROVIDER" in
    tencent|alibaba)
      # 腾讯云/阿里云 → 国内
      NPM_REGISTRY="$NPM_REGISTRY_CN"
      REGION="cn-${PROVIDER}"
      ;;
    aws)
      # AWS → 国际
      NPM_REGISTRY="$NPM_REGISTRY_DEFAULT"
      REGION="intl-aws"
      ;;
    *)
      # 未知云 → 网络检测
      if is_china_network; then
        NPM_REGISTRY="$NPM_REGISTRY_CN"
        REGION="cn-detect"
      else
        NPM_REGISTRY="$NPM_REGISTRY_DEFAULT"
        REGION="intl-detect"
      fi
      ;;
  esac
fi

NODE_IMAGE="${NODE_IMAGE:-$NODE_IMAGE_DEFAULT}"

# ---- 4. 输出 ----
MODE="${1:-export}"

case "$MODE" in
  --build-args)
    echo "--build-arg NPM_REGISTRY=${NPM_REGISTRY} --build-arg NODE_IMAGE=${NODE_IMAGE}"
    ;;
  --json)
    echo "{\"npm_registry\":\"${NPM_REGISTRY}\",\"node_image\":\"${NODE_IMAGE}\",\"region\":\"${REGION}\"}"
    ;;
  --env)
    # 输出 .env 格式
    echo "NPM_REGISTRY=${NPM_REGISTRY}"
    echo "NODE_IMAGE=${NODE_IMAGE}"
    echo "REGION_DETECTED=${REGION}"
    ;;
  *)
    # 默认 export 格式 (eval 友好)
    echo "export NPM_REGISTRY=${NPM_REGISTRY}"
    echo "export NODE_IMAGE=${NODE_IMAGE}"
    echo "export REGION_DETECTED=${REGION}"
    ;;
esac