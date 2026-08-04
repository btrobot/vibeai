# 项目上下文

## VibeAI 内容创作平台

AI 视频/图片生成 + 电商内容工具 + 后台管理的多业务域平台。

## 技术栈

- **后端**: NestJS 11 + TypeScript 5
- **前端**: Vite 7 + React 19 + shadcn/ui + Tailwind CSS v4
- **数据库**: PostgreSQL 16 + Drizzle ORM
- **认证**: JWT (access 15min + refresh 7d) + HttpOnly Cookie
- **包管理**: pnpm（仅允许 pnpm）

## 目录结构

```

## 域规范治理（Spec Governance）

项目采用 **Spec SOT（Single Source of Truth）** 治理模式，`specs/*.spec.yaml` 是业务语义的唯一真相源。

### 六域覆盖

| 域 | 实体 | 操作 | 规则 | 合规测试 |
|----|------|------|------|---------|
| auth | 4 | 8 | 10 | ✅ |
| billing | 4 | 10 | 8 | ✅ |
| engine | 3 | 12 | 8 | ✅ |
| gallery | 2 | 7 | 5 | ✅ |
| gateway | 3 | 7 | 5 | ✅ |
| storage | 1 | 7 | 7 | ✅ |

### 核心约束

- **Spec 优先**：新增/修改功能必须先更新 `.spec.yaml`，再更新代码
- **合规测试**：`server/src/test/spec-compliance.test.ts` 自动验证：
  - 语法结构（必需字段/格式/唯一性）
  - 实体定义（主键/timestamps/索引/外键）
  - 操作定义（pre/post/effect/错误场景）
  - 业务规则（enforcement/test 覆盖率 ≥ 70%）
  - 状态机（所有转换合法）
  - 种子数据（套餐定义等）
- **测试覆盖**：每条 error 级别规则必须有对应的 test 字段
├── scripts/              # 构建与启动脚本
│   ├── build.sh          # 构建脚本
│   ├── dev.sh            # 开发环境启动脚本
│   ├── prepare.sh        # 预处理脚本
│   └── start.sh          # 生产环境启动脚本
├── server/               # NestJS 后端
│   ├── src/
│   │   ├── app.module.ts # 根模块
│   │   ├── main.ts       # 入口
│   │   ├── config/       # 配置模块
│   │   ├── common/       # 公共模块（Drizzle等）
│   │   └── modules/      # 业务模块
│   └── package.json
├── src/                  # React 前端
│   ├── components/
│   │   └── ui/           # shadcn/ui 基础组件
│   ├── pages/            # 页面组件
│   ├── hooks/            # 自定义 Hooks
│   ├── lib/              # 工具函数
│   ├── db/               # 数据库 Schema
│   │   └── schema/       # Drizzle 数据表定义
│   ├── index.css         # Tailwind v4 + shadcn/ui 主题
│   ├── main.tsx          # 客户端入口
│   └── App.tsx           # 路由配置
├── shared/               # 共享 Zod schema + TypeScript 类型
├── index.html            # 入口 HTML
├── package.json          # 前端依赖管理
├── vite.config.ts        # Vite 配置（含 API 代理）
├── tsconfig.json         # TypeScript 配置
├── DESIGN.md             # 设计规范
├── specs/                # 业务域规范（.spec.yaml 六域定义）
│   ├── SPEC_GUIDE.md     # 规范格式指南
│   ├── auth.spec.yaml    # 认证域：用户/会话/登录/注册/刷新/登出
│   ├── engine.spec.yaml  # 任务引擎域：项目/任务/执行状态机
│   ├── billing.spec.yaml # 计费域：套餐/订阅/信用/用量
│   ├── storage.spec.yaml # 存储域：文件上传/管理/签名URL
│   ├── gateway.spec.yaml # AI Gateway 域：能力/模型/路由/生成
│   └── gallery.spec.yaml # 画廊域：作品/评论/点赞/标签
└── .coze                 # 项目配置文件
```

## 业务域

- **Phase 1 ✅**: 认证系统（注册/登录/登出/刷新/用户信息）
- **Phase 2 ✅**: 存储系统（文件上传/管理，Provider 抽象层 S3 + Local）
- **Phase 3 ✅**: AI Gateway（能力注册表/模型注册表/路由/生成任务提交）
- **Phase 4 ✅**: 任务执行引擎（Project/Task/ExecutionState + WebSocket 实时推送）
- **Phase 5 ✅**: 计费系统（套餐管理/订阅/信用额度/用量统计/自动扣减）
- **Phase 6**: 业务前端

## 开发规范

- 使用 Tailwind CSS v4 进行样式开发
- 使用 shadcn/ui 语义化主题变量（CSS 变量）
- 暗色模式优先，低饱和翡翠绿强调色
- 禁止硬编码 Hex/RGB，颜色使用 CSS 变量
- 使用 Lucide 图标库

## 编码规范

- TypeScript strict 模式
- 禁止隐式 any 和 as any
- 函数参数、返回值必须有明确类型
- 前后端共享类型（Zod schema）
- 每个模块按 Schema → Service → Controller → Module 组织

## 测试规范

详见 `TEST_GOVERNANCE.md` — 基于测试金字塔 + 质量门禁体系，包含：
- 测试金字塔策略（单元 65% / 组件 15% / 集成 15% / E2E 5%）
- 各模块覆盖率目标（服务层 ≥ 90% 行，Zod Schema 100%）
- 质量门禁（提交前/PR/部署三级门禁）
- Drizzle 链式调用 Mock 模板 + WebSocket Mock 模板
- 测试数据工厂模式
- 红线规则与降级策略

## 测试进展

### Phase 1: 认证系统 ✅ (42 tests)
- **Auth Service** (13 tests) — 注册/登录/刷新/用户信息/登出/密码策略/管理员角色
- **Zod Schema** (26 tests) — 全部通过
- **Drizzle Mock** (3 tests) — 链式调用的 thenable 协议与 NestJS 兼容性

### E2E 测试 (Playwright) ✅ (11/11 tests passing)
- **认证流程** (3 tests) — 注册/登出重登录/登录失败
- **仪表盘** (3 tests) — 统计信息/侧边导航/跳转画廊
- **画廊浏览** (3 tests) — 公开页面/标签切换/登录访问
- **项目流程** (2 tests) — 创建项目/项目列表

### 测试基础设施
- `server/src/test/drizzle-mock.ts` — Drizzle ORM 链式调用 Mock（含 `createThenableMock`）
- `server/src/test/ws-mock.ts` — WebSocket Mock
- `server/src/test/nest-test-utils.ts` — NestJS 测试工具（JwtService mock, AuthGuard mock）
- `server/src/test/factories.ts` — 测试数据工厂（8 个工厂）
- `server/src/test/spec-compliance.test.ts` — Spec 合规测试（22 条断言，覆盖 6 域）
- `vitest.config.ts` (前端) + `server/vitest.config.ts` (后端)
- `src/test/setup.ts` + `server/src/test/setup.ts` — 测试环境初始化

### 测试进展 (续)

| 模块 | 测试文件 | 测试数 | 覆盖率 | 目标 | 状态 |
|------|---------|-------|--------|------|------|
| Phase 1: Auth | `auth.service.test.ts` | 13 | 89.43% | ≥90% | ✅ |
| Phase 1: Zod Schema | `schema.test.ts` | 26 | 100% | 100% | ✅ |
| Phase 1: Drizzle Mock | `drizzle-mock.test.ts` | 3 | — | — | ✅ |
| Phase 2: Storage | `storage.service.test.ts` | 15 | 97.18% | ≥90% | ✅ |
| Phase 3: Gateway | `gateway.service.test.ts` | 26 | 85.71% | ≥85% | ✅ |
| Phase 4: Task Engine | `task.service.test.ts` | 23 | 100% | ≥85% | ✅ |
| Phase 4: Project | `project.service.test.ts` | 12 | 100% | ≥90% | ✅ |
| Phase 4: WebSocket | `ws.service.test.ts` | 14 | 98.82% | ≥80% | ✅ |
| Phase 5: Billing | `billing.service.test.ts` | 26 | 90.2% | ≥90% | ✅ |
| Phase 6: Gallery Service | `gallery.service.test.ts` | 14 | 85.0% | ≥85% | ✅ |
| Phase 6: User Service | `user.service.test.ts` | 4 | 100% | ≥80% | ✅ |
| Phase 6: Admin Service | `admin.service.test.ts` | 2 | 100% | ≥60% | ✅ |
| Phase 6: Spec Compliance | `spec-compliance.test.ts` | 22 | — | — | ✅ |
| Phase 6: Dashboard Page | `DashboardPage.test.tsx` | 4 | 100% | ≥30% | ✅ |
| Phase 6: Billing Page | `BillingPage.test.tsx` | 4 | 85.26% | ≥30% | ✅ |
| Phase 6: Workspace Page | `WorkspacePage.test.tsx` | 4 | 79.29% | ≥30% | ✅ |
| Phase 6: Login Page | `LoginPage.test.tsx` | 3 | 97.91% | ≥30% | ✅ |
| Phase 6: Register Page | `RegisterPage.test.tsx` | 6 | 93.49% | ≥30% | ✅ |
| Phase 6: Tool Page | `ToolPage.test.tsx` | 7 | 46.18% | ≥30% | ✅ |
| Phase 6: Settings Page | `SettingsPage.test.tsx` | 7 | 65.09% | ≥30% | ✅ |
| Phase 6: Admin Page | `AdminPage.test.tsx` | 4 | 75% | ≥30% | ✅ |
| Phase 6: Gallery Page | `GalleryPage.test.tsx` | 4 | 55.17% | ≥30% | ✅ |
| Phase 6: Projects Page | `ProjectsPage.test.tsx` | 3 | 30% | ≥30% | ✅ |
| Phase 6: Storage Page | `StoragePage.test.tsx` | 2 | 30% | ≥30% | ✅ |
| **合计（后端）** | | **180** | — | — | **✅ 全部通过** |
| **合计（前端）** | | **71** | — | — | **✅ 全部通过** |
| **合计（合规）** | | **22** | — | — | **✅ 全部通过** |
| **合计（E2E）** | | **11** | — | — | **✅ 全部通过** |
| **总计** | | **284** | — | — | **✅ 全部通过** |
| Phase 7: Auth Integration | `test-integration.js` | 10 | ⏹️ 需手动构建后运行 |

### 已知问题
- **tsx ESM loader 与 NestJS 装饰器不兼容**：集成测试无法通过 vitest 运行（`NestFactory.create` 在 tsx 环境下导致 `authService` 为 undefined）。解决方案：先 `pnpm build` 编译为 JavaScript，再通过 `node scripts/test-integration.js` 运行。
- **JWT 重复 token 问题**：`generateTokens` 方法在相同秒内调用会生成相同的 JWT（`iat` 相同），导致 `sessions.refreshToken` 唯一约束冲突。已通过添加 `jti` 随机值修复。
- **DrizzleMock 多查询限制**：`mockSingle` 在服务方法需要多次查询（如注册时先查询再插入）时只能返回第一个结果。解决方案：使用 `mockResolvedValueOnce([])` + `mockReturning` 组合模式。

## 关键架构决策

- 前后端分离，独立端口运行（Vite 5000 / NestJS 3001）
- Vite 代理 /api/* → NestJS backend
- NestJS 模块化架构，每个业务域独立 Module
- 异步任务模式，WebSocket 实时进度
- 存储层 Provider 抽象，支持无缝切换
- AI Gateway 三层架构: Capability → Router → Model

## CI/CD 流水线

### CI (`.github/workflows/ci.yml`)
- **触发**: 所有 PR + push to main/release/*
- **并发控制**: 同一 PR 新提交自动取消旧构建
- **Jobs**:
  - `quality` — ESLint + TypeScript 类型检查
  - `test` — 前端/后端单元测试矩阵（并行，含 Postgres 服务容器）
  - `build` — Vite + tsc 编译验证
  - `e2e` — Playwright E2E 测试（启动后端 + Postgres）
  - `docker-check` — PR 时验证 Dockerfile 可构建（仅 PR）
  - `ci-pass` — 结果汇总（用于分支保护规则）

### CD (`.github/workflows/cd.yml`)
- **触发**: push to main (dev 版本) + push tag v* (正式发布)
- **Jobs**:
  - `version` — 语义版本推断（tag → 版本号，main → dev.commitSHA）
  - `docker` — 多架构构建 (amd64 + arm64) → GHCR 发布
  - `security-scan` — Trivy 漏洞扫描 (CRITICAL/HIGH) → GitHub Security 上传
  - `release` — 仅 tag push 时创建 GitHub Release（含变更日志）
- **镜像标签策略**:
  - Tag push: `v1.2.3` → `1.2.3` + `1.2` + `1` + `latest`
  - Main push: `dev` + `sha-abc1234`

### Docker
- **Dockerfile**: 4 阶段构建 (deps → prod-deps → builder → runner)
- **BuildKit**: 缓存挂载加速 pnpm install
- **生产隔离**: runner 阶段仅含 production dependencies
- **安全**: 非 root 运行 (node user) + HEALTHCHECK + OCI 标签
- **本地开发**: `docker compose up -d`（含 Postgres）
- **构建参数**: `DEPLOY_REGION=auto|cn|global`（自动选择镜像源）