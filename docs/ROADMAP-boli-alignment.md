# VibeAI → Boli SaaS 功能对齐规划

> 版本: 1.0 | 日期: 2026-08-10
> 
> **核心理念**: VibeAI 是经过深思熟虑的重构版 MVP，不是简单删减。我们在三个核心概念上做了改进：
> - **AI Gateway**: 简化三层为两层（逻辑模型 + 渠道实例）
> - **Storage**: 统一文件抽象，运行时 URL 解析
> - **Project**: 创作意图与执行分离的三层架构（Projects → Creates → Tasks）

---

## 一、核心重构对比分析

### 1.1 AI Gateway 架构差异

| 维度 | Boli（三级架构） | VibeAI（两层架构） | 优势 |
|------|-----------------|-------------------|------|
| **实体层级** | Model → Platform → ModelOffering → Channel | aiModels → modelProviders | 更简单，易理解 |
| **路由复杂度** | 需要 OfferingRouter、ModelCodec、ProtocolAdapter | 直接按 sdkClient 路由到 Adapter | 代码路径短 |
| **配置方式** | Channel 级别配置 config | Provider 级别 config | 统一管理 |
| **成本追踪** | Channel.costPerCall | ProviderAttempt.costPerCall | 审计更完整 |
| **故障切换** | Offering 内多 Channel 轮询 | Provider 列表优先级 + fallback | 逻辑清晰 |

**VibeAI 的改进**:
- ✅ 去掉了 Platform 和 Offering 中间层，直接关联 Model 和 Provider
- ✅ Provider 记录采购成本（costPerCall），Model 记录售价（costCredits），利润分析更清晰
- ✅ 向后兼容：aiModels 表的 providerName/sdkModelId/sdkClient 作为默认渠道（priority=0）
- ✅ 支持多 Provider 路由和故障切换（已实施 Replicate 接入）

### 1.2 Storage 架构差异

| 维度 | Boli | VibeAI | 优势 |
|------|------|--------|------|
| **表结构** | StorageObject + UserAsset + GalleryMediaPublication | 统一 files 表 | 数据模型简单 |
| **URL 解析** | 持久化 url 字段 | 运行时 resolveUrl() | 灵活切换 CDN |
| **外部引用** | 无统一抽象 | source='external' + externalUrl | 支持外部 URL 虚拟文件 |
| **权限控制** | 通过 publication 投影 | isPublic + userId 检查 | 逻辑直观 |
| **状态管理** | PENDING_UPLOAD → READY | 无状态机（上传即 READY） | 更简单 |

**VibeAI 的改进**:
- ✅ 统一的 files 表，所有文件（存储、外部）都有 fileId
- ✅ 运行时 URL 解析，支持动态切换 CDN 域名
- ✅ 外部 URL 作为虚拟文件注册（`registerExternalFile`），AI 调用时统一解析
- ✅ `downloadAndStore` 方法支持 AI 生成结果的确定性转存
- ⚠️ 缺少：公开权限投影系统（Gallery publication）

### 1.3 Project / Task Engine 差异

| 维度 | Boli | VibeAI | 优势 |
|------|------|--------|------|
| **核心实体** | Task | Project → Create → Task | 创作意图与执行分离 |
| **重试机制** | 同一 Task 多次 attempt | Create 下多个 Task | 版本管理清晰 |
| **输入存储** | Task.params（存储最终参数） | Create.input（原始参数）+ Task.input（解析后） | 保留用户意图 |
| **执行追踪** | 无 | ExecutionStates 表 | 步骤级追踪 |
| **父子关系** | Task.sourceTaskId | Create.sourceCreateId + Task.sourceTaskId | 支持创作改编 |

**VibeAI 的改进**:
- ✅ Create 表代表"用户的一次创作意图"，与 Task 执行解耦
- ✅ 支持基于已有创作进行修改（sourceCreateId）
- ✅ Task.input 存储 fileId 引用，Create.input 存储原始输入（含 fileId）
- ✅ ExecutionStates 记录执行步骤（queued → submitting → completing → completed）
- ✅ 项目统计（totalTasks/completedTasks）自动更新

---

## 二、功能差距矩阵

### 2.1 Admin 后台功能

| 功能模块 | Boli | VibeAI | 差距 | 优先级 |
|---------|------|--------|------|-------|
| **用户管理** | ✅ 完整 | ✅ 完整（已重构） | 无 | - |
| ├─ 用户列表/搜索/筛选 | ✅ | ✅ | - | - |
| ├─ 创建/更新用户 | ✅ | ✅ | - | - |
| ├─ 信用调整 | ✅ | ✅ | - | - |
| ├─ 重置密码 | ✅ | ⚠️ 待实现 | P1 | 🔴 高 |
| ├─ 发送通知 | ✅ | ✅（已实现） | - | - |
| ├─ 导出 CSV | ✅ | ✅（已实现） | - | - |
| └─ 用户详情 | ✅ | ⚠️ 基础详情 | P2 | 🟡 中 |
| **任务/订单管理** | ✅ 完整 | ⚠️ 部分 | - | - |
| ├─ 任务列表 | ✅ | ✅（基础） | - | - |
| ├─ 任务详情 | ✅ | ⚠️ 简化版 | P2 | 🟡 中 |
| ├─ 订单系统 | ✅ | ❌ 无 | P1 | 🔴 高 |
| ├─ 退款管理 | ✅ | ❌ 无 | P1 | 🔴 高 |
| └─ 统计数据 | ✅ | ⚠️ 基础统计 | P2 | 🟡 中 |
| **AI Gateway 管理** | ✅ 三级管理 | ⚠️ 简化版 | - | - |
| ├─ Model CRUD | ✅ | ✅ | - | - |
| ├─ Provider 管理 | ✅（多渠道） | ⚠️（基础） | P3 | 🟢 低 |
| ├─ 生命周期管理 | ✅（status + purge） | ❌ 无 | P3 | 🟢 低 |
| └─ 审计日志 | ✅ | ⚠️（ProviderAttempt） | P2 | 🟡 中 |
| **内容管理** | ✅ 完整 | ⚠️ 部分 | - | - |
| ├─ Gallery 管理 | ✅ | ✅（基础） | - | - |
| ├─ 公告管理 | ✅ | ❌ 无 | P2 | 🟡 中 |
| ├─ 首页配置 | ✅ | ❌ 无 | P3 | 🟢 低 |
| └─ 商品分类 | ✅ | ❌ 无 | P1 | 🔴 高 |
| **电商管理** | ✅ 完整 | ❌ 无 | - | - |
| ├─ 套餐管理 | ✅ | ❌ 无 | P1 | 🔴 高 |
| ├─ 信用包管理 | ✅ | ❌ 无 | P1 | 🔴 高 |
| ├─ 促销码管理 | ✅ | ❌ 无 | P2 | 🟡 中 |
| └─ 电商平台集成 | ✅（TikHub） | ❌ 无 | P3 | 🟢 低 |
| **系统配置** | ✅ 分组配置 | ⚠️ 简化版 | P2 | 🟡 中 |
| ├─ 站点配置 | ✅ | ⚠️ | - | - |
| ├─ 邮件配置 | ✅ | ❌ 无 | P2 | 🟡 中 |
| ├─ 存储配置 | ✅ | ❌ 无 | P3 | 🟢 低 |
| └─ 支付配置 | ✅ | ❌ 无 | P1 | 🔴 高 |
| **运维管理** | ✅ 完整 | ❌ 无 | - | - |
| ├─ Dashboard | ✅ | ⚠️（基础） | P2 | 🟡 中 |
| ├─ 性能剖析 | ✅ | ❌ 无 | P3 | 🟢 低 |
| ├─ 审计日志 | ✅ | ❌ 无 | P2 | 🟡 中 |
| └─ 系统监控 | ✅ | ❌ 无 | P3 | 🟢 低 |
| **客服支持** | ✅ 完整 | ❌ 无 | P2 | 🟡 中 |
| ├─ 客服聊天 | ✅ | ❌ 无 | P2 | 🟡 中 |
| └─ 票证系统 | ✅ | ❌ 无 | P3 | 🟢 低 |

### 2.2 前端功能差距

| 功能模块 | Boli | VibeAI | 差距 | 优先级 |
|---------|------|--------|------|-------|
| **用户前台** | ✅ 完整 | ⚠️ MVP | - | - |
| ├─ 首页 | ✅ 可配置 | ⚠️ 固定 | P2 | 🟡 中 |
| ├─ Gallery | ✅ 完整 | ⚠️ 基础 | P2 | 🟡 中 |
| ├─ 工作台 | ✅ 完整 | ⚠️ 简化 | P2 | 🟡 中 |
| └─ 项目管理 | ✅ 完整 | ✅ | - | - |
| **创作工具** | ✅ 多种 | ⚠️ 部分 | - | - |
| ├─ 白底图生成 | ✅ | ⚠️ 基础 | P2 | 🟡 中 |
| ├─ 场景合成 | ✅ | ❌ 无 | P3 | 🟢 低 |
| ├─ 模特换装 | ✅ | ❌ 无 | P3 | 🟢 低 |
| └─ 详情页生成 | ✅ | ❌ 无 | P3 | 🟢 低 |
| **电商工具** | ✅ 完整 | ❌ 无 | - | - |
| ├─ 商品管理 | ✅ | ❌ 无 | P1 | 🔴 高 |
| ├─ 订单管理 | ✅ | ❌ 无 | P1 | 🔴 高 |
| └─ 数据统计 | ✅ | ❌ 无 | P2 | 🟡 中 |

---

## 三、分阶段对齐规划

### 🟥 Phase 1: 核心支付与订阅（2-3周）

**目标**: 让平台具备商业化的基础能力

#### 1.1 支付系统集成

**后端任务**:
- [ ] 集成 Stripe 支付（Boli 使用 Stripe）
- [ ] 实现 `PaymentModule`（支付模块）
- [ ] 支付回调 Webhook 处理
- [ ] 支付失败重试机制
- [ ] 支付安全验证（webhook signature）

**数据库 Schema**:
```sql
-- 支付记录表
CREATE TABLE payments (
  id uuid PRIMARY KEY,
  userId uuid NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency varchar(3) DEFAULT 'USD',
  status varchar(20) NOT NULL, -- pending | completed | failed | refunded
  provider varchar(50) NOT NULL, -- stripe
  providerPaymentId varchar(255),
  metadata jsonb,
  createdAt timestamp,
  completedAt timestamp
);

-- 订单表
CREATE TABLE orders (
  id uuid PRIMARY KEY,
  userId uuid NOT NULL,
  orderNumber varchar(50) UNIQUE,
  type varchar(50) NOT NULL, -- credit_pack | package | subscription
  amount numeric(10,2) NOT NULL,
  credits integer,
  status varchar(20) NOT NULL, -- pending | paid | completed | expired | cancelled
  paymentId uuid REFERENCES payments(id),
  expiresAt timestamp,
  createdAt timestamp
);
```

**API 端点**:
```
POST   /api/payments/create-intent  # 创建支付意图
POST   /api/payments/webhook        # Stripe webhook
GET    /api/payments/:id            # 查询支付状态
POST   /api/orders/create           # 创建订单
GET    /api/orders                  # 订单列表
GET    /api/orders/:id              # 订单详情
```

#### 1.2 套餐与信用包系统

**功能**:
- 支持固定信用包（如 100 积分 $9.9）
- 支持订阅套餐（月度/年度会员）
- 套餐过期管理
- 套餐使用记录

**数据库 Schema**:
```sql
-- 套餐定义表
CREATE TABLE packages (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL,
  type varchar(20) NOT NULL, -- credit_pack | subscription
  credits integer NOT NULL,
  price numeric(10,2) NOT NULL,
  currency varchar(3) DEFAULT 'USD',
  durationDays integer, -- 订阅制时长
  isActive boolean,
  sortOrder integer,
  features jsonb, -- 套餐特性列表
  createdAt timestamp
);

-- 用户套餐订阅表
CREATE TABLE user_subscriptions (
  id uuid PRIMARY KEY,
  userId uuid NOT NULL,
  packageId uuid NOT NULL REFERENCES packages(id),
  orderId uuid REFERENCES orders(id),
  status varchar(20) NOT NULL, -- active | expired | cancelled
  creditsRemaining integer,
  expiresAt timestamp,
  createdAt timestamp
);
```

**参考 Boli**:
- `apps/server/src/modules/admin-commerce/controllers/admin-package.controller.ts`
- `apps/server/src/modules/admin-commerce/controllers/admin-credit-pack.controller.ts`

#### 1.3 退款管理

**功能**:
- 管理员可以发起退款
- 退款记录追踪
- 退款理由必填
- 退款后信用回收

**API 端点**:
```
POST   /admin/orders/:id/refund
```

**参考 Boli**:
- `apps/server/src/modules/admin-commerce/controllers/admin-order.controller.ts`

---

### 🟨 Phase 2: 电商基础功能（3-4周）

**目标**: 支持电商内容创作工具

#### 2.1 商品分类系统

**功能**:
- 多级分类（支持父子关系）
- 分类属性管理（尺寸、颜色等）
- 分类图标/图片

**数据库 Schema**:
```sql
CREATE TABLE product_categories (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL,
  parentId uuid REFERENCES product_categories(id),
  slug varchar(100) UNIQUE,
  icon varchar(255),
  attributes jsonb, -- 分类属性定义
  sortOrder integer,
  isActive boolean,
  createdAt timestamp
);
```

**参考 Boli**:
- `apps/server/src/modules/admin-commerce/controllers/admin-product-category.controller.ts`

#### 2.2 商品管理

**功能**:
- 商品 CRUD
- 商品图片管理
- 商品分类关联
- 商品上架/下架

**数据库 Schema**:
```sql
CREATE TABLE products (
  id uuid PRIMARY KEY,
  userId uuid NOT NULL,
  name varchar(200) NOT NULL,
  description text,
  categoryId uuid REFERENCES product_categories(id),
  images jsonb, -- 图片 ID 列表
  status varchar(20) NOT NULL, -- draft | active | archived
  metadata jsonb,
  createdAt timestamp,
  updatedAt timestamp
);
```

**参考 Boli**:
- Boli 使用 `product-listing` 模块

#### 2.3 促销码系统

**功能**:
- 固定折扣（如 $10 off）
- 百分比折扣（如 20% off）
- 促销码有效期
- 使用次数限制
- 单用户使用限制

**数据库 Schema**:
```sql
CREATE TABLE promo_codes (
  id uuid PRIMARY KEY,
  code varchar(50) UNIQUE NOT NULL,
  type varchar(20) NOT NULL, -- fixed | percentage
  value numeric(10,2) NOT NULL,
  maxUses integer,
  usedCount integer DEFAULT 0,
  validFrom timestamp,
  validUntil timestamp,
  minAmount numeric(10,2), -- 最低消费金额
  isActive boolean,
  createdAt timestamp
);

CREATE TABLE user_promo_uses (
  id uuid PRIMARY KEY,
  userId uuid NOT NULL,
  promoCodeId uuid NOT NULL REFERENCES promo_codes(id),
  orderId uuid REFERENCES orders(id),
  usedAt timestamp
);
```

**参考 Boli**:
- `apps/server/src/modules/admin-commerce/controllers/admin-promo-code.controller.ts`

---

### 🟩 Phase 3: 内容管理增强（2-3周）

**目标**: 完善内容管理和展示

#### 3.1 公告系统

**功能**:
- 公告 CRUD
- 公告发布/下架
- 公告类型（info / warning / maintenance）
- 定时发布

**数据库 Schema**:
```sql
CREATE TABLE announcements (
  id uuid PRIMARY KEY,
  title varchar(200) NOT NULL,
  content text NOT NULL,
  type varchar(20) NOT NULL, -- info | warning | maintenance
  isActive boolean,
  scheduledAt timestamp,
  expiresAt timestamp,
  createdAt timestamp,
  updatedAt timestamp
);
```

**参考 Boli**:
- `apps/web/src/app/(admin)/admin/announcements/`

#### 3.2 首页配置

**功能**:
- 轮播图配置
- 推荐作品配置
- 功能区块配置
- SEO 配置

**实现方式**:
- 使用系统配置表（`system_settings`）
- 前端通过 API 获取配置
- 支持实时预览

**参考 Boli**:
- `apps/web/src/app/(admin)/admin/home-config/`

#### 3.3 Gallery 公开权限系统

**目标**: 补齐 VibeAI 缺失的 Gallery publication 功能

**设计参考 Boli**:
```sql
-- Gallery 作品表
CREATE TABLE gallery_works (
  id uuid PRIMARY KEY,
  userId uuid NOT NULL,
  taskId uuid REFERENCES tasks(id),
  fileId uuid REFERENCES files(id),
  title varchar(200),
  description text,
  tags text[],
  status varchar(20) NOT NULL, -- draft | published | rejected | unpublish
  isPublic boolean, -- 是否允许公开
  publishedAt timestamp,
  createdAt timestamp
);

-- Gallery 公开投影表（权限控制）
CREATE TABLE gallery_publications (
  id uuid PRIMARY KEY,
  workId uuid NOT NULL REFERENCES gallery_works(id) ON DELETE CASCADE,
  publishedAt timestamp NOT NULL,
  expiresAt timestamp,
  UNIQUE(workId)
);
```

**访问控制逻辑**:
```typescript
async canAccessGallery(fileId: string, userId?: string): Promise<boolean> {
  // 1. 文件是公开的且已发布
  const publication = await db.query.galleryPublications.findFirst({
    where: eq(galleryPublications.workId, fileId)
  });
  
  if (publication) {
    // 检查是否过期
    if (!publication.expiresAt || publication.expiresAt > new Date()) {
      return true;
    }
  }
  
  // 2. 用户是作者
  const work = await db.query.galleryWorks.findFirst({
    where: and(
      eq(galleryWorks.id, fileId),
      eq(galleryWorks.userId, userId ?? '')
    )
  });
  
  return !!work;
}
```

---

### 🟦 Phase 4: Admin 高性能优化（2-3周）

**目标**: 对齐 Boli 的高性能页面设计模式

#### 4.1 实现读写分离

**参考 Boli 设计**:
- `design/admin/01-admin-high-performance-page-patterns.md`
- `design/admin/02-admin-page-implementation-guide.md`

**实施**:
- Query/Mutation Service 分离（VibeAI 已部分实现）
- 读链路：列表、搜索、筛选、分页
- 写链路：审核、状态切换、批量操作

#### 4.2 请求竞态治理

**实现**:
- 每个 list 请求有 lane key
- 新请求发出后，旧请求结果不可落盘
- AbortController 支持

**示例代码**:
```typescript
class AdminUserQueryService {
  private latestListToken: symbol | null = null;
  
  async getUsers(query: AdminUserQueryDto) {
    const currentToken = Symbol('list');
    this.latestListToken = currentToken;
    
    const result = await this.db.query.users.findMany(...);
    
    // 只认当前请求
    if (this.latestListToken !== currentToken) {
      return null; // 丢弃旧结果
    }
    
    return result;
  }
}
```

#### 4.3 局部乐观更新

**适用场景**:
- ✅ 单行审核、状态切换
- ❌ 权限、资金、删除操作

**实现**:
- UI 先更新，再提交
- 失败则回滚
- 成功后后台对账

#### 4.4 精确 in-flight 状态

**实现**:
- `loadingRecords` - 列表加载
- `loadingStats` - 统计加载
- `rowSubmittingIds` - 行级提交中（Set）

---

### 🟪 Phase 5: 系统配置与运维（2-3周）

**目标**: 完善系统管理和运维能力

#### 5.1 分组配置系统

**参考 Boli**:
- `packages/shared/src/types/admin-settings.ts`

**功能**:
- 14 种配置分组（site、register、security、ai、email、storage、payment...）
- 动态表单定义（string/number/boolean/password/select/textarea）
- 字段依赖关系（dependsOn）
- 配置导出/导入
- 密码字段隐藏（reveal 操作）
- 配置测试（email、storage 连通性测试）

**数据库 Schema**:
```sql
CREATE TABLE system_settings (
  id uuid PRIMARY KEY,
  group varchar(50) NOT NULL,
  key varchar(100) NOT NULL,
  value text,
  type varchar(20) NOT NULL, -- string | number | boolean | password | json
  updatedAt timestamp,
  UNIQUE(group, key)
);
```

#### 5.2 审计日志

**功能**:
- 记录所有管理员操作
- 操作类型：create / update / delete / ban / unban
- 操作结果：success / failed
- 操作者、时间、IP

**数据库 Schema**:
```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY,
  adminId uuid NOT NULL,
  action varchar(50) NOT NULL,
  entityType varchar(50) NOT NULL, -- user | order | package
  entityId uuid,
  changes jsonb, -- 变更前后的值
  status varchar(20) NOT NULL, -- success | failed
  ipAddress varchar(50),
  userAgent text,
  createdAt timestamp
);
```

#### 5.3 性能剖析

**参考 Boli**:
- `design/admin/02-admin-targeted-profiling-and-timing-design.md`

**功能**:
- 定向 Profiling（按页面/接口）
- 计时机制（response time、database time）
- 慢查询日志
- 性能统计看板

---

### 🟧 Phase 6: 客服支持系统（3-4周）

**目标**: 完善用户服务能力

#### 6.1 站内通知系统

**参考 Boli**:
- VibeAI 已实现基础通知（`AdminNotificationService`）

**增强**:
- 通知模板管理
- 通知群发（按角色/标签）
- 通知已读/未读状态
- 通知历史

**数据库 Schema**:
```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  userId uuid NOT NULL,
  type varchar(50) NOT NULL, -- system | order | credit | task
  title varchar(200) NOT NULL,
  content text NOT NULL,
  link varchar(255),
  icon varchar(50),
  isRead boolean DEFAULT false,
  readAt timestamp,
  createdAt timestamp
);
```

#### 6.2 邮件通知系统

**功能**:
- 邮件模板管理
- 事件触发邮件（注册、订单、任务完成）
- 邮件发送队列
- 发送失败重试

**技术选型**:
- 使用 Nodemailer（VibeAI 已依赖）
- 支持 SMTP / SendGrid / AWS SES

**参考 Boli**:
- `apps/server/src/modules/admin-support/`

#### 6.3 客服聊天（可选）

**参考 Boli**:
- `apps/server/src/modules/customer-chat/`
- `apps/web/src/app/(admin)/admin/customer-chat/`

**基础功能**:
- WebSocket 实时聊天
- 聊天记录持久化
- 客服分配
- 常见问题模板

---

## 四、技术债务与优化

### 4.1 测试覆盖率提升

**目标**: 从当前 ~40% 提升到 70%+

**策略**:
- 补齐 Admin 模块测试（Boli 有完整的测试套件）
- E2E 测试（Playwright）
- API 集成测试
- 性能测试

### 4.2 文档完善

**目标**: 建立完整的技术文档体系

**参考 Boli**:
- `docs/` 目录完整文档
- `design/` 设计决策文档
- `dev-docs/` 开发者文档

**需要创建**:
- API 文档（Swagger/OpenAPI）
- 数据库 ERD 图
- 部署文档
- 运维手册
- 故障排查指南

### 4.3 性能优化

**目标**:
- 页面加载时间 < 2s（P95）
- API 响应时间 < 500ms（P95）
- 数据库查询优化

**参考 Boli**:
- Admin 高性能设计模式
- 性能剖析体系

---

## 五、迁移策略

### 5.1 数据迁移

**如果从 Boli 迁移数据到 VibeAI**:

1. **用户数据**: 直接迁移 `users` 表
2. **任务数据**: 
   - Boli Task → VibeAI Create + Task
   - 需要数据清洗脚本
3. **文件数据**: 
   - Boli StorageObject → VibeAI files
   - 需要重新生成 fileId
4. **配置数据**: 
   - 系统配置可导出为 JSON 再导入

### 5.2 功能迁移优先级

**必须迁移**（P1）:
- 支付与订阅系统
- 订单管理
- 商品分类
- 退款管理

**建议迁移**（P2）:
- 公告系统
- 首页配置
- 促销码
- 审计日志

**可选迁移**（P3）:
- 客服聊天
- 性能剖析
- 高级 AI Gateway 功能

---

## 六、时间线总览

```
Month 1-2: Phase 1 - 支付与订阅（P1）
           ├─ Stripe 集成
           ├─ 套餐系统
           └─ 退款管理

Month 3-4: Phase 2 - 电商基础（P1）
           ├─ 商品分类
           ├─ 商品管理
           └─ 促销码

Month 5-6: Phase 3 - 内容管理（P2）
           ├─ 公告系统
           ├─ 首页配置
           └─ Gallery 权限

Month 7-8: Phase 4 - 性能优化（P2）
           ├─ 读写分离
           ├─ 请求竞态治理
           └─ 局部乐观更新

Month 9-10: Phase 5 - 系统运维（P2）
           ├─ 分组配置
           ├─ 审计日志
           └─ 性能剖析

Month 11-12: Phase 6 - 客服支持（P2）
           ├─ 站内通知
           ├─ 邮件系统
           └─ 客服聊天
```

---

## 七、总结

### VibeAI 的核心优势

1. **更简洁的 AI Gateway 架构**: 两层 vs Boli 三层，更易理解和维护
2. **更灵活的 Storage 抽象**: 统一 files 表 + 运行时 URL 解析
3. **更清晰的创作模型**: Projects → Creates → Tasks 三层，意图与执行分离
4. **更好的可测试性**: 简化的数据模型更容易编写测试
5. **更少的迁移成本**: Drizzle ORM 比 Prisma 更轻量

### 对齐策略

- **先 P1 功能**: 支付、订阅、电商基础（商业化基础）
- **再 P2 功能**: 内容管理、性能优化、系统运维（用户体验）
- **后 P3 功能**: 高级特性（客服聊天、性能剖析、高级 AI Gateway）

### 关键原则

1. **保持架构简洁**: 不要为了对齐功能而引入 Boli 的复杂度
2. **渐进式迁移**: 按优先级分阶段，每个阶段都有可用产品
3. **测试先行**: 每个功能都需要测试覆盖
4. **文档同步**: 代码和文档同步更新

---

**下一步**: 选择 Phase 1 的第一个任务（支付集成或套餐系统），开始实施。

