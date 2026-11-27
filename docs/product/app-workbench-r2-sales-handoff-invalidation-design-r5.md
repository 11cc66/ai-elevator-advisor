# APP-WORKBENCH-R2 SalesHandoff Invalidation & Snapshot Consistency Design R5

## 0. 状态

```text
DESIGN COMPLETE — IMPLEMENTATION NOT STARTED
ISOLATED VALIDATION NOT PERFORMED
REAL CONTRACT NOT AUTHORIZED
```

本报告依据 R4 独立审查的两个 P1 做定点修正：

1. Actor Claim 增加数据库级一次性消费和 operation receipt；
2. 撤销 Web Runtime 对受保护业务表的直接写权限，所有写入口改为受控函数。

R4 中已通过审查的 Project 锁、精确 binding、LEGACY_UNBOUND、CLOSED、
prepared transaction、resolver 时间精度、orphan precheck、note 幂等和稳定分页
设计保持不变。

| 项目 | 当前结论 | 证据边界 |
|---|---|---|
| Claim 数据库级一次性消费 | DESIGNED | 未执行 SQL；唯一约束/Trigger/事务行为均 NOT VERIFIED |
| Claim 与业务写入同事务 | DESIGNED | 未执行 PostgreSQL；COMMIT/回滚行为 NOT VERIFIED |
| 响应丢失恢复 | DESIGNED | receipt schema 与流程已定义；运行时 NOT VERIFIED |
| Web 撤销受保护表直接写 | DESIGNED | SQL/ACL 未执行；真实角色 Catalog NOT VERIFIED |
| 所有受保护写入口映射 | DESIGNED | 新函数 body 尚待实施并经独立审查 |
| 真实 Contract / 生产安全 | BLOCKED | 未授权、无真实角色/old writer/prepared xact 证据 |

## 1. R4 → R5 修正对照

| R4 问题 | R5 修正 |
|---|---|
| Claim nonce 仅签名，没有消费记录 | 新增 `actor_claim_consumption` 唯一消费表 |
| 同 Claim 可跨连接/事务重放 | `claim_hash` 主键原子占用；deferred commit guard |
| 响应丢失无法安全返回原结果 | 同事务写 `receipt_type/receipt_id/response_payload` |
| Web 可绕过销售函数直接写 Requirement/Advisor/Selection | 撤销所有受保护表直接 DML，新增受控 write functions |
| 写入入口映射不完整 | 逐入口映射到 begin/command/claim/finalize |

## 2. Git 与输入基线

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            151
Untracked recursive files:    162
```

任务下达时声明的现场为 150 entries / 161 recursive files；上一执行段在创建 R5 前
现场读取为 151 / 162。两者相差的 1 项未被清理、读取内容或重命名，来源无法仅靠
Git 状态判定，作为既有用户工作保护。

R4：

```text
Whole-file SHA-256:
630744cbfe92dd52a346779a3899bee37bd6e5e824a344fd9c018046a2daf75a
```

R4 独立审查：

```text
Whole-file SHA-256:
e2851cccbfd981e59fba4a9f7f31fdc291b9afe3feaf4896e88d6c88ec54ad59
```

### 2.1 本轮实际读取范围

- R4 设计、R4 独立审查及前置 R1–R3 修复/审查报告；
- `prisma/schema.prisma` 中 Project、Requirement、Advisor、Selection、SalesHandoff、
  SalesFollowUpNote、AuditLog 模型；
- Requirement PATCH/confirm、Advisor start/message、Selection create、
  SalesHandoff create/note/list 的 Route、service 和 current raw SQL 调用路径；
- `apps/web/src/modules/audit/log.ts`、Web/Worker audit call sites；
- D03、D04、D05、D08、D09、D11、P2、P30、P37、FZ、ST、DBTP 的适用安全边界。

本轮未连接 PostgreSQL，未运行 Prisma、SQL、E2E、Browser、Build、Provider 或服务，
也未读取 `.env`/`.env.test`、密钥或连接串。

## 3. R5 Claim 消费数据模型

helper 名称中的 `v3` 是 R5 私有 ABI 名称，不表示 Claim JSON `version=3`。R5 继续
使用 R4 的 version 2 Claim HMAC，避免改变已审查的签名 envelope。

### 3.1 Claim 顶层字段

R5 Claim 在 R4 字段上增加明确的 project/object 绑定：

```json
{
  "version": 2,
  "keyId": "...",
  "actorUserId": "...",
  "authSessionId": "...",
  "requestId": "...",
  "operation": "REQUIREMENT_PATCH",
  "projectId": "...",
  "objectId": "...",
  "issuedAtEpoch": 1790000000,
  "expiresAtEpoch": 1790000060,
  "nonce": "...",
  "payloadDigest": "<64 lowercase hex>"
}
```

跨 Project 的 `SALES_LIST` 使用 `projectId=NULL`、`objectId='SALES_LIST'`；数据库
逐行执行 SALES_MANAGE/project filter。其他操作必须提供非空 projectId。

### 3.2 签名

继续使用 R4 的 HMAC 密钥和 version 2 canonical claim：

```text
v2|<keyId>|<actorUserId>|<authSessionId>|<requestId>|<operation>|
<issuedAtEpoch>|<expiresAtEpoch>|<nonce>|<payloadDigest>
```

payloadDigest 仍为：

```text
sha256(UTF8(length-prefixed canonical payload))
```

project/object 也由业务函数重建到 canonical payload；因此 Claim 和
payloadDigest 不能把一个 Project/对象改成另一个。

安全解释必须明确：版本 2 的 HMAC canonical 仍未直接包含顶层 `projectId/objectId`；
顶层字段只是 Claim 消费键和 route scope 提示，**不得作为业务写目标**。业务函数必须
使用已签名 canonical payload 中的 project/object 作为权威 scope，并在锁后从数据库
实体再次核对归属。任何仅把 `p_claim->>'projectId'` 当作目标 Project 的实现均视为
设计失败。对于只有对象 ID 的 `SALES_GET_CONTEXT` / `SALES_FOLLOW_UP_NOTE`，
函数必须在 Project 锁后读取 handoff 的 `projectId` 并与 signed payload scope
严格相等；不一致返回 `CONTEXT_CONFLICT`，不得写。

每个 operation 的 canonical payload 必须使用 R4 的
`canonical_field_v2()`（UTF-8 byte length prefix）按固定字段顺序构造，统一以
`operation`、`projectId`（`SALES_LIST` 除外）和 `objectId` 开始，并至少包含：

| operation | canonical payload 必含字段 |
|---|---|
| `REQUIREMENT_PATCH` | projectId, expectedVersion, conversationId, installationScenario, finalFields, finalMissingFields, source |
| `REQUIREMENT_CONFIRM` | projectId, requirementId, expectedVersion |
| `ADVISOR_START` | projectId, installationScenario, initialFields, initialMissingFields, initialAssistantMessage |
| `ADVISOR_TURN` | projectId, conversationId, expectedVersion, userMessage, assistantMessage, finalFields, finalMissingFields, providerSnapshot |
| `SELECTION_CREATE` | projectId, requirementId, expectedVersion, inputSnapshot, result |
| `SELECTION_STATUS_UPDATE` | projectId, selectionRunId, expectedStatus, nextStatus |
| `SALES_HANDOFF_CREATE` | projectId, summary, budgetConcern |
| `SALES_FOLLOW_UP_NOTE` | projectId, handoffId, status, contactStatus, note |
| `SALES_LIST` | search, offset, pageSize |
| `SALES_GET_CONTEXT` | projectId, handoffId |
| `DOMAIN_AUDIT_APPEND` | projectId, action, objectType, objectId, oldValue, newValue, reason |
| `DOMAIN_AUDIT_APPEND_GLOBAL` | objectId='GLOBAL', action, objectType, businessObjectId, oldValue, newValue, reason |

Claim 顶层 `objectId` 固定映射如下；若对象尚未创建，使用明确的稳定哨兵并在 payload
中同时携带实际业务对象：

| operation | 顶层 objectId |
|---|---|
| `REQUIREMENT_PATCH` | 当前目标 requirementId；项目尚无需求时为 `PROJECT` |
| `REQUIREMENT_CONFIRM` | requirementId |
| `ADVISOR_START` | `PROJECT` |
| `ADVISOR_TURN` | conversationId |
| `SELECTION_CREATE` | requirementId |
| `SELECTION_STATUS_UPDATE` | selectionRunId |
| `SALES_HANDOFF_CREATE` | `PROJECT` |
| `SALES_FOLLOW_UP_NOTE` / `SALES_GET_CONTEXT` | handoffId |
| `SALES_LIST` | `SALES_LIST` |
| `DOMAIN_AUDIT_APPEND` / `DOMAIN_AUDIT_APPEND_GLOBAL` | 审计对象 ID / `GLOBAL` |

这些顶层值仍不能替代 canonical payload 和锁后实体归属校验。

JSON object 字段必须先经过一个确定性 serializer（固定 key order、无多余空白），
禁止直接把客户端原始 JSON 文本作为 canonical payload。数据库按收到的完整 canonical
text 重新计算 SHA-256；canonical text 上限为 256 KiB，禁止 NUL。若函数只验 HMAC
而不校验 payload digest，视为设计失败。

唯一签发组件是 Web 服务端的 server-only Claim signer module；它只能从已由
Better Auth 验证的 Session 构造 claim。浏览器、客户 UI、Worker、Migration、
Owner 和普通管理员页面脚本不得持有签名 secret，也不得直接构造 claim。
客户端只提交业务字段和 Idempotency-Key。

这里必须区分两个不同主体：

- Web 应用的 signer module 可以通过 workload identity 从 Secret Manager 获取
  **签名能力**，但不得读取数据库 `actor_hmac_key.secret`，也不得把签名 secret
  暴露给 Route Handler 调用方、Server Component props、RSC payload 或日志；
- `elevator_web_runtime_v2` 数据库角色没有 key 表 SELECT、函数修改或 Claim
  terminal-state 写入权限。

若 Web 应用进程或 Secret Manager workload 被完全攻陷，持有签名能力的攻击者仍可
伪造新 Claim；一次性消费只能消除重放和并发双执行，不能声称抵御已控制 signer 的
攻击者。该残余风险必须在实施审查中明确接受或通过独立签名服务收紧。

Key 轮换规则：

- old Claim 只在其 key 未撤销/未过期且 Claim 自身未过期时验证；
- 已消费 claim receipt 不因 key 轮换被删除；
- 同一个 requestId 由新 key 生成的新 Claim 可在 receipt 保留期内返回旧结果；
- key 缺失、撤销或无法解析时 fail closed，不进入业务函数；
- 签名 secret 的 Secret Manager/DBA custody 仍是实施前置验证，不是本报告已证明事实。

### 3.3 consumption table

```sql
CREATE TABLE sales_security.actor_claim_consumption (
  claim_hash          bytea PRIMARY KEY,
  key_id              varchar(64) NOT NULL,
  actor_user_id       text NOT NULL,
  auth_session_id     text NOT NULL,
  operation           varchar(64) NOT NULL,
  project_id          text,
  object_id           text,
  request_id          varchar(100) NOT NULL,
  nonce               varchar(128) NOT NULL,
  payload_digest      char(64) NOT NULL,
  issued_at           timestamptz NOT NULL,
  expires_at          timestamptz NOT NULL,
  consumed_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
  transaction_id      xid8 NOT NULL DEFAULT pg_current_xact_id(),
  state               varchar(16) NOT NULL DEFAULT 'PENDING',
  receipt_type        varchar(64),
  receipt_id          text,
  response_payload    jsonb,
  completed_at        timestamptz,

  CONSTRAINT actor_claim_consumption_time_check
    CHECK (
      expires_at > issued_at
      AND consumed_at < expires_at
      AND (completed_at IS NULL OR completed_at >= consumed_at)
    ),
  CONSTRAINT actor_claim_consumption_state_check
    CHECK (
      (
        state = 'PENDING'
        AND completed_at IS NULL
        AND receipt_type IS NULL
        AND receipt_id IS NULL
        AND response_payload IS NULL
      )
      OR
      (
        state IN ('COMPLETED', 'REJECTED')
        AND completed_at IS NOT NULL
        AND receipt_type IS NOT NULL
        AND response_payload IS NOT NULL
        AND jsonb_typeof(response_payload) = 'object'
      )
    ),
  CONSTRAINT actor_claim_consumption_digest_check
    CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT actor_claim_consumption_operation_check
    CHECK (
      operation IN (
        'REQUIREMENT_PATCH',
        'REQUIREMENT_CONFIRM',
        'ADVISOR_START',
        'ADVISOR_TURN',
        'SELECTION_CREATE',
        'SELECTION_STATUS_UPDATE',
        'SALES_HANDOFF_CREATE',
        'SALES_FOLLOW_UP_NOTE',
        'SALES_LIST',
        'SALES_GET_CONTEXT',
        'DOMAIN_AUDIT_APPEND',
        'DOMAIN_AUDIT_APPEND_GLOBAL'
      )
    ),
  CONSTRAINT actor_claim_consumption_scope_check
    CHECK (
      (
        operation = 'SALES_LIST'
        AND project_id IS NULL
        AND object_id = 'SALES_LIST'
      )
      OR
      (
        operation = 'DOMAIN_AUDIT_APPEND_GLOBAL'
        AND project_id IS NULL
        AND object_id = 'GLOBAL'
      )
      OR
      (
        operation NOT IN ('SALES_LIST', 'DOMAIN_AUDIT_APPEND_GLOBAL')
        AND project_id IS NOT NULL
        AND object_id IS NOT NULL
      )
    ),
  CONSTRAINT actor_claim_consumption_identity_format_check
    CHECK (
      key_id ~ '^[A-Za-z0-9_-]{1,64}$'
      AND actor_user_id ~ '^[A-Za-z0-9_-]{1,128}$'
      AND auth_session_id ~ '^[A-Za-z0-9_-]{1,256}$'
      AND request_id ~ '^[A-Za-z0-9_-]{16,100}$'
      AND nonce ~ '^[A-Za-z0-9_-]{16,128}$'
      AND (
        project_id IS NULL
        OR project_id ~ '^[A-Za-z0-9_-]{1,128}$'
      )
      AND (
        object_id IS NULL
        OR object_id ~ '^[A-Za-z0-9_-]{1,128}$'
      )
    ),
  CONSTRAINT actor_claim_consumption_response_size_check
    CHECK (
      response_payload IS NULL
      OR (
        octet_length(response_payload::text) <= 32768
        AND NOT (
          response_payload ?|
          ARRAY['summary', 'budgetConcern', 'note', 'notes', 'internalBudget']::text[]
        )
      )
    ),
  CONSTRAINT actor_claim_consumption_key_fkey
    FOREIGN KEY (key_id)
    REFERENCES sales_security.actor_hmac_key (key_id)
    ON DELETE RESTRICT,
  CONSTRAINT actor_claim_consumption_actor_fkey
    FOREIGN KEY (actor_user_id)
    REFERENCES public."user" (id)
    ON DELETE RESTRICT,
  CONSTRAINT actor_claim_consumption_project_fkey
    FOREIGN KEY (project_id)
    REFERENCES public."project" (id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX actor_claim_consumption_request_key
  ON sales_security.actor_claim_consumption (actor_user_id, request_id);

CREATE UNIQUE INDEX actor_claim_consumption_nonce_key
  ON sales_security.actor_claim_consumption (actor_user_id, nonce);

CREATE UNIQUE INDEX actor_claim_consumption_transaction_key
  ON sales_security.actor_claim_consumption (transaction_id);

CREATE INDEX actor_claim_consumption_expiry_idx
  ON sales_security.actor_claim_consumption (state, expires_at);

CREATE INDEX actor_claim_consumption_project_state_idx
  ON sales_security.actor_claim_consumption (project_id, state, expires_at);

ALTER TABLE sales_security.actor_claim_consumption
  OWNER TO "elevator_sales_definer";
ALTER TABLE sales_security.actor_hmac_key
  OWNER TO "elevator_sales_definer";
REVOKE ALL ON TABLE sales_security.actor_claim_consumption
  FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";
```

不存储明文 HMAC secret 于 Claim；secret 只在私有 key 表中。

### 3.4 保留期限

- Claim 记录从 `expires_at` 起至少保留 7 天，覆盖最大重试窗口；
- PENDING 永远不得被清理；
- COMPLETED/REJECTED 只能在 expiry+7d 后由独立 maintenance role 清理；
- `response_payload` 只允许 ID/outcome/版本/digest/count 等非业务正文，不保存销售
  DTO、摘要、内部预算或 note；仍只有 definer 函数可读；
- 本轮不实现清理函数，实际运行前必须单独批准；在此之前 DELETE Trigger 保持
  全部拒绝，记录只增不减；
- 7 天窗口后的业务幂等仍由 handoff exact unique、note requestKey 和其他业务
  receipt 唯一约束负责，不能把旧 response 当成永久审计记录。

## 4. 原子 Claim 消费协议

### 4.1 唯一事务顺序

```text
BEGIN READ COMMITTED
验证 Claim HMAC / Session / TTL / operation / project / object / payload
INSERT actor_claim_consumption (state=PENDING)
Project FOR UPDATE
执行业务校验和写入
UPDATE actor_claim_consumption SET state=COMPLETED/REJECTED,
  receipt_type/receipt_id/response_payload/completed_at
COMMIT
```

全局锁顺序：

```text
Claim unique row
-> Project
-> AdvisorConversation
-> BuildingRequirement / SelectionRun
-> SalesHandoff
-> SalesFollowUpNote
-> AuditLog
```

Claim 唯一占用必须先于 Project 锁，且所有业务写函数遵守同一顺序。
一个数据库事务最多消费一个 Claim；业务函数不得在已经持有 Claim 的事务中调用
第二个受保护写函数。

### 4.2 共同提交/回滚

- Claim INSERT、Project lock、业务写入、AuditLog 和 receipt 必须在同一事务；
- 任一异常 rollback 全部 Claim/业务/receipt；
- 不允许多个连接在各自事务中分别 claim 和 write；
- 不允许先 SELECT 未消费，再在应用层决定；
- 唯一 INSERT 是消费竞争的唯一仲裁。

每个业务事务使用短 `lock_timeout`（建议 2 秒）和小于请求 deadline 的
`statement_timeout`；超时按基础设施/并发错误回滚，不把 PENDING Claim 留在
已提交状态。40001、40P01、P2034 只做有界重试，重试时重新验证 Claim、权限和
Project 当前状态；重试耗尽返回稳定 409/503，不返回伪成功。

数据库事务和可重试闭包内不得执行外部 HTTP、AI Provider、消息、队列、文件系统
或通知副作用。Provider 调用必须在 Claim 消费和受控写事务之外完成；其输出只有在
重新校验当前 Session、权限、expectedVersion 并成功消费 Claim 后才能持久化。

### 4.3 PENDING 不可提交

新增 deferred constraint trigger：

```sql
CREATE OR REPLACE FUNCTION sales_security.assert_claim_terminal_v3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_state text;
BEGIN
  SELECT c.state
  INTO v_state
  FROM sales_security.actor_claim_consumption AS c
  WHERE c.claim_hash = NEW.claim_hash;

  IF v_state = 'PENDING' THEN
    RAISE EXCEPTION 'claim consumption must be finalized before commit'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$fn$;

CREATE CONSTRAINT TRIGGER actor_claim_consumption_terminal_guard
AFTER INSERT OR UPDATE ON sales_security.actor_claim_consumption
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION sales_security.assert_claim_terminal_v3();

CREATE OR REPLACE FUNCTION sales_security.protect_claim_consumption_v3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'claim consumption deletion is disabled until a separately approved maintenance path exists'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.state <> 'PENDING'
     OR NEW.state NOT IN ('COMPLETED', 'REJECTED')
     OR OLD.transaction_id IS DISTINCT FROM pg_current_xact_id()
     OR NEW.claim_hash IS DISTINCT FROM OLD.claim_hash
     OR NEW.key_id IS DISTINCT FROM OLD.key_id
     OR NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id
     OR NEW.auth_session_id IS DISTINCT FROM OLD.auth_session_id
     OR NEW.operation IS DISTINCT FROM OLD.operation
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.object_id IS DISTINCT FROM OLD.object_id
     OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.nonce IS DISTINCT FROM OLD.nonce
     OR NEW.payload_digest IS DISTINCT FROM OLD.payload_digest
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.consumed_at IS DISTINCT FROM OLD.consumed_at
     OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id THEN
    RAISE EXCEPTION 'invalid claim consumption transition'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION sales_security.guard_claim_consumption_insert_v3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
BEGIN
  IF NEW.state IS DISTINCT FROM 'PENDING'
     OR NEW.transaction_id IS DISTINCT FROM pg_current_xact_id()
     OR NEW.completed_at IS NOT NULL
     OR NEW.receipt_type IS NOT NULL
     OR NEW.receipt_id IS NOT NULL
     OR NEW.response_payload IS NOT NULL THEN
    RAISE EXCEPTION 'claim consumption must start as PENDING in the current transaction'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER actor_claim_consumption_insert_guard
BEFORE INSERT ON sales_security.actor_claim_consumption
FOR EACH ROW
EXECUTE FUNCTION sales_security.guard_claim_consumption_insert_v3();

CREATE TRIGGER actor_claim_consumption_transition_guard
BEFORE UPDATE OR DELETE ON sales_security.actor_claim_consumption
FOR EACH ROW
EXECUTE FUNCTION sales_security.protect_claim_consumption_v3();

ALTER FUNCTION sales_security.assert_claim_terminal_v3()
  OWNER TO "elevator_sales_definer";
REVOKE ALL ON FUNCTION sales_security.assert_claim_terminal_v3()
  FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

ALTER FUNCTION sales_security.protect_claim_consumption_v3()
  OWNER TO "elevator_sales_definer";
REVOKE ALL ON FUNCTION sales_security.protect_claim_consumption_v3()
  FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

ALTER FUNCTION sales_security.guard_claim_consumption_insert_v3()
  OWNER TO "elevator_sales_definer";
REVOKE ALL ON FUNCTION sales_security.guard_claim_consumption_insert_v3()
  FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";
```

`actor_claim_consumption` 只允许当前事务插入 PENDING，并且只允许同一事务
PENDING→terminal；UPDATE/DELETE 由专门 Trigger 拒绝。维护清理未授权且尚无绕过
Trigger 的路径。拥有表、Trigger 或超级用户能力的 DBA 仍属于高权限威胁模型，
不能宣称可阻止恶意超级用户。

## 5. Claim consume/finalize Helper 完整定义

### 5.1 consume

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
  outcome text,
  claim_hash bytea,
  actor_user_id text,
  request_id text,
  receipt_type text,
  receipt_id text,
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
  v_payload_digest text := lower(coalesce(p_claim->>'payloadDigest', ''));
  v_issued bigint;
  v_expires bigint;
  v_claim_hash_basis text;
  v_claim_hash bytea;
  v_inserted_hash bytea;
  v_existing sales_security.actor_claim_consumption%ROWTYPE;
  v_actor_check text;
BEGIN
  IF p_claim->>'version' IS DISTINCT FROM '2'
     OR p_expected_operation IS NULL
     OR p_payload_canonical IS NULL
     OR octet_length(p_payload_canonical) > 262144
     OR v_project IS DISTINCT FROM p_expected_project_id
     OR v_object IS DISTINCT FROM p_expected_object_id THEN
    RETURN QUERY SELECT
      'INVALID_CLAIM_SCOPE',
      NULL::bytea, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;

  IF v_key_id IS NULL
     OR v_key_id !~ '^[A-Za-z0-9_-]{1,64}$'
     OR v_operation IS DISTINCT FROM p_expected_operation
     OR (
       p_expected_operation = 'SALES_LIST'
       AND (v_project IS NOT NULL OR v_object IS DISTINCT FROM 'SALES_LIST')
     )
     OR (
       p_expected_operation = 'DOMAIN_AUDIT_APPEND_GLOBAL'
       AND (v_project IS NOT NULL OR v_object IS DISTINCT FROM 'GLOBAL')
     )
     OR (
       p_expected_operation NOT IN ('SALES_LIST', 'DOMAIN_AUDIT_APPEND_GLOBAL')
       AND (
         v_project IS NULL
         OR v_project !~ '^[A-Za-z0-9_-]{1,128}$'
         OR v_object IS NULL
         OR v_object !~ '^[A-Za-z0-9_-]{1,128}$'
       )
     ) THEN
    RETURN QUERY SELECT
      'INVALID_CLAIM_SCOPE',
      NULL::bytea, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;

  v_actor_check := sales_security.assert_sales_actor_v2(
    p_claim,
    p_signature,
    p_expected_operation,
    p_payload_canonical
  );
  IF v_actor_check IS DISTINCT FROM 'OK' THEN
    RETURN QUERY SELECT
      'INVALID_CLAIM',
      NULL::bytea, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;

  IF v_actor IS NULL
     OR v_request IS NULL
     OR v_nonce IS NULL
     OR v_payload_digest !~ '^[0-9a-f]{64}$'
     OR p_claim->>'issuedAtEpoch' IS NULL
     OR p_claim->>'expiresAtEpoch' IS NULL THEN
    RETURN QUERY SELECT
      'INVALID_CLAIM',
      NULL::bytea, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;

  BEGIN
    v_issued := (p_claim->>'issuedAtEpoch')::bigint;
    v_expires := (p_claim->>'expiresAtEpoch')::bigint;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN QUERY SELECT
      'INVALID_CLAIM',
      NULL::bytea, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END;

  v_claim_hash_basis := concat_ws(
    '|',
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
    sales_security.canonical_field_v2(v_payload_digest)
  );
  v_claim_hash := sales_security.digest(
    convert_to(v_claim_hash_basis, 'UTF8'),
    'sha256'
  );

  INSERT INTO sales_security.actor_claim_consumption (
    claim_hash, key_id, actor_user_id, auth_session_id, operation,
    project_id, object_id, request_id, nonce, payload_digest,
    issued_at, expires_at
  )
  VALUES (
    v_claim_hash,
    v_key_id,
    v_actor,
    p_claim->>'authSessionId',
    v_operation,
    v_project,
    v_object,
    v_request,
    v_nonce,
    v_payload_digest,
    to_timestamp(v_issued),
    to_timestamp(v_expires)
  )
  ON CONFLICT DO NOTHING
  RETURNING claim_hash INTO v_inserted_hash;

  IF v_inserted_hash IS NOT NULL THEN
    RETURN QUERY SELECT
      'CONSUMED',
      v_claim_hash,
      v_actor,
      v_request,
      NULL::text,
      NULL::text,
      NULL::jsonb;
    RETURN;
  END IF;

  SELECT *
  INTO v_existing
  FROM sales_security.actor_claim_consumption AS c
  WHERE c.claim_hash = v_claim_hash;

  IF FOUND THEN
    IF v_existing.state = 'PENDING'
       AND v_existing.transaction_id = pg_current_xact_id() THEN
      RETURN QUERY SELECT
        'CLAIM_ALREADY_IN_TRANSACTION',
        v_claim_hash,
        v_existing.actor_user_id,
        v_existing.request_id,
        NULL::text,
        NULL::text,
        NULL::jsonb;
      RETURN;
    END IF;

    IF v_existing.state IN ('COMPLETED', 'REJECTED')
       AND v_existing.actor_user_id IS NOT DISTINCT FROM v_actor
       AND v_existing.operation IS NOT DISTINCT FROM v_operation
       AND v_existing.project_id IS NOT DISTINCT FROM v_project
       AND v_existing.object_id IS NOT DISTINCT FROM v_object
       AND v_existing.payload_digest IS NOT DISTINCT FROM v_payload_digest THEN
      RETURN QUERY SELECT
        'REPLAY',
        v_existing.claim_hash,
        v_existing.actor_user_id,
        v_existing.request_id,
        v_existing.receipt_type,
        v_existing.receipt_id,
        v_existing.response_payload;
      RETURN;
    END IF;

    RETURN QUERY SELECT
      'CLAIM_CONFLICT',
      v_existing.claim_hash,
      v_existing.actor_user_id,
      v_existing.request_id,
      NULL::text,
      NULL::text,
      NULL::jsonb;
    RETURN;
  END IF;

  SELECT *
  INTO v_existing
  FROM sales_security.actor_claim_consumption AS c
  WHERE c.actor_user_id = v_actor
    AND c.request_id = v_request;

  IF FOUND THEN
    IF v_existing.operation IS NOT DISTINCT FROM v_operation
       AND v_existing.project_id IS NOT DISTINCT FROM v_project
       AND v_existing.object_id IS NOT DISTINCT FROM v_object
       AND v_existing.payload_digest IS NOT DISTINCT FROM v_payload_digest
       AND v_existing.state IN ('COMPLETED', 'REJECTED') THEN
      RETURN QUERY SELECT
        'REQUEST_REPLAY',
        v_existing.claim_hash,
        v_existing.actor_user_id,
        v_existing.request_id,
        v_existing.receipt_type,
        v_existing.receipt_id,
        v_existing.response_payload;
      RETURN;
    END IF;
    RETURN QUERY SELECT
      'REQUEST_ID_REUSED',
      v_existing.claim_hash,
      v_existing.actor_user_id,
      v_existing.request_id,
      NULL::text,
      NULL::text,
      NULL::jsonb;
    RETURN;
  END IF;

  SELECT *
  INTO v_existing
  FROM sales_security.actor_claim_consumption AS c
  WHERE c.actor_user_id = v_actor
    AND c.nonce = v_nonce;

  IF FOUND THEN
    RETURN QUERY SELECT
      'NONCE_REUSED',
      v_existing.claim_hash,
      v_existing.actor_user_id,
      v_existing.request_id,
      NULL::text,
      NULL::text,
      NULL::jsonb;
    RETURN;
  END IF;

  SELECT *
  INTO v_existing
  FROM sales_security.actor_claim_consumption AS c
  WHERE c.transaction_id = pg_current_xact_id();

  IF FOUND THEN
    RETURN QUERY SELECT
      'TRANSACTION_ALREADY_CONSUMED',
      v_existing.claim_hash,
      v_existing.actor_user_id,
      v_existing.request_id,
      NULL::text,
      NULL::text,
      NULL::jsonb;
    RETURN;
  END IF;

  RAISE EXCEPTION 'claim consumption unique conflict without matching row'
    USING ERRCODE = '23505';
END;
$fn$;
```

`ON CONFLICT DO NOTHING` 不指定单一 index，是为了覆盖 claim hash、actor+request
、actor+nonce 和 transaction 四类唯一冲突；随后逐类查询，不会把无关唯一错误
直接当成 replay。业务函数收到 `TRANSACTION_ALREADY_CONSUMED` 时必须回滚，
不得在同一事务执行第二个受保护写。

### 5.2 finalize

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
  IF p_claim_hash IS NULL
     OR p_state NOT IN ('COMPLETED', 'REJECTED')
     OR p_receipt_type IS NULL
     OR p_response_payload IS NULL
     OR jsonb_typeof(p_response_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid claim finalization'
      USING ERRCODE = '22023';
  END IF;

  UPDATE sales_security.actor_claim_consumption
  SET state = p_state,
      receipt_type = p_receipt_type,
      receipt_id = p_receipt_id,
      response_payload = p_response_payload,
      completed_at = clock_timestamp()
  WHERE claim_hash = p_claim_hash
    AND transaction_id = pg_current_xact_id()
    AND state = 'PENDING';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'claim finalization must match the current transaction'
      USING ERRCODE = '23514';
  END IF;
END;
$fn$;
```

### 5.3 owner / ACL

```sql
ALTER FUNCTION sales_security.consume_sales_actor_claim_v3(
  jsonb, bytea, text, text, text, text
) OWNER TO "elevator_sales_definer";

ALTER FUNCTION sales_security.finalize_sales_actor_claim_v3(
  bytea, text, text, text, jsonb
) OWNER TO "elevator_sales_definer";

REVOKE ALL ON FUNCTION
  sales_security.consume_sales_actor_claim_v3(jsonb, bytea, text, text, text, text),
  sales_security.finalize_sales_actor_claim_v3(bytea, text, text, text, jsonb)
FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";
```

Web runtime 只能通过已验证的业务函数间接触发；它不能直接 reset/mark/alter claim。

## 6. 提交结果不确定协议

### 6.1 成功提交但响应丢失

```text
事务 COMMIT
-> Claim row + business row + receipt 全部存在
-> 客户端重送同 requestId/payload
-> consume 查询 actor+requestId
-> 返回 REQUEST_REPLAY + 原 receipt/response
-> 不执行任何业务写入
```

同一个原始 Claim 重送：

```text
claim_hash 已存在且 COMPLETED
-> 返回 REPLAY + 原 response
```

Receipt response shape：

| operation | response_payload |
|---|---|
| `REQUIREMENT_PATCH` | `{outcome, requirementId, version, replayed}` |
| `REQUIREMENT_CONFIRM` | `{outcome, requirementId, version, replayed}` |
| `ADVISOR_START` | `{outcome, conversationId, requirementId, replayed}` |
| `ADVISOR_TURN` | `{outcome, requirementId, version, assistantMessageId, replayed}` |
| `SELECTION_CREATE` | `{outcome, selectionRunId, replayed}` |
| `SALES_HANDOFF_CREATE` | `{outcome, handoffId, contextState, replayed}` |
| `SALES_FOLLOW_UP_NOTE` | `{outcome, noteId, statusAfter, replayed}` |
| `SALES_LIST` / `SALES_GET_CONTEXT` | `{outcome, resultDigest, recordCount}`；不缓存业务 DTO |

所有 JSON 由服务端最终函数构造；客户端不得自定义 `outcome` 或 receipt 字段。
首次 list/get 调用在不持久化 DTO 的前提下，可以把当前权限过滤后的 DTO 直接返回给
本次调用者；数据库 receipt 只保存 digest/count。重放不得从 receipt 重建 DTO，而是
返回 `READ_REPLAY_REQUIRES_NEW_CLAIM`，由客户端用新 requestId/Claim 重新读取。
数据库 receipt 保存首次结果的规范化数据，其中 `replayed=false`；重放响应由函数
在内存中覆盖为 `replayed=true`，不得重写原 receipt，也不得重新执行写入。
`REJECTED` receipt 只用于确定的业务拒绝；死锁、序列化失败、连接中断或未知 COMMIT
必须整体回滚并走有界重试，不得固化为永久拒绝。
`finalize_sales_actor_claim_v3` 还必须按 operation 的精确 key allow-list 校验
response object；表 CHECK 只拦截明显敏感 key 和过大 payload，后者不能替代函数
层的递归/逐字段 allow-list。

### 6.2 事务失败并回滚

Claim INSERT、业务写入和 receipt 在同一事务中回滚。客户端可以用同一 Claim 重试，
因为数据库不存在已提交消费行；Project lock 和业务校验会重新执行。

### 6.3 并发消费

两个连接插入同一 `claim_hash`：

```text
一个 INSERT 成功并保持 PENDING
另一个 INSERT 等待唯一 index
成功事务完成业务并 finalize
第二个事务唤醒后看到 COMPLETED，返回 REPLAY
```

同一 requestId 的不同 Claim：

```text
actor+requestId unique 阻止第二个消费记录
同 payload -> REQUEST_REPLAY
异 payload/operation/project/object -> REQUEST_ID_REUSED
```

### 6.4 PENDING 异常

任何 COMMIT 前仍未 finalize 的 Claim 由 deferred constraint trigger 拒绝。
因此不存在“Claim 已提交但业务未提交”的正常路径。

## 7. R4 五个业务函数的 Claim 接入

### 7.1 统一前置/后置

原有 R4 函数保留业务主体，在入口增加：

```text
claim_result := consume_sales_actor_claim_v3(...)
if REPLAY/REQUEST_REPLAY -> 先重新检查当前 RBAC/project 权限；写操作返回 receipt，
  读操作不返回旧业务 DTO
if CONSUMED -> 执行业务主体
if CLAIM_ALREADY_IN_TRANSACTION / TRANSACTION_ALREADY_CONSUMED -> 立即抛错并回滚
if INVALID_CLAIM / INVALID_CLAIM_SCOPE / CONFLICT -> 不执行任何业务写
在每一个成功或业务拒绝 return 之前调用 finalize_sales_actor_claim_v3(...)
```

`app_list_sales_handoffs_v2` 和 `app_get_sales_handoff_context_v2` 因为必须消费
Claim 并写 receipt，二者必须声明为 `VOLATILE`，不得标为 `STABLE` 或 `IMMUTABLE`。
数据库不得把函数结果或销售 DTO 跨请求缓存。读取重放只可返回 digest/count；
实际销售内容必须用新 Claim 在当前权限和项目范围下重新查询。

业务主体不得 catch-and-ignore 异常；意外 DB 异常整体 rollback。

授权必须在 replay 返回前重新检查。销售写 receipt 只包含 ID/status/outcome，
不得包含摘要、内部预算或 notes。`SALES_LIST`/`SALES_GET_CONTEXT` 的 claim receipt
只保存结果摘要（如 record count/result digest），不缓存可跨权限变化继续返回的销售
DTO；同 claim 重放返回 `READ_REPLAY_REQUIRES_NEW_CLAIM`，客户端需重新签发 Claim 并
重新执行当前项目/SALES_MANAGE 过滤。

### 7.2 函数内 Claim scope

| R4 函数 | operation | Project/Object | receipt |
|---|---|---|---|
| `app_sales_create_handoff_v2` | `SALES_HANDOFF_CREATE` | projectId / `PROJECT` | handoff id + outcome |
| `app_append_sales_followup_v2` | `SALES_FOLLOW_UP_NOTE` | signed projectId / handoffId | note id/status |
| `app_list_sales_handoffs_v2` | `SALES_LIST` | NULL / `SALES_LIST` | result digest + count，不存 DTO |
| `app_get_sales_handoff_context_v2` | `SALES_GET_CONTEXT` | signed projectId / handoffId | result digest + count，不存 DTO |
| `app_resolve_current_completed_selection_v2` | internal only | N/A | no external Claim |

`app_resolve` 继续仅由其他 definer 函数/Trigger 调用，不授予 Web EXECUTE。

为消除顶层未签名 project 字段被当作业务目标的可能，R5 对 R4 两个函数的签名做
兼容性修订：

```text
app_append_sales_followup_v2(
  claim, signature, projectId, handoffId, status, contactStatus, note
)

app_get_sales_handoff_context_v2(
  claim, signature, projectId, handoffId
)
```

对应 ACL 必须使用新签名；未完成调用方迁移前不得启用该版函数。

## 8. 撤回 Web 直接写权限

### 8.1 全部受保护写表

```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE
  public."building_requirement",
  public."requirement_revision",
  public."advisor_conversation",
  public."advisor_message",
  public."selection_run",
  public."selection_recommendation",
  public."sales_handoff",
  public."sales_follow_up_note",
  public."audit_log"
FROM "elevator_web_runtime_v2",
     "elevator_worker_runtime_v2",
     PUBLIC;
```

Web Runtime 不再使用 Prisma `create/update/upsert/delete` 写这些表。

`elevator_app` 是当前数据库 owner，不是本设计认可的 Web runtime 身份。对 owner
执行 REVOKE 不能移除其隐式所有权能力，因此不得把“对 owner REVOKE”当作安全边界。
只有在 `elevator_web_runtime_v2` 既不是表 owner、也不是 owner 角色成员且没有
`SET ROLE` 路径时，本设计才可启用。

Project 行锁只在 SECURITY DEFINER 业务函数内部执行。Web 不获得
`UPDATE("id") ON project`，也不直接执行 `SELECT ... FOR UPDATE`；
`project_identity_guard` 继续作为 owner-side 第二道身份保护。

### 8.2 业务写函数清单

新增 controlled functions：

```text
app_create_requirement_version_v3(
  claim jsonb,
  signature bytea,
  projectId text,
  expectedVersion int,
  conversationId text,
  installationScenario text,
  finalFields jsonb,
  finalMissingFields jsonb,
  source text,
  payloadCanonical text
) -> outcome/requirementId/version/replayed

app_confirm_requirement_v3(
  claim jsonb,
  signature bytea,
  projectId text,
  requirementId text,
  expectedVersion int,
  payloadCanonical text
) -> outcome/requirementId/version/replayed

app_start_advisor_conversation_v3(
  claim jsonb,
  signature bytea,
  projectId text,
  installationScenario text,
  initialFields jsonb,
  initialMissingFields jsonb,
  initialAssistantMessage text,
  payloadCanonical text
) -> outcome/conversationId/requirementId/replayed

app_finish_advisor_turn_v3(
  claim jsonb,
  signature bytea,
  projectId text,
  conversationId text,
  expectedVersion int,
  userMessage text,
  assistantMessage text,
  finalFields jsonb,
  finalMissingFields jsonb,
  providerSnapshot jsonb,
  payloadCanonical text
) -> outcome/requirementId/version/replayed

app_create_selection_run_v3(
  claim jsonb,
  signature bytea,
  projectId text,
  requirementId text,
  expectedVersion int,
  inputSnapshot jsonb,
  result jsonb,
  payloadCanonical text
) -> outcome/selectionRunId/replayed

app_update_selection_run_status_v3(
  claim jsonb,
  signature bytea,
  projectId text,
  selectionRunId text,
  expectedStatus text,
  nextStatus text,
  payloadCanonical text
) -> outcome/selectionRunId/replayed

app_append_web_domain_audit_v3(
  claim jsonb,
  signature bytea,
  projectId text,
  action text,
  objectType text,
  objectId text,
  oldValue jsonb,
  newValue jsonb,
  reason text,
  payloadCanonical text
) -> outcome/auditId/replayed

app_append_web_global_audit_v3(
  claim jsonb,
  signature bytea,
  action text,
  objectType text,
  objectId text,
  oldValue jsonb,
  newValue jsonb,
  reason text,
  payloadCanonical text
) -> outcome/auditId/replayed

app_append_worker_audit_v3(
  requestId text,
  action text,
  objectType text,
  objectId text,
  oldValue jsonb,
  newValue jsonb,
  reason text
) -> outcome/auditId
```

全部函数的规范：

- `SECURITY DEFINER`，owner `elevator_sales_definer`；
- `SET search_path=pg_catalog`；
- 无动态 SQL；
- 所有业务表/枚举/schema 全限定；
- 无默认参数，NULL 显式拒绝；
- 所有写函数在执行权威需求/run/handoff 校验前先锁 Project；纯读取函数不制造长锁；
- 调用 `consume_sales_actor_claim_v3`；
- 业务写入与 `finalize_sales_actor_claim_v3` 同事务；
- replay 只返回 receipt，不重复写业务。

数据库权限必须使用现有 permission code，不允许按操作名自行发明角色：

| 操作 | 数据库内权限复核 |
|---|---|
| Requirement PATCH/CONFIRM | `advisor.use` + Project scope |
| Advisor start/turn | `advisor.use` + Project scope |
| SelectionRun create | `selection.run` + Project scope |
| SalesHandoff create | `sales.handoff.create` + Project scope |
| Sales note/list/get | `sales.manage` + Project/row scope |
| project/global audit bridge | exact action allow-list + 对应现有 domain permission |

Web Route 的前置 UI 权限检查仍保留；数据库复核是防止 route/service 回归或旁路写入
的第二道边界，不改变现有权限定义。

这些新增 business functions 也必须逐个提供完整参数类型、返回类型、NULL 规则、
错误 map、owner、`SET search_path=pg_catalog` 和精确 ACL；R5 给出的是其受控调用
契约，实施前必须像 R4 的五个函数一样补齐完整 body 并接受独立安全审查。

不得采用“先 consume、再由 Web 在 Project 锁内 merge、最后调用只有 claimHash 的
finish function”的两段协议。那种协议会让签名 payload 与实际 finalFields 分离，
使 Web 可在消费 Claim 后提交未经签名绑定的字段。R5 因此改为单函数提交：

- 服务端先读取当前状态并在事务外完成纯计算/merge；
- Claim 对完整的 final write payload 签名；
- 数据库函数先 consume，再锁 Project，重新读取 expectedVersion 对应状态；
- 版本或归属不一致时返回稳定冲突且不写业务；
- finalFields、finalMissingFields、status、对象 ID 都必须出现在 canonical payload。

`app_create_requirement_version_v3` 的 `conversationId` 只允许为当前 Project 的
会话或 NULL。`expectedVersion=0` 仅允许在项目尚无需求时创建第一版；其他调用必须
匹配 Project 当前最大 `version`。该函数同时写 BuildingRequirement 与
RequirementRevision，不得由 Web 分别调用两个写操作。

`app_confirm_requirement_v3` 必须在锁后核对 requirementId 是当前需求、version
等于 expectedVersion、missingFields 为空且仍有客户确认所需字段；确认只改变
客户确认状态，不把 `professionalReviewRequired` 清零，也不写成专业审核通过。

`app_finish_advisor_turn_v3` 必须先核对 conversation 属于 claim.projectId，再核对
当前需求 version，并原子写 user message、assistant message、新需求版本和 revision。
provider 调用在事务外完成，其返回只作为已签名 payload 的一部分；provider 失败不得
消费 Claim 或写半个 turn。

`app_create_selection_run_v3.result` 固定为只含
`rulesVersion/status/recommendations[]` 的对象；函数在同一事务写 SelectionRun 和
全部 SelectionRecommendation。recommendation 只允许引用已存在的 product/spec
版本，空数组仅在现有 engine 明确返回无匹配时合法。函数不得接受 Web 直接提交
“已有 selectionRunId”来伪造历史对象。
函数还必须在 Project 锁下确认 requirementId 是该 Project 当前最大版本、
`CUSTOMER_CONFIRMED` 且与 expectedVersion 一致；旧需求或被新需求替代的请求返回
`CONTEXT_STALE`。

新函数必须使用稳定 outcome（不得把数据库异常文本直接返回客户端）：

```text
OK, INVALID_ARGUMENT, INVALID_REQUEST, FORBIDDEN, NOT_FOUND,
VERSION_CONFLICT, CONTEXT_UNAVAILABLE, CONTEXT_STALE, CONTEXT_CONFLICT,
CLOSED, LEGACY_UNBOUND, IDEMPOTENCY_KEY_REUSED,
READ_REPLAY_REQUIRES_NEW_CLAIM, INTERNAL_RETRYABLE
```

`INVALID_CLAIM*`、`REQUEST_ID_REUSED`、`NONCE_REUSED`、`CLAIM_CONFLICT` 和
`TRANSACTION_ALREADY_CONSUMED` 属于协议拒绝，不能被映射成 200 或业务成功。

### 8.3 调用路径

现场 Web Route / service 入口与目标受控函数对应如下：

| 现场入口 | 当前写路径 | 目标 |
|---|---|---|
| `POST /api/projects/[projectId]/advisor/conversations` | `startAdvisorConversation` → conversation/message/requirement raw SQL | `app_start_advisor_conversation_v3` |
| `POST /api/projects/[projectId]/advisor/conversations/[conversationId]/messages` | provider 后 `sendAdvisorMessage` → message/requirement raw SQL | `app_finish_advisor_turn_v3` |
| `PATCH /api/projects/[projectId]/requirements` | route merge → `createRequirementVersion` raw SQL | `app_create_requirement_version_v3` |
| `POST /api/projects/[projectId]/requirements/confirm` | `confirmRequirement` → `createRequirementVersion` raw SQL | `app_confirm_requirement_v3` |
| `POST /api/projects/[projectId]/selection-runs` | `runPreliminarySelection` → run/recommendation raw SQL | `app_create_selection_run_v3` |
| `POST /api/projects/[projectId]/sales-handoff` | `createSalesHandoff` raw SQL | amended `app_sales_create_handoff_v2` |
| `POST /api/admin/sales/[handoffId]/notes` | `addSalesFollowUp` raw SQL | amended `app_append_sales_followup_v2` |
| `GET /api/admin/sales` | `listSalesHandoffs` direct query | amended `app_list_sales_handoffs_v2` |
| admin sales detail/page | `getLatestSalesHandoff` direct query | amended `app_get_sales_handoff_context_v2` |

上表中每个 Route 仍保留原 `requireApiActor`、页面/API 权限守卫和业务错误映射；
数据库函数是第二道权威校验，不替代现有服务端鉴权。Route 不得在调用函数之外再写
同一批受保护表。

| 业务入口 | 服务端调用 |
|---|---|
| Requirement PATCH | 读取当前需求 → 校验/merge → 签完整 final payload → `app_create_requirement_version_v3` |
| Requirement confirm | single `app_confirm_requirement_v3` |
| Advisor start | single `app_start_advisor_conversation_v3` |
| Advisor message | provider call outside tx → merge/derive complete result → sign final payload → `app_finish_advisor_turn_v3` |
| SelectionRun create | single `app_create_selection_run_v3` |
| SelectionRun status update | `app_update_selection_run_status_v3`，当前无普通调用入口时保持未授权 |
| SalesHandoff create | R4 `app_sales_create_handoff_v2` amended with claim |
| SalesHandoff status/note | R4 `app_append_sales_followup_v2` amended with claim |
| Sales list/get | R4 read functions amended with claim/receipt |
| AuditLog | 受保护业务由上述 definer 函数内部 INSERT；其他领域经三个窄 audit bridge |

Requirement PATCH 的 expectedVersion 是 Claim 签名内容的一部分。服务端在事务外完成
merge，数据库在 Project 锁下重新核对版本，因此并发 PATCH 最多一个成功，
另一个返回 409。Advisor turn、SelectionRun、SalesHandoff 和 note 使用同一模式：
签名覆盖全部最终写字段，数据库锁后重新读取权威状态并拒绝 stale request。

现场 `requirementUpdateSchema` 没有 `expectedVersion`，Advisor message 也没有该字段；
因此正式实施必须在独立 API/contract 变更审查中增加或由服务端从当前读模型注入，
不能悄悄让客户端提交未签名版本。R5 本轮只设计数据库受控函数，不修改
`packages/contracts` 或 Route。

non-protected 领域已有的 Web/Worker AuditLog 调用必须迁移到
`app_append_web_domain_audit_v3`、`app_append_web_global_audit_v3` /
`app_append_worker_audit_v3`：

- Web audit function 仅允许显式白名单的非
  `requirement.*` / `advisor.*` / `selection.*` / `sales.*` actions；
- `DOMAIN_AUDIT_APPEND` 仅用于 project-scoped audit；
  `DOMAIN_AUDIT_APPEND_GLOBAL` 只允许明确的全局 catalog/RBAC action，objectId
  固定为 `GLOBAL`，不得伪造 projectId 绕入；
- 受保护业务动作的 audit 必须由对应业务函数写入，不能调用通用 audit bridge；
- Worker bridge 只允许现有 `file.extraction.*` actions 和 `FileVersion` 对象，并在
  数据库中核对 `session_user` 是对应 Worker 登录身份；
- 三个 bridge 均只能 INSERT AuditLog，不能修改业务表或历史审计。

Worker bridge 必须采用精确 allow-list，而不是只做 `LIKE 'file.%'` 前缀判断；
`actorUserId` 使用 Worker 的固定受控身份，`requestId` 与 audit 实体在同一事务
产生。Web audit bridge 不接受 `summary/budget/note` 等销售字段，也不得成为受保护
业务操作的第二写路径。

现场 audit call sites 至少包括 `file.*`、`catalog.product.created/updated`、
`customer.created`、`project.created`、`building.created` 和
`installation_unit.created`。前三类中的 file/catalog 由对应 global/project
bridge 接收；项目域 action 通过 project bridge；Worker 仅保留 `file.extraction.*`。

如果现有 Web/Worker audit call site 尚未迁移，则不得执行 AuditLog 撤权，也不得
宣称 P1-2 完成。

### 8.4 权限旁路扫描

撤销表 DML 后，DBA 必须对隔离库执行：

```sql
SELECT c.oid::regclass, c.relkind
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public','sales_command','sales_security')
  AND c.relkind IN ('r','p','v','m','S');
```

并检查：

- 所有 view/materialized view 的 owner、GRANT 和底层表权限；
- 所有 sequence 的 USAGE/SELECT/UPDATE 权限；
- `pg_proc.prosecdef=true` 且可由 Web/Worker EXECUTE 的函数；
- 所有 Trigger function、`ALTER TABLE ... ENABLE/DISABLE TRIGGER` 权限；
- `pg_auth_members` 中继承路径；
- PUBLIC 对所有新表和函数的默认 EXECUTE/DML；
- 任何拥有保护表写权限的旧角色或自定义角色。

任何未归类的写权限都阻断 v2 启用。

继承与 PUBLIC 检查：

```sql
SELECT r.rolname
FROM pg_roles AS r
WHERE r.rolname <> 'elevator_sales_definer'
  AND (
    has_table_privilege(r.rolname, 'public.sales_handoff', 'INSERT')
    OR has_table_privilege(r.rolname, 'public.sales_handoff', 'UPDATE')
    OR has_table_privilege(r.rolname, 'public.sales_follow_up_note', 'INSERT')
    OR has_table_privilege(r.rolname, 'public.building_requirement', 'INSERT')
    OR has_table_privilege(r.rolname, 'public.selection_run', 'INSERT')
  );

SELECT am.roleid::regrole AS granted_role,
       am.member::regrole AS member_role
FROM pg_auth_members AS am
WHERE am.member IN (
  'elevator_web_runtime_v2'::regrole,
  'elevator_worker_runtime_v2'::regrole
);

SELECT pg_has_role(
  'elevator_web_runtime_v2',
  'elevator_sales_definer',
  'MEMBER'
) AS web_can_reach_definer,
pg_has_role(
  'elevator_worker_runtime_v2',
  'elevator_sales_definer',
  'MEMBER'
) AS worker_can_reach_definer;
```

结果中任何可传递写权限都必须撤销，或者该 Web/Worker 角色不能启用。对
`USAGE`、`SET`、成员继承和旧角色链分别检查；只设置 `NOINHERIT` 不足以阻止
`SET ROLE`。

## 9. 完整权限矩阵与 SQL

### 9.1 Web Runtime 表权限

| 对象 | SELECT | INSERT | UPDATE | DELETE | TRUNCATE/TRIGGER/REFERENCES |
|---|---:|---:|---:|---:|---:|
| Project | yes | existing CRUD outside this protected set | existing CRUD; no `id` lock grant | existing CRUD outside this set | no extra |
| BuildingRequirement | yes | no direct | no | no | no |
| RequirementRevision | yes | no direct | no | no | no |
| AdvisorConversation | yes | no direct | no | no | no |
| AdvisorMessage | yes | no direct | no | no | no |
| SelectionRun | yes | no direct | no | no | no |
| SelectionRecommendation | yes | no direct | no | no | no |
| SalesHandoff | no direct | no direct | no direct | no | no |
| SalesFollowUpNote | no direct | no direct | no direct | no | no |
| AuditLog | yes for existing admin reads | no direct | no | no | no |
| RBAC tables | SELECT | no | no | no | no |
| sequences/views | none unless separately approved | none | none | none | none |

Web 执行：

```text
app_create_requirement_version_v3
app_confirm_requirement_v3
app_start_advisor_conversation_v3
app_finish_advisor_turn_v3
app_create_selection_run_v3
app_update_selection_run_status_v3（默认不授权，直到有批准入口）
app_append_web_domain_audit_v3
app_append_web_global_audit_v3
app_sales_create_handoff_v2
app_append_sales_followup_v2
app_list_sales_handoffs_v2
app_get_sales_handoff_context_v2
```

内部 resolver、claim consume/finalize、actor helper、permission helper 不授予 Web。
该矩阵只解决写入绕过；Web Runtime 对 Requirement/Advisor/Selection/AuditLog 的直接
SELECT 仍是共享数据库角色的粗粒度能力，跨 Project 可见性继续依赖现有服务端权限守卫。
因此不得把本矩阵解释为完整数据库租户隔离；若需要数据库级 SELECT 隔离，应另立 RLS
或受控读取函数设计。

### 9.2 Definer DML

`elevator_sales_definer` 仅获得：

```text
SELECT: requirement/revision/conversation/message/selection/recommendation/
        handoff/note/project/RBAC/session/claim
INSERT: requirement/revision/conversation/message/selection/recommendation/
        handoff/note/audit
UPDATE: requirement? NO, selection? NO, advisor conversation updatedAt,
        sales_handoff status/updatedAt
DELETE/TRUNCATE/REFERENCES/TRIGGER: NO
```

需求/Selection 修改只允许 INSERT 新行；不给 UPDATE/DELETE。

### 9.3 REVOKE/GRANT

```sql
REVOKE ALL ON SCHEMA sales_command, sales_security
FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";
GRANT USAGE ON SCHEMA sales_command
TO "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE "elevator_sales_definer"
FROM "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE
  public."building_requirement",
  public."requirement_revision",
  public."advisor_conversation",
  public."advisor_message",
  public."selection_run",
  public."selection_recommendation",
  public."sales_handoff",
  public."sales_follow_up_note",
  public."audit_log"
FROM "elevator_web_runtime_v2",
     "elevator_worker_runtime_v2",
     PUBLIC;

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

GRANT UPDATE ("id")
ON public."project"
TO "elevator_sales_definer";

REVOKE EXECUTE ON ALL FUNCTIONS
IN SCHEMA sales_command, sales_security
FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

ALTER DEFAULT PRIVILEGES
FOR ROLE "elevator_sales_definer"
IN SCHEMA sales_command, sales_security
REVOKE EXECUTE ON FUNCTIONS
FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

ALTER DEFAULT PRIVILEGES
FOR ROLE "elevator_sales_definer"
IN SCHEMA public
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLES
FROM PUBLIC, "elevator_web_runtime_v2", "elevator_worker_runtime_v2";

ALTER FUNCTION sales_command.app_create_requirement_version_v3(
  jsonb, bytea, text, integer, text, text, jsonb, jsonb, text, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_confirm_requirement_v3(
  jsonb, bytea, text, text, integer, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_start_advisor_conversation_v3(
  jsonb, bytea, text, text, jsonb, jsonb, text, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_finish_advisor_turn_v3(
  jsonb, bytea, text, text, integer, text, text, jsonb, jsonb, jsonb, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_create_selection_run_v3(
  jsonb, bytea, text, text, integer, jsonb, jsonb, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_update_selection_run_status_v3(
  jsonb, bytea, text, text, text, text, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_append_web_domain_audit_v3(
  jsonb, bytea, text, text, text, text, jsonb, jsonb, text, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_append_web_global_audit_v3(
  jsonb, bytea, text, text, text, jsonb, jsonb, text, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_append_worker_audit_v3(
  text, text, text, text, jsonb, jsonb, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_sales_create_handoff_v2(
  jsonb, bytea, text, text, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_append_sales_followup_v2(
  jsonb, bytea, text, text, "public"."SalesHandoffStatus", varchar, text
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_list_sales_handoffs_v2(
  jsonb, bytea, text, integer, integer
) OWNER TO "elevator_sales_definer";
ALTER FUNCTION sales_command.app_get_sales_handoff_context_v2(
  jsonb, bytea, text, text
) OWNER TO "elevator_sales_definer";
```

Function grants必须使用精确签名，禁止 `ALL FUNCTIONS`：

```sql
GRANT EXECUTE ON FUNCTION
  sales_command.app_create_requirement_version_v3(
    jsonb, bytea, text, integer, text, text, jsonb, jsonb, text, text
  ),
  sales_command.app_confirm_requirement_v3(
    jsonb, bytea, text, text, integer, text
  ),
  sales_command.app_start_advisor_conversation_v3(
    jsonb, bytea, text, text, jsonb, jsonb, text, text
  ),
  sales_command.app_finish_advisor_turn_v3(
    jsonb, bytea, text, text, integer, text, text, jsonb, jsonb, jsonb, text
  ),
  sales_command.app_create_selection_run_v3(
    jsonb, bytea, text, text, integer, jsonb, jsonb, text
  ),
  sales_command.app_append_web_domain_audit_v3(
    jsonb, bytea, text, text, text, text, jsonb, jsonb, text, text
  ),
  sales_command.app_append_web_global_audit_v3(
    jsonb, bytea, text, text, text, jsonb, jsonb, text, text
  ),
  sales_command.app_sales_create_handoff_v2(
    jsonb, bytea, text, text, text
  ),
  sales_command.app_append_sales_followup_v2(
    jsonb, bytea, text, text, "public"."SalesHandoffStatus", varchar, text
  ),
  sales_command.app_list_sales_handoffs_v2(
    jsonb, bytea, text, integer, integer
  ),
  sales_command.app_get_sales_handoff_context_v2(jsonb, bytea, text, text)
TO "elevator_web_runtime_v2";

REVOKE ALL ON FUNCTION
  sales_command.app_append_worker_audit_v3(
    text, text, text, text, jsonb, jsonb, text
  )
FROM PUBLIC, "elevator_web_runtime_v2";

GRANT EXECUTE ON FUNCTION
  sales_command.app_append_worker_audit_v3(
    text, text, text, text, jsonb, jsonb, text
  )
TO "elevator_worker_runtime_v2";
```

`app_update_selection_run_status_v3` 默认不授予，直到有明确业务入口和独立审查。
内部 resolver、actor verifier、permission helper、claim consume/finalize 以及
claim 表均不授予 Web/Worker。`elevator_sales_definer` 必须是 NOLOGIN，不能被
Web/Worker 通过 membership 或 `SET ROLE` 取得。`elevator_app` owner 的 implicit
ownership 仍使 Contract 保持 BLOCKED，直到独立角色切换方案完成。

隔离实现必须在 catalog 中同时证明：

```text
elevator_sales_definer: NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS
elevator_web_runtime_v2: 不是任何 owner 角色成员，不能 SET ROLE definer/owner
elevator_worker_runtime_v2: 不是任何 owner 角色成员，不能 SET ROLE definer/owner
```

这些是 Catalog 验证结果，不是本报告已执行的事实。

## 10. 新函数执行权限

```text
PUBLIC EXECUTE:
  none

elevator_web_runtime_v2:
  only approved command/read functions

elevator_worker_runtime_v2:
  only app_append_worker_audit_v3 for existing file.extraction.* audit compatibility

elevator_sales_definer:
  internal helpers only through definer execution

Migration/Owner:
  no runtime EXECUTE grants
```

所有 helper 和 resolver 必须 revoke from PUBLIC/Web/Worker，只由 definer 函数链调用。

## 11. 扩展测试矩阵

| ID | 初始状态 | A | B | 预期 |
|---|---|---|---|---|
| `CC-CLAIM-01` | valid unconsumed claim | 单连接 consume | none | CONSUMED，业务成功，receipt terminal |
| `CC-CLAIM-02` | same claim PENDING in A | B consume same claim | A waits/commits | B sees REPLAY，不执行业务 |
| `CC-CLAIM-03` | same claim rollback | A business failure rollback | B same claim | B can consume after A rollback |
| `CC-CLAIM-04` | same requestId/payload, new claim | same actor/op/project/object | new nonce | REQUEST_REPLAY，reuse receipt |
| `CC-CLAIM-05` | same requestId changed payload | same actor/op/project | new digest | REQUEST_ID_REUSED，reject |
| `CC-CLAIM-06` | same Claim wrong operation | valid claim | expected operation mismatch | INVALID_CLAIM |
| `CC-CLAIM-07` | same Claim wrong project/object | valid claim | changed binding | INVALID_CLAIM_SCOPE |
| `CC-CLAIM-08` | expired claim | expired TTL | consume | deny，不写 |
| `CC-CLAIM-09` | invalid HMAC/session/key | tamper | consume | deny，不写 |
| `CC-CLAIM-10` | claim INSERT succeeds, business throws | transaction | rollback | claim + business + receipt absent |
| `CC-CLAIM-11` | claim/business commit, response missing | client retries same request | consume | receipt only，无重复业务 |
| `CC-CLAIM-12` | PENDING without finalize | COMMIT | none | deferred guard rejects |
| `CC-CLAIM-13` | 同一 Claim 换 actor/session | 用另一 actor/session 调用 | consume/verify | 签名或 Session 绑定失败，不消费 |
| `CC-CLAIM-14` | 一次事务尝试消费两个 Claim | operation A | operation B | 协议拒绝，单事务只允许一个 terminal Claim |
| `CC-CLAIM-15` | finalFields 在事务外被替换 | 原 claim consumer | 新字段调用 | payload digest mismatch，不写业务 |
| `CC-CLAIM-16` | key rotation | 旧 key claim | 新 key claim | 旧未消费 Claim 仅在有效窗口验证；receipt 可恢复 |
| `CC-CLAIM-17` | receipt 超限/敏感字段注入 | finalize | commit | size/allow-list 拒绝，不持久化销售 DTO |
| `CC-SCOPE-01` | top-level project A, signed payload project B | consume A | business scope B | digest/scope mismatch，不写 |
| `CC-SCOPE-02` | handoff belongs to B, claim payload project A | note/get A | target handoff B | lock 后 `CONTEXT_CONFLICT`，不读不写 |
| `CC-REQ-01` | two PATCH same expected version | A locks/merges/writes | B waits | one wins，one 409，no lost update |
| `CC-ADV-01` | provider snapshot then concurrent PATCH | A patch | B advisor finish | expectedVersion conflict，no partial message |
| `CC-RUN-01` | selection create vs new requirement | A locks/creates | B creates R2 | one coherent order，stale run not current |
| `CC-SALES-01` | new requirement vs old handoff | A R2 | B note H1 | B Project lock/stale 409 |
| `CC-SALES-02` | selection run vs old handoff | A new run | B note | B stale 409 |
| `CC-NOTE-01` | same note request key concurrent | A insert | B insert | one note，B receipt/replay |
| `CC-NOTE-02` | note vs CLOSED | A note | B close | Project serialized，CLOSED no new note |
| `CC-ROLE-01` | old role NOLOGIN | old credential | connect | authentication failure |
| `CC-ROLE-02` | Web direct INSERT/UPDATE protected table | direct DML | view/function bypass attempts | all 42501 or controlled-function rejection |
| `CC-ROLE-03` | Web has an inherited role with protected DML | inherited write | PUBLIC/view/trigger path | 被撤权或 gate 阻断，v2 不启用 |
| `CC-ROLE-04` | Web direct `SELECT ... FOR UPDATE` on Project | lock attempt | none | 42501；不依赖 `UPDATE(id)` 冒充分离 |
| `CC-ROLE-05` | Web/Worker membership in definer | `SET ROLE` attempt | helper/function access | gate 阻断，所有调用 fail closed |
| `CC-ROLE-06` | default privilege / newly created function | new function | Web EXECUTE | PUBLIC 与 runtime 均被默认 revoke |
| `CC-AUDIT-01` | Web direct AuditLog INSERT | direct DML | bridge controlled insert | direct 42501；bridge 只接受白名单 action |
| `CC-AUDIT-02` | Worker tries sales/requirement audit | worker bridge | protected action | deny，不能伪造业务审计 |
| `CC-AUDIT-03` | sensitive sales summary/budget in read receipt | replay | read | receipt 不含 DTO，只保存 digest/count |
| `CC-AUDIT-04` | global catalog audit without project | global bridge with object `GLOBAL` | forged project path | global bridge accepts only global allow-list；project bridge rejects |
| `CC-XACT-01` | prepared xact exists | Contract gate | none | BLOCKED |
| `CC-XACT-02` | prepared xact safely handled | recheck | Contract | only then eligible，no auto commit |
| `CC-TIME-01` | microsecond same-millisecond runs | DB resolver | TS fixture | same context/tie result |
| `CC-PAGE-01` | identical updatedAt | page 1/2 | next page | stable id tie-break |
| `CC-RETRY-01` | 40001/40P01/P2034 | retry | same claim | re-read state，no duplicate |
| `CC-RETRY-02` | transient 40001 around provider result | provider already returned | retry transaction | provider not called again；only DB retry |

All concurrency tests require two independent PG connections with application_name,
barrier, backend PID, pg_stat_activity wait_event, pg_locks, final entity counts.

## 12. 保留的 R4 部分

R5 不改变以下业务语义；除 Claim 前后置外，仅对 sales note/get 增加已签名
`projectId` 参数：

- R4 的 resolver、handoff create/list/note/get 业务主体；
- `app_resolve_current_completed_selection_v2` millisecond resolver；
- SelectionRun `requirementProjectId` and composite FK；
- SalesHandoff exact context and createPayload;
- LEGACY_UNBOUND/CLOSED;
- note unique idempotency;
- assignedTo orphan precheck;
- prepared transaction gate;
- RepeatableRead page reads;
- database SALES_MANAGE filter;
- stable pagination;
- no automatic old-handoff revival.

## 13. 实施顺序

0. 冻结本设计的 operation canonical payload、角色 Catalog 和所有受保护写入口；
1. 在隔离库建立 Claim table、consume/finalize helper、receipt trigger；
2. 为 R4 五函数和新业务函数补齐完整 PL/pgSQL body，并执行独立安全审查；
3. 让 R4 五函数使用 consume/finalize 协议，而不是只 verify Claim；
4. 实现 Requirement/Advisor/Selection controlled functions 和 project/global/Worker
   三个 audit bridge；
5. 把所有现有 Web/Worker AuditLog call site 迁移到受控 bridge；
6. 在隔离库执行 SQL compile/catalog/ACL，确认每个保护表无 Web/Worker 直接 DML；
7. 执行双连接 Claim、business lock、note、retry、错误注入和 audit tests；
8. 检查源码不存在绕过函数的 `create/update/upsert/delete/raw INSERT/UPDATE/DELETE`；
9. 仅完成独立审查后才进入 Expand/Contract；
10. 真实 Contract 仍等待角色/旧写入者/prepared xact 证据。

第 0–4 步未完成前，不授权执行第 6 步撤权；撤权不是文档完成即可证明的事实。

## 14. 回滚

- Before R5 Claim/command enable: retain R4 Expand schema，rollback app。
- After Claim table/function create but before direct DML revoke: feature flag off，old code only if frozen；
- After revoke but before Contract: restore R4 permission snapshot and old role only under
  approved maintenance rollback；
- After Contract committed: forward-fix；do not re-enable old API/direct DML；
- Claim rows owned by rolled-back transaction disappear automatically；
- 已提交 Claim/receipt 不删除；未来 retention cleanup 另行授权。

## 15. 仍未验证 / BLOCKED

```text
Prisma/Schema/Migration:
  NOT VERIFIED / NOT EXECUTED
PostgreSQL function compile:
  NOT VERIFIED
Claim unique/atomic concurrency:
  NOT VERIFIED
Claim receipt/response-loss recovery:
  NOT VERIFIED
SECURITY DEFINER/proconfig/proacl:
  NOT VERIFIED
Web direct DML revocation:
  NOT EXECUTED
File-lifecycle AuditLog call-site migration:
  BLOCKED UNTIL SEPARATE FILE-LIFECYCLE DESIGN REVIEW
Requirement/Advisor/Selection command functions:
  DESIGNED / NOT IMPLEMENTED
Expected-version API/contract changes:
  REQUIRED / NOT IMPLEMENTED / NOT AUTHORIZED IN R5 DOCUMENT TASK
HMAC key Secret Manager custody:
  NOT VERIFIED
Prepared transaction Contract:
  NOT EXECUTED
E2E/Browser/RSC:
  NOT EXECUTED
Real Contract:
  BLOCKED / NOT AUTHORIZED
```

Contract 只有在所有旧写入者、角色 membership、CONNECT、对象 owner、新旧 backend、
prepared transaction 和部署证据都通过后才能变为
`ELIGIBLE_FOR_CONTROLLED_CUTOVER`。本报告不改变其当前 `BLOCKED` 状态。

## 16. Git 状态

调查前：

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            151
Untracked recursive files:    162
```

新增本报告后的现场：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            152
Untracked recursive files:    163
```

R5 文件本身解释 1 个 entry / 1 个递归文件；相对于本轮任务声明的 150 / 161，
另一项差异在 R5 创建前即已存在，未被本轮移动、删除或读取。

## 17. 静态验证

本轮实际执行：

```text
git -c safe.directory=D:/thinkbook/Desktop/jieya diff --check
exit code: 0
result: PASS；仅有既有 tracked 文件的 LF/CRLF 警告，无 whitespace error

R5 text checks
exit code: 0
result: balanced code fences; 0 trailing whitespace; 0 conflict markers

R4 / R4 independent review SHA-256
result: unchanged from supplied inputs
```

本轮未执行：`pnpm typecheck`、Prisma validate/generate、SQL、PostgreSQL、Migration、
并发实验、E2E、Browser、Build、Provider、服务启动、部署、角色/ACL 变更。
这些未执行项不能记为 PASS。

## 18. 报告 SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
360c78befbd1f1560805a9634b1fcf8833e3fde93eeb36f66b02bad3b56aaf06

Bytes:                    71156
Physical lines:           1824
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符，
对 UTF-8 文件字节计算 SHA-256。
