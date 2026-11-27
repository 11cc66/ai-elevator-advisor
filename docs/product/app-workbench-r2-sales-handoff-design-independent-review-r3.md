# APP-WORKBENCH-R2 SalesHandoff Design Independent Final Review R3

## 0. 最终结论

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

R3 已正确修正需求锁外合并、旧 notes 方向和数据库复合关系的主要结构，但它仍不满足
本轮明确要求：

1. SECURITY DEFINER 函数没有完整、可执行、可审计的定义；
2. 新 Web 角色的精确权限还不能支撑 Requirement PATCH、确认、顾问和
   SelectionRun 创建；
3. Contract 旧写入者证据未覆盖 PostgreSQL prepared transactions。

因此不能进入完整实施。当前实际 Contract 状态仍必须是 `BLOCKED`。

本报告只读。未修改 R3 设计、源码、Schema、Migration、测试或配置；未执行
Prisma、SQL、PostgreSQL、E2E、Browser、Build、Provider 或服务操作。

## 1. 报告完整性与 Git 基线

| 项目 | 现场结果 | 状态 |
|---|---|---|
| Branch | `codex/public-github-sync` | PASS |
| HEAD | `101e8a362e430f4fa7b31b67c56823cb702eb1e6` | PASS |
| Local origin/main | `101e8a362e430f4fa7b31b67c56823cb702eb1e6` | PASS |
| Tracked modified | 48 | PASS WITH WARNING |
| Staged | 0 | PASS |
| Deleted | 0 | PASS |
| Untracked entries | 148 | PASS WITH WARNING |
| Untracked recursive files | 159 | PASS WITH WARNING |
| R3 设计存在 | 是 | PASS |
| R3 字节数 | 57863 | PASS |
| R3 物理行数 | 1581 | PASS |
| R3 任务给定 SHA-256 | `55f4d9edc968b127291a33df29c1326e48efce0c35bd23989b7de747bfbf922e` | PASS |
| R3 实际 SHA-256 | `55f4d9edc968b127291a33df29c1326e48efce0c35bd23989b7de747bfbf922e` | PASS |
| R2 独立审查存在 | 是 | PASS |
| R2 独立审查 SHA-256 | `ac82b696fa89de305be3ae9bba53c04fc71384ebdd1a17189278f2b15d267a99` | PASS |
| 本轮审查开始前 R3 审查文件 | 不存在 | PASS |

工作区仍包含大量既有 tracked/untracked 用户工作。本报告没有把整个工作区归因于
R3 设计或本轮审查。

## 2. 检查文件与调用点

### 2.1 报告与规则

```text
AGENTS.md
docs/product/app-workbench-r2-sales-handoff-invalidation-design-r3.md
docs/product/app-workbench-r2-sales-handoff-invalidation-design-r2.md
docs/product/app-workbench-r2-sales-handoff-design-independent-review-r2.md
.agents/skills/prisma-db-safety/SKILL.md
.agents/skills/prisma-db-safety/references/database-change-review.md
.agents/skills/security-audit/SKILL.md
.agents/skills/security-audit/references/adversarial-review.md
.agents/skills/testing-and-verification/SKILL.md
.agents/skills/testing-and-verification/references/verification-matrix.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

### 2.2 Schema、Migration、服务和 API

```text
prisma/schema.prisma
prisma/migrations/20261123130000_full_mvp_domain/migration.sql
apps/web/src/modules/mvp/store.ts
apps/web/src/modules/selection/service.ts
apps/web/src/modules/advisor/service.ts
apps/web/src/modules/workbench/selection-consistency.ts
apps/web/src/modules/access/permissions.ts
apps/web/src/modules/access/policy.ts
apps/web/src/app/api/projects/[projectId]/requirements/route.ts
apps/web/src/app/api/projects/[projectId]/requirements/confirm/route.ts
apps/web/src/app/api/projects/[projectId]/selection-runs/route.ts
apps/web/src/app/api/projects/[projectId]/sales-handoff/route.ts
apps/web/src/app/api/admin/sales/route.ts
apps/web/src/app/api/admin/sales/[handoffId]/notes/route.ts
apps/web/src/app/admin/sales/page.tsx
apps/web/src/app/admin/sales/follow-up-form.tsx
packages/contracts/src/index.ts
```

### 2.3 测试

```text
apps/web/tests/selection-consistency.test.ts
apps/web/tests/workbench-presentation.test.ts
apps/web/tests/workbench-visibility.test.ts
apps/web/tests/e2e/mvp-catalog-sales.spec.ts
```

搜索排除了 `.next` 与 `dist`。当前 Worker 未发现销售或 SelectionRun 写入入口。

## 3. 结论矩阵

| 审查项 | 结论 | 说明 |
|---|---|---|
| R3 报告 SHA/大小 | PASS | 与任务给定值一致 |
| Requirement PATCH/顾问锁设计 | PASS BY DESIGN | R3 已改为锁内读取、merge 和 expectedVersion |
| 所有核心写入权限可实施性 | FAIL | Web 角色缺 Requirement/Revision/SelectionRun 等明确 INSERT 能力 |
| 旧角色 NOLOGIN/会话终止方向 | PASS BY DESIGN | 方向正确，但 Contract 证据仍漏 prepared transactions |
| SECURITY DEFINER 完整定义 | FAIL | 只有函数名、参数概念和伪流程，没有实际函数 DDL/返回类型/NULL 规则/异常处理 |
| SECURITY DEFINER 权限矩阵 | FAIL | definer 的精确表/函数/sequence 权限未定义，缺少绕过测试 |
| Project 锁覆盖矩阵 | PASS BY DESIGN | Requirement、顾问、SelectionRun、Handoff、notes 均列入；尚未实现/测试 |
| 当前 resolver 单一权威 | PARTIAL | 写入用 DB resolver，界面仍用 TS resolver；时间精度可能分叉 |
| SelectionRun 同项目复合 FK | PASS BY DESIGN | 字段、复合 FK、CHECK、历史停止条件均已给出 |
| Prisma/SQL action 对齐 | PARTIAL | action 已被明确，但实际 Prisma/Migration/Catalog 未验证 |
| note 幂等数据库唯一性 | PASS BY DESIGN | `(actor, operation, requestKey)` + payload 结构完整 |
| note 函数冲突处理 | PARTIAL | 未定义唯一冲突后的 subtransaction/重读实现 |
| 销售数据库范围过滤 | PASS BY DESIGN | 通过授权函数和 filtered CTE；函数体未实现 |
| 分页稳定性 | PARTIAL | 没有稳定 tie-break、pageSize 上限和 total 一致性细节 |
| 并发测试矩阵 | PARTIAL | 有主要场景，但缺 SECURITY DEFINER/权限绕过和若干跨流程场景 |
| E2E 实体断言设计 | PASS BY DESIGN | 已列出 binding、status、note count 等；尚未实现 |
| 授权边界 | PASS | 本轮未修改源码、Schema、Migration、测试或配置 |

## 4. P1 问题

### P1-1 — SECURITY DEFINER 函数没有完整可执行定义，不能证明不存在权限绕过

R3 在第 459-514 行只列出了以下函数名称、概念参数和返回值意图：

```text
app_sales_create_handoff_v2
app_append_sales_followup_v2
app_list_sales_handoffs_v2
app_get_sales_handoff_context_v2
app_resolve_current_completed_selection_v2
```

静态检查 R3：

```text
CREATE FUNCTION / CREATE OR REPLACE FUNCTION: 0
STRICT:                                        0
NULL/default parameter rules:                  0
prosecdef / proconfig / proacl checks in tests: 0
```

R3 没有给出：

- 每个参数的精确 PostgreSQL 类型、默认值、是否允许 NULL；
- 精确 `RETURNS TABLE` 字段、类型和稳定排序；
- 完整函数体、变量、异常分支和 SQLSTATE；
- `STRICT` 或等价 NULL 显式拒绝；
- `ON CONFLICT` / `EXCEPTION` / `SAVEPOINT` 后重新读取既有记录的实现；
- actor/project/handoff/run 的 NULL、空字符串、跨项目组合校验；
- `app_resolve_current_completed_selection_v2` 的精确 SQL；
- `elevator_sales_definer` 的可执行表权限、sequence 权限和 RBAC 读取权限；
- 函数 owner 是否可 DDL、TRUNCATE、SET ROLE 或执行低级函数；
- 函数创建时的 exact `proconfig`（search_path）和 `prosecdef=true` 证据。

使用 `SET search_path = pg_catalog` 和完全限定名称是正确方向，但仅靠方向不能证明
实际函数不可被临时 schema、NULL 参数、默认参数、重载或低级函数绕过。

本轮审查任务明确规定：如果 SECURITY DEFINER 函数没有完整定义或权限模型无法证明
安全，必须列为阻断项。因此这是 P1，不是“未来 Prisma/SQL 测试事项”。

必须修正：

1. 给出每个函数的完整签名、返回类型、owner、ACL、`STRICT`/NULL 规则和异常表；
2. 给出可逐行审查的 SQL/PLpgSQL 函数体；
3. definer 仅获得完成命令所需的 SELECT/INSERT/UPDATE 权限，没有 DDL、
   TRUNCATE、对象 owner、SUPERUSER、CREATEROLE 或任意函数 EXECUTE；
4. 对唯一冲突使用明确 subtransaction/exception 或 `ON CONFLICT` 后重读；
5. 补充函数级 ACL、search_path、NULL 参数、重载、低级函数、replace-function
   和 PUBLIC EXECUTE 的测试矩阵；
6. 证明普通 Web 角色不能直接 EXECUTE 内部 resolver 或其他低级函数。

### P1-2 — Web 新角色权限矩阵没有覆盖 Requirement/Revision/SelectionRun 写入

R3 第 360-376 行给 `elevator_web_runtime_v2` 的主要映射是：

```text
SELECT project, building_requirement, selection_run, 必要的 RBAC 表
EXECUTE sales command/read functions
禁止 sales table DML
```

但锁协议要求 Web 仍执行：

```text
Requirement PATCH
Requirement confirm
Advisor conversation/message + requirement revision
SelectionRun + SelectionRecommendation
AuditLog
```

当前代码实际写入：

```text
apps/web/src/app/api/projects/[projectId]/requirements/route.ts:48,68
apps/web/src/modules/advisor/service.ts:43,52,82,88,115,124
apps/web/src/modules/mvp/store.ts:281,305,809,819
```

R3 只写“若仍需 Web DML，必须使用最小表级权限”，但没有决定实现方式、列级/表级
授权、sequence 权限或 AuditLog 权限。设计不能一边声称最小权限，一边把关键写入
留给未来决定。

此外，`elevator_sales_definer` 的精确表权限也未定义：

```text
SELECT user/user_role/role_permission/project/requirement/selection/handoff/note
INSERT sales_handoff / note / audit_log
UPDATE sales_handoff
是否需要 sequence 权限
是否禁止 DDL/TRUNCATE/owner
```

必须修正：

- 明确提出使用 Web 事务和直接表 DML，还是使用全部受控命令函数；
- 若用直接 DML，逐个授予 `building_requirement`、`requirement_revision`、
  `selection_run`、`selection_recommendation`、`advisor_message`、
  `advisor_conversation` 和 `audit_log` 的最小列/表权限；
- 若用命令函数，给 requirement/selection 也设计相等的 SECURITY DEFINER 边界；
- 逐个验证旧角色、Web、Worker、definer、DBA 不能通过其他表或函数写入销售状态。

在权限矩阵闭合前，R3 不可作为可实施设计。

### P1-3 — Contract 证据没有覆盖 prepared transactions

R3 第 315-329 行要求检查 `pg_roles`、`pg_stat_activity` 和
`pg_auth_members`，第 338-344 行要求旧角色 NOLOGIN、backend 终止和角色隔离。
这仍不是完整的 PostgreSQL 写入者排除证明：

- `pg_stat_activity` 不列出 prepared transaction；
- `pg_terminate_backend` 不能回滚或提交已经 prepared 的事务；
- 旧角色 NOLOGIN 只阻止其新 session，不自动使已 prepare 的事务消失；
- 如果 `max_prepared_transactions > 0`，旧的 2PC 事务可能在 session 终止后仍
  存在，之后被高权限维护路径提交；
- R3 没有要求 `pg_prepared_xacts` 为零，也没有定义如何对未知 prepared xact
  Fail Closed。

这使“所有 backend 已终止”不能等价于“旧写入者不再可能造成提交”。

必须修正 Contract 门禁：

```sql
SELECT gid, prepared, owner, database
FROM pg_prepared_xacts
WHERE database = current_database();
```

要求：

1. 目标数据库 prepared xacts 为 0；或
2. 对每一项完成来源、owner、GID、锁和业务影响审查；
3. 未经明确审批不得 `COMMIT PREPARED`；
4. 无法归属时 `ROLLBACK PREPARED` 或保持 Contract BLOCKED；
5. 同时验证 `max_prepared_transactions`、连接池、连接池外部 session 和其他
   database 上的旧角色/成员连接；
6. 所有检查使用目标 `datname`、login role、成员递归和 backend PID 证据，不能
   仅用活动 session 快照。

该问题不是“运行后再测”：当前 Contract 门禁本身不完整。

## 5. SECURITY DEFINER 逐函数审查

| 函数 | 设计意图 | 状态 | 缺口 |
|---|---|---|---|
| `app_sales_create_handoff_v2` | lock Project、RBAC、DB resolver、exact unique、payload replay | FAIL | 无完整函数体、精确返回类型、NULL 规则、唯一冲突处理、definer ACL |
| `app_append_sales_followup_v2` | lock Project、RBAC、context、idempotency、note/status/audit | FAIL | 无函数体、异常事务处理、idempotency 冲突回读、参数校验、触发器顺序证明 |
| `app_list_sales_handoffs_v2` | 数据库级 SALES_MANAGE 过滤、分页、notes | FAIL | 无 SQL、稳定排序、pageSize 上限、total 同快照实现 |
| `app_get_sales_handoff_context_v2` | 单 handoff 授权和 context DTO | FAIL | 无完整签名、403/404 行为 SQL、binding 选择、notes 限制 |
| `app_resolve_current_completed_selection_v2` | 唯一 current resolver | FAIL | 无 SQL；与 TS 的毫秒/微秒语义未统一 |
| `elevator_sales_definer` 权限 | 仅执行函数，不暴露 owner | PARTIAL | 只给了概念权限，没有 `GRANT/REVOKE` 清单、对象 owner、sequence 和默认权限证明 |

函数公开点：

```text
PUBLIC EXECUTE:
  R3 要求 revoke，但未给出每个函数实际 proacl 验证。

应用 EXECUTE:
  R3 只列出函数名，没有精确 GRANT 的 schema 和签名。

内部 resolver:
  R3 说“不给 Web EXECUTE”，但没有列出低级函数的 ACL 验证测试。
```

禁止动态 SQL 是正确方向，但它无法补偿函数体、参数和 ACL 缺失。

## 6. 数据库角色与权限矩阵审查

| 角色/写入者 | 设计事实 | 判定 |
|---|---|---|
| 旧 `elevator_app` | Contract 后 NOLOGIN、会话终止、凭据失效 | PASS by design；实际未验证 |
| 新 Web `elevator_web_runtime_v2` | 读取部分业务表、执行销售函数 | PARTIAL：缺 Requirement/Revision/Selection 的最小写入权限 |
| Worker `elevator_worker_runtime_v2` | 无销售写入/无 v2 sales EXECUTE | PASS by design；实际未验证 |
| `elevator_sales_definer` | NOLOGIN、函数 owner | PARTIAL：未定义精确 DML、sequence、RBAC 读权限 |
| `elevator_owner` | NOLOGIN 对象 owner | PASS by design；实际 owner transfer 未执行 |
| DBA/迁移 | 独立身份 | PASS by design；当前无环境证据 |
| Scheduler/脚本 | 需枚举并停止 | PASS only as hard gate；当前状态 NOT VERIFIED |

### 6.1 旧角色排除结论

方向是 PASS，但不能把当前设计标记为已完成排除：

- `pg_stat_activity` 与 backend 终止不能覆盖 prepared transaction；
- R3 未明确查询所有数据库的 `pg_auth_members` 递归闭包；
- R3 未证明每个外部 Scheduler/连接池使用的 login role；
- R3 的外部 Host/Instance/Build evidence 仍是未来验证。

因此 Contract 仍应为：

```text
BLOCKED — OLD WRITER EXCLUSION NOT PROVEN
```

### 6.2 新角色不能直接读写销售表

R3 对 Web 销售表 `SELECT`/DML 的禁止方向正确。`app_list` 和 `app_get` 通过
`SALES_MANAGE` 查询过滤，方向正确。但函数内部 SQL 和 ACL 未给出，不能标记
PASS。

## 7. Project 锁协议覆盖结果

| 写入入口 | R3 设计 | 现有实现事实 | 判定 |
|---|---|---|---|
| Requirement PATCH | Project 锁内最新读取/合并/expectedVersion | 当前路由在锁外读取并调用无 expectedVersion 的版本追加 | PASS BY DESIGN |
| Requirement confirm | Project 锁内读取/版本检查/追加 | 当前有锁但读取在锁外 | PASS BY DESIGN |
| Advisor start/message | Project 锁事务 | 当前先 appendMessage/读取需求，后创建新版本 | PASS BY DESIGN |
| SelectionRun create | Project 锁内最新需求 | 当前 `store.ts:817` 直接生成，无 Project 锁 | PASS BY DESIGN |
| SalesHandoff create | 函数内 Project 锁和 exact context | 当前 `store.ts:1002-1017` projectId-only upsert | PASS BY DESIGN |
| Follow-up note/status | 函数内 Project 锁和 current resolver | 当前 `store.ts:1107-1127` 按 ID 更新，无 context | PASS BY DESIGN |
| Closed | 关闭状态不可逆 | 当前有 enum 但无 DB trigger | PASS BY DESIGN |
| Worker/后台 | 禁止销售写入 | 未发现销售写入 | PASS BY DESIGN |

设计已解决 R2 的“锁外读取后追加版本”方向。实际代码尚未实现，因此不能标记
IMPLEMENTED/PASS。

### 7.1 当前 resolver 的时间精度风险

R3 第 500-513 行说 DB resolver 与 TS resolver 必须 parity。当前事实：

- PostgreSQL `SelectionRun.createdAt` 是 `Timestamptz(6)`；
- TS `resolveCurrentSelectionRun()` 使用 `Date.getTime()`（毫秒）；
- R3 没有规定 DB resolver 使用何种时间精度；
- 没有规定并列是否按微秒或毫秒判断。

反例：

```text
run-a.createdAt = 12:00:00.123100
run-b.createdAt = 12:00:00.123900
DB 微秒比较 -> run-b 唯一最新
JS Date.getTime() -> 两者都等于 ...123，TS 返回 AMBIGUOUS
```

这会让数据库写函数接受一个结果，而页面 resolver 显示歧义/不可操作，或反向。
R3 的 parity 要求是未来测试，不是已定义的共享语义。

修正建议：

1. DB resolver 明确定义 `date_trunc('milliseconds', createdAt)` 或使用统一的
   `createdAtMs` 字段；
2. TS 和 SQL 使用同一规范化值、同一 tie-break 和同一 invalid 判定；
3. 更优先的方案是让页面从统一数据库 resolver DTO 读取 contextState，不自行
   重算；
4. 增加微秒同一毫秒、事务开始时间不同、时钟回退和并列测试。

这是 P2，但它直接影响“同一权威 resolver”的实现完整性。

## 8. SelectionRun 与数据库完整性

### 8.1 已解决

- 增加 `requirementProjectId`；
- `(id, projectId, requirementId)` 作为 composite FK target；
- `requirementId + requirementProjectId` 指向同项目 Requirement；
- 五字段/复合 FK/CHECK 的 NULL 防逃逸方向正确；
- 历史回填明确“不一致即停止”，不猜测；
- exact-context unique、SalesHandoff binding、legacy 全 NULL 规则明确。

### 8.2 P2 — `assignedToId` 新 FK 缺少历史 orphan 前置检查

R3 第 781、806、883 行要求新增：

```text
sales_handoff_assignedToId_fkey
```

当前 schema 中 `assignedToId` 只是可空普通字段，Migration 没有对应 FK。数据库中
可能已有不存在于 `user.id` 的历史值，R3 没有定义 precheck 或失败语义。

必须增加：

```text
SELECT ...
FROM sales_handoff h
LEFT JOIN user u ON u.id = h.assignedToId
WHERE h.assignedToId IS NOT NULL AND u.id IS NULL;
```

若存在：

- 停止 Migration；
- 不删除、不重写、不猜测用户；
- 由业务/管理员显式修复并审计后才可加 FK。

### 8.3 P2 — Prisma/Migration constraint-name 和 actual Catalog

R3 已给出 constraint names，但仍未说明 Prisma `@relation` 是否显式 map 到这些
名称，以及 `prisma migrate diff` 是否会把手工 FK 识别为 drift。实施前必须
验证：

```text
Prisma Schema relation -> pg_constraint name/action
Migration SQL -> pg_constraint
actual FK -> pg_constraint
actual unique/check/index -> pg_indexes/pg_constraint
```

任何未解释 drift 都阻断。当前只能标记 `NOT VERIFIED`。

## 9. note 幂等与 open-context 幂等

### 9.1 已解决的设计方向

- requestKey 由客户端生成；
- scope 为 actor + operation + key；
- 数据库唯一索引；
- 同 key 同 payload replay；
- 同 key 异 payload 拒绝；
- DB 事务重试复用 key；
- CLOSED 后不新增新 note；
- 历史 NULL note 不伪填；
- open exact context 同 payload replay、异 payload 拒绝、CLOSED 不复活；
- legacy 全 NULL 不匹配 exact context；
- exact unique + createPayload 判定。

### 9.2 P2 — 唯一冲突处理尚未进入函数定义

R3 第 1038-1051 行说唯一冲突后读取既有记录，但没有定义：

- 使用 `INSERT ... ON CONFLICT DO NOTHING RETURNING` 还是
  `EXCEPTION WHEN unique_violation`；
- 冲突发生在子事务内时如何恢复；
- 冲突后重新查询的 `READ COMMITTED` 可见性；
- 并发跨 Project 同 key 时先锁哪个 Project、如何避免等待/死锁；
- 失败唯一插入是否已经回滚 note/status/audit。

在完整命令函数给出前，数据库唯一性是正确的，但应用响应和事务恢复仍是
`PARTIAL`。

## 10. 销售数据范围与权限

R3 的方向正确：

- 数据库查询函数内检查 `sales.manage`；
- 项目 scope 使用 `user_role.scope/projectId`；
- 无权限不返回销售摘要、内部预算、notes；
- 详情按 handoff ID 重新定位并检查项目；
- 禁止 Web 角色直接 SELECT/DML 销售表；
- 搜索/export/stats 要求同一 filtered CTE。

仍缺：

1. 列表 SQL 的精确实现；
2. 稳定 `ORDER BY updatedAt DESC, id DESC`；
3. `pageSize` 上限、offset 边界和 total 同一 snapshot；
4. 函数对 `actorUserId` NULL/不存在/跨项目/role membership 的精确错误；
5. 新角色不能连接其他数据库/测试库的 CONNECT 限制；
6. 函数返回值是否可能泄露无权项目 ID 或 note 计数。

这些是 P2/P3，不是当前 P1 的主要阻断点，但必须在函数和 ACL 设计中补齐。

## 11. 并发与隔离测试审查

### 11.1 已列出

- 双连接 PATCH；
- 顾问消息；
- SelectionRun 创建；
- handoff context 创建；
- note 幂等；
- note 对 CLOSED；
- 旧角色重连；
- 直接 sales 表 DML；
- resolver parity；
- scope 过滤；
- 40001/40P01/P2034；
- commit 丢失重发。

### 11.2 不足

R3 没有明确包含：

- SECURITY DEFINER 的 `prosecdef/proconfig/search_path/proacl` 验证；
- PUBLIC 无 EXECUTE；
- Web/Worker 对内部 resolver 和低级函数无 EXECUTE；
- NULL/默认参数/错误参数调用；
- 函数 owner 的 DDL/TRUNCATE/SET ROLE 权限尝试；
- 同一函数被 replace/alter 的权限尝试；
- 新需求创建与旧 note 状态推进并发；
- SelectionRun 创建与销售 note 推进并发；
- PATCH 与顾问消息并发；
- prepared transaction 在旧角色 NOLOGIN 后的处置；
- 新角色对其他数据库 CONNECT 的拒绝。

测试设计目前是 `PARTIAL`，不能作为 SECURITY DEFINER 和 Contract 的通过证据。

## 12. E2E 断言审查

R3 E2E 矩阵已要求：

- requirement/handoff/selection 的 ID 与 Project；
- binding 三列；
- status/contextState；
- note count；
- 新需求使旧方案失效；
- 新方案创建新 handoff；
- 旧 handoff 不恢复；
- 旧 notes API 拒绝；
- 并发 PATCH；
- note 幂等；
- 跨项目和无权限。

方向 PASS。但仍需补充：

- 旧角色实际连接失败和 v2 函数 EXECUTE 失败；
- 旧 prepared transaction 的最终数据库状态；
- SECURITY DEFINER NULL/ACL/owner 测试；
- pagination/count permission scope；
- Browser/RSC 序列化载荷不含销售字段。

当前 E2E 是设计，不代表已实现或执行。

## 13. 分级问题

### P0

无静态确认的 P0。

### P1

| ID | 问题 | 后果 |
|---|---|---|
| P1-1 | SECURITY DEFINER 函数没有完整 DDL、参数/NULL/异常/冲突处理和 owner ACL | 无法证明不存在绕过或部分写入，违反本轮硬阻断条件 |
| P1-2 | Web 角色未定义 Requirement/Revision/Advisor/SelectionRun/Audit 的实际写权限 | 设计无法以所述最小权限实施；若补宽权限又无法证明安全 |
| P1-3 | Contract 旧写入者证明遗漏 prepared transactions | NOLOGIN 和终止 backend 后仍可能有 2PC 事务存在，准入条件不充分 |

### P2

| ID | 问题 |
|---|---|
| P2-1 | DB resolver 与 TS resolver 的微秒/毫秒语义未统一 |
| P2-2 | assignedTo FK 缺少历史 orphan precheck |
| P2-3 | note 唯一冲突/异常恢复和跨 Project 并发函数逻辑未定义 |
| P2-4 | 销售列表缺少稳定排序、pageSize 上限和 total 同快照证明 |
| P2-5 | 测试矩阵缺少 SECURITY DEFINER 权限、NULL 参数、低级函数和 prepared transaction 场景 |
| P2-6 | Prisma relation/FK name 与实际 Catalog 的一致性仍未验证 |

### P3

| ID | 问题 |
|---|---|
| P3-1 | 新 Web/Worker 未定义对其他 database 的 CONNECT 拒绝 |
| P3-2 | `sales_command` schema owner、USAGE/EXECUTE 默认权限的精确 DDL 未给出 |
| P3-3 | SQLSTATE 示例 `28P01 或等价` 不够精确 |

## 14. 必须先修正的设计位置

1. R3 第 459-544 行：为五个函数补完整 SQL/PLpgSQL 签名、body、异常、NULL 和 ACL。
2. R3 第 355-376 行：补 Requirement/Revision/Advisor/SelectionRun/Audit 的最小
   权限或对应受控命令函数。
3. R3 第 332-350、1364-1425 行：加入 `pg_prepared_xacts`、membership 递归和
   target `datname` 的 Contract 证据。
4. R3 第 500-513 行：统一 DB/TS resolver 的时间精度和错误语义。
5. R3 第 781-885 行：加 assignedTo orphan precheck 和失败停止规则。
6. R3 第 1141-1170 行：补 pagination tie-break、pageSize cap、total snapshot。
7. R3 第 1240-1275 行：补 SECURITY DEFINER、NULL、内部函数、prepared transaction
   和权限边界测试。

## 15. 可以进入实施的范围

在本轮 FAIL 结论下，不允许开始完整实施。

可以继续的只读/隔离工作：

- 在独立分支起草 R3 修正版函数 DDL；
- 在隔离 PostgreSQL 建立函数/角色/ACL 测试夹具；
- 设计并执行不连接共享库的双连接测试；
- 补齐 Prisma/Schema/Catalog 对照；
- 编写 E2E 测试规格。

禁止：

- 在开发/共享/生产库执行 Contract；
- 删除旧 `sales_handoff_projectId_key`；
- 将旧 `elevator_app` 作为可写角色继续使用；
- 宣称 SECURITY DEFINER 函数或角色隔离已经安全；
- 将函数未定义、测试未执行写成 PASS。

## 16. 必须完成的隔离验证

```text
Prisma validate/generate
Expand/Contract on isolated PostgreSQL
pg_constraint/pg_indexes/pg_attribute/pg_trigger/pg_proc catalog diff
SECURITY DEFINER / proconfig / proacl / owner ACL checks
PUBLIC, Web, Worker, definer, migration role EXECUTE tests
NULL/default/overload/function-replace tests
two-connection Requirement/PATCH/Advisor/Selection/Sales/Note tests
old role NOLOGIN and reconnect test
prepared transaction presence/rollback test
project-scoped sales list/count/detail/export test
RepeatableRead snapshot test
E2E entity and Browser/RSC payload tests
40001/40P01/P2034 retry and commit-unknown tests
```

当前全部为 `NOT VERIFIED` 或未执行。

## 17. 静态无法确定的事项

- 当前 Prisma 版本能否验证 proposed composite relations 和 relation maps；
- PostgreSQL 是否启用 prepared transactions；
- 新函数所有者实际拥有的对象权限；
- `SALES_MANAGE` 的 DB callback 在实际角色/连接池中是否一致；
- 新 sale function 在真实事务中是否严格按 Project -> handoff -> note 顺序锁；
- 生产是否存在额外 Scheduler、连接池、数据库角色或 2PC 写入者；
- Browser/RSC 实际序列化数据是否完全不含未授权销售字段。

## 18. Git 状态

审查开始时：

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked status entries:     148
Untracked recursive files:    159
```

新增本报告后预期：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked status entries:     149
Untracked recursive files:    160
```

本轮除新增本报告外没有修改任何应用或数据库文件。

## 19. 报告 SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
96885a640a932a6977d3a252ef4615d67953fb3bb0173f8b29b2c98d378ed69c

Bytes:                    27562
Physical lines:           668
```

自排除摘要的计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符，
对 UTF-8 文件字节计算 SHA-256。
