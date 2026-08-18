# 前端开发环境说明

本文件描述 VibeAI 前端的本地开发环境搭建、启动方式与端口约定。适用于在**开发机**（本机 `/home/dev/vibeai`）上日常开发。

## 1. 技术栈与架构

| 层 | 技术 | 端口 | 说明 |
|----|------|------|------|
| 前端 | Vite 7 + React 19 + shadcn/ui + Tailwind CSS v4 | **5001** | 浏览器访问入口，`/api`、`/ws` 由 Vite 代理转发 |
| 后端 | NestJS 11 + TypeScript 5 + Drizzle ORM | **3001** | API 服务（认证/网关/存储/计费等） |
| 数据库 | PostgreSQL 16 | 5432 | 本地 dev 库 |

- 前端源码在仓库根目录 `src/`；共享 Zod schema/类型在 `shared/`；后端在 `server/`。
- Vite 代理：`/api/* → http://localhost:3001`、`/ws/* → ws://localhost:3001`（`vite.config.ts`）。

## 2. 端口约定（重要）

> **前端固定使用 5001，不是 5000。**

本机 `127.0.0.1:5000` 已被 **Forge 本地镜像仓库**（`forge-registry-1`，`registry:2.8.3` 容器）占用
（docker daemon 将其配置为 `registry-mirror` + `insecure-registry`），**不能再跑前端**。

端口来源链：

| 配置 | 值 | 文件 |
|------|----|------|
| `VITE_PORT` | `5001` | `.env.local`（优先级最高） |
| Vite 默认端口 | `5001` | `vite.config.ts`（`Number(env.VITE_PORT) \|\| 5001`） |
| 一键脚本前端端口 | `5001` | `scripts/dev.sh`（`FRONTEND_PORT="${DEPLOY_RUN_PORT:-5001}"`） |
| CORS 白名单 | `http://localhost:5001` | `server/.env` |

如需临时换端口：`VITE_PORT=5002 pnpm dev`，或 `DEPLOY_RUN_PORT=5002 bash scripts/dev.sh`
（记得同步把新端口加入 `server/.env` 的 `CORS_ORIGIN`）。

> 注意：`docker-compose.yml`、`.env.example`、`CONFIG.md`、`docs/DEPLOY_MINIO.md` 里的 `5000`
> 是**生产/容器内端口**（vibeai-app 容器），与本地开发无关，不要改动。

## 3. 环境准备

- Node.js ≥ 20（建议 22+）、pnpm ≥ 9（**仅允许 pnpm**）
- PostgreSQL 16 本地实例（`server/.env` 默认 `postgres://postgres:postgres@localhost:5432/vibeai`）

```bash
# 安装依赖（仓库根 + server）
pnpm install
(cd server && pnpm install)
```

## 4. 启动方式

### 方式 A：分开启动（推荐日常开发）

```bash
# 终端 1：后端（自动执行 DB 迁移 + AI 模型种子）
cd server && pnpm dev          # → http://localhost:3001/api/health

# 终端 2：前端
pnpm dev                       # → http://localhost:5001
```

### 方式 B：一键脚本（前后端同启，含依赖安装/后端构建/前端自动重启）

```bash
bash scripts/dev.sh            # 前端 http://localhost:5001，后端 http://localhost:3001
```

### 方式 C：E2E 测试环境

```bash
# 后端以 INTEGRATION_TEST=true 启动（跳过限流）
cd server && INTEGRATION_TEST=true pnpm dev
# 前端
pnpm dev
# 跑 E2E（默认连 localhost:5001）
E2E_BASE_URL=http://localhost:5001 npx playwright test
```

## 5. 关键环境变量

| 变量 | 位置 | 说明 |
|------|------|------|
| `VITE_PORT=5001` | `.env.local` | 前端端口 |
| `DATABASE_URL` | `.env.local` / `server/.env` | 数据库连接（dev 用本地库） |
| `PORT=3001` | `server/.env` | 后端端口 |
| `CORS_ORIGIN=http://localhost:5001,http://localhost:5173` | `server/.env` | 跨域白名单 |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | `server/.env` | JWT 签名密钥 |
| `STORAGE_PROVIDER` | （可选） | `s3` / `local`，缺省本地磁盘存储 |
| `COZE_PROJECT_DOMAIN_DEFAULT` | （可选） | 参考图相对 URL → 绝对 URL 的兜底域名；未配置时由请求 Host 自动推导 |

> 若后端未启动，前端页面 API 请求会 502/网络错误；先确认 `http://localhost:3001/api/health` 返回 200。

## 6. 常用命令

```bash
pnpm lint            # ESLint（含 design/no-hardcoded-colors 自定义规则）
pnpm design-check    # DESIGN.md 合规扫描（pre-commit 门禁）
pnpm tsc             # 前端类型检查（仓库根 tsconfig）
(cd server && npx tsc --noEmit -p tsconfig.json)   # 后端类型检查
(cd server && npx vitest run)                      # 后端测试（859+ tests）
pnpm test            # 前端 vitest
E2E_BASE_URL=http://localhost:5001 npx playwright test   # E2E
pnpm build           # 生产构建（scripts/build.sh）
```

## 7. 设计规范约束（必须遵守）

- 颜色一律使用 shadcn/ui 语义化 CSS 变量，**禁止硬编码 Hex/RGB/HSL/Tailwind 原生色**
  （例外仅 `bg-black/50`、`bg-white/10` 遮罩、`text-amber-600`/`bg-amber-500/10` 警告徽章）。
- 优先使用标准组件库：`import { Button, Badge, Progress, Skeleton, EmptyState } from '@/components/ui'`。
- 提交前必须通过：`pnpm lint` + `pnpm design-check` + 前后端测试。

## 8. 常见问题

| 现象 | 原因与处理 |
|------|-----------|
| 前端起不来：`Port 5000 is already in use` | 5000 被 Forge registry 占用，确认走 5001（`VITE_PORT` / `scripts/dev.sh` 已默认 5001） |
| 页面请求 API 失败 | 后端未启动或端口不对：`curl http://localhost:3001/api/health` 应为 200 |
| 图片编辑任务输出"乱七八糟/男人图" | 参考图未进模型（旧版 adapter 丢弃 referenceImages）。修复后 adapter 有参考图走 `POST /images/edits` multipart；升级后端代码后重试 |
| 参考图下载失败（相对路径） | 网关层用请求 Host 兜底转绝对 URL；`COZE_PROJECT_DOMAIN_DEFAULT` 为空时依赖 `x-forwarded-*`/Host 头 |
| 数据库表结构变化 | 后端启动自动跑 `server/drizzle/` 迁移；手动执行 `pnpm db:migrate`、`pnpm db:seed` |

## 9. 快速自检清单（新机器/新环境）

```bash
ss -ltnp | grep -E ':5001|:3001|:5000'   # 5000=forge-registry, 5001=前端(未起时无), 3001=后端
curl -s http://127.0.0.1:5000/v2/ | head -c 20   # forge registry 正常(不影响前端)
pnpm install && (cd server && pnpm install)
cd server && pnpm dev &                       # 后端
pnpm dev                                      # 前端 → http://localhost:5001
```
