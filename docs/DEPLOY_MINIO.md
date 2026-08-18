# MinIO 对象存储部署指导（DEPLOY_MINIO.md）

**版本：** 1.0（对应代码提交 `f740181`，main）
**适用场景：** 将 VibeAI 文件存储从 Local（进程本地磁盘）切换到 MinIO（S3 兼容对象存储）
**执行人：** 部署负责人（单人全程执行，本文件即操作清单）

---

## 一、背景与目标

- **现状**：存储走 `LocalStorageProvider`（`server/storage/` 本地磁盘），单机绑定、无备份。
- **目标**：`app` 服务通过 `STORAGE_PROVIDER=s3` 连接 MinIO，文件统一进对象存储。
- **关键机制（代码已就绪，无需再改）**：
  - URL 统一为 `/api/storage/serve/{key}`，由 app 转发 S3 GetObject 读取，**永不过期**。
  - 不使用 `coze-coding-dev-sdk` 的 `generatePresignedUrl`（其依赖 coze 云平台 `x-storage-token`，自建 MinIO 下不可用，已绕开）。
  - `docker-compose.yml` 已内置 `minio` + `minio-init`（自动建 bucket）服务。

---

## 二、前置条件

| 检查项 | 要求 | 验证命令 |
|--------|------|---------|
| Docker Engine | ≥ 24（含 Compose v2） | `docker --version && docker compose version` |
| 镜像源可达 | `8.138.175.157:5000`（insecure registry 白名单） | `curl -s http://8.138.175.157:5000/v2/minio/minio/tags/list` |
| 备用镜像源 | `docker.m.daocloud.io/minio/minio:latest`（docker.io 不可达时用） | `docker pull docker.m.daocloud.io/minio/minio:latest` |
| 代码版本 | main ≥ `f740181` | `git log --oneline -1` |
| 数据库 | 已有可用的 Postgres（compose 内 `db` 服务） | `docker compose ps` |

> 本机 docker.io 直连不可达（registry-mirrors 指向本地 forge-registry），**必须**使用 `8.138.175.157:5000` 或 daocloud 源。

---

## 三、环境变量清单

部署前准备以下变量（compose 启动时注入）：

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `COMPOSE_PROJECT_NAME` | ✅ | — | 项目/容器名前缀（如 `vibeai`） |
| `IMAGE_NAME` | ✅ | — | app 镜像（如 `127.0.0.1:5000/vibeai/vibeai:1.0.11`） |
| `DB_PASSWORD` | ✅ | — | Postgres 密码 |
| `JWT_SECRET` | ✅ | — | JWT 密钥 |
| `MINIO_ROOT_PASSWORD` | ✅ | — | MinIO 管理员密码（**生产必须强密码**） |
| `MINIO_ROOT_USER` | — | `minioadmin` | MinIO 管理员账号 |
| `MINIO_BUCKET` | — | `vibeai` | 对象存储 bucket 名 |
| `S3_REGION` | — | `us-east-1` | 对 MinIO 无实际语义，默认即可 |
| `APP_PORT` | — | `5000` | app 对外端口 |
| `CORS_ORIGIN` | — | 空 | 前端来源（生产建议配置） |
| `REPLICATE_API_TOKEN` | — | 空 | 按需 |
| `COZE_PROJECT_DOMAIN_DEFAULT` | — | 空 | 生成结果的公网域名前缀（AI 适配器输入解析用） |

---

## 四、部署步骤

### 1. 拉取代码

```bash
git fetch origin && git checkout main && git pull
git log --oneline -1   # 确认 ≥ f740181
```

### 2. 准备 app 镜像

方式 A：走既有 Forge/TCR 流程（见 `DEPLOY.md`）构建发布新版本。
方式 B：直接构建：

```bash
# 构建（含 frontend + backend，Dockerfile 4 阶段）
docker build -t 8.138.175.157:5000/vibeai/vibeai:<版本> .
docker push 8.138.175.157:5000/vibeai/vibeai:<版本>
# 或推送到本机 forge registry
docker tag 8.138.175.157:5000/vibeai/vibeai:<版本> 127.0.0.1:5000/vibeai/vibeai:<版本>
docker push 127.0.0.1:5000/vibeai/vibeai:<版本>
```

### 3. 确认 MinIO 镜像可用（已推送 `8.138.175.157:5000/minio/minio:latest`）

```bash
curl -s http://8.138.175.157:5000/v2/minio/minio/tags/list | grep -o '"latest"'
```

### 4. 启动整套服务

```bash
export COMPOSE_PROJECT_NAME=vibeai IMAGE_NAME=8.138.175.157:5000/vibeai/vibeai:1.0.11 \
       DB_PASSWORD=xxx JWT_SECRET=xxx MINIO_ROOT_PASSWORD=xxx

# 语法校验（不启动）
docker compose config --quiet

# 启动（自动拉起 db → minio → minio-init 建 bucket → app）
docker compose up -d

# 确认全部 healthy
docker compose ps
```

预期：`app`、`db`、`minio` 三个服务 `Up`；`minio-init` 一次性执行后退出（`Exit 0`）。

### 5. 验证 bucket 已创建

```bash
docker compose exec minio mc ls local/   # 预期输出 vibeai/
```

---

## 五、验证清单（全部通过才算部署成功）

> 注意：`GET /api/health/deep` 的 `storage.status=up` 只检查环境变量存在，**不代表 S3 连通**。必须以「上传 → serve 读取 → MinIO 落盘」实测为准。

### 5.1 基础健康

```bash
curl -s http://localhost:5000/api/health           # {"status":"ok"}
curl -s http://localhost:5000/api/health/deep      # services.storage.status=up
```

### 5.2 上传 → 落盘 → 读取（关键实测）

```bash
# 1) 注册/登录拿 token（已有账号直接登录）
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"xxx@example.com","password":"xxx"}' | \
  python3 -c "import sys,json;print(json.load(sys.stdin)['data']['tokens']['accessToken'])")

# 2) 上传文件
echo "minio deploy verification $(date +%s)" > /tmp/verify.txt
UP=$(curl -s -X POST http://localhost:5000/api/storage/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/verify.txt;type=text/plain" -F "category=temp")
echo "$UP"
# 预期：返回 url 形如 /api/storage/serve/users/<uuid>/temp/verify_xxxx.txt

# 3) 从 URL 读取（预期 HTTP 200 且内容一致）
URL=$(echo "$UP" | python3 -c "import sys,json;print(json.load(sys.stdin)['url'])")
curl -s -o /dev/null -w "serve HTTP %{http_code}\n" "http://localhost:5000$URL"   # 200

# 4) 确认对象真的在 MinIO
docker compose exec minio mc ls --recursive local/vibeai/users/ | grep verify
# 预期：出现 users/<uuid>/temp/verify_xxx.txt
```

### 5.3 AI 生成结果转存（端到端）

```bash
# 提交一个文生图任务（gpt-image-2 走 pptoken 渠道，需渠道已配置）
curl -s -X POST http://localhost:5000/api/gateway/generate \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"projectId":"<projectId>","capabilitySlug":"image-generation","modelSlug":"gpt-image-2","input":{"prompt":"a red apple on white background"}}'

# 等待任务完成（gpt-image-2 约 1~2 分钟）后确认：
docker compose exec minio mc ls --recursive local/vibeai/users/ | grep generated
# 预期：出现 users/<uuid>/generated/task-<taskId>-img-0_xxxx.png
```

### 5.4 控制台确认（可选）

- 访问 `http://<宿主机IP>:9001`（MinIO Console，账号 = `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`）
- 生产建议**不对外暴露 9001**，仅内网/SSH 隧道访问。

---

## 六、数据迁移（若目标环境已有 Local 存量文件）

> 仅当生产 `server/storage/` 下存在业务文件（files 表有记录）时需要。全新部署可跳过。

### 原理与关键注意点

- 迁移 = 把 `server/storage/{storageKey}` 上传到 MinIO（保持 key 语义）。
- **SDK `uploadFile` 会自动给文件名追加唯一后缀**（如 `a.png` → `a_<hex8>.png`）——上传后**必须把 SDK 返回的新 key 回写到 `files.storage_key` 与 `files.url`**，否则 serve 404。

### 步骤

```bash
# 1) 导出待迁移记录（id / storage_key / mime_type）
psql -h <db-host> -U vibeai -d vibeai -t -A -F$'\t' \
  -c "SELECT id, storage_key, mime_type FROM files WHERE source='storage' AND storage_key IS NOT NULL;" \
  > /tmp/migrate-records.tsv

# 2) 在项目根创建迁移脚本（使用 coze-coding-dev-sdk，注意 endpoint 指向 MinIO）
cat > /tmp/migrate.mjs <<'EOF'
import { S3Storage } from 'coze-coding-dev-sdk';
import fs from 'fs';
const s3 = new S3Storage({
  endpointUrl: 'http://localhost:9000',          // 从 app 容器内则为 http://minio:9000
  accessKey: process.env.MINIO_ROOT_USER || 'minioadmin',
  secretKey: process.env.MINIO_ROOT_PASSWORD,
  bucketName: process.env.MINIO_BUCKET || 'vibeai',
  region: 'us-east-1',
});
const lines = fs.readFileSync('/tmp/migrate-records.tsv','utf8').trim().split('\n');
const updates = [];
for (const line of lines) {
  const [id, storageKey, mimeType] = line.split('\t');
  const local = `/home/vibeai/server/storage/${storageKey}`;
  if (!fs.existsSync(local)) { console.log('SKIP missing local:', storageKey); continue; }
  if (await s3.fileExists({ fileKey: storageKey })) { console.log('SKIP exists:', storageKey); continue; }
  const buf = fs.readFileSync(local);
  const newKey = await s3.uploadFile({ fileContent: buf, fileName: storageKey, contentType: mimeType || 'application/octet-stream' });
  updates.push({ id, newKey });
  console.log('MIGRATED', storageKey, '->', newKey);
}
fs.writeFileSync('/tmp/migrate-updates.json', JSON.stringify(updates, null, 2));
console.log('DONE:', updates.length);
EOF
MINIO_ROOT_PASSWORD=xxx node /tmp/migrate.mjs

# 3) 回写 storage_key 与 url（SDK 追加后缀后 key 已变，必须执行）
python3 - <<'PYEOF'
import json, subprocess
updates = json.load(open('/tmp/migrate-updates.json'))
sql = '\n'.join(
  f"UPDATE files SET storage_key='{u['newKey']}', url='/api/storage/serve/{u['newKey']}', updated_at=now() WHERE id='{u['id']}';"
  for u in updates
)
subprocess.run(['psql','-h','<db-host>','-U','vibeai','-d','vibeai','-c',sql], check=True)
print('updated', len(updates))
PYEOF

# 4) 抽查：对迁移后的文件走 serve 读取，预期 HTTP 200
```

> 迁移脚本为一次性工具，**不要提交到代码库**；执行完删除 `/tmp/migrate*.mjs`。

---

## 七、回滚方案

| 场景 | 操作 |
|------|------|
| 仅切回 Local 存储 | `STORAGE_PROVIDER=local`（compose 环境变量改回），并保证旧 `server/storage/` 数据仍在原路径 |
| 整体回滚 | 恢复旧 compose（`git checkout <旧提交> -- docker-compose.yml`），重建 app/db；MinIO 容器可保留不动（数据不丢失） |
| 数据备份 | MinIO 数据卷 `miniodata`：`docker run --rm -v vibeai_miniodata:/data -v $(pwd)/backup:/backup alpine tar czf /backup/minio-$(date +%s).tar.gz -C /data .` |

---

## 八、注意事项与常见问题

1. **镜像源**：docker.io 直连不可达；生产镜像统一走 `8.138.175.157:5000`（insecure registry 已配置），备选 `docker.m.daocloud.io`。
2. **presigned URL 限制**：`GET /api/storage/files/:id/signed-url` 在 S3/MinIO 模式下返回 serve 路径（非真实签名 URL），属预期行为（coze SDK presigned 依赖云平台，已统一降级）。若未来需要真实预签名，需用 `@aws-sdk/s3-request-presigner` 自行实现（新依赖，需评审）。
3. **存储目录与启动方式**：Local 模式下根目录 = `process.cwd()/storage`，从 `server/` 启动即 `server/storage/`；切 MinIO 后与启动目录无关。
4. **上传大小**：默认 `MAX_UPLOAD_SIZE_MB`（20MB），超限被拒属正常。
5. **健康检查**：`/api/health/deep` 的 storage 状态仅反映环境变量配置；S3 连通性必须以 5.2/5.3 实测为准。
6. **安全**：生产环境务必设置强 `MINIO_ROOT_PASSWORD`，Console（9001）不对外暴露；建议为 app 单独创建低权限访问密钥（`MINIO_ROOT_USER` 仅作引导）。
7. **版本**：本指导对应代码提交 `f740181`；后续存储相关改动请同步更新本文档。

---

## 九、执行人确认清单

- [ ] 前置条件全过（Docker / 镜像源 / 代码版本）
- [ ] 环境变量已备齐（含 `MINIO_ROOT_PASSWORD` 强密码）
- [ ] `docker compose config --quiet` 通过
- [ ] `docker compose up -d` 后三服务 healthy + `minio-init` Exit 0
- [ ] 5.2 上传→serve→MinIO 落盘实测通过
- [ ] 5.3 AI 生成转存实测通过
- [ ] （如迁移）存量文件迁移完成且 serve 抽查 200
- [ ] Console 访问安全（不对外暴露 / 强密码）
- [ ] 回滚预案已确认
