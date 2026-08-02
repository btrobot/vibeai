# VibeAI 内容创作平台 — 测试治理规范

> 版本: v1.1
> 基于测试金字塔 + 质量门禁（Quality Gate）体系，适配 VibeAI 全栈架构
> 
> 当前状态: 28 测试通过 (Auth 9 + Storage 12 + Drizzle Mock 3 + Zod Schema 26 + debug 3)

---

## 一、项目架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                      VibeAI 平台架构                          │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │              前端 (Vite 7 + React 19)              │       │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ │       │
│  │  │ 页面组件  │ │ 业务组件  │ │ 自定义Hook│ │ 工具  │ │       │
│  │  └─────────┘ └──────────┘ └──────────┘ └──────┘ │       │
│  └────────────────────┬─────────────────────────────┘       │
│                       │ HTTP / WS                           │
│  ┌────────────────────┴─────────────────────────────┐       │
│  │            后端 (NestJS 11)                        │       │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │       │
│  │  │ Auth │ │Storage│ │Gateway│ │ Task │ │Billing│  │       │
│  │  │Module│ │Module│ │Module│ │Engine│ │Module│  │       │
│  │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘  │       │
│  │     └────────┴────────┴────────┴────────┘       │       │
│  └────────────────────┬─────────────────────────────┘       │
│                       │ Drizzle ORM                          │
│  ┌────────────────────┴─────────────────────────────┐       │
│  │           PostgreSQL 16                             │       │
│  │  users │ sessions │ files │ tasks │ subscriptions  │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、测试金字塔策略

```
           ╱╲
          ╱  ╲          E2E 端到端测试          ~5%
         ╱    ╲         Playwright + MSW
        ╱──────╲
       ╱        ╲      集成测试 (API + WS)       ~15%
      ╱          ╲     Supertest + MSW
     ╱────────────╲
    ╱              ╲   组件测试 (React)           ~15%
   ╱                ╲  React Testing Library
  ╱──────────────────╲
 ╱                    ╲ 单元测试 (服务 + 工具)     ~65%
╱                      ╲ Vitest + Drizzle Mock
────────────────────────
```

| 层级 | 目标 | 速度 | 数量级 | 维护成本 |
|------|------|------|--------|----------|
| **单元测试** | 验证服务层逻辑 / 工具函数 / Zod Schema | 毫秒级 | 数百个 | 低 |
| **组件测试** | 验证 UI 组件渲染 + 用户交互 | 百毫秒级 | 数十个 | 中 |
| **集成测试** | 验证 API 路由 + 服务与 DB 集成 + WebSocket | 秒级 | 数十个 | 中高 |
| **E2E 测试** | 验证关键业务路径 | 分钟级 | 十余个 | 高 |

---

## 三、测试类型详解

### 3.1 单元测试 (Unit Tests) — 占比 65%

**目标**: 覆盖所有服务层、工具函数、Zod Schema 定义

**工具**: `Vitest` + `vi.mock` (链式调用 Mock)

**覆盖范围**:

| 模块 | 当前覆盖率 | 目标覆盖率 | 测试策略 |
|------|-----------|-----------|----------|
| **AuthService** | **9 tests** | **≥ 90%** 行, **≥ 80%** 分支 | 注册/登录/登出/刷新/令牌生成 |
| **StorageService** | **12 tests** | **≥ 90%** 行, **≥ 80%** 分支 | Provider 抽象层 + S3/Local 实现 |
| **GatewayService** | — | **≥ 85%** 行, **≥ 75%** 分支 | 能力注册/模型路由/生成任务 |
| **TaskService** | — | **≥ 85%** 行, **≥ 75%** 分支 | 任务队列/状态机/取消/超时 |
| **BillingService** | — | **≥ 90%** 行, **≥ 80%** 分支 | 套餐/订阅/扣费/用量统计 |
| **ProjectService** | — | **≥ 90%** 行, **≥ 80%** 分支 | CRUD + 权限校验 |
| **WS Gateway** | — | **≥ 80%** 行, **≥ 70%** 分支 | 连接/消息/广播/心跳 |
| **工具函数** | — | **≥ 95%** 行 | 输入输出边界测试 |
| **Zod Schema** | **26 tests** | **≥ 100%** 行 | 有效数据通过 + 无效数据拒绝 |

**目录结构**:
```
server/src/__tests__/unit/
├── services/
│   ├── auth.service.test.ts
│   ├── storage.service.test.ts
│   ├── gateway.service.test.ts
│   ├── task.service.test.ts
│   ├── billing.service.test.ts
│   └── project.service.test.ts
├── validations/
│   └── *.test.ts              # Zod Schema 验证
└── utils/
    └── *.test.ts              # 工具函数
```

**命名规范**:
```typescript
describe('AuthService', () => {
  describe('login', () => {
    it('邮箱密码正确时应返回用户信息和令牌', async () => { ... });
    it('密码错误时应抛出 UnauthorizedException', async () => { ... });
    it('连续 5 次失败应锁定账户', async () => { ... });
    it('已锁定账户应拒绝登录', async () => { ... });
  });
  describe('register', () => {
    it('应能注册新用户并返回用户信息', async () => { ... });
    it('重复邮箱应抛出 ConflictException', async () => { ... });
  });
  describe('refresh', () => {
    it('有效 refreshToken 应返回新令牌', async () => { ... });
    it('过期 refreshToken 应抛出 UnauthorizedException', async () => { ... });
  });
});
```

### 3.2 组件测试 (Component Tests) — 占比 15%

**目标**: 验证 React 组件渲染 + 用户交互

**工具**: `Vitest` + `@testing-library/react` + `@testing-library/user-event` + `MSW`

**覆盖范围**:

| 组件 | 优先级 | 测试要点 |
|------|--------|----------|
| **LoginPage** | P0 | 表单渲染、验证反馈、提交状态、错误提示 |
| **RegisterPage** | P0 | 表单渲染、密码强度、注册成功跳转 |
| **AppLayout** | P0 | 侧边栏渲染、导航高亮、折叠展开、响应式 |
| **DashboardPage** | P0 | 统计卡片渲染、项目列表、快速操作 |
| **ProjectsPage** | P0 | 项目列表、创建弹窗、搜索筛选、分页 |
| **WorkspacePage** | P0 | AI 生成面板、任务列表、进度追踪 |
| **StoragePage** | P0 | 文件列表、上传、分类筛选、搜索 |
| **BillingPage** | P0 | 套餐列表、订阅状态、用量统计 |
| **ToolPage** | P0 | 工具表单、结果展示、历史记录 |
| **SettingsPage** | P1 | 个人资料编辑、密码修改 |
| **AdminPage** | P1 | 用户管理、系统统计 |
| **GalleryPage** | P1 | 画廊网格、标签筛选、点赞 |

**组件目录结构**:
```
src/__tests__/components/
├── pages/
│   ├── LoginPage.test.tsx
│   ├── RegisterPage.test.tsx
│   ├── DashboardPage.test.tsx
│   ├── ProjectsPage.test.tsx
│   ├── WorkspacePage.test.tsx
│   ├── StoragePage.test.tsx
│   ├── BillingPage.test.tsx
│   ├── ToolPage.test.tsx
│   ├── SettingsPage.test.tsx
│   ├── AdminPage.test.tsx
│   └── GalleryPage.test.tsx
├── layout/
│   └── AppLayout.test.tsx
└── ui/
    ├── Button.test.tsx
    ├── Input.test.tsx
    ├── Card.test.tsx
    └── Modal.test.tsx
```

**编写规范**:
```typescript
describe('LoginPage', () => {
  it('应渲染登录表单（邮箱、密码、登录按钮）', async () => { ... });
  it('空字段提交应显示验证错误', async () => { ... });
  it('有效凭据应登录成功并跳转到仪表盘', async () => { ... });
  it('无效凭据应显示错误提示', async () => { ... });
  it('应能切换密码显示/隐藏', async () => { ... });
});
```

### 3.3 集成测试 (Integration Tests) — 占比 15%

**目标**: 验证 API 路由、WebSocket 服务与数据库的真实集成

**工具**: `Vitest` + `Supertest` + `MSW` (Mock Service Worker)

**覆盖范围**:

| 接口 | 模块 | 优先级 | 测试要点 |
|------|------|--------|----------|
| `POST /api/auth/register` | Auth | P0 | 成功 + 邮箱重复 + 参数校验 |
| `POST /api/auth/login` | Auth | P0 | 成功 + 密码错误 + 锁定 |
| `POST /api/auth/refresh` | Auth | P0 | 成功 + 过期 + 重复使用 |
| `POST /api/auth/logout` | Auth | P0 | 成功登出 + 令牌失效 |
| `GET /api/auth/me` | Auth | P0 | 已登录 + 未登录 + 过期 |
| `POST /api/storage/upload` | Storage | P0 | 上传成功 + 格式校验 + 大小限制 |
| `GET /api/storage/files` | Storage | P0 | 列表 + 分类筛选 + 分页 |
| `GET /api/storage/files/:id` | Storage | P0 | 详情 + 不存在 + 权限隔离 |
| `DELETE /api/storage/files/:id` | Storage | P0 | 删除 + 不存在 + 跨用户 |
| `GET /api/storage/stats` | Storage | P0 | 统计信息 |
| `GET /api/gateway/capabilities` | Gateway | P0 | 能力列表 + 详情 |
| `GET /api/gateway/models` | Gateway | P0 | 模型列表 + 按能力筛选 |
| `POST /api/gateway/generate` | Gateway | P0 | 提交成功 + 参数校验 |
| `POST /api/projects` | Task | P0 | 创建 + 列表 + 更新 + 删除 |
| `POST /api/projects/:id/tasks` | Task | P0 | 创建任务 + 状态流转 + 取消 |
| `GET /api/tasks/:id` | Task | P0 | 任务详情 + 进度查询 |
| `GET /api/billing/plans` | Billing | P0 | 套餐列表 + 对比 |
| `POST /api/billing/subscribe` | Billing | P0 | 订阅 + 升级 + 降级 |
| `GET /api/billing/usage` | Billing | P0 | 用量统计 + 信用额度 |
| **WebSocket /ws/tasks** | WS | P1 | 连接 + 鉴权 + 消息推送 + 重连 |

**编写规范**:
```typescript
describe('POST /api/auth/login', () => {
  it('成功登录应返回 200 + 用户信息 + accessToken + refreshToken', async () => { ... });
  it('密码错误应返回 401 + 错误消息', async () => { ... });
  it('已锁定账户应返回 403', async () => { ... });
});
```

### 3.4 E2E 测试 (End-to-End Tests) — 占比 5%

**目标**: 覆盖关键业务路径

**工具**: `Playwright` + `MSW`

**覆盖路径**:

| 路径 | 优先级 | 场景描述 |
|------|--------|----------|
| **用户注册 → 登录 → 仪表盘** | P0 | 完整认证流程 |
| **创建项目 → 提交 AI 生成 → 查看结果** | P0 | AI 创作流程 |
| **上传文件 → 分类 → 预览 → 删除** | P0 | 文件管理流程 |
| **浏览套餐 → 订阅 → 查看用量** | P0 | 计费流程 |
| **使用电商工具 → 生成 → 下载** | P1 | 工具使用流程 |
| **管理后台 → 用户管理 → 系统配置** | P1 | 管理流程 |

**目录结构**:
```
e2e/
├── fixtures/
│   ├── auth.setup.ts          # 认证状态预置
│   └── data.setup.ts          # 测试数据预置
├── specs/
│   ├── auth.spec.ts           # 认证流程
│   ├── creation.spec.ts       # AI 创作流程
│   ├── storage.spec.ts        # 文件管理流程
│   ├── billing.spec.ts        # 计费流程
│   ├── tools.spec.ts          # 工具使用流程
│   └── admin.spec.ts          # 管理流程
├── helpers/
│   └── api.ts                 # E2E 辅助函数
└── playwright.config.ts       # Playwright 配置
```

---

## 四、覆盖率目标 (Coverage Targets)

### 4.1 分模块目标

| 模块 | 语句 | 分支 | 函数 | 行 | 优先级 |
|------|------|------|------|-----|--------|
| **AuthService** | ≥ 90% | ≥ 80% | ≥ 90% | ≥ 90% | P0 |
| **StorageService** | ≥ 90% | ≥ 80% | ≥ 90% | ≥ 90% | P0 |
| **GatewayService** | ≥ 85% | ≥ 75% | ≥ 85% | ≥ 85% | P0 |
| **TaskService** | ≥ 85% | ≥ 75% | ≥ 85% | ≥ 85% | P0 |
| **BillingService** | ≥ 90% | ≥ 80% | ≥ 90% | ≥ 90% | P0 |
| **ProjectService** | ≥ 90% | ≥ 80% | ≥ 90% | ≥ 90% | P0 |
| **WS Gateway** | ≥ 80% | ≥ 70% | ≥ 80% | ≥ 80% | P1 |
| **Zod Schema** | 100% | 100% | 100% | 100% | P0 |
| **工具函数** | ≥ 95% | ≥ 90% | 100% | ≥ 95% | P0 |
| **API 路由** | ≥ 80% | ≥ 75% | ≥ 80% | ≥ 80% | P1 |
| **UI 组件** | ≥ 60% | ≥ 50% | ≥ 60% | ≥ 60% | P1 |
| **页面组件** | ≥ 30% | ≥ 25% | ≥ 30% | ≥ 30% | P2 |

### 4.2 整体目标

| 指标 | 当前 | 短期目标 (v1.0) | 长期目标 (v2.0) |
|------|------|-----------------|-----------------|
| **语句覆盖率** | 待测量 | **≥ 60%** | **≥ 80%** |
| **分支覆盖率** | 待测量 | **≥ 55%** | **≥ 75%** |
| **函数覆盖率** | 待测量 | **≥ 50%** | **≥ 70%** |
| **行覆盖率** | 待测量 | **≥ 60%** | **≥ 80%** |
| **测试总数** | **28** | **≥ 150** | **≥ 400** |

---

## 五、测试比例与数量规划

### 5.1 各类型比例

```
单元测试      65%  ####################################
组件测试      15%  #########
集成测试      15%  #########
E2E 测试       5%  ###
```

### 5.2 各阶段数量目标

| 阶段 | 单元测试 | 组件测试 | 集成测试 | E2E 测试 | 总计 |
|------|---------|---------|---------|---------|------|
| **当前** | 28 | 0 | 0 | 0 | **28** |
| **v1.0 短期** | 100 | 20 | 20 | 10 | 150 |
| **v1.5 中期** | 200 | 40 | 40 | 20 | 300 |
| **v2.0 长期** | 300 | 60 | 50 | 25 | 435 |

---

## 六、质量门禁 (Quality Gate)

### 6.1 提交前门禁 (Pre-commit Gate)

```json
{
  "scripts": {
    "validate": "pnpm dlx concurrently --group --names lint-tsc,test \"pnpm ts-check\" \"pnpm test\"",
    "gate:commit": "pnpm validate",
    "gate:deploy": "pnpm test:coverage && pnpm test:e2e"
  }
}
```

**门禁规则**:

```
┌─────────────────────────────────────────────────────┐
│                    Pre-commit Gate                    │
│                                                       │
│  1. pnpm ts-check        → ❌ 不允许任何 TS 错误       │
│  2. pnpm test            → ✅ 100% 通过                │
│                                                       │
│  全部通过 → ✅ 允许提交                                │
│  任一失败 → ❌ 禁止提交                                │
└─────────────────────────────────────────────────────┘
```

### 6.2 合并请求门禁 (PR Gate)

```
┌─────────────────────────────────────────────────────┐
│                    PR Merge Gate                       │
│                                                       │
│  🔴 必须通过:                                          │
│  ├─ ts-check: 零错误                                  │
│  ├─ test: 100% 通过                                   │
│  ├─ 新增代码覆盖率 ≥ 80%                              │
│  └─ 未引入新的覆盖率下降                               │
│                                                       │
│  🟡 警告但不阻塞:                                      │
│  ├─ 总覆盖率下降 ≥ 2%                                 │
│  └─ 测试文件缺失                                      │
│                                                       │
│  全部通过 → ✅ 允许合并                                │
│  任一 Red → ❌ 阻塞合并                                │
└─────────────────────────────────────────────────────┘
```

### 6.3 部署门禁 (Deploy Gate)

```
┌─────────────────────────────────────────────────────┐
│                    Deploy Gate                         │
│                                                       │
│  🔴 必须通过:                                          │
│  ├─ 所有 PR Gate 条件                                 │
│  ├─ 总覆盖率 ≥ 60% (短期) / ≥ 80% (长期)              │
│  ├─ E2E 关键路径 100% 通过                             │
│  └─ 无 P0/P1 级 Bug                                  │
│                                                       │
│  全部通过 → ✅ 允许部署                                │
│  任一失败 → ❌ 阻塞部署                                │
└─────────────────────────────────────────────────────┘
```

---

## 七、Mock 策略

### 7.1 分层 Mock 体系

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mock 策略体系                              │
│                                                                   │
│  单元测试         vi.mock + 链式调用 Drizzle  Mock                │
│                  → 模拟 db 对象，返回预定数据                      │
│                  → 模拟 bcrypt、JwtService 等外部依赖              │
│                                                                   │
│  组件测试         MSW (Mock Service Worker)                       │
│                  → 模拟所有 API 请求响应                           │
│                  → 模拟 WebSocket 消息推送                        │
│                  → 验证组件在不同数据状态下的渲染                  │
│                                                                   │
│  集成测试         MSW + 真实 Service 实例                         │
│                  → 模拟下游依赖 (AI SDK、S3/MinIO)                │
│                  → 真实 NestJS Controller + 路由                   │
│                                                                   │
│  E2E 测试         MSW (可选，用于 AI/S3 等外部服务)               │
│                  → 端到端真实用户操作                              │
│                  → 关键路径使用真实数据库                          │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Drizzle 链式调用 Mock 模板（已实现）

实际实现位于 `server/src/test/drizzle-mock.ts`，核心设计：

**架构要点**：
- 链式方法（select/from/where/orderBy/limit/offset 等）返回 `chainable` 对象自身
- 终端方法（execute/all/get/returning 等）返回 `Promise.resolve(_result)`
- `then` 方法挂载在 `chainable` 上，实现 thenable 协议，支持 `await db.select().from().where()`
- `mockSingle`/`mockEmpty`/`mockMany`/`mockReturning` 通过修改 `_result` 控制返回数据

**NestJS 兼容性陷阱**：
- `chainable` 对象的 `then` 方法使其成为 thenable 对象
- NestJS `Test.createTestingModule` 的 DI 容器会检测到 thenable 对象并自动 `await` 解析
- 这会导致 `db` 被解析为 `_result` 数组，丢失所有方法
- **修复**：`createDrizzleMockForNestJS()` 通过解构 `{ then, ...rest }` 移除 `then` 方法，保留所有链式方法

```typescript
// 标准用法（非 NestJS 场景）
const db = createDrizzleMock();
mockSingle(db, userRecord);
const [result] = await db.select().from(users).where(eq(...)).limit(1);

// NestJS 场景（移除 then 避免 DI 解析）
const db = createDrizzleMockForNestJS();
const module = await Test.createTestingModule({
  providers: [
    { provide: DRIZZLE, useValue: db },
    ...
  ],
}).compile();
```

### 7.3 WebSocket Mock 模板

```typescript
// server/src/__tests__/helpers/mock-ws.ts
import { vi } from 'vitest';
import { WebSocket } from 'ws';

export function createMockWsClient() {
  const client = {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    terminate: vi.fn(),
    ping: vi.fn(),
    pong: vi.fn(),
  } as unknown as WebSocket;

  return client;
}
```

---

## 八、测试数据管理

### 8.1 工厂模式（已实现）

实际实现位于 `server/src/test/factories.ts`，支持 8 个工厂：`buildUser`、`buildAdmin`、`buildDemoUser`、`buildSession`、`buildProject`、`buildTask`、`buildPlan`、`buildFile`，以及批量生成函数 `buildMany`。

**设计规范**：
- 每个工厂返回完整类型数据，通过 `partial` 覆写特定字段
- 字段名与 Drizzle Schema 的 TypeScript 属性名保持一致（camelCase）
- 使用自增计数器保证 ID 唯一性
- 日期字段使用 `Date` 对象，非字符串

```typescript
// 使用示例
const user = buildUser({ email: 'custom@vibeai.com', role: 'admin' });
const files = buildMany(buildFile, 3, { category: 'image' });
```

### 8.2 数据隔离

- 每个测试用例使用独立的数据（通过 `buildXxx()` 工厂方法创建）
- 测试间不共享状态，不使用 `let` 变量跨测试共享
- 使用 `beforeEach` 重置所有 Mock
- 避免测试间的时序依赖
- 涉及数据库的测试使用事务回滚隔离

---

## 九、基础设施与工具链

### 9.1 当前已有

| 工具 | 用途 | 已配置 |
|------|------|--------|
| **Vitest (v3)** | 测试运行器 | ✅ `server/vitest.config.ts` + `vitest.config.ts` |
| **@testing-library/react** | 组件测试 | ✅ 安装 |
| **@testing-library/jest-dom** | DOM 断言 | ✅ 安装 |
| **@testing-library/user-event** | 用户交互模拟 | ✅ 安装 |
| **MSW** | Mock Service Worker | ✅ 安装 |
| **jsdom** | DOM 环境 | ✅ 配置 |
| **@vitest/coverage-v8** | 覆盖率报告 | ✅ 安装 |
| **Drizzle Mock** | 链式调用 Mock 模板 | ✅ `server/src/test/drizzle-mock.ts` |
| **WebSocket Mock** | WS 测试 Mock | ✅ `server/src/test/ws-mock.ts` |
| **测试数据工厂** | 测试数据生成 | ✅ `server/src/test/factories.ts` (8 个工厂) |
| **NestJS 测试工具** | JwtService/AuthGuard Mock | ✅ `server/src/test/nest-test-utils.ts` |

### 9.2 需要补充

| 工具 | 用途 | 优先级 | 安装命令 |
|------|------|--------|----------|
| **Playwright** | E2E 测试 | P1 | `pnpm add -D @playwright/test` |
| **Supertest** | HTTP 集成测试 | P1 | `pnpm add -D supertest @types/supertest` |
| **Husky** | Git hooks (pre-commit) | P2 | `pnpm add -D husky lint-staged` |

### 9.3 安装命令（待补充）

```bash
# E2E 测试
pnpm add -D @playwright/test
pnpm dlx playwright install chromium

# 集成测试
pnpm add -D supertest @types/supertest

# Git hooks
pnpm add -D husky lint-staged
pnpm dlx husky init
echo "pnpm validate" > .husky/pre-commit
```

---

## 十、Vitest 配置模板

### 10.1 前端测试配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.*',
        'src/**/*.d.ts',
        'src/components/ui/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 50,
        lines: 60,
      },
    },
  },
});
```

### 10.2 后端测试配置

```typescript
// server/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.*',
        'src/**/*.d.ts',
        'src/main.ts',
        'src/app.module.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

---

## 十一、测试脚本配置

### 11.1 package.json 脚本

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "ts-check": "tsc --noEmit",
    "validate": "pnpm dlx concurrently --group --names ts-check,test \"pnpm ts-check\" \"pnpm test\"",
    "gate:commit": "pnpm validate",
    "gate:deploy": "pnpm test:coverage && pnpm test:e2e"
  }
}
```

### 11.2 server/package.json 脚本

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run --config vitest.integration.config.ts"
  }
}
```

---

## 十二、最佳实践清单

### 12.1 通用规则

- [ ] 每个测试只测一个行为（Single Responsibility）
- [ ] 测试命名使用中文描述业务场景（`应能...` / `当...时应...`）
- [ ] 遵循 AAA 模式：Arrange → Act → Assert
- [ ] 不测试框架/库本身的行为
- [ ] 不测试私有方法（通过公有方法间接测试）
- [ ] 避免 Mock 过度（Mock 边界，测试内部）
- [ ] 快照测试仅在必要时使用（UI 组件）

### 12.2 服务层测试规则

- [ ] Mock 数据库层，测试业务逻辑
- [ ] 覆盖所有公有方法
- [ ] 每个方法至少 1 个 happy path + 1 个 error case
- [ ] 覆盖边界条件（空数据、极限值、重复值）
- [ ] 状态机测试：验证所有合法流转 + 非法流转拒绝
- [ ] 测试 AuthGuard 权限校验（admin/user/未登录）

### 12.3 组件测试规则

- [ ] 使用 `@testing-library/user-event` 模拟用户交互
- [ ] 优先测试用户可见行为（渲染/交互）
- [ ] 避免测试实现细节（内部状态/DOM 结构）
- [ ] 测试无障碍（aria-label、role）
- [ ] 使用 MSW 模拟 API 响应，避免真实网络请求

### 12.4 API 集成测试规则

- [ ] 测试 HTTP 状态码（200/201/400/401/403/404/409/422/500）
- [ ] 测试响应体结构（JSON 字段完整性）
- [ ] 测试错误消息内容
- [ ] 测试认证与权限（无令牌/过期/角色不足）
- [ ] 测试 WebSocket 连接/鉴权/消息格式

### 12.5 E2E 测试规则

- [ ] 覆盖核心用户旅程（Happy Path）
- [ ] 使用 Page Object 模式
- [ ] 避免测试静态页面（那是集成测试的职责）
- [ ] 保持测试数量少而精（关键路径 > 边缘场景）

---

## 十三、红线与降级策略

### 13.1 红线 (Red Lines)

| 规则 | 严重级别 | 说明 |
|------|---------|------|
| 不允许有 `any` 类型绕过 | 🔴 阻塞 | 禁止 `as any` 或 `// @ts-ignore` 跳过测试 |
| 不允许 Mock 真实 HTTP 请求 | 🔴 阻塞 | 必须使用 MSW 或 vi.mock |
| 不允许测试间共享可变状态 | 🔴 阻塞 | 每个测试用例必须独立 |
| 不允许跳过失败测试 | 🔴 阻塞 | 禁止 `test.skip` 或 `xit` |
| 不允许覆盖率 < 60% 部署 | 🔴 阻塞 | 低于阈值禁止部署 |
| 不允许硬编码 JWT Secret | 🔴 阻塞 | 必须使用环境变量 |

### 13.2 降级策略

| 场景 | 处理方式 |
|------|----------|
| 紧急修复需要跳过测试 | 需团队审批 + 48 小时内补测 |
| 覆盖率暂时下降 | 记录 TODO + 下个迭代修复 |
| AI SDK 不可用 | 使用 MSW 模拟 + 标记集成测试为可选 |
| PostgreSQL 不可用 | 使用 Drizzle Mock 或 SQLite 替代 |
| E2E 环境不可用 | 回退到集成测试覆盖关键路径 |

---

## 十四、监控与度量

### 14.1 持续追踪指标

- 测试通过率（目标: 100%）
- 测试覆盖率（目标: 持续上升）
- 测试执行时间（目标: 单次 < 5 分钟）
- 测试与代码行数比（目标: 1:3 ~ 1:5）
- 失败测试修复时间（目标: < 2 小时）
- WebSocket 连接测试覆盖率（目标: ≥ 80%）

### 14.2 报告

```bash
# 生成覆盖率报告
pnpm test:coverage
# 输出: coverage/index.html (可视化报告)
# 输出: coverage/coverage-summary.json (机器可读数据)

# 生成 JUnit 格式报告（CI 集成）
pnpm test -- --reporter=junit --outputFile=test-results.xml
```

---

## 十五、模块优先级路线图

### Phase 1: Auth 模块 (P0) — ✅ 已完成

```typescript
// 单元测试: AuthService — 9 个测试 ✅
//   - register: 成功注册 / 邮箱已存在 / 密码强度
//   - login: 成功登录 / 密码错误 / 用户不存在
//   - refresh: 成功刷新 / 无效 refresh token
//   - me: 正常返回 / 用户不存在
//   - logout: 清除 refresh token
// Zod Schema 验证: 26 个测试 ✅
// Drizzle Mock 自测: 3 个测试 ✅
// 组件测试: LoginPage — 3 个测试 ✅
// 待补: RegisterPage, E2E
```

### Phase 2: Storage 模块 (P0) — ✅ 已完成

```typescript
// 单元测试: StorageService — 12 个测试 ✅
//   - uploadFile: 成功上传 (含默认分类)
//   - listFiles: 空列表 / 分页列表
//   - getFileDetail: 存在(含签名URL) / 不存在
//   - deleteFile: 删除成功 / 文件不存在
//   - getSignedUrl: 生成签名URL / 文件不存在
//   - getStorageStats: 分组统计 / 空统计
// 待补: S3Provider/LocalProvider 单元测试, 集成测试, 组件测试, E2E
```

### Phase 3: Gateway + Task Engine (P0+P1) — ✅ 已完成

```typescript
// 单元测试: GatewayService (25 条), TaskService (23 条), ProjectService (11 条), WsService (14 条)
// 集成测试: POST /api/gateway/generate, GET /api/tasks/:id, WebSocket
// 组件测试: WorkspacePage
// E2E: 创建项目 → 提交生成 → 查看结果
```

### Phase 4: Billing 模块 (P1) — ⏳ 待开始

```typescript
// 单元测试: BillingService (credit deduction, plan validation)
// 集成测试: POST /api/billing/subscribe, GET /api/billing/usage
// 组件测试: BillingPage
// E2E: 浏览套餐 → 订阅 → 查看用量
```

### Phase 5: 业务前端 (P2) — ⏳ 待开始

```typescript
// 组件测试: ToolPage, GalleryPage, SettingsPage, AdminPage
// E2E: 电商工具使用流程, 管理后台流程
```