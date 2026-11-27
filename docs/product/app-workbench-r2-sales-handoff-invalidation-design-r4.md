# APP-WORKBENCH-R2 SalesHandoff Invalidation & Snapshot Consistency Design R4

## 0. 状态

```text
DESIGN COMPLETE — IMPLEMENTATION NOT STARTED
ISOLATED VALIDATION NOT PERFORMED
REAL CONTRACT NOT AUTHORIZED
```

本报告只修正设计，不修改源码、Prisma Schema、Migration、测试或数据库配置。
真实 Contract 在全部写入者排除证据完成前必须保持 `BLOCKED`。

## 1. 对 R3 审查问题的修正

| R3 审查问题 | R4 修正 |
|---|---|
| SECURITY DEFINER 只有接口和伪流程 | 给出 actor proof、私有 helper、五个业务函数的完整 PL/pgSQL、返回类型、NULL 规则、异常和 ACL |
| Web Runtime 权限不能支撑 Requirement/Selection 写入 | 给出相关对象的逐对象权限矩阵；Requirement/Advisor/Selection 采用 Web 事务和最小直接 DML，销售写入仅经函数 |
| Contract 漏 prepared transaction | 增加 `pg_prepared_xacts`、锁证据、角色/连接/事务关闭和 Contract 状态机 |
| DB/TS resolver 可能因微秒/毫秒分叉 | 数据库为唯一权威；统一 `date_trunc('milliseconds', ...)`；页面读取 DB context DTO |
| assignedTo FK 可能遇到历史 orphan | 增加 Migration 前 orphan 预检和停止条件 |
| note 唯一冲突恢复未定义 | 使用明确 conflict target、子事务内唯一异常恢复和 payload 比对 |
| 销售分页没有稳定排序 | 使用 `updatedAt DESC, id DESC`、pageSize 上限和同一 filtered CTE 的 total |
| 测试矩阵缺权限/时间/prepared xact | 增加函数 ACL、NULL、search_path、prepared xact、时间精度和稳定分页测试 |

以下 R3 设计保持不变：精确 Requirement/SelectionRun binding、LEGACY_UNBOUND 只读、
CLOSED 终态、Project 锁、RepeatableRead 页面快照、数据库级 SALES_MANAGE 过滤和
Expand/Contract 原则。

## 2. Git 与输入基线

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked status entries:     149
Untracked recursive files:    160
```

输入：

```text
R3 design:
docs/product/app-workbench-r2-sales-handoff-invalidation-design-r3.md
SHA-256:
55f4d9edc968b127291a33df29c1326e48efce0c35bd23989b7de747bfbf922e

R3 independent review:
docs/product/app-workbench-r2-sales-handoff-design-independent-review-r3.md
SHA-256:
668050d937615ecf2990a298a2f5b4b274b574faa3c515f07b9561985ad3b6f4
```

## 3. 身份模型：服务端签名 actor claim

### 3.1 为什么不能直接信任 userId/projectId

所有 Better Auth 用户共享同一个 Web 数据库登录角色。仅把 `actorUserId` 传给
SECURITY DEFINER 函数，无法阻止持有 Web DB 凭据的其它代码伪造用户。仅设置
`SET LOCAL app.actor_user_id` 也不安全，因为同一应用角色可以任意设置。

R4 增加：

```text
Better Auth Session (Web)
-> Web 服务生成 actor claim
-> Web 服务用 HMAC-SHA-256 签名 claim
-> DB SECURITY DEFINER 函数验证 claim、签名、短期窗口和 Session 有效性
-> DB 再检查角色/项目 RBAC
```

### 3.2 Claim 字段

```json
{
  "version": 2,
  "keyId": "sales-actor-2026-11",
  "actorUserId": "<Better Auth user id>",
  "authSessionId": "<Better Auth session id>",
  "requestId": "<random UUID>",
  "operation": "SALES_HANDOFF_CREATE",
  "issuedAtEpoch": 1790000000,
  "expiresAtEpoch": 1790000060,
  "nonce": "<16-128 ascii nonce>",
  "payloadDigest": "<64 lowercase hex>"
}
```

canonical claim string：

```text
v2|<keyId>|<actorUserId>|<authSessionId>|<requestId>|
<operation>|<issuedAtEpoch>|<expiresAtEpoch>|<nonce>|<payloadDigest>
```

所有字段不允许 `|`，并在 DB 中逐个校验长度和字符集。

payloadDigest 是：

```text
sha256(UTF8(canonical_payload_text))
```

canonical payload field 规则：

```text
NULL -> "-"
非 NULL -> UTF8 字节长度 || ":" || value
```

各操作 canonical payload：

```text
CREATE_SALES_HANDOFF
  operation|projectId|summary|budgetConcern

SALES_FOLLOW_UP_NOTE
  operation|handoffId|status|contactStatus|note

SALES_LIST
  operation|search|offset|pageSize

SALES_GET_CONTEXT
  operation|handoffId
```

### 3.3 密钥边界

- Web 签名密钥只从外置 Secret Manager 读取，不进入仓库、报告、日志或数据库连接串。
- DB 中存在密钥验证副本，仅 `elevator_sales_definer` 可读。
- Web runtime 不能 `SELECT sales_security.actor_hmac_key`。
- keyId 支持轮换；旧 key 在 `revokedAt` 后不能验证新请求。
- 没有密钥或 pgcrypto 时，五个业务函数保持不可用，Contract 必须 BLOCKED。

## 4. 私有关键表与 helper

以下对象不是五个业务函数，但属于必须实现的私有支持面：

```sql
CREATE SCHEMA sales_security AUTHORIZATION elevator_sales_definer;
CREATE SCHEMA sales_command AUTHORIZATION elevator_sales_definer;

CREATE EXTENSION pgcrypto WITH SCHEMA sales_security;

CREATE TABLE sales_security.actor_hmac_key (
  key_id       varchar(64) PRIMARY KEY,
  secret       bytea NOT NULL,
  not_before   timestamptz NOT NULL,
  not_after    timestamptz NOT NULL,
  revoked_at   timestamptz,
  CONSTRAINT actor_hmac_key_secret_check
    CHECK (octet_length(secret) >= 32),
  CONSTRAINT actor_hmac_key_window_check
    CHECK (not_after > not_before)
);

REVOKE ALL ON SCHEMA sales_security FROM PUBLIC;
REVOKE ALL ON TABLE sales_security.actor_hmac_key FROM PUBLIC;
REVOKE ALL ON TABLE sales_security.actor_hmac_key
  FROM "elevator_web_runtime_v2", "elevator_worker_runtime_v2";
```

### 4.1 canonical field helper

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
```

### 4.2 actor claim verifier

```sql
CREATE OR REPLACE FUNCTION sales_security.assert_sales_actor_v2(
  p_claim jsonb,
  p_signature bytea,
  p_expected_operation text,
  p_payload_canonical text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_actor text;
  v_session text;
  v_request text;
  v_operation text;
  v_nonce text;
  v_key_id text;
  v_payload_digest text;
  v_issued bigint;
  v_expires bigint;
  v_now bigint;
  v_secret bytea;
  v_claim_canonical text;
  v_expected_signature bytea;
  v_actual_payload_digest text;
BEGIN
  IF p_claim IS NULL
     OR jsonb_typeof(p_claim) <> 'object'
     OR p_signature IS NULL
     OR octet_length(p_signature) <> 32
     OR p_expected_operation IS NULL
     OR p_payload_canonical IS NULL THEN
    RETURN 'INVALID_CLAIM';
  END IF;

  v_actor := p_claim->>'actorUserId';
  v_session := p_claim->>'authSessionId';
  v_request := p_claim->>'requestId';
  v_operation := p_claim->>'operation';
  v_nonce := p_claim->>'nonce';
  v_key_id := p_claim->>'keyId';
  v_payload_digest := lower(coalesce(p_claim->>'payloadDigest', ''));

  IF p_claim->>'version' IS DISTINCT FROM '2'
     OR v_actor IS NULL
     OR v_actor !~ '^[A-Za-z0-9_-]{1,128}$'
     OR v_session IS NULL
     OR v_session !~ '^[A-Za-z0-9_-]{1,256}$'
     OR v_request IS NULL
     OR v_request !~ '^[A-Za-z0-9_-]{16,100}$'
     OR v_operation IS DISTINCT FROM p_expected_operation
     OR v_nonce IS NULL
     OR v_nonce !~ '^[A-Za-z0-9_-]{16,128}$'
     OR v_key_id IS NULL
     OR v_key_id !~ '^[A-Za-z0-9_-]{1,64}$'
     OR p_claim->>'issuedAtEpoch' IS NULL
     OR p_claim->>'issuedAtEpoch' !~ '^[0-9]{1,12}$'
     OR p_claim->>'expiresAtEpoch' IS NULL
     OR p_claim->>'expiresAtEpoch' !~ '^[0-9]{1,12}$'
     OR v_payload_digest !~ '^[0-9a-f]{64}$' THEN
    RETURN 'INVALID_CLAIM';
  END IF;

  BEGIN
    v_issued := (p_claim->>'issuedAtEpoch')::bigint;
    v_expires := (p_claim->>'expiresAtEpoch')::bigint;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN 'INVALID_CLAIM';
  END;

  v_now := floor(extract(epoch FROM clock_timestamp()))::bigint;
  IF v_issued > v_now + 5
     OR v_expires <= v_now
     OR v_expires <= v_issued
     OR v_expires - v_issued > 120 THEN
    RETURN 'INVALID_CLAIM_WINDOW';
  END IF;

  SELECT k.secret
  INTO v_secret
  FROM sales_security.actor_hmac_key AS k
  WHERE k.key_id = v_key_id
    AND k.not_before <= clock_timestamp()
    AND k.not_after > clock_timestamp()
    AND k.revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN 'UNKNOWN_OR_REVOKED_KEY';
  END IF;

  v_claim_canonical := concat_ws(
    '|',
    'v2',
    v_key_id,
    v_actor,
    v_session,
    v_request,
    v_operation,
    v_issued::text,
    v_expires::text,
    v_nonce,
    v_payload_digest
  );

  v_expected_signature := sales_security.hmac(
    convert_to(v_claim_canonical, 'UTF8'),
    v_secret,
    'sha256'
  );

  IF p_signature IS DISTINCT FROM v_expected_signature THEN
    RETURN 'INVALID_SIGNATURE';
  END IF;

  v_actual_payload_digest := encode(
    sales_security.digest(convert_to(p_payload_canonical, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_actual_payload_digest IS DISTINCT FROM v_payload_digest THEN
    RETURN 'PAYLOAD_MISMATCH';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public."session" AS s
    WHERE s.id = v_session
      AND s."userId" = v_actor
      AND s."expiresAt" > clock_timestamp()
  ) THEN
    RETURN 'INVALID_SESSION';
  END IF;

  RETURN 'OK';
END;
$fn$;
```

`SECURITY INVOKER` 是故意的：它只由五个 definer 业务函数在其 definer 权限上下文中
调用。Web runtime 不获 EXECUTE。

### 4.3 permission helper

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
    JOIN public."role_permission" AS rp
      ON rp."roleId" = ur."roleId"
    WHERE ur."userId" = p_actor_user_id
      AND rp."permissionCode" = p_permission_code
      AND (
        ur.scope = 'GLOBAL'
        OR (ur.scope = 'PROJECT' AND ur."projectId" = p_project_id)
      )
  )
$fn$;
```

## 5. 五个业务函数完整定义

五个业务函数均：

- 不声明参数默认值；调用者必须提供完整参数；
- 不使用 `STRICT`，而是在函数体开头显式拒绝 NULL，并返回稳定 outcome；
- 使用精确 `RETURNS TABLE`；
- 在异常/唯一冲突时不得返回成功。
- 不使用动态 SQL、`EXECUTE format(...)` 或调用方可控对象名；
- 所有表、类型、函数和 extension 调用均显式 schema 限定。

### 5.1 `sales_command.app_resolve_current_completed_selection_v2`

该函数是内部函数，不给 Web runtime 直接 EXECUTE；只能由已通过 actor claim 验证的
业务函数和数据库 Trigger 调用。

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
    RETURN QUERY SELECT
      'INVALID_ARGUMENT',
      NULL::text,
      NULL::text,
      NULL::"public"."SelectionRunStatus";
    RETURN;
  END IF;

  SELECT br.id
  INTO v_requirement_id
  FROM public."building_requirement" AS br
  WHERE br."projectId" = p_project_id
  ORDER BY br.version DESC, br.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'NO_REQUIREMENT',
      NULL::text,
      NULL::text,
      NULL::"public"."SelectionRunStatus";
    RETURN;
  END IF;

  SELECT date_trunc('milliseconds', max(sr."createdAt"))
  INTO v_latest_ms
  FROM public."selection_run" AS sr
  WHERE sr."projectId" = p_project_id
    AND sr."requirementId" = v_requirement_id;

  IF v_latest_ms IS NULL THEN
    RETURN QUERY SELECT
      'NO_MATCH',
      v_requirement_id,
      NULL::text,
      NULL::"public"."SelectionRunStatus";
    RETURN;
  END IF;

  SELECT count(*)
  INTO v_tie_count
  FROM public."selection_run" AS sr
  WHERE sr."projectId" = p_project_id
    AND sr."requirementId" = v_requirement_id
    AND date_trunc('milliseconds', sr."createdAt") = v_latest_ms;

  IF v_tie_count <> 1 THEN
    RETURN QUERY SELECT
      'AMBIGUOUS',
      v_requirement_id,
      NULL::text,
      NULL::"public"."SelectionRunStatus";
    RETURN;
  END IF;

  SELECT sr.id, sr.status
  INTO v_run_id, v_run_status
  FROM public."selection_run" AS sr
  WHERE sr."projectId" = p_project_id
    AND sr."requirementId" = v_requirement_id
    AND date_trunc('milliseconds', sr."createdAt") = v_latest_ms
  ORDER BY sr.id DESC
  LIMIT 1;

  IF v_run_status <> 'COMPLETED' THEN
    RETURN QUERY SELECT
      'SELECTION_NOT_COMPLETED',
      v_requirement_id,
      v_run_id,
      v_run_status;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    'CURRENT',
    v_requirement_id,
    v_run_id,
    v_run_status;
END;
$fn$;
```

### 5.2 `sales_command.app_sales_create_handoff_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_sales_create_handoff_v2(
  p_actor_claim jsonb,
  p_actor_signature bytea,
  p_project_id text,
  p_summary text,
  p_budget_concern text
)
RETURNS TABLE (
  outcome text,
  handoff_id text,
  context_state text,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_actor_user_id text := p_actor_claim->>'actorUserId';
  v_request_id text := p_actor_claim->>'requestId';
  v_payload_canonical text;
  v_actor_check text;
  v_resolution record;
  v_existing public."sales_handoff"%ROWTYPE;
  v_payload jsonb;
  v_handoff_id text;
  v_candidate_handoff_id text := pg_catalog.gen_random_uuid()::text;
BEGIN
  IF p_project_id IS NULL
     OR p_summary IS NULL
     OR btrim(p_summary) = ''
     OR length(p_summary) > 4000
     OR (p_budget_concern IS NOT NULL AND length(p_budget_concern) > 2000) THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::text, NULL::text, false;
    RETURN;
  END IF;

  v_payload_canonical := concat_ws(
    '|',
    'CREATE_SALES_HANDOFF',
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_summary),
    sales_security.canonical_field_v2(p_budget_concern)
  );

  v_actor_check := sales_security.assert_sales_actor_v2(
    p_actor_claim,
    p_actor_signature,
    'SALES_HANDOFF_CREATE',
    v_payload_canonical
  );
  IF v_actor_check <> 'OK' THEN
    RETURN QUERY SELECT
      CASE WHEN v_actor_check = 'PAYLOAD_MISMATCH'
           THEN 'INVALID_REQUEST'
           ELSE 'FORBIDDEN' END,
      NULL::text,
      NULL::text,
      false;
    RETURN;
  END IF;

  PERFORM 1
  FROM public."project" AS p
  WHERE p.id = p_project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND', NULL::text, NULL::text, false;
    RETURN;
  END IF;

  IF NOT sales_security.actor_has_permission_v2(
    v_actor_user_id,
    'sales.handoff.create',
    p_project_id
  ) THEN
    RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::text, false;
    RETURN;
  END IF;

  SELECT *
  INTO v_resolution
  FROM sales_command.app_resolve_current_completed_selection_v2(p_project_id);

  IF v_resolution.outcome <> 'CURRENT'
     OR v_resolution.requirement_id IS NULL
     OR v_resolution.selection_run_id IS NULL THEN
    RETURN QUERY SELECT
      'CONTEXT_UNAVAILABLE',
      NULL::text,
      v_resolution.outcome,
      false;
    RETURN;
  END IF;

  v_payload := jsonb_build_object(
    'operation', 'CREATE_SALES_HANDOFF',
    'projectId', p_project_id,
    'requirementId', v_resolution.requirement_id,
    'selectionRunId', v_resolution.selection_run_id,
    'summary', p_summary,
    'budgetConcern', p_budget_concern
  );

  SELECT *
  INTO v_existing
  FROM public."sales_handoff" AS h
  WHERE h."projectId" = p_project_id
    AND h."boundRequirementId" = v_resolution.requirement_id
    AND h."boundSelectionRunId" = v_resolution.selection_run_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'CLOSED' THEN
      RETURN QUERY SELECT 'CLOSED', v_existing.id, 'CLOSED', false;
      RETURN;
    END IF;
    IF v_existing."createPayload" IS NOT DISTINCT FROM v_payload THEN
      RETURN QUERY SELECT 'OK', v_existing.id, 'ACTIONABLE', true;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'CONTEXT_EXISTS', v_existing.id, 'ACTIONABLE', false;
    RETURN;
  END IF;

  INSERT INTO public."sales_handoff" (
    id,
    "projectId",
    "createdById",
    status,
    summary,
    "budgetConcern",
    "boundRequirementId",
    "requirementProjectId",
    "boundSelectionRunId",
    "selectionRunProjectId",
    "selectionRunRequirementId",
    "createPayload",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    v_candidate_handoff_id,
    p_project_id,
    v_actor_user_id,
    'PENDING_FOLLOW_UP'::"public"."SalesHandoffStatus",
    p_summary,
    p_budget_concern,
    v_resolution.requirement_id,
    p_project_id,
    v_resolution.selection_run_id,
    p_project_id,
    v_resolution.requirement_id,
    v_payload,
    clock_timestamp(),
    clock_timestamp()
  )
  ON CONFLICT (
    "projectId",
    "boundRequirementId",
    "boundSelectionRunId"
  ) DO NOTHING
  RETURNING id INTO v_handoff_id;

  IF v_handoff_id IS NULL THEN
    SELECT *
    INTO v_existing
    FROM public."sales_handoff" AS h
    WHERE h."projectId" = p_project_id
      AND h."boundRequirementId" = v_resolution.requirement_id
      AND h."boundSelectionRunId" = v_resolution.selection_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'sales handoff exact-context conflict without existing row'
        USING ERRCODE = '23505';
    END IF;
    IF v_existing.status = 'CLOSED' THEN
      RETURN QUERY SELECT 'CLOSED', v_existing.id, 'CLOSED', false;
      RETURN;
    END IF;
    IF v_existing."createPayload" IS NOT DISTINCT FROM v_payload THEN
      RETURN QUERY SELECT 'OK', v_existing.id, 'ACTIONABLE', true;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'CONTEXT_EXISTS', v_existing.id, 'ACTIONABLE', false;
    RETURN;
  END IF;

  IF v_handoff_id IS NULL THEN
    RAISE EXCEPTION 'sales handoff insert returned no id'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public."audit_log" (
    id, "actorUserId", action, "objectType", "objectId",
    "oldValue", "newValue", reason, "requestId", "createdAt"
  )
  VALUES (
    pg_catalog.gen_random_uuid()::text,
    v_actor_user_id,
    'sales.handoff.created',
    'SalesHandoff',
    v_handoff_id,
    NULL,
    jsonb_build_object(
      'operation', 'CREATE_SALES_HANDOFF',
      'handoffId', v_handoff_id,
      'projectId', p_project_id,
      'requirementId', v_resolution.requirement_id,
      'selectionRunId', v_resolution.selection_run_id,
      'payloadDigest', p_actor_claim->>'payloadDigest'
    ),
    NULL,
    v_request_id,
    clock_timestamp()
  );

  RETURN QUERY SELECT 'OK', v_handoff_id, 'ACTIONABLE', false;
END;
$fn$;
```

### 5.3 `sales_command.app_append_sales_followup_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_append_sales_followup_v2(
  p_actor_claim jsonb,
  p_actor_signature bytea,
  p_handoff_id text,
  p_status "public"."SalesHandoffStatus",
  p_contact_status varchar,
  p_note text
)
RETURNS TABLE (
  outcome text,
  note_id text,
  status_after "public"."SalesHandoffStatus",
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_actor_user_id text := p_actor_claim->>'actorUserId';
  v_request_id text := p_actor_claim->>'requestId';
  v_project_id text;
  v_handoff public."sales_handoff"%ROWTYPE;
  v_existing public."sales_follow_up_note"%ROWTYPE;
  v_resolution record;
  v_payload jsonb;
  v_payload_canonical text;
  v_actor_check text;
  v_note_id text;
  v_candidate_note_id text := pg_catalog.gen_random_uuid()::text;
BEGIN
  IF p_handoff_id IS NULL
     OR p_status IS NULL
     OR p_contact_status IS NULL
     OR btrim(p_contact_status) = ''
     OR length(p_contact_status) > 80
     OR p_note IS NULL
     OR btrim(p_note) = ''
     OR length(p_note) > 4000
     OR v_request_id IS NULL
     OR v_request_id !~ '^[A-Za-z0-9_-]{16,100}$' THEN
    RETURN QUERY SELECT
      'INVALID_ARGUMENT',
      NULL::text,
      NULL::"public"."SalesHandoffStatus",
      false;
    RETURN;
  END IF;

  v_payload_canonical := concat_ws(
    '|',
    'SALES_FOLLOW_UP_NOTE',
    sales_security.canonical_field_v2(p_handoff_id),
    sales_security.canonical_field_v2(p_status::text),
    sales_security.canonical_field_v2(p_contact_status),
    sales_security.canonical_field_v2(p_note)
  );

  v_actor_check := sales_security.assert_sales_actor_v2(
    p_actor_claim,
    p_actor_signature,
    'SALES_FOLLOW_UP_NOTE',
    v_payload_canonical
  );
  IF v_actor_check <> 'OK' THEN
    RETURN QUERY SELECT
      CASE WHEN v_actor_check = 'PAYLOAD_MISMATCH'
           THEN 'INVALID_REQUEST'
           ELSE 'FORBIDDEN' END,
      NULL::text,
      NULL::"public"."SalesHandoffStatus",
      false;
    RETURN;
  END IF;

  SELECT h."projectId"
  INTO v_project_id
  FROM public."sales_handoff" AS h
  WHERE h.id = p_handoff_id;
  -- Routing hint only; the authoritative handoff is re-read after Project lock.
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'NOT_FOUND',
      NULL::text,
      NULL::"public"."SalesHandoffStatus",
      false;
    RETURN;
  END IF;

  PERFORM 1
  FROM public."project" AS p
  WHERE p.id = v_project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'NOT_FOUND',
      NULL::text,
      NULL::"public"."SalesHandoffStatus",
      false;
    RETURN;
  END IF;

  SELECT *
  INTO v_handoff
  FROM public."sales_handoff" AS h
  WHERE h.id = p_handoff_id
  FOR UPDATE;
  IF NOT FOUND OR v_handoff."projectId" IS DISTINCT FROM v_project_id THEN
    RETURN QUERY SELECT
      'NOT_FOUND',
      NULL::text,
      NULL::"public"."SalesHandoffStatus",
      false;
    RETURN;
  END IF;

  IF NOT sales_security.actor_has_permission_v2(
    v_actor_user_id,
    'sales.manage',
    v_project_id
  ) THEN
    RETURN QUERY SELECT
      'FORBIDDEN',
      NULL::text,
      NULL::"public"."SalesHandoffStatus",
      false;
    RETURN;
  END IF;

  SELECT *
  INTO v_existing
  FROM public."sales_follow_up_note" AS n
  WHERE n."authorUserId" = v_actor_user_id
    AND n."operationType" = 'SALES_FOLLOW_UP_NOTE'
    AND n."requestKey" = v_request_id;

  v_payload := jsonb_build_object(
    'operation', 'SALES_FOLLOW_UP_NOTE',
    'projectId', v_project_id,
    'handoffId', p_handoff_id,
    'status', p_status::text,
    'contactStatus', p_contact_status,
    'note', p_note
  );

  IF FOUND THEN
    IF v_existing."requestPayload" IS NOT DISTINCT FROM v_payload THEN
      RETURN QUERY SELECT
        'OK',
        v_existing.id,
        v_existing."statusAfter",
        true;
      RETURN;
    END IF;
    RETURN QUERY SELECT
      'IDEMPOTENCY_KEY_REUSED',
      v_existing.id,
      NULL::"public"."SalesHandoffStatus",
      false;
    RETURN;
  END IF;

  IF v_handoff.status = 'CLOSED' THEN
    RETURN QUERY SELECT
      'CLOSED',
      NULL::text,
      'CLOSED'::"public"."SalesHandoffStatus",
      false;
    RETURN;
  END IF;
  IF v_handoff."boundRequirementId" IS NULL THEN
    RETURN QUERY SELECT
      'LEGACY_UNBOUND',
      NULL::text,
      NULL::"public"."SalesHandoffStatus",
      false;
    RETURN;
  END IF;

  SELECT *
  INTO v_resolution
  FROM sales_command.app_resolve_current_completed_selection_v2(v_project_id);
  IF v_resolution.outcome <> 'CURRENT'
     OR v_handoff."boundRequirementId" IS DISTINCT FROM v_resolution.requirement_id
     OR v_handoff."boundSelectionRunId" IS DISTINCT FROM v_resolution.selection_run_id THEN
    RETURN QUERY SELECT
      'CONTEXT_STALE',
      NULL::text,
      NULL::"public"."SalesHandoffStatus",
      false;
    RETURN;
  END IF;

  INSERT INTO public."sales_follow_up_note" (
    id, "handoffId", "authorUserId", "contactStatus", note,
    "createdAt", "requestKey", "operationType",
    "protocolVersion", "requestPayload", "statusAfter"
  )
  VALUES (
    v_candidate_note_id,
    p_handoff_id,
    v_actor_user_id,
    p_contact_status,
    p_note,
    clock_timestamp(),
    v_request_id,
    'SALES_FOLLOW_UP_NOTE',
    2,
    v_payload,
    p_status
  )
  ON CONFLICT ("authorUserId", "operationType", "requestKey") DO NOTHING
  RETURNING id INTO v_note_id;

  IF v_note_id IS NULL THEN
    SELECT *
    INTO v_existing
    FROM public."sales_follow_up_note" AS n
    WHERE n."authorUserId" = v_actor_user_id
      AND n."operationType" = 'SALES_FOLLOW_UP_NOTE'
      AND n."requestKey" = v_request_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'note idempotency conflict without existing row'
        USING ERRCODE = '23505';
    END IF;
    IF v_existing."requestPayload" IS NOT DISTINCT FROM v_payload THEN
      RETURN QUERY SELECT
        'OK',
        v_existing.id,
        v_existing."statusAfter",
        true;
      RETURN;
    END IF;
    RETURN QUERY SELECT
      'IDEMPOTENCY_KEY_REUSED',
      v_existing.id,
      NULL::"public"."SalesHandoffStatus",
      false;
    RETURN;
  END IF;

  IF v_note_id IS NULL THEN
    RAISE EXCEPTION 'note insert returned no id'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public."sales_handoff"
  SET status = p_status,
      "updatedAt" = clock_timestamp()
  WHERE id = p_handoff_id
    AND "projectId" = v_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'locked handoff disappeared before status update'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO public."audit_log" (
    id, "actorUserId", action, "objectType", "objectId",
    "oldValue", "newValue", reason, "requestId", "createdAt"
  )
  VALUES (
    pg_catalog.gen_random_uuid()::text,
    v_actor_user_id,
    'sales.follow_up.recorded',
    'SalesHandoff',
    p_handoff_id,
    jsonb_build_object('status', v_handoff.status::text),
    jsonb_build_object(
      'operation', 'SALES_FOLLOW_UP_NOTE',
      'handoffId', p_handoff_id,
      'status', p_status::text,
      'requestKey', v_request_id,
      'payloadDigest', p_actor_claim->>'payloadDigest'
    ),
    NULL,
    v_request_id,
    clock_timestamp()
  );

  RETURN QUERY SELECT 'OK', v_note_id, p_status, false;
END;
$fn$;
```

### 5.4 `sales_command.app_list_sales_handoffs_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_list_sales_handoffs_v2(
  p_actor_claim jsonb,
  p_actor_signature bytea,
  p_search text,
  p_offset integer,
  p_page_size integer
)
RETURNS TABLE (
  outcome text,
  payload jsonb
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_actor_user_id text := p_actor_claim->>'actorUserId';
  v_payload_canonical text;
  v_actor_check text;
BEGIN
  IF p_search IS NULL
     OR length(p_search) > 160
     OR p_offset IS NULL
     OR p_offset < 0
     OR p_offset > 1000000
     OR p_page_size IS NULL
     OR p_page_size < 1
     OR p_page_size > 100 THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::jsonb;
    RETURN;
  END IF;

  v_payload_canonical := concat_ws(
    '|',
    'SALES_LIST',
    sales_security.canonical_field_v2(p_search),
    p_offset::text,
    p_page_size::text
  );
  v_actor_check := sales_security.assert_sales_actor_v2(
    p_actor_claim,
    p_actor_signature,
    'SALES_LIST',
    v_payload_canonical
  );
  IF v_actor_check <> 'OK' THEN
    RETURN QUERY SELECT
      CASE WHEN v_actor_check = 'PAYLOAD_MISMATCH'
           THEN 'INVALID_REQUEST'
           ELSE 'FORBIDDEN' END,
      NULL::jsonb;
    RETURN;
  END IF;

  RETURN QUERY
  WITH authorized AS (
    SELECT
      h.*,
      p.name AS project_name,
      r.outcome AS resolver_outcome,
      r.requirement_id AS current_requirement_id,
      r.selection_run_id AS current_selection_run_id,
      r.selection_status AS current_selection_status
    FROM public."sales_handoff" AS h
    JOIN public."project" AS p ON p.id = h."projectId"
    CROSS JOIN LATERAL
      sales_command.app_resolve_current_completed_selection_v2(h."projectId") AS r
    WHERE sales_security.actor_has_permission_v2(
      v_actor_user_id,
      'sales.manage',
      h."projectId"
    )
      AND (
        p_search = ''
        OR coalesce(h.summary, '') ILIKE '%' || p_search || '%'
        OR coalesce(h."budgetConcern", '') ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT count(*) AS total_count FROM authorized
  ),
  paged AS (
    SELECT *
    FROM authorized
    ORDER BY "updatedAt" DESC, id DESC
    OFFSET p_offset
    LIMIT p_page_size
  )
  SELECT
    'OK',
    jsonb_build_object(
      'total', (SELECT total_count FROM counted),
      'handoffs', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', paged.id,
            'projectId', paged."projectId",
            'projectName', paged.project_name,
            'boundRequirementId', paged."boundRequirementId",
            'boundSelectionRunId', paged."boundSelectionRunId",
            'status', paged.status::text,
            'summary', paged.summary,
            'budgetConcern', paged."budgetConcern",
            'updatedAt', paged."updatedAt",
            'contextState',
              CASE
                WHEN paged."boundRequirementId" IS NULL THEN 'LEGACY_UNBOUND'
                WHEN paged.status = 'CLOSED' THEN 'CLOSED'
                WHEN paged.resolver_outcome = 'CURRENT'
                 AND paged."boundRequirementId" = paged.current_requirement_id
                 AND paged."boundSelectionRunId" = paged.current_selection_run_id
                  THEN 'ACTIONABLE'
                WHEN paged.resolver_outcome = 'CURRENT' THEN 'HISTORICAL'
                ELSE paged.resolver_outcome
              END,
            'currentRequirementId', paged.current_requirement_id,
            'currentSelectionRunId', paged.current_selection_run_id,
            'currentSelectionStatus', paged.current_selection_status::text,
            'notes', coalesce(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', n.id,
                    'contactStatus', n."contactStatus",
                    'note', n.note,
                    'statusAfter', n."statusAfter"::text,
                    'createdAt', n."createdAt"
                  )
                  ORDER BY n."createdAt" DESC, n.id DESC
                )
                FROM public."sales_follow_up_note" AS n
                WHERE n."handoffId" = paged.id
              ),
              '[]'::jsonb
            )
          )
          ORDER BY paged."updatedAt" DESC, paged.id DESC
        ),
        '[]'::jsonb
      )
    )
  FROM paged;
END;
$fn$;
```

### 5.5 `sales_command.app_get_sales_handoff_context_v2`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_get_sales_handoff_context_v2(
  p_actor_claim jsonb,
  p_actor_signature bytea,
  p_handoff_id text
)
RETURNS TABLE (
  outcome text,
  payload jsonb
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_actor_user_id text := p_actor_claim->>'actorUserId';
  v_payload_canonical text;
  v_actor_check text;
BEGIN
  IF p_handoff_id IS NULL OR p_handoff_id !~ '^[A-Za-z0-9_-]{1,128}$' THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::jsonb;
    RETURN;
  END IF;

  v_payload_canonical := concat_ws(
    '|',
    'SALES_GET_CONTEXT',
    sales_security.canonical_field_v2(p_handoff_id)
  );
  v_actor_check := sales_security.assert_sales_actor_v2(
    p_actor_claim,
    p_actor_signature,
    'SALES_GET_CONTEXT',
    v_payload_canonical
  );
  IF v_actor_check <> 'OK' THEN
    RETURN QUERY SELECT
      CASE WHEN v_actor_check = 'PAYLOAD_MISMATCH'
           THEN 'INVALID_REQUEST'
           ELSE 'FORBIDDEN' END,
      NULL::jsonb;
    RETURN;
  END IF;

  RETURN QUERY
  WITH selected AS (
    SELECT
      h.*,
      p.name AS project_name,
      r.outcome AS resolver_outcome,
      r.requirement_id AS current_requirement_id,
      r.selection_run_id AS current_selection_run_id,
      r.selection_status AS current_selection_status
    FROM public."sales_handoff" AS h
    JOIN public."project" AS p ON p.id = h."projectId"
    CROSS JOIN LATERAL
      sales_command.app_resolve_current_completed_selection_v2(h."projectId") AS r
    WHERE h.id = p_handoff_id
      AND sales_security.actor_has_permission_v2(
        v_actor_user_id,
        'sales.manage',
        h."projectId"
      )
  )
  SELECT
    'OK',
    jsonb_build_object(
      'id', s.id,
      'projectId', s."projectId",
      'projectName', s.project_name,
      'boundRequirementId', s."boundRequirementId",
      'boundSelectionRunId', s."boundSelectionRunId",
      'status', s.status::text,
      'summary', s.summary,
      'budgetConcern', s."budgetConcern",
      'updatedAt', s."updatedAt",
      'contextState',
        CASE
          WHEN s."boundRequirementId" IS NULL THEN 'LEGACY_UNBOUND'
          WHEN s.status = 'CLOSED' THEN 'CLOSED'
          WHEN s.resolver_outcome = 'CURRENT'
           AND s."boundRequirementId" = s.current_requirement_id
           AND s."boundSelectionRunId" = s.current_selection_run_id
            THEN 'ACTIONABLE'
          WHEN s.resolver_outcome = 'CURRENT' THEN 'HISTORICAL'
          ELSE s.resolver_outcome
        END,
      'currentRequirementId', s.current_requirement_id,
      'currentSelectionRunId', s.current_selection_run_id,
      'currentSelectionStatus', s.current_selection_status::text,
      'notes', coalesce(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', n.id,
              'contactStatus', n."contactStatus",
              'note', n.note,
              'statusAfter', n."statusAfter"::text,
              'createdAt', n."createdAt"
            )
            ORDER BY n."createdAt" DESC, n.id DESC
          )
          FROM public."sales_follow_up_note" AS n
          WHERE n."handoffId" = s.id
        ),
        '[]'::jsonb
      )
    )
  FROM selected AS s;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND', NULL::jsonb;
  END IF;
END;
$fn$;
```

### 5.6 HTTP outcome 映射

| DB outcome | HTTP |
|---|---|
| `OK` + `replayed=false` | 201（写）或 200（读） |
| `OK` + `replayed=true` | 200 |
| `INVALID_ARGUMENT` / `INVALID_REQUEST` | 400/422 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONTEXT_UNAVAILABLE` / `CONTEXT_STALE` | 409 |
| `CONTEXT_EXISTS` / `IDEMPOTENCY_KEY_REUSED` | 409 |
| `CLOSED` | 409 |
| `LEGACY_UNBOUND` | 409 |
| unexpected DB error | 500/503，不回显 SQL/函数内部 |

### 5.7 函数 owner 与 ACL

执行 Migration 的 DBA 必须显式转移函数 owner，不能依赖“由谁执行 CREATE”：

```sql
ALTER FUNCTION sales_security.canonical_field_v2(text)
  OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_security.assert_sales_actor_v2(jsonb, bytea, text, text)
  OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_security.actor_has_permission_v2(text, text, text)
  OWNER TO "elevator_sales_definer";

ALTER FUNCTION sales_command.app_resolve_current_completed_selection_v2(text)
  OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_sales_create_handoff_v2(
  jsonb, bytea, text, text, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_append_sales_followup_v2(
  jsonb, bytea, text, "public"."SalesHandoffStatus", varchar, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_list_sales_handoffs_v2(
  jsonb, bytea, text, integer, integer
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_get_sales_handoff_context_v2(
  jsonb, bytea, text
) OWNER TO "elevator_sales_definer";
```

ACL：

```sql
REVOKE ALL ON FUNCTION
  sales_security.canonical_field_v2(text),
  sales_security.assert_sales_actor_v2(jsonb, bytea, text, text),
  sales_security.actor_has_permission_v2(text, text, text),
  sales_command.app_resolve_current_completed_selection_v2(text)
FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

REVOKE ALL ON FUNCTION
  sales_command.app_sales_create_handoff_v2(jsonb, bytea, text, text, text),
  sales_command.app_append_sales_followup_v2(
    jsonb, bytea, text, "public"."SalesHandoffStatus", varchar, text
  ),
  sales_command.app_list_sales_handoffs_v2(
    jsonb, bytea, text, integer, integer
  ),
  sales_command.app_get_sales_handoff_context_v2(jsonb, bytea, text)
FROM PUBLIC, "elevator_worker_runtime_v2";

GRANT EXECUTE ON FUNCTION
  sales_command.app_sales_create_handoff_v2(jsonb, bytea, text, text, text),
  sales_command.app_append_sales_followup_v2(
    jsonb, bytea, text, "public"."SalesHandoffStatus", varchar, text
  ),
  sales_command.app_list_sales_handoffs_v2(
    jsonb, bytea, text, integer, integer
  ),
  sales_command.app_get_sales_handoff_context_v2(jsonb, bytea, text)
TO "elevator_web_runtime_v2";
```

`assert_sales_actor_v2`、权限 helper 和 resolver 仅由同一 definer owner 的业务函数
在 definer 上下文中调用。Web/Worker 直接 EXECUTE 必须失败。

### 5.8 Trigger 边界

R4 继承 R3 的 Trigger 契约，并增加 Project 行锁权限所需的身份守卫：

| Trigger | 时机 | 目的 |
|---|---|---|
| `project_identity_guard` | BEFORE UPDATE OF id OR DELETE ON project | 拒绝改 Project.id/删除；`UPDATE(id)` 仅用于满足 `SELECT ... FOR UPDATE` 权限 |
| `building_requirement_identity_guard` | BEFORE UPDATE OR DELETE | 需求只追加 version/revision |
| `selection_run_identity_guard` | BEFORE UPDATE OR DELETE | run 身份/requirementProjectId 不可变，不删除 |
| `sales_handoff_context_insert_guard` | BEFORE INSERT | 新 bound context 必须完整、payload 合法且 DB resolver 为当前 |
| `sales_handoff_immutable_guard` | BEFORE UPDATE OR DELETE | binding/身份不可变，legacy/CLOSED 不可修改，open context 更新需 current |
| `sales_follow_up_note_context_guard` | BEFORE INSERT | parent/project/binding/current/CLOSED/payload 完整性 |
| `sales_follow_up_note_append_only` | BEFORE UPDATE OR DELETE | note 只追加 |

所有 Trigger function 使用 `SECURITY DEFINER`，由 `elevator_sales_definer` 持有，固定
`search_path=pg_catalog`，所有表/类型全限定，PUBLIC 和 runtime 无 EXECUTE。
Trigger 的完整函数体属于受控 Migration 实施产物；本设计不批准编写或执行。

## 6. 完整最小权限矩阵

### 6.1 Web runtime

| 对象 | SELECT | INSERT | UPDATE | DELETE | REFERENCES | TRIGGER | 说明 |
|---|---:|---:|---:|---:|---:|---:|---|
| Project | YES | NO | column `id` (仅用于 `FOR UPDATE`) | NO | NO | NO | 由 identity Trigger 拒绝实际 id 修改；满足 Project 行锁权限要求 |
| BuildingRequirement | YES | YES | NO | NO | NO | NO | PATCH/confirm 只追加 version |
| RequirementRevision | YES | YES | NO | NO | NO | NO | append-only |
| AdvisorConversation | YES | YES | column `updatedAt` | NO | NO | NO | 顾问会话 |
| AdvisorMessage | YES | YES | NO | NO | NO | NO | append-only |
| SelectionRun | YES | YES | NO | NO | NO | NO | 只插入已确认需求 run |
| SelectionRecommendation | YES | YES | NO | NO | NO | NO | append-only |
| SalesHandoff | NO direct | NO direct | NO direct | NO | NO | NO | 仅 functions |
| SalesFollowUpNote | NO direct | NO direct | NO direct | NO | NO | NO | 仅 functions |
| AuditLog | YES | YES | NO | NO | NO | NO | 既有 audit 页面需要 SELECT；普通 UPDATE/DELETE Trigger 仍禁止 |
| UserRole / RolePermission / Role | YES | NO | NO | NO | NO | NO | DB 函数与 Web 只读 RBAC |
| sales_command business functions | EXECUTE 4 | N/A | N/A | N/A | N/A | N/A | create/append/list/get |
| app_resolve_current_completed_selection_v2 | NO | N/A | N/A | N/A | N/A | N/A | 仅内部 |
| sales_security helpers/schema | NO | N/A | N/A | N/A | N/A | N/A | 不可直接执行/读取 |

相关表使用 client-generated text IDs；R4 未发现需要授予的 sequence。如果实施后发现
serial identity，默认 DENY 并单独审查。

本矩阵完整覆盖 R2 的 Requirement/Advisor/Selection/Sales 写入和读取边界。既有
认证、客户、目录和文件模块的非销售 GRANT 不因本设计自动扩大或缩小；正式上线前
必须另做完整 role diff，且任何不属于 R2 的旧权限都不得顺带复制到 v2 角色。
在该 diff 完成前，v2 Web 不允许取代生产 Web 角色。

### 6.2 Definer runtime

| 对象 | 权限 |
|---|---|
| Project | SELECT、UPDATE (`id` 仅用于 `FOR UPDATE`；identity trigger 拒绝改号) |
| BuildingRequirement / SelectionRun | SELECT |
| UserRole / RolePermission | SELECT |
| `session` | SELECT（仅验证 claim 的 Session） |
| SalesHandoff | SELECT、INSERT、UPDATE (status, updatedAt) |
| SalesFollowUpNote | SELECT、INSERT |
| AuditLog | INSERT（及内部读取如需） |
| actor_hmac_key | SELECT |
| 业务表 DELETE / TRUNCATE / DDL | DENY |
| schema object ownership | 无 |

### 6.3 Worker / Migration / Owner

| 角色 | 权限 |
|---|---|
| Worker runtime | 无 SalesHandoff/note/v2 function EXECUTE；保留其既有文件任务最小权限 |
| Migration DBA | 临时 DDL/Trigger/Migration；不行使 Web 用户权限 |
| Owner NOLOGIN | 仅对象 owner，不登录；无 app EXECUTE |
| 旧 `elevator_app` | Contract 后 NOLOGIN、无 CONNECT、无函数 EXECUTE、无表权限 |

当前 R2 读写路径不使用数据库 View。若实施引入 View，必须对 View 和其底层表分别
执行相同 grant/revoke 与项目范围审查；不得以 View 隐藏权限问题。

新 Web/Worker 角色必须按数据库逐环境授予 CONNECT，不能复用同一角色访问
development/test/production 三个数据库。旧角色在目标数据库及所有非目标数据库的
成员关系、CONNECT 和登录能力都要在 Contract 证据中关闭或明确。

### 6.4 GRANT / REVOKE 示例

```sql
REVOKE ALL ON SCHEMA sales_command FROM PUBLIC;
REVOKE ALL ON SCHEMA sales_security FROM PUBLIC;
GRANT USAGE ON SCHEMA sales_command TO "elevator_web_runtime_v2";

GRANT SELECT ON
  public."project",
  public."building_requirement",
  public."requirement_revision",
  public."advisor_conversation",
  public."advisor_message",
  public."selection_run",
  public."selection_recommendation",
  public."audit_log",
  public."user_role",
  public."role_permission",
  public."role"
TO "elevator_web_runtime_v2";

GRANT INSERT ON
  public."building_requirement",
  public."requirement_revision",
  public."advisor_conversation",
  public."advisor_message",
  public."selection_run",
  public."selection_recommendation",
  public."audit_log"
TO "elevator_web_runtime_v2";

GRANT UPDATE ("updatedAt")
ON public."advisor_conversation"
TO "elevator_web_runtime_v2";

GRANT UPDATE ("id")
ON public."project"
TO "elevator_web_runtime_v2", "elevator_sales_definer";

REVOKE ALL ON TABLE
  public."sales_handoff",
  public."sales_follow_up_note"
FROM "elevator_web_runtime_v2";

GRANT EXECUTE ON FUNCTION
  sales_command.app_sales_create_handoff_v2(jsonb, bytea, text, text, text),
  sales_command.app_append_sales_followup_v2(
    jsonb, bytea, text, public."SalesHandoffStatus", varchar, text
  ),
  sales_command.app_list_sales_handoffs_v2(jsonb, bytea, text, integer, integer),
  sales_command.app_get_sales_handoff_context_v2(jsonb, bytea, text)
TO "elevator_web_runtime_v2";

REVOKE EXECUTE ON FUNCTION
  sales_command.app_resolve_current_completed_selection_v2(text),
  sales_security.assert_sales_actor_v2(jsonb, bytea, text, text),
  sales_security.actor_has_permission_v2(text, text, text)
FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

GRANT SELECT ON
  public."project",
  public."building_requirement",
  public."selection_run",
  public."user_role",
  public."role_permission",
  public."session",
  public."sales_handoff",
  public."sales_follow_up_note",
  sales_security.actor_hmac_key
TO "elevator_sales_definer";

GRANT EXECUTE ON FUNCTION
  sales_security.hmac(bytea, bytea, text),
  sales_security.digest(bytea, text)
TO "elevator_sales_definer";

GRANT INSERT ON
  public."sales_handoff",
  public."sales_follow_up_note",
  public."audit_log"
TO "elevator_sales_definer";

GRANT UPDATE ("status", "updatedAt")
ON public."sales_handoff"
TO "elevator_sales_definer";

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON public."sales_handoff", public."sales_follow_up_note"
FROM "elevator_web_runtime_v2", "elevator_worker_runtime_v2";
```

所有新表、sequence、schema 和函数必须核对默认权限；不得被 PUBLIC 或旧角色使用。

## 7. Prepared transaction 与 Contract 状态机

### 7.1 为什么 backend 终止不足

`pg_terminate_backend()` 只终止活动 session；不能处置已经通过
`PREPARE TRANSACTION` 的两阶段事务。只要 `max_prepared_transactions > 0`，
就可能存在不属于活动 backend 的 prepared transaction。

### 7.2 检查范围

Contract 必须查询：

数据库、schema 和对象 owner：

```sql
SELECT d.datname, pg_get_userbyid(d.datdba) AS database_owner
FROM pg_database AS d
WHERE d.datname = current_database();

SELECT n.nspname, pg_get_userbyid(n.nspowner) AS schema_owner
FROM pg_namespace AS n
WHERE n.nspname IN ('public', 'sales_command', 'sales_security');

SELECT c.oid::regclass AS object_name,
       pg_get_userbyid(c.relowner) AS object_owner
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'sales_command', 'sales_security')
  AND c.relname IN (
    'project', 'building_requirement', 'requirement_revision',
    'advisor_conversation', 'advisor_message', 'selection_run',
    'selection_recommendation', 'sales_handoff',
    'sales_follow_up_note', 'audit_log', 'actor_hmac_key'
  );

SELECT p.oid::regprocedure AS function_name,
       pg_get_userbyid(p.proowner) AS function_owner
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname IN ('sales_command', 'sales_security');
```

CONNECT/成员检查：

```sql
SELECT
  r.rolname,
  r.rolcanlogin,
  has_database_privilege(r.rolname, current_database(), 'CONNECT') AS can_connect
FROM pg_roles AS r
WHERE r.rolname IN (
  'elevator_app',
  'elevator_web_runtime_v2',
  'elevator_worker_runtime_v2',
  'elevator_sales_definer',
  'elevator_owner'
);
```

Prepared transaction：

```sql
SELECT
  x.gid,
  x.prepared,
  x.owner,
  x.database,
  x.transaction,
  now() - x.prepared AS prepared_age,
  l.locktype,
  l.mode,
  l.granted,
  l.relation::regclass AS locked_relation
FROM pg_prepared_xacts AS x
LEFT JOIN pg_locks AS l
  ON l.transactionid = x.transaction
WHERE x.database = current_database()
ORDER BY x.prepared, x.gid, l.relation;
```

并检查：

```text
pg_stat_activity:
  datname, usename, application_name, backend_pid, state, xact_start
pg_auth_members:
  递归检查旧角色成员/被授予者
pg_roles:
  rolcanlogin / rolsuper / role memberships
pg_prepared_xacts:
  目标 DB 的 owner/GID/age/transaction locks
```

活动角色/连接：

```sql
SELECT usename, application_name, client_addr, backend_start,
       datname, state, xact_start, backend_xid
FROM pg_stat_activity
WHERE datname = current_database()
  AND usename IN ('elevator_app','elevator_web_runtime_v2');
```

旧角色成员递归闭包：

```sql
WITH RECURSIVE reachable AS (
  SELECT am.roleid, am.member, 1 AS depth
  FROM pg_auth_members AS am
  WHERE am.roleid = 'elevator_app'::regrole

  UNION ALL

  SELECT am.roleid, am.member, r.depth + 1
  FROM pg_auth_members AS am
  JOIN reachable AS r ON am.roleid = r.member
)
SELECT DISTINCT
  r.member::regrole AS member_role,
  roles.rolcanlogin,
  r.depth
FROM reachable AS r
JOIN pg_roles AS roles ON roles.oid = r.member
ORDER BY r.depth DESC, member_role::text;
```

### 7.3 Contract 状态

```text
BLOCKED
  任一旧角色可登录/有连接/有未知成员
  任一未知或未归属 prepared transaction
  未证明 Scheduler/Worker/自动重启/连接池已停止
  未证明旧 API/旧 DB 凭据不可达

ELIGIBLE_FOR_CONTROLLED_CUTOVER
  上述全部证据通过
  NOLOGIN/权限撤销已生效
  目标 DB 无旧/新应用 backend，应用角色临时不可重连
  目标 DB 的 pg_prepared_xacts 为 0，或全部经批准处理
  独立授权已获得

COMPLETED
  Contract 操作和 postcheck 全部完成
  新角色/函数 ACL/Trigger/Catalog 证据齐全
  v2 canary 通过
```

R4 本身只允许写 `BLOCKED`/`ELIGIBLE_FOR_CONTROLLED_CUTOVER` 设计，不得执行状态变更。

### 7.4 Prepared transaction 处置规则

- 来源不明、业务归属不明、GID 不可解释 -> Contract 永远 BLOCKED。
- 只有明确属于旧协议、业务 owner 和 DBA 双人批准后，才能处理。
- 默认优先审查后 `ROLLBACK PREPARED`；禁止自动 `COMMIT PREPARED`。
- `COMMIT PREPARED` 必须证明该事务对应唯一的已完成业务结果、不会重复创建/覆盖，
  并记录 GID、owner、prepared age、锁和有权限人员的审计证据。
- 处置后必须重新读取 `pg_prepared_xacts`、`pg_locks`、目标实体计数和行摘要。
- 处置后、Contract 前必须保持旧角色不可登录，且再次验证 prepared xacts 为空。

### 7.5 竞态封闭

维护窗口顺序：

```text
1. 关闭业务写入入口/入口流量
2. 停止旧 Web、Worker、Scheduler、Watchdog
3. 旧角色 NOLOGIN/撤销 CONNECT；Contract 窗口内同时暂停新 Web/Worker 角色的
   CONNECT（只保留 DBA/迁移连接）
4. 终止旧角色及已停止新应用的全部 backend
5. 检查并处理 prepared xacts
6. 断开旧角色所有连接
7. 持有 DBA 连接并检查 pg_stat_activity/pg_locks 无旧/新应用写入会话
8. 执行 Contract
9. 启用 v2 角色和函数 EXECUTE
10. canary 后恢复写入
```

如果数据库仍允许旧角色连接或仍存在未处理 prepared xact，不得执行第 8 步。
新 Web/Worker 只能在 Contract postcheck 成功后恢复 CONNECT/LOGIN。

## 8. Resolver 时间精度修正

### 8.1 统一规则

数据库 resolver 使用：

```sql
date_trunc('milliseconds', "createdAt")
```

这是因为 Prisma/JS `Date` 只保留毫秒，而 `timestamptz(6)` 可含微秒。

规则：

- 最新 requirement：`version DESC, id DESC`；
- 最新 selection：`date_trunc('milliseconds', createdAt)` 最大；
- 若最大毫秒值对应多于一条 run，结果为 `AMBIGUOUS`；
- 无效时间在 DB（NOT NULL/timestamptz）不能出现；TS 仍保留防御性失败；
- 历史数据和新数据使用同一毫秒桶；
- 页面从 `app_list/app_get` DTO 的 `contextState` 读取，不再自行用另一套 resolver
  决定当前 actionability。

### 8.2 边界案例

```text
run-a = ...123100
run-b = ...123900
DB 归一化到 ...123
-> 两个同毫秒，返回 AMBIGUOUS

run-a = ...123999
run-b = ...124000
-> 分属两个毫秒桶，选 run-b
```

TS helper 只能用于非权威展示，且必须同样按毫秒桶和 DB 返回的 tie 规则处理。

## 9. assignedToId orphan precheck

Migration 不直接添加 FK；先执行只读/失败即停的 precheck：

```sql
SELECT h.id, h."projectId", h."assignedToId"
FROM public."sales_handoff" AS h
LEFT JOIN public."user" AS u ON u.id = h."assignedToId"
WHERE h."assignedToId" IS NOT NULL
  AND u.id IS NULL;
```

规则：

- 任一 orphan -> Migration 停止；
- 不静默清空 assignedToId；
- 不猜测关联用户；
- 不删除历史 handoff；
- 只有业务/管理员提供经过审计的修正记录后才可继续；
- 跨项目/跨租户规则在当前 User 模型没有项目归属字段；不得声称已证明跨租户，
  只验证 User 存在。若未来增加用户归属，再增加对应 FK/CHECK。

## 10. note 唯一冲突恢复

幂等记录使用 note 行：

```text
UNIQUE (authorUserId, operationType, requestKey)
```

具体流程：

1. 先锁 Project，再锁/重读 handoff；
2. 查询 actor/operation/requestKey；
3. 同 payload -> `OK` replay，不写；
4. 异 payload -> `IDEMPOTENCY_KEY_REUSED`；
5. 无记录 -> 调用 current resolver；
6. 先 INSERT note（含 statusAfter/requestPayload），再 UPDATE handoff status；
7. 使用精确 `ON CONFLICT (authorUserId, operationType, requestKey) DO NOTHING`；
8. 若冲突后查不到完整同 key 行，raise exception，不返回伪成功；
9. 若查到的 payload 不同，409/key reuse；
10. 若 payload 相同，返回 replay；
11. AuditLog 只在真正首写时插入；
12. 事务中任何更新失败整体 rollback。

其他唯一约束（primary key等）不得被误判为幂等成功；函数必须检查精确 conflict
target 和 payload。

## 11. 销售列表稳定分页

查询：

```sql
ORDER BY h."updatedAt" DESC, h.id DESC
```

- `p_offset` 默认不隐式；调用者必须传 0..1,000,000。
- `p_page_size` 必须 1..100。
- total 和 page 使用同一 `authorized` CTE/同一事务 snapshot。
- 搜索只过滤 authorized CTE。
- global SALES_MANAGE 才可无 project scope；项目范围逐行授权。
- 详情/导出/统计复用同一 predicate。
- 任何无权记录不进入 DTO/props/RSC payload。

R4 选择 offset 分页，因为当前管理端没有稳定游标需求；单次查询使用
`updatedAt DESC, id DESC` 和同一 filtered CTE，页内不会因 tie 重排。并发新增/
更新可能使后续 offset 页面位置移动，这是已知语义。导出或长时间遍历必须改用
`(updatedAt, id)` keyset cursor，不能把可漂移的 offset 结果作为一致性证明。

## 12. 迁移与写入入口映射

### 12.1 五个 R3 函数职责

| 入口 | 受控函数 | 写入 |
|---|---|---|
| create handoff | `app_sales_create_handoff_v2` | SalesHandoff/Audit |
| append follow-up/status | `app_append_sales_followup_v2` | SalesFollowUpNote/SalesHandoff status/Audit |
| list sales | `app_list_sales_handoffs_v2` | 无 |
| get sales context | `app_get_sales_handoff_context_v2` | 无 |
| current selection resolution | `app_resolve_current_completed_selection_v2` | 无 |

Requirement/Advisor/SelectionRun 的写入是 Web 事务直接 DML，不通过上述五个销售
函数；其 Project 锁和权限由 Web 服务 + 最小表权限执行，不能复用旧的 projectId-only
handoff 路径。

### 12.2 写入入口闭环

| 入口 | 服务 | Project 锁 | 权限源 | 后续 |
|---|---|---|---|---|
| Requirement PATCH | Web | 事务第一条 | Better Auth + existing policy | BR/Revision/Audit |
| Requirement confirm | Web | 事务第一条 | same | BR/Revision/Audit |
| Advisor start/message | Web | 写事务第一条 | same | Conversation/Message/BR/Audit |
| SelectionRun | Web | 事务第一条 | same | SelectionRun/Recommendation/Audit |
| SalesHandoff create | SECDEF function | inside function | signed claim + DB RBAC | SalesHandoff/Audit |
| Follow-up note/status | SECDEF function | inside function | signed claim + DB RBAC | Note/status/Audit |

Worker 不获得销售表或销售函数权限；未来 Worker 写入销售必须另行设计。

## 13. Expand / Compatibility / Freeze / Cutover / Contract

### Phase 0 — Preflight

- Git/source/schema inventory；
- 所有旧 Web/Worker/Scheduler/脚本/DB roles；
- 角色 membership/递归、CONNECT、PUBLIC、owner；
- `pg_prepared_xacts`、`pg_locks`、backend PID；
- 禁止 Contract，除非所有写入者可枚举。

### Phase A — Schema Expand

- 新增 R3 字段、表/索引/FK/CHECK；
- 新增 `session` actor claim 仍不改 Better Auth 行为；
- 新增 `sales_security` key table/schema；
- 不启用 v2 function EXECUTE；
- 不删除旧 unique；
- 历史 NULL/orphan 只做预检，不猜测。

### Phase B — Compatibility

- 兼容读取 legacy/bound；
- v2 functions 已存在但 EXECUTE 撤销；
- 旧 notes 路由返回 410/只读；
- 旧应用仍使用旧角色，任何生产兼容暴露必须关闭写 API；
- 所有测试在隔离库。

### Phase C — Role/ACL

- 创建 `elevator_web_runtime_v2`、`elevator_worker_runtime_v2`、
  `elevator_sales_definer`、`elevator_owner`；
- 明确 owner 迁移 precheck；在维护窗口把 database/schema/目标表/sequence/function
  owner 从可登录角色迁至 NOLOGIN owner；
- 授予 Web Requirement/Advisor/Selection 的最小业务 DML；
- 四个销售函数的 EXECUTE 继续保持撤销；
- 内部 resolver/helper 不授予 Web；
- 撤销 PUBLIC 和旧角色函数权限；
- `project_identity_guard` 与 `UPDATE(id)` 行锁权限必须在同一受控事务中安装；
  identity guard 不存在时不得先授予 `UPDATE(id)`；
- 验证 `prosecdef/proconfig/proacl` 和对象 owner。

### Phase D — Freeze/Drain

顺序：

1. 冻结销售/需求/选型写入；
2. 停止旧 Web/Worker/Scheduler/Watchdog/脚本；
3. 旧角色 NOLOGIN/CONNECT 撤权；
4. terminate 旧 backend；
5. 按第 7 节处理/review prepared xacts；
6. 再次验证无旧 session/prepared xact；
7. 记录证据、备份、回滚点。

### Phase E — Contract

前提：Contract 状态必须是
`ELIGIBLE_FOR_CONTROLLED_CUTOVER`，并获得独立授权。

执行：

- SelectionRun requirementProject 回填/验证/非空；
- assignedTo orphan precheck 通过后加 FK；
- SalesHandoff exact FK/CHECK/unique；
- note idempotency unique；
- 删除旧 projectId unique；
- 启用 Trigger；
- Catalog/ACL/负向测试；
- postcheck 通过后授予 Web 四个销售函数 EXECUTE；
- 仍不允许未经 canary 的 v2 write 解冻。

### Phase F — Resume

- 启动 v2 Web/Worker；
- 验证角色、Build ID、application_name；
- 调用销售函数 canary；
- 检查旧角色连接拒绝、旧 API 410、旧 unique 不存在；
- canary 通过后才解冻。

### Phase G — Cleanup

- 保留 projectId、bound 字段、历史 note/audit；
- 旧角色 NOLOGIN 状态保留审计；
- 不删除历史；任何历史清理另行设计。

### 回滚原则

| 阶段 | 回滚 |
|---|---|
| Expand | 保留 additive schema，回退旧应用；不编辑历史 Migration |
| Compatibility | 关闭 v2 flag，回到旧读取；旧 unique 仍存在 |
| Role/ACL provisioning | 从批准的 owner/grant 快照恢复；保持旧应用可用 |
| Freeze/Drain | 只有旧角色和旧应用能完整恢复且有凭据证据时才恢复；否则保持冻结 |
| Contract transaction failure | DDL 整事务回滚，保留 Expand |
| Contract committed | 不回退到依赖旧 unique 的代码；只能 snapshot 恢复（明确 RPO/RTO）或 forward-fix |
| v2 Resume | 停止 v2、保持旧角色 NOLOGIN、forward-fix；不得自动恢复旧 API |

任何回滚都不得：

- 删除或伪造历史 handoff/note/audit；
- 重新启用旧 notes 路径；
- 在没有证据时 COMMIT PREPARED；
- 关闭 Trigger 或给 Web 直接销售表写权限；
- 把 owner/migration 凭据暴露给 Web。

## 14. 测试矩阵

### 14.1 DB / SECURITY DEFINER

| ID | 场景 | 预期 |
|---|---|---|
| `SD-01` | 每函数 catalog owner/search_path/prosecdef | 与设计一致，PUBLIC 无 EXECUTE |
| `SD-02` | NULL actor/claim/signature/handoff/project/status | INVALID，不写 |
| `SD-03` | 过期/未来 claim、错误 key、错误签名 | INVALID，不写 |
| `SD-04` | 同 key 同 payload 重放 | 一 note/一 handoff，第二个 replay |
| `SD-05` | 同 key 不同 payload | 409 `IDEMPOTENCY_KEY_REUSED`/context conflict |
| `SD-06` | 低级 resolver/helper 直接 EXECUTE | 42501 |
| `SD-07` | temporary schema/search_path 劫持 | 不命中，仍调用正确 schema |
| `SD-08` | direct INSERT/UPDATE sales table by Web | 42501 |
| `SD-09` | direct SELECT sales table by Web | 42501 或受控函数外无数据 |
| `SD-10` | function owner/superuser 检查 | 无超级权限、不可由 Web replace |
| `SD-11` | unique conflict different constraint | 不返回伪 replay |

### 14.2 Project 锁 / 并发

| ID | 场景 | 证据 |
|---|---|---|
| `CC-REQ-01` | 两 PATCH 同 Project | A commit，B 409；final row fields = A |
| `CC-ADV-01` | 两 Advisor messages | 一个成功，一个 version conflict；无孤儿 message |
| `CC-RUN-01` | new Requirement vs SelectionRun | Project lock；old run not current |
| `CC-SEL-01` | SelectionRun vs sales follow-up | old context cannot advance |
| `CC-HAND-01` | same exact context | one row, same payload replay |
| `CC-NOTE-01` | same key concurrent | one note, one replay |
| `CC-NOTE-02` | note vs CLOSED | serialized; no post-close note |
| `CC-NOTE-03` | unique conflict after cross-project race | no partial note/status/audit |
| `CC-ROLE-01` | old role NOLOGIN/reconnect | auth failure |
| `CC-XACT-01` | prepared xact exists | Contract BLOCKED |
| `CC-XACT-02` | prepared xact approved rollback then recheck | same gate remains blocked until zero |
| `CC-TIME-01` | microsecond same-millisecond runs | DB/TS same AMBIGUOUS or DB authority only |
| `CC-PAGE-01` | same updatedAt tie | stable `id` tie-break, no duplicate/missing |
| `CC-RETRY-01` | 40001/40P01/P2034 | bounded retry, no duplicate |
| `CC-RETRY-02` | commit unknown + same idempotency key | replay, no new note |

每个数据库测试记录 A/B/Observer 独立 backend PID、application_name、barrier、
`pg_stat_activity.wait_event_type`、`pg_locks`、SQLSTATE、commit/rollback 和实体
最终状态。

### 14.3 隔离环境 / E2E

- all five functions with actor claims；
- NULL/overlength/illegal enum；
- fake API user ID and fake project ID；
- actor claim 错误/过期/HMAC key 撤销；
- assignedToId orphan precheck；
- legacy/closed historical；
- cross-project handoff；
- `SALES_MANAGE` missing/project scope；
- pagination/search/export/count scope；
- page RSC/props/payload no unauthorized sales；
- old API 410 and old role auth failure；
- prepared xact Contract gate；
- Prisma/Migration/Catalog diff；
- real E2E only after isolated DB contracts pass.

### 14.4 E2E 实体断言（继承 R3）

R3 的 E2E 矩阵保持为最低要求，至少断言：

- 旧 R1/S1/H1 的 Project、requirementId、selectionRunId 和状态；
- 新 R2 成为最新需求后 S1/H1 不再 actionable；
- 新 S2 产生新 H2，H1 永不自动恢复；
- 旧 API 被拒绝且 status/note count 不变；
- 两个并发 PATCH 只产生一个 revision，另一个 409；
- note 同 key 同 payload 只有一个 note，异 payload 409；
- 跨项目 handoff 和无 `SALES_MANAGE` 不返回销售数据；
- `contextState` 只来自 DB DTO，不由页面自行推导。

## 15. 未解决 / BLOCKED 条件

以下任一情况使 R4 实施和 Contract 保持 BLOCKED：

```text
HMAC key Secret 或 pgcrypto 未获批准/未配置
任意五个函数的 proconfig/prosecdef/proacl 与设计不一致
Web/Worker/Definer 权限矩阵无法逐对象证明
旧角色仍是 owner 或可登录/有成员连接
存在未知 Scheduler/Worker/脚本/连接池
目标 DB 存在未解释 prepared transaction
旧 prepared transaction 无法安全 rollback/归属
Prisma Schema 与 Migration 不一致
resolver 微秒/毫秒语义不一致
note 冲突无法精确恢复
```

## 16. 未验证事项

```text
Prisma validate/generate:          NOT VERIFIED
forward Migration:                 NOT VERIFIED
PostgreSQL Catalog:                NOT VERIFIED
SECURITY DEFINER syntax/ACL:       NOT VERIFIED
pgcrypto/HMAC key infrastructure:  NOT VERIFIED
Project lock behaviors:            NOT VERIFIED
prepared transaction gate:         NOT VERIFIED
DB/TS resolver parity:             NOT VERIFIED
E2E/Browser/RSC:                   NOT EXECUTED
Real Contract:                     NOT AUTHORIZED
```

## 17. Git 状态

调查前：

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            149
Untracked recursive files:    160
```

新增本报告后预期：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            150
Untracked recursive files:    161
```

本轮没有修改源码、Schema、Migration、测试或配置。

## 18. 报告 SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
fbe391da69a9c2aa3a66f872cf12ca0bf9468e27d5eb6f877d6b30a5a545996f

Bytes:                    64821
Physical lines:           2074
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符，
对 UTF-8 文件字节计算 SHA-256。
