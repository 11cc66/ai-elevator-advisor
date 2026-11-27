# APP-WORKBENCH-R2 SalesHandoff Design Independent Re-Review R2

## 0. 最终结论

```text
FAIL — CORRECTIONS REQUIRED
```

设计报告完整性通过：文件大小、物理行数和 SHA-256 均与任务给定值一致。
但 R2 设计仍未满足“所有当前需求/方案写入必须在读取业务状态前取得 Project 锁”
和“无法证明旧数据库客户端全部退出时不得删除旧唯一约束”两个 P1 条件，因此不能
批准进入完整实施。

本报告只读。未修改被审设计、源码、Schema、Migration、测试或配置；未执行
Prisma、SQL、PostgreSQL、E2E、Browser、Build、Provider 或服务操作。

## 1. 审查范围与证据边界

### 1.1 审查输入

被审设计：

```text
docs/product/app-workbench-r2-sales-handoff-invalidation-design-r2.md
```

任务给定 SHA-256：

```text
d70ef26773d24c1cc96eea823b1bbd550d316dba87e34dc3d8874fedb7f41c2c
```

上一轮独立审查路径：

```text
docs/product/app-workbench-r2-sales-handoff-design-independent-review-r1.md
```

该文件在当前工作区不存在。本报告只能使用任务已提供的上一轮审查结论和当前现场
源码进行复核，不能声称已重新读取上一轮审查原文。

### 1.2 本报告的判定口径

- 静态代码事实与实际数据库 Migration 文件可用于确认当前实现。
- 设计中的 Prisma 表达式、PostgreSQL 行为、Trigger 行为和并发结果，在没有工具
  或数据库执行证据时保持 `NOT VERIFIED`。
- 一个设计若仍依赖未定义的人工操作来避免 P1 数据完整性窗口，即使计划中写了
  “验证”或“测试”，也不能视为设计完整。

## 2. Git 与设计报告完整性

| 项目 | 现场结果 | 状态 |
|---|---|---|
| Branch | `codex/public-github-sync` | PASS |
| HEAD | `101e8a362e430f4fa7b31b67c56823cb702eb1e6` | PASS |
| Local origin/main | `101e8a362e430f4fa7b31b67c56823cb702eb1e6` | PASS |
| Tracked modified | 48 | PASS WITH WARNING |
| Staged | 0 | PASS |
| Deleted | 0 | PASS |
| Untracked entries | 146 | PASS WITH WARNING |
| Untracked recursive files | 157 | PASS WITH WARNING |
| R2 设计存在 | 是 | PASS |
| R2 设计字节数 | 48158 | PASS |
| R2 设计物理行数 | 1120 | PASS |
| R2 设计 SHA-256 | `d70ef26773d24c1cc96eea823b1bbd550d316dba87e34dc3d8874fedb7f41c2c` | PASS |
| 上一轮审查原文 | 不存在 | NOT VERIFIED |

工作区不是干净基线。大量 tracked/untracked 文件属于既有用户工作；本报告没有把
整个工作区归因于 R2 设计或本轮审查。

## 3. 实际检查文件与调用点

### 3.1 设计、规范与状态文档

```text
docs/product/app-workbench-r2-sales-handoff-invalidation-design-r2.md
AGENTS.md
.agents/skills/prisma-db-safety/SKILL.md
.agents/skills/prisma-db-safety/references/database-change-review.md
.agents/skills/security-audit/SKILL.md
.agents/skills/security-audit/references/adversarial-review.md
.agents/skills/testing-and-verification/SKILL.md
.agents/skills/testing-and-verification/references/verification-matrix.md
README.md
D03 / D04 / D05 / D08 / D09 / D11
docs/PHASE2_IMPLEMENTATION.md
docs/PHASE3_0_TEST_ENVIRONMENT.md
docs/PHASE3_4_FILE_PROCESSING.md
docs/PHASE3_5_PROCESSING_RELIABILITY.md
docs/PHASE3_7_BATCH1_SECURITY.md
docs/architecture/file-lifecycle-p13-design-freeze.md
docs/architecture/file-lifecycle-p13-implementation-status.md
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
```

### 3.2 Schema、Migration、业务和授权代码

```text
prisma/schema.prisma
prisma/migrations/20261123130000_full_mvp_domain/migration.sql
apps/web/src/modules/mvp/store.ts
apps/web/src/modules/selection/service.ts
apps/web/src/modules/advisor/service.ts
apps/web/src/modules/workbench/selection-consistency.ts
apps/web/src/modules/workbench/presentation.ts
apps/web/src/modules/workbench/visibility.ts
apps/web/src/modules/access/permissions.ts
apps/web/src/modules/access/policy.ts
apps/web/src/app/api/projects/[projectId]/requirements/route.ts
apps/web/src/app/api/projects/[projectId]/requirements/confirm/route.ts
apps/web/src/app/api/projects/[projectId]/selection-runs/route.ts
apps/web/src/app/api/projects/[projectId]/sales-handoff/route.ts
apps/web/src/app/api/admin/sales/route.ts
apps/web/src/app/api/admin/sales/[handoffId]/notes/route.ts
apps/web/src/app/admin/sales/page.tsx
apps/web/src/app/admin/sales/follow-up-form.tsx
apps/web/src/app/admin/projects/[projectId]/page.tsx
apps/web/src/app/projects/[projectId]/page.tsx
packages/contracts/src/index.ts
```

### 3.3 测试

```text
apps/web/tests/selection-consistency.test.ts
apps/web/tests/workbench-presentation.test.ts
apps/web/tests/workbench-visibility.test.ts
apps/web/tests/e2e/mvp-catalog-sales.spec.ts
```

搜索范围包括 `apps/web/src`、`apps/worker/src`、`packages`、应用脚本和测试，
排除了 `.next` 与 `dist`。当前销售/选型相关源码写入入口集中在
`apps/web/src/modules/mvp/store.ts`；Worker 未发现销售或选型写入。

## 4. 审查结论矩阵

| 审查项 | 结论 | 说明 |
|---|---|---|
| 报告完整性与 SHA | PASS | 与任务给定摘要完全一致 |
| Expand 阶段基础兼容性 | PASS | nullable 列、unique、FK、CHECK 的 additive 方向合理 |
| Contract 前置排空门禁 | FAIL | 仅靠某一时刻的 `pg_stat_activity` 不能证明旧客户端不会重连 |
| 所有需求写入的 Project 锁协议 | FAIL | PATCH/顾问路径在锁外读取并合并旧需求 |
| SelectionRun 与 Requirement 同项目数据库不变量 | FAIL | unique 不是复合 FK，未保证三者来源一致 |
| Prisma 与现有 PostgreSQL action 一致性 | FAIL | Schema 片段使用 Restrict，现有 Migration 多个为 Cascade，且未列入变更 |
| SalesHandoff nullable 绑定防部分 NULL | PASS | `num_nonnulls(...) IN (0,5)` 与两条复合 FK 设计方向正确 |
| LEGACY_UNBOUND 普通 DML 只读 | PASS WITH WARNING | 行为设计合理，但尚未实现；Owner bypass 已披露 |
| CLOSED 不可逆 | PARTIAL | 设计意图正确，但 Trigger 精确字段/`updatedAt` 条件未给出可执行定义 |
| Project 锁顺序 | PARTIAL | 新设计覆盖三个入口，但遗漏需求 PATCH/顾问锁外读取，notes 项目的取得方式也未定义完整 |
| 事务错误重试 | PARTIAL | SQLSTATE 分类方向正确；客户端响应丢失后的 note 幂等未解决 |
| 双连接并发证据 | PASS WITH WARNING | 具备 A/B/Observer 与锁证据框架，但尚无执行证据 |
| 旧 handoff 不推进销售 | PARTIAL | 目标明确，E2E 尚未明确证明 handoff 绑定字段和 API 拒绝 |
| 权限与项目范围 | PARTIAL | Route 有权限检查，但项目范围销售列表仍先读取全量数据再过滤 |
| 历史/CLOSED/同 context 语义 | PARTIAL | 历史与 CLOSED 方向正确；请求幂等和部分边界仍需补齐 |
| 授权边界 | PASS | 本轮未发现修改源码、Schema、Migration 或测试 |

## 5. P1 问题

### P1-1 — 需求 PATCH/顾问写入仍在 Project 锁外读取并合并，Project 锁不能防止丢失更新

被审设计规定“写入事务的第一条业务读取前锁 Project”，并把
`createRequirementVersion()` 标为已有路径，见设计第 874、884-886 行。

现场实际调用链不是该协议：

```text
apps/web/src/app/api/projects/[projectId]/requirements/route.ts:48
  getLatestRequirement(projectId)
-> route.ts:53-65
  在事务外合并 fields、重新计算 missingFields
-> route.ts:68
  createRequirementVersion({ fields, missingFields })
  未传 expectedVersion
-> store.ts:249-279
  新事务才锁 Project，再计算 MAX(version)+1
-> store.ts:281
  插入新版本
```

`createRequirementVersion()` 的 Project 锁只保证版本号串行分配，不保证锁内读取到
的“当前需求”与路由在锁外用过的基准版本相同。因为 PATCH 没有传
`expectedVersion`，函数无法检测锁外快照已过期。

静态反例：

| 时点 | 事务 A / PATCH 楼层 | 事务 B / PATCH 预算 |
|---|---|---|
| T1 | 读取最新需求 R1 | 读取最新需求 R1 |
| T2 | 在锁外合并 `{floorCount: 9}` | 在锁外合并 `{budgetMax: 600000}` |
| T3 | 锁 Project，创建 R2，内容基于 R1 + 楼层 | 等待 |
| T4 | 提交 | 获得 Project 锁，仍基于 R1 创建 R3 |
| T5 | R3 成为最新需求 | 楼层 A 的修改被 R3 覆盖 |

这不是数据库竞争造成的假失败，而是已经丢失业务更新的确定性设计缺口。新需求和
旧 SelectionRun/handoff 的判断会基于被覆盖后的 R3，因此该缺口会穿透到本轮的
“current requirement + current selection”目标。

顾问消息路径也有同类模式：

```text
advisor/service.ts:82  getLatestRequirement()
advisor/service.ts:88  appendMessage()
advisor/service.ts:115 createRequirementVersion()
```

两个并发消息可以在锁外共享旧需求快照，并串行写入两个新版本；后写版本可能覆盖
先写版本中的字段变化。`appendMessage()` 的会话锁不能替代 Project 锁，也不覆盖
从读取需求到创建新版本的整个区间。

必须修正：

1. PATCH 必须在新应用服务中把“锁 Project、读取最新需求、合并 patch、重算缺失项、
   创建新版本/修订”放进同一个 ReadCommitted 事务。
2. 客户端提交必须携带 `expectedVersion`，锁内再次比较；不一致返回 409，不得把
   旧快照结果写成新版本。
3. 顾问消息若要更新需求，服务端也必须在 Project 锁内重读当前需求并合并；不能
   使用消息开始前的快照直接写入。
4. 该服务必须复用同一 Project→child 锁顺序和同一重试包装。
5. 必须增加两个独立连接的真实并发测试，证明后到请求得到版本冲突，而不是覆盖。

当前设计的 R2-CC-02/03 只覆盖“创建新需求与推进 handoff”，没有覆盖两个需求 PATCH
或两个顾问消息的丢失更新，因此不能证明锁协议完整。

### P1-2 — Contract 前置“旧客户端已退出”没有可靠证明，旧 notes API 仍可在 Contract 后按 handoff ID 写入绑定记录

设计在第 417、427、519-532、602 行要求停止旧实例并观察
`pg_stat_activity`，但只要求在某一时刻看不到会话；没有定义不可重连的证明或
数据库级隔离。当前状态文档明确给出：

```text
file-lifecycle-p13-implementation-status.md:126  Production Deployment Evidence = NOT PROVIDED
file-lifecycle-p13-implementation-status.md:273  Production Runtime Inventory = UNKNOWN
file-lifecycle-p13-implementation-status.md:274  Legacy Worker Actual Instances = UNKNOWN
file-lifecycle-p13-implementation-status.md:275  Legacy Scheduler Actual Instances = UNKNOWN
file-lifecycle-p13-implementation-status.md:276  Legacy Auto Restart = UNKNOWN
file-lifecycle-p13-implementation-status.md:278  Legacy Drain Execution = NOT EXECUTED
```

因此当前项目现场没有满足设计第 602 行的 Contract 前置证据，也没有一个已验证的
机制能够阻止旧进程、任务计划器或外部脚本在 Contract 的瞬时观察之后重连。

关键旧入口不是只读查询：

```text
apps/web/src/app/api/admin/sales/[handoffId]/notes/route.ts:25
  getSalesHandoffProjectId(handoffId)
-> route.ts:39
  addSalesFollowUp(...)
-> store.ts:1114
  UPDATE sales_handoff
-> store.ts:1123
  INSERT sales_follow_up_note
```

Contract 后：

- 旧 `ON CONFLICT(projectId)` 创建路径会因旧 unique 被删除而失败，这是预期阻断。
- 旧 `findUnique(projectId)` 可能失败，但旧 notes API 不依赖该唯一约束，仍可按
  handoff ID 更新一张 bound handoff。
- 设计把“当前上下文”判断放在 API/store，Trigger 只检查合法绑定、not NULL 和
  non-CLOSED；它不拒绝一个旧 API 对当前 bound handoff 的状态推进，也不要求旧
  API 先取得 Project 锁。
- 旧 Admin Sales 列表可继续读取项目并生成表单；如果它收到当前 handoff ID，仍可
  对 non-CLOSED 的绑定记录写入。

时间线反例：

| 时点 | 状态 | 风险 |
|---|---|---|
| T0 | 旧 Web 和旧 Worker 写入正常 | 旧路径仍使用 projectId-only upsert |
| T1 | Expand 完成，旧 Web 仍在运行 | 新列不存在问题，旧代码可继续生成 NULL handoff |
| T2 | 维护窗口观察一次 `pg_stat_activity`，没有活动会话 | 观察本身不能证明没有未启动的旧实例或可重启任务 |
| T3 | Contract 删除旧 unique、启用 Trigger | 未来重连的旧实例不再满足旧创建路径，但 notes-by-ID 仍可能执行 |
| T4 | 新版本部署，解冻写入 | 旧进程若在此后重连，可绕过新 Project 锁和 context evaluator 的 API 规则 |
| T5 | 旧 notes API 更新 bound non-CLOSED handoff | 新 DB Trigger 只做绑定/CLOSED 守卫，不证明当前需求仍有效 |

这不是“测试未执行”的问题，而是 Contract 的可实施前置条件在当前设计中不成立：
它把无法证明的部署事实当作运行操作步骤，却没有设计硬门禁。

必须修正：

1. Contract 前要求完整的部署身份与实例证据：所有 Web/Worker/Scheduler/一次性
   任务/自动重启/负载均衡入口均已列出并停止，不能只看一次活动会话。
2. 在 Contract 完成前保持入站和数据库连接不可重试；若无法证明，禁止删除旧
   unique 和启用会改变旧写入语义的 Trigger，状态必须为 BLOCKED。
3. 采用数据库角色隔离：新代码使用新角色，旧角色在 Contract 窗口被撤销/断开；
   或提供一个独立的、仅由新服务可获得的数据库 capability 来阻止旧 notes 路径。
4. 若保留旧角色，数据库中必须对所有 bound handoff 的 status/note 写入验证当前
   上下文，而不是只在 API 层验证；否则必须明确生产级别不具备该保护。
5. 把旧实例/任务器/重连失败的证据和 backend PID 采集纳入 Contract 硬前置，
   不能仅把 `pg_stat_activity` 作为唯一证据。

## 6. 实际迁移时序重建

以下基于设计阶段和现有源码的静态推理；没有执行 Migration。

| 窗口 | 数据库 | 应用版本 | 旧代码能否创建 NULL handoff | 旧代码能否更新 legacy | `ON CONFLICT(projectId)` | `findUnique(projectId)` | 恢复方向 |
|---|---|---|---|---|---|---|---|
| W0 当前 | 旧 unique | 旧版本 | 能 | 能 | 可 | 可 | 回旧版本 |
| W1 Expand | 新列/unique/FK/CHECK，旧 unique 保留 | 旧版本或兼容只读 | 能 | 能 | 仍可指向旧 unique | 仍可 | 回旧版本，保留 Expand |
| W2 兼容版本 | 同 W1 | 兼容读取/受控旧写 | 能，若仍允许旧写 | 能，若旧 API 未停 | 仍可 | 仍可 | 回旧版本 |
| W3 维护冻结 | 同 W1，业务写入冻结 | 旧实例应停止 | 不应有 | 不应有 | 仍具备结构，但无业务请求 | 结构仍满足 | 恢复旧实例 |
| W4 Contract | 删除旧 unique，启用 Trigger | 无应用写入 | 由 INSERT Trigger 拒绝新 NULL | Trigger 拒绝 legacy 修改 | 旧 SQL 可能因无匹配 unique 失败 | 依赖旧 unique 的 Prisma 调用可能失败 | DDL transaction 回滚 |
| W5 新版本启动 | Contract 状态 | 上下文完整新版本 | 不能 | 不能 | 新代码不再使用 | 新代码不再使用 | forward-fix；回旧版本需恢复 snapshot |
| W6 解冻 | Contract 状态 | 新版本 | 不能 | 不能 | 旧实例若重连可能失败 | 旧实例若重连可能失败 | 必须继续阻断旧实例 |

窗口 W4-W6 的风险不在唯一索引本身，而在“旧实例是否还会出现”。只要 W3 的实例/
任务器证据不可靠，W4 就不是可安全执行的 Contract。

数据库已经进入 W4 后，旧应用版本不能再被当作可安全回滚版本：它依赖的
`sales_handoff_projectId_key` 和旧 Prisma uniqueness 已消失。设计已在第 440 行
承认此边界，但仍应把它写成不可逆部署门禁并绑定到可验证的 forward-fix 责任。

## 7. Prisma 与 PostgreSQL 约束精确核查

### 7.1 关系逐项结果

| 对象 | Prisma 设计 | PostgreSQL 设计 | 结论 |
|---|---|---|---|
| BuildingRequirement → Project | `fields:[projectId]` → `Project.id` | 现有 FK `building_requirement_projectId_fkey` | PASS for relation existence；现有 `ON UPDATE CASCADE` 与设计片段 `Restrict` 不一致 |
| SelectionRun → Project | `fields:[projectId]` → `Project.id` | 现有 FK `selection_run_projectId_fkey` | PASS for relation existence；action 不一致 |
| SelectionRun → BuildingRequirement | 现有 `fields:[requirementId]` → `BuildingRequirement.id` | 现有 FK `selection_run_requirementId_fkey` | PARTIAL：只保证 requirement 存在，不保证同一 project |
| SalesHandoff → Project | `fields:[projectId]` → `Project.id` | 现有 FK `sales_handoff_projectId_fkey` | PARTIAL：action 不一致 |
| SalesHandoff → BuildingRequirement | 5-field nullable design 中的 `(boundRequirementId, requirementProjectId)` | 计划复合 FK to `(id, projectId)` | PASS by design；未验证 Prisma/DB 一致 |
| SalesHandoff → SelectionRun | `(boundSelectionRunId, selectionRunProjectId, selectionRunRequirementId)` | 计划复合 FK to `(id, projectId, requirementId)` | PASS at handoff boundary；未验证 Prisma/DB |
| SalesFollowUpNote → SalesHandoff | `handoffId` only | 现有 FK，计划 note trigger | PARTIAL：note 的当前 context 只能由 API 重新校验 |

`num_nonnulls(...) IN (0,5)` 能阻止五个绑定字段的部分 NULL；`CHECK` 第二条再把
project/run/requirement 的引用列为同一项目。方向正确。

### P2-1 — SelectionRun 复合唯一键不等于同项目复合外键

设计第 893-894 行称 SelectionRun 的复合唯一键/FK 目标是“数据库最终防线”。实际
设计只在 `selection_run` 上增加：

```text
unique (id, projectId, requirementId)
```

而没有增加：

```text
FOREIGN KEY (projectId, requirementId)
REFERENCES building_requirement (projectId, id)
```

或等价的目标约束。现有两个单列 FK 分别保证 Project 存在、Requirement 存在，却不
保证 `selection_run.projectId` 与 `building_requirement.projectId` 相同。因此
数据库仍允许一条跨项目 SelectionRun；它不能形成有效 Handoff binding，因为
Handoff 的复合 FK/CHECK 会拦住，但“SelectionRun 三者一致”的设计不变量本身仍未
由数据库保证。

必须修正：

- 增加 SelectionRun 到 BuildingRequirement 的复合 FK，或在 SelectionRun 增加
  `requirementProjectId` + CHECK + composite relation；
- 对现有 SelectionRun 做只读数据核查；任何跨项目行必须停止迁移，不得猜测、
  批量改写或删除；
- 明确 Prisma relation、数据库 constraint、Migration SQL 三者一一对应。

静态结论：`PARTIAL`，未达到用户要求的精确一致性。

### P2-2 — Prisma `onUpdate` 与现有 Migration 不一致

现有 `20261123130000_full_mvp_domain/migration.sql` 对以下 FK 使用
`ON UPDATE CASCADE`：

```text
building_requirement_projectId_fkey
selection_run_projectId_fkey
selection_run_requirementId_fkey
sales_handoff_projectId_fkey
sales_handoff_createdById_fkey
```

R2 Schema 片段却把相关关系写为 `onUpdate: Restrict`，例如设计第 195、210-211、
245、265 行。设计第 281-309 行只列出新增复合 FK，没有列出把这些旧 FK 从
Cascade 改为 Restrict 的 DDL，也没有说明是否要改现有 action。

因此：

- Prisma Schema 与现有数据库 action 不一定等价；
- `prisma migrate diff` 可能生成未在设计阶段审查的 FK drop/recreate；
- 复合 relation 与旧单列 relation 的 update 语义之间可能出现冲突；
- “不修改历史 Migration”不等于“最终 Schema 与数据库无差异”。

必须选择其一并写清楚：

1. 保留现有 `ON UPDATE CASCADE`，Schema 片段改为 Cascade；或
2. 明确增加 forward FK alteration，包含锁、验证、回滚和 postcheck；
3. 若禁止 project/user ID 更新，必须在应用和数据库中同时证明，不可仅靠 Prisma
   片段。

本项是 P2 设计缺陷，因为它是对象定义和迁移生成的直接不一致，不是未来工具
行为猜测。

### 7.2 `CLOSED`、NULL 和级联

- `LEGACY_UNBOUND` 是读取模型分类还是持久化 enum，报告已明确是前者；这可以
  防止伪造历史绑定。
- 新 NULL INSERT 由 Trigger 拒绝；旧 unique 在 Contract 前保留；方向正确。
- 五个绑定字段的部分 NULL 由 CHECK 拒绝；方向正确。
- 新复合 FK 都使用 `ON DELETE RESTRICT`，并有 CHECK；历史链不会被级联删除；
  方向正确。
- 但 Trigger 的完整定义尚未提供，不能仅凭设计文字证明 DELETE、TRUNCATE、
  `session_replication_role`、Owner 禁用 Trigger 的行为。
- 当前 `elevator_app` 仍是 Owner，设计已披露 Owner bypass；因此“数据库级只读”
  仍不是已验证结论。

## 8. 四个 Trigger 的对抗性审查

| Trigger | 设计覆盖 | 审查结果 | 证据/缺口 |
|---|---|---|---|
| `sales_handoff_context_insert_guard` | BEFORE INSERT；五字段全非 NULL、run COMPLETED | PARTIAL | 设计未给出完整 PL/pgSQL、`search_path`、函数 owner、权限；无法证明直接 INSERT 和 Prisma-generated SQL 的行为 |
| `sales_handoff_immutable_guard` | BEFORE UPDATE OR DELETE；身份/绑定不可变、legacy/CLOSED 拒绝修改 | PARTIAL | 文字未明确 `updatedAt`、`assignedToId`、空值变换和无变化更新；不能证明 CLOSED 重复请求绝不改任何字段 |
| `sales_follow_up_note_context_guard` | BEFORE INSERT；锁 parent、拒绝全 NULL/部分绑定/CLOSED | PARTIAL | API 仍必须重新证明当前 context；直接 SQL 可对 non-CLOSED historical bound handoff 插入 note（应用层之外的保护不足） |
| `sales_follow_up_note_append_only` | BEFORE UPDATE OR DELETE；全部拒绝 | PASS by design | 但没有真实 Trigger 定义/测试，仍是 `NOT VERIFIED` |

### 8.1 直接数据库写入结论

- LEGACY_UNBOUND UPDATE（status、summary、budget、assignedTo）由设计拒绝。
- LEGACY_UNBOUND 转 bound 的普通 UPDATE 由设计拒绝。
- LEGACY_UNBOUND note INSERT 由设计拒绝。
- LEGACY/CLOSED note UPDATE/DELETE 由设计拒绝。
- LEGACY/CLOSED handoff DELETE 由设计返回 `42501`。
- 普通应用若能在数据库中执行 DDL/禁用 Trigger，仍可绕过；设计已披露。
- `TRUNCATE` 不在 Row-Level Trigger 的保护范围内；设计已披露，但仍意味着当前
  不能声称整表只读。
- CLOSED 的“状态不可逆”方向正确，但设计文字没有明确 `updatedAt` 是否允许变化。
  这与第 623-624 行“重复请求不更新 updatedAt 或业务内容”的语义可能冲突。
- 数据库 Trigger 无法证明“绑定的 context 仍是当前”；这是已被设计承认的应用层
  责任。只有在旧客户端已可靠排空或数据库 capability 阻止旧写入时，才可接受。

### 8.2 Trigger 结论

Trigger 方向可作为后续隔离实现草案，但在本阶段不能把“四个 Trigger 已完整设计”
写成 PASS。必须有可审查的完整 SQL 定义、函数 owner/ACL、search_path、
`BEFORE/AFTER`、`FOR EACH ROW`、异常码、事务行为和 OLD/NEW 逻辑。

## 9. Project 行锁与并发协议

### 9.1 当前写入入口重建

| 入口 | 当前事实 | R2 设计要求 | 结论 |
|---|---|---|---|
| `createRequirementVersion` | 事务内 `Project FOR UPDATE`，随后版本号分配 | 继续使用 Project 锁 | FAIL for merge semantics：调用者在锁外构造 fields |
| `PATCH /requirements` | 第 48 行锁外读最新需求，第 53-65 行合并，第 68 行创建 | 报告未要求重构该入口 | FAIL：可丢失更新 |
| `confirm /requirements` | 读取外，但把 expectedVersion 传入并在锁内重检 | 现有路径可保守重试 | PASS with caveat |
| Advisor message | 第 82 行锁外读，88/115 分步写 | 报告未要求锁内重读/合并 | FAIL/PARTIAL：并发消息丢失更新风险 |
| `createSelectionRun` | 第 817 行无 Project 锁；第 819 行直接 INSERT | 新增 Project 锁和 requirement 归属检查 | PARTIAL：设计方向对，尚未实现 |
| `createSalesHandoff` | 第 1002 行无事务，第 1017 行 projectId upsert | 锁 Project、exact context、CLOSED 分支 | PARTIAL：设计方向对，尚未实现 |
| `addSalesFollowUp` | 第 1112 行仅有普通事务，无 Project 锁/当前 context/绑定检查 | 锁 Project、重新解析、精确绑定、note/status/audit 同事务 | PARTIAL：设计方向对，尚未实现 |
| Worker/后台销售写入 | 搜索未发现销售/选型写入 | 需继续纳入未来扫描 | PASS for current static search |

### 9.2 锁顺序

设计声明的顺序：

```text
Project -> Requirement / SelectionRun / SalesHandoff
```

该顺序本身合理。但当前问题不是“顺序写错了”，而是多个入口的业务读取发生在锁
之前，或者根本不取得 Project 锁。只把 `createRequirementVersion()` 标为已有锁，
并不能覆盖它的调用者。

### 9.3 notes-by-ID 的 Project 锁取得缺口

设计第 786-810 行使用 `POST /api/admin/sales/:handoffId/notes`，但第 794 行又写
“handoff.projectId 必须等于路径项目”；该 URL 没有 projectId。当前实现先通过
`getSalesHandoffProjectId()` 在事务外按 handoff ID 查项目，之后才调用写入服务。

这不一定造成已确认的越权，因为 route 会做项目范围权限检查；但它意味着：

- “第一条业务读取前锁 Project”没有完整路径；
- 旧客户端可以用同一个 by-ID 查询路径尝试写入；
- 必须明确将事务外 projectId 仅作为路由提示，事务内重新读取并确认 handoff
  projectId，再对同一 Project 锁。

该点应修正为两阶段：

```text
先在事务外只做不可信项目定位 -> 启动事务并锁该项目 ->
事务内按 handoff ID 重读 handoff + binding -> 验证 projectId 相同 -> 执行上下文校验
```

并加入 handoff 不存在、项目迁移/异常、并发删除的测试。

## 10. 重试、响应丢失和副作用

设计已有整事务重试的方向：

```text
40001, 40P01, P2034
最多 3 次
重试重新锁 Project 和重读 latest requirement/runs
403/404/409 不重试
事务内禁止外部副作用
```

这部分在事务失败回滚层面是 PASS by design。仍有以下缺口：

### P2-3 — note/status 没有请求幂等键

`packages/contracts/src/index.ts:506-514` 的 follow-up schema 只有 status、
contactStatus、note，没有 request/idempotency key。当前
`apps/web/src/modules/mvp/store.ts:1123-1127` 每次使用新的 `randomUUID()` 插入
note。R2 设计也没有新增唯一键或请求指纹。

因此数据库事务因 `40001/40P01` 回滚时不会重复写入，但以下更真实的窗口仍会：

```text
COMMIT 成功
-> HTTP 响应丢失
-> 客户端/浏览器重发同一 POST
-> 新的随机 note ID
-> 第二条 note + 第二次 status/audit 写入
```

必须修正：

1. notes API 接受 `Idempotency-Key` 或服务端生成 requestKey；
2. note 表增加 `(handoffId, authorUserId, requestKey)` 唯一约束；
3. 重试先读取已有 note 并返回相同结果；
4. 在 status/note/audit 同一事务内验证 requestKey；
5. 对已 CLOSED、历史、legacy 和当前 context 分别测试重复请求。

只做前端 disable 或进程内 Set 不能解决响应丢失和跨实例重试。

### P2-4 — handoff create 的“幂等”只保证 identity，不保证内容无变化

R2 第 623-625 行明确只规定 CLOSED exact context 的重复请求不改内容；对于
non-CLOSED exact context，设计允许按现有规则更新 summary/budget，但未定义
request fingerprint、版本冲突或“相同请求”判定。相同 URL/body 的重放可能更新
`updatedAt`，不同内容的重放可能最后写入。需要在实施前明确这是“幂等 identity +
业务 upsert”，还是完整 HTTP 幂等。

## 11. 双连接并发测试设计

设计中的 A/B/Observer、backend PID、`pg_stat_activity`、`pg_locks`、barrier、
SQLSTATE、commit/rollback 和最终 count 的方向是正确的。

### 11.1 已覆盖

- 同一 exact context 创建竞争；
- 新需求/旧 handoff 状态竞争；
- SelectionRun/handoff 竞争；
- 两个不同 context；
- note 与 CLOSED；
- 40001/40P01/P2034；
- 重试耗尽；
- 外部副作用位置；
- RR reader 与 ReadCommitted writer；
- 跨项目 tuple；
- legacy/CLOSED 直接 DML。

### 11.2 证据缺口

- 没有实际执行任何双连接测试；所有结果仍是 `NOT VERIFIED`。
- R2-CC-02 的 B 分支“B 先提交，A 后创建 R2，H1 从此 historical”是业务语义，
  但不能代替对 H1 `boundRequirementId/boundSelectionRunId` 的实体断言。
- R2-CC-08 只证明事务内部重试不重复；没有测试 COMMIT 成功后响应丢失再发 note。
- 没有测试两个并发 requirement PATCH 的丢失更新，因此 P1-1 不会被现有矩阵发现。
- 没有测试旧 note API 在 Contract 后重连并更新 bound non-CLOSED handoff。
- 没有给出 observer 的权限、可见 PID 范围或应用连接名基线；如果 observer 无法
  看到等待者，测试可能被错误报告为“无竞争”。

## 12. 销售、历史与权限语义

### 12.1 已确认正确的方向

- 只有 `COMPLETED` 的当前 run 可成为可操作方案；`NO_VALID_MATCH` 不可推进。
- latest requirement 使用 `version DESC LIMIT 1`，现有 `(projectId, version)`
  unique 提供确定性依据。
- `resolveCurrentSelectionRun()` 不依赖数组顺序，最新时间并列/无效时间保守失败。
- legacy 全 NULL 不自动补绑，不伪造历史。
- CLOSED 不重开，关闭后 note 只读，方向正确。
- 不同 exact context 可保留独立历史。
- 当前页面只有 `SALES_MANAGE` 才加载销售摘要，当前 `loadVisibleWorkbenchSalesHandoff`
  在无权限时不执行 loader。

### P2-5 — 项目范围销售列表先全量读取再过滤

设计第 779、831 行要求授权检查先于销售数据读取，但当前实现：

```text
apps/web/src/app/api/admin/sales/route.ts:25-31
listSalesHandoffs() -> filter after query

apps/web/src/app/admin/sales/page.tsx:33-40
listSalesHandoffs() -> filter after query
```

对项目范围的 `SALES_MANAGE` 用户，代码先把其他项目的 handoff、summary、budget、
notes、requirement、selection result 读入进程，再过滤响应/页面。当前最终 payload
看似没有越权，但这不满足“未授权查询不执行”和最小权限读取目标，也让序列化回归
风险更高。

修正：

- API/page 传入唯一允许的 `projectIds`，SQL 在数据库层 `WHERE projectId = ANY`；
- 全局销售权限才能使用无 project filter 的查询；
- 对 loader 加单元测试，证明无权限/项目范围不调用全量查询；
- notes/RSC 只能拿到已授权上下文。

### P2-6 — E2E 需要验证 handoff 关系本身，而非仅提示和当前 run

当前 E2E 的 stale 场景在
`apps/web/tests/e2e/mvp-catalog-sales.spec.ts:288-395` 中检查了新需求、
`selectionRun=null` 和页面销售 API 数据；它没有明确检查：

- 旧 SalesHandoff 是否存在且绑定的 requirementId/selectionRunId 是旧值；
- 旧 handoff 的 `actionable` 状态；
- 旧 notes 数量/status 是否在拒绝后保持不变；
- 旧 handoff API 是否返回 409 而不是 500/200；
- 新有效方案生成后旧 handoff 仍未恢复。

R2 设计第 972-981 行列出了目标，但还没有把“实体关系断言”写成具体测试步骤。
应至少断言数据库/API 返回的 `boundRequirementId`、`boundSelectionRunId` 和
`contextState`，并用 status/note count 的 before/after 证明没有推进。

## 13. 回归与授权边界

本轮只读，未发现被审设计修改源码、Schema、Migration、测试或配置。报告中明确
声明未执行验证，这一点是 PASS。

但若按当前设计实施，会触及：

- Prisma Schema；
- forward Migration；
- API Route 行为/contracts；
- 数据库 Trigger/Function；
- sales 查询和 UI context state；
- 单元/集成/E2E 测试。

因此不能把当前 `DESIGN READY` 解释为“已获实施授权”或“已验证”。

## 14. 问题分级汇总

### P0

无静态确认的 P0。

### P1

| ID | 问题 | 结论 |
|---|---|---|
| P1-1 | requirement PATCH/顾问锁外读取并合并，Project 锁内追加版本造成确定性的丢失更新窗口 | 必须修正后重新审查 |
| P1-2 | Contract 依赖不可证明的旧客户端排空；旧 notes-by-ID 路径可在 bound non-CLOSED 记录上继续写入 | 必须增加硬门禁/角色隔离后重新审查 |

### P2

| ID | 问题 | 结论 |
|---|---|---|
| P2-1 | SelectionRun 复合唯一键没有提供同项目 requirement 的数据库外键不变量 | 设计需补复合 FK/字段及历史数据检查 |
| P2-2 | Prisma relation action 与现有 Migration action 不一致，且没有对应 forward DDL | Schema/Migration 必须对齐 |
| P2-3 | note/status 写入没有请求幂等键，COMMIT 成功但响应丢失会重复 note | 增加 requestKey/唯一约束 |
| P2-4 | 非 CLOSED exact context 的重复创建只定义 identity upsert，完整幂等语义未定 | 明确请求指纹和内容更新规则 |
| P2-5 | 项目范围销售列表先全量查询再过滤 | 授权后按 projectIds 查询 |
| P2-6 | E2E 目标未明确断言 handoff binding/status/note count | 增加实体级断言 |

### P3

| ID | 问题 | 结论 |
|---|---|---|
| P3-1 | 四个 Trigger 只有行为表，没有完整可执行 SQL/函数 owner/ACL/search_path 设计 | 实施前补齐可审查定义 |
| P3-2 | CLOSED/legacy 的 `updatedAt` 是否允许无变化更新未明确 | 与其他字段一起定义 |
| P3-3 | handoff 创建未说明是否追加 AuditLog | 若业务规则要求关键变更审计，需补事务内审计 |

## 15. 可以进入实施的范围

当前结论为 FAIL，因此不能按报告声称的范围开始完整实施。

在修正 P1-1 和 P1-2 并重新审查前，只允许：

- 继续在隔离环境中准备 Schema/Trigger 测试草案；
- 对 resolver/evaluator、重试分类、请求幂等键和数据库关系做纯单元测试设计；
- 为需求并发、旧客户端重连和 note 响应丢失编写不会连接共享库的测试规格；
- 继续只读审计现有工作区。

不得：

- 删除旧 `sales_handoff_projectId_key`；
- 启用新的 sales Trigger；
- 在正式/开发数据库执行 Contract；
- 把旧 notes 路径保留在可连接状态；
- 宣称 Prisma/PostgreSQL/Trigger/并发已验证。

## 16. 进入隔离验证前必须完成的修正

1. 修正需求 PATCH/顾问的锁内读取、merge、expectedVersion/CAS。
2. 设计 Contract 的硬排空证据和旧 notes 写入阻断机制。
3. 明确 SelectionRun 的 project/requirement 复合 FK 及既有数据检查。
4. 统一 Prisma `onUpdate` 与现有 Migration action，列出所有 FK alteration。
5. 增加 note 请求幂等键及唯一约束，区分 DB 重试和客户端重试。
6. 将 scoped sales query 改为数据库级 project filter。
7. 把 E2E 的 handoff binding/status/note count 断言具体化。
8. 补全四个 Trigger 的完整 DDL/函数语义和角色/ACL 边界。

## 17. 必须通过但本轮未执行的验证

```text
prisma validate / generate
isolated forward Migration apply
pg_constraint/pg_indexes/pg_trigger/pg_proc catalog comparison
composite FK and CHECK negative tests
Trigger INSERT/UPDATE/DELETE tests
two-connection Project-lock tests
requirement concurrent PATCH lost-update test
old notes API after cutover test
COMMIT-success/response-loss note idempotency test
RepeatableRead page snapshot test
browser/RSC payload authorization test
E2E
typecheck
build/startup only if separately authorized
```

以上全部是 `NOT VERIFIED` 或未执行，不得写成 PASS。

## 18. 静态无法确定的事项

- 新 Prisma composite relation 和 `@relation(map: ...)` 是否能由当前 Prisma 版本
  接受；
- PostgreSQL 复合 FK、CHECK、Trigger 和 index 是否能成功创建并被 Catalog 认可；
- Trigger 对同一事务多次修改、OLD/NEW、Deferred 行为和 SQLSTATE 的实际结果；
- 旧客户端排空后是否可能由未知 Scheduler、服务管理器或容器自动重启；
- Prisma interactive transaction 的 timeout/maxWait 对锁等待和重试的实际影响；
- 当前生产/共享数据库的真实行数、约束漂移和角色 ACL。

## 19. Git 后状态

审查开始时：

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:      101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       48
Staged:                 0
Deleted:                0
Untracked entries:      146
Untracked files:        157
```

本报告新增后：

```text
Tracked modified:       48
Staged:                 0
Deleted:                0
Untracked entries:      147 expected
Untracked files:        158 expected
```

本报告之外没有修改源码、Schema、Migration、测试、配置或既有文件。

## 20. 报告 SHA-256、字节数和物理行数

```text
Self-excluding SHA-256:
2e3c4a68f5ed6bfb27e7053d5b8d03e235440837338c2ced1338a3a8aec2b4a6

Bytes:                    37625
Physical lines:           768
```

自排除摘要的计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符，
对 UTF-8 文件字节计算 SHA-256。
