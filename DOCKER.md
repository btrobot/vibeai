# Docker 构建规范

## 原则

**最小化镜像体积，最大化构建速度，确保生产安全。**

## 文件分类

### ✅ 必须包含（构建/运行必需）

| 文件/目录 | 原因 |
|----------|------|
| `package.json` + `pnpm-lock.yaml` | 依赖安装 |
| `server/package.json` + `server/pnpm-lock.yaml` | 后端依赖 |
| `src/` | 前端源码（Vite 构建） |
| `server/src/` | 后端源码（tsc 编译） |
| `server/drizzle/` | 数据库迁移 |
| `shared/` | 前后端共享类型 |
| `scripts/start.sh` | 生产启动脚本 |
| `scripts/detect-mirror.sh` | 镜像源检测 |
| `.env.local` | 环境变量（运行时加载） |

### ❌ 必须排除（减小构建上下文）

| 文件/目录 | 原因 |
|----------|------|
| `.git/` | 版本控制，运行时不需要 |
| `node_modules/` | 容器内重新安装 |
| `dist/` | 容器内重新构建 |
| `server/dist/` | 容器内重新编译 |
| `.github/` | CI/CD 配置，运行时不需要 |
| `.husky/` | Git hooks，运行时不需要 |
| `e2e/` | E2E 测试，运行时不需要 |
| `playwright.config.ts` | E2E 配置，运行时不需要 |
| `specs/` | 业务规范文档，运行时不需要 |
| `*.test.ts` / `*.spec.ts` | 测试文件，运行时不需要 |
| `vitest.config.ts` | 测试配置，运行时不需要 |
| `tsconfig.json` | 编译配置（构建阶段需要，但已包含在源码中） |
| `.env` | 本地开发配置，生产用 `.env.local` |
| `.env.example` | 模板文件，运行时不需要 |
| `worktrees/` | Git worktrees，运行时不需要 |
| `AGENTS.md` / `DESIGN.md` | 文档，运行时不需要 |
| `README.md` | 文档，运行时不需要 |

### ⚠️ 条件包含

| 文件/目录 | 条件 |
|----------|------|
| `server/.env` | 仅本地开发，生产用 `.env.local` |
| `docker-compose.yml` | 仅本地开发，生产用 K8s/Docker Swarm |
| `Dockerfile` | 构建时需要，但不进入最终镜像 |

## 多阶段构建策略

```
deps (安装全部依赖) → prod-deps (仅生产依赖) → builder (编译) → runner (运行)
```

### 各阶段职责

| 阶段 | 基础镜像 | 职责 | 产出 |
|------|---------|------|------|
| `deps` | node:24-bookworm-slim | 安装全部依赖（含 devDependencies） | `node_modules.tar.gz` |
| `prod-deps` | node:24-bookworm-slim | 安装生产依赖 | `node_modules_prod.tar.gz` |
| `builder` | node:24-bookworm-slim | 编译前端 + 后端 | `dist.tar.gz` + `server_dist.tar.gz` |
| `runner` | node:24-bookworm-slim | 运行生产服务 | 最终镜像 |

## 环境变量规范

### 构建时变量（ARG）

| 变量 | 默认值 | 用途 |
|------|--------|------|
| `DEPLOY_REGION` | `auto` | 镜像源选择（auto/cn/global） |

### 运行时变量（ENV）

| 变量 | 必需 | 说明 |
|------|------|------|
| `NODE_ENV` | ✅ | `production` |
| `PORT` | ✅ | 服务端口（默认 5000） |
| `DEPLOY_RUN_PORT` | ✅ | 部署端口（默认 5000） |
| `DATABASE_URL` | ✅ | 数据库连接串 |
| `JWT_SECRET` | ✅ | JWT 签名密钥 |

## 安全规范

- ✅ 非 root 用户运行（`node`）
- ✅ HEALTHCHECK 健康检查
- ✅ 最小化运行时依赖（仅 `curl`）
- ✅ 不暴露敏感信息（`.env` 不提交）
- ✅ Trivy 安全扫描（CD workflow）

## 构建优化

- ✅ BuildKit 缓存挂载（pnpm store）
- ✅ tar 归档传递（避免重复 COPY）
- ✅ 层缓存优化（package.json 先于源码）
- ✅ 多架构支持（amd64 + arm64）
