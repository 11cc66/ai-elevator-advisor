# APP-WORKBENCH-R1-CORRECTIONS 实施报告

## 0. 最终结论

```text
PASS WITH RESTRICTIONS — P1/P2 CORRECTIONS VERIFIED
```

本轮关闭了独立审查确认的：

- P1：旧需求版本 SelectionRun 被当作当前方案；
- P2：无 `SALES_MANAGE` 的项目读者可能获得销售专属数据；
- P2：`ProjectStatus` 被误呈现为真实当前阶段；
- P2：既有 E2E 文案断言与页面不一致；
- P3：场景展示重复/不一致；
- P3：预算 0 的前后端语义不一致；
- P3：被动销售状态显示“前往处理”。

限制：

- 未执行 PostgreSQL、Migration 或数据库集成测试；
- 未执行 E2E、Browser、Build、Provider、部署或真实服务；
- 最新需求由数据库 `ORDER BY version DESC LIMIT 1` 决定；本轮是源码验证
  和纯函数验证，不是 PostgreSQL 行为验证；
- 未授权页面 RSC 载荷通过源码调用顺序和纯权限门控测试验证，未进行真实
  Browser/Network 载荷抓取；
- 文件生命周期页面的技术状态文案没有修改，因为本轮禁止改变文件生命周期
  相关 UI/协议语义。

## 1. 修复前基线

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Live origin HEAD:             101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             41
Staged:                       0
Deleted:                      0
Untracked status entries:     138
Untracked recursive files:    147 including two protected names
```

基线和审查输入：

```text
Implementation report SHA-256:
BC0A10C7BD44D9B1B97228CFAE222D0DEB41CE2237D10A35544D13E788FC0204

Independent review SHA-256:
ABC1516AE957B7F2957B522E95FED048EF3A22189664E47D4D6D825C8B83304E
```

现有 23 个 P1-3/Route C-Minimal tracked 修改和其他未跟踪安全整改工作继续
保留，未在本轮清理或覆盖。

## 2. P1：SelectionRun 与当前需求绑定

### 2.1 最新需求的确定性

现有查询：

```text
apps/web/src/modules/mvp/store.ts:220-233
```

以：

```sql
ORDER BY "version" DESC
LIMIT 1
```

选择最新需求。Schema 对
`building_requirement(projectId, version)` 有唯一约束，因此版本内排序具有
确定性。数据库实际执行本轮未验证。

需求修改和确认都会创建新的 `BuildingRequirement.id`
（`store.ts:236-291`），SelectionRun 保存对应 `requirementId`
（`store.ts:808-826`）。因此工作台必须比较当前需求 id 与选型 run 的
`requirementId`。

### 2.2 实现

`apps/web/src/modules/workbench/presentation.ts` 现在：

- Selection 输入包含 `requirementId`；
- 当前需求包含 `id`；
- 只有
  `selectionRun.requirementId === currentRequirement.id`
  且状态为 `COMPLETED` 时，才显示当前方案完成；
- 关联不一致时标记“需求已更新，需要重新生成初步方案”；
- 旧结果的下一步是重新选型，不会进入销售阶段；
- 旧销售交接与新方案不一致时显示“方案已更新，销售跟进需复核”；
- 当前需求不存在时，即使存在 SelectionRun 也不显示为当前方案完成。

两条页面调用链：

```text
apps/web/src/app/projects/[projectId]/page.tsx
apps/web/src/app/admin/projects/[projectId]/page.tsx
```

都会把最新 Requirement 和最新 SelectionRun 一起传给工作台。

### 2.3 状态

```text
REV-APP-WB-R1-P1-01: RESOLVED — SOURCE + PURE UNIT
Latest requirement DB ordering: NOT VERIFIED — DATABASE TEST PROHIBITED
```

## 3. P2：销售专属信息权限一致性

### 3.1 现有权限

销售管理使用现有：

```text
PERMISSIONS.SALES_MANAGE
```

客户仍保留：

```text
PERMISSIONS.SALES_HANDOFF_CREATE
```

没有新增权限码、角色、策略或服务端鉴权规则。

### 3.2 查询门控

新增：

```text
apps/web/src/modules/workbench/visibility.ts
```

`loadVisibleWorkbenchSalesHandoff({ allowed, load })` 在 `allowed=false`
时立即返回 `null`，不执行传入的查询函数。

客户项目页和管理端项目页都在调用
`getLatestSalesHandoff()` 前计算：

```text
canManageSales = canAccessProject(actor, projectId, SALES_MANAGE)
```

然后通过上述权限门控执行查询。

`getLatestSalesHandoff()` 仍只在以下代码中出现：

```text
mvp/store.ts                    定义
projects/[projectId]/page.tsx   条件加载
admin/projects/[projectId]/page.tsx 条件加载
```

### 3.3 页面与载荷

- 两个项目详情的销售摘要、预算事项、状态和时间只在
  `canManageSales` 为真时渲染；
- 无 `SALES_MANAGE` 时销售记录变量为 `null`；
- 工作台只输出“销售进展仅向销售管理权限账号显示”，不输出实际状态；
- 客户提交销售交接的表单只接收 `projectId`，不接收已查询的销售摘要；
- 客户的需求预算仍保留在需求摘要和选型输入中，没有因销售权限收紧而被
  隐藏。

### 3.4 测试

`apps/web/tests/workbench-visibility.test.ts` 覆盖：

- `allowed=false` 时 `load` 回调从未被调用；
- `allowed=true` 时只调用一次并返回结果。

`workbench-presentation.test.ts` 还覆盖：

- 即使向纯函数传入销售状态，`salesVisible=false` 也不展示销售状态；
- 未授权用户看不到销售完成项；
- 具有提交权限的用户仍可看到“提交销售跟进”行动，但不读取内部状态。

### 3.5 状态

```text
REV-APP-WB-R1-P2-01: RESOLVED — SOURCE VERIFIED
Unauthorized server query: PURE UNIT VERIFIED NOT CALLED
RSC response payload: STATIC SOURCE VERIFIED / RUNTIME NOT VERIFIED
```

## 4. P2：ProjectStatus 与当前阶段分离

`ProjectStatus` 不再被显示为“当前项目阶段”：

- 项目列表显示 `档案记录：…`；
- 项目详情显示“档案记录状态”；
- 工作台继续使用需求、SelectionRun、销售记录推导当前流程；
- `ProjectStatus` 只继续用于归档阻断判断；
- 没有改变 ProjectStatus 写入流程或状态机。

新增：

```text
getProjectRecordStatusLabel(code)
```

测试验证：

- `DRAFT` 显示为“档案记录：资料整理中”；
- ProjectStatus 为 DRAFT 时，工作台仍可依据真实销售记录显示销售推进状态，
  不再把“DRAFT”显示成销售流程阶段。

### 状态

```text
REV-APP-WB-R1-P2-02: RESOLVED — SOURCE + PURE UNIT
```

## 5. P2：E2E 文案断言同步

已修改：

```text
apps/web/tests/e2e/mvp-ui-routes.spec.ts
```

原断言：

```text
初步匹配完成
```

改为精确检查当前页面语义：

```text
初步匹配结果
初步方案已生成
```

没有删除断言、扩大选择器或降低业务验证强度。

E2E 本轮没有执行。

### 状态

```text
REV-APP-WB-R1-P2-03: RESOLVED — TEST SOURCE
E2E EXECUTION: NOT VERIFIED
```

## 6. P3：场景映射统一

在 `presentation.ts` 新增唯一业务场景 code 清单：

```text
BUSINESS_SCENARIO_CODES
```

并统一复用 `getScenarioPresentation()`：

- 客户项目列表与详情；
- 管理端项目列表与详情；
- 顾问页和需求表单；
- 产品目录；
- 新增产品表单；
- 产品编辑表单；
- 首页场景文案。

产品编辑页不再直接显示 `OLD_BUILDING_ADDITION` 等内部值。

未知场景回退为“业务场景待确认”，不输出原始 code。

### 状态

```text
REV-APP-WB-R1-P3-01: RESOLVED — BUSINESS SCENARIO DISPLAY
File lifecycle technical status labels: OUT OF SCOPE / NOT MODIFIED
```

## 7. P3：预算 0 一致性

根据现有服务端缺失规则：

```text
apps/web/src/modules/advisor/missing-fields.ts:21-23
```

`budgetMax=0` 被视为缺失。前端现在同步将预算上限 0 判为无效：

- 预算下限仍允许 0；
- 预算上限必须大于 0；
- 不得将 0 解释为无限预算；
- 空字符串、`null`/`undefined` 仍表示未填写；
- 负数和超过 1,000,000,000 的值被拒绝；
- 预算上限不得低于下限；
- 输入控件 `min=1`。

### 状态

```text
REV-APP-WB-R1-P3-02: RESOLVED — SOURCE + PURE UNIT
```

## 8. P3：被动销售状态操作文案

`WorkbenchNextAction` 新增 `actionLabel`：

- 只有存在明确当前用户动作时才显示 CTA；
- 无销售管理权限的销售阶段显示 `权限受限`，不显示“待开始”；
- 无权限用户不显示销售数据，也不显示销售处理按钮；
- 被动状态不再使用通用“前往处理”文案；
- 销售管理权限用户打开销售工作台时使用“打开销售工作台”；
- 客户提交销售跟进仍使用明确“提交销售跟进”文案。

### 状态

```text
REV-APP-WB-R1-P3-03: RESOLVED — SOURCE + PURE UNIT
```

## 9. 本轮修改文件

### 9.1 核心业务逻辑

```text
apps/web/src/modules/workbench/presentation.ts
apps/web/src/modules/workbench/visibility.ts
apps/web/src/modules/advisor/form-validation.ts
```

### 9.2 页面与组件

```text
apps/web/src/components/project-workbench-summary.tsx
apps/web/src/app/projects/[projectId]/page.tsx
apps/web/src/app/admin/projects/[projectId]/page.tsx
apps/web/src/app/projects/page.tsx
apps/web/src/app/admin/projects/page.tsx
apps/web/src/app/projects/[projectId]/project-actions.tsx
apps/web/src/app/projects/[projectId]/advisor/[conversationId]/advisor-chat.tsx
apps/web/src/app/catalog/page.tsx
apps/web/src/app/admin/products/product-form.tsx
apps/web/src/app/admin/products/[productId]/product-edit-form.tsx
apps/web/src/app/page.tsx
```

### 9.3 测试

```text
apps/web/tests/workbench-presentation.test.ts
apps/web/tests/workbench-visibility.test.ts
apps/web/tests/requirement-form-validation.test.ts
apps/web/tests/e2e/mvp-ui-routes.spec.ts
```

### 9.4 报告

```text
docs/product/app-workbench-r1-corrections-report.md
```

没有修改：

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

## 10. 测试命令与结果

### 10.1 TypeScript

```powershell
pnpm typecheck
```

```text
Exit code: 0
Result: all emitted workspace typecheck tasks passed
```

### 10.2 相关 Web 纯单元测试

```powershell
pnpm --filter @elevator/web exec vitest run tests/workbench-presentation.test.ts tests/workbench-visibility.test.ts tests/requirement-form-validation.test.ts tests/advisor-missing-fields.test.ts tests/advisor-mock-provider.test.ts tests/mvp-project-access.test.ts
```

```text
Exit code: 0
Test Files: 6 passed
Tests:      36 passed
```

覆盖重点：

- 当前需求 SelectionRun 被接受；
- 旧需求 SelectionRun 被拒绝；
- 新需求草稿优先确认；
- requirementId 不存在/不匹配；
- 旧方案不会推进销售；
- 没有最新需求时不接受历史方案；
- 销售查询权限门；
- 未授权工作台不显示销售状态；
- 销售交接早于当前选型时要求复核；
- ProjectStatus 与当前工作台阶段分离；
- 三场景和未知场景 fallback；
- 预算空值、0、负数、正常值和边界。

### 10.3 Contracts

```powershell
pnpm --filter @elevator/contracts test
```

```text
Exit code: 0
Test Files: 4 passed
Tests:      15 passed
```

### 10.4 Selection engine

```powershell
pnpm --filter @elevator/selection-engine test
```

```text
Exit code: 0
Test Files: 2 passed
Tests:      9 passed
```

### 10.5 Diff

```powershell
git diff --check
```

```text
Exit code: 0
```

Git 仅输出既有 LF/CRLF 转换提示，没有空白错误、staged change 或删除。

## 11. 缺陷最终状态

| Finding | 最终状态 |
|---|---|
| `REV-APP-WB-R1-P1-01` | `RESOLVED — SOURCE + PURE UNIT` |
| `REV-APP-WB-R1-P2-01` | `RESOLVED — SOURCE; QUERY GATE PURE UNIT VERIFIED` |
| `REV-APP-WB-R1-P2-02` | `RESOLVED — SOURCE + PURE UNIT` |
| `REV-APP-WB-R1-P2-03` | `RESOLVED — TEST SOURCE; E2E NOT EXECUTED` |
| `REV-APP-WB-R1-P3-01` | `RESOLVED — BUSINESS SCENARIO DISPLAY` |
| `REV-APP-WB-R1-P3-02` | `RESOLVED — SOURCE + PURE UNIT` |
| `REV-APP-WB-R1-P3-03` | `RESOLVED — SOURCE + PURE UNIT` |

尚未解决的高风险问题：

```text
P0: 0
P1 in correction scope: 0
P2 in correction scope: 0
```

保留的边界事项：

- 文件生命周期技术状态标签未修改；
- PostgreSQL 多版本数据行为未执行；
- Browser/RSC 实际载荷未抓取；
- 销售角色真实 Session 集成未执行。

## 12. 未执行验证

```text
PostgreSQL:                    NOT EXECUTED
Migration:                     NOT EXECUTED
Database integration tests:    NOT EXECUTED
E2E:                           NOT EXECUTED
Browser Runtime:               NOT EXECUTED
Build:                         NOT EXECUTED
Startup security gate:         NOT EXECUTED
Real service/Worker:           NOT EXECUTED
Provider/IAM/ACL:              NOT EXECUTED
Deployment:                    NOT EXECUTED
```

`pnpm typecheck` 刷新了 Git ignored 的：

```text
apps/web/tsconfig.tsbuildinfo
```

该文件不是应用源码、运行时入口或发布产物。

## 13. Git 后状态

代码修改完成后、报告创建前：

```text
Tracked modified:             46
Staged:                       0
Deleted:                      0
Untracked status entries:     139
Untracked recursive files:    149
```

报告完成后预期：

```text
Tracked modified:             46
Staged:                       0
Deleted:                      0
Untracked status entries:     140
Untracked recursive files:    150 including two protected names
```

本报告新增的 5 个 tracked modified 是：

```text
apps/web/src/app/admin/products/[productId]/product-edit-form.tsx
apps/web/src/app/admin/products/product-form.tsx
apps/web/src/app/catalog/page.tsx
apps/web/src/app/page.tsx
apps/web/tests/e2e/mvp-ui-routes.spec.ts
```

其余修改属于 APP-WORKBENCH-R1 已存在的 R1 文件；23 个 P1-3/Route C-
Minimal 既有 tracked 修改和其他未跟踪工作未被清理或归属为本轮。

## 14. 报告摘要与文件大小

```text
Self-excluding SHA-256:
74E342FED64D6AF4C9BE2B5DF349A97CE4AEB7303E7EEFD5CCB37323B4167B0F

Bytes:                    14297
Physical lines:           547
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符后，
对 UTF-8 文件字节计算 SHA-256。
