# VibeAI 配置文档 (CONFIG.md)

**版本：** 1.0
**适用范围：** 本地开发 / test-01 / prod-01 / prod-02

---

## 一、环境变量

### 必需变量（无默认值，缺失即启动失败）

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串（app+db 同 compose 网络时用 `db:5432`） | `postgres://vibeai:xxx@db:5432/vibeai` |
| `JWT_SECRET` | JWT 签名密钥（≥32 字符强随机；**生产弱密钥/缺省 = 拒绝启动**） | `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | Refresh token 密钥 | 同上 |
| `IMAGE_NAME` | 部署镜像名（docker-compose 注入） | `ccr.ccs.tencentyun.com/nodecoda/vibeai:1.0.4` |

### 必需变量（有默认值）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `5000` | 应用端口（容器内） |
| `CORS_ORIGIN` | 开发 `http://localhost:5000,http://localhost:5173` | 逗号分隔白名单；生产不配置 = 仅同源 |
| `STORAGE_PROVIDER` | `local` | `local` / `s3` |
| `MAX_UPLOAD_SIZE_MB` | `20` | 上传大小上限 |
| `COZE_LOOP_API_TOKEN` | 无 | AI 生成 token；**生产缺失 = 生成接口拒绝（禁用 Mock）** |

### 可选变量

| 变量 | 说明 |
|------|------|
| `SMTP_HOST/PORT/USER/PASS/FROM` | 邮件服务（密码重置发信） |
| `STRIPE_SECRET_KEY` | Stripe 支付（未配置则隐藏支付入口） |
| `GOOGLE_CLIENT_ID/SECRET`、`GITHUB_CLIENT_ID/SECRET` | OAuth 社交登录 |
| `REPLICATE_API_TOKEN` | Replicate 渠道 |
| `COZE_PROJECT_DOMAIN_DEFAULT` | 外部回调/资源绝对 URL 前缀 |
| `BACKUP_DIR` / `BACKUP_RETENTION_DAYS` | 备份脚本配置（默认 `backups/db`、7 天） |
| `ADMIN_DATABASE_URL` | 恢复演练管理员连接 |

## 二、端口

| 端口 | 服务 | 环境 | 说明 |
|------|------|------|------|
| `5000` | vibeai-app | 容器内 / 生产宿主机 | 主服务（NestJS API + SPA） |
| `5432` | vibeai-db | compose 内部 | **不发布到宿主机**（仅 internal 网络） |
| `3001` | NestJS（开发直跑） | 本地开发 | `pnpm dev` |
| `5173/5000` | Vite dev server | 本地开发 | 需在 CORS 白名单内 |
| `443` | auto-ingress (Caddy) | 生产 | 外部入口，反代 app:5000 |

> 端口冲突检查：部署前确认宿主机 5000 未被占用（如本机 5000 曾被 forge registry 占用）。

## 三、密码管理

| 密码/密钥 | 生成方式 | 轮换 | 存储 |
|-----------|---------|------|------|
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -base64 32` | 上线前必换；泄露立即轮换（会使所有会话失效） | 部署机 `.env` / `.env.local`（不入库） |
| `DATABASE_URL` 密码 | `openssl rand -base64 18` | 季度/泄露时 | 同上 |
| 弱密钥黑名单 | `vibeai-*`、`change-me`、`change-in-production` 等 | — | 应用启动 fail-fast 拦截 |

## 四、验证

```bash
# 配置完整性验证
./scripts/validate-config.sh .env          # 若使用 deploy/ 工具链

# 应用健康检查
curl -sf http://127.0.0.1:5000/api/health
curl -sf http://127.0.0.1:5000/api/health/deep

# 安全自检（生产）
NODE_ENV=production JWT_SECRET=weak node dist/main.js   # 应拒绝启动
curl -s -D - http://127.0.0.1:5000/api/health -H "Origin: http://evil.com"  # 应无 ACAO 头

# 备份可用性
./scripts/restore-db.sh --latest             # 演练恢复（默认安全模式）

# 数据库
docker exec vibeai-db pg_isready -U vibeai
```
