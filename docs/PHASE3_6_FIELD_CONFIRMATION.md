# Phase 3.6 客户资料字段确认

本阶段只处理已经存在的结构化 `ExtractionField`，不把 PDF 文字自动转换为字段，
也不接入 OCR 或真实 AI API。

## 客户页面

现有文件识别结果页面增加：

- 文件名、文件版本和识别版本。
- 文件处理及识别状态。
- 普通资料与专业工程字段卡片。
- AI 原始值、来源页码和识别置信度。
- 字段最新有效状态。
- 普通字段确认、更正和拒绝入口。
- 专业字段修正建议入口。
- 每个字段的追加式历史记录。
- 没有结构化字段时的明确空状态。

专业字段固定提示：

> 该字段影响工程判断，客户只能提交修正建议，仍需由专业人员在现场勘察、
> 测量或审核后确认。

## API

Extraction 详情：

```text
GET /api/projects/{projectId}/files/{fileId}/versions/{versionId}/extractions/{extractionId}
```

返回字段原始值、来源、置信度、分类、最新派生状态、可用客户操作和 Review 历史。
响应不返回 storageKey、物理路径、processingToken 或执行租约。

提交字段 Review：

```text
POST /api/projects/{projectId}/files/{fileId}/versions/{versionId}/extractions/{extractionId}/fields/{fieldId}/reviews
```

请求：

```json
{
  "action": "CONFIRM | CORRECT | REJECT",
  "correctedRawValue": "仅 CORRECT 提供",
  "note": "可选备注",
  "expectedReviewSequence": 0
}
```

客户端不能提交字段分类、操作后状态、置信度、操作者、角色快照或原始识别值。

## 状态规则

普通字段必须同时满足：

```text
fieldClassification = ORDINARY
customerConfirmable = true
requiresProfessionalReview = false
initialStatus IN (EXTRACTED, CUSTOMER_CONFIRMED, CUSTOMER_REJECTED)
```

- CONFIRM -> CUSTOMER_CONFIRMED
- CORRECT -> CUSTOMER_CONFIRMED
- REJECT -> CUSTOMER_REJECTED

专业字段：

- 合法初始状态只能为 `PENDING_VERIFICATION`。
- 只允许 CORRECT，记录为客户修正建议。
- CONFIRM 和 REJECT 返回 403。
- 操作后状态始终为 PENDING_VERIFICATION。
- 即使数据库中的 `initialStatus` 异常为 EXTRACTED，页面也按
  PENDING_VERIFICATION 展示。

以下情况全部 Fail Closed，不生成 Review 或成功审计：

- 普通字段仍标记 `requiresProfessionalReview=true`。
- `customerConfirmable` 或 `requiresProfessionalReview` 缺失、非布尔值。
- 普通字段初始状态为 `PENDING_VERIFICATION` 或 `INVALIDATED`。
- 专业字段使用不一致的客户确认/专业核实标志。
- 专业字段初始状态不是 `PENDING_VERIFICATION`，包括 `INVALIDATED`。
- 字段分类、初始状态或操作类型未知。

## 并发和事务

Review 提交在单个 PostgreSQL 事务中完成：

1. 校验项目范围 CUSTOMER 角色。
2. 使用完整 file/version/extraction/field 链路查询并锁定字段行。
3. 校验 `expectedReviewSequence`。
4. 服务端计算字段分类规则和 Review 序号。
5. 追加 `ExtractionFieldReview`。
6. 在同一事务追加 `AuditLog`。

`[extractionFieldId, reviewSequence]` 唯一约束作为最终并发保护。旧序号和并发
请求返回 409，不会产生重复确认记录。

## 安全边界

- 客户确认入口要求项目范围 `file.read`、`file.confirm` 和 CUSTOMER 项目角色。
- SYSTEM_ADMIN 的全局权限不能生成客户确认。
- `ExtractionField` 与 `ExtractionFieldReview` 继续由数据库禁止更新和删除。
- 原始识别值不会被 Review 覆盖。
- 新 Extraction 使用独立字段记录，不继承旧版本 Review。
- 所有模拟字段和值显式包含 `DEMO_MOCK`。

## 测试

```powershell
pnpm test
pnpm test:db:constraints
pnpm test:e2e
pnpm typecheck
pnpm build
```

覆盖普通字段确认/更正/拒绝、专业字段保护、原始值不可变、并发提交、旧序号冲突、
跨客户/跨项目拒绝、管理员不能伪造客户确认、审计、无字段空状态和新 Extraction
不继承旧确认历史。
