# AI 电梯选型顾问

面向旧楼加装、旧梯改造和新楼安装场景的 AI 电梯选型顾问 Demo。

项目目标是把客户沟通、建筑需求整理、电梯产品比较、确定性初步选型、
客户确认和销售跟进串成一条可审计的业务链路。它不是自动工程设计软件，
也不能替代现场勘察、结构核查、法定检验或专业人员审核。

## 当前状态

```text
Mock AI / DEMO_MOCK 产品闭环：MVP COMPLETE — DEMO-READY
仓库级生产就绪度：PARTIAL / NOT VERIFIED
真实 AI 模型：NOT IMPLEMENTED
真实厂家产品与价格：NOT PRESENT
生产部署：NOT AUTHORIZED
```

当前可演示的范围包括：

- 用户名密码登录、数据库 Session、服务端 RBAC 和项目范围授权；
- 确定性的 `MockAIProvider` 多轮需求收集，不调用任何外部模型；
- 旧楼加装、旧梯改造、新楼安装三类需求与缺失字段追问；
- 需求修订历史、客户确认、初步推荐历史和候选产品对比；
- 版本化 `DEMO_MOCK` 产品、技术参数、参考价格和来源记录；
- 纯函数确定性选型引擎，输出硬约束、预算状态、理由和风险提示；
- 管理员产品维护、客户项目页面、销售交接和跟进备注；
- Phase 3 的私有文件上传/下载/处理基础代码与字段确认流程。

## 重要边界

- 所有产品参数、价格和推荐结果均为 `DEMO_MOCK`，不得用于采购、报价或
  工程决策。
- AI 能力仅为浏览器内确定性文本解析，没有接入 OpenRouter、OpenAI、
  Anthropic 或其他真实模型 API。
- 客户确认需求不等于专业确认；Demo 中的选型结果始终要求专业复核和现场
  勘察。
- 当前旧上传服务与 P1-3 Upload Attempt / Lifecycle 状态机尚未完成集成。
  旧路径被安全 Trigger 拒绝，相关类型检查和集成测试仍失败。
- 文件生命周期、Native RPC 等安全设计包含大量仍未通过 PostgreSQL 实机、
  Catalog ACL、Migration Lock 或 Runtime 并发验证的内容。

## 产品流程

```text
客户登录
-> 创建 DEMO 项目
-> Mock AI 多轮收集建筑需求
-> 结构化需求修订与缺失字段提示
-> 客户确认需求
-> 确定性选型引擎匹配 DEMO 产品
-> 展示推荐、风险、预算和来源
-> 创建销售交接
-> 销售查看需求/推荐并记录跟进
```

当前流程止于 Demo 销售交接。勘察、专业确认、正式审核、报价、合同、
施工、交付和维保仍是后续能力。

## 系统架构

```text
apps/web
  Next.js App Router
  Better Auth + PostgreSQL Session
  服务端 RBAC / 项目范围授权
  客户与管理员页面
  REST Route Handlers
  Mock AI Advisor
  DEMO 产品目录与销售交接
  私有文件访问基础设施

apps/worker
  pg-boss Worker
  文件处理队列
  PDF 文字提取与图片元数据
  租约、fencing、重试和崩溃恢复

packages/contracts
  Zod API 与领域契约

packages/selection-engine
  纯函数、确定性初步选型

packages/file-storage
  私有本地存储、MIME 和安全能力边界

packages/build-integrity
  发布清单、脚本安全和 Startup Gate

packages/authority-core
  原生权限/身份研究代码，不属于当前 Demo 产品主流程
```

## 技术栈

- Node.js 24、pnpm 11、TypeScript 5.9
- Next.js 16 App Router、React 19
- PostgreSQL 18、Prisma 6
- Better Auth 1.x、数据库 Session
- pg-boss Worker
- Zod 4
- Pino 结构化日志
- Vitest、Playwright 请求级测试
- Tailwind CSS 4

依赖版本以各 `package.json` 和 `pnpm-lock.yaml` 为准。

## 主要目录

```text
apps/web/                    Web、API、授权和业务服务
apps/worker/                 文件处理 Worker
packages/contracts/          共享 Zod 契约
packages/selection-engine/   确定性选型引擎
packages/file-storage/       私有文件存储边界
packages/build-integrity/    发布完整性与启动安全
packages/authority-core/     原生权限研究模块
prisma/                      Schema 与向前迁移
docs/architecture/           文件生命周期和安全架构
docs/product/                产品整改、设计与独立审查材料
AI_Elevator_Advisor_Codex_Blueprint/
                             原产品需求与业务规则基线
tools/native-rpc/            Native RPC 研究 Harness 源码
```

## 本地运行

### 1. 环境要求

- Node.js 24+
- pnpm 11+
- PostgreSQL 18

### 2. 安装

```powershell
pnpm install
```

### 3. 配置环境变量

```powershell
Copy-Item .env.example .env
Copy-Item .env.test.example .env.test
```

按模板填写本机数据库、Session 密钥和 DEMO 管理员配置。不要提交真实
`.env`、测试数据库密码、模型密钥或客户数据。

### 4. 初始化开发数据库

```powershell
pnpm db:validate
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed
pnpm db:seed:mvp-roles
```

### 5. 启动

```powershell
pnpm dev:web
```

另一个终端：

```powershell
pnpm dev:worker
```

默认入口：

- 首页：`http://127.0.0.1:3000`
- 登录：`http://127.0.0.1:3000/login`
- 客户项目：`http://127.0.0.1:3000/projects`
- 产品目录：`http://127.0.0.1:3000/catalog`
- 管理后台：`http://127.0.0.1:3000/admin`
- 健康检查：`http://127.0.0.1:3000/api/health`

## 测试与验证

完整测试只能使用经身份保护的独立测试数据库。禁止用开发/共享数据库代替。

```powershell
pnpm test:db:verify
pnpm test:db:init
pnpm --filter @elevator/web test
pnpm --filter @elevator/worker test
pnpm --filter @elevator/contracts test
pnpm --filter @elevator/selection-engine test
pnpm --filter @elevator/file-storage test
pnpm --filter @elevator/web test:e2e
```

历史 Full MVP Acceptance Report 记录了：

```text
Web unit/static:      275 tests passed
Worker:                19 tests passed
Contracts:             15 tests passed
Selection engine:       9 tests passed
File storage:          19 tests passed
MVP E2E:                4 tests passed
Isolated migrations:   PASS
```

GitHub 发布准备阶段重新执行了不依赖数据库的：

```text
Contracts:             15/15 PASS
Selection engine:       9/9 PASS
Repository typecheck:  FAIL — pre-existing P1-3 upload chain errors
```

因此 `MVP COMPLETE — DEMO-READY` 只描述授权的 Mock-AI/DEMO 产品闭环，
不代表整个仓库已生产就绪。

## 已知限制

1. `MockAIProvider` 只识别有限、可测试的中文文本模式。
2. 产品库、技术参数和参考价格全部为虚构 `DEMO_MOCK`。
3. 未接入真实 AI、OCR、图纸理解、产品供应商数据或正式价格源。
4. 旧文件上传路径与 P1-3 Lifecycle 链未完成整合。
5. 勘察、专业确认、正式技术审核、报价、合同、施工、交付和维保未实现。
6. 浏览器视觉/交互自动化未验证。
7. 生产 Build Gate 因缺少受控发布配置而按设计拒绝构建。
8. 多个数据库、ACL、Native RPC 和并发设计仍需 PostgreSQL/Runtime 独立验证。

## 安全原则

- 服务端重新校验 Session、权限、项目归属和资源归属。
- 客户不能访问其他客户的项目、顾问会话或文件。
- 上传内容、PDF 文字和 AI 输出均视为不可信输入。
- AI 输出不能成为专业确认、审核结果或正式金额。
- 已审核和已签文件必须保留历史版本与审计链。
- 真实 `.env`、密钥、私有文件和客户数据不得进入 Git。

## 状态文档

- [Full MVP Build](docs/product/full-mvp-build/README.md)
- [MVP Implementation Status](docs/product/full-mvp-build/MVP_IMPLEMENTATION_STATUS.md)
- [MVP Acceptance Report](docs/product/full-mvp-build/MVP_ACCEPTANCE_REPORT.md)
- [MVP Known Limitations](docs/product/full-mvp-build/MVP_KNOWN_LIMITATIONS.md)
- [File Lifecycle Implementation Status](docs/architecture/file-lifecycle-p13-implementation-status.md)
- [Product Blueprint](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/README.md)

## License

当前仓库尚未选择开源许可证。公开可见不代表授权商业复制、生产部署或用于
真实工程决策；在补充明确的 `LICENSE` 前，请保留所有权利。
