# AI 电梯选型顾问 V1.0

本仓库当前处于 **Phase 2：开发认证与项目管理**。现有产品文档是设计和业务规则基线，不应把当前管理功能理解为已经具备完整选型能力。

## 当前能力

- Next.js + TypeScript Web 应用
- PostgreSQL + Prisma 数据访问
- 独立 pg-boss Worker
- 共享 contracts、deterministic selection engine 和 shared UI 包
- Zod 环境与接口契约校验
- Pino 结构化日志及敏感字段脱敏
- 统一 API 错误模型
- Web 与数据库健康检查
- Better Auth 用户名密码登录与数据库 Session
- HttpOnly / SameSite Cookie、服务端登录状态检查
- RBAC 权限和项目范围访问控制
- 单管理员开发 Seed、登录和退出
- 客户、项目、建筑、安装单元基础 DEMO 管理
- 业务创建审计记录及数据库只追加保护
- Vitest 单元测试和 Playwright 请求级烟雾测试

尚未实现用户注册、文件上传、AI 模型、勘察、产品库、正式选型规则、审核、报价或真实业务数据。

## 环境要求

- Node.js 24
- pnpm 11
- PostgreSQL 18（本机服务端口 `5432`）

本项目当前使用本机 PostgreSQL，不依赖 Docker。

## 安装

```powershell
cd D:\thinkbook\Desktop\jieya
pnpm install
```

如果网络下载中断，可安全地重复执行 `pnpm install`。依赖版本由 `pnpm-lock.yaml` 固定。

## 配置本地环境变量

复制模板：

```powershell
Copy-Item .env.example .env
```

使用本地编辑器填写 `.env` 中的 `DATABASE_URL`：

```text
postgresql://elevator_app:REPLACE_WITH_URL_ENCODED_PASSWORD@127.0.0.1:5432/elevator_advisor?schema=public
```

要求：

- 不要把真实密码发到聊天、截图或提交记录中。
- 如果密码包含 `@`、`:`、`/`、`?`、`#`、`%` 等 URL 保留字符，需要先做 URL 编码。
- `.env` 已被 `.gitignore` 排除，不要强制加入 Git。
- 必须配置至少 32 字符的 `BETTER_AUTH_SECRET`。
- 开发管理员账号通过 `DEV_ADMIN_USERNAME`、`DEV_ADMIN_NAME` 和
  `DEV_ADMIN_PASSWORD` 配置，密码至少 12 字符。
- 不开放注册，不要把这些开发凭据用于生产环境。

验证数据库配置：

```powershell
pnpm db:validate
pnpm db:generate
pnpm exec prisma migrate deploy
pnpm db:seed
```

首次 Worker 启动时，pg-boss 会在同一 PostgreSQL 数据库内创建自己的任务表。应用业务表由 Prisma 迁移管理。

## 本地启动

打开第一个 PowerShell：

```powershell
cd D:\thinkbook\Desktop\jieya
pnpm dev:web
```

访问：

- 首页：`http://127.0.0.1:3000`
- 登录：`http://127.0.0.1:3000/login`
- 开发后台：`http://127.0.0.1:3000/admin`
- 健康检查：`http://127.0.0.1:3000/api/health`

打开第二个 PowerShell：

```powershell
cd D:\thinkbook\Desktop\jieya
pnpm dev:worker
```

按 `Ctrl+C` 可停止进程。Worker 收到停止信号时会尝试在 10 秒内优雅退出。

## 检查与测试

```powershell
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

当前 Playwright 测试使用 HTTP 请求验证健康检查、登录、Cookie、退出、
Session 过期、权限拒绝和完整 DEMO 项目流程，不下载或启动浏览器。

Phase 3 的 E2E 必须使用独立测试数据库。首次配置：

```powershell
Copy-Item .env.test.example .env.test
```

填写本地测试数据库、测试账号和测试密钥后：

```powershell
pnpm test:db:verify
pnpm test:db:init
```

后续执行 `pnpm test:e2e` 时会先严格校验测试数据库身份，再重置并初始化
`elevator_advisor_test`，不会使用开发数据库。详情见
`docs/PHASE3_0_TEST_ENVIRONMENT.md`。

## 目录

```text
apps/web/                    Next.js Web 与 API
apps/worker/                 pg-boss Worker
packages/contracts/          Zod API 契约
packages/selection-engine/   确定性选型引擎边界
packages/shared-ui/         共享 UI 基础组件
apps/web/src/modules/       认证、权限、审计和项目领域服务
prisma/                     Prisma Schema 与迁移
storage/private/            私有文件目录占位，不可公开访问
docs/                       Phase 1 实施说明
AI_Elevator_Advisor_Codex_Blueprint/
                            原产品设计基线，保持原样
```

## 安全边界

- 不虚构真实电梯产品、参数、价格、法规或工程结论。
- AI 输出不能直接成为专业确认、审核结果或正式金额。
- 客户、文件、私有目录和数据库凭据必须由服务端权限控制。
- 前端按钮隐藏不能替代服务端权限检查。
- 当前项目、建筑和安装单元编号均使用明确的 `DEMO-*` 前缀。
- 审计日志只追加，数据库触发器拒绝 UPDATE 和 DELETE。
- 真实 `.env`、密钥和私有文件不得提交到 Git。
- 后续所有模拟数据必须显式标记为 `DEMO_MOCK`。

产品规则以 [AGENTS.md](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/AGENTS.md) 和 `docs/01` 至 `docs/11` 为准。
