# APP-WORKBENCH-R1-CORRECTIONS 独立验证 R1

## 0. 最终结论

```text
FAIL — CORRECTIONS REQUIRED
```

主项目工作台中的 P1 修复有效：当前需求 id 与 SelectionRun.requirementId
匹配后，选型结果才会被视为当前完成方案。

但管理员销售页仍存在同一不变量的旁路：

```text
最新需求 + 全局最新 SelectionRun
```

这两者被直接并列展示，没有校验 SelectionRun 是否属于当前需求。旧需求
方案仍可能在销售处置页面显示为当前销售上下文。因此 P1 尚未完整关闭。

本轮为只读审查，未修改源码、测试、Schema、Migration、配置或既有报告。
仅新增本审查报告。

## 1. 当前 Git 基线

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Live origin HEAD:             NOT VERIFIED — NETWORK FAILURE
Tracked modified:             46
Staged:                       0
Deleted:                      0
Untracked status entries:     140
Untracked recursive files:    150 including two protected names
```

本地 `origin/main` 与 HEAD 相同。尝试读取 live origin 时 GitHub 连接失败，
因此未把远端在线状态标为通过。

## 2. 审查输入

```text
Corrections report:
docs/product/app-workbench-r1-corrections-report.md
Bytes: 14297
Lines: 547
SHA-256: FDEB2179C619ACE1AEBEC3FDFCEAD1300885365F20E2F8020A3685CE2EAB6131

Prior independent review:
docs/product/app-workbench-r1-independent-review-r1.md
SHA-256: ABC1516AE957B7F2957B522E95FED048EF3A22189664E47D4D6D825C8B83304E

R1 implementation report:
docs/product/app-workbench-r1-implementation-report.md
SHA-256: BC0A10C7BD44D9B1B97228CFAE222D0DEB41CE2237D10A35544D13E788FC0204
```

三个文件的实际哈希与上一阶段报告记录一致。

## 3. 文件归属

### 3.1 既有用户工作

- 23 个 P1-3/Route C-Minimal tracked modified 属于 APP-WORKBENCH 前的既有
  安全整改；
- 其余上传、下载、Worker、file-storage、Schema、Migration 和其他未跟踪
  文件继续属于既有用户工作。

### 3.2 APP-WORKBENCH-R1

APP-WORKBENCH-R1 新增 18 个 tracked modified、11 个源码/测试文件和实施
报告。具体路径见：

```text
docs/product/app-workbench-r1-implementation-report.md
```

### 3.3 Corrections

纠正包新增 5 个 tracked modified：

```text
apps/web/src/app/admin/products/[productId]/product-edit-form.tsx
apps/web/src/app/admin/products/product-form.tsx
apps/web/src/app/catalog/page.tsx
apps/web/src/app/page.tsx
apps/web/tests/e2e/mvp-ui-routes.spec.ts
```

并新增/修改工作台、销售权限门、测试和纠正报告。

### 3.4 无法归属

本轮没有把其他当前 modified/untracked 路径归入 Corrections。审查期间没有
新增源码或测试修改。

## 4. P1 调用链审查

### 4.1 最新需求选择

```text
apps/web/src/modules/mvp/store.ts:220-233
```

使用：

```sql
ORDER BY "version" DESC
LIMIT 1
```

Schema 对 `(projectId, version)` 有唯一约束，因此排序语义确定。数据库实际
执行本轮未验证。

### 4.2 SelectionRun 归属

需求修改会创建新的 `BuildingRequirement.id`：

```text
mvp/store.ts:236-291
```

SelectionRun 保存 `requirementId`：

```text
mvp/store.ts:808-826
```

`listSelectionRuns()` 也返回该字段：

```text
mvp/store.ts:861-879
```

### 4.3 主项目工作台

`workbench/presentation.ts` 现在比较：

```text
selectionRun.requirementId === requirement.id
```

只有匹配且状态为 `COMPLETED` 时才标记当前方案完成。旧需求 run 会：

```text
selection state = ATTENTION
next action = rerun-stale-selection
```

不会把旧结果加入当前“已完成”事项，也不会因此进入销售后续动作。

主项目工作台 P1：

```text
RESOLVED — SOURCE + PURE UNIT
```

### 4.4 管理员销售页旁路

调用路径：

```text
/admin/sales
-> requirePageSession
-> loadActor
-> SALES_MANAGE
-> listSalesHandoffs()
-> getLatestRequirement(projectId)
-> listSelectionRuns(projectId)
-> selectionRuns[0]
-> 销售页面
```

证据：

- `apps/web/src/modules/mvp/store.ts:1047-1066` 直接
  `selectionRun: selectionRuns[0] ?? null`；
- `apps/web/src/modules/mvp/types.ts:72-75` 的销售记录 selectionRun
  类型甚至未包含 `requirementId`；
- `apps/web/src/app/admin/sales/page.tsx:94-152` 将最新需求与上述 run
  并列显示为首选方案和初步选型状态。

复现条件：

```text
1. 确认需求 A，生成 SelectionRun R-A；
2. 提交销售交接；
3. 创建并确认需求 B；
4. 不重新生成选型；
5. 打开 /admin/sales。
```

实际结果仍是：

```text
需求 B
+ SelectionRun R-A
```

即旧需求方案仍可显示为当前销售上下文，可能影响销售对预算、参数和方案的
判断。

该问题不受 `SALES_MANAGE` 权限缺陷影响；获得销售权限的用户仍会看到错误
的业务关联。

### 4.5 页面只取全局最新 run

两个项目工作台当前传入：

```text
runs[0]
```

- `apps/web/src/app/projects/[projectId]/page.tsx:88`
- `apps/web/src/app/admin/projects/[projectId]/page.tsx:97`

正常追加流程中，当前需求对应的新 run 通常是最新 run。但如果历史数据或并发
路径使一个旧需求的 run 更晚写入，工作台会忽略仍然存在的当前需求匹配 run，
错误要求重新选型。该路径不会错误推进销售，但会让有效的当前结果不可见。

## 5. 独立 Findings

### REV-APP-WB-R1-CORR-P1-01 — 管理员销售页仍展示旧需求 SelectionRun

**严重级别：P1**

文件：

```text
apps/web/src/modules/mvp/store.ts:1047-1066
apps/web/src/modules/mvp/types.ts:72-75
apps/web/src/app/admin/sales/page.tsx:94-152
apps/web/src/app/api/admin/sales/route.ts
```

影响：

- 旧方案继续显示为当前需求对应的初步选型；
- 销售处置可能基于旧楼层、预算、场景或候选方案；
- Corrections 报告宣称 P1 已关闭，但该派生路径未覆盖。

最小修复方向：

- 在 `listSalesHandoffs()` 中取：
  `selectionRuns.find(run => run.requirementId === requirement?.id)`；
- 找不到时返回 `selectionRun=null`，页面显示“当前需求尚无初步选型”；
- 保持现有 API 响应形状，不需要 Schema 或 Migration；
- 增加旧需求 run + 新需求销售页测试。

### REV-APP-WB-R1-CORR-P2-01 — 工作台未从多条 run 中选择当前需求的 run

**严重级别：P2**

文件：

```text
apps/web/src/app/projects/[projectId]/page.tsx:76-91
apps/web/src/app/admin/projects/[projectId]/page.tsx:85-100
```

两个页面只传 `runs[0]`，未用当前 requirement id 从完整 run 集合中选择匹配项。

影响：

- 旧需求 run 晚于当前需求 run 写入时，会错误显示“重新生成”；
- 不产生错误销售推进，但会隐藏有效的当前结果；
- 与“当前需求对应 run 已完成应正确展示”的验收要求不完全一致。

最小修复方向：

- 使用共享纯函数
  `selectLatestSelectionForRequirement(runs, requirement?.id)`；
- 项目工作台和销售页共同复用；
- 测试 run 集合中同时存在旧需求较新 run 与当前需求较旧 run。

### REV-APP-WB-R1-CORR-P2-02 — 销售 E2E 未验证需求与 SelectionRun 关系

**严重级别：P2**

文件：

```text
apps/web/tests/e2e/mvp-catalog-sales.spec.ts:213-228
```

现有 E2E 只断言：

```text
selectionRun.status == COMPLETED
```

没有断言 SelectionRun 的 `requirementId` 与当前需求一致，也没有旧需求
方案场景，因此无法捕获 P1 销售页旁路。

该 E2E 本轮未执行。

## 6. P2 销售权限与载荷

### 6.1 已验证

客户项目和项目管理详情：

- 先通过现有 `PROJECT_READ` 页面门；
- 再用现有 `canAccessProject(..., SALES_MANAGE)` 计算结果；
- 只有 `SALES_MANAGE=true` 才调用
  `loadVisibleWorkbenchSalesHandoff()`；
- 该 helper 在 `allowed=false` 时返回 `null`，不调用传入查询；
- 销售摘要 JSX 只在 `canManageSales=true` 下渲染；
- 客户提交表单只接收 `projectId`，不接收销售摘要或内部预算；
- 客户需求预算仍保留。

`workbench-visibility.test.ts` 的纯单元测试验证了查询回调不会被调用。

状态：

```text
REV-APP-WB-R1-P2-01 sales data access: RESOLVED — SOURCE + PURE UNIT
RSC browser payload: NOT VERIFIED
```

### 6.2 限制

本轮未通过 Browser/RSC 实际网络载荷查看授权与未授权响应。静态源码没有
发现其他销售摘要传递到客户端组件的路径，但不能替代真实网络载荷验证。

### 6.3 权限异常

页面在权限加载失败或未知角色时会先失败或得到空权限集合，不会进入销售
查询。该结论来自现有鉴权调用顺序和 `canAccessProject` 语义，数据库/
Session 集成未执行。

## 7. ProjectStatus

已验证所有面向用户的 ProjectStatus 展示均标记为档案记录：

```text
apps/web/src/app/projects/page.tsx
apps/web/src/app/admin/projects/page.tsx
apps/web/src/app/projects/[projectId]/page.tsx
apps/web/src/app/admin/projects/[projectId]/page.tsx
```

工作台阶段由需求、选型、销售记录推导，不使用 ProjectStatus 表示当前业务
阶段。项目归档仍使用 ProjectStatus，用于阻止继续业务流程，这属于明确的
记录状态而不是进度百分比。

状态：

```text
REV-APP-WB-R1-P2-02: RESOLVED — SOURCE + PURE UNIT
```

## 8. E2E 文案与测试质量

`mvp-ui-routes.spec.ts:112-119` 已从“初步匹配完成”更新为：

```text
初步匹配结果
初步方案已生成
```

没有删除断言、跳过测试或扩大选择器。文案测试与当前页面一致。

除此之外：

- P1 主工作台有纯单元回归测试；
- 旧结果不能推进销售有纯单元测试；
- 销售页面旁路没有测试，见 P2-02；
- E2E 本轮没有执行。

## 9. P3 回归审查

### 场景映射

`BUSINESS_SCENARIO_CODES` 和 `getScenarioPresentation()` 已用于：

- 项目页；
- 项目列表；
- 顾问场景；
- 产品目录；
- 产品新增/编辑；
- 首页文案。

未知场景回退为“业务场景待确认”，有单元测试。

状态：`RESOLVED — SOURCE + PURE UNIT`。

文件生命周期技术状态标签未修改，保持在既有文件生命周期边界之外。

### 预算 0

前端预算上限 0 已拒绝，预算下限 0 仍允许；空值、负数、正常值和
1,000,000,000 边界均有纯单元测试。该规则与现有服务端缺失判断一致。

状态：`RESOLVED — SOURCE + PURE UNIT`。

### 被动销售状态

- 无 `SALES_MANAGE`：销售步骤显示权限受限，不显示销售处理 CTA；
- 有权限的销售用户：等待类状态可打开销售工作台，属于其实际可执行动作；
- 已关闭状态不显示处理 CTA；
- 通用“前往处理”文案已被具体 action label 替代。

状态：`RESOLVED — SOURCE + PURE UNIT`。

## 10. 越界修改检查

Corrections 没有修改：

```text
API Route
packages/contracts
Prisma Schema
Migration
服务端鉴权定义
权限码/角色定义
文件生命周期实现
Provider/Object Storage
```

`getLatestSalesHandoff()` 仍为既有表只读查询，并在页面权限判断后条件调用。

本轮审查没有执行 Git 写操作，也没有修改源码。

## 11. 测试证据边界

Corrections 报告记录：

```text
pnpm typecheck: PASS
Web unit: 6 files / 36 tests PASS
contracts: 4 files / 15 tests PASS
selection-engine: 2 files / 9 tests PASS
git diff --check: PASS
```

源码中的 `it()` 声明数量与 36 个相关 Web 测试一致。但本轮独立审查按授权
没有重跑测试，因此这些命令的最终状态是：

```text
REPORTED PASS — NOT INDEPENDENTLY RE-EXECUTED DURING THIS REVIEW
```

## 12. 未验证事项

```text
PostgreSQL multi-row latest requirement behavior: NOT VERIFIED
Database real role/session behavior:              NOT VERIFIED
Browser/RSC serialized payload:                    NOT VERIFIED
E2E execution:                                    NOT EXECUTED
Responsive/accessibility behavior:                NOT VERIFIED
Build/Startup Gate:                               NOT VERIFIED
Provider/IAM/deployment:                          NOT VERIFIED
Live remote HEAD:                                 NOT VERIFIED — NETWORK FAILURE
```

## 13. 状态汇总

```text
REV-APP-WB-R1-P1-01 main workbench:
RESOLVED — SOURCE + PURE UNIT

REV-APP-WB-R1-CORR-P1-01 admin sales stale selection:
OPEN

REV-APP-WB-R1-P2-01 sales permission/query gate:
RESOLVED — SOURCE STATIC; BROWSER PAYLOAD NOT VERIFIED

REV-APP-WB-R1-P2-02 ProjectStatus wording:
RESOLVED — SOURCE + PURE UNIT

REV-APP-WB-R1-P2-03 E2E text:
RESOLVED — TEST SOURCE; NOT EXECUTED

Relevant P3 corrections:
RESOLVED — SOURCE + PURE UNIT
```

P0: 0
P1: 1
P2: 2
P3: 0 confirmed in corrected scope

## 14. 修复前/后 Git 状态

审查开始：

```text
Tracked modified:             46
Staged:                       0
Deleted:                      0
Untracked status entries:     140
Untracked recursive files:    150
```

审查后新增本报告，预期：

```text
Tracked modified:             46
Staged:                       0
Deleted:                      0
Untracked status entries:     141
Untracked recursive files:    151 including two protected names
```

没有执行 Git 写操作、清理或测试。

## 15. 报告 SHA-256、大小和行数

```text
Self-excluding SHA-256:
34D4FC44F86203A4DC47712C3246BF412A6738DCA504BB37FE69113EF0322C23

Bytes:                    13875
Physical lines:           521
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符后，
对 UTF-8 文件字节计算 SHA-256。
