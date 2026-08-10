# VibeAI 前后端测试环境启动指南

## 当前运行状态

✅ **前端服务**: http://localhost:5001  
✅ **后端服务**: http://localhost:3001  
✅ **WebSocket**: ws://localhost:3001/ws/tasks  
✅ **数据库**: PostgreSQL @ localhost:5432/vibeai

---

## 一键启动（推荐）

### 1. 启动完整环境（前端 + 后端）

```bash
cd /home/dev/vibeai
pnpm run dev
```

这会同时启动前端和后端服务。

### 2. 分别启动

**仅启动前端**:
```bash
cd /home/dev/vibeai
pnpm run dev:frontend
# 访问: http://localhost:5001
```

**仅启动后端**:
```bash
cd /home/dev/vibeai/server
pnpm dev
# API: http://localhost:3001
# WebSocket: ws://localhost:3001/ws/tasks
```

---

## 验证服务状态

### 检查后端健康
```bash
curl http://localhost:3001/api/health
# 期望输出: {"status":"ok","timestamp":"..."}
```

### 检查前端
```bash
curl http://localhost:5001
# 期望输出: HTML 页面
```

### 检查 API 文档
```bash
# Swagger UI (如果已配置)
curl http://localhost:3001/api-docs
```

---

## 数据库初始化

### 首次启动时创建数据库

```bash
# 使用 psql 创建数据库
PGPASSWORD=postgres psql -U postgres -h localhost -c "CREATE DATABASE vibeai;"

# 验证数据库
PGPASSWORD=postgres psql -U postgres -h localhost -c "\l" | grep vibeai
```

### 运行数据库迁移（如有）

```bash
cd /home/dev/vibeai/server
pnpm db:migrate
```

### 填充种子数据（可选）

```bash
cd /home/dev/vibeai/server
pnpm db:seed
```

---

## 常见问题排查

### 1. 端口冲突

如果端口被占用，修改 `.env` 文件中的端口配置：

```env
# 前端
VITE_API_URL=http://localhost:3001

# 后端
PORT=3001
DATABASE_URL=postgres://postgres:postgres@localhost:5432/vibeai
```

### 2. 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
sudo systemctl status postgresql

# 启动 PostgreSQL
sudo systemctl start postgresql

# 检查数据库是否存在
PGPASSWORD=postgres psql -U postgres -h localhost -c "\l"
```

### 3. 依赖安装失败

```bash
cd /home/dev/vibeai
pnpm install --no-frozen-lockfile
```

### 4. Workspace 配置错误

确保 `pnpm-workspace.yaml` 存在：

```yaml
packages:
  - '.'
  - 'server'
```

---

## 开发模式特性

### 前端
- ✅ 热模块替换 (HMR)
- ✅ React Fast Refresh
- ✅ TypeScript 类型检查
- ✅ ESLint 实时检查

### 后端
- ✅ 文件监听自动重启 (tsx watch)
- ✅ TypeScript 实时编译
- ✅ API 日志输出
- ✅ Swagger 文档（如果启用）

---

## 测试账号

访问管理后台需要管理员权限账号。

### 创建管理员账号（如需要）

可以通过数据库直接插入或使用注册接口：

```bash
# 方法 1: 使用注册接口
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123","name":"Admin"}'

# 方法 2: 直接修改数据库
PGPASSWORD=postgres psql -U postgres -h localhost vibeai \
  -c "UPDATE users SET role='admin' WHERE email='user@example.com';"
```

---

## 访问应用

### 前端应用
```
http://localhost:5001
```

### 管理后台
```
http://localhost:5001/admin
```
（需要管理员权限登录后访问）

### API 端点示例
```
# 健康检查
GET http://localhost:3001/api/health

# 用户注册
POST http://localhost:3001/api/auth/register

# 管理后台统计（需要管理员 token）
GET http://localhost:3001/api/admin/stats

# WebSocket 连接
ws://localhost:3001/ws/tasks
```

---

## 停止服务

### 停止所有服务
```bash
# 查找并停止进程
pkill -f "vite"
pkill -f "tsx watch"
```

### 或按 Ctrl+C
如果服务在前台运行，直接按 Ctrl+C 停止。

---

## 生产环境部署

生产部署请参考项目中的部署文档（如有）或使用：

```bash
# 构建前端
cd /home/dev/vibeai
pnpm run build

# 构建后端
cd /home/dev/vibeai/server
pnpm run build

# 启动生产服务
pnpm run start
```

---

## 技术栈

### 前端
- React 19
- TypeScript 5.9
- Vite 7.3
- Tailwind CSS 4.3
- React Router 7
- Radix UI

### 后端
- NestJS 11
- TypeScript 5.9
- Drizzle ORM 0.45
- PostgreSQL 16
- Passport JWT
- WebSocket (ws)

---

## 快速参考

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:5001 | React 应用 |
| 后端 API | http://localhost:3001 | NestJS 服务 |
| WebSocket | ws://localhost:3001/ws/tasks | 实时任务更新 |
| 数据库 | postgresql://localhost:5432/vibeai | PostgreSQL |

---

## 获取帮助

如有问题，请检查：
1. 服务日志输出
2. 浏览器控制台错误（前端）
3. 终端错误信息（后端）
4. 数据库连接状态

祝开发顺利！🎉
