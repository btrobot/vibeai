# VibeAI 项目 — 新会话提示词

## 当前状态

VibeAI 内容创作平台，前后端分离架构，已部署到腾讯云测试机。

### 部署信息
- **测试机**: `124.220.35.168:6060`
- **架构**: Docker Compose (app + PostgreSQL 16)
- **自动检测**: `scripts/detect-registry.sh` 自动识别腾讯云 → 使用国内镜像源

### 测试全景（284 全部通过）
| 类别 | 数量 |
|------|------|
| 后端测试 | 180 (12 文件) |
| 前端测试 | 71 (12 文件) |
| Spec 合规 | 22 (6 域) |
| E2E | 11 (Playwright) |

### 治理体系
- `specs/` — 6 域 .spec.yaml，Spec SOT 治理
- `spec-compliance.test.ts` — 22 条合规断言
- `TEST_GOVERNANCE.md` — 质量门禁体系
- `scripts/docker-validate.sh` — Docker 构建预检

### 最近修复
- Docker 构建: 多阶段构建 + 国内/国际双源支持
- 原生模块: bcrypt 通过 `pnpm.onlyBuiltDependencies` 白名单编译
- 生产模式: NestJS 后端直接 serve 前端静态文件（不再用 `npx serve`）
- 入口端口: 6060（腾讯云安全组已放行）

### 未完成 / 已知问题
1. **登录接口 JSON 错误** — 生产模式前端的 `/api/*` 请求被 `serve` 拦截返回 HTML
   - 修复中: `server/src/main.ts` 添加 `NODE_ENV===production` 时 NestJS 直接 serve 静态文件
   - `scripts/start.sh` 需移除 `npx serve`，改为 NestJS 单端口服务
2. **集成测试** — 需手动 `pnpm build` + `node scripts/test-integration.js`
3. **E2E 测试** — 未加入 CI 工作流（需 Playwright 浏览器缓存）

### 下一步方向
A. 跑通真实 AI 生成链路（LLM/图片/视频 SDK）
B. 用户体验打磨（骨架屏、错误边界、响应式）
C. 评论区 / 通知系统
D. 部署 CI/CD 完善

### 关键文件
- `Dockerfile` — 多阶段构建
- `docker-compose.yml` — 本地部署
- `scripts/` — 构建/启动/检测脚本
- `.github/workflows/ci.yml` — CI 流水线
- `server/src/main.ts` — 入口（含静态文件服务）
- `scripts/start.sh` — 生产启动脚本