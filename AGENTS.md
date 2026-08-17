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
| auth | 4 | 10 | 13 | ✅ |
| billing | 4 | 13 | 8 | ✅ |
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
- **Phase 8 ✅**: 安全加固（API 限流 + 存储配置兼容 + 前端测试修复）
- **Phase 9 ✅**: 密码重置 + 集成测试修复 + CustomThrottlerGuard
- **Phase 10 ✅**: 运维可观测性（结构化日志 + 深度健康检查）+ 支付准备层（Stripe Checkout + Webhook）
- **Phase 11 ✅**: 生产就绪增强（Swagger/OpenAPI + CI/CD 管道 + 优雅关停 + HTTP 请求日志 + 前端支付集成）
- **Phase 12 ✅**: 邮件服务（SMTP 集成 + 密码重置真实发信 + EmailService 全局模块）

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
- **Auth Service** (21 tests) — 注册/登录/刷新/用户信息/登出/密码策略/管理员角色/密码重置
- **Zod Schema** (26 tests) — 全部通过
- **Drizzle Mock** (3 tests) — 链式调用的 thenable 协议与 NestJS 兼容性

### E2E 测试 (Playwright) ✅ (42 tests in 8 files)
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
| Phase 1: Auth | `auth.service.test.ts` | 29 | 89.43% | ≥90% | ✅ |
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
| Phase 6: Admin Service | `admin.service.test.ts` | 25 | 100% | ≥90% | ✅ |
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
| Phase 10: Payment Service | `payment.service.test.ts` | 5 | — | ≥85% | ✅ |
| **合计（后端）** | | **553** | — | — | **✅ 全部通过** |
| **合计（前端）** | | **72** | — | — | **✅ 72/72 通过** |
| **合计（合规）** | | **22** | — | — | **✅ 全部通过** |
| **合计（E2E）** | | **11** | — | — | **✅ 全部通过** |
| **总计** | | **684** | — | — | **✅ 689/689 通过** |
| Phase 7: Auth Integration | `test-integration.js` | 10 | ✅ 32/33 通过（1 个 AI SDK token 问题） |
| Phase 7: Gateway Integration | `test-integration.js` | 13 | ✅ 含密码重置 8 项 |
| Phase 7: Gateway E2E (测试机) | 手动 curl 验证 | — | — | — | ✅ 已验证 |

### 已知问题
- **tsx ESM loader 与 NestJS 装饰器不兼容**：集成测试无法通过 vitest 运行（`NestFactory.create` 在 tsx 环境下导致 `authService` 为 undefined）。解决方案：先 `pnpm build` 编译为 JavaScript，再通过 `node scripts/test-integration.js` 运行。
- **JWT 重复 token 问题**：`generateTokens` 方法在相同秒内调用会生成相同的 JWT（`iat` 相同），导致 `sessions.refreshToken` 唯一约束冲突。已通过添加 `jti` 随机值修复。
- **DrizzleMock 多查询限制**：`mockSingle` 在服务方法需要多次查询（如注册时先查询再插入）时只能返回第一个结果。解决方案：使用 `mockResolvedValueOnce([])` + `mockReturning` 组合模式。
- **前端 RegisterPage 测试**（已修复）：`RegisterPage.test.tsx` 密码可见切换按钮的 accessible name 测试查询 `{ name: '' }` 与实际 `aria-label` 不匹配。修复为 `{ name: '显示密码' }`（密码隐藏时的初始状态）。前端测试现 73/73 全部通过。
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
- **平台维度 + 多渠道架构**（Migration 0005 → 0012）
  - `ai_platforms` 表：平台共享账号（name + baseUrl + apiKey，key 明文存 DB 运行时替换，效率优先；API 不回显）
  - `model_channels` 表：渠道实例（platformId × modelSlug × sdkModelId，unique），含 sdkClient/priority/costPerCall/costPerSecond/config
  - **三级 key 解析**：模型 defaultParams.apiKey（最高，向后兼容例外）> 渠道 config.apiKey（覆盖平台）> 平台 apiKey（默认）> 均未配置 → 显性报错（**无 Mock**）
  - `ProviderService.getAvailableProviders(modelSlug)` join 平台+渠道，config 合并（平台 baseUrl/apiKey 默认 + 渠道 config 覆盖），按 priority 升序返回
  - `TaskExecutionService` 遍历渠道列表，成功后 break，失败后自动 fallback 到下一个渠道；每次调用记录 `provider_attempts`（providerName = 平台名）
  - `AdapterRegistry` 按 `sdkClient` 路由适配器（`'llm'/'image'/'video'` → Coze SDK 适配器，`'replicate'` → ReplicateAdapter，`'openai'` → OpenAIAdapter 兼容 OpenAI 协议网关如 pptoken）
  - Admin 端 `admin/model-config`：平台 CRUD（含 Key 配置）+ 渠道 CRUD（选平台，支持复制渠道含 Key）+ 模型 CRUD + 能力路由
  - 种子数据：`SEED_PLATFORMS`（按模型 providerName 去重）+ `SEED_CHANNELS`（每模型一个渠道）
- **API 限流**（Phase 8 — @nestjs/throttler v6.5.0）
  - 全局 `ThrottlerGuard` 通过 `APP_GUARD` 注册，所有路由默认限流 100 次/分钟
  - 四层命名限流器（named throttlers）：
    - `default`：100 次/分钟（gallery 等公开端点）
    - `auth`：5 次/分钟（register/login，防暴力破解）
    - `generation`：10 次/分钟（generate/quickCreate/chat，防资源滥用）
    - `upload`：20 次/分钟（文件上传）
  - 通过 `@Throttle({ name: { ttl, limit } })` 装饰器按路由覆盖
  - 健康检查端点 `/api/health` 注册在 NestJS 之外的 Express 实例上，不受限流影响
- **存储环境变量兼容**（Phase 8）
  - `S3Provider` 同时兼容自定义变量（`S3_ENDPOINT_URL`/`S3_BUCKET_NAME`）和 SDK 默认变量（`COZE_BUCKET_ENDPOINT_URL`/`COZE_BUCKET_NAME`）
  - 未配置 S3 端点时输出警告日志，初始化成功时输出存储桶/区域信息
  - `StorageModule` 在 `useFactory` 中输出当前使用的存储提供程序类型（S3 或 Local）
- **密码重置功能**（Phase 9）
  - `POST /auth/forgot-password`：生成 JWT 重置令牌（15min 过期），未配置邮件服务时直接返回令牌
  - `POST /auth/reset-password`：验证令牌 + 更新密码 + 撤销该用户所有活跃 Session
  - 防用户枚举：无论邮箱是否注册都返回 `success=true`
  - 前端页面：`/forgot-password`（输入邮箱获取重置链接）、`/reset-password`（设置新密码）
  - 新增 `ForgotPasswordDto` / `ResetPasswordDto`，限流 `auth: 5/min`
  - Spec 更新：`auth.spec.yaml` 新增 `forgotPassword`/`resetPassword` 操作 + AUTH-011~013 规则
- **CustomThrottlerGuard**（Phase 9）
  - 继承 `ThrottlerGuard`，在 `NODE_ENV=test` 或 `INTEGRATION_TEST=true` 时跳过所有限流
  - 解决集成测试被 `@Throttle` 装饰器限流的问题（`@Throttle` 覆盖全局 `forRoot` 配置）
  - 文件：`server/src/common/throttler.guard.ts`
- **Gateway 输入校验修复**（Phase 9）
  - `generate` 接口增加 `projectId` 空值检查，空字符串返回 400 而非 500
- **结构化日志系统**（Phase 10）
  - `AppLoggerService` 实现 `NestLoggerService`，生产环境 JSON 结构化输出（timestamp/level/context/message/meta）
  - 敏感字段自动脱敏（password/token/secret/authorization/apiKey/refreshToken），递归处理嵌套对象
  - 全局模块 `LoggerModule`（`APP_LOGGER` token），开发环境人类可读格式
  - 文件：`server/src/common/logger.service.ts` + `server/src/common/logger.module.ts`
- **深度健康检查**（Phase 10）
  - `/api/health` 保持轻量（Docker HEALTHCHECK 用），`/api/health/deep` 检查 DB 连接 + 存储配置
  - `HealthService.checkHealth()` 执行 `SELECT 1` 测量 DB 延迟，检查 `STORAGE_PROVIDER` 环境变量
  - 返回 `{ status: 'ok'|'degraded'|'down', services: { db, storage } }`，degraded/down 返回 503
  - 文件：`server/src/common/health.service.ts`
- **支付准备层（Stripe Checkout + Webhook）**（Phase 10）
  - `PaymentService`：动态导入 stripe 包（未配置时不加载），`isPaymentEnabled()` 检查 `STRIPE_SECRET_KEY`
  - `POST /billing/checkout`（JwtAuthGuard）：创建 Stripe Checkout Session，`client_reference_id` 编码 `{userId, planSlug, billingCycle}`
  - `POST /billing/webhook`（无认证）：签名验证 + 事件分发（`checkout.session.completed` → 创建订阅+授信+发票；`invoice.paid` → 记录发票，幂等）
  - `GET /billing/payment-status`：返回 `{ enabled: boolean }`
  - Stripe webhook raw body 中间件在 NestJSON 解析之前捕获原始请求体，仅应用于 `/api/billing/webhook`
  - `decimal` 类型字段需 `String()` 转换以适配 Drizzle 类型
  - 文件：`server/src/modules/billing/payment.service.ts` + `billing.controller.ts` + `billing.module.ts` 更新
  - 环境变量：`stripe` 包（v22.4.0）
- **Swagger/OpenAPI 文档**（Phase 11）
  - `@nestjs/swagger` 集成，自动扫描所有 Controller 生成 API 文档
  - Swagger UI 访问路径：`/api/docs`（需在 `app.init()` 之前注册，否则被 NestJS 路由器拦截返回 404）
  - 10 个 API 标签分组：auth/billing/gateway/storage/gallery/project/task/create/user/admin
  - JWT Bearer 认证方案，支持在 UI 中直接测试需认证接口
  - 所有 Controller 添加 `@ApiTags` 装饰器
  - 环境变量：`@nestjs/swagger` 包
- **CI/CD 管道增强**（Phase 11）
  - CI 流水线：5 个 Job 并行（前端质量 + 后端质量 + 构建 + E2E + Docker）
  - `backend-quality` Job：后端 tsc 构建 + 523 测试（含 22 条 Spec 合规）
  - `e2e` Job：Playwright E2E（11 个测试），含报告上传
  - `ci-pass` 汇总 Job：用于分支保护规则
  - 并发控制：同一 PR 新提交自动取消旧构建
  - CD 流水线：版本推断（tag → 语义版本，main → dev.SHA）+ 多架构 Docker 构建 + Trivy 安全扫描 + GitHub Release
- **生产就绪增强**（Phase 11）
  - **优雅关停**：`app.enableShutdownHooks()` 处理 SIGTERM/SIGINT，WsService `onModuleDestroy()` 关闭 WebSocket
  - **HTTP 请求日志中间件**：`HttpRequestLoggerMiddleware` 记录每个 API 请求的方法/路径/状态码/耗时
    - 5xx → error 级别，4xx → warn 级别，2xx/3xx → log 级别
    - 跳过 `/api/health` 和 `/api/health/deep`（避免探活日志噪声）
    - 文件：`server/src/common/http-request-logger.middleware.ts`
  - **前端支付集成**：BillingPage 根据 `/api/billing/payment-status` 动态选择支付流程
    - 支付已启用 → Stripe Checkout 重定向（`/api/billing/checkout` → `window.location.href = data.url`）
    - 支付未启用 → 直接订阅（`/api/billing/subscription`）
    - 按月/按年计费切换器（仅支付已启用时显示）
    - 价格根据计费周期动态切换，按年显示节省金额
- **LoggerModule 修复**（Phase 11）
  - 原实现 `useClass` + 导出类导致 `UnknownExportException`
  - 修复：注册 `AppLoggerService` 为独立 provider，`APP_LOGGER` 使用 `useExisting` 别名
- **邮件服务**（Phase 12）
  - `EmailService`（`server/src/common/email.service.ts`）：基于 `nodemailer` 的 SMTP 发信服务
  - 全局模块 `EmailModule`（`@Global()`），所有模块可直接注入
  - 环境变量：`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_SECURE`/`SMTP_FROM`
  - `isEmailEnabled()` 检查 SMTP 是否配置；未配置时密码重置回退返回 token（开发模式）
  - `sendPasswordResetEmail(to, resetUrl)` 发送 HTML 格式重置邮件（翡翠绿品牌色模板）
  - `AuthService.forgotPassword()` 调用 EmailService：邮件发送成功返回"已发送至邮箱"，失败回退返回 token
  - 重置 URL 使用 `COZE_PROJECT_DOMAIN_DEFAULT` 拼接绝对路径
  - 测试 mock：AuthService 构造函数使用 `@Inject(EmailService)` 显式注入，解决 NestJS DI 元数据解析问题

- **管理后台增强**（Phase 13）
  - AdminService 从 1 个方法扩展到 9 个：getStats / getUsers / banUser / unbanUser / updateUserRole / getGalleryWorks / unpublishWork / deleteWork
  - AdminController 从 1 个端点扩展到 8 个：GET stats / GET users / PATCH ban / PATCH unban / PATCH role / GET gallery / PATCH unpublish / DELETE work
  - 前端 AdminPage 重写为标签页界面：数据看板（8 项指标卡片）+ 用户管理（分页表格 + 封禁/解禁/角色切换）+ 内容审核（分页表格 + 取消发布/删除）
  - 后端测试从 2 个扩展到 25 个（覆盖所有新方法 + 空数据/不存在/分页边界场景）
  - 前端测试从 1 个扩展到 4 个（加载统计/用户列表/非管理员拒绝/无 token）
  - MSW 默认 handlers 新增 admin stats/users/gallery mock

- **性能优化**（Phase 14）
  - **前端路由懒加载**：所有页面组件使用 `React.lazy()` + `Suspense` 实现代码分割，减少首屏 JS 体积
  - **图片懒加载**：画廊作品图 `loading="lazy"`，WorkspacePage 上传预览图 `loading="lazy"`
  - **API 缓存**：`useApiCache` Hook 提供 5 分钟内存缓存（SWR 模式），避免重复请求
  - **资源预连接**：`index.html` 添加 `<link rel="preconnect">` 指向 API 域名
  - **后端查询优化**：AdminService 所有查询使用列投影（避免 `select()` 全列）；GalleryService `resolveWorksUrls()` 批量解析 fileId（单次 `inArray` 查询，无 N+1）
  - **数据库索引**：核心查询字段已有索引（email/role/isActive/userId/status/slug/isPublished 等）

- **E2E 测试补全**（Phase 14）
  - E2E 从 11 个扩展到 42 个测试（8 个文件）
  - 新增 `password-reset.spec.ts`（8 tests）- 忘记密码全流程 + 重置密码表单验证
  - 新增 `billing.spec.ts`（7 tests）- 套餐展示/当前订阅/计费切换/订阅/登录拦截
  - 新增 `gallery-publish.spec.ts`（5 tests）- 公开浏览/作品卡片/登录访问/标签筛选/分页

- **OAuth 社交登录**（Phase 15）
  - `OAuthService`（`server/src/modules/auth/oauth.service.ts`）：Google + GitHub OAuth 2.0 授权码流程
  - 纯 REST 实现（fetch），无第三方 OAuth 库依赖
  - `GET /auth/oauth/:provider` -> 重定向到 Provider 授权页（支持 scope/prompt 参数）
  - `GET /auth/oauth/:provider/callback` -> 交换授权码 -> 获取用户信息 -> 创建/查找/关联用户 -> 生成 JWT -> 重定向到前端
  - 三种关联场景：已绑定 OAuth 账号直接登录、邮箱已注册关联 OAuth、全新用户创建（随机密码占位）
  - 前端：`OAuthButtons` 组件（Google/GitHub 按钮）+ `OAuthCallbackPage` 回调页面
  - 环境变量：`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`、`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`
  - 重定向 URL 使用 `COZE_PROJECT_DOMAIN_DEFAULT` 拼接绝对路径
  - Auth 域新增 2 个操作（oauthRedirect/oauthCallback），AUTH-014~016 规则

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
| `0005_model_providers.sql` | model_providers 表（多 Provider 渠道管理，0012 后废弃） |
| `0006_payments_and_orders.sql` | Stripe 支付 + 订单 |
| `0007_content_management.sql` | 内容管理（公告/系统设置） |
| `0008_audit_logs.sql` | 审计日志 |
| `0009_notifications.sql` | 通知 |
| `0010_commerce_and_orders_columns.sql` | 电商/订单列扩展 |
| `0011_model_configuration_chain.sql` | capability_model_routes + provider 唯一标识 |
| `0012_platform_dimension.sql` | 平台维度重构：ai_platforms + model_channels，数据搬迁后删 model_providers |

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
- **Jobs** (5 个并行 + 1 个汇总):
  - `quality` — 前端 ESLint + TypeScript 类型检查 + 前端测试
  - `backend-quality` — 后端 tsc 构建 + 后端测试（523 tests + 22 spec compliance）
  - `build` — 前端 Vite + 后端 tsc 联合构建
  - `e2e` — Playwright E2E 测试（11 个测试 + 报告上传）
  - `docker` — Dockerfile 构建验证（BuildKit 缓存）
  - `ci-pass` — 结果汇总（用于分支保护规则，all-must-pass）

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

<!-- OMX:AGENTS:START -->
<!-- AUTONOMY DIRECTIVE — DO NOT REMOVE -->
YOU ARE AN AUTONOMOUS CODING AGENT. EXECUTE TASKS TO COMPLETION WITHOUT ASKING FOR PERMISSION.
DO NOT STOP TO ASK "SHOULD I PROCEED?" — PROCEED. DO NOT WAIT FOR CONFIRMATION ON OBVIOUS NEXT STEPS.
IF BLOCKED, TRY AN ALTERNATIVE APPROACH. ONLY ASK WHEN TRULY AMBIGUOUS OR DESTRUCTIVE.
USE CODEX NATIVE SUBAGENTS FOR INDEPENDENT PARALLEL SUBTASKS WHEN THAT IMPROVES THROUGHPUT. THIS IS COMPLEMENTARY TO OMX TEAM MODE.
<!-- END AUTONOMY DIRECTIVE -->
<!-- omx:generated:agents-md -->

# oh-my-codex - Intelligent Multi-Agent Orchestration

You are running with oh-my-codex (OMX), a coordination layer for Codex CLI.
This AGENTS.md is the top-level operating contract for the workspace.
Role prompts under `prompts/*.md` are narrower execution surfaces. They must follow this file, not override it.
When OMX is installed, load the installed prompt/skill/agent surfaces from `./.codex/prompts`, `./.codex/skills`, and `./.codex/agents` (or the project-local `./.codex/...` equivalents when project scope is active).

<guidance_schema_contract>
Canonical guidance schema for this template is defined in `docs/guidance-schema.md`.
Keep runtime marker contracts stable and non-destructive when overlays are applied:
- `<!-- OMX:RUNTIME:START --> ... <!-- OMX:RUNTIME:END -->`
- `<!-- OMX:TEAM:WORKER:START --> ... <!-- OMX:TEAM:WORKER:END -->`
</guidance_schema_contract>

<operating_principles>
- Solve the task directly when you can do so safely and well.
- Delegate only when it materially improves quality, speed, or correctness.
- Keep progress short, concrete, and useful.
- Prefer evidence over assumption; verify before claiming completion.
- Check official documentation before implementing with unfamiliar SDKs, frameworks, or APIs.
- Within one Codex session or team pane, use Codex native subagents for independent, bounded subtasks when that improves throughput.
<!-- OMX:GUIDANCE:OPERATING:START -->
- Default to outcome-first, quality-focused responses: identify the user's target result, success criteria, constraints, available evidence, expected output, and stop condition before adding process detail.
- Keep collaboration style short and direct. Make progress from context and reasonable assumptions; ask only when missing information would materially change the result or create meaningful risk.
- Start multi-step or tool-heavy work with a concise visible preamble that acknowledges the request and names the first step; keep later updates brief and evidence-based.
- Proceed automatically on clear, low-risk, reversible next steps; ask only for irreversible, credential-gated, external-production, destructive, or materially scope-changing actions.
- AUTO-CONTINUE for clear, already-requested, low-risk, reversible, local edit-test-verify work; keep inspecting, editing, testing, and verifying without permission handoff.
- ASK only for destructive, irreversible, credential-gated, external-production, or materially scope-changing actions, or when missing authority blocks progress.
- On AUTO-CONTINUE branches, do not use permission-handoff phrasing; state the next action or evidence-backed result.
- Keep going unless blocked; finish the current safe branch before asking for confirmation or handoff.
- Ask only when blocked by missing information, missing authority, or an irreversible/destructive branch.
- Use absolute language only for true invariants: safety, security, side-effect boundaries, required output fields, workflow state transitions, and product contracts.
- Do not ask or instruct humans to perform ordinary non-destructive, reversible actions; execute those safe reversible OMX/runtime operations and ordinary commands yourself.
- Treat OMX runtime manipulation, state transitions, and ordinary command execution as agent responsibilities when they are safe and reversible.
- Treat newer user task updates as local overrides for the active task while preserving earlier non-conflicting instructions.
- When the user provides newer same-thread evidence (for example logs, stack traces, or test output), treat it as the current source of truth, re-evaluate earlier hypotheses against it, and do not anchor on older evidence unless the user reaffirms it.
- Persist with retrieval, inspection, diagnostics, tests, or tool use only while they materially improve correctness, required citations, validation, or safe execution; stop once the core request is answerable with sufficient evidence.
- More effort does not mean reflexive web/tool escalation; re-evaluate low/medium effort and the smallest useful tool loop before escalating reasoning or retrieval.
<!-- OMX:GUIDANCE:OPERATING:END -->
</operating_principles>

## Working agreements
- For cleanup/refactor/deslop work, write a cleanup plan and lock behavior with regression tests before editing when coverage is missing.
- Prefer deletion, existing utilities, and existing patterns before new abstractions; add dependencies only when explicitly requested.
- Keep diffs small, reviewable, and reversible.
- Verify with lint, typecheck, tests, and static analysis after changes; final reports include changed files, simplifications, and remaining risks.


<delegation_rules>
Default posture: work directly.

Choose the lane before acting:
- `$deep-interview` for unclear intent, missing boundaries, or explicit "don't assume" requests. It clarifies and hands off; it does not implement.
- `$ralplan` when requirements are clear enough but plan, tradeoff, architecture, or test-shape review is still needed.
- `$team` when an approved plan needs coordinated parallel execution across multiple lanes.
- `$ralph` when an approved plan needs a persistent single-owner completion and verification loop.
- Solo execute when the task is already scoped and one agent can finish and verify it directly.
- Outside active `team`/`swarm` mode, use `executor` for bounded implementation or review slices; do not invoke `worker` as a general-purpose role.
- Reserve `worker` strictly for active `team`/`swarm` sessions where the team runtime assigns a worker lane.
- `worker` is a team-runtime surface, not a general-purpose child role.


Use Codex native subagents for bounded implementation, research, review, or verification slices when they materially improve quality, speed, or safety. Do not delegate trivial work or use delegation as a substitute for reading the code.
</delegation_rules>

<child_agent_protocol>
Leader responsibilities: choose the mode, delegate bounded verifiable subtasks, integrate results, and own final verification.
Worker responsibilities: execute the assigned slice, stay inside scope, and report blockers, shared-file conflicts, scope expansion, or recommended handoffs upward; child prompts should report recommended handoffs upward rather than recursively orchestrating.
Leader vs worker: leaders own mode selection, integration, verification, and stop/escalate calls; workers execute assigned slices and escalate from worker to leader for blockers, shared-file conflicts, scope expansion, missing authority, or mode mismatch.
Rules: max 6 concurrent child agents; child prompts remain under AGENTS.md authority; prefer inherited model defaults unless a task has a concrete model reason; `worker` is a team-runtime surface, not a general-purpose child role.
</child_agent_protocol>


<invocation_conventions>
- `$name` — invoke a workflow skill.
- `/skills` — browse available skills.
- Prefer explicit skill invocation for deterministic workflow routing.
</invocation_conventions>

<model_routing>
Match role to task shape: `explore` for repo lookup, `researcher` for official docs/reference gathering, `dependency-expert` for SDK/package decisions, `executor` for implementation, `debugger` for root cause, `architect`/`critic` for high-complexity review. Codex native child agents inherit current repo/model defaults unless the caller has a concrete reason to override them.
</model_routing>

<specialist_routing>
Leader/workflow routing contract:
<!-- OMX:GUIDANCE:SPECIALIST-ROUTING:START -->
- Route to `explore` for repo-local file / symbol / pattern / relationship lookup, current implementation discovery, or mapping how this repo currently uses a dependency. `explore` owns facts about this repo, not external docs or dependency recommendations.
- Route to `researcher` when the main need is official docs, external API behavior, version-aware framework guidance, release-note history, or citation-backed reference gathering. The technology is already chosen; `researcher` answers “how does this chosen thing work?” and is not the default dependency-comparison role.
- Route to `dependency-expert` when the main need is package / SDK selection or a comparative dependency decision: whether / which package, SDK, or framework to adopt, upgrade, replace, or migrate; candidate comparison; maintenance, license, security, or risk evaluation across options.
- Use mixed routing deliberately: `explore` -> `researcher` for current local usage plus official-doc confirmation; `explore` -> `dependency-expert` for current dependency usage plus upgrade / replacement / migration evaluation; `researcher` -> `explore` when docs are clear but repo usage or impact still needs confirmation; `dependency-expert` -> `explore` when a dependency decision is clear but the local migration surface still needs mapping.
- Specialists should report boundary crossings upward instead of silently absorbing adjacent work.
- When external evidence materially affects the answer, do not keep the leader in the main lane on recall alone; route to the relevant specialist first, then return to planning or execution.
<!-- OMX:GUIDANCE:SPECIALIST-ROUTING:END -->
</specialist_routing>

<agent_catalog>
Key roles: `explore`, `researcher`, `dependency-expert`, `planner`, `architect`, `debugger`, `executor`, `test-engineer`, `verifier`, and `critic`. Use the installed role catalog for full descriptions.
</agent_catalog>

<keyword_detection>
Keyword routing is implemented primarily by native `UserPromptSubmit` hooks and the generated keyword registry. Treat hook-injected routing context as authoritative for the current turn, then load the named `SKILL.md` or prompt file as instructed.

Fallback behavior when hook context is unavailable:
- Explicit `$name` invocations run left-to-right and override implicit keywords.
- Bare skill names do not activate skills by themselves; skill-name activation requires explicit `$skill` invocation. Natural-language routing phrases may still map to a workflow. Examples: `analyze` / `investigate` → `$analyze` for read-only deep analysis with ranked synthesis, explicit confidence, and concrete file references; `deep interview`, `interview`, `don't assume`, or `ouroboros` → `$deep-interview` for Socratic deep interview requirements clarification.
- Keep the detailed keyword list in `src/hooks/keyword-registry.ts`; do not duplicate it here.

Runtime workflows such as `autopilot`, `ralph`, `ultrawork`, `ultraqa`, `team`/`swarm`, and `ecomode` require OMX CLI runtime support. In Codex App, outside-tmux, or plain Codex sessions without OMX tmux runtime, explain that those workflows are not directly available there and continue with the nearest App-safe surface unless the user explicitly wants to launch OMX CLI from shell first.
- When deep-interview is active in attached-tmux OMX CLI/runtime, ask each interview round via `omx question`; after launching `omx question` in a background terminal, wait for that terminal to finish and read the JSON answer before continuing; preserve the leader pane with `OMX_QUESTION_RETURN_PANE=$TMUX_PANE` when invoking it through Bash/tool paths. Outside tmux or native surfaces that cannot render `omx question` should use the native structured question path when available; otherwise ask exactly one concise plain-text question and wait for the answer.

</keyword_detection>

<skills>
Skills are workflow commands. Always load the relevant installed `SKILL.md` before following a skill-specific process. Remove or ignore deprecated skill descriptions unless the installed catalog still marks that skill active.
</skills>

<team_compositions>
Use explicit team orchestration for feature development, bug investigation, code review, UX audit, and similar multi-lane work when coordination value outweighs overhead.
</team_compositions>

<team_pipeline>
Team mode is the structured multi-agent surface. Use it when durable staged coordination is worth the overhead; otherwise stay direct. Terminal states: `complete`, `failed`, `cancelled`.
</team_pipeline>

<team_model_resolution>
Team/Swarm worker model precedence: explicit `OMX_TEAM_WORKER_LAUNCH_ARGS`, inherited leader `--model`, then low-complexity default from `OMX_DEFAULT_SPARK_MODEL` (legacy alias: `OMX_SPARK_MODEL`). Normalize model flags to one canonical `--model <value>` entry and use `OMX_DEFAULT_FRONTIER_MODEL` / `OMX_DEFAULT_SPARK_MODEL` rather than guessing defaults.
</team_model_resolution>

<!-- OMX:MODELS:START -->
## Model Capability Table

Auto-generated by `omx setup` from the current `config.toml` plus OMX model overrides.

| Role | Model | Reasoning Effort | Use Case |
| --- | --- | --- | --- |
| Frontier (leader) | `gpt-5.6-sol` | high | Primary leader/orchestrator for planning, coordination, and frontier-class reasoning. |
| Spark (explorer/fast) | `gpt-5.6-luna` | low | Fast triage, explore, lightweight synthesis, and low-latency routing. |
| Standard (subagent default) | `gpt-5.6-sol` | high | Default standard-capability model for installable specialists and secondary worker lanes unless a role is explicitly frontier or spark. |
| `explore` | `gpt-5.6-luna` | low | Fast codebase search and file/symbol mapping (fast-lane, fast) |
| `analyst` | `gpt-5.6-sol` | medium | Requirements clarity, acceptance criteria, hidden constraints (frontier-orchestrator, frontier) |
| `planner` | `gpt-5.6-sol` | medium | Task sequencing, execution plans, risk flags (frontier-orchestrator, frontier) |
| `architect` | `gpt-5.6-sol` | xhigh | System design, boundaries, interfaces, long-horizon tradeoffs (frontier-orchestrator, frontier) |
| `debugger` | `gpt-5.6-sol` | high | Root-cause analysis, regression isolation, failure diagnosis (deep-worker, standard) |
| `executor` | `gpt-5.6-sol` | medium | Code implementation, refactoring, feature work (deep-worker, standard) |
| `team-executor` | `gpt-5.6-sol` | medium | Supervised team execution for conservative delivery lanes (deep-worker, frontier) |
| `verifier` | `gpt-5.6-sol` | high | Completion evidence, claim validation, test adequacy (frontier-orchestrator, standard) |
| `code-reviewer` | `gpt-5.6-sol` | high | Comprehensive review across all concerns (frontier-orchestrator, frontier) |
| `dependency-expert` | `gpt-5.6-sol` | high | External SDK/API/package evaluation (frontier-orchestrator, standard) |
| `test-engineer` | `gpt-5.6-sol` | medium | Test strategy, coverage, flaky-test hardening (deep-worker, frontier) |
| `designer` | `gpt-5.6-sol` | high | UX/UI architecture, interaction design (deep-worker, standard) |
| `writer` | `gpt-5.6-sol` | high | Documentation, migration notes, user guidance (fast-lane, standard) |
| `git-master` | `gpt-5.6-sol` | high | Commit strategy, history hygiene, rebasing (deep-worker, standard) |
| `code-simplifier` | `gpt-5.6-sol` | high | Simplifies recently modified code for clarity and consistency without changing behavior (deep-worker, frontier) |
| `researcher` | `gpt-5.6-terra` | high | External documentation and reference research (fast-lane, standard) |
| `prometheus-strict-metis` | `gpt-5.6-sol` | high | Prometheus Strict requirements interviewer and ambiguity mapper (frontier-orchestrator, frontier) |
| `prometheus-strict-momus` | `gpt-5.6-sol` | high | Prometheus Strict adversarial plan critic and risk challenger (frontier-orchestrator, frontier) |
| `prometheus-strict-oracle` | `gpt-5.6-sol` | high | Prometheus Strict implementation readiness verifier and handoff judge (frontier-orchestrator, standard) |
| `critic` | `gpt-5.6-sol` | high | Plan/design critical challenge and review (frontier-orchestrator, frontier) |
| `scholastic` | `gpt-5.6-sol` | high | Ontology-first reasoning reviewer: category mistakes, hidden assumptions, modality separation, scholastic critique, and minimal-repair proposals (frontier-orchestrator, frontier) |
| `vision` | `gpt-5.6-sol` | low | Image/screenshot/diagram analysis (fast-lane, frontier) |
<!-- OMX:MODELS:END -->

<verification>
Verify before claiming completion.
<!-- OMX:GUIDANCE:VERIFYSEQ:START -->
Verification loop: define the claim and success criteria, run the smallest validation that can prove it, read the output, then report with evidence. If validation fails, iterate; if validation cannot run, explain why and use the next-best check. Keep evidence summaries concise but sufficient.

- Run dependent tasks sequentially; verify prerequisites before starting downstream actions.
- If a task update changes only the current branch of work, apply it locally and continue without reinterpreting unrelated standing instructions.
- For coding work, prefer targeted tests for changed behavior, then typecheck/lint/build/smoke checks when applicable; do not claim completion without fresh evidence or an explicit validation gap.
- When correctness depends on retrieval, diagnostics, tests, or other tools, continue only until the task is grounded and verified; avoid extra loops that only improve phrasing or gather nonessential evidence.
<!-- OMX:GUIDANCE:VERIFYSEQ:END -->
</verification>

<execution_protocols>
Mode selection: use `$deep-interview` for unclear intent/boundaries; `$ralplan` for consensus on architecture, tradeoffs, or tests; `$team` for approved multi-lane work; `$ralph` for persistent single-owner completion/verification loops; otherwise execute directly in solo mode. Switch modes only when evidence shows the current lane is mismatched or blocked.

Command routing: use normal Codex repository inspection tools/subagents as the default surface for simple read-only repository lookup tasks; use `omx sparkshell` only for explicit shell-native read-only evidence or bounded verification.
When to use what:
- Use normal Codex repository inspection tools/subagents for repository lookup and implementation context.
- Use `omx sparkshell --tmux-pane` only as an explicit opt-in operator aid for shell-native tmux evidence or bounded verification; it does not replace raw evidence capture.

Supervisor tmux handoff safety:
- Never paste from tmux's implicit/current buffer. Load handoff text into a fresh named buffer with `tmux set-buffer -b <name> -- "$message"` or a temp-file-backed `tmux load-buffer -b <name> <file>`; never use `tmux load-buffer -- <message>`.
- Verify the named buffer with `tmux show-buffer -b <name>` before any paste. A failed load or mismatched buffer is a blocker; do not run `paste-buffer` or submit keys after it.
- Clear the pane composer with `tmux send-keys -t <pane> C-u` immediately before paste, then use bracketed paste (`tmux paste-buffer -t <pane> -b <name> -p -d`) and submit intentionally.
- Recapture the pane after paste/Enter and verify the intended turn was accepted rather than leaving stale draft text visible.

Leader vs worker: leaders choose mode, delegate bounded work, integrate, and own verification; workers execute their slice and escalate blockers, scope expansion, shared-file conflicts, or mode mismatch upward. Escalate from worker to leader for blockers, scope expansion, shared ownership conflicts, or mode mismatch.

Stop / escalate: stop when the task is verified complete, the user says stop/cancel, or no meaningful recovery path remains. Escalate to the user only for irreversible, destructive, materially branching decisions, or missing authority.

Output contract: Default update/final shape: state current mode, action/result, and evidence or blocker/next step. Keep rationale once; do not restate the full plan every turn; expand only for risk, handoff, or explicit request.

Anti-slop workflow:
- Cleanup/refactor/deslop work still follows the same `$deep-interview` -> `$ralplan` -> `$team`/`$ralph` path; use `$ai-slop-cleaner` as a bounded helper inside the chosen execution lane, not as a competing top-level workflow.
- Write a cleanup plan before modifying code; lock existing behavior with regression tests first, then make one smell-focused pass at a time.
- Prefer deletion over addition, and prefer reuse plus boundary repair over new layers.
- No new dependencies without explicit request.
- Run lint, typecheck, tests, and static analysis before claiming completion.
- Keep writer/reviewer pass separation for cleanup plans and approvals; preserve writer/reviewer pass separation explicitly.

Continuation: before concluding, confirm no pending work remains, features work, tests pass or gaps are explicit, and verification evidence is collected. If not, continue.
</execution_protocols>

<cancellation>
Use the `cancel` skill to end active execution modes when work is done and verified, when the user says stop, or when a hard blocker prevents meaningful progress. Do not cancel while recoverable work remains.
</cancellation>

<state_management>
Hooks own normal skill-active and workflow-state persistence under `.omx/state/`. OMX runtime state lives under `.omx/`; do not manually duplicate hook-owned activation state unless recovering from missing or stale state.
</state_management>

## Setup

Execute `omx setup` to install all components. Execute `omx doctor` to verify installation.
<!-- OMX:AGENTS:END -->
