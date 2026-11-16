# Phase 3.3 文件访问与受控下载

本阶段实现授权项目文件查询、版本历史和受控下载，不包含 PDF 解析或 Worker 识别。

## API

- `GET /api/projects/{projectId}/files`
- `GET /api/projects/{projectId}/files/{fileId}`
- `GET /api/projects/{projectId}/files/{fileId}/versions/{versionId}/content`

客户端 ID、projectId、fileId 和 versionId 均在服务端重新检查。
API 响应不包含 storageKey 或物理存储路径。

## 下载条件

所有下载均要求：

- 有效数据库 Session。
- 项目范围的 `file.read` 权限。
- File 属于 URL 中的项目。
- FileVersion 属于 URL 中的 File。
- `uploadStatus = UPLOADED`
- `validationStatus = PASSED`
- `integrityStatus = VERIFIED`
- 下载前重新计算 SHA-256。

病毒扫描：

- `CLEAN`：允许下载。
- 生产环境其他状态：始终拒绝，包括 `SYSTEM_ADMIN`。
- 隔离测试环境：仅当 `FILE_ACCESS_MODE=test`、测试数据库名/角色/标记验证成功，
  且用户拥有项目范围的 `file.unscanned.test_access` 时允许。

测试放行不修改 `malwareScanStatus = SCAN_UNAVAILABLE`，不会伪造 `CLEAN`。

## 下载响应

- `Content-Disposition: attachment`
- `Content-Type` 来自数据库真实检测类型
- `Content-Length` 来自不可变文件版本
- `Cache-Control: private, no-store`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: sandbox`

## 审计和完整性

- 元数据详情访问记录 `file.viewed`。
- 文件内容完成同句柄读取、大小校验和 SHA-256 校验后记录
  `file.download_verified`。该事件只证明服务端校验通过，不证明客户端已收到或保存文件。
- 可观测的响应取消、流异常或绝对超时记录
  `file.download_interrupted`，其实际含义以 `reason` 为准。
- 策略拒绝记录 `file.download_blocked`。
- MIME 类型不允许时返回 HTTP 415，并在同一事务内写入
  `file.download_blocked` 和 `VALIDATION_FAILED` 安全事件；不改变文件原有完整性状态。
- 下载前哈希不一致会阻止下载、标记完整性失败并写入 `FileSecurityEvent`。

## 测试

```powershell
pnpm test
pnpm test:db:constraints
pnpm test:e2e
```

覆盖不同客户、不同项目、错误 file/version 组合、生产扫描拒绝、测试身份保护、
历史版本下载、安全响应头、下载审计和完整性失败。
