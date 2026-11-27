# APP-WORKBENCH-R2 SalesHandoff Invalidation & Snapshot Consistency Design R6

## 0. 状态

```text
DESIGN COMPLETE — IMPLEMENTATION NOT STARTED
ISOLATED VALIDATION NOT PERFORMED
REAL CONTRACT NOT AUTHORIZED
```

本文件只修正 R5 独立审查指出的五个阻断项：

1. Claim 保护业务函数只有接口、缺少完整 body；
2. expectedVersion 与当前 API/contracts 不一致；
3. 共享 AuditLog 统一撤权会破坏文件生命周期；
4. 旧函数签名和 ACL 可能留下 HMAC-only 旁路；
5. owner/runtime 身份迁移未闭环。

R5 已通过的 Claim 唯一约束、transactionId、PENDING 守卫、deferred trigger、
receipt、Project 锁、Requirement/SelectionRun 精确绑定、note 幂等、resolver
毫秒规则、stable pagination、SALES_MANAGE 过滤和 prepared transaction
门禁保持不变。

## 1. R5 → R6 修正对照

| R5 阻断 | R6 修正 |
|---|---|
| 新业务函数只有接口 | R4 完整销售函数 body 作为规范源；R6 为 Requirement/Advisor/Selection/R2 Audit 新增完整 body；不得留下未定义占位 |
| expectedVersion 与 contract 不一致 | 定义 PATCH 的 expectedVersion、Advisor turn 的双版本语义、Route/Zod/409/前端/E2E |
| AuditLog 与文件生命周期冲突 | R2 使用独立 `sales_security.r2_audit_event`；旧 `public.audit_log` 和文件生命周期 grant 保持原样 |
| 旧函数签名/ACL 不清 | 建立精确重载清单、旧 EXECUTE 撤销、兼容窗口、DROP 和 `pg_proc` 门禁 |
| owner 仍是登录角色 | 定义 `elevator_owner`、migration、Web/Worker、definer 和旧 `elevator_app` 的隔离及 ownership transfer |

## 2. 现场与输入

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            153
Untracked recursive files:    164
```

R5 design SHA-256:

```text
7936f40b12cd137bb772af8f03a83c416a9a5ac1504497cd663c5e7ecd3f3178
```

R4 design whole-file SHA-256:

```text
630744cbfe92dd52a346779a3899bee37bd6e5e824a344fd9c018046a2daf75a
```

R6 读取了 R5、R4、当前 Prisma Schema、contracts、Requirement/Advisor/
Selection/Sales Route 与 service、Web/Worker AuditLog 调用点、permissions 和
文件生命周期边界。未读取 `.env`、密钥或连接串。

## 3. Schema 依赖与当前缺口

当前 Schema **没有** R4 的精确 SalesHandoff binding 字段，也没有
SelectionRun.requirementProjectId 或 SalesFollowUpNote 幂等字段。R6 body 以
已批准的 R4 Schema Expand 为前提；这些字段尚未存在前，函数不能编译或启用。

| 表 | 必需字段/约束 |
|---|---|
| `selection_run` | `requirementProjectId text NOT NULL`；`UNIQUE (id, projectId, requirementId)` |
| `sales_handoff` | `boundRequirementId`, `requirementProjectId`, `boundSelectionRunId`, `selectionRunProjectId`, `selectionRunRequirementId`, `createPayload`；context unique/check |
| `sales_follow_up_note` | `requestKey`, `operationType`, `protocolVersion`, `requestPayload`, `statusAfter`；`UNIQUE (authorUserId, operationType, requestKey)` |

上述字段和 FK/CHECK 的 Expand 属于独立 Schema/Migration 审查，R6 不虚构列名。
当前 R4 复合 FK、旧 `projectId` unique 删除、backfill 和 Trigger 仍是独立
Contract 前提。

## 4. 完整函数清单

| # | 函数 | Body 规范来源 |
|---:|---|---|
| 1 | `canonical_field_v2(text)` | R4 §4.1 |
| 2 | `canonical_json_v3(jsonb)` | R6 §8.1 |
| 3 | `assert_sales_actor_v2(jsonb,bytea,text,text)` | R4 §4.2 |
| 4 | `actor_has_permission_v2(text,text,text)` | R4 §4.3 |
| 5 | `consume_sales_actor_claim_v3(...)` | R5 §5.1 |
| 6 | `finalize_sales_actor_claim_v3(...)` | R5 §5.2 |
| 7 | `append_r2_audit_event_v3(...)` | R6 §5.2 |
| 8 | `app_resolve_current_completed_selection_v2(text)` | R4 §5.1 |
| 9 | `app_create_requirement_version_v3(...)` | R6 §8.2 |
| 10 | `app_confirm_requirement_v3(...)` | R6 §8.3 |
| 11 | `app_start_advisor_conversation_v3(...)` | R6 §6.4 |
| 12 | `app_finish_advisor_turn_v3(...)` | R6 §6.5 |
| 13 | `app_create_selection_run_v3(...)` | R6 §6.1 |
| 14 | `app_update_selection_run_status_v3(...)` | R6 §6.2（默认禁用） |
| 15 | `app_sales_create_handoff_v2(...)` | R4 §5.2 + R6 audit substitution |
| 16 | `app_append_sales_followup_v2(...)` | R4 §5.3 + R6 signature/audit substitution |
| 17 | `app_list_sales_handoffs_v2(...)` | R4 §5.4 + R5 claim/receipt wrapper |
| 18 | `app_get_sales_handoff_context_v2(...)` | R4 §5.5 + R6 signature/audit/receipt wrapper |

完整函数 registry 共 18 个：4 个 R4 销售业务、6 个 R6 受保护业务、2 个 Claim
helper、2 个 R4/R6 canonical/audit helper、1 个 resolver、3 个 Actor/RBAC helper。
此外 `protect_r2_audit_event_v3()` 有完整 Trigger body。

完整性断言：registry 中不存在仅声明签名的条目；R4 的五个 body 由上述精确
行范围和 whole-file SHA 绑定，R6 新增函数均给出 `CREATE OR REPLACE FUNCTION`
至 `$fn$;` 的完整 body，R5 consume/finalize 和 Trigger body 保持为规范源。

`FULL-R4` 不是接口占位。R4 的完整 `CREATE OR REPLACE FUNCTION ... AS $fn$` body
是函数源代码；R6 只允许增加 Claim wrapper、在 note/get 增加已签名 projectId、
将 R2 销售审计从 `public.audit_log` 改为 `sales_security.r2_audit_event`，
并保留全部 R4 业务分支。

### 4.3 现场 Route 到函数映射

| 现场入口 | 当前现场写路径 | R6 目标 |
|---|---|---|
| `PATCH /api/projects/[projectId]/requirements` | `requirements/route.ts:52-69` 读取/合并后调用 old store | `app_create_requirement_version_v3` |
| `POST /api/projects/[projectId]/requirements/confirm` | confirm Route + old store | `app_confirm_requirement_v3` |
| `POST /api/projects/[projectId]/advisor/conversations` | `advisor/service.ts` conversation/requirement/message | `app_start_advisor_conversation_v3` |
| `POST .../advisor/conversations/[conversationId]/messages` | provider + old message/requirement writes | `app_finish_advisor_turn_v3` |
| `POST /api/projects/[projectId]/selection-runs` | `selection/service.ts` old run/recommendation writes | `app_create_selection_run_v3` |
| `POST /api/projects/[projectId]/sales-handoff` | `mvp/store.ts` old SalesHandoff write | R4 `app_sales_create_handoff_v2` + Claim/R2 audit wrapper |
| `POST /api/admin/sales/[handoffId]/notes` | `mvp/store.ts` old note/status write | R4 `app_append_sales_followup_v2` + Claim/R2 audit wrapper |
| `GET /api/admin/sales` | `listSalesHandoffs` | R4 list + Claim/receipt |
| sales detail page | `getLatestSalesHandoff` | R4 get + Claim/receipt |

`requirements/route.ts:52-69` 当前会先读当前需求再 merge；R6 必须把
`expectedVersion` 加入客户端请求和 Claim，不能让 Route 静默读取并提交一个用户没有
看到的版本。

## 5. R2 Audit Event 隔离

### 5.1 R2 表

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
  CONSTRAINT r2_audit_operation_check
    CHECK (operation IN (
      'REQUIREMENT_PATCH',
      'REQUIREMENT_CONFIRM',
      'ADVISOR_START',
      'ADVISOR_TURN',
      'SELECTION_CREATE',
      'SELECTION_STATUS_UPDATE',
      'SALES_HANDOFF_CREATE',
      'SALES_FOLLOW_UP_NOTE'
    )),
  CONSTRAINT r2_audit_digest_check
    CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT r2_audit_project_fkey
    FOREIGN KEY (project_id) REFERENCES public."project" (id)
    ON DELETE RESTRICT,
  CONSTRAINT r2_audit_actor_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public."user" (id)
    ON DELETE RESTRICT,
  CONSTRAINT r2_audit_claim_fkey
    FOREIGN KEY (claim_hash)
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
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'r2 audit events are append-only'
      USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END;
$fn$;

CREATE TRIGGER r2_audit_event_append_only
BEFORE UPDATE OR DELETE ON sales_security.r2_audit_event
FOR EACH ROW
EXECUTE FUNCTION sales_security.protect_r2_audit_event_v3();
```

共享 `public.audit_log` 的 Web/Worker 文件生命周期写入保持不变；R2 不把任何
现有文件调用迁移到这张表。R2 业务函数在同一事务插入 `r2_audit_event`。

R2 Audit Event 默认至少保留 365 天；任何清理、归档或删除都需要独立维护角色、
批准窗口和证据。R6 不实现自动清理，也不允许 Web/Worker DELETE 或 TRUNCATE。
`claim_hash` 与 receipt 关联，但两者保留周期不同。

### 5.2 R2 audit helper 完整 body

```sql
CREATE OR REPLACE FUNCTION sales_security.append_r2_audit_event_v3(
  p_claim_hash bytea,
  p_project_id text,
  p_actor_user_id text,
  p_operation text,
  p_object_type text,
  p_object_id text,
  p_request_id text,
  p_payload_digest text,
  p_old_value jsonb,
  p_new_value jsonb,
  p_reason text
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
    RAISE EXCEPTION 'invalid r2 audit event'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM sales_security.actor_claim_consumption AS c
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

  INSERT INTO sales_security.r2_audit_event (
    id, project_id, actor_user_id, operation, object_type, object_id,
    request_id, claim_hash, payload_digest, old_value, new_value, reason
  )
  VALUES (
    v_id, p_project_id, p_actor_user_id, p_operation, p_object_type,
    p_object_id, p_request_id, p_claim_hash, p_payload_digest,
    p_old_value, p_new_value, p_reason
  );

  RETURN v_id;
END;
$fn$;
```

## 6. 其他受保护函数 body

### 6.1 Selection create：`app_create_selection_run_v3`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_create_selection_run_v3(
  p_claim jsonb,
  p_signature bytea,
  p_project_id text,
  p_object_id text,
  p_requirement_id text,
  p_expected_version integer,
  p_input_snapshot jsonb,
  p_result jsonb,
  p_payload_canonical text
)
RETURNS TABLE (
  outcome text, selection_run_id text, replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record;
  v_actor text := p_claim->>'actorUserId';
  v_current public."building_requirement"%ROWTYPE;
  v_run_id text := pg_catalog.gen_random_uuid()::text;
  v_status "public"."SelectionRunStatus";
  v_item jsonb;
  v_canonical text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL
     OR p_project_id IS NULL OR p_object_id IS NULL
     OR p_requirement_id IS NULL OR p_expected_version IS NULL
     OR p_object_id IS DISTINCT FROM p_requirement_id
     OR p_expected_version < 1 OR p_input_snapshot IS NULL
     OR p_result IS NULL OR p_payload_canonical IS NULL
     OR jsonb_typeof(p_input_snapshot) <> 'object'
     OR jsonb_typeof(p_result) <> 'object'
     OR p_result->>'rulesVersion' IS NULL
     OR p_result->>'status' NOT IN ('COMPLETED', 'NO_VALID_MATCH')
     OR jsonb_typeof(p_result->'recommendations') <> 'array'
     OR jsonb_typeof(p_result->'alternatives') <> 'array'
     OR jsonb_typeof(p_result->'improvementCandidates') <> 'array' THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::text, false;
    RETURN;
  END IF;
  v_status := (p_result->>'status')::"public"."SelectionRunStatus";
  v_canonical := concat_ws('|',
    sales_security.canonical_field_v2('SELECTION_CREATE'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_object_id),
    sales_security.canonical_field_v2(p_requirement_id),
    sales_security.canonical_field_v2(p_expected_version::text),
    sales_security.canonical_json_v3(p_input_snapshot),
    sales_security.canonical_json_v3(p_result)
  );
  IF v_canonical IS DISTINCT FROM p_payload_canonical THEN
    RETURN QUERY SELECT 'INVALID_REQUEST', NULL::text, false;
    RETURN;
  END IF;

  SELECT * INTO v_claim
  FROM sales_security.consume_sales_actor_claim_v3(
    p_claim, p_signature, 'SELECTION_CREATE',
    p_project_id, p_object_id, p_payload_canonical
  );
  IF v_claim.outcome IN ('REPLAY', 'REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(v_actor, 'selection.run', p_project_id) THEN
      RETURN QUERY SELECT 'FORBIDDEN', NULL::text, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'selectionRunId', true;
    RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome, NULL::text, false;
    RETURN;
  END IF;

  PERFORM 1 FROM public."project" AS p WHERE p.id = p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor, 'selection.run', p_project_id
  ) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SELECTION_CREATE', NULL,
      jsonb_build_object('outcome', 'FORBIDDEN', 'replayed', false)
    );
    RETURN QUERY SELECT 'FORBIDDEN', NULL::text, false;
    RETURN;
  END IF;

  SELECT * INTO v_current
  FROM public."building_requirement" AS br
  WHERE br.id = p_requirement_id AND br."projectId" = p_project_id
  FOR UPDATE;
  IF NOT FOUND OR v_current.version <> p_expected_version
     OR v_current.status <> 'CUSTOMER_CONFIRMED' THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'SELECTION_CREATE', NULL,
      jsonb_build_object('outcome', 'VERSION_CONFLICT', 'replayed', false)
    );
    RETURN QUERY SELECT 'VERSION_CONFLICT', NULL::text, false;
    RETURN;
  END IF;

  INSERT INTO public."selection_run" (
    id, "projectId", "requirementId", "requirementProjectId",
    "createdById", "rulesVersion", status, "inputSnapshot",
    "outputSnapshot", "createdAt"
  ) VALUES (
    v_run_id, p_project_id, p_requirement_id, p_project_id,
    v_actor, p_result->>'rulesVersion', v_status, p_input_snapshot,
    p_result, clock_timestamp()
  );

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(
      coalesce(p_result->'recommendations', '[]'::jsonb) ||
      coalesce(p_result->'alternatives', '[]'::jsonb) ||
      coalesce(p_result->'improvementCandidates', '[]'::jsonb)
    )
  LOOP
    IF v_item->'product'->>'productId' IS NULL
       OR v_item->'product'->>'specificationVersion' IS NULL
       OR v_item->>'budgetAssessment' IS NULL
       OR v_item->>'recommendationType' IS NULL
       OR jsonb_typeof(v_item->'matchingReasons') <> 'array'
       OR jsonb_typeof(v_item->'unmatchedConstraints') <> 'array'
       OR jsonb_typeof(v_item->'warnings') <> 'array'
       OR jsonb_typeof(v_item->'sourceReferences') <> 'array' THEN
      RAISE EXCEPTION 'invalid selection recommendation'
        USING ERRCODE = '22023';
    END IF;
    INSERT INTO public."selection_recommendation" (
      id, "selectionRunId", "productId", "specVersion",
      "budgetAssessment", "recommendationType", reasons,
      limitations, "sourceReferences", "createdAt"
    ) VALUES (
      pg_catalog.gen_random_uuid()::text, v_run_id,
      v_item->'product'->>'productId',
      (v_item->'product'->>'specificationVersion')::integer,
      (v_item->>'budgetAssessment')::"public"."BudgetAssessment",
      v_item->>'recommendationType', v_item->'matchingReasons',
      coalesce(v_item->'unmatchedConstraints', '[]'::jsonb) ||
        coalesce(v_item->'warnings', '[]'::jsonb),
      v_item->'sourceReferences', clock_timestamp()
    );
  END LOOP;

  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash, p_project_id, v_actor, 'SELECTION_CREATE',
    'SelectionRun', v_run_id, p_claim->>'requestId',
    lower(p_claim->>'payloadDigest'), NULL,
    jsonb_build_object('selectionRunId', v_run_id,
      'requirementId', p_requirement_id, 'status', v_status::text), NULL
  );
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash, 'COMPLETED', 'SELECTION_CREATE', v_run_id,
    jsonb_build_object('outcome', 'OK', 'selectionRunId', v_run_id,
      'replayed', false)
  );
  RETURN QUERY SELECT 'OK', v_run_id, false;
END;
$fn$;
```

### 6.2 Disabled selection status update

当前没有获批的普通状态更新入口。R6 给出完整 body，但它只返回禁用结果，不写业务表，
也不授予 Web EXECUTE：

```sql
CREATE OR REPLACE FUNCTION sales_command.app_update_selection_run_status_v3(
  p_claim jsonb,
  p_signature bytea,
  p_project_id text,
  p_object_id text,
  p_selection_run_id text,
  p_expected_status text,
  p_next_status text,
  p_payload_canonical text
)
RETURNS TABLE (outcome text, selection_run_id text, replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL OR p_project_id IS NULL
     OR p_object_id IS NULL OR p_selection_run_id IS NULL
     OR p_expected_status IS NULL OR p_next_status IS NULL
     OR p_payload_canonical IS NULL THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::text, false;
    RETURN;
  END IF;
  SELECT * INTO v_claim
  FROM sales_security.consume_sales_actor_claim_v3(
    p_claim, p_signature, 'SELECTION_STATUS_UPDATE',
    p_project_id, p_object_id, p_payload_canonical
  );
  IF v_claim.outcome IN ('REPLAY', 'REQUEST_REPLAY') THEN
    RETURN QUERY SELECT v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'selectionRunId', true;
    RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome, NULL::text, false;
    RETURN;
  END IF;
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash, 'REJECTED', 'SELECTION_STATUS_UPDATE', NULL,
    jsonb_build_object('outcome', 'OPERATION_DISABLED', 'replayed', false)
  );
  RETURN QUERY SELECT 'OPERATION_DISABLED', p_selection_run_id, false;
END;
$fn$;
```

### 6.3 R4 SalesHandoff full-body incorporation

R6 不复制 R4 的五个完整销售函数 body 以制造两套业务逻辑；R4 §5.1–§5.5 的
`CREATE OR REPLACE FUNCTION ... AS $fn$` 是规范源代码。R6 精确变更如下：

| 函数 | R4 完整 body 位置 |
|---|---|
| `app_resolve_current_completed_selection_v2` | R4 368–477 |
| `app_sales_create_handoff_v2` | R4 478–703 |
| `app_append_sales_followup_v2` | R4 704–990 |
| `app_list_sales_handoffs_v2` | R4 991–1141 |
| `app_get_sales_handoff_context_v2` | R4 1142–1261 |

1. `app_resolve_current_completed_selection_v2` body 不变。
2. `app_sales_create_handoff_v2` 先调用 Claim consume；所有业务 return 前
   finalize；`public.audit_log` 写入替换为
   `sales_security.append_r2_audit_event_v3`。
3. `app_append_sales_followup_v2` 增加已签名 `p_project_id` 参数，先 consume Claim，
   再锁 Project、读 handoff、执行 R4 note/status 逻辑；最终写 R2 audit event。
4. `app_list_sales_handoffs_v2` 增加 Claim consume 和 digest/count receipt；
   DTO 只在本事务返回，receipt 不保存销售 DTO；函数为 `VOLATILE`。
5. `app_get_sales_handoff_context_v2` 增加已签名 `p_project_id`，先 consume Claim，
   再锁 Project 并核对 handoff 属于该 Project；R2 audit 不写，receipt 只保存
   digest/count；函数为 `VOLATILE`。

R6 的完整函数体集合是“R4 body + 上述 wrapper”，不是接口契约。实施 diff 必须
逐函数列出增删行，并在编译前确认没有第二套 resolver、note 或 CLOSED 逻辑。

### 6.4 Advisor start：`app_start_advisor_conversation_v3`

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
  outcome text, conversation_id text, requirement_id text, replayed boolean
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
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::text, NULL::text, false;
    RETURN;
  END IF;
  IF p_installation_scenario NOT IN (
    'OLD_BUILDING_ADDITION', 'EXISTING_ELEVATOR_RENOVATION',
    'NEW_BUILDING_INSTALLATION'
  ) THEN
    RETURN QUERY SELECT 'INVALID_REQUEST', NULL::text, NULL::text, false;
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
    RETURN QUERY SELECT 'INVALID_REQUEST', NULL::text, NULL::text, false;
    RETURN;
  END IF;

  SELECT * INTO v_claim
  FROM sales_security.consume_sales_actor_claim_v3(
    p_claim, p_signature, 'ADVISOR_START',
    p_project_id, p_object_id, p_payload_canonical
  );
  IF v_claim.outcome IN ('REPLAY', 'REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(v_actor, 'advisor.use', p_project_id) THEN
      RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::text, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT
      v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'conversationId',
      v_claim.response_payload->>'requirementId', true;
    RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  PERFORM 1 FROM public."project" AS p WHERE p.id = p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor, 'advisor.use', p_project_id
  ) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'ADVISOR_START', NULL,
      jsonb_build_object('outcome', 'FORBIDDEN', 'replayed', false)
    );
    RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::text, false;
    RETURN;
  END IF;

  INSERT INTO public."advisor_conversation"
    (id, "projectId", "createdById", provider, status, "createdAt", "updatedAt")
  VALUES
    (v_conversation_id, p_project_id, v_actor,
     'MOCK'::"public"."AdvisorProviderKind",
     'ACTIVE'::"public"."AdvisorConversationStatus",
     clock_timestamp(), clock_timestamp());
  INSERT INTO public."building_requirement" (
    id, "projectId", "conversationId", "installationScenario", status,
    version, fields, "missingFields", "professionalReviewRequired",
    "createdById", "updatedById", "createdAt", "updatedAt"
  ) VALUES (
    v_requirement_id, p_project_id, v_conversation_id, v_scenario, 'DRAFT',
    1, p_initial_fields, p_initial_missing_fields, true, v_actor, v_actor,
    clock_timestamp(), clock_timestamp()
  );
  INSERT INTO public."requirement_revision" (
    id, "requirementId", version, source, snapshot, "missingFields",
    status, "createdById", "createdAt"
  ) VALUES (
    v_revision_id, v_requirement_id, 1, 'MOCK_AI', p_initial_fields,
    p_initial_missing_fields, 'DRAFT', v_actor, clock_timestamp()
  );
  INSERT INTO public."advisor_message" (
    id, "conversationId", sequence, role, content, provider,
    "structuredPayload", "createdAt"
  ) VALUES (
    pg_catalog.gen_random_uuid()::text, v_conversation_id, 1,
    'ASSISTANT', p_initial_assistant_message, 'MOCK', NULL,
    clock_timestamp()
  );
  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash, p_project_id, v_actor, 'ADVISOR_START',
    'AdvisorConversation', v_conversation_id, p_claim->>'requestId',
    lower(p_claim->>'payloadDigest'), NULL,
    jsonb_build_object('conversationId', v_conversation_id,
      'requirementId', v_requirement_id), NULL
  );
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash, 'COMPLETED', 'ADVISOR_START', v_conversation_id,
    jsonb_build_object('outcome', 'OK', 'conversationId', v_conversation_id,
      'requirementId', v_requirement_id, 'replayed', false)
  );
  RETURN QUERY SELECT 'OK', v_conversation_id, v_requirement_id, false;
END;
$fn$;
```

### 6.5 Advisor turn：`app_finish_advisor_turn_v3`

`expectedRequirementVersion` 和 `expectedLastMessageSequence` 是不同字段，不能
合并成模糊的 `expectedVersion`。

```sql
CREATE OR REPLACE FUNCTION sales_command.app_finish_advisor_turn_v3(
  p_claim jsonb,
  p_signature bytea,
  p_project_id text,
  p_object_id text,
  p_conversation_id text,
  p_expected_requirement_version integer,
  p_expected_last_message_sequence integer,
  p_user_message text,
  p_assistant_message text,
  p_final_fields jsonb,
  p_final_missing_fields jsonb,
  p_provider_snapshot jsonb,
  p_payload_canonical text
)
RETURNS TABLE (
  outcome text, requirement_id text, version integer,
  assistant_message_id text, replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record;
  v_actor text := p_claim->>'actorUserId';
  v_conversation public."advisor_conversation"%ROWTYPE;
  v_current public."building_requirement"%ROWTYPE;
  v_new_requirement text := pg_catalog.gen_random_uuid()::text;
  v_revision_id text := pg_catalog.gen_random_uuid()::text;
  v_user_message_id text := pg_catalog.gen_random_uuid()::text;
  v_assistant_message_id text := pg_catalog.gen_random_uuid()::text;
  v_last_sequence integer;
  v_canonical text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL
     OR p_project_id IS NULL OR p_object_id IS NULL
     OR p_conversation_id IS NULL
     OR p_object_id IS DISTINCT FROM p_conversation_id
     OR p_expected_requirement_version IS NULL
     OR p_expected_requirement_version < 1
     OR p_expected_last_message_sequence IS NULL
     OR p_expected_last_message_sequence < 0
     OR p_user_message IS NULL OR btrim(p_user_message) = ''
     OR p_assistant_message IS NULL OR btrim(p_assistant_message) = ''
     OR p_final_fields IS NULL OR p_final_missing_fields IS NULL
     OR jsonb_typeof(p_final_fields) <> 'object'
     OR jsonb_typeof(p_final_missing_fields) <> 'array'
     OR p_payload_canonical IS NULL THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::text, NULL::integer, NULL::text, false;
    RETURN;
  END IF;
  v_canonical := concat_ws('|',
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
    sales_security.canonical_json_v3(p_provider_snapshot)
  );
  IF v_canonical IS DISTINCT FROM p_payload_canonical THEN
    RETURN QUERY SELECT 'INVALID_REQUEST', NULL::text, NULL::integer, NULL::text, false;
    RETURN;
  END IF;

  SELECT * INTO v_claim
  FROM sales_security.consume_sales_actor_claim_v3(
    p_claim, p_signature, 'ADVISOR_TURN',
    p_project_id, p_object_id, p_payload_canonical
  );
  IF v_claim.outcome IN ('REPLAY', 'REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(v_actor, 'advisor.use', p_project_id) THEN
      RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::integer, NULL::text, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT
      v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'requirementId',
      (v_claim.response_payload->>'version')::integer,
      v_claim.response_payload->>'assistantMessageId', true;
    RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome, NULL::text, NULL::integer, NULL::text, false;
    RETURN;
  END IF;

  PERFORM 1 FROM public."project" AS p WHERE p.id = p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor, 'advisor.use', p_project_id
  ) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'ADVISOR_TURN', NULL,
      jsonb_build_object('outcome', 'FORBIDDEN', 'replayed', false)
    );
    RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::integer, NULL::text, false;
    RETURN;
  END IF;

  SELECT * INTO v_conversation
  FROM public."advisor_conversation" AS c
  WHERE c.id = p_conversation_id FOR UPDATE;
  IF NOT FOUND OR v_conversation."projectId" <> p_project_id
     OR v_conversation.status <> 'ACTIVE' THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'ADVISOR_TURN', NULL,
      jsonb_build_object('outcome', 'CONTEXT_CONFLICT', 'replayed', false)
    );
    RETURN QUERY SELECT 'CONTEXT_CONFLICT', NULL::text, NULL::integer, NULL::text, false;
    RETURN;
  END IF;
  SELECT coalesce(max(m.sequence), 0) INTO v_last_sequence
  FROM public."advisor_message" AS m
  WHERE m."conversationId" = p_conversation_id;

  SELECT * INTO v_current
  FROM public."building_requirement" AS br
  WHERE br."projectId" = p_project_id
  ORDER BY br.version DESC, br.id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_current.version <> p_expected_requirement_version
     OR v_last_sequence <> p_expected_last_message_sequence THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'ADVISOR_TURN', NULL,
      jsonb_build_object('outcome', 'VERSION_CONFLICT', 'replayed', false)
    );
    RETURN QUERY SELECT 'VERSION_CONFLICT', NULL::text, NULL::integer, NULL::text, false;
    RETURN;
  END IF;

  INSERT INTO public."advisor_message" (
    id, "conversationId", sequence, role, content, provider,
    "structuredPayload", "createdAt"
  ) VALUES (
    v_user_message_id, p_conversation_id, v_last_sequence + 1,
    'USER', p_user_message, 'MOCK', NULL, clock_timestamp()
  );
  INSERT INTO public."building_requirement" (
    id, "projectId", "conversationId", "installationScenario", status,
    version, fields, "missingFields", "professionalReviewRequired",
    "createdById", "updatedById", "createdAt", "updatedAt"
  ) VALUES (
    v_new_requirement, p_project_id, p_conversation_id,
    v_current."installationScenario", 'DRAFT', v_current.version + 1,
    p_final_fields, p_final_missing_fields, true, v_actor, v_actor,
    clock_timestamp(), clock_timestamp()
  );
  INSERT INTO public."requirement_revision" (
    id, "requirementId", version, source, snapshot, "missingFields",
    status, "createdById", "createdAt"
  ) VALUES (
    v_revision_id, v_new_requirement, v_current.version + 1, 'MOCK_AI',
    p_final_fields, p_final_missing_fields, 'DRAFT', v_actor, clock_timestamp()
  );
  INSERT INTO public."advisor_message" (
    id, "conversationId", sequence, role, content, provider,
    "structuredPayload", "createdAt"
  ) VALUES (
    v_assistant_message_id, p_conversation_id, v_last_sequence + 2,
    'ASSISTANT', p_assistant_message, 'MOCK', p_provider_snapshot,
    clock_timestamp()
  );
  UPDATE public."advisor_conversation"
  SET "updatedAt" = clock_timestamp()
  WHERE id = p_conversation_id;
  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash, p_project_id, v_actor, 'ADVISOR_TURN',
    'AdvisorConversation', p_conversation_id, p_claim->>'requestId',
    lower(p_claim->>'payloadDigest'), NULL,
    jsonb_build_object('requirementId', v_new_requirement,
      'version', v_current.version + 1,
      'assistantMessageId', v_assistant_message_id), NULL
  );
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash, 'COMPLETED', 'ADVISOR_TURN', p_conversation_id,
    jsonb_build_object('outcome', 'OK', 'requirementId', v_new_requirement,
      'version', v_current.version + 1,
      'assistantMessageId', v_assistant_message_id, 'replayed', false)
  );
  RETURN QUERY SELECT 'OK', v_new_requirement, v_current.version + 1,
    v_assistant_message_id, false;
END;
$fn$;
```

R2 event 的 append-only Trigger、TRUNCATE ACL 和唯一 claim 约束在实施时同时
启用。`public.audit_log` 不执行统一撤权。

## 7. Claim 事务协议

R6 使用 R5 的完整 `consume_sales_actor_claim_v3`、`finalize_sales_actor_claim_v3`、
Claim 表、PENDING guard 和 deferred trigger 作为规范源，不重新发明。每个受保护
业务函数必须按以下顺序执行：

```text
construct canonical payload
-> consume Claim (signature/session/scope/digest)
-> Project FOR UPDATE
-> RBAC and authority read
-> compare expectedVersion
-> business write
-> r2_audit_event insert
-> Claim receipt COMPLETED/REJECTED
-> single database COMMIT
```

任何异常、唯一冲突未闭环或未知结果整体回滚；外部 Provider 只能在提交前事务外
执行，且其输出必须进入已签名 payload。

## 8. R6 新增完整函数 body

以下函数假定第 3 节的 R4 Schema Expand 已完成。所有函数均为
`SECURITY DEFINER`、owner `elevator_sales_definer`、固定
`search_path=pg_catalog`，无动态 SQL，所有表/枚举全限定。若 Expand 字段不存在，
实施必须停止，不能修改字段名以适配。

### 8.1 Canonical JSON helper

```sql
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

服务端 canonical serializer 与 PostgreSQL jsonb 规范化输出必须一致；否则
expected digest 和数据库校验会 fail closed。

### 8.2 Requirement PATCH：`app_create_requirement_version_v3`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_create_requirement_version_v3(
  p_claim jsonb,
  p_signature bytea,
  p_project_id text,
  p_object_id text,
  p_expected_version integer,
  p_conversation_id text,
  p_installation_scenario text,
  p_fields jsonb,
  p_missing_fields jsonb,
  p_source text,
  p_payload_canonical text
)
RETURNS TABLE (
  outcome text,
  requirement_id text,
  version integer,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record;
  v_actor text := p_claim->>'actorUserId';
  v_digest text := lower(coalesce(p_claim->>'payloadDigest', ''));
  v_canonical text;
  v_current record;
  v_requirement_id text := pg_catalog.gen_random_uuid()::text;
  v_revision_id text := pg_catalog.gen_random_uuid()::text;
  v_scenario "public"."InstallationScenario";
  v_source "public"."RequirementRevisionSource";
  v_next integer;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL
     OR p_project_id IS NULL OR p_object_id IS NULL
     OR p_expected_version IS NULL OR p_expected_version < 0
     OR p_installation_scenario IS NULL OR p_fields IS NULL
     OR p_missing_fields IS NULL OR p_source IS NULL
     OR p_payload_canonical IS NULL
     OR jsonb_typeof(p_fields) <> 'object'
     OR jsonb_typeof(p_missing_fields) <> 'array' THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  IF p_installation_scenario NOT IN (
    'OLD_BUILDING_ADDITION',
    'EXISTING_ELEVATOR_RENOVATION',
    'NEW_BUILDING_INSTALLATION'
  ) OR p_source NOT IN ('CHAT_USER', 'MOCK_AI', 'USER_EDIT') THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  v_scenario := p_installation_scenario::"public"."InstallationScenario";
  v_source := p_source::"public"."RequirementRevisionSource";
  v_canonical := concat_ws(
    '|',
    sales_security.canonical_field_v2('REQUIREMENT_PATCH'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_object_id),
    sales_security.canonical_field_v2(p_expected_version::text),
    sales_security.canonical_field_v2(p_conversation_id),
    sales_security.canonical_field_v2(p_installation_scenario),
    sales_security.canonical_json_v3(p_fields),
    sales_security.canonical_json_v3(p_missing_fields),
    sales_security.canonical_field_v2(p_source)
  );
  IF v_canonical IS DISTINCT FROM p_payload_canonical THEN
    RETURN QUERY SELECT 'INVALID_REQUEST', NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  SELECT * INTO v_claim
  FROM sales_security.consume_sales_actor_claim_v3(
    p_claim, p_signature, 'REQUIREMENT_PATCH',
    p_project_id, p_object_id, p_payload_canonical
  );

  IF v_claim.outcome IN ('REPLAY', 'REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(
      v_actor, 'advisor.use', p_project_id
    ) THEN
      RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::integer, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT
      v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'requirementId',
      (v_claim.response_payload->>'version')::integer,
      true;
    RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome, NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  PERFORM 1 FROM public."project" AS p
  WHERE p.id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'REQUIREMENT_PATCH', NULL,
      jsonb_build_object('outcome', 'NOT_FOUND', 'replayed', false)
    );
    RETURN QUERY SELECT 'NOT_FOUND', NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  IF NOT sales_security.actor_has_permission_v2(
    v_actor, 'advisor.use', p_project_id
  ) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'REQUIREMENT_PATCH', NULL,
      jsonb_build_object('outcome', 'FORBIDDEN', 'replayed', false)
    );
    RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public."advisor_conversation" AS c
    WHERE c.id = p_conversation_id AND c."projectId" = p_project_id
  ) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'REQUIREMENT_PATCH', NULL,
      jsonb_build_object('outcome', 'CONTEXT_CONFLICT', 'replayed', false)
    );
    RETURN QUERY SELECT 'CONTEXT_CONFLICT', NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  SELECT br.id, br.version INTO v_current
  FROM public."building_requirement" AS br
  WHERE br."projectId" = p_project_id
  ORDER BY br.version DESC, br.id DESC LIMIT 1;

  IF (p_expected_version = 0 AND FOUND)
     OR (p_expected_version <> 0 AND NOT FOUND)
     OR (p_expected_version <> 0 AND v_current.version <> p_expected_version) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'REQUIREMENT_PATCH', NULL,
      jsonb_build_object('outcome', 'VERSION_CONFLICT', 'replayed', false)
    );
    RETURN QUERY SELECT 'VERSION_CONFLICT', NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  v_next := CASE WHEN p_expected_version = 0 THEN 1 ELSE p_expected_version + 1 END;
  INSERT INTO public."building_requirement" (
    id, "projectId", "conversationId", "installationScenario",
    status, version, fields, "missingFields", "professionalReviewRequired",
    "createdById", "updatedById", "createdAt", "updatedAt"
  ) VALUES (
    v_requirement_id, p_project_id, p_conversation_id, v_scenario,
    'DRAFT'::"public"."RequirementStatus", v_next, p_fields, p_missing_fields,
    true, v_actor, v_actor, clock_timestamp(), clock_timestamp()
  );
  INSERT INTO public."requirement_revision" (
    id, "requirementId", version, source, snapshot,
    "missingFields", status, "createdById", "createdAt"
  ) VALUES (
    v_revision_id, v_requirement_id, v_next, v_source, p_fields,
    p_missing_fields, 'DRAFT'::"public"."RequirementStatus", v_actor,
    clock_timestamp()
  );

  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash, p_project_id, v_actor, 'REQUIREMENT_PATCH',
    'BuildingRequirement', v_requirement_id, p_claim->>'requestId',
    v_digest, NULL,
    jsonb_build_object('requirementId', v_requirement_id, 'version', v_next),
    NULL
  );
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash, 'COMPLETED', 'REQUIREMENT_PATCH', v_requirement_id,
    jsonb_build_object('outcome', 'OK', 'requirementId', v_requirement_id,
      'version', v_next, 'replayed', false)
  );
  RETURN QUERY SELECT 'OK', v_requirement_id, v_next, false;
END;
$fn$;
```

### 8.3 Requirement confirm：`app_confirm_requirement_v3`

```sql
CREATE OR REPLACE FUNCTION sales_command.app_confirm_requirement_v3(
  p_claim jsonb,
  p_signature bytea,
  p_project_id text,
  p_object_id text,
  p_requirement_id text,
  p_expected_version integer,
  p_payload_canonical text
)
RETURNS TABLE (
  outcome text, requirement_id text, version integer, replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_claim record;
  v_actor text := p_claim->>'actorUserId';
  v_current public."building_requirement"%ROWTYPE;
  v_new_id text := pg_catalog.gen_random_uuid()::text;
  v_revision_id text := pg_catalog.gen_random_uuid()::text;
  v_canonical text;
BEGIN
  IF p_claim IS NULL OR p_signature IS NULL
     OR p_project_id IS NULL OR p_object_id IS NULL
     OR p_requirement_id IS NULL OR p_expected_version IS NULL
     OR p_object_id IS DISTINCT FROM p_requirement_id
     OR p_expected_version < 1 OR p_payload_canonical IS NULL THEN
    RETURN QUERY SELECT 'INVALID_ARGUMENT', NULL::text, NULL::integer, false;
    RETURN;
  END IF;
  v_canonical := concat_ws('|',
    sales_security.canonical_field_v2('REQUIREMENT_CONFIRM'),
    sales_security.canonical_field_v2(p_project_id),
    sales_security.canonical_field_v2(p_object_id),
    sales_security.canonical_field_v2(p_requirement_id),
    sales_security.canonical_field_v2(p_expected_version::text)
  );
  IF v_canonical IS DISTINCT FROM p_payload_canonical THEN
    RETURN QUERY SELECT 'INVALID_REQUEST', NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  SELECT * INTO v_claim
  FROM sales_security.consume_sales_actor_claim_v3(
    p_claim, p_signature, 'REQUIREMENT_CONFIRM',
    p_project_id, p_object_id, p_payload_canonical
  );
  IF v_claim.outcome IN ('REPLAY', 'REQUEST_REPLAY') THEN
    IF NOT sales_security.actor_has_permission_v2(v_actor, 'advisor.use', p_project_id) THEN
      RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::integer, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT
      v_claim.response_payload->>'outcome',
      v_claim.response_payload->>'requirementId',
      (v_claim.response_payload->>'version')::integer, true;
    RETURN;
  END IF;
  IF v_claim.outcome IS DISTINCT FROM 'CONSUMED' THEN
    RETURN QUERY SELECT v_claim.outcome, NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  PERFORM 1 FROM public."project" AS p WHERE p.id = p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT sales_security.actor_has_permission_v2(
    v_actor, 'advisor.use', p_project_id
  ) THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'REQUIREMENT_CONFIRM', NULL,
      jsonb_build_object('outcome', 'FORBIDDEN', 'replayed', false)
    );
    RETURN QUERY SELECT 'FORBIDDEN', NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  SELECT * INTO v_current
  FROM public."building_requirement" AS br
  WHERE br.id = p_requirement_id AND br."projectId" = p_project_id
  FOR UPDATE;
  IF NOT FOUND OR v_current.version <> p_expected_version
     OR v_current."missingFields" <> '[]'::jsonb
     OR v_current.status = 'CUSTOMER_CONFIRMED' THEN
    PERFORM sales_security.finalize_sales_actor_claim_v3(
      v_claim.claim_hash, 'REJECTED', 'REQUIREMENT_CONFIRM', NULL,
      jsonb_build_object('outcome', 'VERSION_CONFLICT', 'replayed', false)
    );
    RETURN QUERY SELECT 'VERSION_CONFLICT', NULL::text, NULL::integer, false;
    RETURN;
  END IF;

  INSERT INTO public."building_requirement" (
    id, "projectId", "conversationId", "installationScenario",
    status, version, fields, "missingFields", "professionalReviewRequired",
    "createdById", "updatedById", "createdAt", "updatedAt"
  ) VALUES (
    v_new_id, p_project_id, v_current."conversationId",
    v_current."installationScenario", 'CUSTOMER_CONFIRMED',
    v_current.version + 1, v_current.fields, v_current."missingFields",
    true, v_actor, v_actor, clock_timestamp(), clock_timestamp()
  );
  INSERT INTO public."requirement_revision" (
    id, "requirementId", version, source, snapshot, "missingFields",
    status, "createdById", "createdAt"
  ) VALUES (
    v_revision_id, v_new_id, v_current.version + 1,
    'USER_EDIT'::"public"."RequirementRevisionSource", v_current.fields,
    v_current."missingFields", 'CUSTOMER_CONFIRMED', v_actor, clock_timestamp()
  );
  PERFORM sales_security.append_r2_audit_event_v3(
    v_claim.claim_hash, p_project_id, v_actor, 'REQUIREMENT_CONFIRM',
    'BuildingRequirement', v_new_id, p_claim->>'requestId',
    lower(p_claim->>'payloadDigest'), NULL,
    jsonb_build_object('requirementId', v_new_id, 'version', v_current.version + 1),
    NULL
  );
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash, 'COMPLETED', 'REQUIREMENT_CONFIRM', v_new_id,
    jsonb_build_object('outcome', 'OK', 'requirementId', v_new_id,
      'version', v_current.version + 1, 'replayed', false)
  );
  RETURN QUERY SELECT 'OK', v_new_id, v_current.version + 1, false;
END;
$fn$;
```

## 9. expectedVersion API/contract 完整映射

### 9.1 Requirement PATCH

当前 contract 是 partial draft 且没有 expectedVersion；R6 要求：

```ts
export const requirementUpdateSchema = requirementDraftSchema
  .omit({ missingFields: true, professionalReviewRequired: true })
  .partial()
  .extend({
    installationScenario: installationScenarioSchema.optional(),
    expectedVersion: z.number().int().min(1),
  });
```

请求必须包含 `expectedVersion`，且该值进入 canonical payload。Route 不得先用
`getLatestRequirement()` 读取当前版本然后自行填入客户端未提供的值；否则会掩盖
用户看到的陈旧页面。服务端可以读取当前数据做展示，但客户端提交的 expected
version 必须作为用户意图的一部分被签名和校验。

响应：

```text
成功：200 + { requirement: { id, version, status } }
版本冲突：409 + { error: { code: "REQUIREMENT_VERSION_CONFLICT" } }
参数错误：400/422
权限错误：403
协议重放：200 + receipt 中的原 requirement/version
```

409 后前端必须使当前 requirement 版本失效，重新读取；保留用户草稿但禁止自动
提交旧 payload。只有用户再次确认才生成新 Claim/requestId。

### 9.2 Advisor turn

当前 `advisorMessageRequestSchema` 只有 `content`。R6 使用两个明确字段：

```ts
export const advisorMessageRequestSchema = z.object({
  content: z.string().trim().min(1).max(4_000),
  expectedRequirementVersion: z.number().int().min(1),
  expectedLastMessageSequence: z.number().int().min(0),
});
```

字段含义：

```text
expectedRequirementVersion:
  BuildingRequirement.version，不是 conversation 版本

expectedLastMessageSequence:
  AdvisorConversation 当前最后一条 message.sequence
```

两者都进入 Claim canonical payload；数据库在 Project 锁后分别核对要求版本和
消息序列。任一不匹配都返回 409，并且不得留下 user message、assistant message、
requirement 或 revision。

成功响应：

```json
{
  "assistantMessageId": "...",
  "requirement": { "id": "...", "version": 4, "status": "DRAFT" }
}
```

冲突响应：

```json
{
  "error": {
    "code": "ADVISOR_CONTEXT_CONFLICT",
    "message": "顾问会话或需求已被其他操作更新，请刷新后重试。"
  }
}
```

### 9.3 requestId、receipt 与网络超时

- Route 在发送 provider 前生成 requestId；provider 调用在数据库事务外。
- Claim 的 canonical payload 使用服务端 merge 后的 final fields 和两个版本字段。
- 同一 requestId + 同一 payload：恢复 receipt，不调用 provider，不重复写。
- 同一 requestId + 不同 payload：拒绝，不执行任何写。
- 网络超时：客户端先以同一 requestId 查询/重试 receipt；收到成功 receipt 后更新
  本地状态，不再次自动提交。
- 409：停止当前操作，重新读取；不能让后台重试自动覆盖新版本。

### 9.4 E2E 矩阵

| ID | 场景 | 预期 |
|---|---|---|
| `R6-CONTRACT-01` | 正常 PATCH | 200，DB 版本增加 1 |
| `R6-CONTRACT-02` | 正常 Advisor turn | 200，sequence +2，requirement +1 |
| `R6-CONTRACT-03` | 两 PATCH 同 expectedVersion | 一个成功，一个 409 |
| `R6-CONTRACT-04` | stale Advisor requirement version | 409，无部分消息 |
| `R6-CONTRACT-05` | stale message sequence | 409，无重复消息 |
| `R6-CONTRACT-06` | 同 requestId 同 payload | receipt 恢复，无重复写 |
| `R6-CONTRACT-07` | 同 requestId 异 payload | 拒绝，无写 |
| `R6-CONTRACT-08` | 响应丢失后重试 | 只恢复原 receipt |
| `R6-CONTRACT-09` | 缺字段/非法版本 | 400/422，不消费 Claim |
| `R6-CONTRACT-10` | 409 后前端刷新 | 不自动提交旧 payload |

## 10. R2 Audit Event 隔离与旧 AuditLog 兼容矩阵

| 对象/路径 | R2 Audit Event | 共享 `public.audit_log` |
|---|---|---|
| Requirement/Advisor/Selection | 同事务写入 R2 event | R2 不写 |
| SalesHandoff create/note | 同事务写入 R2 event | R2 不写 |
| Web file upload/download/view | 不使用 R2 event | 保持现有 AuditLog 调用 |
| Worker extraction/retry/recovery | 不使用 R2 event | 保持现有 AuditLog 调用 |
| Customer/project/building/unit | 不使用 R2 event | 保持现有 AuditLog 调用 |
| Web direct R2 Audit insert | 不授予 | 不适用 |
| Worker R2 Audit write | 不授予 | 不适用 |
| R2 event SELECT | 不授予 Web | 不适用 |

继续使用共享 `public.audit_log` 的现场调用点包括：

```text
apps/web/src/modules/audit/log.ts:18
apps/web/src/modules/projects/service.ts:49,131,217,264
apps/web/src/modules/mvp/store.ts:557,787,985
apps/web/src/modules/files/upload-service.ts:1250,2296
apps/web/src/modules/files/object-upload-service.ts:1122
apps/web/src/modules/files/field-review-service.ts:289
apps/web/src/modules/files/download-service.ts:205,262,617
apps/web/src/app/api/projects/[projectId]/files/[fileId]/route.ts:32
apps/web/src/app/api/projects/[projectId]/files/[fileId]/versions/[versionId]/extractions/[extractionId]/route.ts:43
apps/worker/src/file-processing-state.ts:163,221,285,407,465
```

R2 函数使用 `sales_security.r2_audit_event`，上述旧路径不在 R6 迁移或撤权范围内。

R2 审计表由 `elevator_sales_definer` 写；只有同事务业务函数能调用
`append_r2_audit_event_v3`。因此文件生命周期无需迁移，也不需要统一撤销
`public.audit_log`。

## 11. 旧函数签名、ACL 与 Catalog

### 11.1 旧/新精确签名

```text
OLD:
  app_append_sales_followup_v2(
    jsonb, bytea, text, public."SalesHandoffStatus", varchar, text
  )
  app_get_sales_handoff_context_v2(jsonb, bytea, text)

NEW:
  app_append_sales_followup_v2(
    jsonb, bytea, text, text, public."SalesHandoffStatus", varchar, text
  )
  app_get_sales_handoff_context_v2(jsonb, bytea, text, text)

NEW R6:
  app_create_requirement_version_v3(
    jsonb, bytea, text, text, integer, text, text, jsonb, jsonb, text, text
  )
  app_confirm_requirement_v3(jsonb, bytea, text, text, integer, text)
  app_start_advisor_conversation_v3(
    jsonb, bytea, text, text, text, jsonb, jsonb, text, text
  )
  app_finish_advisor_turn_v3(
    jsonb, bytea, text, text, text, integer, integer,
    text, text, jsonb, jsonb, jsonb, text
  )
  app_create_selection_run_v3(
    jsonb, bytea, text, text, text, integer, jsonb, jsonb, text
  )
  app_update_selection_run_status_v3(
    jsonb, bytea, text, text, text, text, text, text
  )
```

### 11.2 Cleanup protocol

```text
Phase 1: create new functions; revoke all OLD/PUBLIC/Web/Worker EXECUTE
Phase 2: migrate all callers to new exact signatures
Phase 3: verify pg_depend has no OLD callers and no prepared xact references OLD
Phase 4: freeze writes
Phase 5: DROP exact OLD signatures; never use DROP FUNCTION by name
Phase 6: postcheck pg_proc, ACL, runtime canary
```

旧 `app_append_sales_followup_v2` 的 6 参数版本和旧
`app_get_sales_handoff_context_v2` 的 3 参数版本不得继续作为可执行旁路。
HMAC-only 旧函数一律视为不安全，不能因新函数存在而保留。

### 11.3 Catalog 门禁

```sql
SELECT p.oid::regprocedure, pg_get_userbyid(p.proowner),
       p.prosecdef, p.proconfig, p.proacl
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname IN ('sales_command', 'sales_security')
ORDER BY p.oid::regprocedure::text;

SELECT r.rolname, r.rolcanlogin, r.rolsuper,
       pg_has_role(r.oid, 'elevator_owner', 'MEMBER') AS owner_member,
       pg_has_role(r.oid, 'elevator_sales_definer', 'MEMBER') AS definer_member
FROM pg_roles AS r
WHERE r.rolname IN (
  'elevator_app', 'elevator_owner', 'elevator_migration',
  'elevator_web_runtime_v2', 'elevator_worker_runtime_v2',
  'elevator_sales_definer'
);
```

必须同时检查 `pg_namespace`、`pg_class`、`pg_default_acl`、`pg_depend`、
`pg_trigger` 和 `pg_auth_members`。仅检查表 ACL 不足。

### 11.4 R6 function ACL plan

以下是精确签名 ACL 计划；执行前仍需隔离 Catalog 审核，不能作为已执行事实：

```sql
ALTER FUNCTION sales_command.app_create_requirement_version_v3(
  jsonb, bytea, text, text, integer, text, text, jsonb, jsonb, text, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_confirm_requirement_v3(
  jsonb, bytea, text, text, integer, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_start_advisor_conversation_v3(
  jsonb, bytea, text, text, text, jsonb, jsonb, text, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_finish_advisor_turn_v3(
  jsonb, bytea, text, text, text, integer, integer,
  text, text, jsonb, jsonb, jsonb, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_create_selection_run_v3(
  jsonb, bytea, text, text, text, integer, jsonb, jsonb, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_update_selection_run_status_v3(
  jsonb, bytea, text, text, text, text, text, text
) OWNER TO "elevator_sales_definer";

REVOKE ALL ON FUNCTION
  sales_command.app_create_requirement_version_v3(
    jsonb, bytea, text, text, integer, text, text, jsonb, jsonb, text, text
  ),
  sales_command.app_confirm_requirement_v3(
    jsonb, bytea, text, text, integer, text
  ),
  sales_command.app_start_advisor_conversation_v3(
    jsonb, bytea, text, text, text, jsonb, jsonb, text, text
  ),
  sales_command.app_finish_advisor_turn_v3(
    jsonb, bytea, text, text, text, integer, integer,
    text, text, jsonb, jsonb, jsonb, text
  ),
  sales_command.app_create_selection_run_v3(
    jsonb, bytea, text, text, text, integer, jsonb, jsonb, text
  ),
  sales_command.app_update_selection_run_status_v3(
    jsonb, bytea, text, text, text, text, text, text
  )
FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

GRANT EXECUTE ON FUNCTION
  sales_command.app_create_requirement_version_v3(
    jsonb, bytea, text, text, integer, text, text, jsonb, jsonb, text, text
  ),
  sales_command.app_confirm_requirement_v3(
    jsonb, bytea, text, text, integer, text
  ),
  sales_command.app_start_advisor_conversation_v3(
    jsonb, bytea, text, text, text, jsonb, jsonb, text, text
  ),
  sales_command.app_finish_advisor_turn_v3(
    jsonb, bytea, text, text, text, integer, integer,
    text, text, jsonb, jsonb, jsonb, text
  ),
  sales_command.app_create_selection_run_v3(
    jsonb, bytea, text, text, text, integer, jsonb, jsonb, text
  )
TO "elevator_web_runtime_v2";
```

`app_update_selection_run_status_v3` 保持不授予 Web。R4 SalesHandoff/note/list/get
的新签名使用独立精确 ACL；`app_resolve`、consume/finalize、actor/permission
helper 和 R2 audit helper 均只允许 definer 函数内部调用。

## 12. Owner/Runtime 迁移

| 角色 | 登录 | Owner | R2 写入 | 说明 |
|---|---|---|---|---|
| `elevator_owner` | NO | database/schema/objects | 无直接业务写 | 非登录所有者 |
| `elevator_migration` | 受控迁移身份 | 无运行时 owner | 仅迁移 DDL | 不提供 Web 凭据 |
| `elevator_web_runtime_v2` | YES | NO | 仅 command functions | 不拥有对象 |
| `elevator_worker_runtime_v2` | YES | NO | 无 R2 | 保持文件任务权限 |
| `elevator_sales_definer` | NO | R2 definer 函数/审计 | 受控函数内 | 不可 SET ROLE |
| `elevator_app` | 迁移后 NO | 无 | 无 | 旧 owner 退出 |

代码/连接串不得把 `elevator_owner` 或 `elevator_sales_definer` 给 Web/Worker。
运行时连接必须由部署身份验证并记录 `current_user`、`session_user`、
application_name 和数据库名；不能只根据应用配置声称已经切换。

### Ownership transfer 顺序

```text
inventory
-> create NOLOGIN owner/definer
-> transfer database/schema/table/sequence/function ownership
-> transfer default ACL
-> grant Web only approved command functions
-> revoke old roles/memberships/SET ROLE/CONNECT
-> canary new runtime
-> old role NOLOGIN retained for audit
```

该流程只在隔离 PostgreSQL 演练；真实环境切换需要独立授权和回滚快照。不得通过
对 owner 执行 REVOKE 来声称 owner 已失去权限。

## 13. 实施阶段、验证与回滚

### Phase A：Schema Expand

- 添加第 3 节字段、R2 audit table、索引/FK/CHECK；
- 不启用新写入函数；
- 旧 AuditLog 和文件生命周期保持原样。

### Phase B：Body/Contract

- 编译 R4 body 和 R6 新增 body；
- 实现 expectedVersion contract、Route、前端提示；
- 在隔离库验证 Claim 消费、业务写入、R2 audit 和 finalize 同事务。

### Phase C：Compatibility

- 新函数 EXECUTE 仍撤销；
- 旧 HMAC-only 函数撤权；
- R2 读路径可切换，R2 写路径仍冻结。

### Phase D：Owner/ACL Cutover

- 完成所有权、membership、default ACL、CONNECT、prepared xact/旧 backend 检查；
- 真实切换未授权前保持 BLOCKED；
- 旧 AuditLog 文件路径不受影响。

### Phase E：Controlled Enable

- 先 canary Requirement/Advisor/Selection/R2 audit；
- 再启用 SalesHandoff/note；
- 旧签名 DROP 仅在零调用方和 Catalog 证据后执行；
- 失败停止新写入，不恢复旧 HMAC-only 路径。

### 验证矩阵

| ID | 场景 | 结果要求 |
|---|---|---|
| `R6-CLAIM-01` | 两连接同 Claim | 一成功一 replay |
| `R6-CLAIM-02` | PENDING COMMIT | deferred guard 拒绝 |
| `R6-CLAIM-03` | 业务异常 | Claim/业务/R2 audit 全回滚 |
| `R6-CONTRACT-01` | stale PATCH | 409，无写 |
| `R6-CONTRACT-02` | stale Advisor sequence | 409，无部分消息 |
| `R6-CONTRACT-03` | request same payload | receipt 恢复 |
| `R6-CONTRACT-04` | request different payload | 拒绝 |
| `R6-AUD-01` | R2 success | R2 event 与业务同提交 |
| `R6-AUD-02` | R2 failure | 无 R2 event 或业务 |
| `R6-AUD-03` | file extraction | 原 `public.audit_log` 路径仍工作 |
| `R6-ACL-01` | Web direct protected DML | 42501 |
| `R6-ACL-02` | old function signature | 不存在/不可执行 |
| `R6-ACL-03` | owner/runtime SET ROLE | 拒绝 |
| `R6-CAT-01` | pg_proc/default_acl | owner/proacl/search_path 符合 |

## 14. 未解决事项与 BLOCKED

```text
R4 Schema Expand and exact fields:
  NOT IMPLEMENTED / REQUIRED
R6/ R4 full SQL compile:
  NOT VERIFIED
Claim concurrency and deferred behavior:
  NOT VERIFIED
R2 audit event append-only/truncate:
  NOT VERIFIED
expectedVersion contract/Route/E2E:
  DESIGNED / NOT IMPLEMENTED
old function signatures:
  DROP/ACL NOT EXECUTED
owner/runtime migration:
  DESIGNED / NOT EXECUTED
public.audit_log file lifecycle:
  UNCHANGED / MUST REMAIN UNCHANGED
HMAC Secret custody:
  NOT VERIFIED
prepared transaction Contract:
  NOT EXECUTED
real Contract:
  BLOCKED / NOT AUTHORIZED
```

`public.audit_log` 的统一撤权不属于 R6；只有未来完成全部文件生命周期审计迁移
并获独立审查后才允许讨论。

## 15. Git 状态

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            154
Untracked recursive files:    165
```

新增 R6 前现场为 153 entries / 164 files；本文件是唯一新增项。其他 tracked/
untracked 内容均为既有用户工作，未移动、恢复或清理。

## 16. 静态验证与未执行项

本文件完成后执行：

```text
balanced code fences
0 trailing whitespace
0 conflict markers
git diff --check
```

本轮未执行 Prisma、SQL、PostgreSQL、Migration、E2E、Browser、Build、Provider、
服务启动、角色/ACL 变更或真实 Contract。静态检查结果不能替代数据库编译、
并发测试或运行时验证。

## 17. 报告 SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
d94f2f8538056400684f264c67efa0c1e4cd4382690cd45632df48ff396a3a07

Bytes:                    64559
Physical lines:           1681
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符，
对 UTF-8 文件字节计算 SHA-256。
