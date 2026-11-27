# APP-WORKBENCH-R2 SalesHandoff Invalidation & Snapshot Consistency Design R9

## 0. 状态与目标

```text
DESIGN COMPLETE — READY FOR FINAL INDEPENDENT REVIEW
IMPLEMENTATION NOT STARTED
ISOLATED VALIDATION NOT PERFORMED
REAL CONTRACT NOT AUTHORIZED
```

R9 定点修正 R8 的四个问题：

1. 最终函数签名与 ACL 不一致；
2. `consume_sales_actor_claim_v3` 的 `RETURNING`/`RETURNS TABLE` 列名歧义；
3. confirm requirement 与 create selection run 缺少锁内最新 Requirement 校验；
4. 销售拒绝回执与 replay 回执字段不一致。

R9 保留 R8 的 Advisor start Project 锁内版本递增、list/get DTO 的
`currentSelectionStatus`/`notes`、Claim 唯一消费、Project 锁、R2 Audit Event、
旧 `public.audit_log` 文件生命周期边界和 prepared transaction 门禁。

## 1. 基线与 R8 完整性

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            158
Untracked recursive files:    169
```

R8:

```text
Path:       docs/product/app-workbench-r2-sales-handoff-invalidation-design-r8.md
Bytes:      82701
Lines:      1830
SHA-256:    5c5a3365773255d485e21122efc427f110274f5e2d544e9ce962d0a7261f7dd2
```

R8 SHA 与任务给定值一致，R9 未修改 R8。

## 2. 签名与 ACL 修正

### 2.1 最终正文签名

`follow-up` 的正文参数为 7 个：

```text
app_append_sales_followup_v2(
  p_claim jsonb,
  p_signature bytea,
  p_project_id text,
  p_handoff_id text,
  p_status "public"."SalesHandoffStatus",
  p_contact_status varchar,
  p_note text
)
```

`confirm requirement` 的正文参数为 7 个：

```text
app_confirm_requirement_v3(
  p_claim jsonb,
  p_signature bytea,
  p_project_id text,
  p_object_id text,
  p_requirement_id text,
  p_expected_version integer,
  p_payload_canonical text
)
```

`finish advisor turn` 的正文参数为 13 个：

```text
app_finish_advisor_turn_v3(
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
```

`create selection run` 的正文参数为 9 个：

```text
app_create_selection_run_v3(
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
```

### 2.2 完整 owner、REVOKE、GRANT SQL

```sql
ALTER FUNCTION sales_command.app_append_sales_followup_v2(
  jsonb, bytea, text, text, "public"."SalesHandoffStatus", varchar, text
) OWNER TO "elevator_sales_definer";

ALTER FUNCTION sales_command.app_confirm_requirement_v3(
  jsonb, bytea, text, text, text, integer, text
) OWNER TO "elevator_sales_definer";

ALTER FUNCTION sales_command.app_finish_advisor_turn_v3(
  jsonb, bytea, text, text, text, integer, integer,
  text, text, jsonb, jsonb, jsonb, text
) OWNER TO "elevator_sales_definer";

ALTER FUNCTION sales_command.app_create_selection_run_v3(
  jsonb, bytea, text, text, text, integer, jsonb, jsonb, text
) OWNER TO "elevator_sales_definer";

REVOKE ALL ON FUNCTION
  sales_command.app_append_sales_followup_v2(
    jsonb, bytea, text, text, "public"."SalesHandoffStatus", varchar, text
  ),
  sales_command.app_confirm_requirement_v3(
    jsonb, bytea, text, text, text, integer, text
  ),
  sales_command.app_finish_advisor_turn_v3(
    jsonb, bytea, text, text, text, integer, integer,
    text, text, jsonb, jsonb, jsonb, text
  ),
  sales_command.app_create_selection_run_v3(
    jsonb, bytea, text, text, text, integer, jsonb, jsonb, text
  )
FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

GRANT EXECUTE ON FUNCTION
  sales_command.app_append_sales_followup_v2(
    jsonb, bytea, text, text, "public"."SalesHandoffStatus", varchar, text
  ),
  sales_command.app_confirm_requirement_v3(
    jsonb, bytea, text, text, text, integer, text
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

R2 Audit Trigger helper owner/ACL：

```sql
ALTER FUNCTION sales_security.protect_r2_audit_event_v3()
  OWNER TO "elevator_sales_definer";
REVOKE ALL ON FUNCTION sales_security.protect_r2_audit_event_v3()
  FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";
```

### 2.3 旧重载清理

```sql
DROP FUNCTION IF EXISTS sales_command.app_append_sales_followup_v2(
  jsonb, bytea, text, "public"."SalesHandoffStatus", varchar, text
);
DROP FUNCTION IF EXISTS sales_command.app_get_sales_handoff_context_v2(
  jsonb, bytea, text
);
```

旧签名在零调用方、无 prepared transaction、旧 backend 排空后执行。最终 Web
可执行清单必须通过 `pg_proc` 精确签名和 `has_function_privilege` 验证。

## 3. Claim 消费歧义修正

R8 的 consume 插入语句替换为：

```sql
INSERT INTO sales_security.actor_claim_consumption AS c (
  claim_hash,
  key_id,
  actor_user_id,
  auth_session_id,
  operation,
  project_id,
  object_id,
  request_id,
  nonce,
  payload_digest,
  issued_at,
  expires_at
)
VALUES (
  v_hash,
  v_key_id,
  v_actor,
  p_claim->>'authSessionId',
  v_operation,
  v_project,
  v_object,
  v_request,
  v_nonce,
  v_digest,
  to_timestamp(v_issued),
  to_timestamp(v_expires)
)
ON CONFLICT DO NOTHING
RETURNING c.claim_hash INTO v_inserted;
```

R8 其余 consume body 保持不变。`RETURNING c.claim_hash` 将目标表列显式限定；
不改变默认 `plpgsql.variable_conflict`，不使用 `use_column` 或关闭 ambiguity 检查。
其他 INSERT 的 `RETURNING` 必须使用不同的局部变量名或目标表别名。

## 4. 最新 Requirement 校验

### 4.1 confirm requirement

在 `app_confirm_requirement_v3` 的 Project `FOR UPDATE` 之后，用以下 SQL 替换
原先仅按 requirementId 的查询：

```sql
SELECT br.*
INTO v_current
FROM public."building_requirement" AS br
WHERE br."projectId" = p_project_id
ORDER BY br.version DESC, br.id DESC
LIMIT 1
FOR UPDATE;

IF NOT FOUND
   OR v_current.id IS DISTINCT FROM p_requirement_id
   OR v_current.version IS DISTINCT FROM p_expected_version
   OR v_current.status = 'CUSTOMER_CONFIRMED'
   OR v_current."missingFields" <> '[]'::jsonb THEN
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash,
    'REJECTED',
    'REQUIREMENT_CONFIRM',
    NULL,
    jsonb_build_object(
      'outcome', 'VERSION_CONFLICT',
      'requirementId', p_requirement_id,
      'version', p_expected_version,
      'replayed', false
    )
  );
  RETURN QUERY SELECT 'VERSION_CONFLICT', p_requirement_id,
    p_expected_version, false;
  RETURN;
END IF;
```

该路径拒绝旧草稿、旧已确认需求和锁等待期间被新需求替换的请求，不写
Requirement/Revision，不写 R2 Audit Event，只写 REJECTED receipt。

### 4.2 create selection run

在 `app_create_selection_run_v3` 的 Project `FOR UPDATE` 之后，使用：

```sql
SELECT br.*
INTO v_current
FROM public."building_requirement" AS br
WHERE br."projectId" = p_project_id
ORDER BY br.version DESC, br.id DESC
LIMIT 1
FOR UPDATE;

IF NOT FOUND
   OR v_current.id IS DISTINCT FROM p_requirement_id
   OR v_current.version IS DISTINCT FROM p_expected_version
   OR v_current.status <> 'CUSTOMER_CONFIRMED' THEN
  PERFORM sales_security.finalize_sales_actor_claim_v3(
    v_claim.claim_hash,
    'REJECTED',
    'SELECTION_CREATE',
    NULL,
    jsonb_build_object(
      'outcome', 'VERSION_CONFLICT',
      'requirementId', p_requirement_id,
      'version', p_expected_version,
      'replayed', false
    )
  );
  RETURN QUERY SELECT 'VERSION_CONFLICT', p_requirement_id,
    p_expected_version, false;
  RETURN;
END IF;
```

只有这个检查通过后，才允许写 SelectionRun/Recommendation 和 R2 audit event。
旧 Requirement 及其旧 run 不得支撑当前方案。

## 5. 拒绝回执统一

### 5.1 Receipt shape

首次拒绝和 receipt replay 必须保留业务字段；只允许 `replayed` 从 `false` 变
`true`。读命令 replay 仍返回 `READ_REPLAY_REQUIRES_NEW_CLAIM`，不返回旧 DTO。

| 函数 | outcome | 首次/receipt 业务字段 |
|---|---|---|
| create handoff | `CLOSED` | `handoffId`, `contextState='CLOSED'` |
| create handoff | `CONTEXT_EXISTS` | `handoffId`, `contextState='ACTIONABLE'` |
| create handoff | `CONTEXT_UNAVAILABLE` | `handoffId=NULL`, `contextState=resolver.outcome` |
| append note | `CLOSED` | `noteId=NULL`, `statusAfter='CLOSED'` |
| append note | `LEGACY_UNBOUND` | `noteId=NULL`, `statusAfter=NULL` |
| append note | `CONTEXT_STALE` | `noteId=NULL`, `statusAfter=NULL` |
| append note | `IDEMPOTENCY_KEY_REUSED` | `noteId=existing.id`, `statusAfter=NULL` |
| all write functions | `FORBIDDEN` | function-specific null fields; no business/audit |

### 5.2 Finalize payload rules

每个 `finalize_sales_actor_claim_v3` 调用都必须使用同一个完整 response object。
例如 create 的 CLOSED：

```sql
jsonb_build_object(
  'outcome', 'CLOSED',
  'handoffId', v_existing.id,
  'contextState', 'CLOSED',
  'replayed', false
)
```

append 的 IDEMPOTENCY_KEY_REUSED：

```sql
jsonb_build_object(
  'outcome', 'IDEMPOTENCY_KEY_REUSED',
  'noteId', v_existing.id,
  'statusAfter', NULL,
  'replayed', false
)
```

CREATE 的 CONTEXT_UNAVAILABLE：

```sql
jsonb_build_object(
  'outcome', 'CONTEXT_UNAVAILABLE',
  'handoffId', NULL,
  'contextState', v_resolution.outcome,
  'replayed', false
)
```

所有 replay 分支从 receipt 读取完整 business fields 后，仅将 `replayed` 覆盖为
`true`；不得把首次返回的非空 ID/status 变成 NULL。

## 6. 执行顺序与验收

```text
1. R4 Schema Expand / claim/R2 immutable objects
2. create/fix PostgreSQL functions
3. exact owner + REVOKE/GRANT
4. Revoke old signatures and verify zero callers
5. compile and Catalog check
6. enable read paths
7. enable write canaries
8. Drop old signatures only after drain
```

验收 SQL 必须使用 `to_regprocedure` 精确检查 7/7/13/9 参数签名；
`has_function_privilege` 检查 Web 只能执行最终函数，`pg_proc` 检查 owner/
prosecdef/proconfig/proacl。旧签名仍存在、PUBLIC EXECUTE 或错误 ACL 时 BLOCKED。

## 7. 回归与错误矩阵

| ID | 场景 | 期望 |
|---|---|---|
| R9-ACL-01 | Web 授权 follow-up 7 参数 | 可执行；旧 6 参数拒绝 |
| R9-ACL-02 | Web 授权 confirm 7 参数 | 可执行；registry/ACL 一致 |
| R9-ACL-03 | Web 授权 finish 13 参数 | 可执行；无默认参数 |
| R9-ACL-04 | Web 授权 selection 9 参数 | 可执行；无旧签名 |
| R9-CLAIM-01 | 两连接同 Claim | 一成功一 replay |
| R9-CLAIM-02 | INSERT 别名 | `c.claim_hash` 无 ambiguity |
| R9-REQ-01 | 旧 requirement confirm | VERSION_CONFLICT，无 Requirement/Revision |
| R9-RUN-01 | 旧 requirement selection | VERSION_CONFLICT，无 run/recommendation |
| R9-RECEIPT-01 | CLOSED first/replay | 业务字段一致，仅 replayed 变化 |
| R9-RECEIPT-02 | CONTEXT_EXISTS first/replay | handoffId/contextState 一致 |
| R9-RECEIPT-03 | CONTEXT_UNAVAILABLE first/replay | contextState 一致 |
| R9-RECEIPT-04 | LEGACY_UNBOUND first/replay | noteId/statusAfter 一致 |
| R9-RECEIPT-05 | CONTEXT_STALE first/replay | noteId/statusAfter 一致 |
| R9-RECEIPT-06 | IDEMPOTENCY_KEY_REUSED first/replay | noteId 一致 |

## 8. 未验证与阻塞

```text
R8/R9 SQL compile:             NOT EXECUTED
PostgreSQL Catalog/ACL:        NOT EXECUTED
two-connection concurrency:    NOT EXECUTED
deferred trigger behavior:     NOT EXECUTED
rejection/replay runtime:      NOT EXECUTED
R4 Schema Expand:              NOT IMPLEMENTED
Owner/Runtime transfer:        NOT EXECUTED
prepared transaction Contract: BLOCKED
real Contract:                 BLOCKED / NOT AUTHORIZED
E2E/Browser/Build:             NOT EXECUTED
```

R9 是设计文档，不能把这些状态写成 PASS。真实 Contract 仍需独立授权。

## 9. Git 与静态检查

开始时：

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            158
Untracked recursive files:    169
```

静态检查：

```text
R9 code fences: balanced
R9 trailing whitespace: 0
R9 conflict markers: 0
R9 undefined items: 0
git diff --check: exit 0，仅有既有 tracked 文件 LF/CRLF warnings
```

新增 R9 后的现场：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            159
Untracked recursive files:    170
```

## 10. 报告 SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
c29cb86d076a5d45fb58be2b8cb3837ccda437290835f16ef22119585fe7bc30

Bytes:                    13508
Physical lines:           465
```
