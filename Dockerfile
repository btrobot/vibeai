# syntax=docker/dockerfile:1
# ============================================================
# Dockerfile — VibeAI 内容创作平台
# Vite SPA + NestJS API (monorepo, single image)
# ============================================================
# 4 阶段构建: deps → prod-deps → builder → runner
# 基础镜像: node:24-bookworm-slim
# 要求: DOCKER_BUILDKIT=1 (Docker 23+ 默认启用)
# ============================================================

# ─── 构建参数 ───
ARG NODE_VERSION=24
ARG PROJECT_NAME=vibeai
ARG PROJECT_VERSION=1.0.0
ARG BUILD_DATE
ARG GIT_COMMIT
ARG DEPLOY_REGION=auto

# ============================================================
# 阶段 1: 全量依赖安装 (deps)
# ============================================================
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

ARG DEPLOY_REGION

# 镜像源自动检测（npm/apt/corepack）
COPY scripts/detect-mirror.sh /tmp/
RUN if [ "${DEPLOY_REGION}" = "cn" ] || [ "${DEPLOY_REGION}" = "global" ]; then \
      bash /tmp/detect-mirror.sh --force-${DEPLOY_REGION}; \
    else \
      bash /tmp/detect-mirror.sh; \
    fi

# 安装 pnpm（固定大版本，兼容 lockfile）
RUN npm install -g pnpm@9

# 前端依赖（含 devDependencies，构建阶段需要 vite/tsc 等）
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,sharing=locked,target=/root/.local/share/pnpm/store \
    HUSKY=0 pnpm install --frozen-lockfile

# 后端依赖
COPY server/package.json server/pnpm-lock.yaml ./server/
RUN --mount=type=cache,id=pnpm-store-server,sharing=locked,target=/root/.local/share/pnpm/store \
    bash -c 'cd server && HUSKY=0 pnpm install --frozen-lockfile'

# 归档 node_modules（tar 传输避免 COPY 数千小文件导致 layer 膨胀）
RUN tar cf /tmp/frontend_node_modules.tar node_modules && \
    tar cf /tmp/server_node_modules.tar server/node_modules

# ============================================================
# 阶段 2: 生产依赖裁剪 (prod-deps)
# ============================================================
FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps
WORKDIR /app

RUN npm install -g pnpm@9

# 前端生产依赖
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store-prod-fe,sharing=locked,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# 后端生产依赖
COPY server/package.json server/pnpm-lock.yaml ./server/
RUN --mount=type=cache,id=pnpm-store-prod-be,sharing=locked,target=/root/.local/share/pnpm/store \
    bash -c 'cd server && pnpm install --frozen-lockfile --prod'

# 归档生产 node_modules
RUN tar cf /tmp/frontend_prod_node_modules.tar node_modules && \
    tar cf /tmp/server_prod_node_modules.tar server/node_modules

# ============================================================
# 阶段 3: 构建应用 (builder)
# ============================================================
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app

RUN npm install -g pnpm@9

# 解压全量依赖（构建需要 devDependencies）
COPY --from=deps /tmp/frontend_node_modules.tar /tmp/
RUN tar xf /tmp/frontend_node_modules.tar -C /app --no-same-owner && \
    rm /tmp/frontend_node_modules.tar

COPY --from=deps /tmp/server_node_modules.tar /tmp/
RUN tar xf /tmp/server_node_modules.tar -C /app --no-same-owner && \
    rm /tmp/server_node_modules.tar

# 复制源码
COPY . .

# 构建前端（Vite → dist/）
RUN pnpm vite build

# 构建后端（TypeScript → server/dist/）
RUN cd server && npx tsc

# 归档构建产物
RUN tar cf /tmp/dist.tar dist && \
    tar cf /tmp/server_dist.tar server/dist

# ============================================================
# 阶段 4: 运行环境 (runner)
# ============================================================
FROM node:${NODE_VERSION}-bookworm-slim AS runner

# ─── OCI 标准标签 ───
ARG PROJECT_NAME=vibeai
ARG PROJECT_VERSION=1.0.0
ARG BUILD_DATE
ARG GIT_COMMIT
LABEL org.opencontainers.image.title="${PROJECT_NAME}"
LABEL org.opencontainers.image.description="VibeAI Content Creation Platform — AI Video/Image Generation"
LABEL org.opencontainers.image.version="${PROJECT_VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.source="https://github.com/${GITHUB_REPOSITORY:-vibeai/vibeai}"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# 最小运行时依赖
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
    && rm -rf /var/lib/apt/lists/*

# 解压生产依赖（不含 devDependencies，镜像更小）
COPY --from=prod-deps /tmp/frontend_prod_node_modules.tar /tmp/
RUN tar xf /tmp/frontend_prod_node_modules.tar -C /app --no-same-owner && \
    rm /tmp/frontend_prod_node_modules.tar

COPY --from=prod-deps /tmp/server_prod_node_modules.tar /tmp/
RUN tar xf /tmp/server_prod_node_modules.tar -C /app --no-same-owner && \
    rm /tmp/server_prod_node_modules.tar

# 解压构建产物
COPY --from=builder /tmp/dist.tar /tmp/
RUN tar xf /tmp/dist.tar -C /app --no-same-owner && \
    rm /tmp/dist.tar

COPY --from=builder /tmp/server_dist.tar /tmp/
RUN tar xf /tmp/server_dist.tar -C /app --no-same-owner && \
    rm /tmp/server_dist.tar

# 数据库迁移文件
COPY --from=builder /app/server/drizzle ./server/drizzle

# 启动脚本
COPY scripts/start.sh ./scripts/start.sh
RUN chmod +x ./scripts/start.sh

# 文件归属非 root 用户
RUN chown -R node:node /app

# ─── 运行时环境变量 ───
ENV NODE_ENV=production \
    DEPLOY_RUN_PORT=5000 \
    PORT=5000

EXPOSE 5000

# ─── 健康检查 ───
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${DEPLOY_RUN_PORT}/api/health || exit 1

# ─── 非 root 运行 ───
USER node

ENTRYPOINT ["bash", "./scripts/start.sh"]
