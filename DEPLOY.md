# VibeAI 部署文档 (DEPLOY.md)

**版本：** 1.0
**部署方式：** Forge + Docker Compose（fleet 管理）

---

## 一、前置条件

- [ ] Docker ≥ 24（含 buildx 插件）
- [ ] Forge CLI（`forge --version`，安装于 `~/.local/bin/forge`）
- [ ] 目标设备已注册到 fleet（`forge fleet list` 可见）
- [ ] 目标设备已登录 TCR（`ccr.ccs.tencentyun.com`）
- [ ] 本机已登录 TCR 或本地 registry（`127.0.0.1:5000`）
- [ ] 网络可达：build-01 → TCR → prod-02（123.207.4.56）

## 二、部署步骤

### 流程 1：首次部署 / 全量部署

```bash
# 1. 构建镜像（build-01，产物进本地 registry）
forge build . --release v1.0.4

# 2. 发布到 TCR（腾讯云镜像仓库）
forge publish --version 1.0.4 --registry tcr

# 3. 更新服务声明（fleet/services/vibeai-app.yaml 的 image/version）
#    image: ccr.ccs.tencentyun.com/nodecoda/vibeai:1.0.4

# 4. 预演部署（不实际执行）
forge deploy --target prod-02 --service vibeai-app --dry-run

# 5. 正式部署（config 校验 + health check + 失败自动回滚）
forge deploy --target prod-02 --service vibeai-app

# 6. 验证
forge service status --name vibeai-app --device prod-02
```

### 流程 2：更新部署（日常）

```bash
# 1. 拉取最新代码
git pull

# 2. 检查配置变更
git diff HEAD~1 .env.example

# 3. 构建 + 发布 + 部署（版本号递增）
forge build . --release v1.0.5
forge publish --version 1.0.5 --registry tcr
# 更新 vibeai-app.yaml → 1.0.5 后
forge deploy --target prod-02 --service vibeai-app
```

> 注：应用启动时自动执行 Drizzle 迁移 + 种子（start.sh），升级无需手动 migrate。

### 流程 3：回滚部署

```bash
# 1. 查看部署历史
forge service history vibeai-app

# 2. 回滚到上一版本（vibeai-db 有 daily 备份兜底）
forge rollback --target prod-02 --service vibeai-app

# 3. 验证服务状态
forge service status --name vibeai-app --device prod-02
```

## 三、配置说明

| 文件 | 用途 | 是否入库 |
|------|------|---------|
| `.env.example` | 环境变量模板（含端口/密码占位） | ✅ 入库 |
| `.env` / `.env.local` | 实际配置（由 deploy 管理） | ❌ 不入库 |
| `docker-compose.yml` | app + db 编排（`IMAGE_NAME` 由部署注入） | ✅ 入库 |
| `fleet/services/vibeai-app.yaml` | forge 服务声明（image/health/策略） | nodecoda-infra 仓库 |

完整变量列表见 `CONFIG.md`。

## 四、验证

```bash
# 健康检查（应用）
curl -sf http://127.0.0.1:5000/api/health
# 深度健康检查
curl -sf http://127.0.0.1:5000/api/health/deep

# 数据库
docker exec vibeai-db pg_isready -U vibeai

# 服务状态（forge）
forge service status --name vibeai-app --device prod-02
forge fleet doctor

# 日志
docker logs vibeai-app --tail 100
docker compose -f /srv/vibeai/docker-compose.yml logs app -f
```

## 五、升级指南

1. **零停机升级**：vibeai-app 为无状态服务，`forge deploy` 重建容器即可；数据库升级需走 vibeai-db 的 `subsequent` 策略（备份 → upgrade → migrate → verify）
2. **数据迁移**：Schema 迁移由应用启动时 Drizzle 自动执行；升级前确认 `backups/db/` 有最新备份
3. **回滚**：应用 `forge rollback`；数据库回滚恢复 `/srv/vibeai/backup/daily.sql`
4. **常见错误**：
   - `missing required vars` → 检查 `.env` 完整性与 `vibeai-app.yaml` config layers
   - 部署失败自动回滚 → 查看 `forge deploy --json` 输出定位失败步骤
