# APP-WORKBENCH-R2 SalesHandoff Invalidation & Snapshot Consistency Design R3

## 0. 最终结论

```text
DESIGN READY — READY FOR INDEPENDENT RE-REVIEW
```

本报告只完成设计修正，不实施源码、Schema、Migration、ACL、Trigger、API 或测试。
所有 Prisma、PostgreSQL、Trigger、并发、浏览器和部署行为仍为 `NOT VERIFIED`。

“DESIGN READY”只表示设计已具备独立复评条件，不表示当前环境满足 Contract 条件。
在生产/受控环境证据未完成前，Contract 的实际状态仍必须是 `BLOCKED`。

## 1. 审查问题与修正对应

| R2 独立审查问题 | R3 修正 |
|---|---|
| P1：需求 PATCH/顾问在锁外读取并合并 | 所有需求修改统一为 Project 锁内读取、合并、校验、追加版本；增加 expectedVersion/并发冲突语义 |
| P1：无法证明旧写入者退出，旧 notes API 可继续写 | 采用新数据库角色、旧角色 NOLOGIN、会话终止、销售表直接 DML 撤销和 SECURITY DEFINER 命令函数；证据不足则硬阻塞 Contract |
| P2：SelectionRun 没有同项目复合不变量 | 增加 `requirementProjectId`、同项目复合 FK、CHECK 和历史数据核查 |
| P2：Prisma `onUpdate` 与 Migration 不一致 | 逐关系保留或明确改变 action；R3 采用现有 Cascade 语义，并用身份不可变 Trigger 禁止实际主键更新 |
| P2：note 无请求级幂等 | 增加 requestKey、operationType、protocolVersion、requestPayload、statusAfter 和数据库唯一约束 |
| P2：open-context 幂等不完整 | 同 context + 同 canonical payload 重放；不同 payload 拒绝；CLOSED/legacy 特殊规则明确 |
| P2：销售列表先全量读取再过滤 | 查询在数据库内按 actor 的 `SALES_MANAGE` 项目范围过滤；分页、计数、详情统一 |
| P2：E2E 未断言真实 handoff 关系 | 给出数据库实体断言、并发 PATCH、note 幂等、旧 API 拒绝矩阵 |

## 2. Git 与输入基线

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked status entries:     147
Untracked recursive files:    158
```

审查输入：

```text
被修正设计：
docs/product/app-workbench-r2-sales-handoff-invalidation-design-r2.md
SHA-256:
d70ef26773d24c1cc96eea823b1bbd550d316dba87e34dc3d8874fedb7f41c2c

第二轮独立审查：
docs/product/app-workbench-r2-sales-handoff-design-independent-review-r2.md
SHA-256:
ac82b696fa89de305be3ae9bba53c04fc71384ebdd1a17189278f2b15d267a99
```

本报告只新增 R3 文档，不覆盖 R1/R2 设计或独立审查报告。

## 3. 当前实现事实

### 3.1 需求写入

当前 `PATCH /api/projects/:projectId/requirements` 在 Project 锁外读取最新需求并
合并字段，然后调用 `createRequirementVersion()`；调用未传 `expectedVersion`。
后者才在事务内锁 Project 并分配新版本号。这会产生丢失更新。

顾问消息路径同样在锁外读取需求并生成/合并结果。

### 3.2 选型和销售写入

当前 `createSelectionRun()`、`createSalesHandoff()` 和 `addSalesFollowUp()` 均未
取得统一 Project 行锁；`createSalesHandoff()` 使用 projectId-only
`ON CONFLICT DO UPDATE`；`addSalesFollowUp()` 可按 handoff ID 更新 status 并插入
随机 UUID note，没有当前 context 检查或请求幂等键。

### 3.3 数据库身份

当前 `elevator_app` 仍为数据库 Owner。独立 Web/Worker/Sales writer 角色尚不存在。
因此仅增加 Trigger 不能证明普通应用角色无法禁用 Trigger、修改函数或绕过表权限。

### 3.4 部署证据

当前状态文档记录生产实例、Scheduler、自动重启、Legacy Drain 和生产 ACL 均未
完整证明。R3 因此把“可证明旧写入者不可重连”设为 Contract 硬门禁，而不是风险
提示。

## 4. 目标不变量

1. 每个 Project 的当前需求由最大 `version` 唯一决定。
2. 当前需求的所有修改必须在同一 ReadCommitted 事务中先锁 Project，再读取和合并。
3. SelectionRun 的 Project 与 Requirement 必须一致。
4. SalesHandoff 必须精确绑定当前 Requirement 和当前 COMPLETED SelectionRun。
5. legacy 全 NULL handoff 永久只读，不补绑、不复活。
6. CLOSED 不可逆。
7. note/status 写入必须通过 Project 锁、当前 context 校验和请求幂等。
8. 旧数据库角色在 Contract 后不得连接或写入。
9. 普通新 Web 角色不得直接修改销售表和 note 表，只能执行受控命令函数。
10. 无法证明旧写入者已排除时，Contract 必须阻塞。

## 5. P1：需求修改的统一 Project 锁协议

### 5.1 权威事务边界

所有 BuildingRequirement 修改使用以下顺序：

```text
BEGIN
SELECT "id" FROM "project" WHERE "id" = :projectId FOR UPDATE
SELECT latest BuildingRequirement WHERE projectId = :projectId
  ORDER BY version DESC LIMIT 1
执行 expectedVersion / status / missingFields 校验
基于刚读取的最新需求执行 merge
INSERT BuildingRequirement vN+1
INSERT RequirementRevision
INSERT AuditLog
COMMIT
```

锁顺序固定为：

```text
Project -> AdvisorConversation（如涉及）-> BuildingRequirement/Revision/Message
```

禁止先读取需求、先锁 conversation 或先锁 requirement 后再锁 Project。

开始新顾问会话时，conversation、初始 requirement/revision 和首条 assistant
message 也应位于同一 Project 锁事务；不得先提交 conversation，再基于未锁定的
项目需求状态创建 requirement。

### 5.2 修改 API

`PATCH /api/projects/:projectId/requirements` 的 contract 增加：

```text
expectedVersion: positive integer
```

事务内最新需求必须满足：

```text
latestRequirement.version == expectedVersion
```

否则返回 409 `REQUIREMENT_VERSION_CONFLICT`，不写入任何需求、修订或审计。

重复请求：

- 第一次提交成功后版本变为 N+1；
- 相同 `expectedVersion=N` 的再次请求稳定返回 409；
- 不允许用相同旧版本再次写入或静默重放旧字段。

同一字段或不同字段并发修改都采用同一“一个成功、其余版本冲突”规则。R3 不采用
跨版本自动三方合并。

### 5.3 确认需求

`confirmRequirement` 必须整体迁入同一 Project 锁事务：

1. 锁 Project；
2. 读取最新需求；
3. 比较 expectedVersion；
4. 检查 missingFields；
5. 插入 CUSTOMER_CONFIRMED 新版本、Revision 和 Audit；
6. 提交。

锁外读取只可用于非权威 UI 提示，不能用于生成待写字段。

### 5.4 顾问消息

顾问消息分两段：

```text
读阶段（不入库、不持锁）：
  读取 UI 当前版本，仅用于构造模型上下文

写阶段：
  BEGIN
  锁 Project
  锁/验证 AdvisorConversation
  读取最新需求和 expectedRequirementVersion
  若版本不符 -> 409，不写用户消息、需求、助手消息或审计
  基于锁内最新需求合并 provider requirementPatch
  重算 missingFields 并执行服务端 schema 校验
  INSERT user message + requirement version/revision + assistant message
  UPDATE conversation.updatedAt
  INSERT AuditLog
  COMMIT
```

provider/Mock AI 调用不得在数据库事务中执行。模型看到的快照可以被标记为
`advisorySnapshotVersion`，但最终写入必须用锁内最新需求重新合并。

顾问 API contract 增加：

```text
expectedRequirementVersion: positive integer
```

若会话尚无需求，使用明确的 `NO_REQUIREMENT` 状态，不伪造版本号。

### 5.5 其他入口扫描

未来提交前必须再次搜索：

```text
buildingRequirement.create/update/updateMany/delete/deleteMany
INSERT/UPDATE/DELETE building_requirement
requirement_revision writes
advisor message writes that also update requirements
scripts/workers/background jobs
```

当前静态搜索只发现 Web 需求、顾问和 selection 服务路径；任何新旁路必须纳入同一
Project 锁服务，不得直接调用 `createRequirementVersion()`。

### 5.6 ReadCommitted 语义和双连接时间线

写入事务固定 `ReadCommitted`。每条 SQL statement 取得自己的 snapshot；等待
`Project FOR UPDATE` 时，另一事务可以提交。获得锁后的下一条 SELECT 会看到该提交。

Connection A:

```text
BEGIN
SELECT Project FOR UPDATE
读取 R1
合并 floorCount=9
INSERT R2
INSERT revision/audit
COMMIT
```

Connection B:

```text
BEGIN
SELECT Project FOR UPDATE  -- 等待 A
读取最新需求 -> R2
expectedVersion=R1 -> 冲突
ROLLBACK
```

测试必须由两个真实连接执行，Observer 记录 A/B 的 `pg_backend_pid()`、B 的
Lock wait、A commit 和 B 的 409，不能只用两个 Promise 的时序假定。

### 5.7 重试结果

只对 `40001`、`40P01`、`P2034` 重试整个事务。重试从头锁 Project、读取最新需求
并应用原 expectedVersion：

- 原事务未提交：若没有其他提交，可成功一次；
- 其他事务已提交：返回版本冲突；
- 重试耗尽：409/503 稳定错误；
- 不在事务内调用 provider、通知、队列或文件系统副作用。

### 5.8 SelectionRun 创建

`createSelectionRun` 也必须改为：

```text
锁 Project
读取 version DESC LIMIT 1 的最新需求
比较请求 requirementVersion 和锁内需求 id/version/status
写入 SelectionRun(projectId, requirementId, requirementProjectId)
写入 SelectionRecommendation
写入 AuditLog
提交
```

如果请求版本已过期、需求不是 CUSTOMER_CONFIRMED 或不属于当前 Project，返回 409，
不写入 run/recommendations。选型计算可以在锁外预先生成，但写入前必须在锁内
重新验证需求版本。

## 6. P1：旧写入者排除与数据库能力隔离

### 6.1 目标数据库角色

目标角色和职责：

| 角色 | 登录 | 权限 |
|---|---|---|
| `elevator_app`（旧登录角色） | Contract 后 NOLOGIN | 不能连接目标数据库；不得被新角色继承 |
| `elevator_owner`（新 NOLOGIN） | 否 | 仅拥有 Schema/对象，不承载应用登录 |
| `elevator_web_runtime_v2` | 是，凭据只在外置 Secret/凭据系统中 | 只读业务表、执行有限命令函数；无 sales 表直接 DML、无 DDL、无 TRUNCATE |
| `elevator_worker_runtime_v2` | 是 | 文件任务与只读需求上下文；无销售写入/命令函数 EXECUTE |
| `elevator_sales_definer` | 否 | `SECURITY DEFINER` 销售命令函数 Owner，不分配给应用 |
| `elevator_test_runtime` | 仅隔离测试库 | 测试专用，不能连接开发/生产库 |
| 迁移 DBA | 临时受控 | DDL、角色、Trigger、Migration；不使用 Web runtime 凭据 |

只有受控外置凭据管理可以创建/轮换登录凭据。源码、报告、Migration 和日志不得
包含密码、连接串或 token。

### 6.2 方案比较结论

| 方案 | 结论 |
|---|---|
| A. 旧/新登录角色分离、旧角色 NOLOGIN、终止旧会话 | 主方案。唯一能在当前同角色现状下证明旧连接不再可认证的方案 |
| B. 仅使用应用自定义 GUC/capability token | 不充分。旧角色或同一代码若仍可执行相同 SQL，也可以自行设置会话变量 |
| C. 写冻结 + 排空 + 旧角色撤权 + 新角色恢复 | 与 A 组合，作为实际 Cutover 协议 |
| D. 只看一次 `pg_stat_activity` | 不充分，禁止作为 Contract 准入 |

### 6.3 旧写入者清单和证据

Contract 前必须枚举：

| 写入者 | 目标数据库身份 | 证据 |
|---|---|---|
| V1 Web 进程/连接池 | `elevator_app` | 主机、PIDs、连接池、backend PID、最后心跳 |
| V1 Worker/PgBoss | `elevator_app` | 进程、队列、schedule、重启策略、backend PID |
| V1 Scheduler/Watchdog | `elevator_app` 或运维身份 | Scheduler 列表、NextRun、服务配置、控制台/API 证据 |
| 一次性脚本 | 运维或 `elevator_app` | 任务历史、脚本仓库、主机进程、会话 |
| 手工 SQL | DBA/管理员 | 变更审批、会话审计、数据库 role membership |
| V2 Web | `elevator_web_runtime_v2` | application_name、Build ID、release ID、backend PID |
| V2 Worker | `elevator_worker_runtime_v2` | application_name、Build ID、queue role |

验收 SQL（未来在授权环境执行）：

```sql
SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb
FROM pg_roles
WHERE rolname IN ('elevator_app','elevator_web_runtime_v2',
                  'elevator_worker_runtime_v2','elevator_sales_definer');

SELECT usename, application_name, client_addr, backend_start,
       state, xact_start, backend_xid
FROM pg_stat_activity
WHERE usename IN ('elevator_app','elevator_web_runtime_v2');
```

还要检查 `pg_auth_members`、数据库 CONNECT、schema CREATE、表 owner 和函数 ACL。
零会话只是一项证据，不是完整证明。

### 6.4 Contract 硬门禁

只有以下全部成立才允许 Contract：

1. 旧 Web、Worker、Scheduler、Watchdog、任务器和连接池已明确枚举；
2. 自动重启、自动扩缩容和旧网络入口已关闭或确定无法重建旧实例；
3. 旧 `elevator_app` 已 NOLOGIN，或已撤销 CONNECT 且证明无法再认证；
4. 旧角色所有 backend PID 已全部终止；
5. 旧角色没有继承成员或仍可 SET ROLE 的路径；
6. 新 Web 角色已具备最小读/命令 EXECUTE 权限，且没有对象 owner 权限；
7. 新角色不能禁用 Trigger、修改函数、创建函数、TRUNCATE 或 SET ROLE；
8. 新角色未获旧销售表直接 INSERT/UPDATE/DELETE；
9. 迁移 DBA 与新 Web 角色不共享凭据；
10. 外部证据中的 Host/Instance/Artifact/Build ID 与现场一致。

任一条件无法证明：

```text
CONTRACT STATUS = BLOCKED
```

不得用“维护窗口”“一次 `pg_stat_activity` 为空”或“业务暂时无人使用”替代。

### 6.5 新角色权限

`elevator_web_runtime_v2`：

```text
SELECT: project, building_requirement, selection_run, 必要的 RBAC 表
EXECUTE: app_sales_create_handoff_v2
         app_append_sales_followup_v2
         app_list_sales_handoffs_v2
         app_get_sales_handoff_context_v2
禁止: SELECT sales_handoff / sales_follow_up_note（内部销售字段只能经授权函数）
禁止: SELECT 敏感销售摘要、内部预算和 notes 的直接表扫描
禁止: INSERT/UPDATE/DELETE sales_handoff
禁止: INSERT/UPDATE/DELETE sales_follow_up_note
禁止: DELETE/TRUNCATE 任一历史表
禁止: CREATE/ALTER/DROP; ALTER TABLE ... DISABLE TRIGGER
禁止: 函数 owner、schema owner、database owner
禁止: SET ROLE definer/owner/admin
```

需求更新和 SelectionRun 创建若仍需 Web DML，必须使用最小表级权限和 Project 锁
服务；不得把 `elevator_web_runtime_v2` 设为表 Owner。

旧 `elevator_app` 当前是数据库 Owner。Contract 前必须审计并处理
`pg_database.datdba`、schema owner、目标表 owner、sequence owner 和函数 owner。
目标状态是：

- database、目标 schema、目标表、sequence、Trigger function 和销售命令函数改由
  `elevator_owner` / `elevator_sales_definer` 等 NOLOGIN 角色拥有；
- 不再有任何可登录应用角色拥有目标 schema、表或函数；
- `elevator_app` 不得是上述对象 Owner 或可 SET ROLE 到其 Owner；
- 现有 `elevator_app` 在 Contract 后 NOLOGIN，登录凭据旋转或失效。

如果所有权迁移无法在维护窗口内完成，Contract 必须阻塞。不能仅因新角色已创建就
进入 Contract。

`elevator_sales_definer` 函数要求：

```text
SECURITY DEFINER
SET search_path = pg_catalog
所有业务表使用完全限定 Schema 名
REVOKE EXECUTE FROM PUBLIC
REVOKE ALL FROM elevator_worker_runtime_v2
仅 GRANT EXECUTE 给 elevator_web_runtime_v2
```

### 6.6 威胁边界

PostgreSQL 登录角色证明的是“哪个服务进程连接数据库”，不是终端用户身份。
`actorUserId` 必须由已经验证 Better Auth Session 的 v2 Web 服务传入；数据库函数
再验证该 actor 的实时角色/项目权限。R3 阻止旧 V1 服务和旧凭据调用 v2 能力，
但不声称在 v2 Web 服务代码已被攻陷时数据库仍能区分同一服务发出的伪造 actor。
这是后续最小权限、Session 和审计边界，不应被误写成已解决。

数据库超级用户/受信 DBA 仍可禁用 Trigger 或直接维护数据；该身份不属于普通应用
角色，必须由独立审批和审计约束。任何 v2 Web/Worker 登录角色获得 DBA、对象 owner
或 Trigger 管理能力都视为设计失败。
Row-Level Trigger 也不能替代 `TRUNCATE` 权限控制；v2 Web/Worker 必须无相关表的
`TRUNCATE` 权限。

## 7. P1：旧 notes API 失效与 v2 notes 命令

### 7.1 旧 API 处理

旧路径：

```text
POST /api/admin/sales/:handoffId/notes
```

在兼容部署中默认关闭写入。Cutover 后永久返回：

```text
410 Gone
code = SALES_FOLLOW_UP_PROTOCOL_REQUIRED
```

部署 v2 路径：

```text
POST /api/admin/sales/:handoffId/follow-ups
X-Sales-Protocol-Version: 2
Idempotency-Key: <128 chars max, UUID recommended>
```

如果请求缺少 protocol version 或幂等键：

```text
426 Upgrade Required / 428 Precondition Required
```

但这只是应用层行为。真正阻断旧实例依赖第 6 节的角色禁用和旧会话终止。
预期可观测结果为：

```text
旧凭据重新登录:       认证失败（PostgreSQL 28P01 或等价）
旧连接在终止前继续写: 由自由窗口立即冻结；终止后无会话
错误角色执行 v2 函数: 42501
旧应用调用 v1 路由:   410（仅新代码可达时）
```

### 7.2 数据库命令函数

销售写入口通过以下 `SECURITY DEFINER` 函数提供：

```text
app_sales_create_handoff_v2(
  actorUserId,
  projectId,
  summary,
  budgetConcern
) -> outcome/handoffId/contextState/replayed

app_append_sales_followup_v2(
  actorUserId,
  handoffId,
  requestKey,
  protocolVersion,
  status,
  contactStatus,
  note
) -> outcome/noteId/status/replayed

app_list_sales_handoffs_v2(
  actorUserId,
  search,
  offset,
  pageSize
) -> authorized handoff DTO + total

app_get_sales_handoff_context_v2(
  actorUserId,
  handoffId
) -> authorized handoff/context DTO

app_resolve_current_completed_selection_v2(
  projectId
) -> internal-only CURRENT/NO_REQUIREMENT/NO_MATCH/AMBIGUOUS/
     INVALID_TIMESTAMP/SELECTION_NOT_COMPLETED
```

授权 DTO 必须包含 `projectId`、`boundRequirementId`、`boundSelectionRunId`、
`status`、`contextState` 和已有 notes，供页面区分当前/历史并供 E2E 做实体断言。

`app_resolve_current_completed_selection_v2` 只允许其他 definer 函数内部调用，不给
Web runtime 直接 EXECUTE。其 SQL 语义必须与
`apps/web/src/modules/workbench/selection-consistency.ts` 的
`resolveCurrentSelectionRun()` 完全一致，并用同一 fixture 证明：

- 先按 `requirementId = latestRequirement.id` 过滤；
- 选择 `createdAt` 最大者；
- 最大时间并列返回 AMBIGUOUS；
- 无效时间返回 INVALID_TIMESTAMP；
- 只有当前 run.status=COMPLETED 才可写；
- 不依赖数组顺序或全局最新 run。

数据库 resolver 是销售写入的权威；TS resolver 用于页面展示。两者必须通过固定
时间戳、并列、旧 run 更新、当前 run 未完成和缺失时间等 parity 测试，禁止出现
两套选择结果。

所有命令函数：

- 使用 `SECURITY DEFINER`；
- `SET search_path = pg_catalog`；
- 业务对象使用完全限定 Schema；
- 禁止动态 SQL；
- 由 `elevator_sales_definer` 持有；
- `REVOKE ALL FROM PUBLIC`；
- 只给 `elevator_web_runtime_v2` 必要的 EXECUTE；
- create handoff 检查项目/全局 `sales.handoff.create`；
- follow-up 与销售读取函数检查项目/全局 `sales.manage`；
- 不接受客户端声明的权限；
- 在函数内部锁 Project，并重新读取权威上下文。

销售命令函数放置于专用 schema `sales_command`，不与普通业务函数混用。对应默认
权限至少包括：

```sql
REVOKE ALL ON TABLE "sales_handoff", "sales_follow_up_note" FROM PUBLIC;
REVOKE ALL ON SCHEMA "sales_command" FROM PUBLIC;
GRANT USAGE ON SCHEMA "sales_command" TO "elevator_web_runtime_v2";
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA "sales_command" FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE "elevator_sales_definer"
  IN SCHEMA "sales_command"
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
```

表和 sequence 的默认权限也必须由 DBA 显式复核，不能依赖 PostgreSQL 默认。

### 7.3 v2 notes 事务

`app_append_sales_followup_v2` 在单个事务内执行：

```text
1. 按 handoffId 做一次不可信项目定位（只读 projectId）
2. SELECT Project FOR UPDATE
3. 重新读取 handoff FOR UPDATE，并确认 projectId 与第 1 步一致
4. 使用同一事务 client 查询 actor 的项目/全局 SALES_MANAGE
5. 查询 (authorUserId, operationType, requestKey) 幂等记录
6. 若是同 payload：返回既有 note/status，不再读当前方案、不再写
7. 若是不同 payload：拒绝 key 重用
8. 首次 key：读取 version DESC LIMIT 1 最新 requirement
9. 读取该项目全部 SelectionRuns，执行确定性 current COMPLETED resolver
10. 验证 handoff.projectId / boundRequirementId / boundSelectionRunId 精确匹配
11. 拒绝 LEGACY_UNBOUND、CLOSED、historical/invalid/ambiguous
12. 先插入 note（含 request metadata），再更新 handoff status，最后插入 AuditLog；
    这样 CLOSED 关闭 note 在 parent 仍非 CLOSED 时被验证，任一后续失败整体回滚
13. COMMIT
```

第 1 步的项目定位仅用于找到要锁的 Project，任何权限/context 判断都必须在
第 2-8 步重新完成。

### 7.4 数据库端定义

新 Web 角色没有直接 `UPDATE sales_handoff` 或 `INSERT sales_follow_up_note`
权限，只能 `EXECUTE app_append_sales_followup_v2`。这使“其他服务层直接 SQL”
必须经过同一函数、同一 Project 锁、同一 context resolver 和同一幂等表记录。

数据库 Trigger 继续作为底线：

- 无完整绑定的 handoff 不得新增 note；
- legacy/CLOSED 不得新增 note；
- note 不得 UPDATE/DELETE；
- 非法直接 SQL 由表权限先拒绝。

函数返回稳定 outcome：

```text
OK_CREATED
OK_REPLAY
NOT_FOUND
FORBIDDEN
CONTEXT_STALE
CLOSED
IDEMPOTENCY_KEY_REUSED
```

## 8. P2：SelectionRun 同项目复合不变量

### 8.1 SelectionRun 新字段

增加：

```text
requirementProjectId String
```

新语义：

```text
SelectionRun.projectId
  == SelectionRun.requirementProjectId
  == BuildingRequirement(requirementId).projectId
```

### 8.2 Prisma 片段

```prisma
model BuildingRequirement {
  id            String @id @default(cuid())
  projectId     String
  version       Int

  project       Project @relation(
    fields: [projectId],
    references: [id],
    onDelete: Restrict,
    onUpdate: Cascade
  )
  selectionRuns SelectionRun[] @relation("SelectionRunRequirement")
  salesHandoffs SalesHandoff[] @relation("SalesHandoffRequirement")

  @@unique([projectId, version])
  @@unique([id, projectId], map: "building_requirement_id_projectId_key")
}

model SelectionRun {
  id                   String @id @default(cuid())
  projectId            String
  requirementId        String
  requirementProjectId String
  createdById          String
  status               SelectionRunStatus
  createdAt            DateTime @default(now()) @db.Timestamptz(6)

  project Project @relation(
    fields: [projectId],
    references: [id],
    onDelete: Restrict,
    onUpdate: Cascade
  )
  requirement BuildingRequirement @relation(
    "SelectionRunRequirement",
    fields: [requirementId, requirementProjectId],
    references: [id, projectId],
    onDelete: Restrict,
    onUpdate: Restrict
  )
  createdBy User @relation(
    fields: [createdById],
    references: [id],
    onDelete: Restrict,
    onUpdate: Cascade
  )
  salesHandoffs SalesHandoff[] @relation("SalesHandoffSelectionRun")

  @@unique(
    [id, projectId, requirementId],
    map: "selection_run_id_projectId_requirementId_key"
  )
}
```

### 8.3 PostgreSQL 约束

```sql
ALTER TABLE "selection_run"
  ADD CONSTRAINT "selection_run_requirement_project_check"
  CHECK ("requirementProjectId" = "projectId");

ALTER TABLE "selection_run"
  ADD CONSTRAINT "selection_run_requirement_project_fkey"
  FOREIGN KEY ("requirementId", "requirementProjectId")
  REFERENCES "building_requirement" ("id", "projectId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
```

历史迁移：

1. 增加 nullable `requirementProjectId`；
2. 以 `selection_run.requirementId = building_requirement.id` 精确 join；
3. 若 Project 不一致、找不到 Requirement 或存在多义数据，迁移停止；
4. 一致时填 `building_requirement.projectId`；
5. 执行全表 CHECK/JOIN 后设 NOT NULL；
6. 增加复合 FK；
7. 验证完成后删除旧单列 `selection_run_requirementId_fkey`，避免重复关系；
8. 不通过猜测或 `LIMIT 1` 回填。

约束名：

```text
selection_run_requirement_project_check
selection_run_requirement_project_fkey
selection_run_id_projectId_requirementId_key
```

## 9. P2：完整 Prisma/PostgreSQL 关系与 action

### 9.1 动作策略

R3 选择：

- 现有非目标关系的 Cascade 更新语义保留，避免无必要重建；
- 新复合身份关系和 assignedTo 关系使用 Restrict；
- 所有 project/requirement/run/handoff/note 身份字段增加不可变 Trigger；
- Prisma 片段逐项写出实际 action，不能依赖默认值。

这避免“Prisma 默认 Cascade、Migration 实际 NO ACTION/反向”的隐性差异。

### 9.2 SalesHandoff 完整关系

```prisma
model SalesHandoff {
  id                        String @id @default(cuid())
  projectId                 String
  createdById               String
  assignedToId              String?
  status                    SalesHandoffStatus @default(PENDING_FOLLOW_UP)
  budgetConcern             String? @db.Text
  summary                   String? @db.Text

  boundRequirementId        String?
  requirementProjectId      String?
  boundSelectionRunId       String?
  selectionRunProjectId     String?
  selectionRunRequirementId String?
  createPayload             Json?

  project Project @relation(
    fields: [projectId],
    references: [id],
    onDelete: Restrict,
    onUpdate: Cascade
  )
  createdBy User @relation(
    "SalesHandoffCreatedBy",
    fields: [createdById],
    references: [id],
    onDelete: Restrict,
    onUpdate: Cascade
  )
  assignedTo User? @relation(
    "SalesHandoffAssignedTo",
    fields: [assignedToId],
    references: [id],
    onDelete: Restrict,
    onUpdate: Restrict
  )
  requirement BuildingRequirement? @relation(
    "SalesHandoffRequirement",
    fields: [boundRequirementId, requirementProjectId],
    references: [id, projectId],
    onDelete: Restrict,
    onUpdate: Restrict
  )
  selectionRun SelectionRun? @relation(
    "SalesHandoffSelectionRun",
    fields: [boundSelectionRunId, selectionRunProjectId,
             selectionRunRequirementId],
    references: [id, projectId, requirementId],
    onDelete: Restrict,
    onUpdate: Restrict
  )
  followUpNotes SalesFollowUpNote[]

  @@unique(
    [projectId, boundRequirementId, boundSelectionRunId],
    map: "one_sales_handoff_per_bound_context"
  )
  @@map("sales_handoff")
}
```

`assignedToId` 当前没有数据库 FK；R3 必须新增
`sales_handoff_assignedToId_fkey`，不能继续容忍孤立用户 ID。

对应 User 反向字段：

```prisma
model User {
  // ...
  salesHandoffsCreated  SalesHandoff[] @relation("SalesHandoffCreatedBy")
  assignedSalesHandoffs SalesHandoff[] @relation("SalesHandoffAssignedTo")
}
```

### 9.3 PostgreSQL action 映射

| Prisma relation | 数据库 FK | 当前/目标 action |
|---|---|---|
| BuildingRequirement.project | `building_requirement_projectId_fkey` | RESTRICT / CASCADE（保留现有） |
| BuildingRequirement.conversation | `building_requirement_conversationId_fkey` | SET NULL / CASCADE（保留现有） |
| BuildingRequirement.createdBy | `building_requirement_createdById_fkey` | RESTRICT / CASCADE（保留现有） |
| BuildingRequirement.updatedBy | `building_requirement_updatedById_fkey` | SET NULL / CASCADE（保留现有） |
| SelectionRun.project | `selection_run_projectId_fkey` | RESTRICT / CASCADE（保留现有） |
| SelectionRun.createdBy | `selection_run_createdById_fkey` | RESTRICT / CASCADE（保留现有） |
| SelectionRun.requirement | `selection_run_requirement_project_fkey` | RESTRICT / RESTRICT（新复合 FK） |
| SalesHandoff.project | `sales_handoff_projectId_fkey` | RESTRICT / CASCADE（保留现有） |
| SalesHandoff.createdBy | `sales_handoff_createdById_fkey` | RESTRICT / CASCADE（保留现有） |
| SalesHandoff.assignedTo | `sales_handoff_assignedToId_fkey` | RESTRICT / RESTRICT（新增 FK） |
| SalesHandoff.requirement | `sales_handoff_requirement_project_fkey` | RESTRICT / RESTRICT |
| SalesHandoff.selectionRun | `sales_handoff_selection_requirement_project_fkey` | RESTRICT / RESTRICT |
| SalesFollowUpNote.handoff | `sales_follow_up_note_handoffId_fkey` | RESTRICT / CASCADE（保留现有） |
| SalesFollowUpNote.author | `sales_follow_up_note_authorUserId_fkey` | RESTRICT / CASCADE（保留现有） |

现有 `ON UPDATE CASCADE` 保留时，业务 Trigger 必须拒绝更新被引用的 Project、
Requirement、SelectionRun、SalesHandoff、User 身份字段。数据库 action 负责引用
完整性，Trigger 负责禁止业务身份重写。

### 9.4 SalesHandoff 约束

```sql
ALTER TABLE "sales_handoff"
  ADD CONSTRAINT "sales_handoff_binding_all_or_none_check"
  CHECK (
    num_nonnulls(
      "boundRequirementId",
      "requirementProjectId",
      "boundSelectionRunId",
      "selectionRunProjectId",
      "selectionRunRequirementId"
    ) IN (0, 5)
  );

ALTER TABLE "sales_handoff"
  ADD CONSTRAINT "sales_handoff_binding_project_requirement_check"
  CHECK (
    "boundRequirementId" IS NULL OR (
      "requirementProjectId" = "projectId"
      AND "selectionRunProjectId" = "projectId"
      AND "selectionRunRequirementId" = "boundRequirementId"
    )
  );

ALTER TABLE "sales_handoff"
  ADD CONSTRAINT "sales_handoff_create_payload_check"
  CHECK (
    (
      "boundRequirementId" IS NULL
      AND "createPayload" IS NULL
    )
    OR (
      "boundRequirementId" IS NOT NULL
      AND "createPayload" IS NOT NULL
      AND jsonb_typeof("createPayload") = 'object'
      AND "createPayload" ->> 'operation' = 'CREATE_SALES_HANDOFF'
      AND "createPayload" ->> 'projectId' = "projectId"
      AND "createPayload" ->> 'requirementId' = "boundRequirementId"
      AND "createPayload" ->> 'selectionRunId' = "boundSelectionRunId"
      AND "createPayload" ->> 'summary' = "summary"
      AND ("createPayload" ->> 'budgetConcern')
          IS NOT DISTINCT FROM "budgetConcern"
    )
  );

CREATE UNIQUE INDEX "one_sales_handoff_per_bound_context"
  ON "sales_handoff"
     ("projectId", "boundRequirementId", "boundSelectionRunId");

ALTER TABLE "sales_handoff"
  ADD CONSTRAINT "sales_handoff_requirement_project_fkey"
  FOREIGN KEY ("boundRequirementId", "requirementProjectId")
  REFERENCES "building_requirement" ("id", "projectId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "sales_handoff"
  ADD CONSTRAINT "sales_handoff_selection_requirement_project_fkey"
  FOREIGN KEY (
    "boundSelectionRunId",
    "selectionRunProjectId",
    "selectionRunRequirementId"
  )
  REFERENCES "selection_run" ("id", "projectId", "requirementId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "sales_handoff"
  ADD CONSTRAINT "sales_handoff_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "user" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
```

nullable exact-context unique 中的多个 NULL 不被解释为可创建多个新 legacy row。
Contract 后 INSERT Trigger 禁止新 NULL；旧 unique 在 Contract 前保证每项目最多
一个旧 row。

### 9.5 SalesFollowUpNote Prisma 与约束

```prisma
model SalesFollowUpNote {
  id              String   @id @default(cuid())
  handoffId       String
  authorUserId    String
  contactStatus   String   @db.VarChar(80)
  note            String   @db.Text
  createdAt       DateTime @default(now()) @db.Timestamptz(6)

  requestKey      String?  @db.VarChar(128)
  operationType   String?  @db.VarChar(64)
  protocolVersion Int?
  requestPayload  Json?
  statusAfter     SalesHandoffStatus?

  handoff SalesHandoff @relation(
    fields: [handoffId],
    references: [id],
    onDelete: Restrict,
    onUpdate: Cascade
  )
  author User @relation(
    fields: [authorUserId],
    references: [id],
    onDelete: Restrict,
    onUpdate: Cascade
  )

  @@unique(
    [authorUserId, operationType, requestKey],
    map: "sales_follow_up_note_actor_operation_request_key"
  )
  @@index([handoffId, createdAt])
  @@map("sales_follow_up_note")
}
```

数据库 CHECK：

```sql
CREATE UNIQUE INDEX "sales_follow_up_note_actor_operation_request_key"
  ON "sales_follow_up_note" ("authorUserId", "operationType", "requestKey");

ALTER TABLE "sales_follow_up_note"
  ADD CONSTRAINT "sales_follow_up_note_idempotency_all_or_none_check"
  CHECK (
    num_nonnulls(
      "requestKey",
      "operationType",
      "protocolVersion",
      "requestPayload",
      "statusAfter"
    ) IN (0, 5)
  );

ALTER TABLE "sales_follow_up_note"
  ADD CONSTRAINT "sales_follow_up_note_protocol_check"
  CHECK (
    "requestKey" IS NULL OR (
      "protocolVersion" = 2
      AND "operationType" = 'SALES_FOLLOW_UP_NOTE'
      AND "requestKey" ~ '^[A-Za-z0-9_-]{16,128}$'
      AND jsonb_typeof("requestPayload") = 'object'
      AND "requestPayload" ->> 'handoffId' = "handoffId"
      AND "requestPayload" ->> 'status' = "statusAfter"::text
      AND "requestPayload" ->> 'contactStatus' = "contactStatus"
      AND "requestPayload" ->> 'note' = "note"
    )
  );
```

`requestPayload->>'projectId'` 通过命令函数写入时的 handoff Project 权威值构造；
Trigger 再验证 handoff 归属和状态。历史 note 的五项保持 NULL，不伪造历史 key。

### 9.6 身份不可变 Trigger

为防止现有 `ON UPDATE CASCADE` 被异常主键更新触发，增加：

| Trigger 目标 | 规则 |
|---|---|
| `sales_handoff_context_insert_guard` | BEFORE INSERT；禁止普通新全 NULL；五字段必须完整；createPayload 合法；调用 DB current resolver 证明 binding 等于当前需求/当前 COMPLETED run |
| `building_requirement_identity_guard` | 拒绝 UPDATE/DELETE；若业务未来需要编辑，必须追加新 version |
| `selection_run_identity_guard` | 拒绝修改 id/projectId/requirementId/requirementProjectId/createdById 和 DELETE |
| `sales_handoff_immutable_guard` | 拒绝身份/绑定修改；拒绝 legacy/CLOSED 修改；bound OPEN 的业务 UPDATE 必须重新通过 DB current resolver；拒绝 DELETE |
| `sales_follow_up_note_context_guard` | BEFORE INSERT；锁 parent；验证完整绑定、not CLOSED、payload Project 一致，并重新通过 DB current resolver |
| `sales_follow_up_note_append_only` | 拒绝 UPDATE/DELETE |

以上 Trigger 只阻止 DML，不能替代角色 ACL。它们仍需要真实 PostgreSQL 行为测试。
note Trigger 还必须验证 new note 的五项幂等字段完整，且
`requestPayload->>'projectId'` 等于 parent handoff.projectId。

### 9.7 Prisma/Migration/Catalog 交叉核对

未来实施必须：

1. `pnpm db:validate`、`pnpm db:generate`；
2. 在隔离库应用 Expand/Contract；
3. 查询 `pg_constraint`、`pg_indexes`、`pg_attribute`、`pg_trigger`、`pg_proc`；
4. 比较 Prisma relation、Migration SQL、实际 FK action 和可空性；
5. `prisma migrate diff` 不得出现未解释的 FK drop/recreate；
6. Trigger/Function 不在 Prisma Schema 中建模，必须单独 Catalog 对比；
7. 任何额外/缺失约束停止验证，不能以 `db push` 或修改历史 Migration 修复。

本报告不宣称以上任何命令已经执行。

## 10. P2：open-context 创建完整幂等

### 10.1 createPayload

新 bound SalesHandoff 增加：

```text
createPayload Json NOT NULL
```

canonical payload：

```json
{
  "operation": "CREATE_SALES_HANDOFF",
  "projectId": "...",
  "requirementId": "...",
  "selectionRunId": "...",
  "summary": "...",
  "budgetConcern": "..."
}
```

payload 由服务端根据锁内 context 和已校验请求构造。

### 10.2 规则

| 现有状态 | 重复创建结果 |
|---|---|
| 无 exact context | 锁 Project，创建 bound handoff，201 |
| 同 context，OPEN，canonical payload 相同 | 返回既有 handoff，200，`replayed=true`，不改任何字段 |
| 同 context，OPEN，payload 不同 | 409 `SALES_HANDOFF_CONTEXT_EXISTS`，不更新 summary/budget |
| 同 context，CLOSED | 409 `SALES_HANDOFF_CLOSED`，不改变 status/updatedAt/内容 |
| legacy 全 NULL | 不能被视为同 exact context；保留历史，另建新 bound handoff |
| 两个并发同 context 同 payload | 一个插入，另一个根据唯一冲突重读并 replay |
| 两个并发同 context 异 payload | 一个插入，另一个 409 |

若业务需要修改 OPEN handoff 的 summary/budget，必须另行设计显式 PATCH 命令、
expectedVersion/CAS 和审计；重复 create 不再隐式 upsert。

exact context unique：

```text
one_sales_handoff_per_bound_context
  (projectId, boundRequirementId, boundSelectionRunId)
```

约束与应用层幂等共同工作：

```text
Project lock -> 减少可控竞争
exact unique -> 并发最终防线
createPayload -> 相同/不同请求判定
```

## 11. P2：note 请求级幂等

### 11.1 Schema

在 SalesFollowUpNote 增加：

```text
requestKey          String? @db.VarChar(128)
operationType       String? @db.VarChar(64)
protocolVersion     Int?
requestPayload      Json?
statusAfter         SalesHandoffStatus?
```

现有历史 note 的这些字段全部为 NULL。新写入必须完整。

唯一约束：

```text
(authorUserId, operationType, requestKey)
```

即使不同 handoff，同一 actor 也不能复用相同 operation/requestKey。

CHECK：

```sql
CHECK (
  num_nonnulls(
    "requestKey",
    "operationType",
    "protocolVersion",
    "requestPayload",
    "statusAfter"
  ) IN (0, 5)
);

CHECK (
  "requestPayload" IS NULL
  OR jsonb_typeof("requestPayload") = 'object'
);
```

新插入 Trigger 要求五项全部非 NULL。历史 NULL 行只读保留，不伪造 requestKey。

### 11.2 payload 和响应

canonical request payload：

```json
{
  "operation": "SALES_FOLLOW_UP_NOTE",
  "projectId": "...",
  "handoffId": "...",
  "status": "IN_FOLLOW_UP",
  "contactStatus": "...",
  "note": "..."
}
```

幂等键：

- 由 Web 客户端为一次用户提交生成 UUID；重试必须复用；
- 服务端不接受空/超长/非 ASCII key；
- 同一 key 同 payload：返回第一次 note ID、statusAfter 和 `replayed=true`；
- 同一 key 不同 payload：409 `IDEMPOTENCY_KEY_REUSED`；
- 并发同 key：Project lock 串行；跨 handoff 竞争由唯一约束裁决；
- 数据库 `40001/40P01/P2034` 整事务重试仍使用同一 key；
- COMMIT 成功但响应丢失：客户端重发同 key，读取既有 note 返回 replay；
- 首次成功返回 201；replay 返回 200。

如果原请求成功后 handoff 才进入 CLOSED，同 key 同 payload 的重放只返回既有结果，
不新增 note；新 key 或不同 payload 仍因 CLOSED/幂等冲突被拒绝。

### 11.3 保留与清理

幂等事实绑定在不可变 note 行上，note 和 key 与审计历史同寿命。当前不提供单独
清理。未来若改变 note/Audit 保留期限，必须另行设计全链路保留和幂等窗口，不得在
note 仍存在时清除 key。

## 12. P2：数据库级销售项目过滤

### 12.1 查询准入

新增只读查询函数/仓储：

```text
listSalesHandoffsForActor(actorUserId, search, page, pageSize)
```

数据库在同一 filtered CTE 中检查：

```sql
EXISTS (
  SELECT 1
  FROM user_role ur
  JOIN role_permission rp ON rp."roleId" = ur."roleId"
  JOIN role r ON r.id = ur."roleId"
  WHERE ur."userId" = :actorUserId
    AND rp."permissionCode" = 'sales.manage'
    AND (
      ur.scope = 'GLOBAL'
      OR (ur.scope = 'PROJECT' AND ur."projectId" = h."projectId")
    )
)
```

具体列名实施时按当前 Schema 校验，但语义不可降低。

### 12.2 查询边界

- 全局 `SALES_MANAGE`：允许无 project 限制的 filtered CTE；
- 项目范围：每个 handoff、note、requirement、selection run 只在同一授权项目；
- 搜索条件只能加在 filtered CTE 内；
- 分页、排序、`COUNT(*)`、首页统计、导出均复用同一 WHERE；
- 分页 rows 与 total 在同一数据库 snapshot/事务读取；
- 详情参数先由 handoff ID 定位 project，再在数据库重新检查 `SALES_MANAGE`；
- 无权项目列表返回空/403，直接 handoff ID 返回统一 403/404，不泄露摘要；
- RSC/props/API payload 不得包含被数据库过滤掉的记录；
- 禁止 `listSalesHandoffs()` 全量读取后在应用内存 filter。

## 13. 事务、锁和错误语义

### 13.1 写入事务

所有业务写使用 `READ COMMITTED`：

```text
BEGIN
Project FOR UPDATE
读取 requirements/runs/handoff
业务和权限校验
写入状态/note/revision/Audit
COMMIT
```

Project 锁必须在权威业务读取之前。页面的 RepeatableRead 只用于快照读取，不用于
写入决策。

### 13.2 锁顺序

固定：

```text
Project
-> AdvisorConversation（如适用）
-> BuildingRequirement / SelectionRun
-> SalesHandoff
-> SalesFollowUpNote
```

函数和 service 不得反向锁。note Trigger 的 parent row lock 与 Project lock 组合
必须由真实双连接测试验证，不能只做代码推演。

### 13.3 写入入口覆盖矩阵

| 入口 | Project 锁位置 | 权威读取 | 写入 |
|---|---|---|---|
| Requirement PATCH | 事务第一条语句 | latest requirement | BR/Revision/Audit |
| Requirement confirm | 事务第一条语句 | latest requirement | BR/Revision/Audit |
| Advisor start | 事务第一条语句 | latest/no requirement | Conversation/BR/Revision/Message/Audit |
| Advisor message | 写阶段第一条语句 | latest requirement + conversation | Message/BR/Revision/Audit |
| SelectionRun create | 事务第一条语句 | latest requirement | SelectionRun/Recommendation/Audit |
| SalesHandoff create command | 函数内第一条业务语句 | latest requirement + all runs | SalesHandoff/Audit |
| Sales follow-up v2 command | 函数内第一条业务语句 | latest requirement + all runs + exact binding | SalesHandoff/Note/Audit |
| Worker/background sales writes | 禁止 | N/A | 无当前路径；发现即阻断 |

### 13.4 错误分类

| 分类 | 结果 |
|---|---|
| Project 不存在 | 404 |
| 权限不足 | 403 |
| expectedVersion 冲突 | 409，不写 |
| current SelectionRun 不唯一/未完成 | 409 |
| CLOSED | 409 |
| idempotency key 重用不同 payload | 409 |
| Trigger/ACL 拒绝 | 403/409/安全错误，不泄露内部细节 |
| 40001/40P01/P2034 | 整事务有界重试，最多 3 次 |
| 重试耗尽 | 稳定 409/503，不写部分状态 |

### 13.5 页面快照

页面读取使用短 `RepeatableRead` 事务，并通过同一事务 client 读取：

```text
latest requirement
完整 project SelectionRuns
authorized SalesHandoff DTO
notes（若该 DTO 包含）
```

数据库销售读取函数内部也只做查询，不开始嵌套写事务。页面快照可短暂落后，但任何
写命令必须在 ReadCommitted 下重新锁 Project 并重新判断 current context；旧页面
提交必须得到 409，不能根据 HTML 中的 context 直接写库。

## 14. 双连接并发测试矩阵

所有测试使用独立 A/B 连接、第三个 Observer 连接、独立 backend PID、显式
application_name、真实 barrier 和最终数据库断言。

| ID | A | B | 预期 |
|---|---|---|---|
| `CC-REQ-01` | 锁 Project，读取 R1，PATCH 楼层 | 等待 Project，expectedVersion=R1 | A 成功；B 读取 R2 后 409；无覆盖 |
| `CC-REQ-02` | PATCH 楼层 | PATCH 预算，同一 R1 | 一个成功，另一个 409；不同字段也不静默合并 |
| `CC-ADV-01` | 锁 Project 写顾问消息 | 锁 Project 写另一消息 | 一个成功；另一个版本冲突，无孤儿消息 |
| `CC-RUN-01` | 创建新需求 | 创建 SelectionRun | Project 串行；旧 selection 不成为当前 |
| `CC-HAND-01` | 创建 handoff context C | 创建 C 同 payload | 一条记录，第二个 replay |
| `CC-HAND-02` | 创建 C payload P1 | 创建 C payload P2 | 一个插入，另一个 409 |
| `CC-NOTE-01` | 新 note key K | 同 handoff 同 K 同 payload | 一条 note，一个 201，一个 200 |
| `CC-NOTE-02` | 新 note key K | 另一 handoff/不同 payload 同 K | 唯一约束裁决，不同 payload 409 |
| `CC-NOTE-03` | note | 关闭 handoff | Project 串行；关闭后 note 被拒绝 |
| `CC-ROLE-01` | 旧角色已 NOLOGIN | 旧凭据连接/旧 notes | 认证失败；不能写 |
| `CC-ACL-01` | v2 Web 角色直接 UPDATE/INSERT sales 表 | 尝试 `UPDATE sales_handoff` / `INSERT note` | 42501；命令函数仍是唯一写入口 |
| `CC-RESOLVER-01` | DB resolver fixture | TS `resolveCurrentSelectionRun()` 同 fixture | 两种实现结果逐项相等；不一致即阻断 |
| `CC-SCOPE-01` | 项目范围销售列表 | 另一项目请求 | SQL 不读取未授权项目 |
| `CC-RETRY-01` | 40001/40P01/P2034 | 竞争事务 | 只重试可重试错误，最多 3 次 |
| `CC-RETRY-02` | COMMIT 成功但响应丢失 | 同 idempotency key 重发 | 既有 note/status 返回，不重复 |

Observer 记录：

```text
pg_backend_pid()
application_name
pg_stat_activity.state / wait_event_type / wait_event / xact_start
pg_locks.locktype / mode / granted / relation
barrier ready/release timestamps
SQLSTATE / Prisma code / retry count
commit/rollback
final row counts and binding IDs
```

只有两个连接确实进入同一 Project/row 竞争窗口，测试才成立。单纯同时启动两个
Promise 不算并发证据。

## 15. P2：E2E 数据断言矩阵

E2E/隔离集成测试必须从测试数据库只读 observer 或受控测试 API 断言：

| 场景 | 必须断言的实体事实 |
|---|---|
| 创建旧需求和旧方案 | R1.id/version/projectId；S1.projectId/requirementId/status=COMPLETED |
| 创建旧 handoff H1 | H1.projectId/R1.id/S1.id; three binding columns exact |
| 创建新需求 R2 | R2.version > R1.version; latest by version |
| 新需求无 S2 | current selection null; H1 contextState=HISTORICAL |
| 旧 handoff 推进 | API 409；H1.status 和 note count before=after |
| 创建 S2/R3 context | S2.project/requirement/status；H2 exact binding |
| 旧 H1 不恢复 | H1 remains historical; H2 actionable |
| 旧 notes API | 410/426；旧角色不能执行 v2 function；note count unchanged |
| 两个并发 PATCH | 一个 200、一个 409；R newest fields 保留赢家；只有一个新 revision |
| note 幂等 | 同 key 同 payload only one note；异 payload 409 |
| 跨项目 handoff ID | 403/404；DB observer confirms no note/status change |
| 无 SALES_MANAGE | 403；API/RSC/DB query no sales payload |

不能只断言页面文案或单个 HTTP 状态码。测试必须检查 binding、status、requirement、
selection 和 note count。

## 16. 分阶段迁移与实施

所有 Schema 变更使用新的 forward-only Prisma Migration，不执行 `prisma db push`，
不编辑已应用历史 Migration。角色、密码、ACL、对象 owner 和函数授权属于受控 DBA
操作，不把登录密码写入 Prisma Migration 或仓库。

### 迁移窗口总览

| 窗口 | DB 状态 | 允许应用 | 旧角色 | 新角色 | 写入 |
|---|---|---|---|---|---|
| Expand | additive nullable/unique/FK | 旧应用 | 可登录 | 可预建但无销售 EXECUTE | 旧单 handoff 语义 |
| Compatibility | 同 Expand | 兼容读取新版本 | 可登录 | 仅 shadow/read-only | 不启用 v2 writes |
| Freeze/Drain | 同 Expand + 写冻结 | 不应有业务请求 | 先 NOLOGIN，后终止会话 | 不接收业务 | 无 |
| Contract | 旧 unique 删除、Trigger 启用 | 无 | NOLOGIN/无会话 | 销售 EXECUTE 尚未启用 | DBA Migration only |
| Resume | Contract 状态 | 仅 v2 | 禁止 | 获最小 EXECUTE | v2 Project-lock commands |
| Cleanup | Contract 状态 | 仅 v2 | 保持禁止 | 最小权限 | v2 only |

### Phase 0 — 只读预检与写入者清单

执行：

- Git 和源码搜索；
- Schema/Migration 只读核对；
- 所有 Web/Worker/Scheduler/脚本/运维入口清单；
- 数据库角色、membership、ACL、会话和连接池清单；
- 旧/新 Build ID、Host、Instance、application_name 证据。

退出：

- 所有旧写入者可枚举；
- 旧角色、Scheduler、自动重启和连接池状态有证据；
- 无法枚举 -> `BLOCKED — SAFE MIGRATION PATH NOT ESTABLISHED`。

回滚：

- 没有数据库/权限变更，保持旧系统。

### Phase A — Schema Expand

实施：

- 新增 SalesHandoff bound 5 columns + createPayload；
- 新增 SelectionRun `requirementProjectId` nullable；
- 新增 note request metadata；
- 新增 supporting unique、exact-context unique、复合 FK/CHECK（可先 NOT VALID）；
- 不删除旧 unique，不启用 v2 sales write command，不启用 Contract Trigger。

退出：

- forward Migration 在隔离库成功；
- Prisma/DB 关系与 SQL 代码审查；
- 旧应用选择字段不受影响；
- 旧 unique 保留；
- 现有行快照/digest 不变；
- 历史 NULL 不填造。

回滚：

- 回退旧应用，保留 additive Expand；
- 任何撤销通过新的 forward Migration，不编辑历史。

### Phase B — Compatibility Build

实施：

- 代码同时读取 legacy/bound；
- v2 写命令 feature flag OFF；
- 旧 notes 路径默认只读；
- 新页面隐藏无 context 操作；
- 所有查询使用数据库级 SALES_MANAGE filter；
- Project 锁需求服务与并发测试可在隔离库运行。

兼容策略：

- 优先只在隔离/shadow 环境验证兼容 build；生产旧实例继续旧协议直到维护窗口。
- 不在生产建立 V1 与 V2 双写入者窗口。
- 若必须把兼容 build 暴露到生产，只允许只读流量，并在入口同时关闭 V1 notes、
  V2 follow-ups 和其他 requirement/selection/sales 写 API；旧实例必须停止。
- 任何无法在数据库层阻止旧写入的“兼容在线写入”方案均不采用。

退出：

- 旧数据和新 nullable 数据均可读；
- 旧写仍只能走旧单 context；
- 没有 v2 note 写入启用；
- 回退旧版本不需要撤销 Expand。

### Phase C — Role/ACL Provisioning

实施：

- 创建 `elevator_owner`、`elevator_web_runtime_v2`、
  `elevator_worker_runtime_v2`、`elevator_sales_definer`；
- 迁移/管理员连接使用独立 DBA；
- 准备并审核 database/schema/目标表/sequence/function owner 迁移，但在兼容窗口
  仍允许旧应用写入时不得提前移除旧角色所需权限；
- 新 Web 角色不能直接读取销售表，只能 EXECUTE 已授权的销售查询/命令函数；
- Trigger/Function Owner 设为 NOLOGIN；
- 撤销 PUBLIC EXECUTE、schema/table owner、DDL/TRUNCATE；
- v2 销售命令函数的 Web EXECUTE 在 Contract 完成前保持撤销；
- 不把密码或连接串写入仓库。

退出：

- Catalog ACL 证明，包括 `pg_database.datdba`、`pg_namespace.nspowner`、
  `pg_class.relowner`、`pg_proc.proowner`；
- `has_table_privilege('elevator_web_runtime_v2', 'sales_handoff',
  'INSERT')`、`... 'UPDATE'`、`... 'DELETE'` 全部为 false；
- Web 对销售表无直接 DML；批准销售函数的 EXECUTE 在 Contract 前保持撤销；
- 旧角色不能 SET ROLE 到新角色；
- 新角色不能禁用 Trigger；
- 新角色无销售表直接 DML；
- 旧角色仍可在维护窗口外继续运行，但不得被新版本使用。

### Phase D — Freeze / Drain / Role Cutover

顺序：

1. 冻结 sales/requirement/selection 写入口；
2. 停止旧 Web、Worker、Scheduler、Watchdog、任务器和连接池；
3. 关闭自动扩缩容、自动重启和旧网络入口；
4. 先 `ALTER ROLE elevator_app NOLOGIN` 或撤销 CONNECT，阻止新认证；
5. 再终止旧 `elevator_app` 的所有 backend；
6. 将 database/schema/目标表/sequence/function owner 迁到批准的 NOLOGIN 角色；
7. 调整新角色、函数和表 ACL，保持 v2 销售 EXECUTE 仍撤销；
8. 验证旧角色零会话且不能重连；
9. 记录实例、Host、Process、backend PID、role、证据时间；
10. 备份数据库/snapshot 和恢复点。

退出：

- Contract 硬门禁全部通过；
- 无法证明 -> 停止，Contract 不得执行。

回滚：

- Contract 前：恢复旧服务并重新启用旧角色，保留 Expand；
- 一旦旧角色权限被撤销但 Contract 尚未开始，必须确认旧版本恢复所需的完整凭据/
  角色权限。
- 密码/Secret 的最终撤销发生在 v2 Resume canary 之后；在此之前只有在明确失败
  回滚方案中才重新启用旧角色，且旧连接仍必须重新认证。
- 若 owner/ACL 迁移已完成但 Contract 未提交，回滚必须恢复迁移前记录的 owner 和
  grant 状态，再重新启用旧角色；不能只改 NOLOGIN。

### Phase E — Contract

只允许 DBA/迁移身份执行：

1. 校验所有历史 SelectionRun 的 requirementProjectId；
2. 增加并验证 SelectionRun 复合 FK/CHECK，设 NOT NULL；
3. 删除旧单列 SelectionRun requirement FK；
4. 增加 SalesHandoff 复合 FK/CHECK/exact unique；
5. 增加 note 幂等 unique/CHECK；
6. 删除 `sales_handoff_projectId_key`；
7. 启用 sales handoff/note 四个 Trigger；
8. 启用身份不可变 Trigger；
9. 执行 catalog、ACL、负向 DML 和 postcheck；
10. 只允许 v2 Web 角色执行销售命令。

失败：

- 事务任何一步失败 -> 整事务回滚，旧 unique/旧应用保留；
- Contract 已提交但 v2 应用失败 -> 保持冻结，forward-fix；回旧版本需恢复已验证
  snapshot，并明确 RPO/RTO。

### Phase F — Resume

1. 启动 v2 Web/Worker；
2. 确认连接角色、Build ID、application_name；
3. v2 exact-context/notes canary；
4. 断言旧角色无会话、旧 API 410、旧 unique 不存在；
5. 解除写冻结；
6. 监控旧 role 连接尝试和 42P01/42P10/权限错误。

若任一 canary 失败，保持冻结并 forward-fix。

### Phase G — Cleanup

- 保留旧数据、projectId 和五个绑定字段；
- 不删除历史 note/audit；
- 清理旧兼容 flag、旧 URL 和旧角色凭据；
- 旧角色 NOLOGIN 记录保留为审计证据；
- 任何删除历史数据的操作不在本设计范围。

## 17. 回滚边界

| 已进入阶段 | 旧应用可用 | 回滚方式 |
|---|---|---|
| Expand | 是 | 回旧版本，保留 additive schema |
| Compatibility | 是 | 回 feature flag，旧数据可读 |
| Role provisioning | 是，旧角色仍可用 | 回 ACL/角色变更；不要删除 schema |
| Freeze/Drain | 暂停 | 重新启用旧角色、重建旧实例 |
| Contract transaction 失败 | 是 | 整事务回滚 |
| Contract committed | 否 | forward-fix；只有接受数据丢失才恢复 snapshot |
| v2 Resume | 仅 v2 | 不回退到依赖旧 unique 的版本 |

旧 unique 被删除是应用版本兼容性的不可逆边界。`projectId` 字段和旧历史数据本身
不删除。

## 18. 进入独立验证的门槛

未来实施前必须完成：

1. 需求 PATCH/顾问的 Project 锁内合并实现；
2. SelectionRun 复合字段/复合 FK 的 Prisma/Migration 评审；
3. 旧/新 db role、NOLOGIN、CONNECT、对象 owner、表/函数 ACL 评审；
4. v2 sales command 函数及 safe search_path；
5. note 幂等唯一键和历史 NULL 兼容；
6. 数据库级 SALES_MANAGE 过滤；
7. 双连接 requirement、handoff、note、role 测试；
8. E2E 实体断言；
9. 独立安全审查确认旧写入者无法重连。

## 19. 未验证事项

```text
Prisma composite relation expressibility: NOT VERIFIED
PostgreSQL constraint creation:            NOT VERIFIED
Trigger behavior:                         NOT VERIFIED
History backfill:                         NOT VERIFIED
Role/ACL behavior:                        NOT VERIFIED
Old client exclusion:                     NOT VERIFIED
Project lock concurrency:                 NOT VERIFIED
Database-level permission query:          NOT VERIFIED
Note idempotency:                          NOT VERIFIED
E2E:                                       NOT EXECUTED
Browser/RSC payload:                       NOT VERIFIED
Build/startup:                             NOT EXECUTED
```

本报告不能宣称任何 Schema、Migration、ACL、函数或运行时已经就绪。

## 20. Git 状态

调查前：

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked status entries:     147
Untracked recursive files:    158
```

新增本报告后预期：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked status entries:     148
Untracked recursive files:    159
```

无源码、Schema、Migration、测试或配置修改。

## 21. SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
9893c46af917960132f693a8147cc85a54acdc3273396f9e3b27fcd6dfe8e895

Bytes:                    57863
Physical lines:           1581
```

计算方式：将本节 64 位 self-excluding SHA-256 token 替换为 64 个零字符，对
UTF-8 文件字节计算 SHA-256；文件字节数和物理行数采用最终文件。
