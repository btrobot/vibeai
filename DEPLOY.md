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

## 六、模型能力路由维护（重要：seed 只增不删）

**背景**：应用启动时 `seedModels()` 对 `capability_model_routes` 只做 `insert ... onConflictDoNothing`——
**只新增、绝不删除/停用**已存在的路由。因此：**从 `SEED_MODEL_ROUTES` 移除某模型路由后，存量数据库里该路由仍然 active**，
代码部署本身不会让它消失。

### 标准操作：移除一条路由（两步缺一不可）

**第 1 步：改代码**（`server/src/modules/gateway/seeds/model-seeds.ts`）
- 从 `SEED_MODEL_ROUTES` 删除对应条目，并加注释说明原因 + 恢复方式。

**第 2 步：部署后停用存量 DB 路由**（prod-02）

```bash
ssh nodecoda-deploy@123.207.4.56
cd /srv/vibeai
DB_PW=$(grep "^DB_PASSWORD=" .env | cut -d= -f2-)
docker exec -e PGPASSWORD="$DB_PW" vibeai-db psql -U vibeai -d vibeai -c \
  "UPDATE capability_model_routes SET is_active=false, updated_at=now() WHERE model_slug LIKE 'doubao%' AND is_active=true;"
```

- 停用而非删除：与 Admin「模型配置 → replaceCapabilityRoutes」同机制（解析只取 `is_active=true`），且可逆。
- 一次停用**永久生效**：seed 不会重新激活这些行；后续版本也不会（除非有人主动 re-add）。

**验证**（active 路由必须与新 seed 列表一致）：

```bash
docker exec -e PGPASSWORD="$DB_PW" vibeai-db psql -U vibeai -d vibeai -t -c \
  "SELECT model_slug, count(*) FROM capability_model_routes WHERE is_active=true GROUP BY model_slug ORDER BY count(*) DESC;"
```

**恢复**：执行反向 `UPDATE ... SET is_active=true ...`，或经 Admin → replaceCapabilityRoutes 重新加入。

### 实例（2026-08-19，vibeai 1.0.16）

- 变更：从 seed 移除未配置凭证的 doubao 路由（text/image/video/style-cloning 等 14 条），避免生成时先命中 doubao 再「无可用渠道」告警。
- 部署后验证发现 DB 仍 active（seed 未删除）→ 执行上述 UPDATE 停用 14 条 → active 路由与新 seed 一致（10 条）。
- 注意：video-generation / style-cloning 原只有 doubao 路由，移除后两能力**不可路由**（本就无可用凭证渠道），属预期。
