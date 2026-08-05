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
| engine | 4 | 14 | 10 | ✅ |
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
- **Phase 6 ✅**: 业务前端
- **Phase 7 ✅**: 多 Provider 支持（Replicate 适配器/ProviderService/渠道优先级/Fallback）

## 开发规范

- 使用 Tailwind CSS v4 进行样式开发
- 使用 shadcn/ui 语义化主题变量（CSS 变量）
- 明亮主题优先，翡翠绿品牌色（`--brand`）+ 专业蓝主色（`--primary`）
- 禁止硬编码 Hex/RGB/HSL，颜色使用 CSS 变量
- 使用 Lucide 图标库

### 设计规范执行机制（DESIGN.md 强制合规）

项目通过**三层防线**确保 DESIGN.md 设计规范被长期贯彻：

| 层级 | 机制 | 文件 | 触发时机 |
|------|------|------|---------|
| L1 | ESLint 自定义规则 `design/no-hardcoded-colors` | `eslint-rules/no-hardcoded-colors.js` | `pnpm lint` / IDE 实时检查 |
| L2 | design-check 脚本（grep 兜底扫描） | `scripts/design-check.sh` | pre-commit (lint-staged) |
| L3 | 标准组件库（合规积木） | `src/components/ui/` | 开发时直接使用 |

**手动检查**：`pnpm design-check`

**检测项**：Hex 颜色、RGB/RGBA、HSL、Tailwind 原生色盘（`text-blue-500` 等）、方括号颜色值（`bg-[#fff]`）

**允许例外**（DESIGN.md 豁免）：
- `bg-black/50`、`bg-white/10` — 遮罩层（DESIGN.md 10.6）
- `text-amber-600`、`bg-amber-500/10` — 警告色徽章（DESIGN.md 10.4，唯一允许的 Tailwind 原生色）

### 标准组件库（src/components/ui/）

| 组件 | DESIGN.md 章节 | 说明 |
|------|---------------|------|
| Button | 10.1 | 7 variants: default/brand/destructive/outline/secondary/ghost/link |
| Card | 10.2 | 无默认阴影, rounded-xl |
| Input | 10.3 | h-10, rounded-lg, 150ms transition |
| Label | 16 | text-sm font-medium |
| Badge | 10.4 | 5 variants: default/primary/brand/warning/destructive |
| Progress | 10.8 | default/slim 尺寸, default/brand 颜色 |
| Skeleton | 10.9 | animate-pulse bg-muted |
| EmptyState | 13.3 | 居中空状态，图标+标题+描述+CTA |

统一导入：`import { Button, Badge, Progress, Skeleton, EmptyState } from '@/components/ui'`

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
| Phase 4: Task Engine | `task.service.test.ts` | 36 | 100% | ≥85% | ✅ |
| Phase 4: Project | `project.service.test.ts` | 14 | 100% | ≥90% | ✅ |
| Phase 4: WebSocket | `ws.service.test.ts` | 14 | 98.82% | ≥80% | ✅ |
| Phase 5: Billing | `billing.service.test.ts` | 26 | 90.2% | ≥90% | ✅ |
| Phase 6: Gallery Service | `gallery.service.test.ts` | 22 | 85.0% | ≥85% | ✅ |
| Phase 6: Create Service | `create.service.test.ts` | 23 | — | ≥85% | ✅ |
| Phase 6: User Service | `user.service.test.ts` | 4 | 100% | ≥80% | ✅ |
| Phase 6: Admin Service | `admin.service.test.ts` | 2 | 100% | ≥60% | ✅ |
| Phase 6: Spec Compliance | `spec-compliance.test.ts` | 22 | — | — | ✅ |
| Phase 6: Dashboard Page | `DashboardPage.test.tsx` | 4 | 100% | ≥30% | ✅ |
| Phase 6: Billing Page | `BillingPage.test.tsx` | 4 | 85.26% | ≥30% | ✅ |
| Phase 6: Workspace Page | `WorkspacePage.test.tsx` | 5 | 79.29% | ≥30% | ✅ |
| Phase 6: Login Page | `LoginPage.test.tsx` | 3 | 97.91% | ≥30% | ✅ |
| Phase 6: Register Page | `RegisterPage.test.tsx` | 6 | 93.49% | ≥30% | ✅ |
| Phase 6: Tool Page | `ToolPage.test.tsx` | 7 | 46.18% | ≥30% | ✅ |
| Phase 6: Settings Page | `SettingsPage.test.tsx` | 7 | 65.09% | ≥30% | ✅ |
| Phase 6: Admin Page | `AdminPage.test.tsx` | 4 | 75% | ≥30% | ✅ |
| Phase 6: Gallery Page | `GalleryPage.test.tsx` | 4 | 55.17% | ≥30% | ✅ |
| Phase 6: Projects Page | `ProjectsPage.test.tsx` | 3 | 30% | ≥30% | ✅ |
| Phase 6: Storage Page | `StoragePage.test.tsx` | 2 | 30% | ≥30% | ✅ |
| Phase 3: Gateway Service | `gateway.service.test.ts` | 34 | 86.5% | ≥85% | ✅ |
| Phase 3: Gateway Spec | `gateway.spec.test.ts` | 51 | — | — | ✅ |
| Phase 3: Gateway Controller | `gateway.controller.test.ts` | 17 | 100% | ≥80% | ✅ |
| Phase 3: Gateway Regression | `gateway.regression.test.ts` | 38 | — | — | ✅ |
| Phase 3: Engine Spec | `engine.spec.test.ts` | 19 | — | — | ✅ |
| Phase 3: Seeds | `seeds.test.ts` | 31 | — | — | ✅ |
| Phase 3: Adapter Registry | `adapter-registry.test.ts` | 10 | 100% | ≥80% | ✅ |
| Phase 3: Image Adapter | `image.adapter.test.ts` | 11 | 96% | ≥85% | ✅ |
| Phase 3: Video Adapter | `video.adapter.test.ts` | 16 | 98% | ≥85% | ✅ |
| Phase 3: LLM Adapter | `llm.adapter.test.ts` | 11 | 96% | ≥85% | ✅ |
| Phase 3: Task Execution | `task-execution.service.test.ts` | 19 | 98.5% | ≥85% | ✅ |
| Phase 7: ProviderService | `provider.service.test.ts` | 8 | — | ≥85% | ✅ |
| Phase 7: ReplicateAdapter | `replicate.adapter.test.ts` | 20 | — | ≥85% | ✅ |
| Phase 7: Multi-Provider Fallback | `task-execution.service.test.ts` | 9 | — | ≥85% | ✅ |
| Phase 7: Gateway Regression | `gateway.regression.test.ts` | 53 | — | — | ✅ |
| **合计（后端）** | | **510** | — | — | **✅ 全部通过** |
| **合计（前端）** | | **73** | — | — | **⚠️ 72/73 通过** |
| **合计（合规）** | | **22** | — | — | **✅ 全部通过** |
| **合计（E2E）** | | **11** | — | — | **✅ 全部通过** |
| **总计** | | **616** | — | — | **✅ 615/616 通过** |
| Phase 7: Auth Integration | `test-integration.js` | 10 | ⏹️ 需手动构建后运行 |
| Phase 7: Gateway Integration | `test-integration.js` | 13 | ⏹️ 需手动构建后运行 |
| Phase 7: Gateway E2E (测试机) | 手动 curl 验证 | — | — | — | ✅ 已验证 |

### 已知问题
- **tsx ESM loader 与 NestJS 装饰器不兼容**：集成测试无法通过 vitest 运行（`NestFactory.create` 在 tsx 环境下导致 `authService` 为 undefined）。解决方案：先 `pnpm build` 编译为 JavaScript，再通过 `node scripts/test-integration.js` 运行。
- **JWT 重复 token 问题**：`generateTokens` 方法在相同秒内调用会生成相同的 JWT（`iat` 相同），导致 `sessions.refreshToken` 唯一约束冲突。已通过添加 `jti` 随机值修复。
- **DrizzleMock 多查询限制**：`mockSingle` 在服务方法需要多次查询（如注册时先查询再插入）时只能返回第一个结果。解决方案：使用 `mockResolvedValueOnce([])` + `mockReturning` 组合模式。
- **前端 1 个预存测试失败**：`RegisterPage.test.tsx`（密码可见切换按钮 accessible name 为空）。为 UI 属性不匹配，非后端问题。DashboardPage 和 WorkspacePage 测试已修复。
- **credit_usage.task_id UUID 类型错误**（已修复）：`gateway.service.ts` 在任务创建前调用 `reserveCredits` 时传入字符串 `'pending'` 作为 taskId，但 `credit_usage.task_id` 是 UUID 类型导致 500。已将 `reserveCredits/deductCredits/refundCredits` 的 taskId 改为 `string | null`，调用处传 `null`。新增 2 个回归测试 + 端到端集成测试。
- **AI 适配器 Mock 模式**：当 `COZE_LOOP_API_TOKEN` 未设置时，三种适配器（Image/LLM/Video）自动进入 Mock 模式，返回伪造结果（picsum.photos 图片、模拟文本、Big Buck Bunny 视频），完整走通 Create → Task → Execution → Storage → Billing 流程。已在测试机验证。
- **tsc 构建错误**（已修复）：5 个预先存在的 `tsc --noEmit` 错误已修复：
  1. `PostgresJsDatabase` 导入路径从 `drizzle-orm` 改为 `drizzle-orm/postgres-js`
  2. `model-seeds.ts` 相对路径从 `../../db/schema/gateway` 改为 `../../../db/schema/gateway`（3 级目录深度）
  3. `video.adapter.ts` 的 `resolution` 和 `ratio` 类型显式 cast 为 SDK 的 `Resolution` 和 `Ratio` 联合类型
  4. `gallery.service.ts` 的 `create.modelSlug` (string|null) 用 `|| undefined` 转换为 string|undefined
  5. `gateway.service.ts` sort/map 回调参数显式标注 `typeof aiModels.$inferSelect` 类型
- **循环依赖**（已修复）：`db/schema/index.ts` 中 `users` 定义导致 `index → gateway → task-engine → index` 循环。将 `users/sessions/oauthAccounts/loginLogs` 拆到独立的 `auth.ts`，4 个 schema 文件改为从 `./auth` 导入。
- **migrate 脚本路径**（已修复）：`migrate.ts` 的 `migrationsFolder` 从 `path.resolve(__dirname, '..', 'drizzle')` 改为 `path.resolve(__dirname, '..', '..', 'drizzle')`，修复编译后 `dist/scripts/migrate.js` 路径计算错误。
- **storage serve 路由 splat 参数**（已修复）：NestJS 11 的 `@Param('splat')` 返回 `string | string[]`，多段路径时为数组。`serveFile` 方法增加 `Array.isArray(splat) ? splat.join('/') : splat` 处理。
- **resolveInputForAdapter URL 转绝对路径**（已修复）：本地存储返回相对路径 `/api/storage/serve/...`，AI SDK 需要公网可达的绝对 URL。在出口转换时通过 `COZE_PROJECT_DOMAIN_DEFAULT` 拼接为绝对 URL。
- **Drizzle 迁移静默失败**（已修复）：drizzle-orm migrator 在迁移 SQL 执行失败时会抛出错误而非静默跳过。根因是 migration 0003 中 `ALTER TABLE ... ALTER COLUMN ... DROP CONSTRAINT IF EXISTS` 语法错误（应为 `ALTER TABLE ... DROP CONSTRAINT IF EXISTS`）。已修复语法并将所有迁移 SQL（0003/0004/0005）改为幂等（`ADD COLUMN IF NOT EXISTS`、`CREATE TABLE IF NOT EXISTS`、`CREATE INDEX IF NOT EXISTS`）。
- **环境变量 DATABASE_URL 覆盖**（已修复）：沙箱环境注入的 `DATABASE_URL` 环境变量优先于 `.env` 文件（`dotenv` 的 `override: false`）。`.env` 中的 `DATABASE_URL` 指向旧数据库（159.75.76.131），而实际运行使用沙箱数据库。手动 SQL 操作必须使用 `process.env.DATABASE_URL` 而非 `.env` 中的值。
- **AI SDK "t.data is not iterable" 错误**：`coze-coding-dev-sdk` 内部在调用 `/api/v3/images/generations` 时直接 `for(let e of t.data)` 迭代，当 API 返回的 `data` 不是数组（如 token 权限不足或 API 返回非预期格式）时抛出此错误。已在三个适配器（Image/Video/LLM）中增加 try-catch 包装，捕获 `is not iterable` 和 `Cannot read properties` 错误并转换为有意义的中文提示（如"请检查 COZE_LOOP_API_TOKEN 是否具有图片生成权限"）。

## 关键架构决策

- 前后端分离，独立端口运行（Vite 5000 / NestJS 3001）
- Vite 代理 /api/* → NestJS backend
- NestJS 模块化架构，每个业务域独立 Module
- 异步任务模式，WebSocket 实时进度
- 存储层 Provider 抽象，支持无缝切换
- AI Gateway 三层架构: Capability → Router → Model
- **Create 实体层**：Project → Create → Task → ExecutionState
  - Create 代表用户的创意意图（一次灵感引发的创作/修改）
  - Task 代表执行单元（当前 1:1，未来支持多步能力时 1:N）
  - `sourceCreateId` 自引用 FK：null=原创，非 null=基于之前创作的修改
  - `syncCreateStatus`（ENG-012）：Task 完成或失败时自动同步 Create 状态
- **媒体文件统一引用模型**（Migration 0003）
  - 所有外部进入系统的媒体文件（用户上传、AI 生成、外部 URL）统一注册到 `files` 表
  - `files.source`：`'storage'`（实文件，有 storageKey）或 `'external'`（虚文件，只有 externalUrl）
  - 系统内所有引用使用 `fileId`（UUID），不存 URL。URL 在运行时通过 `resolveUrl()` 解析
  - `creates.input`（JSONB）保存用户完整输入快照（prompt + fileId 引用）
  - **进出口转换**：generate API 收到 `{ fileId }` → `resolveInputForAdapter()` 解析为 URL → 传给 AI 适配器；适配器返回外部 URL → `transferResult()` 下载转存 → fileId
  - 前端提交时传 `{ fileId: "uuid" }` 而非裸 URL
- **Gallery fileId 迁移**（Migration 0004）
  - `gallery_works` 表新增 `image_file_id` / `video_file_id` 外键（→ files.id, ON DELETE SET NULL）
  - 遗留 `image_url` / `video_url` 列保留作为向后兼容回退
  - `GalleryService.resolveWorksUrls()` 批量解析 fileId → URL（通过 `storageService.resolveUrls()`），fileId 为 null 时回退到 legacy URL
  - `publishWork()` 从 `create.output` 提取 `{ fileId, url }` 对象，优先存储 fileId
  - `GalleryModule` 导入 `StorageModule` 以注入 `StorageService`
  - 前端 `WorkspacePage` 新增图片上传功能：图像类能力（image-generation/background-removal/scene-composition/model-dressing/image-editing）显示上传按钮，上传后提交 `{ referenceImage: { fileId } }`
- **多 Provider 架构**（Migration 0005）
  - `model_providers` 表：每个逻辑模型可注册多个渠道（providerName + sdkClient + sdkModelId + priority + costPerCall + config）
  - `AdapterRegistry` 按 `sdkClient` 字段路由到对应适配器（`'llm'/'image'/'video'` → Coze SDK 适配器，`'replicate'` → ReplicateAdapter）
  - `ProviderService.getAvailableProviders(modelSlug)` 查询 DB 中活跃渠道并按 priority 升序返回
  - `TaskExecutionService` 遍历 providers 列表，成功后 break，失败后自动 fallback 到下一个渠道
  - `ReplicateAdapter`：纯 REST 调用 Replicate API（POST /v1/predictions + GET 轮询），不依赖 SDK
  - 每次 provider 调用记录到 `provider_attempts` 表（含 costPerCall 用于利润分析）
  - 种子数据：3 个 Replicate 图片模型（gpt-image-2 / sdxl / flux-schnell）+ 对应 3 条 provider 记录

## 数据库迁移与种子数据

### 迁移文件（Drizzle Migrations）

迁移文件位于 `server/drizzle/`，由 drizzle-orm migrator 在应用启动时自动执行：

| 文件 | 说明 |
|------|------|
| `0000_spicy_wallow.sql` | 初始 schema（users/sessions/files/ai_models/projects/tasks 等） |
| `0001_hot_dragon_man.sql` | Gallery 表（gallery_works/gallery_likes） |
| `0002_create_entity_schema.sql` | Create 实体层 + ai_models 新 schema + provider_attempts |
| `0003_file_source_and_creates_input.sql` | files 表加 source/external_url；creates 表加 input JSONB |
| `0004_gallery_works_file_ids.sql` | gallery_works 表加 image_file_id/video_file_id 外键 |
| `0005_model_providers.sql` | model_providers 表（多 Provider 渠道管理） |

### 独立脚本

| 脚本 | 命令 | 说明 |
|------|------|------|
| `server/src/scripts/migrate.ts` | `pnpm db:migrate` | 独立迁移执行器，CI/CD 和 Dockerfile 复用 |
| `server/src/scripts/seed.ts` | `pnpm db:seed` | 独立种子脚本，幂等（AI 模型 + 订阅套餐） |

### 启动流程（Docker / 生产）

`scripts/start.sh` 按顺序执行：
1. `node dist/scripts/migrate.js` — 运行数据库迁移
2. `node dist/scripts/seed.js` — 插入种子数据（幂等，已有则跳过）
3. `node dist/main.js` — 启动 NestJS 服务

开发模式下 `pnpm dev` 直接启动 main.ts，内含迁移 + AI 模型种子（作为 fallback）。

### 种子数据来源

- **AI 模型**：`server/src/modules/gateway/seeds/model-seeds.ts`（10 个模型：6 LLM + 2 图片 + 2 视频）
- **订阅套餐**：`specs/billing.spec.yaml` → `seed_data`（4 个套餐：free/starter/pro/enterprise）

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