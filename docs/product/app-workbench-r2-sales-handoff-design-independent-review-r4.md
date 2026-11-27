# APP-WORKBENCH-R2 SalesHandoff R4 Independent Adversarial Design Review

## 0. 最终结论

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

R4 已显著改善函数完整性、权限表、prepared transaction 门禁、时间精度和幂等设计，
但仍有两个直接命中本轮硬失败条件的问题：

1. actor claim 有 nonce，却没有一次性消费表或事务绑定；同一 claim 可在有效期内
   跨事务重放；
2. Web Runtime 仍拥有 Requirement/Advisor/SelectionRun 的直接 INSERT/UPDATE
   权限，数据库无法强制这些路径的 Project 锁和 expectedVersion。

因此本轮不能批准完整实施。Contract 仍必须是 `BLOCKED`。

本报告只读。未修改 R4、R3、源码、Schema、Migration、测试或配置；未执行
Prisma、SQL、PostgreSQL、E2E、Browser、Build、Provider 或服务操作。

## 1. R4 文件完整性

| 项目 | 现场结果 | 状态 |
|---|---|---|
| R4 文件存在 | 是 | PASS |
| R4 字节数 | 64821 | PASS |
| R4 物理行数 | 2074 | PASS |
| 任务给定 Whole-file SHA-256 | `630744cbfe92dd52a346779a3899bee37bd6e5e824a344fd9c018046a2daf75a` | PASS |
| 实际 Whole-file SHA-256 | `630744cbfe92dd52a346779a3899bee37bd6e5e824a344fd9c018046a2daf75a` | PASS |
| R3 设计仍存在 | 是 | PASS |
| R3 SHA-256 | `55f4d9edc968b127291a33df29c1326e48efce0c35bd23989b7de747bfbf922e` | PASS |
| R3 独立审查仍存在 | 是 | PASS |
| R3 独立审查 SHA-256 | `668050d937615ecf2990a298a2f5b4b274b574faa3c515f07b9561985ad3b6f4` | PASS |

## 2. Git 现场基线

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked status entries:     150
Untracked recursive files:    161
```

工作区包含大量既有用户工作。本报告只新增审查文件，没有将全部变更归因于 R4。

## 3. 检查范围

### 3.1 R4 设计

```text
docs/product/app-workbench-r2-sales-handoff-invalidation-design-r4.md
```

R4 自报：

```text
FunctionDefinitions: 8
BusinessFunctions:   5
HelperFunctions:     3
EllipsisInsideDefinitions: 0
```

静态文本检查确认上述数量和无省略号函数定义成立，但这不等于 SQL 已通过编译或
执行。

### 3.2 对照材料

```text
docs/product/app-workbench-r2-sales-handoff-invalidation-design-r3.md
docs/product/app-workbench-r2-sales-handoff-design-independent-review-r3.md
```

### 3.3 现有源码

```text
prisma/schema.prisma
prisma/migrations/20261123130000_full_mvp_domain/migration.sql
apps/web/src/app/api/projects/[projectId]/requirements/route.ts
apps/web/src/modules/advisor/service.ts
apps/web/src/modules/mvp/store.ts
apps/web/src/modules/selection/service.ts
apps/web/src/modules/workbench/selection-consistency.ts
apps/web/src/modules/access/permissions.ts
apps/web/src/modules/access/policy.ts
packages/contracts/src/index.ts
apps/web/tests/e2e/mvp-catalog-sales.spec.ts
```

## 4. P1 问题

### P1-1 — Actor Claim 没有一次性消费或事务绑定，可跨事务重放

R4 在 claim 中加入 `nonce`、`requestId`、`issuedAtEpoch`、`expiresAtEpoch`，
并在 `sales_security.assert_sales_actor_v2` 中验证 HMAC 和 Session
（设计第 76-137、184-320 行）。

但 R4 没有：

- 将 claim digest/nonce 写入数据库唯一消费表；
- 使用 `INSERT ... ON CONFLICT DO NOTHING` 或 CAS 消费 claim；
- 将 claim 绑定到 `txid_current()` / 当前事务；
- 记录 claim 已消费的结果；
- 区分“同 claim 并发重放”和“新 Claim + 旧 idempotency key 的重试”。

当前 `nonce` 只被签名，绝对身份证明仍然可以重复使用到 `expiresAtEpoch`。

攻击路径：

```text
攻击者/错误服务获得一个已签名 SALES_LIST 或 SALES_GET_CONTEXT claim
-> 在 120 秒窗口内从另一数据库连接重放
-> HMAC、Session、时间窗口仍通过
-> 返回原 actor 有权限的数据

同 claim 并发调用写函数
-> 两个连接都通过 claim 校验
-> 业务 unique 可能让一个 replay/拒绝，但 claim 本身没有被消费
```

对写操作，exact-context/note idempotency 可以减少重复实体，但它不能替代本轮明确
要求的一次性 Claim 消费。对读操作，没有业务唯一约束阻止重放。

必须修正：

1. 新增 `sales_security.actor_claim_consumption`：
   `claim_hash bytea PRIMARY KEY, actor, session, request_id, operation,
   transaction_id bigint, consumed_at timestamptz`；
2. claim hash 覆盖完整签名 canonical string；
3. helper 在同一事务中用 `INSERT ... ON CONFLICT DO NOTHING RETURNING` 消耗；
4. 无插入行返回 `CLAIM_REPLAYED`，不得继续业务写/读；
5. 对读请求也消费；客户端重试必须生成新 claim nonce，或使用明确的 replay
   response cache；
6. 事务回滚时 consumption 行也回滚，因此只消费已提交的成功事务；
7. 记录 `txid_current()`，禁止同一 claim 被不同事务使用；
8. 明确保留/清理周期，至少覆盖 claim 的最大有效期与重放窗口。

没有这一机制，Actor Claim 仍是可重放 capability，P1 条件不满足。

### P1-2 — Web Runtime 仍有可绕过 Project 锁和 expectedVersion 的直接写权限

R4 第 1366-1371 行和 GRANT 示例第 1440-1455 行授予 Web：

```text
BuildingRequirement: SELECT, INSERT
RequirementRevision: SELECT, INSERT
AdvisorConversation: SELECT, INSERT, UPDATE(updatedAt)
AdvisorMessage: SELECT, INSERT
SelectionRun: SELECT, INSERT
SelectionRecommendation: SELECT, INSERT
AuditLog: SELECT, INSERT
```

这些写权限不经过带 HMAC actor 的业务函数。仅靠应用服务按约定先锁 Project，
数据库不能阻止同一 Web Runtime 身份：

```text
直接 INSERT building_requirement（新 version）
直接 INSERT requirement_revision
直接 INSERT selection_run(status=COMPLETED)
直接 INSERT selection_recommendation
直接 INSERT advisor_message / requirement
直接 INSERT audit_log
```

示例攻击路径：

```text
Web 数据库中某条遗漏的 route / script / future service
-> INSERT building_requirement vN+1，不取得 Project FOR UPDATE
-> SalesHandoff 的 DB resolver 看到新当前需求
-> 旧 handoff 立即变历史；新 handoff 可能绑定由旁路创建的需求/run
```

或：

```text
某服务直接 INSERT selection_run (status=COMPLETED)
-> DB resolver 选中它
-> 绕过 SelectionRun 创建事务的 Project 锁/current requirement 校验
```

R4 的 identity guard 只禁止 requirement/run 的 UPDATE/DELETE；它没有禁止直接
INSERT，也没有证明每个 INSERT 都先取得 Project 锁。R4 的 HMAC 只保护销售表写入，
不保护这些直接 DML。

本轮审查明确将“Web Runtime 拥有可绕过业务不变量的直接写权限”列为必 FAIL 条件。
因此这是 P1，不是一般加固建议。

必须修正（选择一种）：

1. 为 Requirement PATCH/confirm、Advisor message、SelectionRun 创建分别增加
   受控 SECURITY DEFINER 命令函数，撤销 Web 对这些表的直接 INSERT/UPDATE；
2. 或用数据库端可验证 capability/事务锁守卫，使直接 DML 在没有已消费 actor
   claim 和 Project 锁时失败；
3. AuditLog 也必须通过受控审计函数或只允许与已验证业务事务绑定的插入；
4. 对任何未来新增写表采用默认 DENY，必须修订权限矩阵。

只增加文档说明“服务会先锁 Project”不够，数据库仍允许绕过。

## 5. Actor Claim 攻击路径审查

### 5.1 Key Custody

| 检查 | 结果 |
|---|---|
| Web runtime 直接 SELECT `actor_hmac_key` | R4 拒绝，PASS by design |
| Worker 直接 SELECT key | 未授权 |
| 普通用户获取 DB role | 应用边界外，但 Web role 不暴露给浏览器 |
| Migration/Owner/DBA 可读 DB secret | R4 未完全证明不可；必须列为特权残余风险 |
| Web Secret Manager access policy | R4 只说明不得入仓库，未给出角色隔离证据 |
| key rotation/revocation | 表有 `not_before/not_after/revoked_at`，但无轮换运行协议 |
| 空/错 key/签名/过期 | helper 返回 INVALID，PASS by design |

R4 使用 Secret Manager 和 HMAC 比 R3 更强，但数据库/迁移特权角色仍可读取验证
secret。若威胁模型不接受 DBA 作为根信任，应改为非对称签名/KMS 验证；若接受，
必须写入明确残余风险和 key custody 证据。该项至少是 P2，不能当作“普通用户
可伪造”。

### 5.2 Claim 绑定

| 绑定对象 | R4 |
|---|---|
| Better Auth user | 有 |
| Better Auth session | 有，helper 查 `session` |
| operation | 有，claim operation 与 expected 比较 |
| Project | create/get/note 通过 payload/handoff 绑定；list 通过 DB project filter |
| business object | create/get/note payload digest 绑定 |
| canonical payload digest | 有 |
| request unique id | 有 |
| issued/expiry | 有，120 秒窗口 |
| current DB transaction | **无** |
| one-time consumption | **无** |

因此绑定方向大部分正确，但重放和事务绑定不完整。

### 5.3 SQL 注入/对象替换

- 8 个定义均使用固定 `search_path=pg_catalog`。
- 业务表、类型、函数显式 schema 限定。
- 无动态 SQL。
- Web/Worker 对 helper、resolver 无 EXECUTE。
- Web 不可替换函数或禁用 Trigger。

这些点静态 PASS，但仍需隔离 PostgreSQL 验证。

## 6. 八个函数逐项审查

| 函数 | 参数/返回/NULL | owner/ACL | Project/context | 结论 |
|---|---|---|---|---|
| `sales_security.canonical_field_v2(text)` | 完整，NULL -> `-` | definer/私有 | 纯格式化 | PASS by design |
| `sales_security.assert_sales_actor_v2(jsonb, bytea, text, text)` | 完整，显式拒绝 NULL | definer/私有 | user/session/op/payload/time 有；**无 one-time consume/TX binding** | FAIL/PARTIAL |
| `sales_security.actor_has_permission_v2(text,text,text)` | 完整 | definer/私有 | project/global RBAC | PASS by design |
| `sales_command.app_resolve_current_completed_selection_v2(text)` | 完整，内部 only | definer/私有 | latest req/run、毫秒 tie | PASS by design |
| `sales_command.app_sales_create_handoff_v2` | 完整 | definer/4-function grant | project lock/current/exact/closed/legacy/unique conflict | PASS by design，受 claim replay P1 限制 |
| `sales_command.app_append_sales_followup_v2` | 完整 | definer | project lock/binding/idempotency/closed/legacy/note+status | PASS by design，受 claim replay P1 限制 |
| `sales_command.app_list_sales_handoffs_v2` | 完整 | definer | DB SALES_MANAGE filter/stable pagination | PASS by design |
| `sales_command.app_get_sales_handoff_context_v2` | 完整 | definer | DB SALES_MANAGE/context/notes | PASS by design |

函数定义本身的 R3 P1“只有伪代码”已解决。当前失败来自 Actor Claim 消费和 Web
直接 DML，而不是函数体仍然只是接口。

### 6.1 函数 owner / search_path / PUBLIC

静态检查 R4：

- 5 个 business functions 有 `SECURITY DEFINER`；
- 3 个 helper 有明确 `SECURITY INVOKER`；
- 所有函数固定 `search_path=pg_catalog`；
- 所有敏感对象 schema 限定；
- `ALTER FUNCTION ... OWNER TO elevator_sales_definer` 已给出；
- PUBLIC execute revoke 和 Web execute grant 已给出；
- 函数内无动态 SQL/省略号。

这些方向 PASS；实际 `prosecdef/proconfig/proacl` 仍需 PostgreSQL Catalog 验证。

## 7. 权限矩阵审查

### 7.1 已覆盖的对象

R4 为 Web、Definer、Worker/Owner/Migration 给出了逐对象矩阵，并列出：

```text
Project, BuildingRequirement, RequirementRevision,
AdvisorConversation, AdvisorMessage, SelectionRun,
SelectionRecommendation, SalesHandoff, SalesFollowUpNote,
AuditLog, actor_hmac_key, sales_command functions
```

### 7.2 实际攻击面

Web Runtime 的直接 INSERT/UPDATE 仍允许绕过业务函数：

```text
INSERT building_requirement
INSERT requirement_revision
INSERT advisor_message
INSERT selection_run
INSERT selection_recommendation
INSERT audit_log
```

这意味着最小权限矩阵形式上完整，但安全边界不成立。除非数据库层增加与
Project 锁/claim 消费绑定的 capability，Web 必须撤销这些直接写权限或把每个写
入口变成受控函数。

### 7.3 Worker/Owner

- Worker 没有销售函数或表写权限：PASS by design。
- Definer 没有 DDL/TRUNCATE/owner member：PASS by design，待 ACL Catalog 验证。
- Owner NOLOGIN/Migration 分离：PASS by design，实际部署未执行。
- Public execute：设计 revoke，PASS by design。

### 7.4 其他数据库对象

R4明确说非 R2 的认证/客户/产品/文件模块 GRANT 需另做 role diff。该限制使
“elevator_web_runtime_v2 可整体替代生产 Web”仍未闭环，但不应借机重写其他模块；
必须作为实施前置证据，不得用旧 owner 权限补齐。

## 8. Contract / prepared transaction 审查

R4 第 7 节新增：

- `pg_prepared_xacts` 目标 DB 检查；
- prepared age、owner、database、locks；
- `pg_stat_activity` 的 target datname；
- `pg_auth_members` 递归角色闭包；
- database/schema/table/function owner；
- old/new role CONNECT；
- unknown prepared/business provenance -> BLOCKED；
- COMMIT PREPARED 双人/业务证据；
- 关闭旧/新应用 CONNECT 后检查并执行 Contract；
- `BLOCKED` / `ELIGIBLE_FOR_CONTROLLED_CUTOVER` / `COMPLETED` 三态。

这些方向满足本轮 P1-3 的设计要求。实际 Contract 尚未授权/执行，故当前状态仍
`BLOCKED`。prepared transaction 设计不能写成已通过。

## 9. P2 修正审查

### 9.1 Resolver 时间精度

R4 使用 `date_trunc('milliseconds', createdAt)`，并让页面使用 DB DTO
`contextState`，TS helper 仅非权威。方向 PASS。

边界案例已处理：

```text
...123100 + ...123900 -> 同一毫秒桶 -> AMBIGUOUS
...123999 + ...124000 -> 不同毫秒桶 -> 后一个
```

仍需真实 DB/TS fixture 执行。

### 9.2 assignedToId orphan

R4 增加 precheck 和失败停止，不静默清空。方向 PASS。必须验证真实历史数据。

### 9.3 note 唯一冲突

R4 使用精确 conflict key + payload 比对，未将其他 unique conflict 当成功。
方向 PASS。`ON CONFLICT DO NOTHING` 的并发行为仍需隔离 DB 验证。

### 9.4 销售分页

R4 使用：

```text
ORDER BY updatedAt DESC, id DESC
pageSize 1..100
offset 0..1,000,000
同 filtered CTE total
```

并明确 offset 并发漂移；长时间导出使用 keyset。方向 PASS。

### 9.5 扩展测试矩阵

R4列出了 NULL/STRICT、search_path、PUBLIC、direct DML、resolver time、prepared
xact、note conflict、pagination 等。仍缺：

- actor claim one-time consumption/concurrent replay；
- current transaction binding；
- key holder/custody/isolation；
- Web direct requirement/selection DML bypass；
- actor claim key rotation/revocation lifecycle。

由于 P1-1/P1-2，这些不是小改进。

## 10. 问题分级

### P0

无静态确认的 P0。

### P1

| ID | 问题 | 影响 |
|---|---|---|
| P1-1 | Actor Claim 没有唯一消费/事务绑定，可跨事务重放 | 伪身份能力可重复使用，违反本轮明确 P1 |
| P1-2 | Web Runtime 可直接 INSERT Requirement/Revision/Advisor/SelectionRun/AuditLog | 可绕过 Project 锁/expectedVersion/受控函数，违反本轮硬失败条件 |

### P2

| ID | 问题 |
|---|---|
| P2-1 | HMAC secret 的 Web/Secret Manager/Migration/Definer custody 证据不完整 |
| P2-2 | 非 R2 认证/客户/产品/文件表权限仍需独立 role diff，当前 replacement role 未闭环 |
| P2-3 | actor claim key rotation/revocation、已消费 claim 保留和清理规则未完成 |
| P2-4 | 测试矩阵未覆盖 Claim 每秒/跨事务重放和直接 Requirement/Selection bypass |

### P3

| ID | 问题 |
|---|---|
| P3-1 | 函数 SQL、Trigger body 和 Prisma/Catalog 一致性尚未在隔离数据库编译验证 |
| P3-2 | HMAC 比较的常量时间性质和密钥内存生命周期未在设计中说明 |

## 11. 可以进入实施的范围

本轮 FAIL 下，不允许开始完整实施。

可以继续的安全工作：

- 在隔离分支实现并编译 8 个函数；
- 在隔离库验证 actor claim 和 ACL；
- 先用测试 schema 设计 claim consumption；
- 为 Requirement/Advisor/SelectionRun 写受控命令函数或 capability guard；
- 完成 prepared transaction Contract harness；
- 执行纯单元和隔离 DB 验证。

不得：

- 用 Web 当前直接 DML 权限进入 production；
- 以一次 `pg_stat_activity` 或一次最终审查替代 Contract 证据；
- 宣称 Actor Claim 已不可重放；
- 宣称 Contract COMPLETED；
- 宣称函数 SQL 已通过未实际执行的验证。

## 12. 必须完成的验证

```text
Prisma validate/generate
isolated SQL/PLpgSQL compile
5 function + 3 helper owner/proconfig/proacl
NULL/STRICT/default parameter edge cases
HMAC key rotation/revocation
claim one-time consumption + concurrent replay
claim transaction binding
PUBLIC/Web/Worker/helper resolver EXECUTE
direct Requirement/Advisor/SelectionRun/Audit bypass attempt
Project row lock dual connections
note unique conflict recovery
prepared transaction gate
date precision boundary
assignedTo orphan
stable pagination
E2E entity assertions
```

以上全部是 `NOT VERIFIED` 或 `NOT EXECUTED`。

## 13. 静态无法确定的事项

- pgcrypto 在当前目标库的安装 schema/ACL；
- secret 的实际持有者和 Secret Manager policy；
- SECURITY DEFINER 函数是否能按 R4 SQL 编译；
- Trigger body 对 Project/Requirement/Selection 行为；
- `SELECT FOR UPDATE` 权限在目标库的实际结果；
- prepared transaction 是否存在；
- 生产旧角色/对象 owner/连接池/Scheduler 是否与报告假设一致；
- 实际浏览器/RSC 载荷。

## 14. Git 状态

审查开始时：

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            150
Untracked recursive files:    161
```

新增本报告后预期：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            151
Untracked recursive files:    162
```

除新增本报告外没有修改任何文件。

## 15. 报告 SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
ed8324e68dc95f21e11f83ffa0df0338a8a07ce638213faa280fbeb768a83c8c

Bytes:                    18905
Physical lines:           515
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符，
对 UTF-8 文件字节计算 SHA-256。
