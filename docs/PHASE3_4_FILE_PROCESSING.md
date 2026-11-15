# Phase 3.4 文件后台处理

本阶段实现 pg-boss 文件处理、隔离 PDF 文字提取、图片元数据读取和定期维护。

## Worker 队列

- `file-recognition`：处理已上传文件的识别任务。
- `file-maintenance`：恢复卡住任务、过期上传意图清理和 temp 清理。

Worker 启动时会立即执行一次维护任务，并注册每 15 分钟执行一次的清理计划。

上传事务成功后会创建 Extraction v1，并将 FileVersion 标记为 `QUEUED`。
Web 服务随后发送 pg-boss 任务；发送失败时记录警告，Worker 维护任务会重新入队。

## PDF 处理

- 使用 `pdfjs-dist@6.5.438` 本地解析。
- PDF 解析运行于独立 Worker Thread。
- 主 Worker 不直接执行 PDF 解析循环。
- 超过硬超时后调用 `worker.terminate()`。
- 资源限制：
  - 最大 200 页
  - 最大 2,000,000 输出字符
  - 最大 40,000,000 图片像素
  - 默认解析超时 60 秒
  - Worker Thread 主堆 384 MiB
  - Young 区 64 MiB
- 每个有效文字项保存：
  - 页码
  - 文字
  - 来源 ID
  - X/Y 坐标
  - 宽高
- 无文字层的 PDF 标记为完成并明确说明未执行 OCR。
- 损坏 PDF 标记失败，不推断内容。

## 图片处理

- 使用 `image-size@2.1.0` 读取格式、宽度、高度和文件大小。
- 不执行 OCR。
- 不进行分类、结构识别或工程可行性判断。
- 图片页面固定提示当前版本未进行图片文字提取或 AI 图像识别。

## 安全

Worker 重新查询队列 ID 对应的 Extraction、FileVersion、File 和项目关系，
不信任队列消息中的项目、文件路径或扫描状态。

处理前再次验证：

- 请求账号仍存在。
- 请求账号具有项目 `file.upload` 权限。
- 文件上传、基础校验和完整性状态满足条件。
- 文件 SHA-256 未变化。
- 文件真实 MIME 与版本记录一致。
- 生产环境病毒扫描状态必须为 `CLEAN`。
- 测试环境未扫描处理需要测试数据库身份、测试标记和专用权限全部匹配。

测试放行不会修改 `SCAN_UNAVAILABLE`。

## 状态和恢复

- Phase 3.5 已用执行租约和处理令牌替代固定 5 分钟状态推断；最新可靠性规则见
  `docs/PHASE3_5_PROCESSING_RELIABILITY.md`。
- `QUEUED → PROCESSING → COMPLETED / FAILED`。
- 重复任务不会覆盖已完成 Extraction。
- 超过 5 分钟的 PROCESSING 记录会恢复为 QUEUED。
- Worker 重启时自动处理遗留 QUEUED 记录。
- 失败记录保留安全错误码和错误说明。
- 旧任务只更新自身 Extraction，不修改新版本当前状态。
- 终态 Extraction 由数据库约束保护，不能回到处理中或改写历史结果。

## 清理

维护任务只清理：

- 已过期的 PENDING/FAILED 上传意图。
- 超过 15 分钟的 UPLOADING 意图。
- 未完成意图对应的 staging 和 objectStorageKey。
- 超过保留时间、且未被 FileVersion 或未过期上传意图引用的孤儿对象。
- 超过 `TEMP_RETENTION_MS` 的 temp 条目。

清理任务在删除孤儿对象前会重新读取数据库引用集合；已完成 FileVersion
所引用的原始对象不会被删除。

## 运行

独立 Worker：

```powershell
pnpm dev:worker
```

测试：

```powershell
pnpm test
pnpm test:db:constraints
pnpm test:e2e
```
