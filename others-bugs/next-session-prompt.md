# 新会话提示词 — VibeAI 内容创作平台

## 当前状态

Phase 1-6 全部完成，前后端全功能已就绪。**564 个测试，563/564 通过**（1 个前端预存失败）。

## 项目结构

```
├── server/               # NestJS 11 后端 (port 3001)
│   ├── src/modules/      # 业务模块 (auth/storage/gateway/engine/billing/gallery)
│   ├── src/db/schema/    # Drizzle 数据表定义
│   ├── src/test/         # 测试基础设施 (mock 工厂/工具)
│   └── drizzle/          # 迁移文件 (0000-0004)
├── src/                  # Vite 7 + React 19 前端 (port 5000)
│   ├── pages/            # 页面组件
│   └── components/ui/    # shadcn/ui 标准组件库
├── specs/                # 六域规范 (.spec.yaml)
├── others-bugs/          # Bug 报告存档
├── AGENTS.md             # 项目全景文档（必读）
└── DESIGN.md             # 设计规范（必读）
```

## 技术栈

- 后端: NestJS 11 + TypeScript 5 + Drizzle ORM + PostgreSQL 16
- 前端: Vite 7 + React 19 + shadcn/ui + Tailwind CSS v4
- 认证: JWT (access 15min + refresh 7d) + HttpOnly Cookie
- 包管理: pnpm 仅允许
- 端口: 前端 5000 / 后端 3001（Vite 代理 /api/* → 后端）
- 预览: 主仓 5000 端口常驻，HMR 自动热更

## 已实现功能

| Phase | 域 | 功能 |
|-------|-----|------|
| 1 | Auth | 注册/登录/登出/刷新/用户信息/JWT 双 token |
| 2 | Storage | 文件上传/管理/Provider 抽象 (S3+Local) |
| 3 | Gateway | 能力注册表/模型路由/适配器 (Image/Video/LLM)/Mock 模式 |
| 4 | Engine | Project/Create/Task/ExecutionState + WebSocket 实时推送 |
| 5 | Billing | 套餐管理/订阅/信用额度/用量统计/自动扣减 |
| 6 | Frontend | Dashboard/Workspace/Gallery/Billing/Settings/Admin/Storage/Tool 页面 |
| 6 | Gallery | 作品发布/点赞/浏览 + fileId 外键迁移 (Migration 0004) |

## 关键架构决策

1. **媒体文件统一引用模型**：所有媒体通过 `files` 表用 **fileId (UUID)** 引用，URL 运行时解析。前端传 `{ fileId }`，后端 `resolveInputForAdapter()` 转 URL 传给 AI SDK，`transferResult()` 下载转存回 fileId
2. **Gallery fileId 迁移** (Migration 0004)：`gallery_works.image_file_id/video_file_id` 外键 → `files.id`，遗留 `image_url/video_url` 列保留作为回退
3. **WorkspacePage 图片上传**：图像类能力显示上传按钮，上传后提交 `{ referenceImage: { fileId } }`
4. **AI 适配器 Mock 模式**：`COZE_LOOP_API_TOKEN` 未设置时自动 Mock，走通全流程
5. **Spec SOT 治理**：`specs/*.spec.yaml` 是业务语义唯一真相源，合规测试自动验证

## 已知问题 / 待办

### 待办（后续迭代）

1. **Gallery 页面优化**：作品卡展示图片/视频，支持点赞交互
2. **Workspace 增强**：多步创作流程（Create → 修改 → 再创作），`sourceCreateId` 自引用已就绪
3. **Admin 后台完善**：用户管理、套餐管理、用量统计面板
4. **E2E 覆盖**：补充 Workspace 创作流程、计费流程 E2E 测试
5. **集成测试**：`pnpm build` 后运行 `node scripts/test-integration.js`（需先构建）
6. **迁移 0004 部署**：`gallery_works` 的 `image_file_id`/`video_file_id` 列需在测试机手动 ALTER TABLE 或通过 `drizzle/meta/_journal.json` 触发迁移

### 已知问题

- **Drizzle 迁移静默失败**：migrator 记录 hash 但可能跳过 SQL 执行，需手动验证
- **前端 1 个测试失败**：`RegisterPage.test.tsx` 密码可见切换按钮 accessible name 问题
- **AI SDK 错误**：`t.data is not iterable` — SDK 缺少数组校验，已在适配器层 try-catch 包装 (见 `others-bugs/`)
- **集成测试需构建后运行**：tsx ESM loader 与 NestJS 装饰器不兼容

## 进入新会话后的建议操作

1. 先读 `AGENTS.md` 和 `DESIGN.md` 获取项目全景
2. 确认预览服务是否运行（主仓 5000 端口常驻，HMR 自动热更）
3. 如需验证后端，先读 `AGENTS.md` 中的测试进展和已知问题
4. 数据库迁移验证：`server/drizzle/meta/_journal.json` 应包含 0000-0004 条目