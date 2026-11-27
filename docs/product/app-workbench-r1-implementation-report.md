# APP-WORKBENCH-R1 安全 UI 与工作流实施报告

## 0. 最终结论

```text
PASS WITH RESTRICTIONS —
APP-WORKBENCH-R1 SOURCE IMPLEMENTATION AND STATIC VERIFICATION COMPLETE;
BROWSER, INTEGRATION AND PRODUCTION BEHAVIOR NOT VERIFIED
```

本批次完成了项目场景、工作台进展、方案与销售状态、管理端只读权限呈现、
表单交互和页面加载状态的源码改进。

本轮没有修改：

- API Route 或公共 contracts；
- Prisma Schema、Migration 或数据库数据；
- 服务端角色、权限策略或鉴权逻辑；
- 文件上传、下载、删除、清理、恢复或生命周期协议；
- Provider、IAM/ACL、KMS、服务、Scheduler 或部署配置。

`pnpm typecheck` 和本轮新增/相关纯单元测试通过。由于授权明确禁止 E2E、
Browser Runtime、数据库测试和 Build，本轮不能证明页面在真实浏览器、
真实 PostgreSQL 数据或完整服务环境中通过。

## 1. 实施前后 Git 基线

### 1.1 实施前

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             23
Staged:                       0
Deleted:                      0
Untracked status entries:     128
Untracked recursive files:    134 including two protected names
```

实施前的 23 个 tracked modified 属于既有 P1-3/Route C-Minimal 安全整改，
本轮没有修改这些文件。实施前已存在的 untracked 文件也未被覆盖、移动或删除。

### 1.2 实施后

代码与本报告完成后的最终状态：

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
Local origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Live origin HEAD:             NOT VERIFIED — CONNECTION RESET
Tracked modified:             41
Staged:                       0
Deleted:                      0
Untracked status entries:     137
Untracked recursive files:    146 including two protected names
```

本批次新增修改的 18 个 tracked 文件在实施前均为 clean；新增源码、组件、
测试和报告均使用新路径，未与既有未跟踪安全整改文件重名。

## 2. 文件与安全保护

- `$null` 未读取内容、未计算哈希、未修改、未移动、未删除；
- `UNKNOWN'` 未读取内容、未修改、未移动、未删除；
- 未删除、覆盖、移动、重命名或启动 `apps/web/.next`、`apps/worker/dist`；
- 未读取或泄露 `.env`、`.env.test`、密钥、密码、Token 或连接字符串；
- 未执行 Git add、commit、push、reset、restore、clean、checkout 或 stash；
- 未删除、覆盖或清理既有报告和用户文件。

已披露副作用：

```text
apps/web/tsconfig.tsbuildinfo
```

`pnpm typecheck` 使用现有 incremental 配置，刷新了该 Git ignored 的
TypeScript 缓存。它不是业务源码、运行时入口或发布产物。本轮没有可比较的
原始缓存副本，因此不声称其字节未变化。

## 3. 完成的页面与交互

### 3.1 业务场景展示

新增单一展示模型
`apps/web/src/modules/workbench/presentation.ts`，统一现有枚举：

```text
OLD_BUILDING_ELEVATOR / OLD_BUILDING_ADDITION -> 旧楼加装电梯
EXISTING_ELEVATOR_RENOVATION                  -> 旧电梯更新
NEW_BUILDING_INSTALLATION                     -> 新楼安装电梯
```

客户和用户可见页面不再直接显示范围、需求、方案、预算、销售或数据分类的
英文枚举。未知内部值显示为明确的中文“待确认”，不向客户输出原始技术状态。

未新增业务枚举或状态流转。

### 3.2 项目列表

客户项目列表与管理端项目列表现在展示：

- 统一场景名称和场景说明；
- 项目阶段的中文状态；
- 数据分类；
- 项目简介入口；
- 空列表状态；
- 管理端只读状态提示。

项目列表没有虚构百分比或完成事项。

### 3.3 项目工作台

新增基于现有业务记录的派生工作台：

```text
需求整理
客户确认
初步方案
销售跟进
```

每个阶段仅由现有 `BuildingRequirement`、`SelectionRun` 和
`SalesHandoff` 记录推导，不使用预计百分比。

项目详情现在展示：

- 当前阶段；
- 已完成事项；
- 待处理事项；
- 下一步行动；
- 需求版本和缺失项；
- 初步方案状态；
- 销售交接状态；
- 专业审核边界。

无需求、需求不完整、未确认、无选型、无有效匹配、销售跟进中和已关闭
分别有不同提示。

勘察和专业工程审核没有已确认的数据模型状态，因此工作台没有虚构“勘察
完成度”；页面明确说明这些事项不在当前工作台完成范围内。

### 3.4 选型与销售展示

项目详情保留现有确定性选型结果，并改善：

- `PRIMARY / ALTERNATIVE / IMPROVEMENT` 的中文标签；
- 预算判断的中文标签；
- 适用场景；
- 数据状态；
- 来源引用；
- 缺失信息；
- 风险提示；
- 首选、备选和改善候选的视觉区分。

销售状态统一为：

```text
待销售跟进
销售跟进中
客户已反馈
跟进已关闭
```

页面继续明确：销售交接不是正式报价、合同或工程批准。价格异议由销售
人员跟进，AI 不生成或修改金额。

### 3.5 顾问交互

现有 `AdvisorChat` 增加：

- 当前业务场景和需求状态；
- 消息、保存、确认和选型互斥的 pending 状态；
- 重复点击保护；
- 保存、确认和选型成功反馈；
- 服务端错误反馈；
- 需求数值字段的前端范围校验；
- 楼层、层高、总高和预算字段的错误定位；
- 缺失字段中文名称；
- Mock AI / 真实模型标签，不把 Mock 冒充真实 AI。

新增纯函数：

```text
apps/web/src/modules/advisor/form-validation.ts
```

校验范围与现有 contracts 保持一致：

- 楼层：1–200 的整数；
- 层高：大于 0，最大 20；
- 建筑总高：大于 0，最大 1000；
- 预算：0–1,000,000,000 的整数；
- 预算上限不得低于下限。

### 3.6 管理端只读权限 UI

管理端现在提供：

- 当前账号角色名称、范围和说明；
- 全局权限数量与项目范围数量；
- 各管理入口的“可操作 / 只读”状态；
- 客户页按 `CUSTOMER_MANAGE` 条件显示创建表单；
- 项目页按现有项目范围权限显示维护表单；
- 403 页面返回工作台和项目列表的明确入口。

`listActorRoleSummaries()` 只读取当前用户的现有角色分配。没有修改角色、
用户分配、权限码、会话、Route Handler 鉴权或数据库 ACL。

页面隐藏按钮只改善体验，不构成安全控制；服务端鉴权仍是权威。

### 3.7 表单和加载状态

项目、客户、建筑、安装单元、顾问和销售跟进表单增加：

- 提交中禁用相关控件；
- 重复提交前置保护；
- 成功与失败反馈；
- 明确 `role="alert"` / `role="status"`；
- 字段最大长度；
- 顾问数值字段 `aria-invalid` 和错误说明；
- 空白字符串前置提示。

新增项目端和管理端 route-level loading 状态，并提供可访问的加载角色。

## 4. API、类型与业务规则影响

### 4.1 未变化

```text
API Route:                    UNCHANGED
packages/contracts:           UNCHANGED
Prisma Schema:                UNCHANGED
Migration:                    UNCHANGED
Server authorization policy:  UNCHANGED
Role / permission definitions:UNCHANGED
File lifecycle protocol:      UNCHANGED
Provider boundary:            UNCHANGED
```

### 4.2 新增内部只读能力

`apps/web/src/modules/mvp/store.ts` 新增：

```text
getLatestSalesHandoff(projectId)
```

该函数只读取既有 `sales_handoff` 记录，用于项目工作台展示。它不创建、
更新或删除记录，也不改变 API contract。

### 4.3 新增类型

新增展示类型、工作台输入输出类型、表单校验结果和角色摘要类型。它们均为
Web 内部类型，没有修改共享 contracts。

## 5. 修改文件清单

### 5.1 修改的既有 tracked 文件

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

### 5.2 新增源码与组件

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
```

### 5.3 新增测试

```text
apps/web/tests/requirement-form-validation.test.ts
apps/web/tests/workbench-presentation.test.ts
```

### 5.4 报告

```text
docs/product/app-workbench-r1-implementation-report.md
```

## 6. 验证证据

### 6.1 TypeScript

命令：

```powershell
pnpm typecheck
```

结果：

```text
Exit code: 0
Scope: 8 of 9 workspace projects
All emitted typecheck tasks completed:
  packages/authority-core
  packages/file-storage
  packages/contracts
  packages/selection-engine
  packages/shared-ui
  apps/worker
  apps/web
```

分类：`STATIC SOURCE VERIFICATION`。

### 6.2 相关 Web 纯单元测试

命令：

```powershell
pnpm --filter @elevator/web exec vitest run tests/workbench-presentation.test.ts tests/requirement-form-validation.test.ts tests/advisor-missing-fields.test.ts tests/advisor-mock-provider.test.ts tests/mvp-project-access.test.ts
```

结果：

```text
Exit code: 0
Test Files: 5 passed
Tests:      22 passed
```

覆盖：

- 三场景中文标签；
- 未知内部状态不直接暴露；
- 工作台各阶段与下一步；
- `NO_VALID_MATCH` 不被当作完成；
- 销售跟进状态；
- 顾问 Provider 展示；
- 需求数值范围、整数和预算上下限；
- 既有缺失字段和项目隔离逻辑。

分类：`PURE UNIT VERIFICATION`。

### 6.3 Contracts

命令：

```powershell
pnpm --filter @elevator/contracts test
```

结果：

```text
Exit code: 0
Test Files: 4 passed
Tests:      15 passed
```

### 6.4 Selection engine

命令：

```powershell
pnpm --filter @elevator/selection-engine test
```

结果：

```text
Exit code: 0
Test Files: 2 passed
Tests:      9 passed
```

### 6.5 静态 Diff

命令：

```powershell
git diff --check
```

结果：

```text
Exit code: 0
```

Git 输出了现有工作区部分文件未来可能由 LF 转为 CRLF 的提示；没有空白
错误、staged change 或删除。

## 7. 未执行验证

```text
PostgreSQL:                   NOT EXECUTED
Database integration tests:   NOT EXECUTED
Migration:                    NOT EXECUTED
E2E:                          NOT EXECUTED
Browser Runtime:              NOT EXECUTED
Responsive visual review:     NOT EXECUTED
Build:                        NOT EXECUTED
Startup security gate:        NOT EXECUTED
Web/Worker service runtime:   NOT EXECUTED
Provider:                     NOT EXECUTED
Deployment:                   NOT EXECUTED
```

因此以下行为仍是 `NOT VERIFIED`：

- 页面在真实浏览器中的布局、键盘操作和移动端表现；
- 真实 Session/角色数据下的管理端角色摘要；
- 真实 PostgreSQL 记录下的工作台分支；
- Next.js Server Component 的完整运行与缓存行为；
- API 请求成功、失败和版本冲突的实际页面表现；
- 文件资料页和生命周期页面的运行状态。

## 8. 功能状态矩阵

| 功能 | 状态 | 说明 |
|---|---|---|
| 三场景统一展示 | `VERIFIED — SOURCE + UNIT` | 现有枚举均已映射，未知值不暴露原始代码 |
| 项目列表状态 | `VERIFIED — SOURCE` | 场景、阶段和数据分类已统一 |
| 项目工作台与下一步 | `VERIFIED — SOURCE + UNIT` | 仅基于现有记录推导，无虚构百分比 |
| 需求状态与缺失项 | `VERIFIED — SOURCE + UNIT` | 中文标签和场景规则复用现有 contracts |
| 方案比较与来源 | `VERIFIED — SOURCE` | 中文推荐/预算状态、适用场景、来源和不足 |
| 销售状态展示 | `VERIFIED — SOURCE + UNIT` | 中文状态；不代表正式报价 |
| 管理端角色摘要 | `PARTIAL` | 源码/typecheck 通过；真实角色数据未运行 |
| 只读按钮/表单可见性 | `VERIFIED — SOURCE` | 未修改服务端鉴权 |
| 表单 pending/重复提交 | `VERIFIED — SOURCE` | 客户端保护，不替代服务端幂等 |
| 顾问数值校验 | `VERIFIED — SOURCE + UNIT` | 与现有 contracts 范围一致 |
| 错误与成功反馈 | `VERIFIED — SOURCE` | 浏览器实际交互未执行 |
| Loading/空状态 | `VERIFIED — SOURCE` | route-level loading 与空状态均存在 |
| 响应式视觉结果 | `NOT VERIFIED` | 禁止 Browser Runtime |
| API/数据库兼容 | `VERIFIED — NO API/SCHEMA CHANGE` | 仅新增内部只读查询 |
| 生产可用性 | `NOT VERIFIED` | 本轮不构成生产验证 |

## 9. 未完成或保持边界的事项

- 没有实现勘察任务和专业工程审核页面；相关业务规则仍未确认；
- 没有实现正式报价、合同、交付或售后；
- 文件资料页中的文件技术状态沿用原页面，没有修改文件生命周期 UI 语义；
- 没有增加服务端 API、数据库字段或审计事件；
- 没有新增真实 AI Provider；
- 没有执行浏览器可访问性审计；
- 没有执行真实权限角色下的 403/只读浏览器测试。

这些事项需要在后续独立授权中处理。

## 10. 报告摘要与文件大小

```text
Self-excluding SHA-256:
4BA7D43F1E88853845C607F535AE9774F167F3D11AA6A329F4DA95E8CDE24919

Bytes:                    14758
Physical lines:           484
```

自排除摘要计算方式：将本节 64 位 SHA-256 token 替换为 64 个零字符后，
对 UTF-8 文件字节计算 SHA-256。
