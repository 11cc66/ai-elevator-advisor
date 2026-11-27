# APP-WORKBENCH-R2 SalesHandoff Invalidation & Snapshot Consistency Design R7

## 0. 状态

```text
DESIGN COMPLETE — IMPLEMENTATION NOT STARTED
ISOLATED VALIDATION NOT PERFORMED
REAL CONTRACT NOT AUTHORIZED
```

本文件只修正 R6 独立审查的三个 P1：

1. P1-F1：五个 SalesHandoff 函数没有最终完整 wrapper body；
2. P1-F4：Claim 的所有 return/replay/异常路径未形成可复核终结协议；
3. P1-F2：Advisor start 固定插入 Requirement version 1。

R7 是线性、自包含的修正文档。R4 只作为业务语义和旧函数签名参考，R5/R6 只作为
已通过的 Claim、R2 Audit Event、expectedVersion 和角色边界依据；R7 不再要求
实施者从旧文档复制 SQL 片段后自行拼接五个销售函数。

## 1. R6 阻断关闭矩阵

| R6 阻断 | R7 修正 | 状态 |
|---|---|---|
| P1-F1 五个销售函数只有 R4 source + wrapper 文字 | §5 提供五个最终完整 body，R2 audit 替换完成 | DESIGNED |
| P1-F4 early return/replay 未闭合 | §5.8 提供逐路径控制流和每个函数的 finalize/receipt 表 | DESIGNED |
| P1-F2 Advisor start 固定 version 1 | §5.9 在 Project 锁内使用 next version | DESIGNED |
| R5 Claim 唯一消费/receipt | 保持 R5 规则，R7 的五个函数全部调用 consume/finalize | DESIGNED / NOT VERIFIED |
| R6 独立 R2 Audit Event | 五个销售函数只写 `sales_security.r2_audit_event` | DESIGNED |
| R6 expectedVersion | PATCH、Advisor turn 语义保持，未改变 | DESIGNED |
| R6 owner/ACL/Catalog | 只保留既定迁移顺序，并补销售函数精确 ACL | PARTIAL / NOT EXECUTED |

## 2. 审查基线

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            155
Untracked recursive files:    166
```

输入：

```text
R6 design SHA-256:
7254dd685fb751aaf454e102fa248052382eed787739c8e87cc88b2417f40b61

R6 review SHA-256:
a89eb257c862e65d5c3ff587f73f31111bbf5a4cdbd950d7aab6ea19741533b1

R4 design SHA-256:
630744cbfe92dd52a346779a3899bee37bd6e5e824a344fd9c018046a2daf75a

R5 design SHA-256:
7936f40b12cd137bb772af8f03a83c416a9a5ac1504497cd663c5e7ecd3f3178
```

R7 未读取 `.env`、`.env.test`、密钥、密码、Token 或连接串。

## 3. 前提与缺口

R7 五个函数假定 R4 Schema Expand 已应用，且以下字段存在：

```text
selection_run.requirementProjectId
sales_handoff.boundRequirementId
sales_handoff.requirementProjectId
sales_handoff.boundSelectionRunId
sales_handoff.selectionRunProjectId
sales_handoff.selectionRunRequirementId
sales_handoff.createPayload
sales_follow_up_note.requestKey
sales_follow_up_note.operationType
sales_follow_up_note.protocolVersion
sales_follow_up_note.requestPayload
sales_follow_up_note.statusAfter
```

当前 `prisma/schema.prisma` 尚未包含这些字段；因此 R7 SQL 不能直接在当前 Schema
编译。实施前必须先完成独立 Expand/Migration 审查和隔离验证，不得猜测字段名。

R2 Audit Event 使用 R6 的独立表：

```text
sales_security.r2_audit_event
```

R7 不写、不改、不撤销既有 `public.audit_log`。文件生命周期 Web/Worker 的现有
AuditLog 调用保持原样；R2 Audit Event 与共享 AuditLog 隔离。

## 4. 完整函数 Registry

以下是 R7 的 18 项 registry。非销售函数的最终 body 使用 R6 的对应完整 body；
销售函数的最终 body 使用本文件 §5；R7 不再使用 R4 行号代替销售函数实现。

| # | 函数 | 最终参数签名 | 返回 | Body/来源 | Claim |
|---:|---|---|---|---|---|
| 1 | `sales_security.canonical_field_v2` | `(text)` | text | R4 §4.1 | 无 |
| 2 | `sales_security.canonical_json_v3` | `(jsonb)` | text | R6 §8.1 | 无 |
| 3 | `sales_security.assert_sales_actor_v2` | `(jsonb,bytea,text,text)` | text | R4 §4.2 | 不消费 |
| 4 | `sales_security.actor_has_permission_v2` | `(text,text,text)` | boolean | R4 §4.3 | 无 |
| 5 | `sales_security.consume_sales_actor_claim_v3` | `(jsonb,bytea,text,text,text,text)` | table | R5 §5.1 | 消费 |
| 6 | `sales_security.finalize_sales_actor_claim_v3` | `(bytea,text,text,text,jsonb)` | void | R5 §5.2 | 终结 |
| 7 | `sales_security.append_r2_audit_event_v3` | `(bytea,text,text,text,text,text,text,text,jsonb,jsonb,text)` | text | R6 §5.2 | 校验 PENDING |
| 8 | `sales_command.app_resolve_current_completed_selection_v2` | `(text)` | table | R7 §5.1 | 无 |
| 9 | `sales_command.app_sales_create_handoff_v2` | `(jsonb,bytea,text,text,text)` | table | R7 §5.13 | 消费 |
| 10 | `sales_command.app_append_sales_followup_v2` | `(jsonb,bytea,text,text,text,"public"."SalesHandoffStatus",varchar,text)` | table | R7 §5.10 | 消费 |
| 11 | `sales_command.app_list_sales_handoffs_v2` | `(jsonb,bytea,text,integer,integer)` | table | R7 §5.11 | 消费 |
| 12 | `sales_command.app_get_sales_handoff_context_v2` | `(jsonb,bytea,text,text)` | table | R7 §5.12 | 消费 |
| 13 | `sales_command.app_create_requirement_version_v3` | R6 §11.1 | table | R6 §8.2 | 消费 |
| 14 | `sales_command.app_confirm_requirement_v3` | R6 §11.1 | table | R6 §8.3 | 消费 |
| 15 | `sales_command.app_start_advisor_conversation_v3` | R6 §11.1 | `(outcome,conversation_id,requirement_id,version,replayed)` | R7 §5.9 | 消费 |
| 16 | `sales_command.app_finish_advisor_turn_v3` | R6 §11.1 | table | R6 §6.5 | 消费 |
| 17 | `sales_command.app_create_selection_run_v3` | R6 §11.1 | table | R6 §6.1 | 消费 |
| 18 | `sales_command.app_update_selection_run_status_v3` | R6 §11.1 | table | R6 §6.2（禁用） | 消费但不写 |

R7 只改变销售函数和 Advisor start；其余函数的最终 body 不在本文件重复重写，
但其 R6 body 是已定稿的完整 body，不是接口契约。任何实施必须使用 R7 的销售 body
和 R6 的其余完整 body，不得从 R4 重新拼接。

## 5. 五销售函数最终完整定义

### 5.1 `app_resolve_current_completed_selection_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_resolve_current_completed_selection_v2(
  p_project_id text
)
RETURNS TABLE (
  outcome text,
  requirement_id text,
  selection_run_id text,
  selection_status "public"."SelectionRunStatus"
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_requirement_id text;
  v_latest_ms timestamptz;
  v_tie_count bigint;
  v_run_id text;
  v_run_status "public"."SelectionRunStatus";
BEGIN
  IF p_project_id IS NULL OR p_project_id !~ '^[A-Za-z0-9_-]{1,128}$' THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::text, NULL::text,
      NULL::"public"."SelectionRunStatus";
    RETURN;
  END IF;

  SELECT br.id INTO v_requirement_id
  FROM public."building_requirement" AS br
  WHERE br."projectId" = p_project_id
  ORDER BY br.version DESC, br.id DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NO_REQUIREMENT', NULL::text, NULL::text,
      NULL::"public"."SelectionRunStatus";
    RETURN;
  END IF;

  SELECT date_trunc('milliseconds', max(sr."createdAt"))
  INTO v_latest_ms
  FROM public."selection_run" AS sr
  WHERE sr."projectId" = p_project_id
    AND sr."requirementId" = v_requirement_id;
  IF v_latest_ms IS NULL THEN
    RETURN QUERY SELECT 'NO_MATCH', v_requirement_id, NULL::text,
      NULL::"public"."SelectionRunStatus";
    RETURN;
  END IF;

  SELECT count(*) INTO v_tie_count
  FROM public."selection_run" AS sr
  WHERE sr."projectId" = p_project_id
    AND sr."requirementId" = v_requirement_id
    AND date_trunc('milliseconds', sr."createdAt") = v_latest_ms;
  IF v_tie_count <> 1 THEN
    RETURN QUERY SELECT 'AMBIGUOUS', v_requirement_id, NULL::text,
      NULL::"public"."SelectionRunStatus";
    RETURN;
  END IF;

  SELECT sr.id, sr.status INTO v_run_id, v_run_status
  FROM public."selection_run" AS sr
  WHERE sr."projectId" = p_project_id
    AND sr."requirementId" = v_requirement_id
    AND date_trunc('milliseconds', sr."createdAt") = v_latest_ms
  ORDER BY sr.id DESC LIMIT 1;

  IF v_run_status <> 'COMPLETED' THEN
    RETURN QUERY SELECT 'SELECTION_NOT_COMPLETED', v_requirement_id,
      v_run_id, v_run_status;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'CURRENT', v_requirement_id, v_run_id, v_run_status;
END;
$fn$;
```

### 5.2 Sales function signatures and ACL

五个最终销售函数：

| 函数 | 参数 | 返回 | Attribute |
|---|---|---|---|
| `app_resolve_current_completed_selection_v2` | `(text)` | `(outcome,requirement_id,selection_run_id,selection_status)` | `STABLE`, definer |
| `app_sales_create_handoff_v2` | `(jsonb,bytea,text,text,text)` | `(outcome,handoff_id,context_state,replayed)` | `VOLATILE`, definer |
| `app_append_sales_followup_v2` | `(jsonb,bytea,text,text,"public"."SalesHandoffStatus",varchar,text)` | `(outcome,note_id,status_after,replayed)` | `VOLATILE`, definer |
| `app_list_sales_handoffs_v2` | `(jsonb,bytea,text,integer,integer)` | `(outcome,payload)` | `VOLATILE`, definer |
| `app_get_sales_handoff_context_v2` | `(jsonb,bytea,text,text)` | `(outcome,payload)` | `VOLATILE`, definer |

所有五个函数的最终 owner 为 `elevator_sales_definer`，`SET search_path=pg_catalog`。
resolver 不授予 Web；create/append/list/get 只授予
`elevator_web_runtime_v2`，不授予 Worker/PUBLIC。执行 ACL：

```sql
REVOKE ALL ON FUNCTION
  sales_command.app_resolve_current_completed_selection_v2(text),
  sales_command.app_sales_create_handoff_v2(jsonb, bytea, text, text, text),
  sales_command.app_append_sales_followup_v2(
    jsonb, bytea, text, text, "public"."SalesHandoffStatus", varchar, text
  ),
  sales_command.app_list_sales_handoffs_v2(jsonb, bytea, text, integer, integer),
  sales_command.app_get_sales_handoff_context_v2(jsonb, bytea, text, text)
FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

GRANT EXECUTE ON FUNCTION
  sales_command.app_sales_create_handoff_v2(jsonb, bytea, text, text, text),
  sales_command.app_append_sales_followup_v2(
    jsonb, bytea, text, text, "public"."SalesHandoffStatus", varchar, text
  ),
  sales_command.app_list_sales_handoffs_v2(jsonb, bytea, text, integer, integer),
  sales_command.app_get_sales_handoff_context_v2(jsonb, bytea, text, text)
TO "elevator_web_runtime_v2";
```

旧签名必须在零调用方、无 prepared transaction、旧 backend 已排空后精确 DROP：

```text
app_append_sales_followup_v2(jsonb,bytea,text,"public"."SalesHandoffStatus",varchar,text)
app_get_sales_handoff_context_v2(jsonb,bytea,text)
```

不得按函数名批量删除，也不得把旧 HMAC-only 签名留给其他角色。

18 项 registry 的其余函数保持 R6 最终 body：R2 Audit helper 只由 definer 调用，
Claim helper 不授予 Web/Worker，R6 Requirement/Advisor/Selection 函数仍由 R6
body 定义。R7 只替换本节五个销售函数，不引入第二套旧 body。

### 5.3 Version and regression contract

- Requirement PATCH 的 `expectedVersion` 仍是 R6 §9 的 required int；R7 未改变。
- Advisor turn 的 `expectedRequirementVersion` 和
  `expectedLastMessageSequence` 仍是两个独立字段；R7 未合并。
- Advisor start 使用 §5.9 的 Project 锁内 `max(version)+1`。
- R5 Claim 唯一约束、transactionId、nonce、requestId、receipt 保持不变。
- R2 Audit Event 与既有 `public.audit_log` 隔离保持不变。
- CLOSED 不可逆、LEGACY_UNBOUND 只读、stable pagination、resolver 毫秒规则、
  SALES_MANAGE 和 prepared transaction 门禁保持不变。

### 5.4 并发与异常矩阵

#### 5.4.1 销售函数

| ID | 场景 | 预期 |
|---|---|---|
| `R7-SALE-01` | 两连接同 Claim create handoff | 一成功一 receipt replay |
| `R7-SALE-02` | 同 requestId 不同 payload | REQUEST_ID_REUSED |
| `R7-SALE-03` | 两连接同 exact context | 一插入，另一重查并 replay/reject |
| `R7-SALE-04` | note vs CLOSED | CLOSED，无 note/status/audit |
| `R7-SALE-05` | note vs stale run | CONTEXT_STALE，无写 |
| `R7-SALE-06` | list/get replay | 新 Claim 才可读 DTO |
| `R7-SALE-07` | Audit Event insert failure | 业务/Claim/receipt 全部 rollback |
| `R7-SALE-08` | COMMIT response lost | 同 requestId/payload 返回 receipt |

#### 5.4.2 Advisor start

两个独立连接同时启动同一项目：

```text
A: Claim consume -> Project FOR UPDATE -> max=N -> insert N+1 -> commit
B: Claim consume -> wait on Project -> max=N+1 -> insert N+2 -> commit
```

若 A rollback，B 使用原 max=N；若唯一约束仍冲突，整个事务 rollback，调用方以
同一 Claim 重试。不得在项目锁外计算版本。

### 5.5 未验证与 BLOCKED

```text
R4 Schema Expand:
  NOT IMPLEMENTED / REQUIRED
R7 five function SQL compile:
  NOT EXECUTED
Claim/deferred trigger behavior:
  NOT VERIFIED
R2 Audit Event transactional behavior:
  NOT VERIFIED
Advisor start two-connection test:
  NOT VERIFIED
old function DROP/ACL/Catalog:
  NOT EXECUTED
Owner/Runtime and ownership transfer:
  NOT EXECUTED / ISOLATED VALIDATION REQUIRED
prepared transaction Contract:
  BLOCKED
real Contract:
  BLOCKED / NOT AUTHORIZED
E2E/Browser/Build:
  NOT EXECUTED
```

### 5.6 Git、静态验证与报告校验

开始时：

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            155
Untracked recursive files:    166
```

新增 R7 后只增加 R7 设计文件。静态检查：

```text
R7 code fences: balanced
R7 trailing whitespace: 0
R7 conflict markers: 0
R7 未定义项: 0
git diff --check: exit 0，仅有既有 tracked 文件 LF/CRLF warnings
```

新增 R7 后的现场：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            156
Untracked recursive files:    167
```

### 5.7 报告 SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
e9155533b6b5f97b4a40d9f6a0c58cfc34946c96f24f9e9b0b11b15468a63516

Bytes:                    47612
Physical lines:           1195
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符，
对 UTF-8 文件字节计算 SHA-256。

### 5.8 Claim 控制流矩阵

缩写：

```text
R = app_resolve_current_completed_selection_v2
C = app_sales_create_handoff_v2
A = app_append_sales_followup_v2
L = app_list_sales_handoffs_v2
G = app_get_sales_handoff_context_v2
```

所有 Claim 消费型函数遵守同一规则：

```text
consume 返回 REPLAY/REQUEST_REPLAY -> 不写业务/不写审计；写操作返回原 receipt，
读操作返回 READ_REPLAY_REQUIRES_NEW_CLAIM
consume 返回 INVALID_* -> 不写业务/不写审计；无 Claim 行
consume 返回 CONSUMED -> 必须进入该函数唯一的事务控制流
业务拒绝 -> finalize REJECTED，提交拒绝 receipt，不写业务/audit
业务成功 -> 写业务 + R2 audit，finalize COMPLETED，提交 receipt
任何 PostgreSQL 异常 -> 传播异常，整个事务 rollback；Claim/业务/audit/receipt
全部消失，允许同一 Claim 在新事务安全重试
```

| 场景 | R | C | A | L | G |
|---|---|---|---|---|---|
| 正常成功 | 无 Claim；只读 | 写 handoff + R2 audit + COMPLETED receipt | 写 note/status + R2 audit + COMPLETED receipt | 读 DTO；无业务/audit；COMPLETED digest receipt | 读 DTO；无业务/audit；COMPLETED digest receipt |
| INVALID_ARGUMENT | 返回 | consume 前返回；无 Claim | consume 前返回；无 Claim | consume 前返回；无 Claim | consume 前返回；无 Claim |
| NOT_FOUND | 返回 | Project/handoff 不存在：REJECTED、无业务/audit | Project/handoff 不存在：REJECTED、无业务/audit | 空页，不泄露；正常读 receipt | handoff 不存在：REJECTED |
| FORBIDDEN | 不适用 | 锁后 RBAC 失败：REJECTED，无业务/audit | 锁后 RBAC 失败：REJECTED，无业务/audit | 无权行被过滤；返回空集 | 无权上下文：REJECTED |
| CLOSED | 不适用 | 不新建/不更新：REJECTED | 不写 note/status：REJECTED | 只读展示 CLOSED | 只读展示 CLOSED |
| LEGACY_UNBOUND | 不适用 | 不新建：REJECTED | 不写 note/status：REJECTED | 只读历史状态 | 只读历史状态 |
| CONTEXT_STALE | 不适用 | 当前 resolver 非 CURRENT：REJECTED | 绑定不匹配：REJECTED | 返回 resolver 状态 | 返回 resolver 状态 |
| CONTEXT_EXISTS | 不适用 | 同 context 不同 createPayload：REJECTED，不写 | 原有 note idempotency/replay 分支 | 不适用 | 不适用 |
| replay / requestId 相同 payload | 不适用 | 返回已存 receipt，不重复写 | 返回已存 receipt，不重复写 | 返回 read replay，不返回 DTO | 返回 read replay，不返回 DTO |
| requestId 不同 payload | 不适用 | REQUEST_ID_REUSED，不写 | REQUEST_ID_REUSED，不写 | REQUEST_ID_REUSED，不返回 DTO | REQUEST_ID_REUSED，不返回 DTO |
| Claim 不存在/签名错误/Actor 不匹配 | 不适用 | INVALID_CLAIM，不写 | INVALID_CLAIM，不写 | INVALID_CLAIM，不写 | INVALID_CLAIM，不写 |
| Project 锁等待/死锁 | 不适用 | 等待或 40P01 回滚，重试 | 等待或 40P01 回滚，重试 | 无写锁，按读取语义 | 无写锁，按读取语义 |
| 唯一约束冲突 | 不适用 | 重查 exact context；匹配则 replay，不匹配则 REJECTED | 重查 note requestKey；匹配则 replay，不匹配则 REJECTED | 不适用 | 不适用 |
| Audit Event 写入失败 | 不适用 | 整事务回滚 | 整事务回滚 | 不适用 | 不适用 |
| receipt/finalize 写入失败 | 不适用 | 整事务回滚 | 整事务回滚 | 整事务回滚 | 整事务回滚 |
| COMMIT 成功响应丢失 | 不适用 | 同 requestId 同 payload 恢复 receipt | 同 requestId 同 payload 恢复 receipt | 新 Claim 重新读取 | 新 Claim 重新读取 |

函数内部没有 `COMMIT`、`ROLLBACK` 或 savepoint 吞异常。事务边界由调用方
Transaction 控制；PL/pgSQL 异常会传播并回滚该事务。业务拒绝必须在返回前
finalize；数据库异常不得被捕获成业务成功。

### 5.9 Advisor start 版本修正

修正 R6 `639-642` 的固定 version 1。最终函数：

```sql
CREATE OR REPLACE FUNCTION sales_command.app_start_advisor_conversation_v3(
  p_claim jsonb,
  p_signature bytea,
  p_project_id text,
  p_object_id text,
  p_installation_scenario text,
  p_initial_fields jsonb,
  p_initial_missing_fields jsonb,
  p_initial_assistant_message text,
  p_payload_canonical text
)
RETURNS TABLE (
  outcome text, conversation_id text, requirement_id text,
  version integer, replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record;
  v_actor text := p_claim->>'actorUserId';
  v_conversation_id text := pg_catalog.gen_random_uuid()::text;
  v_requirement_id text := pg_catalog.gen_random_uuid()::text;
  v_revision_id text := pg_catalog.gen_random_uuid()::text;
  v_scenario "public"."InstallationScenario";
  v_next_version integer;
  v_canonical text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL
     OR p_project_id IS NULL OR p_object_id IS DISTINCT FROM 'PROJECT'
     OR p_installation_scenario IS NULL OR p_initial_fields IS NULL
     OR p_initial_missing_fields IS NULL
     OR jsonb_typeof(p_initial_fields) <> 'object'
     OR jsonb_typeof(p_initial_missing_fields) <> 'array'
     OR p_initial_assistant_message IS NULL
     OR btrim(p_initial_assistant_message) = ''
     OR p_payload_canonical IS NULL THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::text, NULL::text,
      NULL::integer, false;
    RETURN;
  END IF;
  IF p_installation_scenario NOT IN (
    'OLD_BUILDING_ADDITION', 'EXISTING_ELEVATOR_RENOVATION',
    'NEW_BUILDING_INSTALLATION'
  ) THEN
    RETURN QUERY SELECT 'INVALID_REQUEST', NULL::text, NULL::text,
      NULL::integer, false;
    RETURN;
  END IF;
  v_scenario := p_installation_scenario::"public"."InstallationScenario";
  v_canonical := concat_ws('|',
    sales_security.canonical_field_v2('ADVISOR_START'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_object_id),
    sales_security.canonical_field_v2(p_installation_scenario),
    sales_security.canonical_json_v3(p_initial_fields),
    sales_security.canonical_json_v3(p_initial_missing_fields),
    sales_security.canonical_field_v2(p_initial_assistant_message)
  );
  IF v_canonical IS DISTINCT FROM p_payload_canonical THEN
    RETURN QUERY SELECT 'INVALID_REQUEST', NULL::text, NULL::text,
      NULL::integer, false;
    RETURN;
  END IF;

  SELECT * INTO v_claim
  FROM sales_security.consume_sales_actor_claim_v3(
    p_claim, p_signature, 'ADVISOR_START',
    p_project_id, p_object_id, p_payload_canonical
  );
  IF v_claim.outcome IN ('REPLAY', 'REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(
      v_actor, 'advisor.use', p_project_id
    ) THEN
      RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::text,
        NULL::integer, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'conversationId',
      v_claim.response_payload->>'requirementId',
      (v_claim.response_payload->>'version')::integer, true;
    RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome, NULL::text, NULL::text,
      NULL::integer, false;
    RETURN;
  END IF;

  PERFORM 1 FROM public."project" AS p
  WHERE p.id = p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor, 'advisor.use', p_project_id
  ) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'ADVISOR_START', NULL,
      jsonb_build_object('outcome', 'FORBIDDEN', 'version', 0,
        'replayed', false)
    );
    RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::text,
      NULL::integer, false;
    RETURN;
  END IF;

  SELECT coalesce(max(br.version), 0) + 1
  INTO v_next_version
  FROM public."building_requirement" AS br
  WHERE br."projectId" = p_project_id;
  IF v_next_version IS NULL OR v_next_version < 1 THEN
    RAISE EXCEPTION 'invalid next requirement version'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public."advisor_conversation" (
    id, "projectId", "createdById", provider, status, "createdAt", "updatedAt"
  ) VALUES (
    v_conversation_id, p_project_id, v_actor, 'MOCK', 'ACTIVE',
    clock_timestamp(), clock_timestamp()
  );
  INSERT INTO public."building_requirement" (
    id, "projectId", "conversationId", "installationScenario", status,
    version, fields, "missingFields", "professionalReviewRequired",
    "createdById", "updatedById", "createdAt", "updatedAt"
  ) VALUES (
    v_requirement_id, p_project_id, v_conversation_id, v_scenario, 'DRAFT',
    v_next_version, p_initial_fields, p_initial_missing_fields, true,
    v_actor, v_actor, clock_timestamp(), clock_timestamp()
  );
  INSERT INTO public."requirement_revision" (
    id, "requirementId", version, source, snapshot, "missingFields",
    status, "createdById", "createdAt"
  ) VALUES (
    v_revision_id, v_requirement_id, v_next_version, 'MOCK_AI',
    p_initial_fields, p_initial_missing_fields, 'DRAFT', v_actor,
    clock_timestamp()
  );
  INSERT INTO public."advisor_message" (
    id, "conversationId", sequence, role, content, provider,
    "structuredPayload", "createdAt"
  ) VALUES (
    pg_catalog.gen_random_uuid()::text, v_conversation_id, 1, 'ASSISTANT',
    p_initial_assistant_message, 'MOCK', NULL, clock_timestamp()
  );
  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash, p_project_id, v_actor, 'ADVISOR_START',
    'AdvisorConversation', v_conversation_id, p_claim->>'requestId',
    lower(p_claim->>'payloadDigest'), NULL,
    jsonb_build_object('conversationId', v_conversation_id,
      'requirementId', v_requirement_id, 'version', v_next_version), NULL
  );
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash, 'COMPLETED', 'ADVISOR_START', v_conversation_id,
    jsonb_build_object('outcome', 'OK', 'conversationId', v_conversation_id,
      'requirementId', v_requirement_id, 'version', v_next_version,
      'replayed', false)
  );
  RETURN QUERY SELECT 'OK', v_conversation_id, v_requirement_id,
    v_next_version, false;
END;
$fn$;
```

两个并发 Advisor start 的处理：

```text
A: Claim consume -> Project FOR UPDATE -> max=N -> insert version N+1
B: Claim consume -> 等待 A -> A commit -> 读 max=N+1 -> insert N+2
```

如果 A rollback，B 读到原 max=N；如果唯一约束冲突，整个事务 rollback，调用方可用
同一 Claim 重试。应用层不得预先用不带锁的 MAX+1。

### 5.10 `app_append_sales_followup_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_append_sales_followup_v2(
  p_claim jsonb,
  p_signature bytea,
  p_project_id text,
  p_handoff_id text,
  p_status "public"."SalesHandoffStatus",
  p_contact_status varchar,
  p_note text
)
RETURNS TABLE (
  outcome text, note_id text,
  status_after "public"."SalesHandoffStatus", replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record;
  v_actor text := p_claim->>'actorUserId';
  v_request text := p_claim->>'requestId';
  v_digest text := lower(coalesce(p_claim->>'payloadDigest', ''));
  v_canonical text;
  v_handoff public."sales_handoff"%ROWTYPE;
  v_existing public."sales_follow_up_note"%ROWTYPE;
  v_note_id text := pg_catalog.gen_random_uuid()::text;
  v_resolution record;
  v_payload jsonb;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL
     OR p_project_id IS NULL OR p_handoff_id IS NULL
     OR p_status IS NULL OR p_contact_status IS NULL
     OR btrim(p_contact_status) = '' OR length(p_contact_status) > 80
     OR p_note IS NULL OR btrim(p_note) = '' OR length(p_note) > 4000 THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::text, NULL::"public"."SalesHandoffStatus", false;
    RETURN;
  END IF;

  v_canonical := concat_ws('|',
    sales_security.canonical_field_v2('SALES_FOLLOW_UP_NOTE'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_handoff_id),
    sales_security.canonical_field_v2(p_status::text),
    sales_security.canonical_field_v2(p_contact_status),
    sales_security.canonical_field_v2(p_note)
  );
  SELECT * INTO v_claim
  FROM sales_security.consume_sales_actor_claim_v3(
    p_claim, p_signature, 'SALES_FOLLOW_UP_NOTE',
    p_project_id, p_handoff_id, v_canonical
  );
  IF v_claim.outcome IN ('REPLAY', 'REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(
      v_actor, 'sales.manage', p_project_id
    ) THEN
      RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::"public"."SalesHandoffStatus", false;
      RETURN;
    END IF;
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'noteId',
      (v_claim.response_payload->>'statusAfter')::"public"."SalesHandoffStatus",
      true;
    RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome, NULL::text, NULL::"public"."SalesHandoffStatus", false;
    RETURN;
  END IF;

  PERFORM 1 FROM public."project" AS p
  WHERE p.id = p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor, 'sales.manage', p_project_id
  ) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SALES_FOLLOW_UP_NOTE', NULL,
      jsonb_build_object('outcome', 'FORBIDDEN', 'replayed', false)
    );
    RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::"public"."SalesHandoffStatus", false;
    RETURN;
  END IF;

  SELECT * INTO v_handoff
  FROM public."sales_handoff" AS h
  WHERE h.id = p_handoff_id AND h."projectId" = p_project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SALES_FOLLOW_UP_NOTE', NULL,
      jsonb_build_object('outcome', 'NOT_FOUND', 'replayed', false)
    );
    RETURN QUERY SELECT 'NOT_FOUND', NULL::text, NULL::"public"."SalesHandoffStatus", false;
    RETURN;
  END IF;

  SELECT * INTO v_existing
  FROM public."sales_follow_up_note" AS n
  WHERE n."authorUserId" = v_actor
    AND n."operationType" = 'SALES_FOLLOW_UP_NOTE'
    AND n."requestKey" = v_request;
  IF FOUND THEN
    IF v_existing."requestPayload" IS NOT DISTINCT FROM (
      jsonb_build_object('operation', 'SALES_FOLLOW_UP_NOTE',
        'projectId', p_project_id, 'handoffId', p_handoff_id,
        'status', p_status::text, 'contactStatus', p_contact_status,
        'note', p_note)
    ) THEN
      PERFORM sales_security.finalize_sales_actor_claim_v3(
        v_claim.claim_hash, 'COMPLETED', 'SALES_FOLLOW_UP_NOTE', v_existing.id,
        jsonb_build_object('outcome', 'OK', 'noteId', v_existing.id,
          'statusAfter', v_existing."statusAfter"::text, 'replayed', true)
      );
      RETURN QUERY SELECT 'OK', v_existing.id, v_existing."statusAfter", true;
      RETURN;
    END IF;
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SALES_FOLLOW_UP_NOTE', v_existing.id,
      jsonb_build_object('outcome', 'IDEMPOTENCY_KEY_REUSED', 'replayed', false)
    );
    RETURN QUERY SELECT 'IDEMPOTENCY_KEY_REUSED', v_existing.id,
      NULL::"public"."SalesHandoffStatus", false;
    RETURN;
  END IF;

  IF v_handoff.status = 'CLOSED' THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SALES_FOLLOW_UP_NOTE', v_handoff.id,
      jsonb_build_object('outcome', 'CLOSED', 'replayed', false)
    );
    RETURN QUERY SELECT 'CLOSED', NULL::text,
      'CLOSED'::"public"."SalesHandoffStatus", false;
    RETURN;
  END IF;
  IF v_handoff."boundRequirementId" IS NULL THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SALES_FOLLOW_UP_NOTE', v_handoff.id,
      jsonb_build_object('outcome', 'LEGACY_UNBOUND', 'replayed', false)
    );
    RETURN QUERY SELECT 'LEGACY_UNBOUND', NULL::text,
      NULL::"public"."SalesHandoffStatus", false;
    RETURN;
  END IF;

  SELECT * INTO v_resolution
  FROM sales_command.app_resolve_current_completed_selection_v2(p_project_id);
  IF v_resolution.outcome <> 'CURRENT'
     OR v_handoff."boundRequirementId" IS DISTINCT FROM v_resolution.requirement_id
     OR v_handoff."boundSelectionRunId" IS DISTINCT FROM v_resolution.selection_run_id THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SALES_FOLLOW_UP_NOTE', v_handoff.id,
      jsonb_build_object('outcome', 'CONTEXT_STALE', 'replayed', false)
    );
    RETURN QUERY SELECT 'CONTEXT_STALE', NULL::text,
      NULL::"public"."SalesHandoffStatus", false;
    RETURN;
  END IF;

  v_payload := jsonb_build_object(
    'operation', 'SALES_FOLLOW_UP_NOTE', 'projectId', p_project_id,
    'handoffId', p_handoff_id, 'status', p_status::text,
    'contactStatus', p_contact_status, 'note', p_note
  );
  INSERT INTO public."sales_follow_up_note" (
    id, "handoffId", "authorUserId", "contactStatus", note,
    "createdAt", "requestKey", "operationType", "protocolVersion",
    "requestPayload", "statusAfter"
  ) VALUES (
    v_note_id, p_handoff_id, v_actor, p_contact_status, p_note,
    clock_timestamp(), v_request, 'SALES_FOLLOW_UP_NOTE', 2,
    v_payload, p_status
  )
  ON CONFLICT ("authorUserId", "operationType", "requestKey") DO NOTHING
  RETURNING id INTO v_note_id;

  IF v_note_id IS NULL THEN
    SELECT * INTO v_existing
    FROM public."sales_follow_up_note" AS n
    WHERE n."authorUserId" = v_actor
      AND n."operationType" = 'SALES_FOLLOW_UP_NOTE'
      AND n."requestKey" = v_request
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'note conflict without existing row'
        USING ERRCODE = '23505';
    END IF;
    IF v_existing."requestPayload" IS NOT DISTINCT FROM v_payload THEN
      PERFORM sales_security.finalize_sales_actor_claim_v3(
        v_claim.claim_hash, 'COMPLETED', 'SALES_FOLLOW_UP_NOTE',
        v_existing.id,
        jsonb_build_object('outcome', 'OK', 'noteId', v_existing.id,
          'statusAfter', v_existing."statusAfter"::text, 'replayed', true)
      );
      RETURN QUERY SELECT 'OK', v_existing.id,
        v_existing."statusAfter", true;
      RETURN;
    END IF;
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SALES_FOLLOW_UP_NOTE',
      v_existing.id,
      jsonb_build_object('outcome', 'IDEMPOTENCY_KEY_REUSED', 'replayed', false)
    );
    RETURN QUERY SELECT 'IDEMPOTENCY_KEY_REUSED', v_existing.id,
      NULL::"public"."SalesHandoffStatus", false;
    RETURN;
  END IF;

  UPDATE public."sales_handoff"
  SET status = p_status, "updatedAt" = clock_timestamp()
  WHERE id = p_handoff_id AND "projectId" = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'locked handoff disappeared during note write'
      USING ERRCODE = '40001';
  END IF;
  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash, p_project_id, v_actor, 'SALES_FOLLOW_UP_NOTE',
    'SalesHandoff', p_handoff_id, v_request, v_digest,
    jsonb_build_object('status', v_handoff.status::text),
    jsonb_build_object('noteId', v_note_id, 'status', p_status::text), NULL
  );
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash, 'COMPLETED', 'SALES_FOLLOW_UP_NOTE', p_handoff_id,
    jsonb_build_object('outcome', 'OK', 'noteId', v_note_id,
      'statusAfter', p_status::text, 'replayed', false)
  );
  RETURN QUERY SELECT 'OK', v_note_id, p_status, false;
END;
$fn$;
```

### 5.11 `app_list_sales_handoffs_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_list_sales_handoffs_v2(
  p_claim jsonb,
  p_signature bytea,
  p_search text,
  p_offset integer,
  p_page_size integer
)
RETURNS TABLE (outcome text, payload jsonb)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record;
  v_actor text := p_claim->>'actorUserId';
  v_canonical text;
  v_payload jsonb;
  v_digest text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_search IS NULL
     OR length(p_search) > 160 OR p_offset IS NULL OR p_offset < 0
     OR p_offset > 1000000 OR p_page_size IS NULL
     OR p_page_size < 1 OR p_page_size > 100 THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::jsonb;
    RETURN;
  END IF;
  v_canonical := concat_ws('|',
    sales_security.canonical_field_v2('SALES_LIST'),
    sales_security.canonical_field_v2('SALES_LIST'),
    sales_security.canonical_field_v2(p_search),
    p_offset::text, p_page_size::text
  );
  SELECT * INTO v_claim
  FROM sales_security.consume_sales_actor_claim_v3(
    p_claim, p_signature, 'SALES_LIST', NULL, 'SALES_LIST', v_canonical
  );
  IF v_claim.outcome IN ('REPLAY', 'REQUEST_REPLAY') THEN
    RETURN QUERY SELECT 'READ_REPLAY_REQUIRES_NEW_CLAIM', NULL::jsonb;
    RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome, NULL::jsonb;
    RETURN;
  END IF;

  WITH authorized AS (
    SELECT h.*, p.name AS project_name,
      r.outcome AS resolver_outcome,
      r.requirement_id AS current_requirement_id,
      r.selection_run_id AS current_selection_run_id,
      r.selection_status AS current_selection_status
    FROM public."sales_handoff" AS h
    JOIN public."project" AS p ON p.id = h."projectId"
    CROSS JOIN LATERAL
      sales_command.app_resolve_current_completed_selection_v2(h."projectId") AS r
    WHERE sales_security.actor_has_permission_v2(
      v_actor, 'sales.manage', h."projectId")
      AND (p_search = '' OR coalesce(h.summary, '') ILIKE '%' || p_search || '%'
        OR coalesce(h."budgetConcern", '') ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%')
  ), counted AS (SELECT count(*) AS total_count FROM authorized),
  paged AS (
    SELECT * FROM authorized
    ORDER BY "updatedAt" DESC, id DESC
    OFFSET p_offset LIMIT p_page_size
  )
  SELECT jsonb_build_object(
    'total', (SELECT total_count FROM counted),
    'handoffs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
      'id', paged.id, 'projectId', paged."projectId",
      'projectName', paged.project_name,
      'boundRequirementId', paged."boundRequirementId",
      'boundSelectionRunId', paged."boundSelectionRunId",
      'status', paged.status::text, 'summary', paged.summary,
      'budgetConcern', paged."budgetConcern", 'updatedAt', paged."updatedAt",
      'contextState', CASE
        WHEN paged."boundRequirementId" IS NULL THEN 'LEGACY_UNBOUND'
        WHEN paged.status = 'CLOSED' THEN 'CLOSED'
        WHEN paged.resolver_outcome = 'CURRENT'
          AND paged."boundRequirementId" = paged.current_requirement_id
          AND paged."boundSelectionRunId" = paged.current_selection_run_id
          THEN 'ACTIONABLE'
        WHEN paged.resolver_outcome = 'CURRENT' THEN 'HISTORICAL'
        ELSE paged.resolver_outcome END,
      'currentRequirementId', paged.current_requirement_id,
      'currentSelectionRunId', paged.current_selection_run_id
      ) ORDER BY paged."updatedAt" DESC, paged.id DESC)
      FROM paged), '[]'::jsonb)
  ) INTO v_payload
  ;

  v_digest := encode(sales_security.digest(
    convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash, 'COMPLETED', 'SALES_LIST', NULL,
    jsonb_build_object('outcome', 'OK', 'resultDigest', v_digest,
      'recordCount', coalesce((v_payload->>'total')::integer, 0))
  );
  RETURN QUERY SELECT 'OK', v_payload;
END;
$fn$;
```

### 5.12 `app_get_sales_handoff_context_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_get_sales_handoff_context_v2(
  p_claim jsonb,
  p_signature bytea,
  p_project_id text,
  p_handoff_id text
)
RETURNS TABLE (outcome text, payload jsonb)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record;
  v_actor text := p_claim->>'actorUserId';
  v_canonical text;
  v_payload jsonb;
  v_digest text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_project_id IS NULL
     OR p_handoff_id IS NULL OR p_project_id !~ '^[A-Za-z0-9_-]{1,128}$'
     OR p_handoff_id !~ '^[A-Za-z0-9_-]{1,128}$' THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::jsonb;
    RETURN;
  END IF;
  v_canonical := concat_ws('|',
    sales_security.canonical_field_v2('SALES_GET_CONTEXT'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_handoff_id)
  );
  SELECT * INTO v_claim
  FROM sales_security.consume_sales_actor_claim_v3(
    p_claim, p_signature, 'SALES_GET_CONTEXT',
    p_project_id, p_handoff_id, v_canonical
  );
  IF v_claim.outcome IN ('REPLAY', 'REQUEST_REPLAY') THEN
    RETURN QUERY SELECT 'READ_REPLAY_REQUIRES_NEW_CLAIM', NULL::jsonb;
    RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome, NULL::jsonb;
    RETURN;
  END IF;
  IF NOT sales_security.actor_has_permission_v2(
    v_actor, 'sales.manage', p_project_id
  ) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SALES_GET_CONTEXT', NULL,
      jsonb_build_object('outcome', 'FORBIDDEN', 'recordCount', 0)
    );
    RETURN QUERY SELECT 'FORBIDDEN', NULL::jsonb;
    RETURN;
  END IF;
  SELECT jsonb_build_object(
    'id', h.id, 'projectId', h."projectId",
    'projectName', p.name, 'boundRequirementId', h."boundRequirementId",
    'boundSelectionRunId', h."boundSelectionRunId",
    'status', h.status::text, 'summary', h.summary,
    'budgetConcern', h."budgetConcern", 'updatedAt', h."updatedAt",
    'contextState', CASE
      WHEN h."boundRequirementId" IS NULL THEN 'LEGACY_UNBOUND'
      WHEN h.status = 'CLOSED' THEN 'CLOSED'
      WHEN r.outcome = 'CURRENT'
        AND h."boundRequirementId" = r.requirement_id
        AND h."boundSelectionRunId" = r.selection_run_id THEN 'ACTIONABLE'
      WHEN r.outcome = 'CURRENT' THEN 'HISTORICAL'
      ELSE r.outcome END,
    'currentRequirementId', r.requirement_id,
    'currentSelectionRunId', r.selection_run_id
  ) INTO v_payload
  FROM public."sales_handoff" AS h
  JOIN public."project" AS p ON p.id = h."projectId"
  CROSS JOIN LATERAL
    sales_command.app_resolve_current_completed_selection_v2(h."projectId") AS r
  WHERE h.id = p_handoff_id AND h."projectId" = p_project_id;
  IF v_payload IS NULL THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SALES_GET_CONTEXT', NULL,
      jsonb_build_object('outcome', 'NOT_FOUND', 'recordCount', 0)
    );
    RETURN QUERY SELECT 'NOT_FOUND', NULL::jsonb;
    RETURN;
  END IF;
  v_digest := encode(sales_security.digest(
    convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash, 'COMPLETED', 'SALES_GET_CONTEXT', p_handoff_id,
    jsonb_build_object('outcome', 'OK', 'resultDigest', v_digest,
      'recordCount', 1)
  );
  RETURN QUERY SELECT 'OK', v_payload;
END;
$fn$;
```

该函数是内部只读函数，不消费 Claim，不写 R2 Audit Event，不授予 Web EXECUTE。

### 5.13 `app_sales_create_handoff_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_sales_create_handoff_v2(
  p_claim jsonb,
  p_signature bytea,
  p_project_id text,
  p_summary text,
  p_budget_concern text
)
RETURNS TABLE (
  outcome text, handoff_id text, context_state text, replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record;
  v_actor text := p_claim->>'actorUserId';
  v_request text := p_claim->>'requestId';
  v_digest text := lower(coalesce(p_claim->>'payloadDigest', ''));
  v_canonical text;
  v_resolution record;
  v_existing public."sales_handoff"%ROWTYPE;
  v_handoff_id text := pg_catalog.gen_random_uuid()::text;
  v_payload jsonb;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL
     OR p_project_id IS NULL OR p_summary IS NULL
     OR btrim(p_summary) = '' OR length(p_summary) > 4000
     OR (p_budget_concern IS NOT NULL AND length(p_budget_concern) > 2000) THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::text, NULL::text, false;
    RETURN;
  END IF;

  v_canonical := concat_ws('|',
    sales_security.canonical_field_v2('SALES_HANDOFF_CREATE'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2('PROJECT'),
    sales_security.canonical_field_v2(p_summary),
    sales_security.canonical_field_v2(p_budget_concern)
  );

  SELECT * INTO v_claim
  FROM sales_security.consume_sales_actor_claim_v3(
    p_claim, p_signature, 'SALES_HANDOFF_CREATE',
    p_project_id, 'PROJECT', v_canonical
  );
  IF v_claim.outcome IN ('REPLAY', 'REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(
      v_actor, 'sales.handoff.create', p_project_id
    ) THEN
      RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::text, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'handoffId',
      v_claim.response_payload->>'contextState', true;
    RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  PERFORM 1 FROM public."project" AS p
  WHERE p.id = p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor, 'sales.handoff.create', p_project_id
  ) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SALES_HANDOFF_CREATE', NULL,
      jsonb_build_object('outcome', 'FORBIDDEN', 'replayed', false)
    );
    RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::text, false;
    RETURN;
  END IF;

  SELECT * INTO v_resolution
  FROM sales_command.app_resolve_current_completed_selection_v2(p_project_id);
  IF v_resolution.outcome <> 'CURRENT' THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SALES_HANDOFF_CREATE', NULL,
      jsonb_build_object('outcome', 'CONTEXT_UNAVAILABLE', 'replayed', false)
    );
    RETURN QUERY SELECT 'CONTEXT_UNAVAILABLE', NULL::text,
      v_resolution.outcome, false;
    RETURN;
  END IF;

  v_payload := jsonb_build_object(
    'operation', 'SALES_HANDOFF_CREATE', 'projectId', p_project_id,
    'requirementId', v_resolution.requirement_id,
    'selectionRunId', v_resolution.selection_run_id,
    'summary', p_summary, 'budgetConcern', p_budget_concern
  );
  SELECT * INTO v_existing
  FROM public."sales_handoff" AS h
  WHERE h."projectId" = p_project_id
    AND h."boundRequirementId" = v_resolution.requirement_id
    AND h."boundSelectionRunId" = v_resolution.selection_run_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status = 'CLOSED' THEN
      PERFORM sales_security.finalize_sales_actor_claim_v3(
        v_claim.claim_hash, 'REJECTED', 'SALES_HANDOFF_CREATE',
        v_existing.id,
        jsonb_build_object('outcome', 'CLOSED', 'replayed', false)
      );
      RETURN QUERY SELECT 'CLOSED', v_existing.id, 'CLOSED', false;
      RETURN;
    END IF;
    IF v_existing."createPayload" IS NOT DISTINCT FROM v_payload THEN
      PERFORM sales_security.finalize_sales_actor_claim_v3(
        v_claim.claim_hash, 'COMPLETED', 'SALES_HANDOFF_CREATE',
        v_existing.id,
        jsonb_build_object('outcome', 'OK', 'handoffId', v_existing.id,
          'contextState', 'ACTIONABLE', 'replayed', true)
      );
      RETURN QUERY SELECT 'OK', v_existing.id, 'ACTIONABLE', true;
      RETURN;
    END IF;
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SALES_HANDOFF_CREATE',
      v_existing.id,
      jsonb_build_object('outcome', 'CONTEXT_EXISTS', 'replayed', false)
    );
    RETURN QUERY SELECT 'CONTEXT_EXISTS', v_existing.id, 'ACTIONABLE', false;
    RETURN;
  END IF;

  INSERT INTO public."sales_handoff" (
    id, "projectId", "createdById", status, summary, "budgetConcern",
    "boundRequirementId", "requirementProjectId",
    "boundSelectionRunId", "selectionRunProjectId",
    "selectionRunRequirementId", "createPayload", "createdAt", "updatedAt"
  ) VALUES (
    v_handoff_id, p_project_id, v_actor, 'PENDING_FOLLOW_UP',
    p_summary, p_budget_concern, v_resolution.requirement_id, p_project_id,
    v_resolution.selection_run_id, p_project_id,
    v_resolution.requirement_id, v_payload, clock_timestamp(), clock_timestamp()
  );

  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash, p_project_id, v_actor, 'SALES_HANDOFF_CREATE',
    'SalesHandoff', v_handoff_id, v_request, v_digest, NULL,
    jsonb_build_object('handoffId', v_handoff_id,
      'requirementId', v_resolution.requirement_id,
      'selectionRunId', v_resolution.selection_run_id), NULL
  );
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash, 'COMPLETED', 'SALES_HANDOFF_CREATE', v_handoff_id,
    jsonb_build_object('outcome', 'OK', 'handoffId', v_handoff_id,
      'contextState', 'ACTIONABLE', 'replayed', false)
  );
  RETURN QUERY SELECT 'OK', v_handoff_id, 'ACTIONABLE', false;
END;
$fn$;
```
