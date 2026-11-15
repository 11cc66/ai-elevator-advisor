# Phase 3.1 数据模型与约束

本阶段只实现数据模型、权限和数据库约束，不包含文件上传、存储、下载或解析功能。

## 核心模型

- `File`：逻辑文件，关联客户、项目、建筑和安装单元。
- `FileVersion`：不可变原始文件版本。
- `FileExtraction`：可保留多次历史的识别版本。
- `ExtractionTextBlock`：逐页 PDF 文字块。
- `ExtractionField`：原始提取字段，不因客户操作而修改。
- `ExtractionFieldReview`：客户确认、更正和拒绝的追加历史。
- `FileSecurityEvent`：文件完整性和安全策略事件。

## 状态维度

`FileVersion` 分开保存：

- 上传状态：`uploadStatus`
- 基础校验状态：`validationStatus`
- 病毒扫描状态：`malwareScanStatus`
- 完整性状态：`integrityStatus`
- 识别状态：`recognitionStatus`

Phase 3.1 没有扫描器，默认且只能实际使用
`malwareScanStatus = SCAN_UNAVAILABLE`。`CLEAN` 仅作为未来状态预留。

## 数据库约束

- 文件项目与客户必须匹配。
- 文件建筑必须属于对应项目和客户。
- 文件安装单元必须属于对应建筑。
- `currentVersionId` 必须属于当前文件。
- 文件版本号、原始文件名、大小、SHA-256、存储键和上传者不可修改。
- 原始文件版本不可删除。
- 已完成的提取内容不可修改。
- 文字块、原始提取字段、字段 Review 和安全事件不可更新或删除。
- 专业字段的 Review 状态只能是 `PENDING_VERIFICATION`。
- 客户普通字段的确认、更正和拒绝分别产生追加历史。
- 现有审计日志继续只追加。

## 权限

新增：

- `file.read`
- `file.upload`
- `file.process`
- `file.confirm`
- `file.unscanned.test_access`

测试客户只拥有固定 DEMO 项目范围的文件读取、上传、确认和测试环境未扫描访问权限，
没有 `file.process` 或管理员权限。

## 测试

```powershell
pnpm test:db:constraints
```

该命令先通过测试数据库身份守卫，再重置 `elevator_advisor_test` 并运行数据库约束测试。
