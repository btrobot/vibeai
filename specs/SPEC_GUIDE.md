# VibeAI 规格规范指南

## 定位

`.spec.yaml` 是项目的**唯一真相源（Single Source of Truth）**。每个 Spec 文件定义一个业务域，包含：
- 实体定义（Entity）：字段、约束、关系
- 操作定义（Operation）：输入/输出/前置条件/后置效果/错误场景
- 业务规则（Business Rule）：不可变约束与状态机
- 错误场景（Error）：标准化错误码与消息

## 文件结构

```
specs/
├── SPEC_GUIDE.md          # 本文件
├── auth.spec.yaml         # 认证域
├── storage.spec.yaml      # 存储域
├── gateway.spec.yaml      # AI Gateway 域
├── engine.spec.yaml       # 任务引擎域
├── billing.spec.yaml      # 计费域
└── gallery.spec.yaml      # 画廊域
```

## Spec 格式规范

### 实体（Entity）

```yaml
entities:
  - name: User
    table: users
    fields:
      - name: id
        type: uuid
        pk: true
        default: gen_random_uuid()
      - name: email
        type: varchar(255)
        unique: true
        notNull: true
    relations:
      - type: hasMany
        target: Session
        via: userId
    indexes:
      - fields: [email]
```

### 操作（Operation）

```yaml
operations:
  - name: register
    method: POST
    path: /api/auth/register
    auth: none
    input:
      email: { type: string, format: email }
      password: { type: string, minLength: 8 }
      name: { type: string, minLength: 2, maxLength: 50 }
    pre:
      - "邮箱未被注册"
    post:
      - "创建用户记录，默认角色为 user，赠送 100 额度"
    effect:
      - "插入 users 表"
      - "不返回 passwordHash"
    errors:
      - status: 409
        condition: "邮箱已存在"
        message: "该邮箱已被注册"
```

### 业务规则（Business Rule）

```yaml
rules:
  - id: AUTH-001
    description: "密码必须包含字母和数字"
    severity: error
    enforcement: db_schema + zod
  - id: AUTH-002
    description: "连续 5 次登录失败锁定账户 30 分钟"
    severity: error
    enforcement: service_logic
```

### 状态机（State Machine）

```yaml
state_machine:
  entity: Task
  field: status
  states:
    - pending
    - queued
    - running
    - completed
    - failed
    - cancelled
  transitions:
    - from: pending
      to: [queued]
    - from: queued
      to: [running, cancelled]
    - from: running
      to: [completed, failed]
    - from: [completed, failed, cancelled]
      to: []  # 终态
```

## 合规验证

`spec-compliance.test.ts` 自动验证：
1. 每个 spec 中的操作在代码中有对应的 Controller/Service 实现
2. 每个 pre 条件有违反测试
3. 实体字段与 DB schema 一致
4. 错误场景有对应的异常处理
5. 状态机转换在代码中实现