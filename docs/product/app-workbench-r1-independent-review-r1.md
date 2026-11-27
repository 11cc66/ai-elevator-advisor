# APP-WORKBENCH-R1 独立实施审查 R1

## 0. 最终结论

```text
FAIL — CORRECTIONS REQUIRED
```

本次审查确认实现范围和主要 UI 结构与实施报告大体一致，但存在一个高优先级
业务一致性缺陷：

```text
REV-APP-WB-R1-P1-01
旧需求版本生成的 SelectionRun 会被新需求版本的项目工作台误认为当前完成方案。
```

该缺陷可使项目在需求已经修改后仍显示“初步方案已完成”，并把下一步错误
推进到销售跟进。依据本轮要求，存在 P1 时不得进入下一批功能开发。

本轮未修改任何应用源码、Schema、Migration、测试、配置或既有报告，只新增
本独立审查报告。

## 1. 当前 Git 基线

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Live remote HEAD:             NOT VERIFIED
Tracked modified:             41
Staged:                       0
Deleted:                      0
Untracked status entries:     137
Untracked recursive files:    146 including two protected names
```

本地 `origin/main` 与 HEAD 相同。根据实施报告，实施尝试复核 live remote 时
遇到 GitHub 连接重置，因此本轮不把在线远端同步标为已通过。

审查环境与 APP-WORKBENCH-R1 实施环境是同一主机、同一工作区，不是独立
执行环境。本次没有执行 pnpm、Vitest、PostgreSQL、Migration、E2E、
Browser Runtime、Build、Provider 或服务启动。

## 2. 输入完整性与保护

已核对：

```text
Implementation report:
docs/product/app-workbench-r1-implementation-report.md
Bytes: 14758
Lines: 484
SHA-256: BC0A10C7BD44D9B1B97228CFAE222D0DEB41CE2237D10A35544D13E788FC0204

Baseline report:
docs/product/app-development-resumption-and-next-batch-r1.md
SHA-256: D588F96F28A132137706490DCEAF2BEC90DA4EECC2AEE7F7A8D80DD32D9924A7
```

实施报告的整文件摘要与报告内容一致。

保护规则执行结果：

- `$null` 未读取内容、未计算哈希、未修改、未移动、未删除；
- `UNKNOWN'` 未读取内容、未修改、未移动、未删除；
- 未删除、覆盖、移动、重命名或启动 `apps/web/.next`、`apps/worker/dist`；
- 未读取或泄露 `.env`、`.env.test`、密钥、密码、Token 或连接字符串；
- 未执行 Git add、commit、push、reset、restore、clean、checkout 或 stash；
- 未修改既有报告、用户文件或工作区中的未跟踪文件。

## 3. 实施文件与既有工作区分

### 3.1 实施前既有工作

APP-WORKBENCH-R1 实施前：

```text
23 tracked modified
128 untracked status entries
134 untracked recursive files
```

这 23 个 tracked modified 是既有的 P1-3/Route C-Minimal 安全整改工作。
本轮实施没有修改这些既有路径。

### 3.2 APP-WORKBENCH-R1 可归属修改

以下 18 个既有文件由本批次修改，实施前均为 clean：

```text
apps/web/src/app/admin/customers/customer-form.tsx
apps/web/src/app/admin/customers/page.tsx
apps/web/src/app/admin/forbidden/page.tsx
apps/web/src/app/admin/page.tsx
apps/web/src/app/admin/projects/[projectId]/building-form.tsx
apps/web/src/app/admin/projects/[projectId]/page.tsx
apps/web/src/app/admin/projects/[projectId]/unit-form.tsx
apps/web/src/app/admin/projects/page.tsx
apps/web/src/app/admin/projects/project-form.tsx
apps/web/src/app/admin/sales/follow-up-form.tsx
apps/web/src/app/admin/sales/page.tsx
apps/web/src/app/projects/[projectId]/advisor/[conversationId]/advisor-chat.tsx
apps/web/src/app/projects/[projectId]/advisor/page.tsx
apps/web/src/app/projects/[projectId]/page.tsx
apps/web/src/app/projects/[projectId]/project-actions.tsx
apps/web/src/app/projects/new/project-create-form.tsx
apps/web/src/app/projects/page.tsx
apps/web/src/modules/mvp/store.ts
```

本批次新增 11 个源码/测试文件：

```text
apps/web/src/app/admin/loading.tsx
apps/web/src/app/projects/loading.tsx
apps/web/src/components/form-feedback.tsx
apps/web/src/components/loading-panel.tsx
apps/web/src/components/project-workbench-summary.tsx
apps/web/src/components/status-badge.tsx
apps/web/src/modules/access/role-summary.ts
apps/web/src/modules/advisor/form-validation.ts
apps/web/src/modules/workbench/presentation.ts
apps/web/tests/requirement-form-validation.test.ts
apps/web/tests/workbench-presentation.test.ts
```

另有实施报告 1 个：

```text
docs/product/app-workbench-r1-implementation-report.md
```

`apps/web/tsconfig.tsbuildinfo` 是 `pnpm typecheck` 刷新的 Git ignored
TypeScript 缓存；实施报告已披露该副作用。

### 3.3 无归属判断

其他 API、Upload、Download、Worker、file-storage、Schema、Migration、
文档和其他未跟踪文件属于既有工作。本轮不得将它们归因于
APP-WORKBENCH-R1。

## 4. 授权边界检查

| 边界 | 结果 | 证据 |
|---|---|---|
| API Route | `NOT MODIFIED BY R1` | R1 文件清单无 Route Handler |
| packages/contracts | `NOT MODIFIED` | Git diff 无 contracts 文件 |
| Prisma Schema | `NOT MODIFIED BY R1` | 当前 Schema 修改属于既有工作 |
| Migration | `NOT MODIFIED BY R1` | R1 文件清单无 Migration |
| 服务端鉴权/权限定义 | `NOT MODIFIED` | `permissions.ts`、`policy.ts` 和 Route Handler 不在 R1 修改集 |
| File lifecycle/upload/download | `NOT MODIFIED BY R1` | 文件服务和 API 的现有修改不属于本批次 |
| Provider/IAM/ACL/KMS | `NOT MODIFIED` | 无 Provider 或 IAM 文件 |
| 数据库持久化规则 | `READ-ONLY QUERY ADDED` | `getLatestSalesHandoff()` 只读既有表 |
| Git 写操作 | `NONE` | 无 staged/commit/push |

新增 `getLatestSalesHandoff(projectId)` 属于与项目工作台直接相关的只读
数据库访问，不修改数据库状态、Schema、Migration 或权限定义，因此属于
本批次授权范围内。其权限使用方式另见 `P2-01`。

## 5. Findings

### REV-APP-WB-R1-P1-01 — 旧需求版本的选型结果被当作当前完成方案

**严重级别：P1**

证据：

- `apps/web/src/modules/workbench/presentation.ts:359-373` 的工作台
  Selection 输入没有 `requirementId`；
- `presentation.ts:390-394` 只检查 `status === "COMPLETED"`；
- `presentation.ts:408-413` 直接把该状态标记为已完成；
- `presentation.ts:491-503` 添加“已生成初步方案”并把销售交接设为下一步；
- `apps/web/src/modules/mvp/store.ts:247-291` 每次需求修改/确认都会创建新的
  `BuildingRequirement.id`；
- `store.ts:808-826` 的 SelectionRun 明确保存 `requirementId`；
- `store.ts:861-879` 的查询也返回 `requirementId`；
- 客户项目页 `apps/web/src/app/projects/[projectId]/page.tsx:76-80` 与管理端
  项目页 `apps/web/src/app/admin/projects/[projectId]/page.tsx:85-90` 都只把
  `runs[0]` 传给工作台，没有验证其 `requirementId` 与最新需求 id 相等。

复现条件：

```text
1. 建立并确认需求 A；
2. 对需求 A 生成 SelectionRun R；
3. 修改需求，创建并确认需求 B；
4. 不重新运行选型；
5. 打开项目工作台。
```

实际结果：

```text
R.status = COMPLETED
→ “初步方案”显示 COMPLETE
→ completedItems 包含“已生成初步方案”
→ nextAction 进入销售跟进方向
```

但 R 的输入快照属于需求 A，不属于当前需求 B。

影响：

- 把过期方案当作当前有效方案；
- 错误地把项目推进至销售沟通；
- 客户和销售可能依据已失效的楼层、预算或场景继续沟通；
- 与“不得把未完成事项显示为完成”的批次要求冲突。

最小修复方向：

- 在工作台 Selection 输入中加入 `requirementId`；
- 仅当
  `selectionRun.requirementId === currentRequirement.id`
  且状态为 `COMPLETED` 时才标记当前方案完成；
- 不匹配时显示“需求已变更，需重新选型”，下一步指向
  `advisor`；
- 增加“旧方案 + 新需求”单元测试。

不需要 Schema/Migration 修改；SelectionRun 已有 `requirementId`。

### REV-APP-WB-R1-P2-01 — 销售交接详情对所有项目读者展示，权限语义不一致

**严重级别：P2**

证据：

- 客户项目页只要求 `PROJECT_READ`，随后直接读取销售交接，并展示
  `summary` 和 `budgetConcern`：
  - `apps/web/src/app/projects/[projectId]/page.tsx:39-64`
  - `page.tsx:330-374`
- 管理端项目详情只要求 `PROJECT_READ`，同样展示销售摘要和预算事项：
  - `apps/web/src/app/admin/projects/[projectId]/page.tsx:43-78`
  - `page.tsx:167-195`
- 独立销售跟进页和 API 却要求 `SALES_MANAGE`：
  - `apps/web/src/app/admin/sales/page.tsx:22-40`
  - `apps/web/src/app/api/admin/sales/route.ts`

具有项目读取权限但无 `SALES_MANAGE` 的账号现在可以绕过销售页面/API
的读取边界，看到项目级销售摘要和预算事项。

影响属于项目范围内有限披露，不构成跨项目访问；但权限语义与既有销售
功能不一致。尤其是后续若销售摘要增加内部备注，该页面会直接扩大披露面。

最小修复方向：

- 普通项目读者只显示销售状态，不显示 `summary`/`budgetConcern`；
- 销售详情仅在 `SALES_MANAGE` 时展示；
- 表单预填只对具有提交权限且有明确业务需求的账号开放；
- 若要向客户展示其自己提交的摘要，应先明确字段公开规则，而不是复用
  内部销售记录。

### REV-APP-WB-R1-P2-02 — ProjectStatus 被显示为当前项目阶段，但该字段不随业务流程更新

**严重级别：P2**

证据：

- 客户项目列表和管理端项目列表把 `project.status` 标成项目阶段：
  - `apps/web/src/app/projects/page.tsx:43-58`
  - `apps/web/src/app/admin/projects/page.tsx:60-75`
- 项目详情同样展示为“项目状态”：
  - `apps/web/src/app/projects/[projectId]/page.tsx:71-73`
  - `apps/web/src/app/admin/projects/[projectId]/page.tsx:80-81`
- 创建客户项目和管理端项目时都固定写入 `DRAFT`：
  - `apps/web/src/modules/mvp/store.ts:946-965`
  - `apps/web/src/modules/projects/service.ts:117-126`
- 需求修改、确认、选型和销售交接流程没有把 ProjectStatus 更新到
  `ACTIVE`/其他流程阶段。

复现：

```text
创建项目 -> 完成需求确认 -> 生成方案 -> 提交销售交接
```

项目列表/详情头部仍可能显示“资料整理中”，而同页工作台已显示后续阶段
完成。这会降低用户对“当前阶段”的信任。

最小修复方向：

- 将现有标签改为“项目档案状态”，避免与派生工作台混淆；
- 项目列表如要显示真实当前阶段，需要由可信的需求/选型/销售记录推导，
  而不是复用 `ProjectStatus`；
- 不新增 ProjectStatus 枚举值。

### REV-APP-WB-R1-P2-03 — 既有 E2E 源与修改后的页面文本不一致

**严重级别：P2**

证据：

- `apps/web/tests/e2e/mvp-ui-routes.spec.ts:112-118` 仍要求项目页面包含
  `初步匹配完成`；
- 修改后的项目页面在
  `apps/web/src/app/projects/[projectId]/page.tsx:180-188`
  使用 `初步匹配结果` 和状态 badge；
- 当前项目页没有其他 `初步匹配完成` 文本。

因此该 E2E 源在获得 Browser/E2E 授权后执行时，当前静态输出预期无法与
测试断言匹配。本轮禁止执行 E2E，所以没有运行验证；但源码级不一致已经
确定。

最小修复方向：

- 在单独授权的测试维护批次中更新 E2E 断言；或
- 保留原业务文本并同时增加状态 badge；
- 不应通过删除断言或跳过 E2E 解决。

### REV-APP-WB-R1-P3-01 — “单一场景展示模型”覆盖不完整，仍有重复映射和原始枚举

**严重级别：P3**

证据：

- `apps/web/src/app/catalog/page.tsx:12-15` 仍维护独立的场景标签；
- `apps/web/src/app/admin/products/product-form.tsx:89-91` 仍硬编码旧名称；
- `apps/web/src/app/admin/products/[productId]/product-edit-form.tsx:95-97`
  在管理界面直接显示场景枚举值；
- 客户可见的文件页面仍直接显示技术值：
  - `apps/web/src/app/projects/[projectId]/files/page.tsx:72`
  - `.../files/page.tsx:82-88`
  - `.../files/[fileId]/page.tsx:39,43,91-94`
  - `.../extractions/[extractionId]/page.tsx:92`

实施报告 3.1 声称客户和用户可见页面不再直接显示这些英文枚举，这一表述
范围过宽。文件生命周期 UI 不在本批次授权内，相关原始状态可能是既有行为，
但报告应明确其为未覆盖项，不能表述为全局完成。

最小修复方向：

- 客户可见页面复用统一展示模型；
- 产品管理页至少使用中文 label，值仍保持原枚举；
- 文件状态标签是否修改应受文件 UI/生命周期边界另行授权；
- 如不修改，实施报告应缩小完成声明并记录 NOT VERIFIED/剩余项。

### REV-APP-WB-R1-P3-02 — 预算 0 的客户端有效性与服务端“缺失”判定不一致

**严重级别：P3**

证据：

- `apps/web/src/modules/advisor/form-validation.ts:93-104` 接受
  `budgetMax=0`，且 `124-130` 只检查上下限关系；
- `apps/web/src/modules/advisor/missing-fields.ts:21-23` 使用
  `if (!requirement.budgetMax)` 判断缺失，因此 `0` 被视为缺失；
- contracts 当前定义为 `nonnegative()`。

复现：

```text
输入预算上限 0
→ 客户端校验通过
→ 保存请求成功
→ 服务端重新派生 missingFields，budgetMax 再次标记为待补充
```

这不是本轮新增的数据破坏，但前端“校验与 contracts 一致”的表述没有覆盖
业务派生规则。该问题还可能影响预算判断。

最小修复方向：

- 先由业务确认预算 0 是否可为有效值；
- 若不可为有效值，前端限制为正数并统一 contracts；
- 若可为有效值，服务端 missing 判断应改为 `undefined/null`；
- 增加 0、缺省和边界金额测试。

### REV-APP-WB-R1-P3-03 — 被动等待状态仍显示“前往处理”操作

**严重级别：P3**

证据：

- `apps/web/src/modules/workbench/presentation.ts:555-575` 对等待销售或
  销售跟进中返回 `target: "sales"`；
- `apps/web/src/components/project-workbench-summary.tsx:64-79` 只要存在
  `actionHref` 就显示“前往处理”；
- 客户项目页 `page.tsx:82-89` 把某些销售状态映射到销售表单锚点。

结果是“等待销售人员联系”或“销售正在跟进”旁边仍可能出现操作按钮，
用户可能把状态查看误解为自己的待办事项。

最小修复方向：

- 给 NextAction 增加 `actionable` 或操作文案；
- 被动等待状态不显示“前往处理”，只保留状态说明；
- 管理员可单独显示“打开销售工作台”。

## 6. A–F 审查结果

### A. 业务场景与状态映射

```text
PARTIAL
```

- 核心项目、需求和销售场景映射正确；
- 未知状态 fallback 不直接输出原始代码；
- 产品目录、产品管理和文件页面仍未全部复用统一映射；
- ProjectStatus 被误当成业务流程阶段。

### B. 项目工作台

```text
FAIL
```

- 需求缺失、需求不完整、无方案和无匹配的基本分支正确；
- 工作台没有把 SelectionRun 与当前 Requirement id 绑定，存在 P1；
- ProjectStatus 与派生阶段可能相互矛盾；
- 销售状态没有版本绑定，无法完整证明其对应当前方案；该风险保持
  `NOT VERIFIED`。

### C. 选型方案与预算

```text
PARTIAL
```

- 推荐类型、预算状态、场景和来源均使用现有数据，没有新增参数推断；
- 专业审核和正式报价边界文案正确；
- 预算 0 的客户端/服务端语义不一致；
- 空价格显示“待询价”；
- 选型与最新需求的绑定缺失。

### D. 管理端角色与权限展示

```text
PARTIAL
```

- `CUSTOMER_MANAGE` 判断与现有全局权限语义一致；
- 隐藏客户创建表单仅属于 UI 改善，服务端鉴权未改；
- 页面明确说明隐藏按钮不替代服务端鉴权；
- 角色摘要查询不在单元测试覆盖内；
- 销售交接详情绕过销售模块读取权限的管理存在 P2 风险。

### E. 表单交互

```text
PARTIAL
```

- 客端审查能确认 maxLength 与 contracts 的主要上限一致；
- 数值整数、正数、最大值和预算上下限检查正确；
- 表单使用错误/成功角色和 `aria-invalid`；
- React state 提交锁降低重复提交，但不能作为服务端幂等保证；
- 预算 0 分支不一致；
- 本轮未执行浏览器交互，提交中行为、焦点和屏幕阅读器结果均
  `NOT VERIFIED`。

### F. 回归与工程质量

```text
PARTIAL
```

- 新纯函数和复用展示组件结构清楚；
- 没有新增第三方依赖或弱化 TypeScript；
- 没有 API/Schema/Migration 越界；
- 仍存在重复场景映射；
- 既有 E2E 源与新页面文本不一致；
- 没有组件级、页面级、权限 UI 或工作台版本边界测试。

## 7. 测试覆盖审查

实施报告记录：

```text
Web related:       5 files / 22 tests PASS
Contracts:         4 files / 15 tests PASS
Selection engine:  2 files / 9 tests PASS
Typecheck:         PASS
```

现有源码中的测试声明与上述文件/测试数一致。本轮没有执行测试，也没有
发现独立保留的执行日志，因此这些结果只能标记为：

```text
REPORTED PASS — NOT INDEPENDENTLY RE-EXECUTED
```

新增测试覆盖了：

- 三场景 label；
- 未知项目状态 fallback；
- 需求缺失和无选型；
- `NO_VALID_MATCH`；
- 销售跟进状态；
- 基础数值范围和预算上下限；
- 既有权限和 Mock Provider 逻辑。

未覆盖：

- SelectionRun 属于旧 Requirement；
- ProjectStatus 与工作台阶段冲突；
- 销售摘要权限差异；
- 角色摘要真实数据；
- 表单 pending/错误/成功状态；
- loading、403 和页面导航；
- 页面输出与 E2E 文本契约。

## 8. 已确认无问题的项目

- 没有修改 API Route、contracts、Prisma Schema、Migration、权限定义或
  服务端鉴权；
- 没有修改文件上传、下载、清理、恢复或生命周期实现；
- 没有接入 Provider、IAM、ACL、KMS 或真实 AI；
- `CUSTOMER_MANAGE` 全局权限判断与服务端客户写接口一致；
- 核心场景映射和未知状态 fallback 有纯单元测试；
- `NO_VALID_MATCH` 不会被工作台标记为已完成方案；
- 专业审核/正式报价/合同边界文案保留；
- 表单主要 maxLength 与现有 contracts 上限一致；
- 本轮审查没有执行或弱化任何测试。

## 9. NOT VERIFIED / BLOCKED

```text
Independent test execution:             NOT EXECUTED BY REVIEW
PostgreSQL data branches:               NOT VERIFIED
Real Session and Role assignment:       NOT VERIFIED
E2E behavior:                           NOT EXECUTED
Browser/keyboard/mobile behavior:       NOT VERIFIED
Responsive visual review:               NOT VERIFIED
Real sales permission interaction:      NOT VERIFIED
Build/Startup Gate:                     NOT VERIFIED
Provider/IAM/deployment:                NOT VERIFIED
Live remote HEAD:                       NOT VERIFIED
```

## 10. 修复顺序与准入效果

最小必要修复顺序：

1. 修复 `P1-01`，将 SelectionRun 绑定到当前 Requirement；
2. 增加 stale-selection 单元测试；
3. 明确销售交接读取字段的权限边界；
4. 将 ProjectStatus 改称档案状态或改为可靠阶段来源；
5. 修正既有 E2E 源；
6. 处理 P3 展示、预算 0 和被动操作文案问题。

在 `P1-01` 关闭前：

```text
Next feature batch: BLOCKED
Production/Stage admission: NOT AUTHORIZED
```

P2/P3 修复仍应遵守本轮只读审查边界；实际修改需要后续明确实施授权。

## 11. Git 后状态

新增本报告前的状态：

```text
Tracked modified:             41
Staged:                       0
Deleted:                      0
Untracked status entries:     137
Untracked recursive files:    146
```

新增本报告后预期：

```text
Tracked modified:             41
Staged:                       0
Deleted:                      0
Untracked status entries:     138
Untracked recursive files:    147 including two protected names
```

没有执行 Git 写操作或清理。

## 12. 报告摘要与文件大小

```text
Self-excluding SHA-256:
C42C4A62E8950FB715AF188884F7F555F39F2EF84FCAD52AA00AA9D75B945B29

Bytes:                    20650
Physical lines:           586
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符后，
对 UTF-8 文件字节计算 SHA-256。
