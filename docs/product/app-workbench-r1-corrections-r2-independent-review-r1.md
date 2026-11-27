# APP-WORKBENCH-R1-CORRECTIONS-R2 独立审查 R1

## 0. 最终结论

```text
FAIL — CORRECTIONS REQUIRED
```

统一 SelectionRun 解析器和主要展示入口的 requirementId 匹配实现正确。
但仍有两个实质问题：

1. 销售后续动作仍可基于旧项目级 SalesHandoff 继续执行，即使当前最新需求
   没有有效方案；
2. 当前需求和 SelectionRun 通过独立查询读取，不在同一数据库快照中，存在
   短时间窗口内的最新需求不一致。

因此 R2 报告中的
`PASS WITH RESTRICTIONS — CURRENT REQUIREMENT CONSISTENCY VERIFIED`
范围过宽。

本轮为只读审查，未修改源码、测试、Schema、Migration、配置或既有报告。
仅新增本审查报告。

## 1. Git 基线

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Live origin HEAD:             NOT VERIFIED — NETWORK FAILURE
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked status entries:     143
Untracked recursive files:    154 including two protected names
```

尝试读取 live origin 时 GitHub 连接失败，未把远端在线状态标为通过。

## 2. 审查输入

```text
R2 report:
docs/product/app-workbench-r1-corrections-r2-report.md
Bytes: 11990
Lines: 478
SHA-256: 22CD5C5C8D3604C8DA271B87CE2245F128D4A84F106AFA252950D24F3A79564C

Corrections independent review:
SHA-256: 505C4530E4D72ED1480B30AA6FCE4133DF910AAB4463F93AD072F8EE1555EEEE

Corrections report:
SHA-256: FDEB2179C619ACE1AEBEC3FDFCEAD1300885365F20E2F8020A3685CE2EAB6131

R1 independent review:
SHA-256: ABC1516AE957B7F2957B522E95FED048EF3A22189664E47D4D6D825C8B83304E

R1 implementation report:
SHA-256: BC0A10C7BD44D9B1B97228CFAE222D0DEB41CE2237D10A35544D13E788FC0204
```

## 3. 文件归属

- 23 个 P1-3/Route C-Minimal tracked 修改属于既有用户工作；
- APP-WORKBENCH-R1 和 Corrections 的既有路径继续存在；
- R2 新修改的 tracked 文件是：

```text
apps/web/src/modules/mvp/types.ts
apps/web/tests/e2e/mvp-catalog-sales.spec.ts
```

- R2 新增文件：

```text
apps/web/src/modules/workbench/selection-consistency.ts
apps/web/tests/selection-consistency.test.ts
docs/product/app-workbench-r1-corrections-r2-report.md
```

- 其他工作台、销售和页面修改属于此前 APP-WORKBENCH-R1/Corrections 路径。
- 没有将 API、上传、Worker、file-storage、Schema、Migration 等既有修改归为
  R2。

## 4. `resolveCurrentSelectionRun()` 逐项审查

实现：

```text
apps/web/src/modules/workbench/selection-consistency.ts
```

### 4.1 当前需求 ID 严格匹配

函数先检查 requirementId 是否存在，然后只把
`run.requirementId === requirementId` 的记录放入候选 Map。

结论：

```text
VERIFIED — SOURCE
```

### 4.2 完成状态

resolver 本身选择“当前需求最新 run”，不会把状态强制改为 completed。
调用方分别处理：

- 工作台只把 `COMPLETED` 标记为方案完成；
- `/admin/sales` 只回传 `COMPLETED` 或 `NO_VALID_MATCH`；
- 其他状态不会显示为已完成方案。

当前调用方处理正确，但“完成状态”不是 resolver 自身保证，而是调用约定。

结论：

```text
VERIFIED AT CURRENT CALL SITES
```

### 4.3 数组顺序

resolver 先过滤、按 id 去重，再比较 `createdAt.getTime()`。
测试 C/D 覆盖旧 run 位于数组前、后以及当前 run 时间较旧的情况。

结论：

```text
VERIFIED — SOURCE + PURE UNIT SOURCE
```

### 4.4 createdAt 排序依据

现有 `listSelectionRuns()` 对完整集合使用：

```text
ORDER BY "createdAt" DESC
```

resolver 在内存中重新做同样时间比较，不依赖输入数组顺序。

局限：

- 同一 requirement 的最高 createdAt 并列时返回 `AMBIGUOUS`；
- 不把 id、数组位置或其他未批准字段作为 tie-breaker；
- PostgreSQL 实际多行排序未执行。

结论：

```text
VERIFIED — SOURCE
DATABASE ORDERING: NOT VERIFIED
```

### 4.5 时间并列和无效时间

- `AMBIGUOUS` 有测试；
- `INVALID_TIMESTAMP` 有测试；
- 不存在 return `runs[0]` 或任意回退。

时间缺失风险：

- TypeScript 类型要求 createdAt: Date；
- 数据库列非空；
- 若调用方在运行时传入 `createdAt=undefined`，`getTime()` 会抛错。

当前源码调用方都来自数据库类型安全的记录，因此当前路径未被证实可达。
该风险列为 P3 防御性问题，不影响本次 P1 结论。

### 4.6 时间精度和时区

Prisma/PostgreSQL 使用 `DateTime`/`timestamptz`，Node 转换为 Date。
PostgreSQL 微秒精度在 JS Date 中只保留毫秒：

- 不同微秒但同一毫秒的多个 run 会显示为并列；
- resolver 返回 `AMBIGUOUS`，属于保守失败；
- 不会把并列记录误选为完成。

时区在 `timestamptz` 到 Date epoch 转换中一致。

结论：

```text
VERIFIED BY SOURCE; DB PRECISION NOT EXECUTED
```

### 4.7 跨项目 run

resolver 不接收 projectId，但：

- BuildingRequirement.id 是全局主键；
- 所有上游查询按 projectId 过滤；
- 其他项目的 run 即使进入数组，也不会匹配当前 requirementId。

结论：

```text
SOURCE SAFE
NO DB RUNTIME VERIFICATION
```

### 4.8 无当前需求

返回 `NO_REQUIREMENT`，没有回退到任何历史 run。

结论：

```text
VERIFIED — SOURCE + TEST SOURCE
```

### 4.9 调用方处理不可判定

- 工作台把 `AMBIGUOUS` / `INVALID_TIMESTAMP` 标记为需人工核对；
- 不显示当前方案完成；
- 不推进销售后续；
- 销售数据读取在无法判定时不返回 run。

结论：

```text
VERIFIED — SOURCE + PURE UNIT SOURCE
```

## 5. 最新需求与查询完整性

最新需求：

```text
apps/web/src/modules/mvp/store.ts:220-233
ORDER BY version DESC
LIMIT 1
```

Schema 对 `(projectId, version)` 有唯一约束。

当前 run 查询：

```text
apps/web/src/modules/mvp/store.ts:861-879
```

没有 `take: 1`、分页或 requirementId 之外的过滤；返回项目完整 run 集合。

工作台两个页面把完整 `runs` 传给 resolver。销售记录读取也先取完整
`selectionRuns` 再解析。

### 5.1 P2：需求与 run 不属于同一读取快照

证据：

- `apps/web/src/app/projects/[projectId]/page.tsx:65-73` 通过
  `Promise.all([getLatestRequirement, listSelectionRuns])` 读取；
- `apps/web/src/app/admin/projects/[projectId]/page.tsx:81-88` 同样；
- `apps/web/src/modules/mvp/store.ts:1048-1062` 销售读取也并行执行
  `getLatestRequirement` 和 `listSelectionRuns`。

两个查询没有共享 Prisma interactive transaction 或其他一致快照。

并发时序：

```text
T1: 读到 requirement A
T2: 客户创建新的 requirement B
T3: run 查询仍读取到 A 的 SelectionRun
T4: 页面用 A + A-run 渲染为当前方案
```

在下一请求中可能恢复为 B 且无 run，但本次页面在并发窗口内仍把旧需求
显示为当前需求。

影响：

- 不产生跨项目访问；
- 不会修改历史数据；
- 可能造成短时间视觉和销售上下文错误；
- 当前 resolver 的 requirementId 检查无法弥补两个读取源版本不一致。

最小修复方向：

- 在同一个只读事务快照内读取 requirement 和 runs；或
- 使用一条查询按当前 version 关联 req/run；
- 不改 Schema 或 API 契约；
- 并发数据库行为仍需独立验证。

### 5.2 查询完整性结论

```text
完整 run 集合查询: VERIFIED — SOURCE
requirement/run 同一快照: NOT VERIFIED / P2
真实数据库时序: NOT VERIFIED
```

## 6. 全部 SelectionRun 调用点

| 调用点 | 分类 | 审查结果 |
|---|---|---|
| 客户项目详情工作台 | A 当前需求 | 使用完整 run + resolver |
| 管理端项目详情工作台 | A 当前需求 | 使用完整 run + resolver |
| `/admin/sales` 方案摘要 | A 当前需求 | store 使用 resolver |
| `/api/admin/sales` | A 当前需求数据 | 复用已解析销售记录 |
| 客户项目详情“初步推荐历史” | B 历史 | 标题明确为历史，展示全部 run |
| 首页“最近选型历史” | B 历史 | 标题、说明和“历史记录” badge |
| `GET /api/projects/:id/selection-runs` | C 原始资源 | 返回完整历史集合，不声明当前方案 |
| `listSelectionRuns()` | C 数据读取 | 返回完整项目 run 集合 |
| `listRecentSelectionRuns()` | B 历史 | 仅供首页历史展示 |
| `createSelectionRun()` | C 写入 | 保存 requirementId，不改变状态 |
| `runPreliminarySelection()` | C 生成 | 按当前需求 version 发起 |
| `/admin/sales/:handoffId/notes` | 销售动作 | **未验证当前方案前置，见 P1** |

全仓源码搜索未发现
`runs[0]` / `selectionRuns[0]` 被用于当前方案推断。

结论：

```text
所有已识别的当前方案展示入口: REQUIRED resolver applied
历史展示入口: EXPLICITLY MARKED
销售后续 API: INCOMPLETE
```

## 7. 销售推进检查

### 7.1 已完成部分

工作台在：

- 当前 run 缺失；
- requirementId 不匹配；
- 时间并列不可判定；
- 当前 run 未满足完成条件

时不会把销售步骤视为完成，也不会返回销售待办。

`SALES_MANAGE` 权限门仍保持不变。

### 7.2 P1：旧项目级 SalesHandoff 仍可继续推进

证据：

- `listSalesHandoffs()` 即使没有当前有效 SelectionRun，仍返回整个
  `sales_handoff` 记录；
- `apps/web/src/app/admin/sales/page.tsx:153-174` 在当前方案为空时仍显示
  历史销售状态、跟进记录和 `FollowUpForm`；
- `apps/web/src/app/api/admin/sales/[handoffId]/notes/route.ts:17-43`
  只检查 SALES_MANAGE，没有检查最新需求是否有当前有效方案；
- `addSalesFollowUp()` 仅更新 handoff 和 note，不检查 requirement/run。

复现：

```text
1. 需求 A + COMPLETED SelectionRun；
2. 提交 SalesHandoff，状态进入 IN_FOLLOW_UP；
3. 创建并确认需求 B，不生成 B 的 SelectionRun；
4. 打开 /admin/sales：
   需求 B
   + “当前需求尚无有效初步选型记录”
   + 原 SalesHandoff 状态与 FollowUpForm
5. 可直接 POST follow-up，继续推进销售状态。
```

这把旧方案的销售进度继续保留为当前可操作事项，违反“当前需求未完成时
不得推进销售后续”的目标。

当前任务禁止修改 API Route，因此完整修复可能超出本轮授权。最小方向：

- 服务端 follow-up 写入前重新解析当前需求与当前 run；
- 无当前 COMPLETED SelectionRun 时拒绝继续推进；
- 页面同步禁用 FollowUpForm 并显示“方案需重新生成/人工复核”；
- 如果产品明确允许无方案销售跟进，则必须更新业务规则并重新审查，
  不能把当前实现视为安全完成。

## 8. E2E 源码检查

### 8.1 有效断言

正常流程 E2E 现在验证：

- 当前 requirement.id；
- SelectionRun.requirementId；
- SelectionRun.status；
- SalesHandoff 返回的当前需求和 run 一致；
- 原有 SALES_MANAGE 权限断言保留。

### 8.2 旧需求场景

新增“新需求创建后旧方案失效”测试源，但没有验证原 SelectionRun 的
`status` 和 `requirementId`。

证据：

```text
apps/web/tests/e2e/mvp-catalog-sales.spec.ts:340-345
```

只检查选型请求 HTTP 201，没有解析返回 run。如果该 run 实际为
`NO_VALID_MATCH`，测试仍会通过，因而不是真正的“旧 COMPLETED run”场景。

### 8.3 未由 E2E 覆盖的逻辑

以下由纯函数测试覆盖，但没有 E2E：

- 全局最新 run 属于旧需求；
- 同时间戳并列；
- 当前 run 未完成；
- 无当前需求。

这不是当前 P1 的根因，但应在后续测试强化中补齐。

E2E 本轮没有执行。

## 9. 回归与授权边界

R2 未修改：

```text
API Route
packages/contracts
Prisma Schema
Migration
服务端鉴权定义
文件生命周期
Provider
真实 AI
```

R2 修改了 `mvp/types.ts` 的运行时类型描述和销售读取，但没有改变数据库
结构。

发现的问题：

- 销售状态推进缺少业务前置门，若修复需修改 API Route/服务端写入逻辑，
  超出本轮授权；
- 需求/run 读取快照一致性问题可以通过只读事务修复，但仍需设计与测试。

## 10. 问题分级

### P0

无。

### P1

```text
REV-APP-WB-R1-R2-IND-P1-01
旧项目级 SalesHandoff 在当前最新需求没有有效 SelectionRun 时仍可继续
推进销售状态和跟进记录。
```

### P2

```text
REV-APP-WB-R1-R2-IND-P2-01
requirement 和 selection runs 分开读取，缺少同一数据库快照。

REV-APP-WB-R1-R2-IND-P2-02
“新需求后旧完成 run”E2E 原场景未断言选型响应为 COMPLETED 和匹配
requirementId，存在空泛通过。
```

### P3

```text
REV-APP-WB-R1-R2-IND-P3-01
resolver 对运行时缺失 createdAt 没有防御；当前数据库非空类型下不可达，
但未来外部调用可能抛错。
```

## 11. 已确认无问题

- resolver 不依赖数组位置；
- 不匹配 requirementId 的 run 不参与当前方案；
- 无当前需求不回退历史；
- 时间并列返回不可判定；
- 无效 Date 返回不可判定；
- 当前 run 未完成不会由工作台显示完成；
- 工作台两个页面都传完整 run 集合；
- 销售摘要只使用当前需求对应 run；
- 首页最近选型明确为历史；
- `SALES_MANAGE` 权限没有降低；
- 没有新增 API contract、Schema 或 Migration。

## 12. 状态汇总

```text
SelectionRun ID filtering:              VERIFIED — SOURCE
Default-style array ordering:           VERIFIED — SOURCE + TEST SOURCE
Tie breaking:                           VERIFIED — CONSERVATIVE
Current scheme display:                 VERIFIED — SOURCE
Historical labeling:                    VERIFIED — SOURCE
Sales data permission:                  VERIFIED — SOURCE
Sales follow-up state gate:             FAIL — P1
Requirement/run snapshot consistency:   PARTIAL — P2
PostgreSQL ordering:                    NOT VERIFIED
E2E execution:                          NOT EXECUTED
Browser/RSC payload:                    NOT VERIFIED
```

## 13. 测试证据边界

R2 报告记录：

```text
Web unit: 7 files / 47 tests PASS
Contracts: 4 files / 15 tests PASS
Selection engine: 2 files / 9 tests PASS
Typecheck: PASS
git diff --check: PASS
```

本轮审查按授权没有重新执行这些命令。测试源码中的声明数量与 R2 报告
一致，但不能替代独立执行证据。

## 14. 未验证事项

```text
PostgreSQL latest requirement/run snapshot: NOT VERIFIED
SelectionRun microsecond ordering:          NOT VERIFIED
Concurrent requirement creation window:     NOT VERIFIED
E2E execution:                              NOT EXECUTED
Browser/RSC payload:                        NOT VERIFIED
Build/Startup Gate:                         NOT VERIFIED
Provider/IAM/deployment:                    NOT VERIFIED
Live remote HEAD:                           NOT VERIFIED — NETWORK FAILURE
```

## 15. Git 后状态

审查前：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked status entries:     143
Untracked recursive files:    154
```

新增本报告后预期：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked status entries:     144
Untracked recursive files:    155 including two protected names
```

没有修改源码，没有执行 Git 写操作或清理。

## 16. 报告 SHA-256、大小和行数

```text
Self-excluding SHA-256:
5075E925ED546C11AFC3F6238D281B298D90D3E7F99B5741D9A78E7AC32A9512

Bytes:                    15967
Physical lines:           563
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符后，
对 UTF-8 文件字节计算 SHA-256。
