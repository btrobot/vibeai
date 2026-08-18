# 新会话提示词

## 任务

实施「多 Provider 路由 + Replicate 接入」，完整规划文档在 `docs/PLAN-multi-provider-replicate.md`，按其中 13 个 Step 逐步执行。

## 核心目标

用户在前端选择模型（如 `gpt-image-2`），系统自动选择最优渠道执行（OpenAI 直连 / Replicate 代理），用户不感知渠道存在。同一模型可有多个渠道，支持优先级路由和故障切换。售价（扣用户积分）与采购成本（付给渠道）独立管理。

## 必读文件

- `docs/PLAN-multi-provider-replicate.md` — 完整实施规划（13 个 Step + 依赖关系 + 文件清单）
- `AGENTS.md` — 项目全景（技术栈、架构决策、已知问题、测试规范）
- `DESIGN.md` — 设计规范
- `server/src/modules/gateway/adapters/protocol-adapter.interface.ts` — 适配器接口定义
- `server/src/modules/gateway/adapters/adapter-registry.ts` — 当前适配器注册表（需改为按 sdkClient 路由）
- `server/src/modules/gateway/task-execution.service.ts` — 任务执行服务（需支持多 provider fallback）
- `server/src/modules/gateway/seeds/model-seeds.ts` — 现有模型种子数据
- `server/src/db/schema/gateway.ts` — Gateway 域 Schema（aiModels / aiCapabilities / providerAttempts）
- `specs/gateway.spec.yaml` — Gateway 域规范（需更新）

## 关键约束

1. **向后兼容**：`aiModels` 表现有 `providerName` / `sdkModelId` / `sdkClient` 字段保留为默认渠道回退，现有 10 个 Coze 模型零改动
2. **ReplicateAdapter 纯 REST**：用 `fetch` 调用 Replicate API（create prediction → poll → extract output），不引入 `replicate` npm 包
3. **Mock 模式**：`REPLICATE_API_TOKEN` 未设置时自动进入 Mock 模式，与现有适配器行为一致
4. **Spec SOT**：先更新 `specs/gateway.spec.yaml`，再写代码，最后跑 `spec-compliance.test.ts`
5. **测试覆盖**：新增约 37 个测试（replicate.adapter / provider.service / adapter-registry / task-execution / gateway.service / spec-compliance）
6. **包管理**：仅允许 pnpm
7. **端口**：前端 5001 / 后端 3001（Vite 代理 /api/* → 后端；本地 5000 被 Forge registry 占用）

## 技术栈

- 后端: NestJS 11 + TypeScript 5 + Drizzle ORM + PostgreSQL 16
- 前端: Vite 7 + React 19 + shadcn/ui + Tailwind CSS v4（本次前端无改动）
- 测试: vitest，后端 458 tests 全通过，前端 73 tests（72/73 通过）

## 执行顺序

按规划文档的依赖关系：
1. Step 1-4 可并行（Schema / Migration / AdapterRegistry / ProviderService）
2. Step 5-9 依赖 1-4（ReplicateAdapter / TaskExecution / GatewayService / Seeds / Module）
3. Step 10-11 可并行（Spec YAML / 环境变量）
4. Step 12 测试（依赖全部完成）
5. Step 13 前端无改动

## 数据库迁移注意

Drizzle migrator 有静默失败问题（记录 hash 但不执行 SQL）。迁移后需手动验证列/表是否存在，必要时手动执行 CREATE TABLE。`server/drizzle/meta/_journal.json` 必须包含新迁移条目。
