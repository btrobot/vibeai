# 多 Provider 路由 + Replicate 接入实施规划

> 版本: 1.0 | 日期: 2026-08-05

## 一、目标

用户在前端选择模型（如 `gpt-image-2`），系统自动选择最优渠道执行（OpenAI 直连 / Replicate 代理），用户不感知渠道存在。同一模型可有多个渠道，支持优先级路由和故障切换。

## 二、核心概念

```
用户视角                          平台视角
─────────                        ─────────
aiModels (逻辑模型)               modelProviders (渠道实例)
├── slug: "gpt-image-2"           ├── modelSlug → "gpt-image-2"
├── name: "GPT Image 2"           ├── providerName: "replicate"
├── costCredits: 10 (售价-积分)   ├── sdkModelId: "openai/gpt-image-2:abc123"
├── modality: "image"             ├── sdkClient: "replicate" (对应哪个 Adapter)
└── ... (用户可见信息)             ├── priority: 2 (数字越小优先级越高)
                                 ├── costPerCall: 0.05 (采购成本-美元)
                                 ├── isActive: true
                                 └── config: {} (渠道特定配置)
```

**向后兼容策略**：`aiModels` 表现有的 `providerName` / `sdkModelId` / `sdkClient` 三个字段保留，作为**默认渠道**（等价于 priority=0 的单条记录）。`modelProviders` 表是可选扩展——有记录走多渠道路由，无记录回退到 `aiModels` 自身字段。现有 10 个 Coze 模型零改动。

## 三、实施步骤

### Step 1: Schema — 新增 `model_providers` 表

**文件**: `server/src/db/schema/gateway.ts`

```
model_providers
├── id              uuid PK
├── modelSlug       varchar(100) NOT NULL  → FK ai_models.slug (ON DELETE CASCADE)
├── providerName    varchar(100) NOT NULL   (openai | replicate | coze | ...)
├── sdkModelId      varchar(200) NOT NULL   (渠道侧模型标识)
├── sdkClient       varchar(50)  NOT NULL   (llm | image | video | replicate | openai)
├── priority        integer NOT NULL DEFAULT 1
├── costPerCall     numeric(10,4) NULL      (单次调用采购成本-美元)
├── costPerSecond   numeric(10,4) NULL      (按秒计费-美元，视频/音频)
├── config          jsonb DEFAULT '{}'      (渠道特定配置)
├── isActive        boolean NOT NULL DEFAULT true
├── createdAt       timestamp NOT NULL DEFAULT now()
├── updatedAt       timestamp NOT NULL DEFAULT now()

Indexes:
├── model_providers_model_slug_idx  ON (modelSlug)
├── model_providers_active_idx      ON (isActive)
└── model_providers_model_priority_idx  ON (modelSlug, priority)  -- 复合索引加速路由查询
```

### Step 2: Migration 0005

**文件**: `server/drizzle/0005_model_providers.sql`

```sql
CREATE TABLE "model_providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "model_slug" varchar(100) NOT NULL REFERENCES "ai_models"("slug") ON DELETE CASCADE,
  "provider_name" varchar(100) NOT NULL,
  "sdk_model_id" varchar(200) NOT NULL,
  "sdk_client" varchar(50) NOT NULL,
  "priority" integer NOT NULL DEFAULT 1,
  "cost_per_call" numeric(10,4),
  "cost_per_second" numeric(10,4),
  "config" jsonb DEFAULT '{}'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "model_providers_model_slug_idx" ON "model_providers" ("model_slug");
CREATE INDEX "model_providers_active_idx" ON "model_providers" ("is_active");
CREATE INDEX "model_providers_model_priority_idx" ON "model_providers" ("model_slug", "priority");
```

同步更新 `server/drizzle/meta/_journal.json` 添加 0005 条目。

### Step 3: AdapterRegistry — 改为按 `sdkClient` 路由

**文件**: `server/src/modules/gateway/adapters/adapter-registry.ts`

当前路由逻辑：
```
getAdapter(modality) → Map<llm, LlmAdapter> / <image, ImageAdapter> / <video, VideoAdapter>
```

改为：
```
getAdapter(sdkClient) → Map<
  'llm',       LlmAdapter       (Coze SDK)
  'image',     ImageAdapter     (Coze SDK)
  'video',     VideoAdapter     (Coze SDK)
  'replicate', ReplicateAdapter (新增)
>
```

向后兼容：如果 `sdkClient` 是 `llm`/`image`/`video`，走原适配器；如果是 `replicate`，走新适配器。未来扩展 `openai` 等只需注册新条目。

### Step 4: ProviderService — 新增渠道查询服务

**文件**: `server/src/modules/gateway/provider.service.ts` (新建)

核心方法：
```typescript
// 查询模型的所有可用渠道，按优先级排序
async getAvailableProviders(modelSlug: string): Promise<ProviderInstance[]>

// 返回结构：
interface ProviderInstance {
  providerName: string;
  sdkModelId: string;
  sdkClient: string;
  priority: number;
  costPerCall: number | null;
  config: Record<string, unknown>;
}
```

查询逻辑：
1. 查 `modelProviders` WHERE modelSlug = ? AND isActive = true ORDER BY priority
2. 如果有记录 → 返回多渠道列表
3. 如果无记录 → 回退到 `aiModels` 自身的 providerName/sdkModelId/sdkClient 构造单元素数组

### Step 5: ReplicateAdapter — 实现 Replicate API 调用

**文件**: `server/src/modules/gateway/adapters/replicate.adapter.ts` (新建)

Replicate API 调用流程：
```
1. POST /v1/predictions
   Body: { version: "owner/model:hash", input: { prompt: "...", ... } }
   → 返回 { id: "prediction-xxx", status: "starting" }

2. GET /v1/predictions/{id}  (轮询，间隔 1s)
   → { status: "processing", logs: "..." }
   → { status: "succeeded", output: "https://..." | ["url1", "url2"] | "text..." }

3. 提取 output，映射为统一 ExecutionResult
```

关键实现细节：
- **纯 REST 调用**（`fetch`），不依赖 `replicate` npm 包，减少依赖
- **轮询策略**：间隔 1s，最大等待时间从 `model.defaultParams.maxWaitTime` 读取（默认 300s）
- **进度推送**：轮询时通过 `context.onProgress` 推送百分比
- **output 适配**：Replicate 的 output 类型取决于模型（string / string[] / object），需要根据 `model.outputType` 统一映射：
  - `outputType: 'image'` → output 是 URL 或 URL 数组 → 映射为 `{ images: [{ url }] }`
  - `outputType: 'video'` → output 是 URL → 映射为 `{ video: { url } }`
  - `outputType: 'text'` → output 是 string → 映射为 `{ content: string }`
- **错误处理**：捕获 `status: 'failed'` + `error` 字段，转换为中文提示
- **Mock 模式**：`REPLICATE_API_TOKEN` 未设置时进入 Mock，与现有适配器行为一致
- **环境变量**：`REPLICATE_API_TOKEN`、`REPLICATE_BASE_URL`（默认 `https://api.replicate.com`）

### Step 6: TaskExecutionService — 支持多 provider 路由 + Fallback

**文件**: `server/src/modules/gateway/task-execution.service.ts`

当前流程：
```
executeTask(taskId, userId, capabilitySlug, input, model)
  → adapter = registry.getAdapter(model.modality)
  → result = adapter.execute(input, model, context)
```

改为：
```
executeTask(taskId, userId, capabilitySlug, input, model)
  → providers = providerService.getAvailableProviders(model.slug)
  → for (provider of providers):
      → adapter = registry.getAdapter(provider.sdkClient)
      → try:
          → providerModel = { ...model, sdkModelId: provider.sdkModelId, ...provider.config }
          → result = adapter.execute(input, providerModel, context)
          → 记录 providerAttempt (status: success, costPerCall: provider.costPerCall)
          → break
      → catch:
          → 记录 providerAttempt (status: failed, errorMessage)
          → continue (尝试下一个 provider)
  → if all failed: throw Error("所有渠道均失败")
```

### Step 7: GatewayService — 调整模型查询

**文件**: `server/src/modules/gateway/gateway.service.ts`

- `submitGeneration()` 中：当前从 `aiModels` 构造 `AdapterModel`，需要增加 `providerName` 传入
- `listModels()` 返回时：过滤掉 `providerName` / `sdkModelId` / `sdkClient` 等内部字段，前端只看到逻辑模型信息
- `resolveInputForAdapter()` 不变：fileId → URL 的转换与 provider 无关

### Step 8: 模型种子数据 — 新增 Replicate 模型

**文件**: `server/src/modules/gateway/seeds/model-seeds.ts`

新增逻辑模型 + 对应 provider 记录：

```typescript
// 逻辑模型（aiModels 表）
{ slug: 'gpt-image-2', name: 'GPT Image 2', providerName: 'replicate', modality: 'image',
  sdkModelId: 'openai/gpt-image-2:placeholder', sdkClient: 'replicate', ... }

{ slug: 'sdxl', name: 'Stable Diffusion XL', providerName: 'replicate', modality: 'image',
  sdkModelId: 'stability-ai/sdxl:placeholder', sdkClient: 'replicate', ... }

{ slug: 'flux-schnell', name: 'FLUX Schnell', providerName: 'replicate', modality: 'image',
  sdkModelId: 'blackforestlabs/flux-schnell:placeholder', sdkClient: 'replicate', ... }

// 渠道实例（modelProviders 表）— 起步阶段每模型只配一个渠道
{ modelSlug: 'gpt-image-2', providerName: 'replicate', sdkModelId: 'openai/gpt-image-2:abc123',
  sdkClient: 'replicate', priority: 1, costPerCall: 0.05 }
{ modelSlug: 'sdxl', providerName: 'replicate', sdkModelId: 'stability-ai/sdxl:def456',
  sdkClient: 'replicate', priority: 1, costPerCall: 0.002 }
{ modelSlug: 'flux-schnell', providerName: 'replicate', sdkModelId: 'blackforestlabs/flux-schnell:ghi789',
  sdkClient: 'replicate', priority: 1, costPerCall: 0.003 }
```

种子脚本需幂等：插入前检查 slug 是否已存在。

### Step 9: GatewayModule — 注册新组件

**文件**: `server/src/modules/gateway/gateway.module.ts`

新增 providers：
- `ProviderService` (新增)
- `{ provide: 'REPLICATE_ADAPTER', useClass: ReplicateAdapter }` (新增)
- `AdapterRegistry` 构造函数新增 `ReplicateAdapter` 注入

### Step 10: Spec YAML 更新

**文件**: `specs/gateway.spec.yaml`

- 新增 `ModelProvider` 实体定义
- 更新 `GTW-007` 规则：从 "按 modality 选择适配器" 改为 "按 sdkClient 选择适配器，支持多 provider 路由"
- 新增 `GTW-009` 规则：模型有多个可用 provider 时按 priority 升序选择，失败时 fallback
- 新增 `GTW-010` 规则：provider 采购成本（costPerCall）记录到 providerAttempts 用于利润分析

### Step 11: 环境变量

**文件**: `server/.env` (开发) + 文档

```
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxx
REPLICATE_BASE_URL=https://api.replicate.com
```

未设置时 ReplicateAdapter 自动进入 Mock 模式。

### Step 12: 测试

| 测试文件 | 新增内容 | 预估测试数 |
|---------|---------|-----------|
| `replicate.adapter.test.ts` (新建) | Mock Replicate API：create prediction / poll / extract output / error handling / mock mode | ~15 |
| `adapter-registry.test.ts` | 新增 sdkClient 路由测试（replicate → ReplicateAdapter） | +3 |
| `provider.service.test.ts` (新建) | 多 provider 查询 / 回退到 aiModels 默认 / 过滤不可用渠道 | ~8 |
| `task-execution.service.test.ts` | 多 provider fallback 场景 / providerAttempt 记录 | +5 |
| `gateway.service.test.ts` | listModels 不暴露 provider 内部字段 | +2 |
| `spec-compliance.test.ts` | ModelProvider 实体合规 + 新规则覆盖 | +4 |

### Step 13: 前端（无改动）

前端 API 契约不变：
- `GET /api/gateway/models` → 返回 `aiModels` 列表（不含 provider 内部字段）
- `POST /api/gateway/generate` → 传 `modelSlug`，后端负责选 provider

WorkspacePage 的能力标签和模型选择逻辑不需要改动。

## 四、文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/src/db/schema/gateway.ts` | 修改 | 新增 `modelProviders` 表定义 |
| `server/drizzle/0005_model_providers.sql` | 新建 | 迁移 SQL |
| `server/drizzle/meta/_journal.json` | 修改 | 添加 0005 条目 |
| `server/src/modules/gateway/adapters/adapter-registry.ts` | 修改 | 改为按 sdkClient 路由 |
| `server/src/modules/gateway/adapters/replicate.adapter.ts` | 新建 | Replicate API 适配器 |
| `server/src/modules/gateway/adapters/replicate.adapter.test.ts` | 新建 | 适配器测试 |
| `server/src/modules/gateway/provider.service.ts` | 新建 | 渠道查询服务 |
| `server/src/modules/gateway/provider.service.test.ts` | 新建 | 渠道查询测试 |
| `server/src/modules/gateway/task-execution.service.ts` | 修改 | 多 provider 路由 + fallback |
| `server/src/modules/gateway/gateway.service.ts` | 修改 | 模型查询调整 |
| `server/src/modules/gateway/gateway.module.ts` | 修改 | 注册新组件 |
| `server/src/modules/gateway/seeds/model-seeds.ts` | 修改 | 新增 Replicate 模型种子 |
| `specs/gateway.spec.yaml` | 修改 | 新增 ModelProvider 实体 + 规则 |
| `AGENTS.md` | 修改 | 记录架构变更 |

## 五、依赖关系

```
Step 1 (Schema)  ────────┐
Step 2 (Migration) ──────┤
                         ├──→ Step 5 (ReplicateAdapter) ──→ Step 12 (测试)
Step 3 (AdapterRegistry) ┤         ↑
Step 4 (ProviderService) ┼─────────┤
                         ├──→ Step 6 (TaskExecution) ────→ Step 12
Step 7 (GatewayService) ─┘         ↑
Step 8 (Seeds) ────────────────────┤
Step 9 (Module) ───────────────────┤
Step 10 (Spec) ────────────────────┤
Step 11 (Env) ─────────────────────┘
```

Step 1-4 可并行，Step 5-9 依赖 1-4，Step 12 依赖全部。

## 六、后续扩展方向（本次不做）

1. **更多渠道接入**：Together AI / Fal.ai / Hugging Face — 只需新增对应 Adapter + modelProviders 记录
2. **Webhook 模式**：Replicate 支持 webhook 回调替代轮询，减少长轮询的资源消耗
3. **成本看板**：基于 `providerAttempts.costPerCall` 聚合统计每个模型的采购成本和利润率
4. **动态模型发现**：调用 Replicate `/v1/models` API 自动同步可用模型列表
5. **A/B 路由**：同一模型多渠道按权重分流而非纯优先级
6. **健康检查**：定期探测各渠道可用性，自动降级不可用 provider
