# APP-WORKBENCH-R1-CORRECTIONS-R2 实施报告

## 0. 最终结论

```text
PASS WITH RESTRICTIONS — CURRENT REQUIREMENT CONSISTENCY VERIFIED
```

本轮完成了统一“当前需求对应 SelectionRun”解析规则：

- 按当前最新 BuildingRequirement.id 过滤；
- 忽略所有其他 requirementId；
- 不依赖 runs 数组顺序；
- 同一需求多条 run 使用现有 `createdAt` 业务排序；
- 最高时间戳并列、时间无效或无法唯一选择时不猜测；
- 当前 run 未满足现有完成状态时不得推进销售。

管理员销售页和两个项目工作台已统一使用该规则。首页最近选型已明确
标记为历史记录。

限制：

- PostgreSQL 未执行，数据库多行真实排序未验证；
- E2E 源码已修改但未执行；
- Browser/RSC 实际序列化载荷未验证；
- Build、Provider、部署和真实服务未执行。

## 1. 实施前 Git 基线

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Live origin HEAD:             101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             46
Staged:                       0
Deleted:                      0
Untracked status entries:     141
Untracked recursive files:    151 including two protected names
```

基线报告：

```text
Corrections report:
FDEB2179C619ACE1AEBEC3FDFCEAD1300885365F20E2F8020A3685CE2EAB6131

Corrections independent review:
505C4530E4D72ED1480B30AA6FCE4133DF910AAB4463F93AD072F8EE1555EEEE

R1 implementation report:
BC0A10C7BD44D9B1B97228CFAE222D0DEB41CE2237D10A35544D13E788FC0204
```

## 2. 工作区保护

- 既有 23 个 P1-3/Route C-Minimal tracked 修改继续保留；
- APP-WORKBENCH-R1 和 Corrections 的既有修改继续保留；
- 没有删除、覆盖、移动或重命名任何已有报告和用户文件；
- 没有读取或泄露环境文件、密钥、密码、Token 或连接字符串；
- `$null` 和 `UNKNOWN'` 未读取内容、未计算哈希、未修改、未移动、未删除；
- 没有删除、覆盖、移动、重命名或启动
  `apps/web/.next`、`apps/worker/dist`；
- 没有执行 Git add、commit、push、reset、restore、clean、checkout 或
  stash。

## 3. 统一当前需求选型结果规则

### 3.1 最新需求

现有权威查询：

```text
apps/web/src/modules/mvp/store.ts:220-233
```

使用：

```sql
ORDER BY "version" DESC
LIMIT 1
```

Schema 对 `(projectId, version)` 有唯一约束。因此同一项目最新 version
具有确定性。该判断没有新增业务规则。

### 3.2 SelectionRun 关联与状态

SelectionRun 保存 `requirementId`：

```text
apps/web/src/modules/mvp/store.ts:808-826
```

现有状态：

```text
COMPLETED
NO_VALID_MATCH
```

只有 `COMPLETED` 表示当前需求已生成有效初步方案；
`NO_VALID_MATCH` 表示当前需求已完成匹配但没有可直接展示的方案。

### 3.3 同需求多条 run

现有数据模型没有 `selectionVersion` 或同一需求的 sequence。
现有查询提供的业务排序是 `createdAt DESC`，因此本轮：

1. 先按 requirementId 严格过滤；
2. 去重同一 run id；
3. 选择 `createdAt` 最大的记录；
4. 若最高时间戳被多个不同 run 共享，则返回 `AMBIGUOUS`；
5. 若匹配 run 中存在无效时间，则返回 `INVALID_TIMESTAMP`；
6. `AMBIGUOUS` / `INVALID_TIMESTAMP` 一律保守显示待人工核对，不猜测。

没有新增数据库字段、时间 tie-breaker、业务状态或自动重跑规则。

### 3.4 纯函数

新增：

```text
apps/web/src/modules/workbench/selection-consistency.ts
```

核心函数：

```text
resolveCurrentSelectionRun(requirementId, runs)
```

可能结果：

```text
CURRENT
NO_REQUIREMENT
NO_MATCH
AMBIGUOUS
INVALID_TIMESTAMP
```

## 4. P1：管理员销售页修复

`listSalesHandoffs()` 之前使用：

```text
selectionRuns[0]
```

现在：

```text
getLatestRequirement(projectId)
+ listSelectionRuns(projectId)
-> resolveCurrentSelectionRun(requirement.id, selectionRuns)
-> 仅返回当前需求对应的当前 run
```

实现位置：

```text
apps/web/src/modules/mvp/store.ts:1047-1077
```

行为：

- 其他 requirementId 的旧结果不会返回给销售页面；
- 当前需求没有匹配 run 时 `selectionRun=null`；
- 当前 run 为 `NO_VALID_MATCH` 时显示当前需求无有效推荐；
- 其他未满足完成状态、并存歧义或无效时间不显示为当前方案；
- 页面文案改为“当前需求尚无有效初步选型记录”；
- `SALES_MANAGE` 权限门保持原样。

内部类型 `SalesHandoffRecord.selectionRun` 增加已有运行时字段
`requirementId`，便于测试和无歧义的页面语义校验；没有修改 API Route
或公共 contracts。

最终状态：

```text
REV-APP-WB-R1-CORR-P1-01:
RESOLVED — SOURCE + PURE UNIT
```

## 5. P2：项目工作台不再依赖 runs[0]

两个项目详情现在将完整 run 集合传入工作台：

```text
apps/web/src/app/projects/[projectId]/page.tsx
apps/web/src/app/admin/projects/[projectId]/page.tsx
```

工作台内部使用同一个 resolver：

```text
resolveCurrentSelectionRun(requirement.id, selectionRuns)
```

因此：

- 即使旧需求 run 在数组第一位，也不会被当作当前方案；
- 即使旧需求 run 的 createdAt 更晚，也不会挤掉当前需求的有效 run；
- 同需求多 run 不依赖数组顺序；
- 无法唯一排序时阻止当前方案完成显示；
- 当前 run 未完成时下一步是重新生成，不进入销售。

最终状态：

```text
REV-APP-WB-R1-CORR-P2-01:
RESOLVED — SOURCE + PURE UNIT
```

## 6. P2：销售 E2E 源码

已加强：

```text
apps/web/tests/e2e/mvp-catalog-sales.spec.ts
```

现有正常流程会断言：

- 当前需求 id；
- SelectionRun.requirementId；
- SelectionRun.status；
- 销售 API 返回的 requirement.id 与 SelectionRun.requirementId 一致。

新增 E2E 源场景：

```text
旧需求完成选型并提交销售交接
-> 修改并确认新需求
-> 新需求没有 SelectionRun
-> 销售 API 的 current requirement = 新需求
-> selectionRun = null
```

没有删除测试、跳过测试或放宽原有权限断言。

本轮没有执行 E2E。

最终状态：

```text
REV-APP-WB-R1-CORR-P2-02:
RESOLVED — TEST SOURCE
```

## 7. 全局 SelectionRun 调用点扫描

| 调用点 | 分类 | 当前处理 |
|---|---|---|
| 客户项目详情工作台 | 当前需求 | 完整 run 集合 + 统一 resolver |
| 管理端项目详情工作台 | 当前需求 | 完整 run 集合 + 统一 resolver |
| `/admin/sales` 数据 | 当前需求 | 统一 resolver 后返回当前 run |
| `/api/admin/sales` | 当前需求数据 | 复用已解析销售记录 |
| 项目详情“初步推荐历史” | 历史 | 保留全部 run，标题明确为历史 |
| 首页“最近选型历史” | 历史 | 改为历史标题、说明和“历史记录”标记 |
| `GET /api/projects/:projectId/selection-runs` | 原始历史集合 | 不推断当前方案 |
| `listSelectionRuns()` | 数据访问 | 返回 run 集合，并保留现有 createdAt 排序 |
| `createSelectionRun()` | 写入 | 不改变状态含义 |
| `runPreliminarySelection()` | 当前选型生成 | 仍只按当前需求 version 发起 |

源码扫描未发现剩余：

```text
runs[0]
selectionRuns[0]
```

被用于当前方案推断。

## 8. 测试新增与结果

新增：

```text
apps/web/tests/selection-consistency.test.ts
```

覆盖 A-F：

- A：当前需求 run 已完成；
- B：当前需求无 run，旧需求 run 已完成；
- C：旧 run 时间更晚、当前需求 run 有效；
- D：同一需求多 run，数组顺序与时间顺序不一致；
- E：当前 run 未完成，旧 run 已完成；
- F：无当前需求。

额外覆盖：

- 最高时间戳并列 -> `AMBIGUOUS`；
- 无效时间 -> `INVALID_TIMESTAMP`；
- 工作台遇到歧义时不显示完成方案、不进入销售；
- 工作台当前 run 未完成时不进入销售。

## 9. 验证命令

### TypeScript

```powershell
pnpm typecheck
```

```text
Exit code: 0
Result: 所有实际发出的 workspace typecheck 任务通过
```

### Web 纯单元测试

```powershell
pnpm --filter @elevator/web exec vitest run tests/selection-consistency.test.ts tests/workbench-presentation.test.ts tests/workbench-visibility.test.ts tests/requirement-form-validation.test.ts tests/advisor-missing-fields.test.ts tests/advisor-mock-provider.test.ts tests/mvp-project-access.test.ts
```

```text
Exit code: 0
Test Files: 7 passed
Tests:      47 passed
```

### Contracts

```powershell
pnpm --filter @elevator/contracts test
```

```text
Exit code: 0
Test Files: 4 passed
Tests:      15 passed
```

### Selection engine

```powershell
pnpm --filter @elevator/selection-engine test
```

```text
Exit code: 0
Test Files: 2 passed
Tests:      9 passed
```

### Diff

```powershell
git diff --check
```

```text
Exit code: 0
```

Git 仅输出既有 LF/CRLF 转换提示，没有 whitespace 错误、staged change 或
删除。

## 10. 未解决问题

```text
P0: 0
P1: 0
P2: 0
```

保留边界：

- 文件生命周期技术状态标签不在本任务范围；
- 真实 PostgreSQL 数据排序和事务时序未执行；
- E2E 源码未执行；
- Browser/RSC 实际载荷未抓取；
- Build 和生产 Start Gate 未执行。

## 11. 未执行验证

```text
PostgreSQL:                    NOT EXECUTED
SQL/Migration:                 NOT EXECUTED
Database integration tests:    NOT EXECUTED
E2E:                           NOT EXECUTED
Browser Runtime:               NOT EXECUTED
Build:                         NOT EXECUTED
Startup security gate:         NOT EXECUTED
Provider/IAM/ACL:              NOT EXECUTED
Deployment:                    NOT EXECUTED
```

`pnpm typecheck` 刷新了 Git ignored 的：

```text
apps/web/tsconfig.tsbuildinfo
```

没有修改 Prisma Schema、Migration、API contracts、API Route、服务端鉴权、
数据库角色、文件生命周期或 Provider。

## 12. 本轮修改文件

```text
apps/web/src/modules/workbench/selection-consistency.ts
apps/web/src/modules/workbench/presentation.ts
apps/web/src/modules/mvp/store.ts
apps/web/src/modules/mvp/types.ts
apps/web/src/app/projects/[projectId]/page.tsx
apps/web/src/app/admin/projects/[projectId]/page.tsx
apps/web/src/app/admin/sales/page.tsx
apps/web/src/app/page.tsx
apps/web/tests/selection-consistency.test.ts
apps/web/tests/workbench-presentation.test.ts
apps/web/tests/e2e/mvp-catalog-sales.spec.ts
```

报告：

```text
docs/product/app-workbench-r1-corrections-r2-report.md
```

## 13. Git 状态

实施前：

```text
Tracked modified:             46
Staged:                       0
Deleted:                      0
Untracked status entries:     141
Untracked recursive files:    151
```

代码与测试完成后、报告创建前：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked status entries:     142
Untracked recursive files:    153
```

新增 2 个 tracked modified 是：

```text
apps/web/src/modules/mvp/types.ts
apps/web/tests/e2e/mvp-catalog-sales.spec.ts
```

其余修改属于已存在的 APP-WORKBENCH-R1/Corrections 路径。23 个既有
P1-3/Route C-Minimal tracked 修改和其他用户未跟踪工作没有被清理或归入
本批次。

报告完成后预期：

```text
Tracked modified:             48
Staged:                       0
Deleted:                      0
Untracked status entries:     143
Untracked recursive files:    154 including two protected names
```

## 14. 报告摘要与文件大小

```text
Self-excluding SHA-256:
4B9C93AC93F9ED5188620E5D8BA76069D624391B1FEDEA85473F42164C8A0E04

Bytes:                    11990
Physical lines:           478
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符后，
对 UTF-8 文件字节计算 SHA-256。
