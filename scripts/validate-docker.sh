#!/bin/bash
# =============================================================================
# validate-docker.sh — Docker 配置验证脚本
# 交付前运行，确保无遗漏
# =============================================================================
set -euo pipefail

ERRORS=0
WARNINGS=0

error() { echo "FAIL: $1" >&2; ERRORS=$((ERRORS + 1)); }
ok()    { echo "OK: $1" >&2; }
warn()  { echo "WARN: $1" >&2; WARNINGS=$((WARNINGS + 1)); }

echo "=========================================="
echo "  Docker 配置验证"
echo "=========================================="
echo ""

# ─── 1. Shell 脚本语法检查 ───
echo "--- 1. Shell 脚本语法 ---"
for script in scripts/docker-build.sh scripts/docker-run.sh scripts/start.sh scripts/detect-mirror.sh; do
  if [ -f "$script" ]; then
    if bash -n "$script" 2>/dev/null; then
      ok "$script 语法正确"
    else
      error "$script 语法错误"
    fi
  else
    warn "$script 不存在"
  fi
done
echo ""

# ─── 2. Dockerfile 存在性 ───
echo "--- 2. Dockerfile ---"
if [ -f "Dockerfile" ]; then
  ok "Dockerfile 存在"
else
  error "Dockerfile 不存在"
fi
echo ""

# ─── 3. OCI LABEL 完整性 ───
echo "--- 3. OCI LABEL ---"
for label in "org.opencontainers.image.title" "org.opencontainers.image.version" "org.opencontainers.image.created" "org.opencontainers.image.revision"; do
  if grep -q "$label" Dockerfile 2>/dev/null; then
    ok "LABEL $label"
  else
    error "缺少 LABEL $label"
  fi
done
echo ""

# ─── 4. 多阶段构建 ───
echo "--- 4. 多阶段构建 ---"
STAGE_COUNT=$(grep -c "^FROM " Dockerfile 2>/dev/null || echo 0)
if [ "$STAGE_COUNT" -ge 3 ]; then
  ok "多阶段构建: ${STAGE_COUNT} 阶段"
else
  error "阶段数不足: ${STAGE_COUNT} (需要至少 3)"
fi

# 检查阶段命名
for stage in deps builder runner; do
  if grep -q "AS ${stage}" Dockerfile 2>/dev/null; then
    ok "阶段命名: ${stage}"
  else
    error "缺少阶段: ${stage}"
  fi
done
echo ""

# ─── 5. 安全: 非 root 运行 ───
echo "--- 5. 非 root 运行 ---"
if grep -q "^USER node" Dockerfile 2>/dev/null; then
  ok "USER node 配置"
else
  error "缺少 USER node"
fi

if grep -q "chown.*node:node" Dockerfile 2>/dev/null; then
  ok "文件属主配置"
else
  warn "未显式配置文件属主"
fi
echo ""

# ─── 6. HEALTHCHECK ───
echo "--- 6. HEALTHCHECK ---"
if grep -q "^HEALTHCHECK" Dockerfile 2>/dev/null; then
  ok "HEALTHCHECK 配置存在"
  # 检查参数
  if grep -q "interval=" Dockerfile 2>/dev/null; then
    ok "interval 参数"
  else
    warn "缺少 interval 参数"
  fi
  if grep -q "timeout=" Dockerfile 2>/dev/null; then
    ok "timeout 参数"
  else
    warn "缺少 timeout 参数"
  fi
  if grep -q "start-period=" Dockerfile 2>/dev/null; then
    ok "start-period 参数"
  else
    warn "缺少 start-period 参数"
  fi
else
  error "缺少 HEALTHCHECK"
fi
echo ""

# ─── 7. 镜像源检测 ───
echo "--- 7. 镜像源检测 ---"
if [ -f "scripts/detect-mirror.sh" ]; then
  ok "detect-mirror.sh 存在"
  
  # 检查日志输出到 stderr
  if grep -q '>&2' scripts/detect-mirror.sh 2>/dev/null; then
    ok "日志输出到 stderr"
  else
    error "日志未输出到 stderr"
  fi
  
  # 检查 --clear-cache 支持
  if grep -q '\-\-clear-cache' scripts/detect-mirror.sh 2>/dev/null; then
    ok "--clear-cache 支持"
  else
    error "缺少 --clear-cache 支持"
  fi
else
  error "detect-mirror.sh 不存在"
fi

# 检查 Dockerfile 中的调用方式
if grep -q 'DEPLOY_REGION.*cn.*global' Dockerfile 2>/dev/null; then
  ok "Dockerfile 正确处理 DEPLOY_REGION=auto"
else
  error "Dockerfile 未正确处理 DEPLOY_REGION"
fi
echo ""

# ─── 8. tar 归档 ───
echo "--- 8. tar 归档 ---"
if grep -q "tar cf.*node_modules" Dockerfile 2>/dev/null; then
  ok "node_modules tar 归档"
else
  warn "未使用 tar 归档 node_modules"
fi

if grep -q "\-\-no-same-owner" Dockerfile 2>/dev/null; then
  ok "tar 解压使用 --no-same-owner"
else
  error "tar 解压未使用 --no-same-owner"
fi
echo ""

# ─── 9. apt 缓存清理 ───
echo "--- 9. apt 缓存清理 ---"
if grep -q "rm -rf /var/lib/apt/lists" Dockerfile 2>/dev/null; then
  ok "apt 缓存清理"
else
  error "缺少 apt 缓存清理"
fi

if grep -q "\-\-no-install-recommends" Dockerfile 2>/dev/null; then
  ok "--no-install-recommends"
else
  error "缺少 --no-install-recommends"
fi
echo ""

# ─── 10. .dockerignore ───
echo "--- 10. .dockerignore ---"
if [ -f ".dockerignore" ]; then
  ok ".dockerignore 存在"
  for pattern in "node_modules" ".git" ".env" "Dockerfile"; do
    if grep -q "$pattern" .dockerignore 2>/dev/null; then
      ok "排除: $pattern"
    else
      warn "未排除: $pattern"
    fi
  done
else
  error ".dockerignore 不存在"
fi
echo ""

# ─── 11. 端口一致性 ───
echo "--- 11. 端口一致性 ---"
DOCKERFILE_PORT=$(grep "ENV DEPLOY_RUN_PORT" Dockerfile 2>/dev/null | grep -oE '[0-9]+' | head -1)
DOCKERFILE_EXPOSE=$(grep "^EXPOSE" Dockerfile 2>/dev/null | grep -oE '[0-9]+' | head -1)

if [ -n "$DOCKERFILE_PORT" ] && [ -n "$DOCKERFILE_EXPOSE" ]; then
  if [ "$DOCKERFILE_PORT" = "$DOCKERFILE_EXPOSE" ]; then
    ok "端口一致: ${DOCKERFILE_PORT}"
  else
    error "端口不一致: ENV=${DOCKERFILE_PORT}, EXPOSE=${DOCKERFILE_EXPOSE}"
  fi
else
  error "无法提取端口配置"
fi
echo ""

# ─── 12. 参数解析测试 ───
echo "--- 12. 参数解析 ---"
# 测试 docker-build.sh 参数解析
if [ -f "scripts/docker-build.sh" ]; then
  # 测试 --help
  if bash scripts/docker-build.sh --help 2>&1 | grep -q "用法"; then
    ok "docker-build.sh --help"
  else
    error "docker-build.sh --help 失败"
  fi
  
  # 测试未知参数
  if bash scripts/docker-build.sh --unknown-param 2>/dev/null; then
    error "docker-build.sh 未拒绝未知参数"
  else
    ok "docker-build.sh 拒绝未知参数"
  fi
fi
echo ""

# ─── 13. 错误处理 ───
echo "--- 13. 错误处理 ---"
# 检查是否有不当的 || true
if grep -q "|| true" scripts/start.sh 2>/dev/null; then
  # 检查是否在合理场景（如 kill/wait）
  BAD_TRUE=$(grep "|| true" scripts/start.sh 2>/dev/null | grep -v "kill\|wait" || true)
  if [ -n "$BAD_TRUE" ]; then
    warn "start.sh 中可能存在不当的 || true"
  else
    ok "start.sh 错误处理合理"
  fi
fi
echo ""

# ─── 总结 ───
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
  echo "  ✅ 所有检查通过!"
  if [ $WARNINGS -gt 0 ]; then
    echo "  ⚠️  ${WARNINGS} 个警告"
  fi
  exit 0
else
  echo "  ❌ ${ERRORS} 个错误, ${WARNINGS} 个警告"
  exit 1
fi
