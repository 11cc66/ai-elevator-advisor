# APP-WORKBENCH-R2 SalesHandoff R7 Independent Adversarial Design Review

## 0. 最终结论

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

R7 已修复 R6 的 Advisor start 固定 version 1，并提供五个销售函数的最终 body。
但仍有两个 P1 阻断：

1. R7 的 18 项 registry 继续要求实施者使用 R6 的非销售函数 body，未满足 R7
   “自包含、不得从旧文档复制拼接”的交付标准；
2. R7 的 list/get 销售 DTO 丢失了 R4 的 `notes` 和
   `currentSelectionStatus`，改变了既有销售状态展示语义。

本报告只读审查，不修改 R7、源码、Schema、Migration、测试或配置；未执行 Prisma、
SQL、PostgreSQL、Migration、E2E、Browser、Build、Provider 或服务操作。

## 1. 现场与输入

### 1.1 Git 现场

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            156
Untracked recursive files:    167
```

### 1.2 被审文件

[R7 design](D:/thinkbook/Desktop/jieya/docs/product/app-workbench-r2-sales-handoff-invalidation-design-r7.md)

```text
Bytes:      47612
Lines:      1195
SHA-256:    1be02b1059ab9b582180a937d33bac8dbcae92d746b5a611d12bdfd348744c59
```

R7 self-excluding SHA-256:

```text
e9155533b6b5f97b4a40d9f6a0c58cfc34946c96f24f9e9b0b11b15468a63516
```

### 1.3 对照输入

- R6 design SHA-256 `7254dd685fb751aaf454e102fa248052382eed787739c8e87cc88b2417f40b61`
- R6 review whole-file SHA-256 `a89eb257c862e65d5c3ff587f73f31111bbf5a4cdbd950d7aab6ea19741533b1`
- R5 design SHA-256 `7936f40b12cd137bb772af8f03a83c416a9a5ac1504497cd663c5e7ecd3f3178`
- R4 design SHA-256 `630744cbfe92dd52a346779a3899bee37bd6e5e824a344fd9c018046a2daf75a`
- `prisma/schema.prisma`
- `packages/contracts/src/index.ts`
- Requirement/Advisor/Selection/Sales Route 与 service
- R4/R6 audit call sites

R7 SHA 与任务提供的基准一致。R4/R5/R6 未被本审查修改。

## 2. R6 三项 P1 关闭矩阵

| R6 P1 | R7 修正位置 | 结论 |
|---|---|---|
| P1-F1 五个销售函数只有 R4 source + text wrapper | R7 §5.1–§5.13 | `PARTIAL`：五个销售 body 已出现；但非销售 13 项仍引用 R6，违反 R7 自包含 |
| P1-F4 early return/replay 未闭合 | R7 §5.8 与五个销售 body | `PARTIAL`：控制流表存在；list/get 的 DTO 语义有回归，未完全保留 R4 |
| P1-F2 Advisor version 1 | R7 §5.9 `518-522`、`538-549` | `CLOSED BY DESIGN`：Project 锁内 max+1，返回真实 version；未执行 DB 验证 |

## 3. 五个销售函数逐项审查

### 3.1 `app_resolve_current_completed_selection_v2`

- R7 `R7:127-206` 有完整 body。
- 无 Claim；`STABLE`、`SECURITY DEFINER`、`search_path=pg_catalog`。
- resolver 使用最新 requirement `version DESC,id DESC` 和毫秒 tie。
- 不写业务表、不写 R2 Audit Event、不返回销售 DTO。

静态结论：`PASS BY INSPECTION`；未执行数据库。

### 3.2 `app_sales_create_handoff_v2`

- R7 `R7:991-1185` 有完整 body。
- Claim consume、Project lock、`sales.handoff.create`、resolver、精确 context、
  CLOSED、createPayload 幂等、R2 Audit Event、receipt 和 finalize 均有路径。
- 使用最终 `SALES_HANDOFF_CREATE` 签名和 R2 audit helper。

发现：**P2-C1** 该 body 没有显式把 R2 Audit Event 的 `newValue.auditId` 与
helper 返回 ID 绑定；这不是当前销售状态错误，但审计结果仍需要一个明确的返回字段。
必须通过隔离数据库确认 receipt/audit event 的关联。

### 3.3 `app_append_sales_followup_v2`

- R7 `R7:586-817` 有完整 body。
- 先 Claim consume，再 Project lock、handoff lock、SALES_MANAGE、note idempotency、
  CLOSED、LEGACY_UNBOUND、current resolver、R2 audit、finalize。
- `ON CONFLICT (authorUserId, operationType, requestKey) DO NOTHING` 后有重读和
  payload 比较，不再把所有唯一冲突当成功。

静态结论：`PARTIAL/PASS BY INSPECTION`；仍需 PostgreSQL 验证。

### 3.4 `app_list_sales_handoffs_v2`

- R7 `R7:818-925` 有完整 body。
- Claim consume、SALES_MANAGE row filter、stable `updatedAt,id`、返回一个页面 DTO。
- replay 返回 `READ_REPLAY_REQUIRES_NEW_CLAIM`，不返回旧销售 DTO。

**P1-D1：丢失 `currentSelectionStatus` 和 `notes`。** R4 list DTO 包含：

```text
R4:1113 currentSelectionStatus
R4:1114 notes
```

R7 的 list `jsonb_build_object` 仅构造 id/project/context/current IDs，没有
`currentSelectionStatus`，也没有 `notes`。这会改变审核和销售页面展示，客户/销售
无法看到 R4 已有的跟进记录与当前选型状态。

### 3.5 `app_get_sales_handoff_context_v2`

- R7 `R7:926-1025` 有完整 body。
- Claim consume、SALES_MANAGE、handoff project scope、resolver、receipt/finalize。
- `NOT_FOUND`/`FORBIDDEN` 有终结路径。

**P1-D2：同样丢失 `notes` 和 `currentSelectionStatus`。** R4 get 的 DTO 包含：

```text
R4:1234 currentSelectionStatus
R4:1235 notes
```

R7 `jsonb_build_object` 没有这两个字段。销售详情页会失去现有后续跟进和选型状态，
属于业务语义回归，不是普通 UI 优化。

## 4. 18 项 Registry 与自包含性

R7 §4 `R7:95-123` 列出 18 项，但其中：

```text
canonical_json_v3 -> R6 §8.1
append_r2_audit_event_v3 -> R6 §5.2
app_create_requirement_version_v3 -> R6 §8.2
app_confirm_requirement_v3 -> R6 §8.3
app_finish_advisor_turn_v3 -> R6 §6.5
app_create_selection_run_v3 -> R6 §6.1
app_update_selection_run_status_v3 -> R6 §6.2
```

以及 Claim consume/finalize/R2 audit 依赖仍指向 R5/R6。

R7 在 `R7:120-123` 明确说实施要使用 R7 的销售 body 和 R6 的其余完整 body。
这与任务明确要求的“R7 自包含、不得要求实施者从 R4/R5/R6 复制片段后拼接”冲突。

**P1-S1：R7 不是自包含最终设计。** 实施者仍需查 R6 获取其余函数、R2 table 和
helper body；如果 R6 与 R7 签名或 helper 版本变化，R7 无法独立证明一致性。

必须修正：将 R7 registry 中所有函数的最终 body 直接放入 R7，或明确缩小 R7
授权范围并把所有未包含函数标记 BLOCKED；不能把 R6 作为实施时的拼接源。

## 5. Claim 全路径矩阵

R7 §5.8 `R7:359-406` 覆盖：

- INVALID_ARGUMENT、NOT_FOUND、FORBIDDEN；
- CLOSED、LEGACY_UNBOUND、CONTEXT_STALE、CONTEXT_EXISTS；
- replay、相同 requestId 相同/不同 payload；
- Claim invalid、唯一冲突、Audit/receipt 失败、响应丢失。

方向正确。R7 五个销售 body 的主要路径均调用 `finalize`，R7 没有函数内部
COMMIT/ROLLBACK；异常传播由调用事务回滚，符合 PostgreSQL PL/pgSQL 语义。

仍需实测：

- 双连接同 Claim；
- deferred trigger 在 COMMIT 边界；
- `ON CONFLICT` 后重读；
- Audit helper 失败；
- receipt/finalize 失败；
- 40001/40P01 和 savepoint；
- response lost 后同 requestId replay。

这些全部是 `NOT VERIFIED`，不是静态 PASS。

## 6. Advisor start version

R7 `R7:518-522` 在 Project `FOR UPDATE` 后执行：

```sql
SELECT coalesce(max(br.version), 0) + 1
INTO v_next_version
FROM public."building_requirement" AS br
WHERE br."projectId" = p_project_id;
```

并在 `R7:538-549` 用该 version 写 requirement/revision，在 receipt/return 中
返回真实 version。设计上修复了 R6 的固定 version 1。

两连接场景：

```text
A: Project lock -> max=N -> insert N+1 -> commit
B: wait -> max=N+1 -> insert N+2 -> commit
```

方向正确；仍需隔离 PostgreSQL 验证。若出现 23505 或 40P01，PR7 没有函数内吞错，
整个事务回滚并要求调用方重试，符合安全边界。

## 7. Schema 依赖

R7 `R7:64-93` 正确列出尚未存在的 R4 Expand 字段：

- `selection_run.requirementProjectId`
- SalesHandoff binding/context fields
- SalesFollowUpNote idempotency fields

当前 Schema 不含这些字段；R7 body 不能在当前数据库编译。该缺口已明确标记为
`NOT IMPLEMENTED / REQUIRED`，但必须完成独立 Expand/Migration：

- 字段类型/NULL；
- composite FK；
- UNIQUE/CHECK；
- Trigger；
- Prisma relation；
- Migration 前/后检查；
- backfill 和失败停止条件。

这不是 R7 body 已通过，而是设计依赖未实施。

## 8. R2 Audit Event 与权限

R7 保持 R6 的 R2 独立 Audit Event 与旧 `public.audit_log` 隔离：

- R2 五个函数使用 `sales_security.r2_audit_event`；
- 旧 Web/Worker file lifecycle audit 不迁移、不撤权；
- R2 event 表不授予 Web/Worker 直接写；
- Audit Event 与业务/receipt 同事务的设计方向正确。

限制：

- R7 没有给出实际 ACL/Catalog 结果；
- R2 event 的 TRUNCATE 防护仍需数据库验证；
- R7 没有重复列出 table/helper 的完整 body，而是引用 R6，受 P1-S1 影响。

## 9. Owner/Runtime/ACL

R7 §5.2 `R7:208-257` 给出五个销售函数的 owner/search_path/ACL，方向正确。
R7 §4 和 §5.6 保留 owner/runtime/old function 迁移要求，但实际角色、membership、
ownership transfer、default ACL、旧连接和 prepared transaction 均未执行。

可确认：

- 五个销售函数的最终签名和 ACL 目标已写出；
- resolver 不授予 Web；
- create/append/list/get 只授予 Web runtime；
- 旧 6 参数 append 和旧 3 参数 get 已列为需要 DROP 的签名。

不可确认：

- 当前 `elevator_app` owner 是否已退出；
- Web/Worker 是否可 SET ROLE；
- 旧函数是否实际不存在或被撤销；
- Catalog 是否与上述完全一致。

## 10. 新发现问题分级

### P0

无静态确认 P0。

### P1

| ID | 文件/行 | 问题 |
|---|---|---|
| P1-S1 | R7 95–123 | R7 自包含要求未满足：13 项函数/R2/Claim helper 仍引用 R6，实施者需要跨文档拼接 |
| P1-D1 | R7 818–925；R4 1113–1114 | list DTO 丢失 `currentSelectionStatus` 和 `notes` |
| P1-D2 | R7 926–1025；R4 1234–1235 | get DTO 丢失 `currentSelectionStatus` 和 `notes` |

### P2

| ID | 文件/行 | 问题 |
|---|---|---|
| P2-C1 | R7 991–1185 | create handoff 的 R2 audit ID/receipt 关联未显式返回 |
| P2-A1 | R6 187–205（R7 引用） | R2 audit Row Trigger 不覆盖 TRUNCATE |
| P2-S2 | R7 359–406 | Claim 控制流矩阵完整，但所有分支仍未实测 |
| P2-R1 | R7 208–257 | 角色/ownership transfer 仍无实际 Catalog 证据 |

### P3

| ID | 问题 |
|---|---|
| P3-D1 | R7 报告 SHA 节位于函数 body 之前，文档语义顺序不佳 |
| P3-D2 | R7 文件仍以 R6 为部分 body 来源，和自包含声明有阅读歧义 |

## 11. 可验证性分类

| 项 | 状态 |
|---|---|
| R7 hash/行数/格式 | PASS BY INSPECTION |
| R7 五个销售函数 body 存在 | PASS BY INSPECTION |
| R7 销售函数 SQL 编译 | NOT VERIFIED |
| R7 Claim 全路径 | PARTIAL / NOT VERIFIED |
| R7 Advisor version 逻辑 | PASS BY INSPECTION / NOT VERIFIED |
| R7 list/get sales DTO | FAIL（字段回归） |
| R7 registry self-contained | FAIL |
| Schema Expand | NOT IMPLEMENTED |
| PostgreSQL constraints/concurrency | NOT VERIFIED |
| R2 Audit Event transaction/ACL | NOT VERIFIED |
| Owner/Runtime transfer | NOT VERIFIED |
| prepared transaction Contract | BLOCKED |

## 12. 必须修正后才能进入受控实施

1. 将 R7 registry 中全部 18 项函数、R2 Audit Event 和 Claim helper 的最终 body
   放进 R7，或正式缩小为只允许五个销售函数的实施范围并标记其余 BLOCKED。
2. 恢复 list/get 的 `notes` 和 `currentSelectionStatus`，或以经审查的业务决定
   明确说明移除；当前不能静默改变 R4 DTO。
3. 在隔离 PostgreSQL 编译并验证五个销售函数、R2 Audit Event、Claim/deferred
   trigger 和 Advisor start 两连接版本。
4. 完成 R4 Schema Expand、函数 ACL/Catalog 和 ownership transfer 的独立审查。

R7 当前的五个销售函数主体和 Advisor version 修复方向可以保留；但由于上述 P1，
整体状态仍必须为 `FAIL — DESIGN CORRECTIONS REQUIRED`。

## 13. Git 与静态检查

审查开始时：

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            156
Untracked recursive files:    167
```

本报告新增后只增加审查文件；未执行 Prisma、SQL、PostgreSQL、Migration、E2E、
Browser、Build、Provider、服务或 Git 写操作。

静态检查：

```text
R7 code fences: balanced
R7 trailing whitespace: 0
R7 conflict markers: 0
R7 undefined placeholders: 0
git diff --check: exit 0，仅有既有 tracked 文件 LF/CRLF warnings
```

新增本报告后的现场：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            157
Untracked recursive files:    168
```

## 14. 报告 SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
e30f9e8f763aba4f3ecd6550f55922b487cab27bb9d7f7cdedfdda47d421f643

Bytes:                    13523
Physical lines:           375
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符，
对 UTF-8 文件字节计算 SHA-256。
