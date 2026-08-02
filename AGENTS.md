# 项目上下文

## VibeAI 内容创作平台

AI 视频/图片生成 + 电商内容工具 + 后台管理的多业务域平台。

## 技术栈

- **后端**: NestJS 11 + TypeScript 5
- **前端**: Vite 7 + React 19 + shadcn/ui + Tailwind CSS v4
- **数据库**: PostgreSQL 16 + Drizzle ORM
- **认证**: JWT (access 15min + refresh 7d) + HttpOnly Cookie
- **包管理**: pnpm（仅允许 pnpm）

## 目录结构

```
├── scripts/              # 构建与启动脚本
│   ├── build.sh          # 构建脚本
│   ├── dev.sh            # 开发环境启动脚本
│   ├── prepare.sh        # 预处理脚本
│   └── start.sh          # 生产环境启动脚本
├── server/               # NestJS 后端
│   ├── src/
│   │   ├── app.module.ts # 根模块
│   │   ├── main.ts       # 入口
│   │   ├── config/       # 配置模块
│   │   ├── common/       # 公共模块（Drizzle等）
│   │   └── modules/      # 业务模块
│   └── package.json
├── src/                  # React 前端
│   ├── components/
│   │   └── ui/           # shadcn/ui 基础组件
│   ├── pages/            # 页面组件
│   ├── hooks/            # 自定义 Hooks
│   ├── lib/              # 工具函数
│   ├── db/               # 数据库 Schema
│   │   └── schema/       # Drizzle 数据表定义
│   ├── index.css         # Tailwind v4 + shadcn/ui 主题
│   ├── main.tsx          # 客户端入口
│   └── App.tsx           # 路由配置
├── shared/               # 共享 Zod schema + TypeScript 类型
├── index.html            # 入口 HTML
├── package.json          # 前端依赖管理
├── vite.config.ts        # Vite 配置（含 API 代理）
├── tsconfig.json         # TypeScript 配置
├── DESIGN.md             # 设计规范
└── .coze                 # 项目配置文件
```

## 业务域

- **Phase 1 ✅**: 认证系统（注册/登录/登出/刷新/用户信息）
- **Phase 2 ✅**: 存储系统（文件上传/管理，Provider 抽象层 S3 + Local）
- **Phase 3 ✅**: AI Gateway（能力注册表/模型注册表/路由/生成任务提交）
- **Phase 4**: 任务执行引擎
- **Phase 5**: 计费系统
- **Phase 6**: 业务前端

## 开发规范

- 使用 Tailwind CSS v4 进行样式开发
- 使用 shadcn/ui 语义化主题变量（CSS 变量）
- 暗色模式优先，低饱和翡翠绿强调色
- 禁止硬编码 Hex/RGB，颜色使用 CSS 变量
- 使用 Lucide 图标库

## 编码规范

- TypeScript strict 模式
- 禁止隐式 any 和 as any
- 函数参数、返回值必须有明确类型
- 前后端共享类型（Zod schema）
- 每个模块按 Schema → Service → Controller → Module 组织

## 关键架构决策

- 前后端分离，独立端口运行（Vite 5000 / NestJS 3001）
- Vite 代理 /api/* → NestJS backend
- NestJS 模块化架构，每个业务域独立 Module
- 异步任务模式，WebSocket 实时进度
- 存储层 Provider 抽象，支持无缝切换
- AI Gateway 三层架构: Capability → Router → Model