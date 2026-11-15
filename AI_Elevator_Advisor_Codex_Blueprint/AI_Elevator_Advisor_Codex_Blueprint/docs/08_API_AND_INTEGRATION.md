# 08 — API、AI 服务与外部集成边界

## 1. 架构建议

建议分层：
- Web 前端：客户侧和企业后台；
- Backend API：认证、权限、业务流程、数据库；
- AI Application Service：对话、文件识别、结构化抽取、解释；
- Selection Engine：确定性规则筛选，不由大模型自由决定硬条件；
- File Storage Adapter：文件存储抽象；
- Database：关系型数据库；
- Background Jobs：文件解析、通知和耗时任务。

Codex 应先给出技术栈建议，不要在未检查环境前假设已有框架。

## 2. 建议 API 资源（示例）

- `POST /api/auth/login`
- `GET /api/me`
- `POST /api/projects`
- `GET /api/projects`
- `GET /api/projects/{projectId}`
- `POST /api/projects/{projectId}/buildings`
- `POST /api/files`
- `GET /api/files/{fileId}`
- `POST /api/files/{fileId}/extract`
- `GET /api/projects/{projectId}/engineering-data`
- `POST /api/survey-tasks`
- `POST /api/survey-tasks/{taskId}/measurements`
- `POST /api/survey-tasks/{taskId}/reports`
- `POST /api/products/import-preview`
- `POST /api/products`
- `POST /api/products/{productId}/review`
- `POST /api/selection-runs`
- `GET /api/selection-runs/{runId}`
- `POST /api/schemes/{schemeId}/approvals`
- `POST /api/quotations`
- `POST /api/quotations/{quotationId}/approvals`
- `POST /api/quotations/{quotationId}/release`

以上是资源设计建议，Codex 可按最终架构调整，但必须保持权限、版本和状态规则。

## 3. AI 接口原则

- 模型供应商通过 adapter 抽象，避免业务逻辑绑定单一厂商。
- API Key 只放服务端环境变量或密钥管理服务，不能写入前端、代码仓库或日志。
- 模型响应必须结构化校验。
- AI 不得直接执行任意 SQL 或系统命令。
- 业务规则引擎负责硬条件过滤；LLM 负责理解自然语言和解释结果。
- 模型不可用时，核心项目和产品管理仍可运行。

## 4. 文件处理

- 限制文件类型和大小；
- 校验真实 MIME 类型；
- 文件名清理；
- 病毒 / 恶意文件扫描接口预留；
- 私有存储，不使用可猜测公开链接；
- 下载前检查项目权限；
- 解析任务异步执行；
- 记录解析器版本、失败原因和重试状态。

## 5. 第三方服务暂缓

电子签约、短信、支付、地图、云 OCR 等需先评估服务商、成本、数据出境、合规与授权。未经用户明确选择和配置，不要自动接入真实服务。
