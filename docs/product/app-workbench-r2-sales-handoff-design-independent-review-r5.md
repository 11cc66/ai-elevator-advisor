# APP-WORKBENCH-R2 SalesHandoff R5 Independent Adversarial Design Review

## 0. 最终结论

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

本轮是只读独立审查。R5 的 Claim 消费 Helper 和大量边界规则已有实质改进，但仍
存在三个直接命中用户审查硬失败条件的问题：

1. 多个受保护业务函数和三个 AuditLog bridge 只有参数/返回契约，没有完整可审查
   的 PL/pgSQL body；
2. R5 要求 PATCH/Advisor 使用 `expectedVersion`，但当前 contract、Route、前端和
   E2E 仍没有一致的版本语义；
3. 共享 `AuditLog` 的直接写撤权明确会撞上尚未完成的文件生命周期迁移，且 bridge
   没有足以独立验证的完整实现。

R5 不能进入完整受控实施。Claim 数据模型本身可以继续作为隔离验证候选，但不能
据此宣称一次性消费已经端到端成立，也不能执行 AuditLog 撤权或真实 Contract。

本报告未修改 R5、源码、Schema、Migration、测试、配置或数据库；未执行 Prisma、
SQL、PostgreSQL、E2E、Browser、Build、Provider 或服务操作。

## 1. 审查对象与文件完整性

### 1.1 被审文件

[R5 design](D:/thinkbook/Desktop/jieya/docs/product/app-workbench-r2-sales-handoff-invalidation-design-r5.md)

```text
Path:       docs/product/app-workbench-r2-sales-handoff-invalidation-design-r5.md
Bytes:      71156
Lines:      1824
SHA-256:    7936f40b12cd137bb772af8f03a83c416a9a5ac1504497cd663c5e7ecd3f3178
```

文件存在，且 SHA-256 与当前现场一致。R5 的 self-excluding SHA-256 记录为
`360c78befbd1f1560805a9634b1fcf8833e3fde93eeb36f66b02bad3b56aaf06`。

### 1.2 对照材料

- [R4 design](D:/thinkbook/Desktop/jieya/docs/product/app-workbench-r2-sales-handoff-invalidation-design-r4.md)
- [R4 independent review](D:/thinkbook/Desktop/jieya/docs/product/app-workbench-r2-sales-handoff-design-independent-review-r4.md)
- `prisma/schema.prisma`
- `packages/contracts/src/index.ts`
- `apps/web/src/app/api/projects/[projectId]/requirements/route.ts`
- `apps/web/src/app/api/projects/[projectId]/advisor/conversations/[conversationId]/messages/route.ts`
- `apps/web/src/modules/audit/log.ts`
- `apps/worker/src/file-processing-state.ts`
- `apps/web/src/modules/projects/service.ts`
- `apps/web/src/modules/files/upload-service.ts`
- `apps/web/src/modules/files/download-service.ts`
- `apps/web/src/modules/mvp/store.ts`
- `apps/web/src/modules/access/permissions.ts`
- `docs/architecture/file-lifecycle-p13-implementation-status.md`

R4 whole-file SHA-256:

```text
630744cbfe92dd52a346779a3899bee37bd6e5e824a344fd9c018046a2daf75a
```

R4 independent review whole-file SHA-256:

```text
e2851cccbfd981e59fba4a9f7f31fdc291b9afe3feaf4896e88d6c88ec54ad59
```

两者与输入一致，审查期间未修改。

## 2. 现场 Git 基线

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            152
Untracked recursive files:    163
```

本报告只新增审查文件。工作区中的 48 个 tracked modified 和既有 untracked 文件
不归因于本报告；没有执行 Git 清理、恢复、暂存、提交或推送。

`$null`、`UNKNOWN'`、`apps/web/.next` 和 `apps/worker/dist` 未读取内容、哈希、
修改、移动或删除。

## 3. P1-1：Claim 消费协议逐项审查

### 3.1 已具备的机制

R5 在 3.3–5.3 节提供了：

- `actor_claim_consumption` 表；
- `claim_hash` 主键；
- `(actor_user_id, request_id)` 唯一索引；
- `(actor_user_id, nonce)` 唯一索引；
- `transaction_id` 唯一索引；
- 当前事务内 `PENDING` 插入守卫；
- 同一事务 `PENDING → COMPLETED/REJECTED` 转换守卫；
- deferred `assert_claim_terminal_v3()`；
- `consume_sales_actor_claim_v3()` 和
  `finalize_sales_actor_claim_v3()` 的完整 PL/pgSQL；
- receipt 保存、读取重放和事务回滚规则；
- `VOLATILE` 读取函数要求；
- 跨 Project/object 的 Claim 消费检查。

静态按设计判断，以下项目为 `PASS BY INSPECTION`：

| 检查 | 静态结论 |
|---|---|
| 同一 Claim 的唯一消费仲裁 | `claim_hash` 主键和 INSERT 原子性方向正确 |
| 同一 requestId 重放/变更 payload | actor/request 唯一索引与 digest 比较方向正确 |
| 同一 nonce 重放 | actor/nonce 唯一索引方向正确 |
| 同一事务消费多个 Claim | transaction 唯一索引和 `TRANSACTION_ALREADY_CONSUMED` 方向正确 |
| 已消费 Claim 的并发等待 | unique conflict 后重新查询 receipt 的方向正确 |
| 回滚后重试 | Claim 行与业务写入同事务回滚的方向正确 |
| PENDING 提交 | deferred trigger 方向正确 |
| 死锁/序列化重试 | R5 要求整个事务回滚并重新验证，方向正确 |

这些是静态设计检查，不是 PostgreSQL 执行结果。唯一索引竞争、Trigger 行为、
COMMIT 回滚和实际锁等待仍为 `NOT VERIFIED`。

### 3.2 P1-C1：关键业务函数 body 缺失

最严重的 Claim 端到端缺口是：R5 只定义了业务函数名称、参数、返回字段和规则，
没有提供这些函数的完整 SQL/PL/pgSQL body。R5 在
`R5:1205-1207` 明确写出：

```text
这些新增 business functions 也必须逐个提供完整参数类型、返回类型、NULL 规则、
错误 map、owner、SET search_path=pg_catalog 和精确 ACL；R5 给出的是其受控调用
契约，实施前必须像 R4 的五个函数一样补齐完整 body 并接受独立安全审查。
```

涉及的关键函数包括：

- `app_create_requirement_version_v3`
- `app_confirm_requirement_v3`
- `app_start_advisor_conversation_v3`
- `app_finish_advisor_turn_v3`
- `app_create_selection_run_v3`
- `app_update_selection_run_status_v3`
- `app_append_web_domain_audit_v3`
- `app_append_web_global_audit_v3`
- `app_append_worker_audit_v3`

其中 requirement/advisor/selection 函数在 `R5:1075-1182` 只有签名；AuditLog bridge
在 `R5:1143-1185` 只有签名；没有可见的 `CREATE OR REPLACE FUNCTION ... AS $fn$`
body、错误分支、锁顺序实现、实际插入语句或 final receipt 构造。

这不是普通测试待办。它导致以下安全事实无法静态确认：

```text
Claim 是否真的先于业务读取和 Project 锁消费
finalFields 是否真的来自已签名 canonical payload
expectedVersion 是否在锁后重新读取并比较
业务失败是否在 return 前 finalize 为 REJECTED
成功业务是否与 Claim/AuditLog/receipt 同事务提交
任何业务函数是否真的执行 Actor/Session/RBAC 复核
```

用户明确要求：只有接口契约、伪代码或“实施时补充函数体”必须记录为设计完整性
缺陷。因此本项为 **P1**，不是 P3。

影响：R5 无法证明所有受保护写入都经过统一 Claim 消费协议。实施者如果在实现时
自行补 body，可能在权限、Project lock、canonical scope、receipt 和错误映射上
产生与设计不一致的路径。

最小修复方向：在 R5 或其后续受控设计补丁中给出上述函数的完整可审查 body，
至少在静态上能逐函数定位 `consume → Project lock → authority read → write →
finalize`，并删除“实施时补齐”的设计缺口。

### 3.3 P1-C2：旧 R4 签名与新签名并存时可能绕过一次性消费

R5 将 R4 的：

```text
app_append_sales_followup_v2(claim, signature, handoffId, status, contactStatus, note)
app_get_sales_handoff_context_v2(claim, signature, handoffId)
```

改成：

```text
app_append_sales_followup_v2(claim, signature, projectId, handoffId, status, contactStatus, note)
app_get_sales_handoff_context_v2(claim, signature, projectId, handoffId)
```

并在 `R5:1542-1581` 给出了新签名的 owner/ACL 示例。但未定义：

- 旧签名的 `DROP FUNCTION` 或替换顺序；
- 旧函数是否可能继续由 owner、继承角色或其他运行身份调用；
- 旧函数的 ACL 迁移/撤销结果；
- 新函数启用前旧函数的调用方切换门禁。

R4 原始函数定义位于 R4 `1145` 一带，R5 只说明新签名，没有完整新函数 body。
即使 Web Runtime 的旧 EXECUTE 被撤掉，其他角色或错误调用仍可能命中旧签名。

影响：旧函数可能保留“校验 HMAC 但不消费 Claim”的行为，形成版本并存时的旁路。

最小修复方向：规定旧签名函数在受控迁移中的替换、撤销和 Catalog 核验；不允许
旧签名继续处于可调用状态。

### 3.4 P2-C3：顶层 project/object 不作为签名内容，依赖未完成函数保证

R5 在 `R5:130-154` 正确指出 v2 HMAC canonical 不包含顶层 `projectId/objectId`，
并要求业务函数以 signed canonical payload 和锁后实体为准。但 `consume` 目前只把
顶层 scope 与调用参数比较；它没有、也无法单独证明调用者实际构造的 canonical
payload 属于同一个 Project/对象。完整业务函数 body 又缺失。

影响：如果实现把 `p_expected_project_id` 直接取自顶层 Claim，或者错误地信任
route 传入的 project，仍可能消费 Claim A 后写入 Project B。

修复方向：在完整业务函数 body 中固定 canonical field 构造，并在 Project 锁后
重新解析/比对实体归属；为该规则增加可执行测试。

### 3.5 Claim 状态与错误分类

静态方向正确的部分：

- `REPLAY` 和 `REQUEST_REPLAY` 只返回已持久化 receipt；
- `CLAIM_ALREADY_IN_TRANSACTION` / `TRANSACTION_ALREADY_CONSUMED` 要求回滚；
- 服务端拒绝 `INVALID_CLAIM*`、`REQUEST_ID_REUSED` 和 `NONCE_REUSED`；
- read receipt 不保存 DTO；
- 事务闭包内禁止 Provider、文件、消息和外部副作用；
- key rotation 后可用新 key/requestId 恢复 receipt。

仍需在隔离 PostgreSQL 验证：

- 两个独立连接完全同时插入；
- 第一个插入在 finalization 前长时间等待；
- 第一个事务 rollback；
- 唯一冲突是否只被识别为对应 Claim/request/nonce/transaction；
- deferred trigger 在 COMMIT 而不是语句结束时触发；
- `40001`/`40P01` 后重试不会重复 Provider 或业务副作用；
- 过期 Claim 无法通过 receipt 恢复；
- `elevator_sales_definer` 不能通过其他连接、search_path 或临时 schema 伪造
  actor context。

这些都只能是 `NOT VERIFIED`，不能写成 PASS。

## 4. P1-2：Web Runtime 直接写权限审查

### 4.1 覆盖的对象

R5 `R5:1043-1068` 和 `R5:1456-1470` 对以下表执行撤销：

```text
building_requirement
requirement_revision
advisor_conversation
advisor_message
selection_run
selection_recommendation
sales_handoff
sales_follow_up_note
audit_log
```

从静态文本看，目标对象覆盖了本轮要求的受保护业务表。对
`elevator_web_runtime_v2` 的显式 `INSERT/UPDATE/DELETE/TRUNCATE` 目标存在。

但“存在 REVOKE 语句”不等于权限边界成立。

### 4.2 P1-D1：当前 owner/运行时身份仍未闭环

R5 在 `R5:1033-1037` 自己承认：

```text
elevator_app 是当前数据库 owner
对 owner 执行 REVOKE 不能移除其隐式所有权能力
```

同时 `R5:1524-1525` 说明 owner 仍让 Contract 保持 `BLOCKED`。现场 AGENTS 也明确
当前 `elevator_app` 仍是数据库 Owner。R5 规定了新的
`elevator_web_runtime_v2`，但没有证明当前 Web 连接使用新角色，也没有提供角色
迁移、对象所有权转移或连接身份核验证据。

因此：

- 如果当前 Web 仍以 `elevator_app` 连接，INSERT/UPDATE 仍可绕过撤权；
- 如果 Web 使用 `elevator_web_runtime_v2`，R5 的 REVOKE 方向成立，但实际
  Catalog 和连接身份仍为 `NOT VERIFIED`；
- 只有“新 runtime role 不是 owner、不是 owner 成员、不能 SET ROLE”同时成立，
  才可认定 P1-2 的运行时边界。

该问题至少为 **P1/BLOCKED**，不能以 owner 上的 REVOKE 文本替代角色迁移证据。

### 4.3 P1-D2：合法业务函数 body 缺失，P1-2 的另一半未闭合

撤销直接写权限后，Web 必须依靠受控函数完成 Requirement、Advisor、Selection、
SalesHandoff、note 和 AuditLog 写入。由于这些函数 body 缺失，“合法业务函数仍可
完成必要写入”无法证明。用户明确把“关键业务函数缺少完整可审查定义”列为 FAIL
条件。

受影响证据：

- `R5:1205-1207` 明确要求实施时补 body；
- `R5:1075-1185` 只有函数签名和规则；
- `R5:1542-1581` 只有签名对应的 owner/ACL；
- `R5:1298-1321` 只有 AuditLog bridge 迁移方向。

### 4.4 P2-D3：默认权限只覆盖 definer，不覆盖实际 Migration/Owner 创建者

R5 `R5:1493-1504` 的 `ALTER DEFAULT PRIVILEGES` 只写成：

```text
FOR ROLE "elevator_sales_definer"
```

但函数和对象通常由 Migration/Owner 创建；R5 后文才将函数 owner 改为 definer。
对“未来由 migration role 创建的 protected table/function”，这个默认撤销不自动
生效。若对象创建者仍能创建 PUBLIC 可执行函数或带默认 DML 的表，权限扫描只能
事后拦截，不能保证默认拒绝。

影响：后续 migration、临时函数或新表可能重新引入 PUBLIC/Web 执行权限。

修复方向：对实际创建者角色分别设置 `ALTER DEFAULT PRIVILEGES`，或创建后立即
转 owner 并由 Catalog gate 验证；明确 DBA 执行身份和 REVOKE 的幂等性。

### 4.5 P2-D4：扫描查询存在，但没有 Catalog 结果或完整对象清单

R5 `R5:1324-1402` 提供了表、schema、函数、PUBLIC 和继承扫描方向，但没有实际
`pg_class`、`pg_proc`、`pg_auth_members`、`has_table_privilege` 结果。由于本轮
禁止连接 PostgreSQL，这只能标记 `NOT VERIFIED`，不能认定 P1-2 已通过。

## 5. AuditLog 与文件生命周期边界

### 5.1 P1-A1：AuditLog 统一撤权不能独立实施

R5 `R5:1321-1322` 明确：

```text
如果现有 Web/Worker audit call site 尚未迁移，则不得执行 AuditLog 撤权
```

但 R5 又在 `R5:1456-1470` 将 `audit_log` 与业务表一起统一 REVOKE。当前源码仍有
大量直接写：

- `apps/web/src/modules/audit/log.ts:18` 的 `tx.auditLog.create`；
- `apps/web/src/modules/projects/service.ts:49,131,217,264`；
- `apps/web/src/modules/mvp/store.ts:557,787,985`；
- `apps/web/src/modules/files/upload-service.ts:1250,2296`；
- `apps/web/src/modules/files/download-service.ts:205,262,617`；
- `apps/web/src/app/api/projects/[projectId]/files/[fileId]/route.ts:32`；
- `apps/web/src/app/api/projects/[projectId]/files/[fileId]/versions/[versionId]/extractions/[extractionId]/route.ts:43`；
- `apps/worker/src/file-processing-state.ts:163,221,285,407,465`。

这些调用点属于不同事务和不同生命周期。不能只对 `sales_handoff` 相关表撤权而
保留 `audit_log` 的旧权限，因为权限是表级而不是 action 级。也不能在未完成
文件生命周期审计迁移时统一撤销，否则已有 upload/download/extraction 事务将失败。

结论：

```text
AuditLog table-level revoke: BLOCKED
File-lifecycle migration:    NOT COMPLETED
P1-2 full completion:        FAIL / BLOCKED
```

### 5.2 P1-A2：三个 AuditLog bridge 没有完整实现，无法证明审计可信

R5 只列出：

- `app_append_web_domain_audit_v3`
- `app_append_web_global_audit_v3`
- `app_append_worker_audit_v3`

的参数和少量规则；没有完整 body。无法静态确认：

- action 白名单的实际集合；
- objectType/objectId 是否属于同一 Project；
- actor/session 是否与当前业务操作绑定；
- Web bridge 是否可能在业务写入完成前单独插入一条审计；
- Worker `session_user` 的精确角色和调用门禁；
- AuditLog 插入与对应业务写入是否在同一 transaction；
- Claim receipt 是否只在审计插入成功后 finalize；
- action 与业务实体/版本/请求是否双向一致。

尤其 `app_append_web_domain_audit_v3` 接收可变的 `action/objectType/objectId/
oldValue/newValue/reason`，如果没有完整 body，可被用来写入“看起来合法但没有对应
业务变更”的审计记录。R5 的“只允许非销售 action”是必要但不充分条件。

### 5.3 P2-A3：迁移顺序与现有调用点不匹配

现有 `appendAuditLog` 是事务内 helper，通常在业务插入之后调用，例如
`projects/service.ts` 和 `mvp/store.ts`。R5 的统一顺序要求 Claim 消费先于
Project lock 和业务写入。将当前 helper 原地替换为 Claim-based audit bridge 会造成
以下问题：

```text
业务表先写
-> 然后 consume audit Claim
-> 违反 Claim unique row -> Project -> business -> audit 顺序
```

如果 Claim 在审计阶段失败，整个业务事务回滚，这是原子性但会改变现有流程；如果
实现为了保持成功而捕获失败，则会产生缺失审计。R5 没有给出这些调用点的重组方案。

### 5.4 可独立与不可独立的工作

可以相对独立进行：

- 在隔离环境实现/验证 `actor_claim_consumption`、consume/finalize helper 和
  Claim 锁定语义；
- 实现并审查 R4 SalesHandoff/note/get 函数的 Claim 包装；
- 仅对明确受控的 R2 SalesHandoff 事务使用 definer 写 AuditLog；
- 保留现有 AuditLog 直接 INSERT，直到完整迁移可用；
- 进行静态 ACL 清单和角色 Catalog 预检。

不得进行：

- 对 `audit_log` 执行统一 `REVOKE INSERT`；
- 启用文件 lifecycle audit bridge；
- 宣称 Web/Worker AuditLog 已完全受控；
- 用“未授权用户看不到”替代数据库层权限；
- 在同一变更中同时重写文件生命周期和 R2 权限。

## 6. expectedVersion 与 API/contract 一致性

### 6.1 P1-E1：当前接口与 R5 数据库函数不一致

R5 `R5:1292-1296` 明确说明当前 `requirementUpdateSchema` 没有
`expectedVersion`，Advisor message 也没有该字段，且本轮没有修改 contracts。
现场证据：

- `packages/contracts/src/index.ts:370-372`：advisor message 只接受 `content`；
- `packages/contracts/src/index.ts:374-379`：requirement update 是 partial draft，
  没有 `expectedVersion`；
- `packages/contracts/src/index.ts:381-383`：只有 requirement confirm 有
  `expectedVersion`；
- `apps/web/src/app/api/projects/[projectId]/requirements/route.ts:52-69`：
  PATCH 先读当前需求、合并后直接调用旧写入 service，没有版本字段。

R5 新函数却要求 `expectedVersion`。因此当前 UI/Route 无法合规调用：

```text
Requirement PATCH 正常请求
-> contract 拒绝或缺少 signed expectedVersion
-> app_create_requirement_version_v3 无法获得合法参数
```

“或由服务端从当前读模型注入”也不足够：如果没有客户端版本，服务端读到的
current version 可能已经晚于用户看到的版本，从而掩盖 stale edit。必须明确哪些
操作要求客户端携带版本，哪些是 no-version create/start，以及 409 的返回和刷新
行为。

### 6.2 最低可实施契约要求

正式实施前必须明确并实现：

```text
Requirement PATCH: expectedVersion required
Advisor turn:      expectedVersion required
Requirement confirm: existing expectedVersion retained
Selection create:  existing requirementVersion mapped to expectedVersion
```

还需要定义：

- Zod contract 字段与类型；
- API 请求/响应和 409 错误码；
- 前端提交时携带哪个版本、冲突后的刷新策略；
- Claim canonical payload 中的 expectedVersion；
- Project lock 后的权威 version 比对；
- 两个并发请求的 E2E 断言。

这可以在受控实施中完成，但 R5 当前只记录了“需要变更”，没有完成接口设计，
因此不能把 R5 视为可直接实施的完整协议。

## 7. 其他 P1/P2 与 R4 保留部分

### 7.1 R4 已通过部分的静态保留

按 R5 文本，下列 R4 内容仍被引用且方向未变：

- prepared transaction Contract 门禁；
- resolver 毫秒 tie 规则；
- `assignedToId` orphan precheck；
- note exact idempotency；
- stable pagination；
- Project lock；
- RepeatableRead 页面读取；
- SALES_MANAGE 数据库层过滤；
- LEGACY_UNBOUND 只读；
- CLOSED 不可逆。

但这些是 **文档级保留**，不是实际 Catalog/DB 验证。R5 还改变了 note/get 的
函数签名，因此 R4 body 是否“原样保留”仍未验证。

### 7.2 Claim helper 与旧 Helper 职责

新增 Claim helper 的职责与 R4 三个 helper 分离方向正确：

- `assert_sales_actor_v2`：身份、session、HMAC、payload digest；
- `actor_has_permission_v2`：RBAC；
- `app_resolve_current_completed_selection_v2`：当前需求/run 解析；
- R5 consume/finalize：一次性消费与 receipt。

未发现明显职责名称冲突，但目前无法证明旧 helper 不会被新函数绕过调用。

### 7.3 P2-F1：`finalize` 的 receipt allow-list 未落到 SQL

R5 `R5:846-881` 的 `finalize_sales_actor_claim_v3` 只检查：

- state；
- receipt type 非空；
- response payload 是 JSON object。

它没有在所示 SQL 中实现 operation 级 key allow-list、递归敏感字段拒绝或
response digest。表层 CHECK 只能阻止少量顶层 key，不能保证嵌套销售摘要不会
进入 receipt。

影响：即使 Claim replay 不返回 DTO，敏感字段仍可能被持久化并留存在
`actor_claim_consumption`。

### 7.4 P2-F2：默认权限和对象创建者

见 P2-D3。该问题同时影响未来 `sales_security` 和 `public` 对象。

### 7.5 P3-F3：R5 基线数字与任务数字存在 1 项差异

R5 自身记录“任务声明 150/161，执行前实测 151/162，新增后 152/163”。这是
文档基线差异，不影响本次安全判定；既有未跟踪项未被读取内容或清理。

## 8. 可验证性分类

| 项目 | 状态 | 原因 |
|---|---|---|
| Claim 表唯一约束/Trigger 的静态设计 | `PASS BY INSPECTION` | SQL/约束文本存在，未执行 |
| Claim consume/finalize Helper SQL | `PARTIAL` | 文本完整；未编译 |
| Claim 并发/回滚/重试 | `NOT VERIFIED` | 未连接 PostgreSQL |
| Claim 业务端到端原子性 | `BLOCKED` | 业务函数 body 缺失 |
| Web Runtime 直接 DML 文本撤权 | `PASS BY INSPECTION` | REVOKE 语句目标存在 |
| Web Runtime 实际身份/owner/继承闭包 | `NOT VERIFIED / BLOCKED` | 未执行 Catalog/角色验证 |
| 合法业务函数替代写入 | `BLOCKED` | 多个函数只有契约 |
| AuditLog/Web/Worker 调用迁移 | `BLOCKED` | 当前源码仍有直接写，文件生命周期变更未完成 |
| Audit bridge 可信性与事务 | `BLOCKED` | 只有接口，无完整 body |
| expectedVersion API/contract | `BLOCKED` | 当前 contract 与 R5 参数不一致 |
| R4 resolver/note/pagination 等业务语义 | `PASS BY INSPECTION` | R5 文本保留；未执行数据库 |
| prepared transaction Contract | `NOT EXECUTED / BLOCKED` | 未授权 |
| 真实密钥 custody | `NOT VERIFIED` | 未读取 Secret Manager/环境 |
| E2E/Browser/RSC | `NOT EXECUTED` | 本轮只读设计审查 |

## 9. 问题分级

### P0

未发现当前静态设计中可直接证明的生产 P0。

### P1

| ID | 问题 | 结论 |
|---|---|---|
| P1-C1 | 业务函数和 AuditLog bridge 只有契约，缺少完整安全 body | FAIL |
| P1-C2 | 旧 R4 函数签名/ACL 替换与一次性消费没有完整迁移方案 | FAIL/PARTIAL |
| P1-D1 | 新 runtime role 与 owner 隔离未建立，实际 Web 写入身份未证明 | BLOCKED |
| P1-A1 | AuditLog 统一撤权会撞上现有文件生命周期调用点 | BLOCKED |
| P1-A2 | AuditLog bridge 无完整实现，无法证明不可伪造、同事务和 scope | BLOCKED |
| P1-E1 | expectedVersion 与新 API/contract 不一致 | FAIL |

### P2

| ID | 问题 |
|---|---|
| P2-C3 | canonical payload project/object 绑定依赖缺失的业务 body |
| P2-D3 | 默认权限只覆盖 definer，不覆盖实际 migration/owner 创建者 |
| P2-D4 | 无实际 Catalog/权限结果，只有扫描查询 |
| P2-A3 | 现有 audit 调用顺序与 R5 Claim-lock 顺序不匹配 |
| P2-A4 | 审计调用点只有“至少”清单，没有完整路径/事务映射 |
| P2-F1 | receipt key allow-list 未落入 SQL |

### P3

| ID | 问题 |
|---|---|
| P3-F2 | R5 基线数字与任务声明相差 1 项 |
| P3-F3 | R5 文档中的 `begin/command/claim/finalize` 旧术语残留 |

## 10. 必须修复后才能进入受控实施

以下为阻断项，按最小修复集合列出：

1. **补齐所有受保护业务函数和三个 AuditLog bridge 的完整 PL/pgSQL body。**
   每个函数必须可静态追踪 Claim 消费、canonical scope、Project lock、RBAC、
   expectedVersion、业务写入、AuditLog、receipt、finalize 和错误路径。
2. **完成 expectedVersion 的 API/contract/前端/409/E2E 设计。**
   Requirement PATCH 和 Advisor turn 必须明确客户端版本来源，不得用服务端静默
   注入掩盖 stale edit。
3. **把 AuditLog 迁移与文件生命周期拆成明确的阶段。**
   在文件生命周期 audit bridge 完成并独立审查前，保留当前 AuditLog INSERT 或
   禁止执行统一 REVOKE；不得破坏 upload/download/extraction 事务。
4. **完成旧 R4 函数签名替换/删除和 ACL Catalog 核验方案。**
   旧 3 参数 `app_get_sales_handoff_context_v2` 等不能被留下为无 Claim 的可执行
   旁路。
5. **完成实际 Web/Worker runtime role、owner ownership、角色继承和默认权限
   迁移方案。**
   在 `elevator_app` 仍为 owner 时，不能宣称 Web 已失去直接写权限。

这些完成前，整个设计不得报告
`PASS — DESIGN APPROVED FOR CONTROLLED IMPLEMENTATION`。

## 11. 允许的隔离实施边界

即使最终结论为 FAIL，以下工作可作为隔离研究/验证继续进行：

- 在专用测试库创建 Claim 表和辅助函数草案；
- 验证 Claim 唯一约束、并发插入、deferred trigger 和回滚；
- 对 R4 已完整定义的 resolver/note/list/get 函数做隔离 PostgreSQL 编译和
  Catalog 检查；
- 对 Web/Worker/owner/PUBLIC 权限做只读 Catalog 清单；
- 为 expectedVersion 写 contract 和测试计划；
- 为文件生命周期 AuditLog 迁移写独立设计，不执行真实撤权。

不得进行：

- 真实 Contract 或生产角色撤权；
- 统一撤销 `audit_log` INSERT；
- 通过隐藏 UI 或应用层约定替代数据库权限；
- 将缺失业务 body 的函数作为生产受控入口；
- 将未执行的 PostgreSQL/浏览器测试写成 PASS。

## 12. Git 与未执行项

本报告新增前已确认上述 Git 基线；新增本报告后，工作区只增加本审查报告 entry。
未执行任何数据库、迁移、E2E、Browser、Build、Provider 或服务操作；未读取
`.env`、`.env.test`、密钥、密码、Token 或连接串。

新增本报告后的现场：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            153
Untracked recursive files:    164
```

静态检查结果：

```text
git diff --check:       exit 0；仅既有 tracked 文件的 LF/CRLF warning
Markdown code fences:   balanced
Trailing whitespace:    0
Conflict markers:       0
```

这些是文档/工作区检查，不是数据库、运行时或安全验证。

## 13. 报告 SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
8670bf59dd26cabca2f055667a7bff5bd77d48cdded713ac424bd45cb68849ad

Bytes:                    27761
Physical lines:           665
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符，
对 UTF-8 文件字节计算 SHA-256。
