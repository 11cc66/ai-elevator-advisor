# Phase 3.2 私有流式上传

本阶段只实现上传意图、私有存储、真实文件类型校验、SHA-256 和 FileVersion 创建。
不包含文件列表、详情、版本历史、受控下载、PDF 解析或 Worker 识别。

## 上传流程

1. `POST /api/projects/{projectId}/files/upload-intents`
   - Session 和 `file.upload` 权限。
   - 项目范围、建筑和安装单元归属检查。
   - `Idempotency-Key` 幂等检查。
   - 创建 30 分钟有效的上传意图。

2. `PUT /api/projects/{projectId}/files/upload-intents/{intentId}/content`
   - 原始二进制流式写入 staging。
   - 最大 20 MiB。
   - 真实文件类型必须为 PDF、JPEG 或 PNG。
   - 计算 SHA-256。
   - 验证通过后原子移动到私有 objects 目录。
   - 数据库事务创建 File 和不可变 FileVersion。
   - 成功后切换 File 的 currentVersionId。

## 安全状态

新上传版本状态：

```text
uploadStatus       = UPLOADED
validationStatus   = PASSED
malwareScanStatus  = SCAN_UNAVAILABLE
integrityStatus    = VERIFIED
recognitionStatus  = NOT_REQUESTED
```

`SCAN_UNAVAILABLE` 不表示病毒扫描通过。本阶段没有下载或后续处理接口。

## 存储

- 开发存储：`storage/private`
- 隔离测试存储：`storage/private-test`
- 文件名不参与物理路径拼接。
- storageKey 使用随机 UUID。
- 已存在对象不会被覆盖。
- staging 文件在失败时清理。
- 过期的 PENDING/FAILED 意图和超时 UPLOADING 意图会通过受控清理函数移除 staging。
- 清理函数不删除已完成的 objects。

## 权限

- 管理员：全局上传和文件管理权限。
- 测试客户：固定 DEMO 项目的文件读取、上传、确认和测试环境未扫描访问权限。
- 测试客户没有 `file.process` 或管理员权限。

## 测试

```powershell
pnpm test:db:constraints
pnpm test:e2e
```

测试覆盖真实 MIME、大小、哈希、幂等、并发、失败清理、路径安全和私有目录。
