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

### Phase 1: 认证系统 ✅ (28/28 tests passing)
- **Zod Schema** (26 tests) — 全部通过
- **Auth Service** (9 tests) — 注册/登录/刷新/用户信息/登出
- **Drizzle Mock** (3 tests) — 链式调用的 thenable 协议与 NestJS 兼容性
- **Storage Service** (12 tests) — 上传/列表/详情/删除/签名URL/统计

### E2E 测试 (Playwright) ✅ (11/11 tests passing)
- **认证流程** (3 tests) — 注册/登出重登录/登录失败
- **仪表盘** (3 tests) — 统计信息/侧边导航/跳转画廊
- **画廊浏览** (3 tests) — 公开页面/标签切换/登录访问
- **项目流程** (2 tests) — 创建项目/项目列表

### 测试基础设施
- `server/src/test/drizzle-mock.ts` — Drizzle ORM 链式调用 Mock
- `server/src/test/ws-mock.ts` — WebSocket Mock
- `server/src/test/nest-test-utils.ts` — NestJS 测试工具（JwtService mock, AuthGuard mock）
- `server/src/test/factories.ts` — 测试数据工厂（8 个工厂）
- `vitest.config.ts` (前端) + `server/vitest.config.ts` (后端)
- `src/test/setup.ts` + `server/src/test/setup.ts` — 测试环境初始化

### 测试进展 (续)

| 模块 | 测试文件 | 测试数 | 状态 |
|------|---------|-------|------|
| Phase 1: Auth | `auth.service.test.ts` | 9 | ✅ |
| Phase 1: Zod Schema | `schema.test.ts` | 26 | ✅ |
| Phase 1: Drizzle Mock | `drizzle-mock.test.ts` | 3 | ✅ |
| Phase 2: Storage | `storage.service.test.ts` | 12 | ✅ |
| Phase 3: Gateway | `gateway.service.test.ts` | 25 | ✅ |
| Phase 4: Task Engine | `task.service.test.ts` | 23 | ✅ |
| Phase 4: Project | `project.service.test.ts` | 11 | ✅ |
| Phase 4: WebSocket | `ws.service.test.ts` | 14 | ✅ |
| Phase 5: Billing | `billing.service.test.ts` | 19 | ✅ |
| Phase 6: Dashboard Page | `DashboardPage.test.tsx` | 4 | ✅ |
| Phase 6: Billing Page | `BillingPage.test.tsx` | 4 | ✅ |
| Phase 6: Workspace Page | `WorkspacePage.test.tsx` | 4 | ✅ |
| Phase 6: Login Page | `LoginPage.test.tsx` | 3 | ✅ |
| Phase 6: Register Page | `RegisterPage.test.tsx` | 6 | ✅ |
| Phase 6: Tool Page | `ToolPage.test.tsx` | 7 | ✅ |
| Phase 6: Settings Page | `SettingsPage.test.tsx` | 7 | ✅ |
| Phase 6: Admin Page | `AdminPage.test.tsx` | 4 | ✅ |
| Phase 6: Gallery Page | `GalleryPage.test.tsx` | 4 | ✅ |
| **合计（单元测试）** | | **182** | **✅ 全部通过** |
| Phase 7: Auth Integration | `test-integration.js` | 10 | ✅ |

### 下一阶段目标
- Phase 7: E2E 测试（Playwright）
- Husky + lint-staged 质量门禁

### 已知问题
- **tsx ESM loader 与 NestJS 装饰器不兼容**：集成测试无法通过 vitest 运行（`NestFactory.create` 在 tsx 环境下导致 `authService` 为 undefined）。解决方案：先 `pnpm build` 编译为 JavaScript，再通过 `node scripts/test-integration.js` 运行。
- **JWT 重复 token 问题**：`generateTokens` 方法在相同秒内调用会生成相同的 JWT（`iat` 相同），导致 `sessions.refreshToken` 唯一约束冲突。已通过添加 `jti` 随机值修复。

## 关键架构决策

- 前后端分离，独立端口运行（Vite 5000 / NestJS 3001）
- Vite 代理 /api/* → NestJS backend
- NestJS 模块化架构，每个业务域独立 Module
- 异步任务模式，WebSocket 实时进度
- 存储层 Provider 抽象，支持无缝切换
- AI Gateway 三层架构: Capability → Router → Model