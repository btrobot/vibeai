# Bug Report: SDK 调用图片生成 API 时抛出 "t.data is not iterable"

**报告日期**: 2026-08-05  
**报告人**: Agent (自动化检测)  
**严重程度**: 中 (Medium) — 非必现，仅在 API Token 权限不足或 API 返回非预期格式时触发

---

## 环境

| 项目 | 值 |
|------|-----|
| 项目 | VibeAI 内容创作平台 |
| SDK | `coze-coding-dev-sdk` (dist/cjs/index.js) |
| 适配器 | `ImageAdapter`, `VideoAdapter`, `LlmAdapter` |
| API 端点 | `/api/v3/images/generations` |
| 运行环境 | 测试机 (159.75.76.131) |

## 错误信息

```
Error: t.data is not iterable
```

## 根因分析

### 1. 错误来源

错误来自 `coze-coding-dev-sdk` 的图片生成客户端内部代码（minified）：

```javascript
// SDK 源码片段 (dist/cjs/index.js)
let t = await this.request("POST", `${this.config.baseUrl}/api/v3/images/generations`, n);
if(t.error) throw new o.LG(`API returned error: ${t.error.message||"Unknown error"}`);
for(let e of t.data)  // ← 此处抛出 "t.data is not iterable"
```

### 2. 触发条件

SDK 在调用 `POST /api/v3/images/generations` 后，检查了 `t.error` 是否存在，如果不存在则认为 API 调用成功，随后直接对 `t.data` 进行迭代 (`for...of`)。

当 `t.data` 为以下值时触发：
- `undefined` — API 响应中没有 `data` 字段
- `null` — 显式 null
- 非数组对象（如 `{}`）— 没有实现 `Symbol.iterator`

### 3. 可能的原因

| 原因 | 概率 | 说明 |
|------|------|------|
| API Token 权限不足 | 高 | Token 无图片生成权限，API 返回 403 但格式与预期不同 |
| API 端点不可达 | 中 | 网络层返回了非标准 JSON 响应 |
| SDK 版本不匹配 | 低 | SDK 期望的响应结构与实际 API 返回的结构不一致 |
| API 限流/降级 | 低 | 限流时返回了非标准格式 |

### 4. SDK 设计缺陷

SDK 在 `t.error` 不存在时直接假设 `t.data` 是数组并迭代，**缺少对 `t.data` 类型和存在性的前置校验**。这是 SDK 的防御性编程不足。

## 影响范围

- **ImageAdapter.execute()**: 直接调用图片生成 SDK，受影响
- **VideoAdapter.execute()**: 视频生成 SDK 使用 `t.data.url`（非迭代），但 `t.data` 为 undefined 时同样会抛 `Cannot read properties of undefined`
- **LlmAdapter.execute()**: LLM 使用流式响应，但低版本 SDK 同样可能受影响

## 修复措施

### 已实施 (Commit `6c43247`)

在三个适配器的 SDK 调用外层增加 try-catch 包装，捕获特定错误模式并转换为可读的中文提示：

```typescript
try {
  const result = await sdk.generate(request);
  // ... 正常处理
} catch (error) {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (errMsg.includes('is not iterable') || errMsg.includes('Cannot read properties')) {
    throw new Error(
      `图片生成 API 返回了非预期格式的响应。` +
      `请检查 COZE_LOOP_API_TOKEN 是否具有图片生成权限，或 API 端点是否可达。`
    );
  }
  throw error;
}
```

### 改进文件

| 文件 | 改动 |
|------|------|
| `server/src/modules/gateway/adapters/image.adapter.ts` | 新增 try-catch，捕获 `is not iterable` 和 `Cannot read properties` |
| `server/src/modules/gateway/adapters/video.adapter.ts` | 同上 |
| `server/src/modules/gateway/adapters/llm.adapter.ts` | 同上 |

## 复现步骤

1. 设置一个无效或权限不足的 `COZE_LOOP_API_TOKEN` 环境变量
2. 启动后端服务
3. 通过 API 提交图片生成任务（如 `POST /api/gateway/generate`）
4. 观察任务执行日志，返回 `t.data is not iterable` 错误

## 长期建议

| 优先级 | 建议 | 说明 |
|--------|------|------|
| P0 | 修复 SDK 防御性校验 | 联系 SDK 团队，在 `for...of` 前增加 `Array.isArray(t.data)` 检查 |
| P1 | 适配器层统一错误包装 | 在 `task-execution.service.ts` 中增加全局 catch 统一转换 SDK 错误 |
| P2 | 集成测试前置 | 在 CI 中增加对 API Token 有效性的预检步骤 |

## 状态

- [x] 根因定位
- [x] 三层适配器 (Image/Video/LLM) 错误捕获
- [x] 有意义的错误信息
- [x] 已知问题文档 (AGENTS.md)
- [x] 代码已提交并推送
- [ ] SDK 上游修复