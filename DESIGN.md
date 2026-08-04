# DESIGN.md

> VibeAI 内容创作平台 — 设计规范唯一真相源
> 参考：Replicate（内容优先的卡片网格）、Penpot（系统化组件思维）

---

## 1. 产品定位与用户画像

### 产品
**VibeAI** — AI 视频/图片生成 + 电商内容工具 + 后台管理平台。用户在此提交生成任务、管理作品、消耗信用额度、浏览社区画廊。

### 用户画像
| 角色 | 核心诉求 | 设计影响 |
|------|---------|---------|
| 内容创作者 | 快速出图、迭代试错、作品管理 | 生成面板要高效，画廊网格要沉浸 |
| 电商运营 | 批量生成、素材管理、成本可控 | 用量统计清晰，信用消耗透明 |
| 设计师 | 精细控制、风格一致性、导出灵活 | 参数面板完整，作品库可检索 |

### 气质关键词
明亮 · 干净 · 专业 · 呼吸感 · 内容优先

---

## 2. 意象锚点

**清晨的工作台** — 阳光透过百叶窗洒在白色桌面上，MacBook 屏幕亮着，旁边放着一杯美式咖啡和一本 Moleskine 笔记本。桌面整洁，只留当前任务需要的东西。

设计推论：
- 大面积留白 → 内容区域不被 UI chrome 干扰
- 自然光 → 低对比度的中性色，不刺眼
- 桌面整洁 → 信息密度适中，层级清晰
- 只留当前任务 → 每个页面聚焦一个核心操作

---

## 3. 视觉策略

### 核心原则：内容优先（参考 Replicate）
> 用户来 VibeAI 是看 AI 生成的作品，不是看 UI。界面应当像画廊的白墙——存在但不抢眼。

- **大面积留白**：内容区域充足留白，让作品本身成为焦点
- **轻量层级**：用极浅灰区分卡片与背景，不用重阴影
- **色彩克制**：主色用于关键操作（生成、保存、发布），其余保持中性
- **消失的 UI**：导航、工具栏在非交互时保持极低视觉权重

### 图形语言
- 直线条为主，圆角柔和但不圆润
- 无装饰性插画，用真实生成内容填充视觉
- 图标统一使用 Lucide（线性风格，1.5px stroke）
- 数据可视化用最小化图表（无网格线、无图例框）

---

## 4. 配色方案

### 4.1 基础色

| 用途 | CSS 变量 | HSL 值 | 说明 |
|------|---------|--------|------|
| 背景底色 | `--background` | `hsl(0 0% 98%)` | 极浅灰白，不刺眼 |
| 卡片面 | `--card` | `hsl(0 0% 100%)` | 纯白 |
| 悬浮面 | `--surface-hover` | `hsl(220 14% 96%)` | hover 状态 |
| 次要表面 | `--secondary` | `hsl(220 14% 96%)` | 次级容器 |
| 弱化表面 | `--muted` | `hsl(220 14% 96%)` | 静音/禁用容器 |
| accent（shadcn 语义） | `--accent` | `hsl(220 14% 96%)` | ghost/secondary hover 背景（同 muted） |
| 边框 | `--border` | `hsl(220 13% 91%)` | 极浅灰 |
| 输入框边框 | `--input` | `hsl(220 13% 91%)` | 同边框 |

> **注意**：`--surface-hover`、`--secondary`、`--muted`、`--accent` 当前同值，但保留独立变量以便未来微调层级。

### 4.2 文字色

| 用途 | CSS 变量 | HSL 值 | 说明 |
|------|---------|--------|------|
| 主文字 | `--foreground` | `hsl(224 71% 4%)` | 深灰黑 |
| 次要文字 | `--muted-foreground` | `hsl(220 9% 46%)` | 中灰 |

### 4.3 主色（品牌色 — 专业蓝）

| 用途 | CSS 变量 | HSL 值 | 说明 |
|------|---------|--------|------|
| 主色 | `--primary` | `hsl(221 83% 53%)` | 导航激活、链接、主按钮 |
| 主色文字 | `--primary-foreground` | `hsl(0 0% 100%)` | 白色 |
| 焦点环 | `--ring` | `hsl(221 83% 53%)` | 同主色 |

### 4.4 品牌强调色（翡翠绿）

| 用途 | CSS 变量 | HSL 值 | 说明 |
|------|---------|--------|------|
| 品牌色 | `--brand` | `hsl(160 40% 40%)` | Logo、生成按钮、品牌标识 |
| 品牌色文字 | `--brand-foreground` | `hsl(0 0% 100%)` | 白色 |

> `--brand` 是独立于 shadcn `--accent` 的变量。`--accent` 回归 shadcn 默认语义（hover 背景），翡翠绿品牌色用 `--brand`。

### 4.5 语义色

| 用途 | CSS 变量 | HSL 值 | 使用场景 |
|------|---------|--------|---------|
| 成功 | `--brand` | `hsl(160 40% 40%)` | 任务完成（复用品牌绿） |
| 警告 | — | `hsl(38 92% 50%)` | 信用不足、待确认 |
| 危险 | `--destructive` | `hsl(0 84% 60%)` | 删除、失败 |
| 信息 | `--primary` | `hsl(221 83% 53%)` | 提示信息（同主色） |

### 4.6 色彩使用边界

- **主色（蓝）**：导航激活、链接、主要按钮、焦点环、选中状态
- **品牌色（绿）**：Logo 图标、生成按钮（`variant="brand"`）、品牌标识、成功状态
- **禁止混用**：导航激活态用蓝色 `bg-primary/10`；生成按钮用 `bg-brand`

---

## 5. 字体排版

### 字体族

| 用途 | 字体 | CSS 变量 | 来源 |
|------|------|---------|------|
| 正文 | Inter + 系统中文 | `--font-sans` | Google Fonts (`.cn` 域) |
| 等宽 | JetBrains Mono | `--font-mono` | Google Fonts (`.cn` 域) |

### 字号层级

| 层级 | 大小 | 行高 | 字重 | Tailwind | 用途 |
|------|------|------|------|---------|------|
| Display | 36px | 1.2 | 700 | `text-4xl` | 首页大标题 |
| H1 | 28px | 1.3 | 700 | `text-3xl` | 页面标题 |
| H2 | 20px | 1.4 | 600 | `text-xl` | 区块标题 |
| H3 | 16px | 1.5 | 600 | `text-base` | 卡片标题 |
| Body | 14px | 1.6 | 400 | `text-sm` | 正文（默认） |
| Small | 12px | 1.5 | 400 | `text-xs` | 辅助文字（最小） |

### 排版规则
- 正文默认 14px（信息密度优先）
- 数字和信用值使用 `font-mono`，确保对齐
- 标题字重 600-700，不用 800+
- 长文本段落最大宽度 `65ch`

---

## 6. 间距系统

基于 **4px 网格**，使用 Tailwind 默认刻度：

| Token | 值 | Tailwind | 用途 |
|-------|-----|---------|------|
| xs | 4px | `p-1` | 图标与文字间距 |
| sm | 8px | `p-2` | 按钮内边距 |
| md | 16px | `p-4` | 卡片内边距 |
| lg | 24px | `p-6` | 区块间距 |
| xl | 32px | `p-8` | 页面分区间距 |
| 2xl | 48px | `p-12` | 大区块间距 |

### 页面布局
- 页面左右边距：`24px`（移动端）/ `48px`（桌面端）
- 内容最大宽度：`1200px`（标准）/ `1440px`（宽屏画廊）
- 侧边栏宽度：`240px`（收起 `64px`）
- 卡片间距：`16px`（网格内）/ `24px`（区块间）

---

## 7. 圆角与阴影

### 圆角

| 用途 | 值 | Tailwind | CSS 变量 |
|------|-----|---------|---------|
| 按钮、输入框 | 8px | `rounded-lg` | `--radius` |
| 卡片、面板 | 12px | `rounded-xl` | — |
| 弹窗、模态框 | 16px | `rounded-2xl` | — |
| 徽章、小标签 | 4px | `rounded` | — |

### 阴影

| 层级 | 值 | 用途 |
|------|-----|------|
| 无 | `none` | 默认卡片（用边框区分） |
| 小 | `0 1px 2px hsl(0 0% 0% / 0.05)` | 按钮悬浮 |
| 中 | `0 4px 6px -1px hsl(0 0% 0% / 0.1)` | 卡片悬浮、下拉 |
| 大 | `0 20px 25px -5px hsl(0 0% 0% / 0.1)` | 弹窗、模态框 |

### 原则
- **默认不用阴影**：卡片靠 1px 边框区分层级
- **悬浮才加阴影**：hover 提升到中级
- **弹窗用大阴影**

---

## 8. 动效与交互

### 过渡参数

| 类型 | 时长 | 缓动 | 用途 |
|------|------|------|------|
| 快速 | 150ms | `cubic-bezier(0.4, 0, 0.2, 1)` | 按钮、输入框 |
| 正常 | 200ms | `cubic-bezier(0.4, 0, 0.2, 1)` | 卡片悬浮 |
| 慢速 | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | 弹窗、抽屉 |

### 交互状态

| 状态 | 视觉变化 | 实现 |
|------|---------|------|
| 悬停 | 背景变浅灰 + 阴影提升 | `hover:bg-surface-hover` |
| 点击 | 轻微缩放 | `active:scale-[0.98]` |
| 聚焦 | 2px 主色外环 | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| 禁用 | 50% 透明度 | `disabled:opacity-50 disabled:cursor-not-allowed` |

### 禁忌
- 禁止 `linear` 缓动
- 禁止超过 400ms 的过渡
- 禁止无意义的旋转、弹跳动画

---

## 9. 布局模式

### 9.1 应用框架（已登录）

```
┌──────────────────────────────────────────────┐
│  TopBar (56px)  Toggle · Search · Credits    │
├────────┬─────────────────────────────────────┤
│ Side   │         Main Content                │
│ nav    │       (max-w: 1200px)               │
│ (240px)│                                     │
├────────┴─────────────────────────────────────┤
│  (无底部栏)                                    │
└──────────────────────────────────────────────┘
```

- **TopBar**：56px 高（`h-14`），白色背景，底部 1px 边框
- **Sidenav**：240px 宽（`w-60`），收起 64px（`w-16`），白色背景，右侧 1px 边框
- **Main**：背景 `--background`（极浅灰），内容区居中

### 9.2 画廊网格（参考 Replicate Explore）

- **网格列数**：移动端 2 列 / 平板 3 列 / 桌面 4-5 列
- **卡片间距**：16px
- **卡片内容**：图片（aspect-ratio 1:1 或 4:3）+ 标题 + 作者 + 统计
- **无限滚动**：Intersection Observer，底部 Skeleton 占位

### 9.3 生成面板（Workspace）

```
┌──────────────────┬──────────────────┐
│  参数面板 (360px) │   预览区 (flex-1)  │
│  模型选择         │  ┌────────────┐  │
│  Prompt 输入     │  │   生成结果   │  │
│  参数滑块         │  └────────────┘  │
│  生成按钮 (brand) │                  │
│  信用消耗提示     │  历史记录 (横向)   │
└──────────────────┴──────────────────┘
```

- 生成按钮使用 `variant="brand"`（翡翠绿），是页面唯一的绿色按钮
- 信用消耗在按钮旁实时显示

### 9.4 仪表盘

- 统计卡片 4 列：图标 + 数值（`font-mono`）+ 标签 + 趋势
- 数值用等宽字体，32px，字重 700

---

## 10. 组件规范

### 10.1 按钮（`button.tsx`）

| variant | 样式 | 用途 |
|---------|------|------|
| `default` | `bg-primary text-primary-foreground` | 主操作（保存、确认） |
| `brand` | `bg-brand text-brand-foreground` | 生成操作（唯一绿色按钮） |
| `destructive` | `bg-destructive text-destructive-foreground` | 删除、取消 |
| `outline` | `border border-input bg-card hover:bg-surface-hover` | 次操作 |
| `secondary` | `bg-secondary text-secondary-foreground` | 次操作 |
| `ghost` | `hover:bg-surface-hover` | 工具栏、下拉项 |
| `link` | `text-primary underline-offset-4` | 链接式 |

| size | 高度 | 内边距 |
|------|------|--------|
| `default` | 36px (`h-9`) | `px-4 py-2` |
| `sm` | 32px (`h-8`) | `px-3 text-xs` |
| `lg` | 40px (`h-10`) | `px-6` |
| `icon` | 36px (`h-9 w-9`) | — |

- 圆角：`rounded-lg`（8px）
- 字号：`text-sm font-medium`
- 交互：`active:scale-[0.98]` + `transition-all duration-150`

### 10.2 卡片

- 白底 + 1px 边框 + `rounded-lg`
- **默认无阴影**，hover 时可加中级阴影
- 内边距：`p-4`（紧凑）/ `p-6`（标准）

### 10.3 输入框

- 高度：`h-10`（40px）
- 背景：`bg-transparent`
- 边框：1px `border-input`，聚焦时 `ring-2 ring-ring`
- 圆角：`rounded-md`
- placeholder：`text-muted-foreground`

### 10.4 标签/徽章

| 类型 | 样式 | 用途 |
|------|------|------|
| 默认 | `bg-muted text-muted-foreground` | 分类、状态 |
| 主色 | `bg-primary/10 text-primary` | 选中、激活 |
| 成功 | `bg-brand/10 text-brand` | 完成、在线 |
| 警告 | `bg-amber-500/10 text-amber-600` | 待处理、低信用 |
| 危险 | `bg-destructive/10 text-destructive` | 失败、错误 |

> 警告色 `hsl(38 92% 50%)` 是唯一允许的 Tailwind 原生色（无对应 CSS 变量），仅用于徽章文字+浅底。

### 10.5 表格

- 表头：`bg-muted text-muted-foreground text-xs font-medium`
- 行高：48px
- 行分割线：1px `border-border`
- hover 行：`bg-surface-hover`

### 10.6 模态框

- 遮罩：`bg-black/50`
- 容器：白底 + `rounded-2xl` + 大阴影
- 最大宽度：480px（小）/ 640px（中）/ 800px（大）
- 动画：淡入 + 上滑 `translateY(8px) → 0`，300ms

### 10.7 抽屉

- 从右侧滑入，宽度 400px
- 背景 `bg-card`，左侧 1px 边框 + 中级阴影
- 动画：`translateX(100%) → 0`，300ms

### 10.8 进度条

- 高度：8px（默认）/ 4px（细）
- 背景：`bg-muted`
- 填充：`bg-primary`（默认）/ `bg-brand`（生成进度）
- 圆角：`rounded-full`

### 10.9 骨架屏

- 背景：`bg-muted`
- 动画：`animate-pulse`

---

## 11. 响应式断点

| 断点 | 宽度 | Tailwind | 布局变化 |
|------|------|---------|---------|
| mobile | < 640px | 默认 | 单列、侧边栏隐藏（汉堡菜单） |
| sm | ≥ 640px | `sm:` | 2 列网格 |
| md | ≥ 768px | `md:` | 3 列网格、侧边栏可展开 |
| lg | ≥ 1024px | `lg:` | 4 列网格、侧边栏固定 |
| xl | ≥ 1280px | `xl:` | 5 列网格 |

### 移动端适配
- 侧边栏 → 汉堡菜单
- 生成面板参数区 → 底部抽屉
- 表格 → 卡片列表
- 模态框 → 全屏

---

## 12. 图标规范

- **图标库**：Lucide React（线性风格）
- **默认大小**：16px（`h-4 w-4`）— 导航、按钮内
- **中图标**：20px（`h-5 w-5`）— 统计卡片
- **大图标**：24px（`h-6 w-6`）— 空状态
- **stroke 宽度**：1.5px（默认）
- **颜色**：继承 `currentColor`
- **禁止**：填充图标、彩色图标、emoji 替代

---

## 13. 数据展示模式

### 13.1 任务状态

| 状态 | 颜色 | 图标 | 文案 |
|------|------|------|------|
| 排队中 | `text-muted-foreground` | `Clock` | 排队中 |
| 处理中 | `text-primary` | `Loader2`（旋转） | 生成中... |
| 已完成 | `text-brand` | `CheckCircle2` | 已完成 |
| 已失败 | `text-destructive` | `XCircle` | 生成失败 |
| 已取消 | `text-muted-foreground` | `XCircle` | 已取消 |

### 13.2 信用展示

- 余额数字：`font-mono font-semibold`
- 消耗提示：按钮旁 `text-xs text-muted-foreground`
- 不足警告：警告色徽章

### 13.3 空状态

- 居中，大图标（48px，`text-muted-foreground`）
- 标题（H3）+ 描述（Body，`text-muted-foreground`）
- CTA 按钮（主按钮）

### 13.4 加载状态

| 场景 | 方案 |
|------|------|
| 页面初次加载 | 骨架屏 |
| 卡片网格 | 底部 Skeleton 行 |
| 按钮提交 | 按钮内 `Loader2` + 禁用 |
| 全屏操作 | 居中 Spinner + 遮罩 |

---

## 14. 导航规范

### 14.1 侧边栏

| 项目 | 路由 | 图标 | 说明 |
|------|------|------|------|
| 仪表盘 | `/dashboard` | `LayoutDashboard` | 首页 |
| 我的项目 | `/projects` | `FolderKanban` | 项目列表 |
| 电商工具（可展开） | — | `Store` | 父级菜单 |
| ├ 白底图生成 | `/tools/background-removal` | `ShieldCheck` | 子菜单 |
| ├ 场景合成 | `/tools/scene-composition` | `Palette` | 子菜单 |
| ├ 模特换装 | `/tools/model-dressing` | `Shirt` | 子菜单 |
| └ 详情页生成 | `/tools/detail-page` | `FileText` | 子菜单 |
| 社区画廊 | `/gallery` | `Image` | 公开页面 |
| 设置 | `/settings` | `Settings` | 用户设置 |
| 管理后台 | `/admin` | `Users` | 管理员可见 |

- 激活态：`bg-primary/10 text-primary font-medium`
- 非激活态：`text-muted-foreground hover:bg-surface-hover hover:text-foreground`
- 导航项高度：`py-2`（约 36px）
- 圆角：`rounded-lg`
- 图标与文字间距：`gap-3`（12px）
- 图标大小：`h-4 w-4`（16px）

### 14.2 顶部栏

- 左侧：侧边栏收起/展开按钮
- 右侧：信用额度徽章（`Sparkles` 图标 + `text-brand` + 数值）
- 高度：`h-14`（56px）

---

## 15. Z-Index 层级系统

| 层级 | z-index | Tailwind | 用途 |
|------|---------|---------|------|
| base | 0 | 默认 | 正常文档流 |
| sticky | 10 | `z-10` | 粘性头部、筛选栏 |
| dropdown | 20 | `z-20` | 下拉菜单、popover |
| drawer | 30 | `z-30` | 抽屉 |
| sidebar | 40 | `z-40` | 移动端侧边栏 |
| modal | 50 | `z-50` | 模态框 |
| toast | 50 | `z-50` | 通知提示（同模态，右上角） |
| overlay | 60 | `z-60` | 全屏遮罩（最高） |

> 当前代码中移动端侧边栏用 `z-50`，遮罩用 `z-40`。应调整为遮罩 `z-40`、侧边栏 `z-50`（侧边栏在遮罩之上）。

---

## 16. 表单规范

### 布局
- Label 在输入框**上方**，间距 `space-y-2`
- Label 文字：`text-sm font-medium text-foreground`
- 必填标记：Label 后加 `<span className="text-destructive">*</span>`

### 错误状态
- 输入框边框：`border-destructive`
- 错误信息：输入框下方 `text-xs text-destructive`
- 错误图标：`AlertCircle` 16px

### 分组
- 表单分组用 Card 包裹，每组一个标题
- 组间间距：`space-y-6`
- 提交按钮在表单底部右对齐

---

## 17. Toast / 通知规范

### 位置
- 桌面端：右上角，距顶部 16px，距右侧 16px
- 移动端：顶部全宽（距顶部 16px，左右各 16px）

### 样式

| 类型 | 背景 | 图标 | 持续时间 |
|------|------|------|---------|
| 成功 | `bg-card` + `text-brand` 图标 | `CheckCircle2` | 3s |
| 错误 | `bg-card` + `text-destructive` 图标 | `XCircle` | 5s |
| 信息 | `bg-card` + `text-primary` 图标 | `Info` | 3s |
| 警告 | `bg-card` + `text-amber-600` 图标 | `AlertTriangle` | 4s |

- 容器：`bg-card border border-border rounded-lg shadow-lg p-4`
- 动画：从右侧滑入 `translateX(100%) → 0`，200ms
- 堆叠：多条通知垂直排列，间距 8px
- 关闭：点击关闭按钮或自动消失

---

## 18. 无障碍（A11y）

### 键盘导航
- 所有可交互元素必须可通过 Tab 到达
- 焦点可见：`focus-visible:ring-2 ring-ring ring-offset-2`
- 模态框：focus trap（Tab 循环在模态框内）
- Esc 键关闭模态框/抽屉

### ARIA
- 图标按钮必须有 `aria-label`
- 导航使用 `<nav aria-label="主导航">`
- 表单输入关联 `<label htmlFor>`
- 动态内容用 `aria-live="polite"`（如 toast、加载状态）

### 颜色对比度
- 正文文字与背景：≥ 4.5:1（WCAG AA）
- 大文字（≥ 18px）：≥ 3:1
- 交互元素边框：≥ 3:1
- 禁止仅用颜色传达信息（需配合文字或图标）

### 屏幕阅读器
- 装饰性图标：`aria-hidden="true"`
- 加载状态：`role="status" aria-live="polite"`
- 错误信息：`role="alert"`

---

## 19. 设计禁忌

- 禁止使用深色/暗色背景作为主界面
- 禁止使用蓝紫色渐变（AI 产品滥用）
- 禁止大面积霓虹/发光效果
- 禁止硬编码 Hex/RGB/HSL 颜色（必须使用 CSS 变量）
- 禁止使用 Tailwind 原生色盘（`text-blue-500` 等），唯一例外：警告色徽章
- 禁止小于 12px 的字号
- 禁止无意义的动画（旋转、弹跳、脉冲）
- 禁止使用填充图标（filled icon）
- 禁止用 emoji 替代功能图标
- 禁止卡片默认带阴影（用边框区分，hover 才加阴影）
- 禁止导航激活态使用绿色（绿色仅用于 `brand` 变体按钮和 Logo）
- 禁止页面自建独立布局（所有页面必须运行在 AppLayout 内）

---

## 20. CSS 变量速查

以下变量定义在 `src/index.css`，所有组件必须通过 Tailwind 语义类名引用：

| Tailwind 类 | CSS 变量 | 用途 |
|-------------|---------|------|
| `bg-background` | `--background` | 页面背景 |
| `bg-card` | `--card` | 卡片、面板背景 |
| `bg-surface-hover` | `--surface-hover` | hover 背景 |
| `bg-muted` | `--muted` | 弱化容器 |
| `bg-primary` | `--primary` | 主色背景 |
| `bg-brand` | `--brand` | 品牌色背景 |
| `bg-destructive` | `--destructive` | 危险操作背景 |
| `text-foreground` | `--foreground` | 主文字 |
| `text-muted-foreground` | `--muted-foreground` | 次要文字 |
| `text-primary` | `--primary` | 主色文字 |
| `text-brand` | `--brand` | 品牌色文字 |
| `text-destructive` | `--destructive` | 危险文字 |
| `border-border` | `--border` | 边框 |
| `ring-ring` | `--ring` | 焦点环 |
| `font-mono` | `--font-mono` | 等宽字体 |

> 暗色模式：如需实现，在 `.dark` 类下覆盖上述变量，主色/品牌色提亮 10-15%。
