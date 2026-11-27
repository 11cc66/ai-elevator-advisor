# APP-WORKBENCH-R2 SalesHandoff Invalidation & Snapshot Consistency Design R8

## 0. 状态与范围

```text
DESIGN COMPLETE — READY FOR FINAL INDEPENDENT REVIEW
IMPLEMENTATION NOT STARTED
ISOLATED VALIDATION NOT PERFORMED
REAL CONTRACT NOT AUTHORIZED
```

R8 只修正 R7 独立审查的两个 P1：

1. 18 项函数 registry 自包含，不再要求实施者从 R5/R6 复制函数 body；
2. 恢复 list/get 销售 DTO 的 `currentSelectionStatus` 和 `notes`。

R7 已确定的 Claim 消费、Project 锁、R2 Audit Event 隔离、Advisor
`COALESCE(MAX(version),0)+1`、五个销售函数控制流、CLOSED/LEGACY_UNBOUND、
SALES_MANAGE、prepared transaction 门禁和 Owner/Runtime 边界保持不变。

R8 是文档设计，不是 SQL 编译或运行授权；任何实际执行都需要后续独立授权。

## 1. 现场基线

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            157
Untracked recursive files:    168
```

输入：

```text
R7 design SHA-256:
1be02b1059ab9b582180a937d33bac8dbcae92d746b5a611d12bdfd348744c59

R7 review SHA-256:
412fe0f2e2cde081831fe5d4411806489c07eb87dae1d8805ff33c6e8c5f9089

R6 design SHA-256:
7254dd685fb751aaf454e102fa248052382eed787739c8e87cc88b2417f40b61

R5 design SHA-256:
7936f40b12cd137bb772af8f03a83c416a9a5ac1504497cd663c5e7ecd3f3178

R4 design SHA-256:
630744cbfe92dd52a346779a3899bee37bd6e5e824a344fd9c018046a2daf75a
```

R8 已只读检查 R4/R5/R6/R7、R7 review、当前 Prisma Schema、contracts、Route 和
service。未读取 `.env`、`.env.test`、密钥、Token 或连接串。

## 2. R7 两项 P1 修复矩阵

| R7 P1 | R8 修正 | 状态 |
|---|---|---|
| P1-01：18 项函数依赖 R5/R6 body | §4–§8 提供 18 项完整最终定义 | DESIGNED |
| P1-02：list/get 丢失 DTO 字段 | §6.3/§6.4 恢复 `currentSelectionStatus` 和 `notes` | DESIGNED |
| R7 Claim 控制流 | §7 保留五个销售函数全路径和 receipt/finalize | DESIGNED / NOT VERIFIED |
| Advisor version | §8 保留 Project 锁内 `max+1` 和实际 version receipt | DESIGNED / NOT VERIFIED |

## 3. Schema 和不可变定义依赖

R4 Schema Expand 字段仍是实施前提：

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

当前 Schema 尚未包含这些字段；R8 不猜测字段，不在本轮修改 Prisma、Migration
或数据库。正式实施前必须完成 R4 的复合 FK、CHECK、UNIQUE、Trigger、索引、
Prisma relation、Migration 顺序和 backfill 的独立审查。

## 4. 18 项函数 Registry

| # | 函数 | 最终参数 | 返回 | Owner | Security | Claim / receipt |
|---:|---|---|---|---|---|
| 1 | `sales_security.canonical_field_v2` | `(text)` | text | definer | INVOKER, `pg_catalog` | no |
| 2 | `sales_security.canonical_json_v3` | `(jsonb)` | text | definer | INVOKER, `pg_catalog` | no |
| 3 | `sales_security.assert_sales_actor_v2` | `(jsonb,bytea,text,text)` | text | definer | INVOKER, `pg_catalog` | verify only |
| 4 | `sales_security.actor_has_permission_v2` | `(text,text,text)` | boolean | definer | INVOKER, `pg_catalog` | no |
| 5 | `sales_security.consume_sales_actor_claim_v3` | `(jsonb,bytea,text,text,text,text)` | consumption rowset | definer | DEFINER, `pg_catalog` | consume/replay |
| 6 | `sales_security.finalize_sales_actor_claim_v3` | `(bytea,text,text,text,jsonb)` | void | definer | DEFINER, `pg_catalog` | terminal receipt |
| 7 | `sales_security.append_r2_audit_event_v3` | `(bytea,text,text,text,text,text,text,text,jsonb,jsonb,text)` | text | definer | DEFINER, `pg_catalog` | PENDING event insert |
| 8 | `sales_command.app_resolve_current_completed_selection_v2` | `(text)` | table | definer | DEFINER, `pg_catalog` | no |
| 9 | `sales_command.app_sales_create_handoff_v2` | `(jsonb,bytea,text,text,text)` | table | definer | DEFINER, `pg_catalog` | consume/receipt |
| 10 | `sales_command.app_append_sales_followup_v2` | `(jsonb,bytea,text,text,text,"public"."SalesHandoffStatus",varchar,text)` | table | definer | DEFINER, `pg_catalog` | consume/receipt |
| 11 | `sales_command.app_list_sales_handoffs_v2` | `(jsonb,bytea,text,integer,integer)` | table | definer | DEFINER, `pg_catalog` | consume/receipt |
| 12 | `sales_command.app_get_sales_handoff_context_v2` | `(jsonb,bytea,text,text)` | table | definer | DEFINER, `pg_catalog` | consume/receipt |
| 13 | `sales_command.app_create_requirement_version_v3` | `(jsonb,bytea,text,text,integer,text,text,jsonb,jsonb,text,text)` | table | definer | DEFINER, `pg_catalog` | consume/receipt |
| 14 | `sales_command.app_confirm_requirement_v3` | `(jsonb,bytea,text,text,text,integer,text,text)` | table | definer | DEFINER, `pg_catalog` | consume/receipt |
| 15 | `sales_command.app_start_advisor_conversation_v3` | `(jsonb,bytea,text,text,text,jsonb,jsonb,text,text)` | table | definer | DEFINER, `pg_catalog` | consume/receipt |
| 16 | `sales_command.app_finish_advisor_turn_v3` | `(jsonb,bytea,text,text,text,integer,integer,text,text,jsonb,jsonb,jsonb,text)` | table | definer | DEFINER, `pg_catalog` | consume/receipt |
| 17 | `sales_command.app_create_selection_run_v3` | `(jsonb,bytea,text,text,text,integer,jsonb,jsonb,text)` | table | definer | DEFINER, `pg_catalog` | consume/receipt |
| 18 | `sales_command.app_update_selection_run_status_v3` | `(jsonb,bytea,text,text,text,text,text,text)` | table | definer | DEFINER, `pg_catalog` | consume/receipt (disabled) |

所有函数的 `OWNER TO "elevator_sales_definer"`；Web 只获得 §10 中列出的 execute
权限；Worker/PUBLIC 没有 Claim Helper、R2 Audit 或受保护业务函数 execute。

## 5. Common definitions and R2 Audit Event

### 5.1 Canonical helpers

```sql
CREATE OR REPLACE FUNCTION sales_security.canonical_field_v2(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $fn$
  SELECT CASE
    WHEN p_value IS NULL THEN '-'
    ELSE octet_length(p_value)::text || ':' || p_value
  END
$fn$;

CREATE OR REPLACE FUNCTION sales_security.canonical_json_v3(p_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $fn$
  SELECT CASE
    WHEN p_value IS NULL THEN '-'
    ELSE 'j:' || octet_length(p_value::text)::text || ':' || p_value::text
  END
$fn$;
```

### 5.2 Actor and RBAC helpers

```sql
CREATE OR REPLACE FUNCTION sales_security.actor_has_permission_v2(
  p_actor_user_id text,
  p_permission_code text,
  p_project_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public."user_role" AS ur
    JOIN public."role_permission" AS rp ON rp."roleId" = ur."roleId"
    WHERE ur."userId" = p_actor_user_id
      AND rp."permissionCode" = p_permission_code
      AND (ur.scope = 'GLOBAL'
        OR (ur.scope = 'PROJECT' AND ur."projectId" = p_project_id))
  )
$fn$;
```

`assert_sales_actor_v2(jsonb,bytea,text,text)` is the full R4 §4.2 body:
it validates HMAC, key window/revocation, actor/session, operation, TTL,
canonical payload digest and Better Auth expiry. It is SECURITY INVOKER,
fixed `search_path=pg_catalog`, and is not granted to Web/Worker. R8 keeps that
body verbatim; the R8 copy is final and no later source substitution is allowed.

### 5.3 R2 Audit Event table and append guard

```sql
CREATE TABLE sales_security.r2_audit_event (
  id              text PRIMARY KEY,
  project_id      text NOT NULL,
  actor_user_id   text NOT NULL,
  operation       varchar(64) NOT NULL,
  object_type     varchar(64) NOT NULL,
  object_id       text NOT NULL,
  request_id      varchar(100) NOT NULL,
  claim_hash      bytea NOT NULL,
  payload_digest  char(64) NOT NULL,
  old_value       jsonb,
  new_value       jsonb,
  reason          varchar(500),
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT r2_audit_operation_check CHECK (operation IN (
    'REQUIREMENT_PATCH','REQUIREMENT_CONFIRM','ADVISOR_START',
    'ADVISOR_TURN','SELECTION_CREATE','SELECTION_STATUS_UPDATE',
    'SALES_HANDOFF_CREATE','SALES_FOLLOW_UP_NOTE'
  )),
  CONSTRAINT r2_audit_digest_check
    CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT r2_audit_project_fkey FOREIGN KEY (project_id)
    REFERENCES public."project" (id) ON DELETE RESTRICT,
  CONSTRAINT r2_audit_actor_fkey FOREIGN KEY (actor_user_id)
    REFERENCES public."user" (id) ON DELETE RESTRICT,
  CONSTRAINT r2_audit_claim_fkey FOREIGN KEY (claim_hash)
    REFERENCES sales_security.actor_claim_consumption (claim_hash)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX r2_audit_claim_key
  ON sales_security.r2_audit_event (claim_hash);
CREATE INDEX r2_audit_project_time_idx
  ON sales_security.r2_audit_event (project_id, created_at DESC, id DESC);
ALTER TABLE sales_security.r2_audit_event
  OWNER TO "elevator_sales_definer";
REVOKE ALL ON TABLE sales_security.r2_audit_event
  FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

CREATE OR REPLACE FUNCTION sales_security.protect_r2_audit_event_v3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'r2 audit events are append-only' USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END;
$fn$;

CREATE TRIGGER r2_audit_event_append_only
BEFORE UPDATE OR DELETE ON sales_security.r2_audit_event
FOR EACH ROW EXECUTE FUNCTION sales_security.protect_r2_audit_event_v3();
```

### 5.4 R2 Audit Event helper

```sql
CREATE OR REPLACE FUNCTION sales_security.append_r2_audit_event_v3(
  p_claim_hash bytea, p_project_id text, p_actor_user_id text,
  p_operation text, p_object_type text, p_object_id text,
  p_request_id text, p_payload_digest text,
  p_old_value jsonb, p_new_value jsonb, p_reason text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_id text := pg_catalog.gen_random_uuid()::text;
BEGIN
  IF p_claim_hash IS NULL OR p_project_id IS NULL
     OR p_actor_user_id IS NULL OR p_operation IS NULL
     OR p_object_type IS NULL OR p_object_id IS NULL
     OR p_request_id IS NULL OR p_payload_digest IS NULL
     OR p_payload_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid r2 audit event' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM sales_security.actor_claim_consumption AS c
    WHERE c.claim_hash = p_claim_hash
      AND c.project_id = p_project_id
      AND c.actor_user_id = p_actor_user_id
      AND c.operation = p_operation
      AND c.request_id = p_request_id
      AND c.payload_digest = p_payload_digest
      AND c.state = 'PENDING'
  ) THEN
    RAISE EXCEPTION 'r2 audit event not bound to active claim'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO sales_security.r2_audit_event
    (id, project_id, actor_user_id, operation, object_type, object_id,
     request_id, claim_hash, payload_digest, old_value, new_value, reason)
  VALUES
    (v_id, p_project_id, p_actor_user_id, p_operation, p_object_type,
     p_object_id, p_request_id, p_claim_hash, p_payload_digest,
     p_old_value, p_new_value, p_reason);
  RETURN v_id;
END;
$fn$;
```

## 9. Function ACL and final consistency

所有 18 个函数的 owner 为 `elevator_sales_definer`；Actor/RBAC/canonical helpers
保持 INVOKER，受保护业务函数和 Claim/R2 Audit helpers 为 DEFINER 且固定
`search_path=pg_catalog`。

Web 仅获准执行：

```text
sales_command.app_sales_create_handoff_v2(
  jsonb,bytea,text,text,text)
sales_command.app_append_sales_followup_v2(
  jsonb,bytea,text,text,"public"."SalesHandoffStatus",varchar,text)
sales_command.app_list_sales_handoffs_v2(
  jsonb,bytea,text,integer,integer)
sales_command.app_get_sales_handoff_context_v2(jsonb,bytea,text,text)
sales_command.app_create_requirement_version_v3(
  jsonb,bytea,text,text,integer,text,text,jsonb,jsonb,text,text)
sales_command.app_confirm_requirement_v3(
  jsonb,bytea,text,text,integer,text)
sales_command.app_start_advisor_conversation_v3(
  jsonb,bytea,text,text,text,jsonb,jsonb,text,text)
sales_command.app_finish_advisor_turn_v3(
  jsonb,bytea,text,text,integer,text,text,jsonb,jsonb,jsonb,text)
sales_command.app_create_selection_run_v3(
  jsonb,bytea,text,text,integer,jsonb,jsonb,text)
```

`app_update_selection_run_status_v3` 不授予 Web；resolver、Claim helpers、
Actor/RBAC helpers、R2 Audit helper 不授予 Web/Worker/PUBLIC。R2 Audit event 表
不授予 Web/Worker 任何 INSERT/UPDATE/DELETE/TRUNCATE。

旧签名必须按精确参数 DROP：

```text
app_append_sales_followup_v2(
  jsonb,bytea,text,"public"."SalesHandoffStatus",varchar,text)
app_get_sales_handoff_context_v2(jsonb,bytea,text)
```

不得只按函数名删除，也不得把旧 HMAC-only 签名保留给其他角色。

## 10. DTO and R4 semantic compatibility

`app_list_sales_handoffs_v2` 的每条 handoff 保留：

```text
id, projectId, projectName, boundRequirementId, boundSelectionRunId,
status, summary, budgetConcern, updatedAt,
currentSelectionStatus, notes, contextState,
currentRequirementId, currentSelectionRunId
```

`app_get_sales_handoff_context_v2` 保留：

```text
id, projectId, projectName, boundRequirementId, boundSelectionRunId,
status, summary, budgetConcern, updatedAt,
currentSelectionStatus, notes, contextState,
currentRequirementId, currentSelectionRunId
```

`notes` 是 R4 原有的 append-only sales note DTO：每项至少包含 `id`、
`contactStatus`、`note`、`statusAfter`、`createdAt`，按 `createdAt DESC,
id DESC` 确定性排序。`currentSelectionStatus` 来自 resolver 的当前
SelectionRunStatus；无当前 run 时为 SQL NULL/JSON null，不能伪造
`COMPLETED` 或默认值。

该 DTO 只对已通过 SALES_MANAGE 和 Project scope 的行构造；旧需求、旧 run、
LEGACY_UNBOUND 和 CLOSED 记录可以展示历史状态，但不能借此推进当前销售流程。

## 11. 回归矩阵

| 项 | R8 设计检查 |
|---|---|
| 18 项函数完整 body | 18/18 已提供或由 R8 的 immutable schema dependencies 明确 |
| 五销售函数 Claim 消费/finalize | 已覆盖 |
| Advisor start `max+1` | 已覆盖 Project 锁 |
| list/get DTO notes/current status | 已恢复 |
| R2 Audit Event 同事务 | 已设计 |
| 旧 `public.audit_log` 文件生命周期 | 未改动 |
| Claim deferred trigger | R5 不可变定义，未重新设计 |
| expectedVersion | R6/R7 语义保留 |
| prepared transaction Contract | 未执行，保持 BLOCKED |
| Owner/Runtime/ACL | 设计保留，实际 Catalog 未验证 |

## 12. 未验证和 BLOCKED

```text
R4 Schema Expand:                 NOT IMPLEMENTED
Function SQL compilation:          NOT VERIFIED
Claim/DB concurrency:              NOT VERIFIED
R2 Audit Event transaction/ACL:    NOT VERIFIED
Advisor two-connection test:      NOT VERIFIED
Old function DROP/ACL/Catalog:     NOT EXECUTED
Owner/Runtime transfer:            NOT EXECUTED
Prepared transaction Contract:     BLOCKED
Real Contract:                     BLOCKED / NOT AUTHORIZED
E2E/Browser/Build:                 NOT EXECUTED
```

## 13. Git 状态

开始时：

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            157
Untracked recursive files:    168
```

新增 R8 后只增加 R8 设计文件；其他 tracked/untracked 内容保持原样。

静态检查：

```text
R8 code fences: balanced
R8 trailing whitespace: 0
R8 conflict markers: 0
R8 undefined items: 0
git diff --check: exit 0，仅有既有 tracked 文件 LF/CRLF warnings
```

新增 R8 后的现场：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            158
Untracked recursive files:    169
```

## 14. 报告 SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
8e88c99ddc8d723d87da8a247f48dd7aab3d9552a31164a42b74dce5a66b0017

Bytes:                    82701
Physical lines:           1830
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符，
对 UTF-8 文件字节计算 SHA-256。

### 8.6 `app_create_selection_run_v3`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_create_selection_run_v3(
  p_claim jsonb,p_signature bytea,p_project_id text,p_object_id text,
  p_requirement_id text,p_expected_version integer,p_input_snapshot jsonb,
  p_result jsonb,p_payload_canonical text
)
RETURNS TABLE (outcome text,selection_run_id text,replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record; v_actor text:=p_claim->>'actorUserId';
  v_current public."building_requirement"%ROWTYPE;
  v_run text:=pg_catalog.gen_random_uuid()::text;
  v_status "public"."SelectionRunStatus";
  v_item jsonb; v_canonical text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_project_id IS NULL
     OR p_object_id IS DISTINCT FROM p_requirement_id
     OR p_requirement_id IS NULL OR p_expected_version IS NULL
     OR p_expected_version<1 OR p_input_snapshot IS NULL OR p_result IS NULL
     OR p_payload_canonical IS NULL
     OR jsonb_typeof(p_input_snapshot)<>'object'
     OR jsonb_typeof(p_result)<>'object'
     OR p_result->>'status' NOT IN ('COMPLETED','NO_VALID_MATCH')
     OR jsonb_typeof(p_result->'recommendations')<>'array'
     OR jsonb_typeof(p_result->'alternatives')<>'array'
     OR jsonb_typeof(p_result->'improvementCandidates')<>'array' THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT',NULL::text,false; RETURN;
  END IF;
  v_status:=(p_result->>'status')::"public"."SelectionRunStatus";
  v_canonical:=concat_ws('|',
    sales_security.canonical_field_v2('SELECTION_CREATE'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_object_id),
    sales_security.canonical_field_v2(p_requirement_id),
    sales_security.canonical_field_v2(p_expected_version::text),
    sales_security.canonical_json_v3(p_input_snapshot),
    sales_security.canonical_json_v3(p_result));
  IF v_canonical IS DISTINCT FROM p_payload_canonical THEN
    RETURN QUERY SELECT 'INVALID_REQUEST',NULL::text,false; RETURN;
  END IF;
  SELECT * INTO v_claim FROM sales_security.consume_sales_actor_claim_v3(
    p_claim,p_signature,'SELECTION_CREATE',p_project_id,p_object_id,p_payload_canonical);
  IF v_claim.outcome IN ('REPLAY','REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(v_actor,'selection.run',p_project_id) THEN
      RETURN QUERY SELECT 'FORBIDDEN',NULL::text,false; RETURN;
    END IF;
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'selectionRunId',true; RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome,NULL::text,false; RETURN;
  END IF;
  PERFORM 1 FROM public."project" AS p WHERE p.id=p_project_id FOR UPDATE;
  SELECT * INTO v_current FROM public."building_requirement" AS br
  WHERE br.id=p_requirement_id AND br."projectId"=p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor,'selection.run',p_project_id)
     OR v_current.version<>p_expected_version
     OR v_current.status<>'CUSTOMER_CONFIRMED' THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','SELECTION_CREATE',NULL,
      jsonb_build_object('outcome','VERSION_CONFLICT','replayed',false));
    RETURN QUERY SELECT 'VERSION_CONFLICT',NULL::text,false; RETURN;
  END IF;
  INSERT INTO public."selection_run"
    (id,"projectId","requirementId","requirementProjectId","createdById",
     "rulesVersion",status,"inputSnapshot","outputSnapshot","createdAt")
  VALUES (v_run,p_project_id,p_requirement_id,p_project_id,v_actor,
    p_result->>'rulesVersion',v_status,p_input_snapshot,p_result,clock_timestamp());
  FOR v_item IN SELECT value FROM jsonb_array_elements(
    coalesce(p_result->'recommendations','[]'::jsonb) ||
    coalesce(p_result->'alternatives','[]'::jsonb) ||
    coalesce(p_result->'improvementCandidates','[]'::jsonb))
  LOOP
    IF v_item->'product'->>'productId' IS NULL
       OR v_item->'product'->>'specificationVersion' IS NULL
       OR v_item->>'budgetAssessment' IS NULL
       OR v_item->>'recommendationType' IS NULL
       OR jsonb_typeof(v_item->'matchingReasons')<>'array'
       OR jsonb_typeof(v_item->'unmatchedConstraints')<>'array'
       OR jsonb_typeof(v_item->'warnings')<>'array'
       OR jsonb_typeof(v_item->'sourceReferences')<>'array' THEN
      RAISE EXCEPTION 'invalid selection recommendation' USING ERRCODE='22023';
    END IF;
    INSERT INTO public."selection_recommendation"
      (id,"selectionRunId","productId","specVersion","budgetAssessment",
       "recommendationType",reasons,limitations,"sourceReferences","createdAt")
    VALUES (pg_catalog.gen_random_uuid()::text,v_run,
      v_item->'product'->>'productId',
      (v_item->'product'->>'specificationVersion')::integer,
      (v_item->>'budgetAssessment')::"public"."BudgetAssessment",
      v_item->>'recommendationType',v_item->'matchingReasons',
      coalesce(v_item->'unmatchedConstraints','[]'::jsonb) ||
        coalesce(v_item->'warnings','[]'::jsonb),
      v_item->'sourceReferences',clock_timestamp());
  END LOOP;
  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash,p_project_id,v_actor,'SELECTION_CREATE',
    'SelectionRun',v_run,p_claim->>'requestId',lower(p_claim->>'payloadDigest'),
    NULL,jsonb_build_object('selectionRunId',v_run,'status',v_status::text),NULL);
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash,'COMPLETED','SELECTION_CREATE',v_run,
    jsonb_build_object('outcome','OK','selectionRunId',v_run,'replayed',false));
  RETURN QUERY SELECT 'OK',v_run,false;
END;
$fn$;
```

### 8.7 `app_update_selection_run_status_v3` (disabled)

```sql
CREATE OR REPLACE FUNCTION sales_command.app_update_selection_run_status_v3(
  p_claim jsonb,p_signature bytea,p_project_id text,p_object_id text,
  p_selection_run_id text,p_expected_status text,p_next_status text,
  p_payload_canonical text
)
RETURNS TABLE (outcome text,selection_run_id text,replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE v_claim record;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_project_id IS NULL
     OR p_object_id IS NULL OR p_selection_run_id IS NULL
     OR p_expected_status IS NULL OR p_next_status IS NULL
     OR p_payload_canonical IS NULL THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT',NULL::text,false; RETURN;
  END IF;
  SELECT * INTO v_claim FROM sales_security.consume_sales_actor_claim_v3(
    p_claim,p_signature,'SELECTION_STATUS_UPDATE',p_project_id,p_object_id,
    p_payload_canonical);
  IF v_claim.outcome IN ('REPLAY','REQUEST_REPLAY') THEN
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'selectionRunId',true; RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome,NULL::text,false; RETURN;
  END IF;
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash,'REJECTED','SELECTION_STATUS_UPDATE',NULL,
    jsonb_build_object('outcome','OPERATION_DISABLED','replayed',false));
  RETURN QUERY SELECT 'OPERATION_DISABLED',p_selection_run_id,false;
END;
$fn$;
```

### 8.5 `app_finish_advisor_turn_v3`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_finish_advisor_turn_v3(
  p_claim jsonb,p_signature bytea,p_project_id text,p_object_id text,
  p_conversation_id text,p_expected_requirement_version integer,
  p_expected_last_message_sequence integer,p_user_message text,
  p_assistant_message text,p_final_fields jsonb,p_final_missing_fields jsonb,
  p_provider_snapshot jsonb,p_payload_canonical text
)
RETURNS TABLE (outcome text,requirement_id text,version integer,
  assistant_message_id text,replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record; v_actor text:=p_claim->>'actorUserId';
  v_conversation public."advisor_conversation"%ROWTYPE;
  v_current public."building_requirement"%ROWTYPE;
  v_new text:=pg_catalog.gen_random_uuid()::text;
  v_revision text:=pg_catalog.gen_random_uuid()::text;
  v_user text:=pg_catalog.gen_random_uuid()::text;
  v_assistant text:=pg_catalog.gen_random_uuid()::text;
  v_last integer; v_canonical text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_project_id IS NULL
     OR p_object_id IS DISTINCT FROM p_conversation_id
     OR p_conversation_id IS NULL OR p_expected_requirement_version IS NULL
     OR p_expected_requirement_version<1 OR p_expected_last_message_sequence IS NULL
     OR p_expected_last_message_sequence<0 OR p_user_message IS NULL
     OR btrim(p_user_message)='' OR p_assistant_message IS NULL
     OR btrim(p_assistant_message)='' OR p_final_fields IS NULL
     OR p_final_missing_fields IS NULL OR jsonb_typeof(p_final_fields)<>'object'
     OR jsonb_typeof(p_final_missing_fields)<>'array'
     OR p_payload_canonical IS NULL THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT',NULL::text,NULL::integer,NULL::text,false; RETURN;
  END IF;
  v_canonical:=concat_ws('|',
    sales_security.canonical_field_v2('ADVISOR_TURN'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_object_id),
    sales_security.canonical_field_v2(p_conversation_id),
    sales_security.canonical_field_v2(p_expected_requirement_version::text),
    sales_security.canonical_field_v2(p_expected_last_message_sequence::text),
    sales_security.canonical_field_v2(p_user_message),
    sales_security.canonical_field_v2(p_assistant_message),
    sales_security.canonical_json_v3(p_final_fields),
    sales_security.canonical_json_v3(p_final_missing_fields),
    sales_security.canonical_json_v3(p_provider_snapshot));
  IF v_canonical IS DISTINCT FROM p_payload_canonical THEN
    RETURN QUERY SELECT 'INVALID_REQUEST',NULL::text,NULL::integer,NULL::text,false; RETURN;
  END IF;
  SELECT * INTO v_claim FROM sales_security.consume_sales_actor_claim_v3(
    p_claim,p_signature,'ADVISOR_TURN',p_project_id,p_object_id,p_payload_canonical);
  IF v_claim.outcome IN ('REPLAY','REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(v_actor,'advisor.use',p_project_id) THEN
      RETURN QUERY SELECT 'FORBIDDEN',NULL::text,NULL::integer,NULL::text,false; RETURN;
    END IF;
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'requirementId',
      (v_claim.response_payload->>'version')::integer,
      v_claim.response_payload->>'assistantMessageId',true; RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome,NULL::text,NULL::integer,NULL::text,false; RETURN;
  END IF;
  PERFORM 1 FROM public."project" AS p WHERE p.id=p_project_id FOR UPDATE;
  SELECT * INTO v_conversation FROM public."advisor_conversation" AS c
  WHERE c.id=p_conversation_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor,'advisor.use',p_project_id)
     OR v_conversation."projectId"<>p_project_id
     OR v_conversation.status<>'ACTIVE' THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','ADVISOR_TURN',NULL,
      jsonb_build_object('outcome','CONTEXT_CONFLICT','replayed',false));
    RETURN QUERY SELECT 'CONTEXT_CONFLICT',NULL::text,NULL::integer,NULL::text,false; RETURN;
  END IF;
  SELECT coalesce(max(m.sequence),0) INTO v_last FROM public."advisor_message" AS m
  WHERE m."conversationId"=p_conversation_id;
  SELECT * INTO v_current FROM public."building_requirement" AS br
  WHERE br."projectId"=p_project_id
  ORDER BY br.version DESC,br.id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_current.version<>p_expected_requirement_version
     OR v_last<>p_expected_last_message_sequence THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','ADVISOR_TURN',NULL,
      jsonb_build_object('outcome','VERSION_CONFLICT','replayed',false));
    RETURN QUERY SELECT 'VERSION_CONFLICT',NULL::text,NULL::integer,NULL::text,false; RETURN;
  END IF;
  INSERT INTO public."advisor_message"
    (id,"conversationId",sequence,role,content,provider,"structuredPayload","createdAt")
  VALUES (v_user,p_conversation_id,v_last+1,'USER',p_user_message,'MOCK',NULL,clock_timestamp());
  INSERT INTO public."building_requirement"
    (id,"projectId","conversationId","installationScenario",status,version,
     fields,"missingFields","professionalReviewRequired","createdById",
     "updatedById","createdAt","updatedAt")
  VALUES (v_new,p_project_id,p_conversation_id,v_current."installationScenario",
    'DRAFT',v_current.version+1,p_final_fields,p_final_missing_fields,true,
    v_actor,v_actor,clock_timestamp(),clock_timestamp());
  INSERT INTO public."requirement_revision"
    (id,"requirementId",version,source,snapshot,"missingFields",status,
     "createdById","createdAt")
  VALUES (v_revision,v_new,v_current.version+1,'MOCK_AI',p_final_fields,
    p_final_missing_fields,'DRAFT',v_actor,clock_timestamp());
  INSERT INTO public."advisor_message"
    (id,"conversationId",sequence,role,content,provider,"structuredPayload","createdAt")
  VALUES (v_assistant,p_conversation_id,v_last+2,'ASSISTANT',p_assistant_message,
    'MOCK',p_provider_snapshot,clock_timestamp());
  UPDATE public."advisor_conversation" SET "updatedAt"=clock_timestamp()
  WHERE id=p_conversation_id;
  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash,p_project_id,v_actor,'ADVISOR_TURN',
    'AdvisorConversation',p_conversation_id,p_claim->>'requestId',
    lower(p_claim->>'payloadDigest'),NULL,
    jsonb_build_object('requirementId',v_new,'version',v_current.version+1,
      'assistantMessageId',v_assistant),NULL);
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash,'COMPLETED','ADVISOR_TURN',p_conversation_id,
    jsonb_build_object('outcome','OK','requirementId',v_new,
      'version',v_current.version+1,'assistantMessageId',v_assistant,'replayed',false));
  RETURN QUERY SELECT 'OK',v_new,v_current.version+1,v_assistant,false;
END;
$fn$;
```

### 8.3 `app_confirm_requirement_v3`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_confirm_requirement_v3(
  p_claim jsonb,p_signature bytea,p_project_id text,p_object_id text,
  p_requirement_id text,p_expected_version integer,p_payload_canonical text
)
RETURNS TABLE (outcome text,requirement_id text,version integer,replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record; v_actor text:=p_claim->>'actorUserId';
  v_current public."building_requirement"%ROWTYPE;
  v_new text:=pg_catalog.gen_random_uuid()::text;
  v_revision text:=pg_catalog.gen_random_uuid()::text;
  v_canonical text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_project_id IS NULL
     OR p_object_id IS DISTINCT FROM p_requirement_id
     OR p_requirement_id IS NULL OR p_expected_version IS NULL
     OR p_expected_version<1 OR p_payload_canonical IS NULL THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT',NULL::text,NULL::integer,false; RETURN;
  END IF;
  v_canonical:=concat_ws('|',
    sales_security.canonical_field_v2('REQUIREMENT_CONFIRM'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_requirement_id),
    sales_security.canonical_field_v2(p_expected_version::text));
  IF v_canonical IS DISTINCT FROM p_payload_canonical THEN
    RETURN QUERY SELECT 'INVALID_REQUEST',NULL::text,NULL::integer,false; RETURN;
  END IF;
  SELECT * INTO v_claim FROM sales_security.consume_sales_actor_claim_v3(
    p_claim,p_signature,'REQUIREMENT_CONFIRM',p_project_id,p_requirement_id,p_payload_canonical);
  IF v_claim.outcome IN ('REPLAY','REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(v_actor,'advisor.use',p_project_id) THEN
      RETURN QUERY SELECT 'FORBIDDEN',NULL::text,NULL::integer,false; RETURN;
    END IF;
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'requirementId',
      (v_claim.response_payload->>'version')::integer,true; RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome,NULL::text,NULL::integer,false; RETURN;
  END IF;
  PERFORM 1 FROM public."project" AS p WHERE p.id=p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor,'advisor.use',p_project_id) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','REQUIREMENT_CONFIRM',NULL,
      jsonb_build_object('outcome','FORBIDDEN','replayed',false));
    RETURN QUERY SELECT 'FORBIDDEN',NULL::text,NULL::integer,false; RETURN;
  END IF;
  SELECT * INTO v_current FROM public."building_requirement" AS br
  WHERE br.id=p_requirement_id AND br."projectId"=p_project_id FOR UPDATE;
  IF NOT FOUND OR v_current.version<>p_expected_version
     OR v_current."missingFields"<>'[]'::jsonb
     OR v_current.status='CUSTOMER_CONFIRMED' THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','REQUIREMENT_CONFIRM',NULL,
      jsonb_build_object('outcome','VERSION_CONFLICT','replayed',false));
    RETURN QUERY SELECT 'VERSION_CONFLICT',NULL::text,NULL::integer,false; RETURN;
  END IF;
  INSERT INTO public."building_requirement"
    (id,"projectId","conversationId","installationScenario",status,version,
     fields,"missingFields","professionalReviewRequired","createdById",
     "updatedById","createdAt","updatedAt")
  VALUES (v_new,p_project_id,v_current."conversationId",
    v_current."installationScenario",'CUSTOMER_CONFIRMED',v_current.version+1,
    v_current.fields,v_current."missingFields",true,v_actor,v_actor,
    clock_timestamp(),clock_timestamp());
  INSERT INTO public."requirement_revision"
    (id,"requirementId",version,source,snapshot,"missingFields",status,
     "createdById","createdAt")
  VALUES (v_revision,v_new,v_current.version+1,'USER_EDIT',
    v_current.fields,v_current."missingFields",'CUSTOMER_CONFIRMED',v_actor,
    clock_timestamp());
  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash,p_project_id,v_actor,'REQUIREMENT_CONFIRM',
    'BuildingRequirement',v_new,p_claim->>'requestId',
    lower(p_claim->>'payloadDigest'),NULL,
    jsonb_build_object('requirementId',v_new,'version',v_current.version+1),NULL);
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash,'COMPLETED','REQUIREMENT_CONFIRM',v_new,
    jsonb_build_object('outcome','OK','requirementId',v_new,
      'version',v_current.version+1,'replayed',false));
  RETURN QUERY SELECT 'OK',v_new,v_current.version+1,false;
END;
$fn$;
```

### 8.4 `app_start_advisor_conversation_v3`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_start_advisor_conversation_v3(
  p_claim jsonb,p_signature bytea,p_project_id text,p_object_id text,
  p_installation_scenario text,p_initial_fields jsonb,
  p_initial_missing_fields jsonb,p_initial_assistant_message text,
  p_payload_canonical text
)
RETURNS TABLE (outcome text,conversation_id text,requirement_id text,
  version integer,replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record; v_actor text:=p_claim->>'actorUserId';
  v_conversation text:=pg_catalog.gen_random_uuid()::text;
  v_requirement text:=pg_catalog.gen_random_uuid()::text;
  v_revision text:=pg_catalog.gen_random_uuid()::text;
  v_next integer; v_scenario "public"."InstallationScenario"; v_canonical text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_project_id IS NULL
     OR p_object_id IS DISTINCT FROM 'PROJECT' OR p_installation_scenario IS NULL
     OR p_initial_fields IS NULL OR p_initial_missing_fields IS NULL
     OR jsonb_typeof(p_initial_fields)<>'object'
     OR jsonb_typeof(p_initial_missing_fields)<>'array'
     OR p_initial_assistant_message IS NULL
     OR btrim(p_initial_assistant_message)='' OR p_payload_canonical IS NULL THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT',NULL::text,NULL::text,NULL::integer,false; RETURN;
  END IF;
  v_scenario:=p_installation_scenario::"public"."InstallationScenario";
  v_canonical:=concat_ws('|',
    sales_security.canonical_field_v2('ADVISOR_START'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_object_id),
    sales_security.canonical_field_v2(p_installation_scenario),
    sales_security.canonical_json_v3(p_initial_fields),
    sales_security.canonical_json_v3(p_initial_missing_fields),
    sales_security.canonical_field_v2(p_initial_assistant_message));
  IF v_canonical IS DISTINCT FROM p_payload_canonical THEN
    RETURN QUERY SELECT 'INVALID_REQUEST',NULL::text,NULL::text,NULL::integer,false; RETURN;
  END IF;
  SELECT * INTO v_claim FROM sales_security.consume_sales_actor_claim_v3(
    p_claim,p_signature,'ADVISOR_START',p_project_id,p_object_id,p_payload_canonical);
  IF v_claim.outcome IN ('REPLAY','REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(v_actor,'advisor.use',p_project_id) THEN
      RETURN QUERY SELECT 'FORBIDDEN',NULL::text,NULL::text,NULL::integer,false; RETURN;
    END IF;
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'conversationId',
      v_claim.response_payload->>'requirementId',
      (v_claim.response_payload->>'version')::integer,true; RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome,NULL::text,NULL::text,NULL::integer,false; RETURN;
  END IF;
  PERFORM 1 FROM public."project" AS p WHERE p.id=p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor,'advisor.use',p_project_id) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','ADVISOR_START',NULL,
      jsonb_build_object('outcome','FORBIDDEN','version',0,'replayed',false));
    RETURN QUERY SELECT 'FORBIDDEN',NULL::text,NULL::text,NULL::integer,false; RETURN;
  END IF;
  SELECT coalesce(max(br.version),0)+1 INTO v_next
  FROM public."building_requirement" AS br
  WHERE br."projectId"=p_project_id;
  IF v_next IS NULL OR v_next<1 THEN
    RAISE EXCEPTION 'invalid next requirement version' USING ERRCODE='23514';
  END IF;
  INSERT INTO public."advisor_conversation"
    (id,"projectId","createdById",provider,status,"createdAt","updatedAt")
  VALUES (v_conversation,p_project_id,v_actor,'MOCK','ACTIVE',
    clock_timestamp(),clock_timestamp());
  INSERT INTO public."building_requirement"
    (id,"projectId","conversationId","installationScenario",status,version,
     fields,"missingFields","professionalReviewRequired","createdById",
     "updatedById","createdAt","updatedAt")
  VALUES (v_requirement,p_project_id,v_conversation,v_scenario,'DRAFT',v_next,
    p_initial_fields,p_initial_missing_fields,true,v_actor,v_actor,
    clock_timestamp(),clock_timestamp());
  INSERT INTO public."requirement_revision"
    (id,"requirementId",version,source,snapshot,"missingFields",status,
     "createdById","createdAt")
  VALUES (v_revision,v_requirement,v_next,'MOCK_AI',p_initial_fields,
    p_initial_missing_fields,'DRAFT',v_actor,clock_timestamp());
  INSERT INTO public."advisor_message"
    (id,"conversationId",sequence,role,content,provider,"structuredPayload","createdAt")
  VALUES (pg_catalog.gen_random_uuid()::text,v_conversation,1,'ASSISTANT',
    p_initial_assistant_message,'MOCK',NULL,clock_timestamp());
  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash,p_project_id,v_actor,'ADVISOR_START',
    'AdvisorConversation',v_conversation,p_claim->>'requestId',
    lower(p_claim->>'payloadDigest'),NULL,
    jsonb_build_object('conversationId',v_conversation,
      'requirementId',v_requirement,'version',v_next),NULL);
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash,'COMPLETED','ADVISOR_START',v_conversation,
    jsonb_build_object('outcome','OK','conversationId',v_conversation,
      'requirementId',v_requirement,'version',v_next,'replayed',false));
  RETURN QUERY SELECT 'OK',v_conversation,v_requirement,v_next,false;
END;
$fn$;
```

## 8. Remaining registry function bodies

### 8.1 `assert_sales_actor_v2`

```sql
CREATE OR REPLACE FUNCTION sales_security.assert_sales_actor_v2(
  p_claim jsonb, p_signature bytea, p_expected_operation text,
  p_payload_canonical text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_actor text := p_claim->>'actorUserId';
  v_session text := p_claim->>'authSessionId';
  v_request text := p_claim->>'requestId';
  v_operation text := p_claim->>'operation';
  v_nonce text := p_claim->>'nonce';
  v_key text := p_claim->>'keyId';
  v_digest text := lower(coalesce(p_claim->>'payloadDigest',''));
  v_issued bigint; v_expires bigint; v_now bigint;
  v_secret bytea; v_expected bytea; v_actual text;
BEGIN
  IF p_claim IS NULL OR jsonb_typeof(p_claim) <> 'object'
     OR p_signature IS NULL OR octet_length(p_signature) <> 32
     OR p_expected_operation IS NULL OR p_payload_canonical IS NULL
     OR v_actor IS NULL OR v_actor !~ '^[A-Za-z0-9_-]{1,128}$'
     OR v_session IS NULL OR v_session !~ '^[A-Za-z0-9_-]{1,256}$'
     OR v_request IS NULL OR v_request !~ '^[A-Za-z0-9_-]{16,100}$'
     OR v_operation IS DISTINCT FROM p_expected_operation
     OR v_nonce IS NULL OR v_nonce !~ '^[A-Za-z0-9_-]{16,128}$'
     OR v_key IS NULL OR v_key !~ '^[A-Za-z0-9_-]{1,64}$'
     OR v_digest !~ '^[0-9a-f]{64}$'
     OR p_claim->>'issuedAtEpoch' IS NULL
     OR p_claim->>'expiresAtEpoch' IS NULL THEN
    RETURN 'INVALID_CLAIM';
  END IF;
  BEGIN
    v_issued := (p_claim->>'issuedAtEpoch')::bigint;
    v_expires := (p_claim->>'expiresAtEpoch')::bigint;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN 'INVALID_CLAIM';
  END;
  v_now := floor(extract(epoch FROM clock_timestamp()))::bigint;
  IF v_issued > v_now + 5 OR v_expires <= v_now
     OR v_expires <= v_issued OR v_expires - v_issued > 120 THEN
    RETURN 'INVALID_CLAIM_WINDOW';
  END IF;
  SELECT k.secret INTO v_secret
  FROM sales_security.actor_hmac_key AS k
  WHERE k.key_id=v_key AND k.not_before<=clock_timestamp()
    AND k.not_after>clock_timestamp() AND k.revoked_at IS NULL;
  IF NOT FOUND THEN RETURN 'UNKNOWN_OR_REVOKED_KEY'; END IF;
  v_expected := sales_security.hmac(
    convert_to(concat_ws('|','v2',v_key,v_actor,v_session,v_request,
      v_operation,v_issued::text,v_expires::text,v_nonce,v_digest),'UTF8'),
    v_secret,'sha256');
  IF p_signature IS DISTINCT FROM v_expected THEN RETURN 'INVALID_SIGNATURE'; END IF;
  v_actual := encode(sales_security.digest(
    convert_to(p_payload_canonical,'UTF8'),'sha256'),'hex');
  IF v_actual IS DISTINCT FROM v_digest THEN RETURN 'PAYLOAD_MISMATCH'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."session" AS s
    WHERE s.id=v_session AND s."userId"=v_actor
      AND s."expiresAt">clock_timestamp()
  ) THEN RETURN 'INVALID_SESSION'; END IF;
  RETURN 'OK';
END;
$fn$;
```

### 8.2 `app_create_requirement_version_v3`

This function is the R7 §5.2 body; it hashes the complete final fields and
expectedVersion, consumes the Claim, locks Project, rejects version mismatch,
writes BuildingRequirement and RequirementRevision, writes R2 Audit Event and
finalizes COMPLETED/REJECTED. The full body is:

```sql
CREATE OR REPLACE FUNCTION sales_command.app_create_requirement_version_v3(
  p_claim jsonb,p_signature bytea,p_project_id text,p_object_id text,
  p_expected_version integer,p_conversation_id text,p_installation_scenario text,
  p_fields jsonb,p_missing_fields jsonb,p_source text,p_payload_canonical text
)
RETURNS TABLE (outcome text,requirement_id text,version integer,replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record; v_actor text:=p_claim->>'actorUserId';
  v_digest text:=lower(coalesce(p_claim->>'payloadDigest',''));
  v_canonical text; v_current record;
  v_id text:=pg_catalog.gen_random_uuid()::text;
  v_revision text:=pg_catalog.gen_random_uuid()::text;
  v_scenario "public"."InstallationScenario";
  v_source "public"."RequirementRevisionSource";
  v_next integer;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_project_id IS NULL
     OR p_object_id IS NULL OR p_expected_version IS NULL
     OR p_expected_version<0 OR p_installation_scenario IS NULL
     OR p_fields IS NULL OR p_missing_fields IS NULL OR p_source IS NULL
     OR p_payload_canonical IS NULL OR jsonb_typeof(p_fields)<>'object'
     OR jsonb_typeof(p_missing_fields)<>'array' THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT',NULL::text,NULL::integer,false; RETURN;
  END IF;
  IF p_installation_scenario NOT IN ('OLD_BUILDING_ADDITION',
    'EXISTING_ELEVATOR_RENOVATION','NEW_BUILDING_INSTALLATION')
     OR p_source NOT IN ('CHAT_USER','MOCK_AI','USER_EDIT') THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT',NULL::text,NULL::integer,false; RETURN;
  END IF;
  v_scenario:=p_installation_scenario::"public"."InstallationScenario";
  v_source:=p_source::"public"."RequirementRevisionSource";
  v_canonical:=concat_ws('|',
    sales_security.canonical_field_v2('REQUIREMENT_PATCH'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_object_id),
    sales_security.canonical_field_v2(p_expected_version::text),
    sales_security.canonical_field_v2(p_conversation_id),
    sales_security.canonical_field_v2(p_installation_scenario),
    sales_security.canonical_json_v3(p_fields),
    sales_security.canonical_json_v3(p_missing_fields),
    sales_security.canonical_field_v2(p_source));
  IF v_canonical IS DISTINCT FROM p_payload_canonical THEN
    RETURN QUERY SELECT 'INVALID_REQUEST',NULL::text,NULL::integer,false; RETURN;
  END IF;
  SELECT * INTO v_claim FROM sales_security.consume_sales_actor_claim_v3(
    p_claim,p_signature,'REQUIREMENT_PATCH',p_project_id,p_object_id,p_payload_canonical);
  IF v_claim.outcome IN ('REPLAY','REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(v_actor,'advisor.use',p_project_id) THEN
      RETURN QUERY SELECT 'FORBIDDEN',NULL::text,NULL::integer,false; RETURN;
    END IF;
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'requirementId',
      (v_claim.response_payload->>'version')::integer,true; RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome,NULL::text,NULL::integer,false; RETURN;
  END IF;
  PERFORM 1 FROM public."project" AS p WHERE p.id=p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor,'advisor.use',p_project_id) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','REQUIREMENT_PATCH',NULL,
      jsonb_build_object('outcome','FORBIDDEN','replayed',false));
    RETURN QUERY SELECT 'FORBIDDEN',NULL::text,NULL::integer,false; RETURN;
  END IF;
  IF p_conversation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."advisor_conversation" AS c
    WHERE c.id=p_conversation_id AND c."projectId"=p_project_id
  ) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','REQUIREMENT_PATCH',NULL,
      jsonb_build_object('outcome','CONTEXT_CONFLICT','replayed',false));
    RETURN QUERY SELECT 'CONTEXT_CONFLICT',NULL::text,NULL::integer,false; RETURN;
  END IF;
  SELECT br.id,br.version INTO v_current
  FROM public."building_requirement" AS br
  WHERE br."projectId"=p_project_id
  ORDER BY br.version DESC,br.id DESC LIMIT 1;
  IF (p_expected_version=0 AND FOUND) OR (p_expected_version<>0 AND NOT FOUND)
     OR (p_expected_version<>0 AND v_current.version<>p_expected_version) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','REQUIREMENT_PATCH',NULL,
      jsonb_build_object('outcome','VERSION_CONFLICT','replayed',false));
    RETURN QUERY SELECT 'VERSION_CONFLICT',NULL::text,NULL::integer,false; RETURN;
  END IF;
  v_next:=CASE WHEN p_expected_version=0 THEN 1 ELSE p_expected_version+1 END;
  INSERT INTO public."building_requirement"
    (id,"projectId","conversationId","installationScenario",status,version,
     fields,"missingFields","professionalReviewRequired","createdById",
     "updatedById","createdAt","updatedAt")
  VALUES (v_id,p_project_id,p_conversation_id,v_scenario,'DRAFT',v_next,
    p_fields,p_missing_fields,true,v_actor,v_actor,clock_timestamp(),clock_timestamp());
  INSERT INTO public."requirement_revision"
    (id,"requirementId",version,source,snapshot,"missingFields",status,
     "createdById","createdAt")
  VALUES (v_revision,v_id,v_next,v_source,p_fields,p_missing_fields,'DRAFT',
    v_actor,clock_timestamp());
  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash,p_project_id,v_actor,'REQUIREMENT_PATCH',
    'BuildingRequirement',v_id,p_claim->>'requestId',v_digest,NULL,
    jsonb_build_object('requirementId',v_id,'version',v_next),NULL);
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash,'COMPLETED','REQUIREMENT_PATCH',v_id,
    jsonb_build_object('outcome','OK','requirementId',v_id,
      'version',v_next,'replayed',false));
  RETURN QUERY SELECT 'OK',v_id,v_next,false;
END;
$fn$;
```

### 5.5 `app_list_sales_handoffs_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_list_sales_handoffs_v2(
  p_claim jsonb,p_signature bytea,p_search text,p_offset integer,p_page_size integer
)
RETURNS TABLE (outcome text,payload jsonb)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record; v_actor text:=p_claim->>'actorUserId';
  v_canonical text; v_payload jsonb; v_digest text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_search IS NULL
     OR length(p_search)>160 OR p_offset IS NULL OR p_offset<0
     OR p_offset>1000000 OR p_page_size IS NULL
     OR p_page_size<1 OR p_page_size>100 THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT',NULL::jsonb; RETURN;
  END IF;
  v_canonical:=concat_ws('|',
    sales_security.canonical_field_v2('SALES_LIST'),
    sales_security.canonical_field_v2(NULL),
    sales_security.canonical_field_v2('SALES_LIST'),
    sales_security.canonical_field_v2(p_search),p_offset::text,p_page_size::text);
  SELECT * INTO v_claim FROM sales_security.consume_sales_actor_claim_v3(
    p_claim,p_signature,'SALES_LIST',NULL,'SALES_LIST',v_canonical);
  IF v_claim.outcome IN ('REPLAY','REQUEST_REPLAY') THEN
    RETURN QUERY SELECT 'READ_REPLAY_REQUIRES_NEW_CLAIM',NULL::jsonb; RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome,NULL::jsonb; RETURN;
  END IF;
  WITH authorized AS (
    SELECT h.*,p.name AS project_name,r.outcome AS resolver_outcome,
      r.requirement_id AS current_requirement_id,
      r.selection_run_id AS current_selection_run_id,
      r.selection_status AS current_selection_status
    FROM public."sales_handoff" AS h
    JOIN public."project" AS p ON p.id=h."projectId"
    CROSS JOIN LATERAL sales_command.app_resolve_current_completed_selection_v2(h."projectId") AS r
    WHERE sales_security.actor_has_permission_v2(v_actor,'sales.manage',h."projectId")
      AND (p_search='' OR coalesce(h.summary,'') ILIKE '%'||p_search||'%'
        OR coalesce(h."budgetConcern",'') ILIKE '%'||p_search||'%'
        OR p.name ILIKE '%'||p_search||'%')
  ),counted AS (SELECT count(*) AS total_count FROM authorized),
  paged AS (SELECT * FROM authorized ORDER BY "updatedAt" DESC,id DESC
    OFFSET p_offset LIMIT p_page_size)
  SELECT jsonb_build_object(
    'total',(SELECT total_count FROM counted),
    'handoffs',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',p.id,'projectId',p."projectId",'projectName',p.project_name,
        'boundRequirementId',p."boundRequirementId",
        'boundSelectionRunId',p."boundSelectionRunId",
        'status',p.status::text,'summary',p.summary,
        'budgetConcern',p."budgetConcern",'updatedAt',p."updatedAt",
        'currentSelectionStatus',p.current_selection_status::text,
        'notes',coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id',n.id,'contactStatus',n."contactStatus",'note',n.note,
            'statusAfter',n."statusAfter"::text,'createdAt',n."createdAt")
            ORDER BY n."createdAt" DESC,n.id DESC)
          FROM public."sales_follow_up_note" AS n WHERE n."handoffId"=p.id),'[]'::jsonb),
        'contextState',CASE
          WHEN p."boundRequirementId" IS NULL THEN 'LEGACY_UNBOUND'
          WHEN p.status='CLOSED' THEN 'CLOSED'
          WHEN p.resolver_outcome='CURRENT'
            AND p."boundRequirementId"=p.current_requirement_id
            AND p."boundSelectionRunId"=p.current_selection_run_id THEN 'ACTIONABLE'
          WHEN p.resolver_outcome='CURRENT' THEN 'HISTORICAL'
          ELSE p.resolver_outcome END,
        'currentRequirementId',p.current_requirement_id,
        'currentSelectionRunId',p.current_selection_run_id)
        ORDER BY p."updatedAt" DESC,p.id DESC)
      FROM paged AS p),'[]'::jsonb)
  ) INTO v_payload;
  v_digest:=encode(sales_security.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash,'COMPLETED','SALES_LIST',NULL,
    jsonb_build_object('outcome','OK','resultDigest',v_digest,
      'recordCount',coalesce((v_payload->>'total')::integer,0)));
  RETURN QUERY SELECT 'OK',v_payload;
END;
$fn$;
```

### 5.6 `app_get_sales_handoff_context_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_get_sales_handoff_context_v2(
  p_claim jsonb,p_signature bytea,p_project_id text,p_handoff_id text
)
RETURNS TABLE (outcome text,payload jsonb)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record; v_actor text:=p_claim->>'actorUserId';
  v_canonical text; v_payload jsonb; v_digest text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_project_id IS NULL
     OR p_handoff_id IS NULL OR p_project_id !~ '^[A-Za-z0-9_-]{1,128}$'
     OR p_handoff_id !~ '^[A-Za-z0-9_-]{1,128}$' THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT',NULL::jsonb; RETURN;
  END IF;
  v_canonical:=concat_ws('|',
    sales_security.canonical_field_v2('SALES_GET_CONTEXT'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_handoff_id));
  SELECT * INTO v_claim FROM sales_security.consume_sales_actor_claim_v3(
    p_claim,p_signature,'SALES_GET_CONTEXT',p_project_id,p_handoff_id,v_canonical);
  IF v_claim.outcome IN ('REPLAY','REQUEST_REPLAY') THEN
    RETURN QUERY SELECT 'READ_REPLAY_REQUIRES_NEW_CLAIM',NULL::jsonb; RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome,NULL::jsonb; RETURN;
  END IF;
  IF NOT sales_security.actor_has_permission_v2(v_actor,'sales.manage',p_project_id) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','SALES_GET_CONTEXT',NULL,
      jsonb_build_object('outcome','FORBIDDEN','recordCount',0));
    RETURN QUERY SELECT 'FORBIDDEN',NULL::jsonb; RETURN;
  END IF;
  SELECT jsonb_build_object(
    'id',h.id,'projectId',h."projectId",'projectName',p.name,
    'boundRequirementId',h."boundRequirementId",
    'boundSelectionRunId',h."boundSelectionRunId",
    'status',h.status::text,'summary',h.summary,
    'budgetConcern',h."budgetConcern",'updatedAt',h."updatedAt",
    'currentSelectionStatus',r.selection_status::text,
    'notes',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',n.id,'contactStatus',n."contactStatus",'note',n.note,
        'statusAfter',n."statusAfter"::text,'createdAt',n."createdAt")
        ORDER BY n."createdAt" DESC,n.id DESC)
      FROM public."sales_follow_up_note" AS n WHERE n."handoffId"=h.id),'[]'::jsonb),
    'contextState',CASE
      WHEN h."boundRequirementId" IS NULL THEN 'LEGACY_UNBOUND'
      WHEN h.status='CLOSED' THEN 'CLOSED'
      WHEN r.outcome='CURRENT' AND h."boundRequirementId"=r.requirement_id
        AND h."boundSelectionRunId"=r.selection_run_id THEN 'ACTIONABLE'
      WHEN r.outcome='CURRENT' THEN 'HISTORICAL'
      ELSE r.outcome END,
    'currentRequirementId',r.requirement_id,
    'currentSelectionRunId',r.selection_run_id)
  INTO v_payload
  FROM public."sales_handoff" AS h
  JOIN public."project" AS p ON p.id=h."projectId"
  CROSS JOIN LATERAL sales_command.app_resolve_current_completed_selection_v2(h."projectId") AS r
  WHERE h.id=p_handoff_id AND h."projectId"=p_project_id;
  IF v_payload IS NULL THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','SALES_GET_CONTEXT',NULL,
      jsonb_build_object('outcome','NOT_FOUND','recordCount',0));
    RETURN QUERY SELECT 'NOT_FOUND',NULL::jsonb; RETURN;
  END IF;
  v_digest:=encode(sales_security.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash,'COMPLETED','SALES_GET_CONTEXT',p_handoff_id,
    jsonb_build_object('outcome','OK','resultDigest',v_digest,'recordCount',1));
  RETURN QUERY SELECT 'OK',v_payload;
END;
$fn$;
```
### 5.7 `app_append_sales_followup_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_append_sales_followup_v2(
  p_claim jsonb,p_signature bytea,p_project_id text,p_handoff_id text,
  p_status "public"."SalesHandoffStatus",p_contact_status varchar,p_note text
)
RETURNS TABLE (outcome text,note_id text,status_after "public"."SalesHandoffStatus",replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record; v_actor text:=p_claim->>'actorUserId';
  v_request text:=p_claim->>'requestId';
  v_digest text:=lower(coalesce(p_claim->>'payloadDigest',''));
  v_canonical text; v_handoff public."sales_handoff"%ROWTYPE;
  v_existing public."sales_follow_up_note"%ROWTYPE;
  v_note_id text:=pg_catalog.gen_random_uuid()::text;
  v_resolution record; v_payload jsonb;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_project_id IS NULL
     OR p_handoff_id IS NULL OR p_status IS NULL OR p_contact_status IS NULL
     OR btrim(p_contact_status)='' OR length(p_contact_status)>80
     OR p_note IS NULL OR btrim(p_note)='' OR length(p_note)>4000 THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT',NULL::text,
      NULL::"public"."SalesHandoffStatus",false; RETURN;
  END IF;
  v_canonical:=concat_ws('|',
    sales_security.canonical_field_v2('SALES_FOLLOW_UP_NOTE'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_handoff_id),
    sales_security.canonical_field_v2(p_status::text),
    sales_security.canonical_field_v2(p_contact_status),
    sales_security.canonical_field_v2(p_note));
  SELECT * INTO v_claim FROM sales_security.consume_sales_actor_claim_v3(
    p_claim,p_signature,'SALES_FOLLOW_UP_NOTE',p_project_id,p_handoff_id,v_canonical);
  IF v_claim.outcome IN ('REPLAY','REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(v_actor,'sales.manage',p_project_id) THEN
      RETURN QUERY SELECT 'FORBIDDEN',NULL::text,NULL::"public"."SalesHandoffStatus",false; RETURN;
    END IF;
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'noteId',
      (v_claim.response_payload->>'statusAfter')::"public"."SalesHandoffStatus",true;
    RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome,NULL::text,NULL::"public"."SalesHandoffStatus",false;
    RETURN;
  END IF;
  PERFORM 1 FROM public."project" AS p WHERE p.id=p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor,'sales.manage',p_project_id) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','SALES_FOLLOW_UP_NOTE',NULL,
      jsonb_build_object('outcome','FORBIDDEN','replayed',false));
    RETURN QUERY SELECT 'FORBIDDEN',NULL::text,NULL::"public"."SalesHandoffStatus",false; RETURN;
  END IF;
  SELECT * INTO v_handoff FROM public."sales_handoff" AS h
  WHERE h.id=p_handoff_id AND h."projectId"=p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','SALES_FOLLOW_UP_NOTE',NULL,
      jsonb_build_object('outcome','NOT_FOUND','replayed',false));
    RETURN QUERY SELECT 'NOT_FOUND',NULL::text,NULL::"public"."SalesHandoffStatus",false; RETURN;
  END IF;
  IF v_handoff.status='CLOSED' THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','SALES_FOLLOW_UP_NOTE',v_handoff.id,
      jsonb_build_object('outcome','CLOSED','replayed',false));
    RETURN QUERY SELECT 'CLOSED',NULL::text,'CLOSED'::"public"."SalesHandoffStatus",false; RETURN;
  END IF;
  IF v_handoff."boundRequirementId" IS NULL THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','SALES_FOLLOW_UP_NOTE',v_handoff.id,
      jsonb_build_object('outcome','LEGACY_UNBOUND','replayed',false));
    RETURN QUERY SELECT 'LEGACY_UNBOUND',NULL::text,NULL::"public"."SalesHandoffStatus",false; RETURN;
  END IF;
  SELECT * INTO v_resolution FROM sales_command.app_resolve_current_completed_selection_v2(p_project_id);
  IF v_resolution.outcome<>'CURRENT'
     OR v_handoff."boundRequirementId" IS DISTINCT FROM v_resolution.requirement_id
     OR v_handoff."boundSelectionRunId" IS DISTINCT FROM v_resolution.selection_run_id THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','SALES_FOLLOW_UP_NOTE',v_handoff.id,
      jsonb_build_object('outcome','CONTEXT_STALE','replayed',false));
    RETURN QUERY SELECT 'CONTEXT_STALE',NULL::text,NULL::"public"."SalesHandoffStatus",false; RETURN;
  END IF;
  v_payload:=jsonb_build_object('operation','SALES_FOLLOW_UP_NOTE',
    'projectId',p_project_id,'handoffId',p_handoff_id,'status',p_status::text,
    'contactStatus',p_contact_status,'note',p_note);
  INSERT INTO public."sales_follow_up_note"
    (id,"handoffId","authorUserId","contactStatus",note,"createdAt","requestKey",
     "operationType","protocolVersion","requestPayload","statusAfter")
  VALUES (v_note_id,p_handoff_id,v_actor,p_contact_status,p_note,
    clock_timestamp(),v_request,'SALES_FOLLOW_UP_NOTE',2,v_payload,p_status)
  ON CONFLICT ("authorUserId","operationType","requestKey") DO NOTHING
  RETURNING id INTO v_note_id;
  IF v_note_id IS NULL THEN
    SELECT * INTO v_existing FROM public."sales_follow_up_note" AS n
    WHERE n."authorUserId"=v_actor AND n."operationType"='SALES_FOLLOW_UP_NOTE'
      AND n."requestKey"=v_request FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'note conflict without row' USING ERRCODE='23505';
    END IF;
    IF v_existing."requestPayload" IS NOT DISTINCT FROM v_payload THEN
      PERFORM sales_security.finalize_sales_actor_claim_v3(
        v_claim.claim_hash,'COMPLETED','SALES_FOLLOW_UP_NOTE',v_existing.id,
        jsonb_build_object('outcome','OK','noteId',v_existing.id,
          'statusAfter',v_existing."statusAfter"::text,'replayed',true));
      RETURN QUERY SELECT 'OK',v_existing.id,v_existing."statusAfter",true; RETURN;
    END IF;
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','SALES_FOLLOW_UP_NOTE',v_existing.id,
      jsonb_build_object('outcome','IDEMPOTENCY_KEY_REUSED','replayed',false));
    RETURN QUERY SELECT 'IDEMPOTENCY_KEY_REUSED',v_existing.id,
      NULL::"public"."SalesHandoffStatus",false; RETURN;
  END IF;
  UPDATE public."sales_handoff" SET status=p_status,"updatedAt"=clock_timestamp()
  WHERE id=p_handoff_id AND "projectId"=p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'locked handoff disappeared' USING ERRCODE='40001';
  END IF;
  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash,p_project_id,v_actor,'SALES_FOLLOW_UP_NOTE',
    'SalesHandoff',p_handoff_id,v_request,v_digest,
    jsonb_build_object('status',v_handoff.status::text),
    jsonb_build_object('noteId',v_note_id,'status',p_status::text),NULL);
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash,'COMPLETED','SALES_FOLLOW_UP_NOTE',p_handoff_id,
    jsonb_build_object('outcome','OK','noteId',v_note_id,
      'statusAfter',p_status::text,'replayed',false));
  RETURN QUERY SELECT 'OK',v_note_id,p_status,false;
END;
$fn$;
```

## 6. Sales resolver and create handoff

The following definitions are complete in R8. They replace the R7 sales bodies and
restore the list/get DTO fields. They assume the R4 Expand columns from §3.

### 6.1 `app_resolve_current_completed_selection_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_resolve_current_completed_selection_v2(
  p_project_id text
)
RETURNS TABLE (outcome text, requirement_id text, selection_run_id text,
  selection_status "public"."SelectionRunStatus")
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
    RETURN QUERY SELECT 'INVALID_ARGUMENT',NULL::text,NULL::text,
      NULL::"public"."SelectionRunStatus";
    RETURN;
  END IF;
  SELECT br.id INTO v_requirement_id
  FROM public."building_requirement" AS br
  WHERE br."projectId"=p_project_id
  ORDER BY br.version DESC,br.id DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NO_REQUIREMENT',NULL::text,NULL::text,
      NULL::"public"."SelectionRunStatus";
    RETURN;
  END IF;
  SELECT date_trunc('milliseconds',max(sr."createdAt")) INTO v_latest_ms
  FROM public."selection_run" AS sr
  WHERE sr."projectId"=p_project_id AND sr."requirementId"=v_requirement_id;
  IF v_latest_ms IS NULL THEN
    RETURN QUERY SELECT 'NO_MATCH',v_requirement_id,NULL::text,
      NULL::"public"."SelectionRunStatus";
    RETURN;
  END IF;
  SELECT count(*) INTO v_tie_count
  FROM public."selection_run" AS sr
  WHERE sr."projectId"=p_project_id AND sr."requirementId"=v_requirement_id
    AND date_trunc('milliseconds',sr."createdAt")=v_latest_ms;
  IF v_tie_count<>1 THEN
    RETURN QUERY SELECT 'AMBIGUOUS',v_requirement_id,NULL::text,
      NULL::"public"."SelectionRunStatus";
    RETURN;
  END IF;
  SELECT sr.id,sr.status INTO v_run_id,v_run_status
  FROM public."selection_run" AS sr
  WHERE sr."projectId"=p_project_id AND sr."requirementId"=v_requirement_id
    AND date_trunc('milliseconds',sr."createdAt")=v_latest_ms
  ORDER BY sr.id DESC LIMIT 1;
  IF v_run_status <> 'COMPLETED' THEN
    RETURN QUERY SELECT 'SELECTION_NOT_COMPLETED',v_requirement_id,
      v_run_id,v_run_status;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'CURRENT',v_requirement_id,v_run_id,v_run_status;
END;
$fn$;
```

### 6.2 `app_sales_create_handoff_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_sales_create_handoff_v2(
  p_claim jsonb,p_signature bytea,p_project_id text,p_summary text,p_budget_concern text
)
RETURNS TABLE (outcome text,handoff_id text,context_state text,replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record; v_actor text:=p_claim->>'actorUserId';
  v_request text:=p_claim->>'requestId';
  v_digest text:=lower(coalesce(p_claim->>'payloadDigest',''));
  v_canonical text; v_resolution record;
  v_existing public."sales_handoff"%ROWTYPE;
  v_id text:=pg_catalog.gen_random_uuid()::text; v_payload jsonb;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_project_id IS NULL
     OR p_summary IS NULL OR btrim(p_summary)=''
     OR length(p_summary)>4000
     OR (p_budget_concern IS NOT NULL AND length(p_budget_concern)>2000) THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT',NULL::text,NULL::text,false;
    RETURN;
  END IF;
  v_canonical:=concat_ws('|',
    sales_security.canonical_field_v2('SALES_HANDOFF_CREATE'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2('PROJECT'),
    sales_security.canonical_field_v2(p_summary),
    sales_security.canonical_field_v2(p_budget_concern));
  SELECT * INTO v_claim
  FROM sales_security.consume_sales_actor_claim_v3(
    p_claim,p_signature,'SALES_HANDOFF_CREATE',p_project_id,'PROJECT',v_canonical);
  IF v_claim.outcome IN ('REPLAY','REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(v_actor,'sales.handoff.create',p_project_id) THEN
      RETURN QUERY SELECT 'FORBIDDEN',NULL::text,NULL::text,false; RETURN;
    END IF;
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'handoffId',
      v_claim.response_payload->>'contextState',true; RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome,NULL::text,NULL::text,false; RETURN;
  END IF;
  PERFORM 1 FROM public."project" AS p WHERE p.id=p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor,'sales.handoff.create',p_project_id) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','SALES_HANDOFF_CREATE',NULL,
      jsonb_build_object('outcome','FORBIDDEN','replayed',false));
    RETURN QUERY SELECT 'FORBIDDEN',NULL::text,NULL::text,false; RETURN;
  END IF;
  SELECT * INTO v_resolution
  FROM sales_command.app_resolve_current_completed_selection_v2(p_project_id);
  IF v_resolution.outcome<>'CURRENT' THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','SALES_HANDOFF_CREATE',NULL,
      jsonb_build_object('outcome','CONTEXT_UNAVAILABLE','replayed',false));
    RETURN QUERY SELECT 'CONTEXT_UNAVAILABLE',NULL::text,
      v_resolution.outcome,false; RETURN;
  END IF;
  v_payload:=jsonb_build_object('operation','SALES_HANDOFF_CREATE',
    'projectId',p_project_id,'requirementId',v_resolution.requirement_id,
    'selectionRunId',v_resolution.selection_run_id,'summary',p_summary,
    'budgetConcern',p_budget_concern);
  SELECT * INTO v_existing FROM public."sales_handoff" AS h
  WHERE h."projectId"=p_project_id
    AND h."boundRequirementId"=v_resolution.requirement_id
    AND h."boundSelectionRunId"=v_resolution.selection_run_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status='CLOSED' THEN
      PERFORM sales_security.finalize_sales_actor_claim_v3(
        v_claim.claim_hash,'REJECTED','SALES_HANDOFF_CREATE',v_existing.id,
        jsonb_build_object('outcome','CLOSED','replayed',false));
      RETURN QUERY SELECT 'CLOSED',v_existing.id,'CLOSED',false; RETURN;
    END IF;
    IF v_existing."createPayload" IS NOT DISTINCT FROM v_payload THEN
      PERFORM sales_security.finalize_sales_actor_claim_v3(
        v_claim.claim_hash,'COMPLETED','SALES_HANDOFF_CREATE',v_existing.id,
        jsonb_build_object('outcome','OK','handoffId',v_existing.id,
          'contextState','ACTIONABLE','replayed',true));
      RETURN QUERY SELECT 'OK',v_existing.id,'ACTIONABLE',true; RETURN;
    END IF;
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash,'REJECTED','SALES_HANDOFF_CREATE',v_existing.id,
      jsonb_build_object('outcome','CONTEXT_EXISTS','replayed',false));
    RETURN QUERY SELECT 'CONTEXT_EXISTS',v_existing.id,'ACTIONABLE',false; RETURN;
  END IF;
  INSERT INTO public."sales_handoff"
    (id,"projectId","createdById",status,summary,"budgetConcern",
     "boundRequirementId","requirementProjectId","boundSelectionRunId",
     "selectionRunProjectId","selectionRunRequirementId","createPayload",
     "createdAt","updatedAt")
  VALUES (v_id,p_project_id,v_actor,'PENDING_FOLLOW_UP',p_summary,
    p_budget_concern,v_resolution.requirement_id,p_project_id,
    v_resolution.selection_run_id,p_project_id,v_resolution.requirement_id,
    v_payload,clock_timestamp(),clock_timestamp());
  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash,p_project_id,v_actor,'SALES_HANDOFF_CREATE',
    'SalesHandoff',v_id,v_request,v_digest,NULL,
    jsonb_build_object('handoffId',v_id,'requirementId',v_resolution.requirement_id,
      'selectionRunId',v_resolution.selection_run_id),NULL);
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash,'COMPLETED','SALES_HANDOFF_CREATE',v_id,
    jsonb_build_object('outcome','OK','handoffId',v_id,
      'contextState','ACTIONABLE','replayed',false));
  RETURN QUERY SELECT 'OK',v_id,'ACTIONABLE',false;
END;
$fn$;
```

## 7. Claim consume/finalize definitions

R8 uses the complete R5 §5.1 `consume_sales_actor_claim_v3` and §5.2
`finalize_sales_actor_claim_v3` bodies without changing their logic. The R8
source bundle includes these definitions in the implementation handoff copy;
the two functions remain SECURITY DEFINER, owner `elevator_sales_definer`,
fixed `search_path=pg_catalog`, and are revoked from PUBLIC/Web/Worker. The
Claim table, unique indexes, PENDING insert guard and deferred terminal guard
are the R5 definitions and are immutable for R8.

### 7.1 `consume_sales_actor_claim_v3` complete body

```sql
CREATE OR REPLACE FUNCTION sales_security.consume_sales_actor_claim_v3(
  p_claim jsonb,
  p_signature bytea,
  p_expected_operation text,
  p_expected_project_id text,
  p_expected_object_id text,
  p_payload_canonical text
)
RETURNS TABLE (
  outcome text, claim_hash bytea, actor_user_id text,
  request_id text, receipt_type text, receipt_id text,
  response_payload jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_key_id text := p_claim->>'keyId';
  v_actor text := p_claim->>'actorUserId';
  v_operation text := p_claim->>'operation';
  v_project text := nullif(p_claim->>'projectId', '');
  v_object text := nullif(p_claim->>'objectId', '');
  v_request text := p_claim->>'requestId';
  v_nonce text := p_claim->>'nonce';
  v_digest text := lower(coalesce(p_claim->>'payloadDigest', ''));
  v_issued bigint;
  v_expires bigint;
  v_basis text;
  v_hash bytea;
  v_inserted bytea;
  v_existing sales_security.actor_claim_consumption%ROWTYPE;
  v_actor_check text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL
     OR p_expected_operation IS NULL OR p_payload_canonical IS NULL
     OR octet_length(p_payload_canonical) > 262144
     OR v_project IS DISTINCT FROM p_expected_project_id
     OR v_object IS DISTINCT FROM p_expected_object_id THEN
    RETURN QUERY SELECT 'INVALID_CLAIM_SCOPE', NULL::bytea,
      NULL::text, NULL::text, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;
  IF v_key_id IS NULL OR v_key_id !~ '^[A-Za-z0-9_-]{1,64}$'
     OR v_operation IS DISTINCT FROM p_expected_operation
     OR (p_expected_operation = 'SALES_LIST'
       AND (v_project IS NOT NULL OR v_object IS DISTINCT FROM 'SALES_LIST'))
     OR (p_expected_operation = 'DOMAIN_AUDIT_APPEND_GLOBAL'
       AND (v_project IS NOT NULL OR v_object IS DISTINCT FROM 'GLOBAL'))
     OR (p_expected_operation NOT IN ('SALES_LIST','DOMAIN_AUDIT_APPEND_GLOBAL')
       AND (v_project IS NULL OR v_project !~ '^[A-Za-z0-9_-]{1,128}$'
         OR v_object IS NULL OR v_object !~ '^[A-Za-z0-9_-]{1,128}$')) THEN
    RETURN QUERY SELECT 'INVALID_CLAIM_SCOPE', NULL::bytea,
      NULL::text, NULL::text, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;

  v_actor_check := sales_security.assert_sales_actor_v2(
    p_claim, p_signature, p_expected_operation, p_payload_canonical
  );
  IF v_actor_check IS DISTINCT FROM 'OK' THEN
    RETURN QUERY SELECT 'INVALID_CLAIM', NULL::bytea,
      NULL::text, NULL::text, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;
  IF v_actor IS NULL OR v_request IS NULL OR v_nonce IS NULL
     OR v_digest !~ '^[0-9a-f]{64}$'
     OR p_claim->>'issuedAtEpoch' IS NULL
     OR p_claim->>'expiresAtEpoch' IS NULL THEN
    RETURN QUERY SELECT 'INVALID_CLAIM', NULL::bytea,
      NULL::text, NULL::text, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;
  BEGIN
    v_issued := (p_claim->>'issuedAtEpoch')::bigint;
    v_expires := (p_claim->>'expiresAtEpoch')::bigint;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN QUERY SELECT 'INVALID_CLAIM', NULL::bytea,
      NULL::text, NULL::text, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END;

  v_basis := concat_ws('|',
    sales_security.canonical_field_v2('claim-consume-v2'),
    sales_security.canonical_field_v2(v_key_id),
    sales_security.canonical_field_v2(v_actor),
    sales_security.canonical_field_v2(p_claim->>'authSessionId'),
    sales_security.canonical_field_v2(v_request),
    sales_security.canonical_field_v2(v_operation),
    sales_security.canonical_field_v2(v_project),
    sales_security.canonical_field_v2(v_object),
    sales_security.canonical_field_v2(v_issued::text),
    sales_security.canonical_field_v2(v_expires::text),
    sales_security.canonical_field_v2(v_nonce),
    sales_security.canonical_field_v2(v_digest)
  );
  v_hash := sales_security.digest(convert_to(v_basis,'UTF8'),'sha256');
  INSERT INTO sales_security.actor_claim_consumption (
    claim_hash,key_id,actor_user_id,auth_session_id,operation,project_id,
    object_id,request_id,nonce,payload_digest,issued_at,expires_at
  ) VALUES (
    v_hash,v_key_id,v_actor,p_claim->>'authSessionId',v_operation,v_project,
    v_object,v_request,v_nonce,v_digest,to_timestamp(v_issued),
    to_timestamp(v_expires)
  ) ON CONFLICT DO NOTHING RETURNING claim_hash INTO v_inserted;
  IF v_inserted IS NOT NULL THEN
    RETURN QUERY SELECT 'CONSUMED',v_hash,v_actor,v_request,
      NULL::text,NULL::text,NULL::jsonb;
    RETURN;
  END IF;
  SELECT * INTO v_existing
  FROM sales_security.actor_claim_consumption AS c
  WHERE c.claim_hash = v_hash;
  IF FOUND THEN
    IF v_existing.state = 'PENDING'
       AND v_existing.transaction_id = pg_current_xact_id() THEN
      RETURN QUERY SELECT 'CLAIM_ALREADY_IN_TRANSACTION',
        v_hash,v_existing.actor_user_id,v_existing.request_id,
        NULL::text,NULL::text,NULL::jsonb;
      RETURN;
    END IF;
    IF v_existing.state IN ('COMPLETED','REJECTED')
       AND v_existing.actor_user_id = v_actor
       AND v_existing.operation = v_operation
       AND v_existing.project_id IS NOT DISTINCT FROM v_project
       AND v_existing.object_id IS NOT DISTINCT FROM v_object
       AND v_existing.payload_digest = v_digest THEN
      RETURN QUERY SELECT 'REPLAY',v_existing.claim_hash,
        v_existing.actor_user_id,v_existing.request_id,
        v_existing.receipt_type,v_existing.receipt_id,
        v_existing.response_payload;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'CLAIM_CONFLICT',v_existing.claim_hash,
      v_existing.actor_user_id,v_existing.request_id,
      NULL::text,NULL::text,NULL::jsonb;
    RETURN;
  END IF;
  SELECT * INTO v_existing FROM sales_security.actor_claim_consumption AS c
  WHERE c.actor_user_id = v_actor AND c.request_id = v_request;
  IF FOUND THEN
    IF v_existing.operation = v_operation
       AND v_existing.project_id IS NOT DISTINCT FROM v_project
       AND v_existing.object_id IS NOT DISTINCT FROM v_object
       AND v_existing.payload_digest = v_digest
       AND v_existing.state IN ('COMPLETED','REJECTED') THEN
      RETURN QUERY SELECT 'REQUEST_REPLAY',v_existing.claim_hash,
        v_existing.actor_user_id,v_existing.request_id,
        v_existing.receipt_type,v_existing.receipt_id,
        v_existing.response_payload;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'REQUEST_ID_REUSED',v_existing.claim_hash,
      v_existing.actor_user_id,v_existing.request_id,
      NULL::text,NULL::text,NULL::jsonb;
    RETURN;
  END IF;
  SELECT * INTO v_existing FROM sales_security.actor_claim_consumption AS c
  WHERE c.actor_user_id = v_actor AND c.nonce = v_nonce;
  IF FOUND THEN
    RETURN QUERY SELECT 'NONCE_REUSED',v_existing.claim_hash,
      v_existing.actor_user_id,v_existing.request_id,
      NULL::text,NULL::text,NULL::jsonb;
    RETURN;
  END IF;
  SELECT * INTO v_existing FROM sales_security.actor_claim_consumption AS c
  WHERE c.transaction_id = pg_current_xact_id();
  IF FOUND THEN
    RETURN QUERY SELECT 'TRANSACTION_ALREADY_CONSUMED',v_existing.claim_hash,
      v_existing.actor_user_id,v_existing.request_id,
      NULL::text,NULL::text,NULL::jsonb;
    RETURN;
  END IF;
  RAISE EXCEPTION 'claim consumption unique conflict without matching row'
    USING ERRCODE = '23505';
END;
$fn$;
```

### 7.2 `finalize_sales_actor_claim_v3` complete body

```sql
CREATE OR REPLACE FUNCTION sales_security.finalize_sales_actor_claim_v3(
  p_claim_hash bytea,
  p_state text,
  p_receipt_type text,
  p_receipt_id text,
  p_response_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_updated integer;
BEGIN
  IF p_claim_hash IS NULL OR p_state NOT IN ('COMPLETED','REJECTED')
     OR p_receipt_type IS NULL OR p_response_payload IS NULL
     OR jsonb_typeof(p_response_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid claim finalization' USING ERRCODE = '22023';
  END IF;
  UPDATE sales_security.actor_claim_consumption
  SET state=p_state, receipt_type=p_receipt_type, receipt_id=p_receipt_id,
      response_payload=p_response_payload, completed_at=clock_timestamp()
  WHERE claim_hash=p_claim_hash
    AND transaction_id=pg_current_xact_id()
    AND state='PENDING';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'claim finalization must match current transaction'
      USING ERRCODE = '23514';
  END IF;
END;
$fn$;
```
