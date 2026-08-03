# ============================================
# Dockerfile — VibeAI 内容创作平台
# Vite SPA + NestJS API + PostgreSQL (外部)
# ============================================
# 多阶段构建: deps → builder → runner
# 基础镜像: node:24-bookworm-slim (glibc 兼容 bcrypt 原生模块)
# ============================================

# ─── 构建参数 ───
ARG PROJECT_NAME="vibeai"
ARG PROJECT_VERSION="1.0.0"
ARG BUILD_DATE
ARG GIT_COMMIT
ARG DEPLOY_REGION=auto  # auto | cn | global

# ─── OCI 标准标签 ───
LABEL org.opencontainers.image.title="${PROJECT_NAME}"
LABEL org.opencontainers.image.description="VibeAI 内容创作平台 — AI 视频/图片生成 + 电商内容工具"
LABEL org.opencontainers.image.version="${PROJECT_VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"

# ============================================
# 阶段 1: 安装依赖 (deps)
# ============================================
FROM node:24-bookworm-slim AS deps
WORKDIR /app

ARG DEPLOY_REGION

# 镜像源自动检测（npm/apt/corepack）
COPY scripts/detect-mirror.sh /tmp/
RUN if [ "${DEPLOY_REGION}" = "cn" ] || [ "${DEPLOY_REGION}" = "global" ]; then \
      bash /tmp/detect-mirror.sh --force-${DEPLOY_REGION}; \
    else \
      bash /tmp/detect-mirror.sh; \
    fi

# 安装 pnpm（corepack 在 bookworm 中可用，但 npm 安装更稳定）
RUN npm install -g pnpm@9

# 前端依赖（编译原生模块 bcrypt，跳过 husky prepare）
COPY package.json pnpm-lock.yaml ./
RUN HUSKY=0 pnpm install --frozen-lockfile

# 后端依赖
COPY server/package.json server/pnpm-lock.yaml ./server/
RUN cd server && HUSKY=0 pnpm install --frozen-lockfile

# 归档 node_modules（避免 COPY 数千小文件超时）
RUN tar cf /tmp/server_node_modules.tar server/node_modules

# ============================================
# 阶段 2: 构建应用 (builder)
# ============================================
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# 安装 pnpm（不继承 deps 阶段的全局安装）
RUN npm install -g pnpm@9

# 解压前端依赖
COPY --from=deps /app/node_modules ./node_modules
# 解压后端依赖
COPY --from=deps /tmp/server_node_modules.tar /tmp/
RUN tar xf /tmp/server_node_modules.tar -C /app --no-same-owner && \
    rm /tmp/server_node_modules.tar

# 复制源码并构建
COPY . .

# 构建前端（Vite → dist/）
RUN pnpm vite build

# 构建后端（TypeScript → server/dist/）
RUN cd server && npx tsc

# 归档构建产物
RUN tar cf /tmp/dist.tar dist && \
    tar cf /tmp/server_dist.tar server/dist

# ============================================
# 阶段 3: 运行环境 (runner)
# ============================================
FROM node:24-bookworm-slim AS runner
WORKDIR /app

# 安装运行时必需工具（curl 用于 HEALTHCHECK，bash 用于启动脚本）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      bash \
    && rm -rf /var/lib/apt/lists/*

# 解压后端生产依赖
COPY --from=deps /tmp/server_node_modules.tar /tmp/
RUN tar xf /tmp/server_node_modules.tar -C /app --no-same-owner && \
    rm /tmp/server_node_modules.tar

# 解压构建产物
COPY --from=builder /tmp/dist.tar /tmp/
RUN tar xf /tmp/dist.tar -C /app --no-same-owner && \
    rm /tmp/dist.tar

COPY --from=builder /tmp/server_dist.tar /tmp/
RUN tar xf /tmp/server_dist.tar -C /app --no-same-owner && \
    rm /tmp/server_dist.tar

# 复制数据库迁移文件
COPY --from=builder /app/server/drizzle ./server/drizzle

# 复制启动脚本
COPY scripts/start.sh ./scripts/start.sh
RUN if [ -f ./scripts/start.sh ]; then chmod +x ./scripts/start.sh; fi

# 确保所有文件归 node 用户所有（非 root 运行需要）
RUN chown -R node:node /app

# ─── 环境变量 ───
ENV NODE_ENV=production
ENV DEPLOY_RUN_PORT=5000
ENV PORT=5000

# ─── 健康检查 ───
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${DEPLOY_RUN_PORT}/api/health || exit 1

EXPOSE 5000

# ─── 非 root 运行 ───
USER node

# 启动应用（NestJS 同时提供 API 和静态文件服务）
ENTRYPOINT ["bash", "./scripts/start.sh"]
