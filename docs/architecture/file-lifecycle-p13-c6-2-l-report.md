# P1-3 C-6.2-L Legacy Cleanup 紧急止损验收报告

## 文档信息

- 阶段：`C-6.2-L`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 结论：`PASS WITH WARNINGS`

本阶段完成了旧 Web/Worker/Storage Adapter 业务物理删除入口的 fail-closed 止损。它没有实现 P13 Cleanup，也没有恢复任何自动物理删除能力。

## 1. 最终结论

```text
C-6.2-L:
PASS WITH WARNINGS

Legacy Web Cleanup:
DISABLED / FAIL-CLOSED

Legacy Worker Cleanup:
DISABLED

Canonical Commit-Unknown Protection:
RETAIN OBJECT

Business Physical Delete Authority:
FAIL-CLOSED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

Warnings 来自本阶段按授权未执行 PostgreSQL 集成、真实 COMMIT、Worker 进程和 E2E，以及部署侧旧 Worker 排空尚未验证。

## 2. Git 基线与原有工作树

开始前重新核验：

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD:   b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

开始前已有未提交内容，包括：

```text
M  apps/web/next-env.d.ts
M  prisma/schema.prisma
?? apps/web/scripts/p13-db-tests/
?? apps/web/tests/p13-a-migration.test.ts
?? apps/web/tests/p13-b-migration.test.ts
?? apps/web/tests/p13-db-tooling.test.ts
?? docs/architecture/
?? prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/
?? prisma/migrations/20261117130000_phase37_p13_lifecycle_insert_guard/
?? prisma/migrations/20261117140000_phase37_p13_lifecycle_initial_state_guard/
```

全部保留。未执行 Git add、commit、reset、restore、clean、checkout 或 stash。

## 3. 修改文件清单

### 3.1 业务与工具代码

```text
apps/web/src/modules/files/upload-service.ts
apps/worker/src/file-maintenance.ts
packages/file-storage/src/errors.ts
packages/file-storage/src/index.ts
packages/file-storage/src/local-private-storage.ts
```

### 3.2 测试

新增：

```text
apps/web/tests/legacy-cleanup-shutdown.test.ts
apps/worker/tests/legacy-cleanup-shutdown.test.ts
```

更新：

```text
packages/file-storage/tests/local-private-storage.test.ts
apps/web/tests/integration/phase32-upload-service.test.ts
apps/web/tests/integration/phase34-file-processing.test.ts
apps/web/tests/integration/phase35-lease-renewal.test.ts
apps/web/tests/integration/phase35-processing-reliability.test.ts
```

### 3.3 文档

新增：

```text
docs/architecture/file-lifecycle-p13-c6-2-l-design.md
docs/architecture/file-lifecycle-p13-c6-2-l-report.md
```

更新：

```text
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

## 4. 每个文件的行为变化

### 4.1 `upload-service.ts`

修改前：

- 每次创建 Upload Intent 都调用过期 Intent 清理；
- 清理函数先删除 staging/object，再更新 Intent；
- Complete Upload 的 catch 删除已经 finalize 的 canonical object；
- COMMIT 结果未知和明确失败没有区别。

修改后：

- `createUploadIntent()` 不再调用旧清理；
- `cleanupExpiredUploadIntents()` 立即抛 `LegacyStorageCleanupDisabledError`；
- `completeUpload()` 的任何异常均不删除 staging 或 object；
- 保留 Intent 失败标记能力；
- 失败日志标记 `canonicalObjectFinalized` 和 `recoveryRequired`；
- 正常上传、幂等、写入、finalize、数据库完成和通知路径保持。

### 4.2 `file-maintenance.ts`

修改前：

- 删除过期 Intent 的 staging/object；
- 将 Intent 标为 `EXPIRED`；
- 查询引用后执行 orphan delete；
- 递归清理 temp。

修改后：

- 保留 stale extraction recovery 与 queue requeue；
- 不再查询或更新过期 Intent；
- 不再调用任何 Storage 删除方法；
- 旧清理计数固定返回 0，不伪装成真实扫描结果；
- Queue、启动和 retry 全部共用同一无删除函数。

### 4.3 `errors.ts` / `index.ts`

- 新增导出 `LegacyStorageCleanupDisabledError`；
- 错误只包含被拒绝的逻辑操作名，不包含 Storage Key 或路径。

### 4.4 `local-private-storage.ts`

修改前：

- `removeStaging()`、`removeObject()` 直接 `fs.rm()`；
- `cleanupOrphanObjects()` 按引用快照和 mtime 删除；
- `cleanupTemp()` 递归删除；
- `writeToStaging()` 失败时 `fs.rm()` 部分文件。

修改后：

- 四个 Legacy Cleanup API 立即抛出显式错误；
- 拒绝发生在 key resolution 和文件系统访问之前；
- 失败的部分 staging 写入保留；
- 正常 write/finalize/read/hash 不变。

### 4.5 测试

- 删除旧行为断言，改为验证文件保留、状态不变和删除调用为零；
- 新增 Web Mock 测试，无数据库；
- 新增 Worker Mock 测试，以 fake storage spy 证明零删除；
- Storage Adapter 测试仅使用自身 `mkdtemp()` 目录。

## 5. 全量物理删除入口处理状态

| Entry ID | 入口 | 当前状态 | 验证 |
|---|---|---|---|
| L-DEL-01 | Web `cleanupExpiredUploadIntents()` | DISABLED | Web 单测 |
| L-DEL-02 | Web `completeUpload()` catch | REMOVED | Web 单测 |
| L-DEL-03 | Worker expired Intent block | REMOVED | Worker 单测/静态检查 |
| L-DEL-04 | Worker orphan block | REMOVED | Worker 单测/静态检查 |
| L-DEL-05 | `cleanupOrphanObjects()` | FAIL-CLOSED | file-storage 单测 |
| L-DEL-06 | `cleanupTemp()` | FAIL-CLOSED | file-storage 单测 |
| L-DEL-07 | `removeStaging()` | FAIL-CLOSED | file-storage 单测 |
| L-DEL-08 | `removeObject()` | FAIL-CLOSED | file-storage 单测 |
| L-DEL-09 | `writeToStaging()` 失败清理 | REMOVED | file-storage 单测 |
| L-DEL-10 | test-db reset | TEST ONLY / GUARDED | 本阶段未执行 |
| L-DEL-11 | package test teardown | TEST TEMP ONLY | file-storage 单测 |
| L-DEL-12 | integration missing-object fixture | TEST ONLY | 本阶段未执行 |

### 5.1 业务物理删除权限

| 类型 | 最终状态 |
|---|---|
| Web Legacy Cleanup | 无业务物理删除 |
| Worker Legacy Cleanup | 无业务物理删除 |
| Complete Upload 异常 | 不删除 Canonical/Staging |
| Discovery Only | 当前未新增 |
| 测试临时目录 | 只允许测试自身临时根目录 |
| 新 P13 Cleanup | 未启用 |

### 5.2 数据库记录删除

本阶段没有生产代码数据库删除路由，也未修改任何数据库记录、角色、ACL、Schema 或 Migration。

## 6. Feature Flag 安全性

本阶段没有增加 Feature Flag。

没有：

```text
LEGACY_CLEANUP_ENABLED
ALLOW_LEGACY_DELETE
```

或等价环境变量。旧物理删除不能通过缺失、非法或注入配置重新开启。

## 7. 自动化测试

### 7.1 执行命令与结果

```text
pnpm --filter @elevator/file-storage test
15/15 PASS
```

```text
pnpm --filter @elevator/web exec vitest run
  tests/legacy-cleanup-shutdown.test.ts
  tests/download-policy.test.ts
  tests/download-http.test.ts
  tests/download-resource-pool.test.ts
  tests/download-response-stream.test.ts
  tests/download-route.test.ts

6 test files / 22 tests PASS
```

其中：

```text
Web Legacy Cleanup: 5/5 PASS
Web Download regression: 17/17 PASS
```

```text
pnpm --filter @elevator/worker exec vitest run
  tests/legacy-cleanup-shutdown.test.ts

2/2 PASS
```

### 7.2 TypeScript

```text
pnpm --filter @elevator/file-storage typecheck  PASS
pnpm --filter @elevator/web typecheck           PASS
pnpm --filter @elevator/worker typecheck        PASS
```

### 7.3 构建

```text
pnpm --filter @elevator/file-storage build
PASS
```

构建用于刷新 workspace 包的新错误类型和最终 Storage Adapter 行为。

### 7.4 数据库

本阶段未执行：

- PostgreSQL 连接；
- SQL；
- Prisma 数据库命令；
- integration tests；
- E2E；
- 真实 Worker；
- 真实 COMMIT。

## 8. 文件系统安全确认

- 未触碰业务 Storage Root；
- 未删除业务 Staging/Canonical object；
- file-storage 测试使用测试自身创建的 `mkdtemp()` 根；
- 测试 teardown 仅删除该临时根；
- 生产源码搜索不再存在 `fs.rm`、`fs.unlink` 或旧 Storage 删除调用；
- 剩余 `fs.rm` 仅存在于测试 teardown、test-db reset 和测试模拟对象丢失。

## 9. 环境与秘密

测试命令从各 workspace 根执行。以下位置不存在 env 文件：

```text
apps/web/.env
apps/web/.env.test
apps/worker/.env
apps/worker/.env.test
packages/file-storage/.env
packages/file-storage/.env.test
```

仓库根存在 `.env` / `.env.test`，但本阶段没有打开、读取、输出或修改它们。测试通过 Mock/Fake，不加载应用环境配置。

## 10. 独立安全自审

| 检查 | 结果 |
|---|---|
| 是否遗漏生产物理删除入口 | 未发现；生产源码只剩 fail-closed API 定义 |
| 是否遗漏 API 间接调用 | `createUploadIntent()` 已移除调用并被 Web 单测覆盖 |
| Worker 其他调度入口 | Queue、启动、retry 共用同一函数 |
| Retry 是否绕过 | `runFileMaintenance()` 内无 Storage 删除 |
| 异常处理是否绕过 | Complete catch 已完全移除物理删除 |
| 其他 Adapter 删除入口 | 四个旧 API 全部 fail closed |
| COMMIT unknown 间接删除 | 无条件保留对象 |
| 配置重新启用 | 未新增配置开关 |
| 默认值/环境变量误启用 | 无删除配置项 |
| Worker 重启 | 重启仍进入同一无删除函数 |
| 新老 Worker 并发 | 本代码版本无旧删除权限；部署排空仍待验证 |
| 测试误删业务文件 | 未访问业务 Storage Root |
| 上传/下载影响 | Web 5 项上传安全测试与 17 项下载测试通过 |
| 异常吞掉恢复线索 | 物理对象保留，并记录 recoveryRequired |
| 跨 namespace 删除 | 旧 API 在 key resolve 前拒绝 |
| Intent 过期授权删除 | 已移除 |
| “无引用”授权删除 | 已移除 |
| 未授权业务模块调用 | Adapter 自身 fail closed，不再依赖调用者自律 |

未发现未解决的 Critical 或 High 级代码止损缺陷。

## 11. 残留风险与未验证项

1. 已部署的旧 Worker 进程不会被代码修改自动停止，必须通过部署排空、撤权和进程验证处理；
2. 历史 Staging/Canonical 对象会积累，本阶段有意保留；
3. P13 上传链仍不兼容，正常新上传在数据库约束层面尚未完成真实集成验证；
4. 没有 Cleanup Case、Write Evidence、对象级锁、Operation、Recovery；
5. 没有数据库真实 COMMIT、Worker E2E 和 Playwright 验证；
6. test-db reset 和测试 teardown 仍包含删除能力，但仅限严格测试用途；
7. 外部运维脚本、容器清理任务和云存储生命周期规则不在仓库搜索范围；
8. `AuditLog` TRUNCATE、Runtime ACL 等 K 阶段缺口未被本阶段修改。

## 12. 文件 SHA-256

### 12.1 修改代码

```text
apps/web/src/modules/files/upload-service.ts
D4DB6FF4DB253E3D00C92DFB4707A58DC12F068C3AD9A17FDB37C90559FDB292

apps/worker/src/file-maintenance.ts
4FBC8C09FEE153BF6CDA7F649100F199460F9720B25088F1E97EA0CC25159166

packages/file-storage/src/errors.ts
CAB6CB14B7AD585CDB5D3092BCF095762CB46D1F0BA0F936A3DFDC1E0EB421D0

packages/file-storage/src/index.ts
4586CA956EC433D8CB9E8E916F56D9B41BFF50085142C6752A4C2E7AF8663B2D

packages/file-storage/src/local-private-storage.ts
985D91DB9A0826F9E815C141FCE9596CD6924760BA8F3DF9D1A1EE018911DCF8
```

### 12.2 测试

```text
packages/file-storage/tests/local-private-storage.test.ts
2188C12F5AA4095D1038977139847633FA18235F7AEE04563681F34D300AC4B6

apps/web/tests/legacy-cleanup-shutdown.test.ts
7104773A60C324E4ABD99319E11B233C57593EE5A27BB8F62BAE2602E091AE1F

apps/worker/tests/legacy-cleanup-shutdown.test.ts
9436A38D2CB346B562D8FAC4A60E9B6F29BE7931CB7953730FE4F8D1CBA3D8AF

phase32-upload-service.test.ts
C07CD76CA5E11BE09C33764BBE815E3F47C19C2549F14A58A196DD9C59735B0D

phase34-file-processing.test.ts
53495699839548D4B3A54AD8260B83C9A9C420A3E12E50F5123F7D76C6930A0B

phase35-lease-renewal.test.ts
0E69FF9AFD7E7485C7D33771DFBE962E3FFED3F50137883B9052CBA538EB6C43

phase35-processing-reliability.test.ts
DD35992A0D68112B464C229314249D9403152039478B740C5BE91F62925C6000
```

### 12.3 文档

```text
L 设计
7C24F911A7018577975FD7BA65BCE0E1E5F9AF02D3A9845D1AD1F8E6FE111227

数据库行为测试计划
3F9F79C343E363E1038009E2AF6D76A3C04B46EB6895EA0875AEC6BA5F7980A7

实现状态
666C3E27D7119797A0783BA1B81B7AAA97A87C317128A88ED3C0D6A4265A84CC
```

L 报告自身哈希在最终消息中外部计算，避免自引用改变文件。

### 12.4 受保护文件

```text
prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

原始 P1-3 Migration
187D82A00DB73CB6F5D79C97DCD6B4FF2E01BD7E5F78BB9E1273D54D8A141479

A Migration
CA1E3B737F1CC44B3FC40911634CDBC18A41B239073BB56D53F0432B11D6BFDB

B Migration
3AC99E01D98D4C125BED5F3AC1CE2769B0B780E45F0E51B4FEECC2FB408ABB2C

apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC
```

Schema、Migration 和 `next-env.d.ts` 均未由本阶段改变。

## 13. 下一阶段建议

1. 部署 L 止损版本，排空旧 Worker，撤销旧删除权限并验证无旧进程继续删除；
2. 审核 K/L 设计并制定 M 阶段数据兼容与 Cleanup Case/Evidence 方案；
3. 修复 Upload/Complete 与 P13 必填链字段的兼容性；
4. 实现对象级锁、Write Evidence、Operation 和 Reconciliation；
5. 使用一次性 Clone 完成真实 COMMIT、并发和权限测试；
6. 独立安全验收后才允许重新引入受控物理删除。

## 最终状态

```text
C-6.2-L:
PASS WITH WARNINGS

Legacy Web Cleanup:
DISABLED

Legacy Worker Cleanup:
DISABLED

Canonical Commit-Unknown Protection:
RETAIN OBJECT

Business Physical Delete Authority:
FAIL-CLOSED

New Cleanup:
NOT ENABLED

Database:
NOT CONNECTED

SQL:
NOT EXECUTED

Database Writes:
NOT EXECUTED

Prisma Schema:
NOT MODIFIED

Migration:
NOT MODIFIED

ACL:
NOT MODIFIED

Roles:
NOT MODIFIED

Git Commit:
NOT CREATED

Git Cleanup:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
