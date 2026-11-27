# APP-WORKBENCH-R2 SalesHandoff R6 Independent Adversarial Design Review

## 0. 最终结论

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

本轮只读审查 R6。R6 已建立 R2 独立审计事件、expectedVersion 契约和角色迁移
框架，但它仍有两个 P1 问题：

1. R6 把 R4 的完整销售函数 body 作为参考源，却没有给出经 Claim wrapper、
   projectId 参数和 R2 audit 替换后的完整最终函数；
2. `app_start_advisor_conversation_v3` 固定插入 Requirement version 1，和当前
   `createRequirementVersion` 按项目最大版本递增的行为冲突。

因此 R6 不能进入受控实施。R6 的新表、Helper 和新增业务 body 可以作为隔离验证
输入，但整体状态必须保持 `FAIL`。

本报告不修改 R6、R5、R4、源码、Schema、Migration、测试或配置；不执行 Prisma、
SQL、PostgreSQL、Migration、E2E、Browser、Build、Provider 或服务操作。

## 1. 审查对象与文件完整性

[R6 design](D:/thinkbook/Desktop/jieya/docs/product/app-workbench-r2-sales-handoff-invalidation-design-r6.md)

```text
Path:       docs/product/app-workbench-r2-sales-handoff-invalidation-design-r6.md
Bytes:      64559
Lines:      1681
SHA-256:    7254dd685fb751aaf454e102fa248052382eed787739c8e87cc88b2417f40b61
```

R6 self-excluding SHA-256:

```text
d94f2f8538056400684f264c67efa0c1e4cd4382690cd45632df48ff396a3a07
```

前置输入：

- R4 whole-file SHA-256 `630744cbfe92dd52a346779a3899bee37bd6e5e824a344fd9c018046a2daf75a`
- R5 whole-file SHA-256 `7936f40b12cd137bb772af8f03a83c416a9a5ac1504497cd663c5e7ecd3f3178`
- R6 independent review whole-file SHA-256 `a89eb257c862e65d5c3ff587f73f31111bbf5a4cdbd950d7aab6ea19741533b1`
- `prisma/schema.prisma`
- `packages/contracts/src/index.ts`
- Requirement/Advisor/Selection/Sales Route 与 service
- Web/Worker AuditLog 调用点
- `apps/web/src/modules/access/permissions.ts`

R4 的 whole-file SHA 与 R6 引用输入一致；R5 未被本审查修改。

## 2. Git 现场

审查开始时：

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            154
Untracked recursive files:    165
```

新增本报告前数字与任务输入一致。本报告只新增审查文件，未修改或读取
`$null`、`UNKNOWN'`、`apps/web/.next`、`apps/worker/dist` 内容。

## 3. R5 五项阻断关闭矩阵

| R5 阻断 | R6 位置 | 结论 |
|---|---|---|
| Claim 端到端 | R6 §6–§8、§13 | `PARTIAL`：Helper 和 R6 新函数有 body；R4 销售 wrapper 最终 body 缺失 |
| expectedVersion | R6 §9 | `CLOSED BY DESIGN / NOT IMPLEMENTED`：字段和 409 语义完整，当前 contract/Route 尚未修改 |
| AuditLog 与文件生命周期 | R6 §5、§10 | `CLOSED BY DESIGN`：R2 独立表，旧 AuditLog 保持原样；运行时未验证 |
| 旧函数签名/ACL | R6 §6.3、§11 | `PARTIAL`：清单和顺序完整；DROP/ACL 未执行，R4 最终 wrapper body 缺失 |
| Owner/Runtime | R6 §12 | `PARTIAL`：角色与 transfer 顺序完整；无实际 Catalog/所有权证据 |

`CLOSED BY DESIGN` 不是运行时 PASS。

## 4. 18 项函数 Registry 审查

### 4.1 数量与来源

R6 §4 registry 有 18 项：

- 4 个 R4 销售业务函数；
- 6 个 R6 新业务函数；
- 2 个 Claim helper；
- 2 个 canonical/audit helper；
- 1 个 resolver；
- 3 个 Actor/RBAC helper。

R4 whole-file SHA 与 R6 记录值一致，且 R4 source 行范围存在：

```text
368–477  app_resolve_current_completed_selection_v2
478–703  app_sales_create_handoff_v2
704–990  app_append_sales_followup_v2
991–1141 app_list_sales_handoffs_v2
1142–1261 app_get_sales_handoff_context_v2
```

### 4.2 P1-F1：R4 source 不是 R6 的最终完整 body

问题位置：R6 `R6:97-113`、`R6:502-528`。

R4 body 与 R6 契约不一致：

- R4 `app_sales_create_handoff_v2` 仍是旧签名和 `public.audit_log`；
- R4 `app_append_sales_followup_v2` 仍是 6 参数签名；
- R4 list/get 仍使用旧 HMAC 验证和旧 return 路径；
- R6 只在文字上要求增加 consume、projectId、R2 audit 和 receipt，没有给出最终
  `CREATE OR REPLACE FUNCTION ... AS $fn$` body。

失败机制：

```text
复制 R4 app_append body
-> 仍声明旧 6 参数
-> R6 ACL 声明新 7 参数
-> CREATE/GRANT/Catalog 签名不一致
```

影响：R6 的 18 项 registry 仍不是 18 份最终可编译 body；旧 HMAC-only 路径可能
保留，Claim 或 R2 audit 分支可能遗漏。必须在 R6 中给出 R4 create/append/list/get
经 wrapper 后的完整最终 body，而不是仅给源码行范围和文字替换要求。

### 4.3 P1-F2：Advisor start 固定插入 Requirement version 1

问题位置：R6 `R6:530-645`，具体写入 `R6:639-642`。

当前现场：

- `apps/web/src/modules/advisor/service.ts:43-51` 调用
  `createRequirementVersion`；
- `apps/web/src/modules/mvp/store.ts:274-279` 计算
  `COALESCE(MAX("version"), 0) + 1`。

R6 body 固定插入 `version=1`。项目已有 Requirement 时，这会违反当前
`UNIQUE(projectId, version)`，整个事务回滚。

触发场景：

```text
项目已有 Requirement version >= 1
-> 用户启动新的 AdvisorConversation
-> R6 app_start 插入 version 1
-> UNIQUE(projectId, version) 失败
```

必须修正：Project 锁内读取最大 version，使用 `max+1`；无需求时才使用 1，并把
实际 version 放入 receipt/response。

### 4.4 P2-F3：Registry section 分散

当前 body 顺序是 §6.1 Selection create、§6.2 disabled selection status、
§6.3 R4 incorporation、§6.4 Advisor start、§6.5 Advisor turn、§7 Claim、
§8 Requirement body。registry 可定位，但跨多个 section 容易拼错 body；应整理为
线性函数附录。

## 5. Claim 与事务安全

R6 继续使用 R5 的 Claim 表、transactionId、PENDING guards、deferred trigger 和
receipt。新增 body 的方向正确：

```text
canonical payload
-> consume
-> Project FOR UPDATE
-> RBAC/authority read
-> business write
-> r2_audit_event
-> finalize
```

R2 audit helper 还要求 Claim 仍为 PENDING，避免在业务事务外写入孤立事件。

### 5.1 P1-F4：R4 early return 未被完整 finalize/receipt 化

R6 `R6:502-528` 只描述 R4 body 的 wrapper 变化。R4 create/append/list/get 包含
多个 early return（INVALID_ARGUMENT、NOT_FOUND、FORBIDDEN、CLOSED、
LEGACY_UNBOUND、CONTEXT_STALE、CONTEXT_EXISTS、replay）。R6 没有展示这些 return
的最终统一版本。

失败场景：

```text
实施者只在正常成功路径调用 finalize
-> 某个 early return 直接 RETURN QUERY
-> Claim 保持 PENDING
-> deferred trigger 阻止 COMMIT
```

影响：无法证明所有业务拒绝路径 finalize，亦无法证明 R2 audit/Claim receipt 与业务
返回一致。该问题与 P1-F1 是同一根因。

未执行的 PostgreSQL 验证：

- 两连接同 Claim 消费；
- requestId 不同 payload；
- 业务异常和 savepoint；
- deferred trigger 在 COMMIT 边界；
- 40001/40P01 重试；
- R2 audit 与业务写入同事务；
- prepared transaction 影响。

均必须为 `NOT VERIFIED`。

## 6. expectedVersion 端到端

R6 §9 定义了 PATCH 的 `expectedVersion`，以及 Advisor 的
`expectedRequirementVersion` / `expectedLastMessageSequence`，并给出 409、
receipt、前端恢复和 E2E 方向。字段语义已区分，设计为 **CLOSED BY DESIGN**。

但当前代码仍是：

- `packages/contracts/src/index.ts:374-379` 无 PATCH expectedVersion；
- `packages/contracts/src/index.ts:370-372` Advisor message 只有 content；
- `apps/web/src/app/api/projects/[projectId]/requirements/route.ts:52-69` 仍先读
  current requirement 并调用旧写入；
- 相关 E2E 未执行。

所以当前状态是 `PARTIAL / NOT IMPLEMENTED`。R6 §9 不能证明运行时已一致，尤其
app_start 的固定 version 1 会破坏后续 expectedRequirementVersion 的合法基线。

## 7. R2 Audit Event 与文件生命周期

R6 §5 的独立表方向正确：project/actor/operation/request/claim/digest 绑定、
claim_hash 唯一、append-only Trigger、Web/Worker 无直接表写权限，R2 业务同事务写
event。R6 §10 明确旧 Web/Worker file/customer/project/catalog audit 调用继续使用
`public.audit_log`，因此不误伤文件生命周期。

剩余限制：

- Row Trigger 不覆盖 TRUNCATE；只有 ACL 和未来可能的 TRUNCATE guard 能保护整表；
- R6 没有实际 `has_table_privilege`、角色继承或 Worker/Web transaction 证据；
- R2 event 只 `NOT VERIFIED`，不能写成已安全启用。

## 8. 角色、Owner 与 ACL

R6 §12 定义了 `elevator_owner`、`elevator_migration`、Web/Worker runtime、
`elevator_sales_definer` 和旧 `elevator_app` 的分工及 ownership transfer 顺序。
方向正确，但没有实际 DDL、default ACL、membership、SET ROLE、旧连接排空和回滚
证据。因此只能是 `PARTIAL / NOT VERIFIABLE`。

关键缺口：

- 没有 `CREATE ROLE` / `ALTER ... OWNER` 的实际隔离 SQL；
- 没有逐对象 Schema/Table/Sequence/Function/Trigger/Schema default ACL 证据；
- 没有证明旧 `elevator_app` 不能重新连接；
- 没有证明 Web/Worker 不能 SET ROLE 到 Owner/Definer；
- 没有证明 failure rollback 不会重新开放旧权限。

## 9. Expand/Contract 与兼容窗口

R6 §13 的 Expand → body/contract → compatibility → owner/ACL → enable → cleanup
顺序正确，但 R6 body 未修好 P1-F1/P1-F2 前，Phase B 不能通过。Schema Expand 字段
目前不存在，R6 body 不能编译；旧函数 DROP 会影响仍调用旧实例的窗口没有实际
实例和 prepared transaction 证据。Contract 必须保持 BLOCKED。

## 10. 新发现问题与严重级别

### P0

无静态确认 P0。

### P1

| ID | 文件/行 | 问题 |
|---|---|---|
| P1-F1 | R6 97–113、502–528 | R4 销售最终 Claim/Audit wrapper body 缺失 |
| P1-F2 | R6 530–645，639–642 | app_start 固定 version 1，已有需求违反唯一约束 |
| P1-F4 | R6 502–528 | R4 early-return 未见统一 finalize/receipt |

### P2

| ID | 文件/行 | 问题 |
|---|---|---|
| P2-V1 | R6 1240–1338；current contracts | expectedVersion 仍只是设计 |
| P2-V2 | R6 530–645；current advisor service | app_start 版本语义与现场不一致 |
| P2-A1 | R6 187–205 | Row Trigger 不覆盖 TRUNCATE |
| P2-A2 | R6 1358–1377 | 共享 AuditLog 的文件生命周期权限无 Catalog/运行证据 |
| P2-R1 | R6 1526–1555 | ownership transfer 无逐对象 SQL/default ACL/回滚证据 |
| P2-F3 | R6 73–113、502–528 | Registry body 位置分散且部分跨文档 |

### P3

| ID | 问题 |
|---|---|
| P3-F4 | R6 section 编号顺序不连续，增加 body 错配概率 |
| P3-F5 | R6/当前 untracked count 需在下一轮重新固定 |

## 11. 可验证性分类

| 项 | 状态 |
|---|---|
| R6 文件/hash/行数 | PASS BY INSPECTION |
| R4 source 行范围和 SHA | PASS BY INSPECTION |
| R6 新函数 body 存在 | PASS BY INSPECTION |
| R4 wrapper 最终 body 完整 | FAIL |
| app_start Requirement version | FAIL |
| expectedVersion contract 设计 | PARTIAL / NOT IMPLEMENTED |
| R2 event 独立边界 | PARTIAL / NOT VERIFIED |
| Claim 并发/事务 | NOT VERIFIED |
| ownership transfer/Catalog | NOT VERIFIED |
| old function DROP/ACL | NOT VERIFIED |
| prepared transaction Contract | BLOCKED |
| E2E/Browser/Build | NOT EXECUTED |

## 12. 必须修复后才能进入受控实施

1. 给出 R4 create/append/list/get 经 Claim wrapper、projectId 和 R2 audit 替换后的
   完整最终函数 body，并覆盖所有 early-return 的 finalize/receipt 分支。
2. 修正 `app_start_advisor_conversation_v3`：Project 锁内使用
   `COALESCE(MAX(version),0)+1`，不得固定 version 1。
3. 完成 expectedVersion 的 contract/Route/前端/E2E 实现。
4. 完成 R4 Schema Expand 字段/FK/CHECK/Trigger 与隔离 PostgreSQL 编译。
5. 完成旧函数 DROP/ACL/Catalog 清理，确保没有 HMAC-only 旧路径。
6. 完成 Owner/Runtime、default ACL、membership 和 ownership transfer 的隔离
   Catalog 验证；真实环境仍需独立授权。

以上完成前保持 `FAIL — DESIGN CORRECTIONS REQUIRED`。

## 13. Git 与执行证据

审查开始时：

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            154
Untracked recursive files:    165
```

本报告新增后只增加审查文件；未执行 Prisma、SQL、PostgreSQL、Migration、E2E、
Browser、Build、Provider、服务或 Git 写操作。

新增本报告后的现场：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked entries:            155
Untracked recursive files:    166
```

静态检查：

```text
R6 code fences: balanced
R6 trailing whitespace: 0
R6 conflict markers: 0
R6 TODO placeholders: 0
git diff --check: exit 0，仅有既有 tracked 文件 LF/CRLF warnings
```

## 14. 报告 SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
8cfac558ca8c3cb85d4acab2456f0b35e4a04c8b3de5c5915216b7d077225d44

Bytes:                    13749
Physical lines:           376
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符，
对 UTF-8 文件字节计算 SHA-256。
