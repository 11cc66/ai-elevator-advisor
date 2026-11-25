# AI 电梯选型顾问项目级开发规范

本文件适用于仓库根目录及其所有子目录。根目录的安全边界不可由下级说明降低。

## 1. 文档路由与事实优先级

先判定任务类型和风险，再读取对应文档，不要无条件加载全部业务文档。路径均相对仓库根目录。`D01`–`D11` 的业务职责如下：

- `D01` [产品范围](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/docs/01_PRODUCT_SCOPE.md)：定位、V1.0 边界、暂缓项。
- `D02` [用户流程](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/docs/02_USER_FLOWS.md)：客户咨询、上传、勘察、选型、报价状态流。
- `D03` [业务规则](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/docs/03_BUSINESS_RULES.md)：数据来源、版本、审核、权限与变更影响。
- `D04` [AI 工程边界](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/docs/04_AI_ENGINEERING_GUARDRAILS.md)：AI 输出、提示注入、文件不可信输入。
- `D05` [逻辑数据模型](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/docs/05_DATA_MODEL.md)：核心实体、关系和约束。
- `D06` [UI/UX](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/docs/06_UI_UX_SPEC.md)：页面结构、交互和通用状态。
- `D07` [产品库与选型](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/docs/07_PRODUCT_CATALOG_AND_SELECTION.md)：产品准入、硬约束、三档方案和可解释性。
- `D08` [API 与集成](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/docs/08_API_AND_INTEGRATION.md)：接口、AI/外部服务、文件处理边界。
- `D09` [测试计划](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/docs/09_TEST_PLAN.md)：验收用例和回归要求。
- `D10` [实施路线](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/docs/10_IMPLEMENTATION_ROADMAP.md)：阶段目标和完成定义。
- `D11` [待确认事项](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/docs/11_OPEN_DECISIONS.md)：不得自行假设的产品、数据、技术与运营决策。

实现文档别名：`P1` [Phase 1](docs/PHASE1_IMPLEMENTATION.md)、`P2` [Phase 2](docs/PHASE2_IMPLEMENTATION.md)、`P30` [Phase 3.0](docs/PHASE3_0_TEST_ENVIRONMENT.md)、`P31` [Phase 3.1](docs/PHASE3_1_DATA_MODEL.md)、`P32` [Phase 3.2](docs/PHASE3_2_PRIVATE_UPLOAD.md)、`P33` [Phase 3.3](docs/PHASE3_3_FILE_ACCESS.md)、`P34` [Phase 3.4](docs/PHASE3_4_FILE_PROCESSING.md)、`P35` [Phase 3.5](docs/PHASE3_5_PROCESSING_RELIABILITY.md)、`P36` [Phase 3.6](docs/PHASE3_6_FIELD_CONFIRMATION.md)、`P37` [Phase 3.7](docs/PHASE3_7_BATCH1_SECURITY.md)。

文件生命周期别名：`FZ` [设计冻结](docs/architecture/file-lifecycle-p13-design-freeze.md)、`ST` [实现状态](docs/architecture/file-lifecycle-p13-implementation-status.md)、`DBTP` [数据库行为测试计划](docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md)。

### 1.1 读取层级

- 每次任务必须遵守根 `AGENTS.md`。该文件由 Codex 自动加载，不需要再用工具重复读取。
- 每次任务必须检查与任务直接相关的代码、测试、Schema、配置、当前 Git 状态和根 [README.md](README.md) 的对应章节。
- 首次进入项目、没有可信历史上下文，或核心基线文件已变化时，完整读取：蓝图 [AGENTS.md](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/AGENTS.md)、蓝图 [README.md](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/README.md)、根 `README.md`、`D01`、`D03`、`D04`、`D10`、`D11`。
- 已进入项目且上下文可靠时，不重复加载无关文档；只读取下方任务映射命中的文档。

### 1.2 任务模块映射

表中列出的文档必须完整读取；标有“按需”的文档仅在触发条件成立时读取。

| 任务类型 | 必读文档 | 按需追加 |
|---|---|---|
| 普通前端、样式、交互 | `D06`、`D09` | 业务流程变更加 `D02`；涉及 API/权限加 `D03`、`D08`；选型/报价界面加 `D07` |
| 客户、项目、建筑、安装单元 | `D02`、`D03`、`D09`、`D11` | 涉及 Schema 加 `D05`；涉及接口加 `D08` |
| 通用 API、contracts、错误处理 | `D03`、`D05`、`D08`、`D09`、`D11` | AI 或文件接口同时套用对应高风险档 |
| Better Auth、Session、RBAC、多用户隔离 | `D03`、`D08`、`D09`、`D11`、`P2`、`P30`、`P37` | 修改数据结构或事务加 `D05` |
| Prisma、数据库 Schema、Migration、数据库约束 | `D03`、`D05`、`D09`、`D11`、`P30` | 涉及接口加 `D08`；涉及文件表链、Trigger 或文件数据安全时加 `P31`–`P37`、`FZ`、`ST`、`DBTP` |
| 文件上传、下载、删除、清理、生命周期 | `D02`、`D03`、`D04`、`D05`、`D08`、`D09`、`D11`、`P30`、`P31`–`P37`、`FZ`、`ST`、`DBTP` | 对应操作在 `ST` 中引用的全部设计与复核文档 |
| Worker、队列、事务并发、租约、fencing、恢复 | `D05`、`D08`、`D09`、`D11`、`P30`、`P34`、`P35`、`P37`、`FZ`、`ST`、`DBTP` | 涉及文件操作时追加完整文件生命周期档 |
| AI、对话、解析、结构化抽取、提示注入 | `D03`、`D04`、`D05`、`D07`、`D08`、`D09`、`D11` | 文件解析加 `P34`、`P36` 和完整文件生命周期档 |
| 产品库、选型、方案、审核、报价 | `D02`、`D03`、`D05`、`D07`、`D08`、`D09`、`D11` | 对应 UI 加 `D06`；工程项目字段加 `P36` |
| 安全、构建、启动、部署、运行时权限 | `D03`、`D04`、`D08`、`D09`、`D11`、`P30`、`P37`、`ST` | 涉及文件操作/角色加 `FZ`、`DBTP`；`ST` 中与被修改阶段相关的全部设计、复核和报告文档 |
| 纯文档、规则、路标维护 | 目标文档、`D10`、`D11` | 修改产品规则加 `D01`、`D03`、`D04`；修改技术规则加 `ST` |

多个类型同时出现时取文档并集。无法确定任务类型时按较高风险档处理。

### 1.3 高风险完整阅读规则

- 涉及数据库、Migration、事务、权限、文件生命周期、安全、并发、租约、清理、生产启动或部署时，不得只读摘要或局部段落，必须完整读取映射中的全部文档和当前相关实现文件。
- 文件生命周期任务必须读取 `FZ`、`ST`、`DBTP`。`ST` 是阶段索引：凡其链接到本次涉及操作的设计、决策、复核或报告，都必须读取，不能用本文件摘要替代。
- 涉及 `40001`、`40P01`、COMMIT 未知、旧 Worker、租约过期、fencing、FAILED_RETAINED、ACTIVE 异常或 ACL 时，同时按“Worker/并发”和“安全/部署”档读取。
- 高风险要求文档之间存在冲突或缺少关键决策时，停止实现并报告；不得选择对安全更宽松的解释。

### 1.4 事实优先级

- 指令与安全边界：根 `AGENTS.md`、蓝图 `AGENTS.md`；更严格规则优先，不能以专项文档降低安全要求。
- 产品意图：`D01`–`D11`；`D11` 未确认的事项不得自行补齐。
- 当前实现事实：根 `README.md`、`P1`、`P2`、`P30`–`P37`、`ST` 和实际代码/测试。`FZ` 描述已批准设计，不自动等于已实现。
- 蓝图 `AGENTS.md` 中“技术栈尚未最终指定”属于立项期建议，不能覆盖根 README、依赖清单和实际代码确认的技术事实。
- `ST` 中的 `BLOCKED`、`PARTIAL`、`NOT VERIFIED` 不得解释为通过；规划文档不得解释为已实现。

先检查现状，再做单个可验证的垂直切片。不得把“未来规划”当成已实现能力。

## 2. 项目范围与当前状态

- 产品：AI 电梯选型顾问 V1.0 MVP；首期业务为旧楼加装电梯，单一运营企业，不是多租户 SaaS。
- 当前代码已覆盖 Phase 1–3.6 的骨架、认证、项目、私有文件和字段确认，并包含进行中的 Phase 3.7/P1-3 文件生命周期安全整改。
- 已实现不等于生产就绪。OCR、真实 AI API、勘察、真实产品库、正式选型、审核和报价仍未完成。
- 未经明确授权，不接入真实 AI/扫描/短信/支付/电子签约服务，不使用真实客户、厂家或产品数据。
- 所有模拟数据必须明确标记为 `DEMO_MOCK`；缺失信息标记“待确认”，不得编造。

AI 和工程安全规则继续以蓝图 `AGENTS.md` 和 `D03`、`D04`、`D07`、`D11` 为准。特别是：不可信文件内容不能改变系统规则、权限或工具授权；AI 输出不能成为专业确认、审核结果或正式金额。

## 3. 技术栈与总体架构

- Node.js 24、pnpm workspace、TypeScript 严格模式。
- `apps/web`：Next.js App Router + React，承载页面和 API。
- `apps/worker`：独立 pg-boss Worker，承载文件处理、维护与恢复任务。
- `packages/contracts`：Zod 契约；`packages/shared-ui`：共享 UI。
- `packages/selection-engine`：确定性选型边界；`packages/file-storage`：私有存储能力边界；`packages/build-integrity`：发布完整性校验。
- PostgreSQL 18 + Prisma；Better Auth 使用数据库 Session；Pino 记录结构化日志；Vitest 和 Playwright 负责测试。
- 依赖版本以 `package.json` 和 `pnpm-lock.yaml` 为准，不随意升级依赖或锁文件。

保持 Web、Worker、契约、确定性规则、AI 适配层和文件存储的职责分离。模型供应商和生产部署拓扑仍待确认，不得据此擅自引入新架构。

## 4. Next.js 与 TypeScript

- 使用 App Router 和现有严格 TypeScript 配置；禁止用 `any`、类型断言或关闭编译检查来掩盖问题。
- 认证、授权、业务校验和数据访问必须在服务端执行；前端隐藏按钮不是安全控制。
- API 输入使用现有 Zod contracts 校验；错误通过统一错误模型返回，不泄露堆栈、密钥、SQL、物理路径或内部令牌。
- 日志使用 Pino 和既有脱敏配置，不记录密码、Cookie、Session Token、AI Key、Processing Token、租约或存储路径。
- 服务端组件、客户端组件、Route Handler 和领域服务保持现有边界；不要在页面层直接拼装关键数据库事务。
- 用户可读文本保持清晰中文，并覆盖加载、空、错误、无权限和版本变化状态。

## 5. Better Auth、RBAC 与多用户隔离

- 认证采用 Better Auth 用户名密码 + PostgreSQL 数据库 Session；当前关闭注册，Session 有效期 8 小时，Cookie 为 HttpOnly、SameSite=Lax，生产环境必须 Secure。
- 管理员只能通过受控 Seed 创建；不得把真实开发或生产凭据写入源码、日志、测试快照或 Git。
- API 路由使用 `requireApiActor`，页面使用页面 Session/权限守卫，项目资源使用 `requireProjectPermission`。未登录返回 401，越权返回 403。
- 权限同时支持全局范围和项目范围。项目、建筑、安装单元、文件、版本、提取结果和字段 Review 的每次查询都必须校验完整归属链。
- 不得信任 URL、请求体或前端传入的 `projectId`、`fileId`、`versionId`、角色、字段分类或状态；必须在服务端重新查询和校验。
- `SYSTEM_ADMIN` 不自动获得客户确认权限，也不能伪造专业确认。当前权限码以 `apps/web/src/modules/access/permissions.ts` 为准。
- 客户只能访问被授权项目及已发布内容；不同客户、不同项目之间的隔离必须有回归测试。
- 角色名称、审批人配置和未来多租户模型仍待业务确认，不得自行扩展。

## 6. 文件上传、下载、删除与生命周期

### 上传

- 只使用两阶段私有上传：创建 Intent，再流式写入 Staging。当前限制为 20 MiB，真实类型仅 PDF、JPEG、PNG。
- 上传需要有效 Session、项目范围 `file.upload` 权限、Idempotency-Key，并校验 customer/project/building/installation-unit 归属。
- 必须检测真实 MIME，清理显示文件名，计算 SHA-256，使用随机存储键；文件名不得参与物理路径拼接，已存在对象不得覆盖。
- 新 FileVersion 及原始文件、提取文本、原始字段、Review 和安全事件保持不可变；新修正必须追加历史。

### 下载

- 下载需要项目范围 `file.read`，并重新校验 file/version 归属、上传/校验/完整性状态和 SHA-256。
- 生产环境只有在恶意文件扫描状态为 `CLEAN` 时才能下载；`SCAN_UNAVAILABLE` 不是扫描通过，`SYSTEM_ADMIN` 也不例外。
- 未扫描测试访问仅允许在严格测试环境中，并同时满足 `NODE_ENV=test`、`FILE_ACCESS_MODE=test`、测试数据库名、测试角色、测试标记和专用权限。
- 响应必须使用不可猜测的下载接口、`attachment`、真实类型、`private, no-store`、`nosniff`、sandbox CSP 等既有安全策略，不返回 `storageKey` 或物理路径。

### 删除与清理

- FileVersion、Extraction、ExtractionField、Review 和 AuditLog 不得通过普通业务接口删除或改写。
- 当前 Web 仅具备读取和上传写入能力；Worker 为只读；Legacy 删除 API 必须保持禁用、Fail Closed。不得重新引入普通 Web/Worker 物理删除。
- 所有 staging、quarantine、restore、purge 和孤儿清理必须服从 P1-3 Lifecycle/Operation 协议、持久化证据、租约、fencing generation 和人工恢复规则。
- 不得把 Intent 过期、数据库 `DELETED`、租约过期或清理函数返回值等同于物理文件已安全删除。
- 文件系统仅支持受控的 POSIX 本地文件系统或本地 NTFS；拒绝网络卷、未知文件系统、跨卷根目录及不可信可写根目录，symlink/Junction/Reparse Point 一律 Fail Closed。
- 在独立 Maintenance/Recovery 流程、数据库角色和证据要求获得明确批准前，不得启用自动清理、真实文件移动/删除或 ACTIVE 异常恢复。

## 7. Prisma、PostgreSQL、Migration、事务与并发

- Schema 变更必须包含可审查的 Prisma Schema 和 forward Migration；禁止用 `prisma db push` 代替迁移，禁止修改已经应用的历史迁移。
- 新增 Schema 后至少执行 `pnpm db:validate` 和 `pnpm db:generate`。Migration 只在专用测试库验证，除非用户明确授权开发库或受控环境变更。
- 严禁在未授权情况下对生产或共享数据库执行 DDL、DML、数据修复、`migrate reset`、`DROP`、`TRUNCATE`、批量删除或 ACL/角色修改。
- 多表业务不变量必须在同一数据库事务中完成；关键写入与 AuditLog 同事务。审计日志只追加。
- 并发正确性必须由唯一约束、条件更新、行锁/CAS、租约令牌或 fencing generation 保证，不能只用“先查后写”。
- 字段 Review 使用字段行锁、`expectedReviewSequence` 和唯一约束防重复；重试只允许明确可重试的序列化/死锁错误。
- Worker 完成、失败、续租和恢复均必须匹配 `processingToken` 与有效租约；旧 Worker 不得覆盖新结果。
- 文件系统操作不属于数据库事务。任何 COMMIT 结果未知、文件身份不明或关闭证明缺失的场景必须保留对象并 Fail Closed。
- SQL/Prisma 查询必须保持 append-only Trigger、复合外键、CHECK、部分唯一索引和状态机约束，不得为方便测试绕过 Trigger。

当前 `elevator_app` 仍是数据库 Owner，独立 Web/Worker/Maintenance/Definer/Recovery 角色和 ACL 隔离尚未建立；不得声称生产权限边界已经生效。
AuditLog 的 `UPDATE/DELETE` Trigger 已存在，但整表 `TRUNCATE` 防护仍为已知缺口，不得把普通只追加约束外推为完整审计保护。

## 8. 测试、构建与回归验证

根据改动风险选择并报告以下验证：

```powershell
pnpm db:validate
pnpm db:generate
pnpm test:db:verify
pnpm test:db:constraints
pnpm test
pnpm test:e2e
pnpm typecheck
pnpm build
pnpm security:startup
```

- 涉及数据库行为时先 `pnpm test:db:verify`，再使用专用测试库；只允许重置精确的 `elevator_advisor_test` 和 `elevator_test_app`，必须具备 `ALLOW_TEST_DB_RESET=true` 及全部身份/路径守卫。
- 不得用开发数据库、生产数据库或真实客户数据代替测试夹具。
- 回归测试至少覆盖成功、失败、空状态、权限拒绝、跨客户/跨项目访问、并发冲突、审计和不可变性。
- 文件改动还需覆盖真实 MIME、大小、SHA-256、幂等、No-overwrite、路径/链接安全、扫描策略、下载安全头、租约丢失和旧 Worker 回写。
- Migration 结构成功不等于 Trigger 行为、真实 COMMIT、并发安全或文件系统安全已经通过，必须分别验证并如实报告。
- 当前存在未提交的 P1-3 安全修复时，HEAD Startup Gate 可能按设计失败；不得删除、绕过或回滚安全 Gate 来强行让构建通过。
- 小范围文档修改可只执行链接、路径、Git diff 和工作树验证，但必须在报告中说明未运行代码测试的原因。

## 9. Git、分支与工作树保护

- 开始和结束任务时都检查 `git status --short --branch`、当前分支和 HEAD。
- 默认保留现有未提交修改、未跟踪文件和用户改动；禁止未经明确授权执行 `git reset`、`restore`、`checkout --`、`clean`、`stash`、强制推送或批量覆盖。
- 只有用户明确要求创建分支时才创建；新分支默认使用 `codex/` 前缀。不得擅自切换或重建当前分支。
- 实现请求不等于提交授权。必须先获得明确授权才能 `git add`、commit、amend、rebase 或推送；当前 P1-3 安全整改的提交授权状态不能由普通开发任务推定。
- 不得修改 Git 用户配置、远端、hooks 或忽略规则来规避检查。提交信息规范尚未由项目正式确认，待确认前不得自行制定并宣称强制规范。
- 不得提交 `.env`、`.env.test`、密钥、测试凭据、私有文件、构建产物或真实业务数据。

## 10. 已确认架构决策与待确认事项

未经用户明确确认，不得改变以下已确认决策：

- Next.js + TypeScript Web、独立 pg-boss Worker、pnpm monorepo。
- PostgreSQL + Prisma，数据库 Migration 管理 Schema。
- Better Auth 数据库 Session、关闭注册、服务端 RBAC 和项目范围隔离。
- 私有存储、不可变 FileVersion、追加式提取/Review/Audit、P1-3 生命周期状态机。
- 确定性规则引擎负责硬约束，AI 只负责理解、整理和解释。
- 单一运营企业，不扩展为多租户 SaaS。

真实模型供应商、生产部署拓扑、文件保留/删除政策、真实客户数据使用、ACL/角色方案、正式产品数据和审批规则仍待确认，详见蓝图 [docs/11_OPEN_DECISIONS.md](AI_Elevator_Advisor_Codex_Blueprint/AI_Elevator_Advisor_Codex_Blueprint/docs/11_OPEN_DECISIONS.md) 和 P1-3 状态文档。不得自行填补这些决策。

## 11. 完成定义与任务报告

完成任务时必须提供：

1. 实际修改的文件列表和保存位置。
2. 数据库、配置、文件和 Git 状态是否发生变化。
3. 执行的测试/构建/验证命令及逐项结果。
4. 未执行的必要测试及原因。
5. 风险、遗留问题和待确认事项。

只有代码、文档或配置已经实际保存，相关验证通过，且没有隐瞒未验证项时，才能声明任务完成。
