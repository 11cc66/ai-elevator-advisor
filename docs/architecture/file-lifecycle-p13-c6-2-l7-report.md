# P1-3 C-6.2-L7 Production Deployment Trust 与 Legacy Drain Readiness 报告

## 文档信息

- 阶段：`C-6.2-L7`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 最终结论：`PASS WITH WARNINGS`

## 1. 最终结论

```text
C-6.2-L7:
PASS WITH WARNINGS

Deployment Topology:
PARTIAL / PRODUCTION UNKNOWN

Web Startup Entry Audit:
COMPLETE IN REPOSITORY

Worker Startup Entry Audit:
COMPLETE IN REPOSITORY

Startup Gate Enforcement:
SUPPORTED ENTRIES VERIFIED / DEPLOYMENT UNKNOWN

Startup Gate Bypass:
DIRECT AND LEGACY ENTRIES REMAIN DEPLOYMENT-BLOCKING

Legacy Artifact Inventory:
LOCAL KNOWN / PRODUCTION UNKNOWN

Legacy Worker Drain Protocol:
COMPLETE

Legacy Worker Drain Execution:
NOT EXECUTED

Scheduler / Watchdog:
REPOSITORY PGBOSS KNOWN / EXTERNAL UNKNOWN

Automatic Restart:
UNKNOWN

Build Identity:
IMPLEMENTED / ISOLATED TESTS PASS

Signed Manifest:
IMPLEMENTED / ED25519 TESTED

Production Trust Root:
NOT CONFIGURED

Production Signing Key:
NOT CONFIGURED

Release Root:
PARTIAL / PRODUCTION ACL NOT VERIFIED

Runtime Identity:
DESIGNED / CODE BOUNDARY IMPLEMENTED / OS NOT VERIFIED

Production Storage ACL:
NOT VERIFIED

External Evidence Collector:
PARTIAL / OFFLINE VALIDATOR IMPLEMENTED

Deployment Simulation:
PASS IN ISOLATION / WINDOWS ACL NOT VERIFIED

Independent Security Audit:
COMPLETE WITH OPEN PRODUCTION GAPS

Legacy Artifact Removal:
NOT EXECUTED

Production Deployment:
NOT EXECUTED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

仓库内可加固项已经完成；生产是否真正完成排空仍不能判定。

## 2. Git 基线

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

## 3. 工作树状态

工作树仍为预期的 dirty 状态，保留 L、L1-L6、L7 及本轮之前全部未提交文件。

未执行：

- `git add`
- `git commit`
- `git reset`
- `git restore`
- `git clean`
- `git checkout`
- `git stash`

## 4. L1-L6 基线核验

| 阶段 | 状态 | 本轮核验 |
|---|---|---|
| L | `PASS WITH WARNINGS` | fail-closed clean/delete boundary 保持 |
| L1 | `BLOCKED` | 外部实例、Scheduler、ACL 仍不可见 |
| L2 | `BLOCKED` | 旧 `.next`、Worker `dist` 仍保留 |
| L3 | `PASS WITH WARNINGS` | Manifest/Gate 仍有效并进一步加固 |
| L4 | `PASS WITH WARNINGS` | Runtime Dependency Closure 仍有效 |
| L5 | `PASS WITH WARNINGS` | 生产拓扑与 ACL 仍未验证 |
| L6 | `PASS WITH WARNINGS` | Storage capability 隔离保持 |

L1-L6 设计/报告哈希已重新计算；本轮未修改 L1-L5 文档。

```text
L1 design:
FD5F2D7C8A014487246ADA06F1A626513D55EA074CF27BFFA4A6AA2F2E4F3FD2

L1 report:
6F4CB5BB5AD99A11E05CE3787639D183D811F8E48B25D9075B88D362B126439A

L2 design:
3A16A8A669CD88E506D7CDDC8CEF507AE651399007CF5107EBF3A01924E58CF1

L2 report:
2168B3A4B76C627C93EF9766CAB0F086DECB7C50F14816955B9CD79A0D8E3299

L3 design:
D4A8A6AE43C22109A131969B53B7BDBF3BC0677805F1B154C56527417BFE0CF2

L3 report:
4F8033475DA7BC66CFFB74C0F4D33E8E13A2680E34BA8DE49E861B2FC7B4AF31

L4 design:
C0F6D68A61393653AADBEFF506A506390F870E55A7F388A17844E277766D0BA4

L4 report:
16FF644B10BD1F0B935608C3E483364F0782BA9F62A016A688B20F2FA8528C81

L5 design:
EABEA77711A5D20A32022E9A21BB22155C5EEDFC9001634E2DC3F53AE426CED7

L5 report:
AE1FA51073119B8A79AC6384A5292657FBD9BAB62112F548D32F54AE7CE4C941

L6 design:
17C435C07FD2E084BB936AA0DD61FC3B26F0A33BD6E4CB19115D869F041CC96E

L6 report:
8A901F69E7C9F6F62708F36F5738253722AAFD96D2464BC2817B90FA90C34712
```

## 5. 部署拓扑

```text
SOURCE REPOSITORY
  VERIFIED
       |
       v
BUILD PIPELINE
  REPOSITORY SCRIPTS VERIFIED
  EXTERNAL CI/CD UNKNOWN
       |
       v
ARTIFACT
  ISOLATED PLATFORM TESTS VERIFIED
  PRODUCTION ARTIFACT UNKNOWN
       |
       v
SIGNING
  ED25519 IMPLEMENTED
  PRODUCTION KMS/HSM NOT CONFIGURED
       |
       v
RELEASE ROOT
  REPARSE/DIGEST CHECKS IMPLEMENTED
  PRODUCTION IMMUTABLE ACL NOT VERIFIED
       |
       v
STARTUP GATE
  WEB/WORKER IMPLEMENTED AND UNIT TESTED
       |
       +---- WEB RUNTIME
       |
       +---- WORKER RUNTIME
       |
       +---- MAINTENANCE
       |
       v
STORAGE / DATABASE
  PRODUCTION ACL/IDENTITY NOT VERIFIED
```

### 5.1 本机只读观察

```text
Visible Node processes:
Codex runtime / node_repl only

Visible project Web process:
NOT FOUND

Visible project Worker process:
NOT FOUND

Visible local port 3000 listener:
NOT FOUND

PostgreSQL service:
postgresql-x64-18 / Running / Automatic

Project Windows Service:
NOT FOUND

Task Scheduler:
QUERY UNAVAILABLE

Docker / Podman / Kubernetes / PM2 / systemctl:
NOT FOUND
```

本机事实不能证明其他用户任务、外部主机或生产平台不存在。

## 6. 启动入口清单

### 6.1 Web

| 入口 | Gate | 状态 |
|---|---|---|
| package `start` | Secure Launcher + instrumentation | SUPPORTED |
| `next dev` | 无 production Gate | DEVELOPMENT ONLY |
| direct `next start` | 旧/外部配置不可控 | DEPLOYMENT BYPASS RISK |
| direct Node custom server | 当前不存在 | UNKNOWN |
| PM2/Service/Container | 外部未知 | UNKNOWN |

### 6.2 Worker

| 入口 | Gate | 状态 |
|---|---|---|
| package `start` | L7 Secure Launcher | FIXED / STATIC TESTED |
| signed release `index.js` | Worker Gate | SUPPORTED |
| direct `worker-entry` | 无外部 Gate | PROHIBITED |
| historical `node dist/index.js` | 无签名身份 | LEGACY PROHIBITED |
| E2E `test-worker-entry.ts` | Test only | TEST ONLY |
| PDF Worker Thread | Parent Worker 派生 | INTERNAL |

Worker package start 已由：

```text
node dist/index.js
```

改为：

```text
node scripts/start-secure.mjs
```

Secure launcher：

- 验证 Release；
- 检查 `index.js` 为 regular file；
- 检查 entry realpath 位于 Release Root；
- 启动后由 Worker `index.ts` 再次 Gate。

历史 `apps/worker/dist` 没有被删除或覆盖，仍必须由部署层禁止启动。

## 7. Startup Gate 绕过分析

| 攻击路径 | 仓库防线 | 当前结果 |
|---|---|---|
| Web direct `next start` | 新构建 instrumentation | 新构建可 Gate；旧 `.next` 仍 HIGH |
| Web custom server | 不存在 | UNKNOWN |
| Worker direct `worker-entry` | 部署禁止 | 外部未证明 |
| Worker direct old `dist` | package start 已移除引用 | 文件仍可被手工执行 |
| E2E test entry | Test-only path | 生产构建不得引用 |
| Dynamic import Worker business | Gate 后才 import | PASS |
| Build failure fallback | unique release + no manifest | Gate 拒绝不完整 Release |
| Auto restart | 必须指向 CURRENT Release | 外部配置 UNKNOWN |

结论：

```text
Supported Repository Entries:
VERIFIED

External Direct/Legacy Entry Elimination:
NOT VERIFIED
```

## 8. Legacy Artifact Inventory

| Artifact | Identity | Manifest | Legacy Delete | Direct Start | Status |
|---|---|---|---|---|---|
| `apps/web/.next` | 历史 BUILD_ID | 无 | 已知旧风险 | Possible | PRESENT / UNKNOWN |
| `apps/worker/dist` | 无签名身份 | 无 | 旧代码存在 | Possible | PRESENT / DANGEROUS |
| Current source | Git HEAD | N/A | AST scan 0 production blocked | 非部署产物 | SOURCE |
| Isolated `.p13-releases` | 测试 Manifest | Verification PASS | 0 | Gate | TEST ONLY |
| Production Release | 无证据 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

历史产物哈希未变化：

```text
apps/web/.next/BUILD_ID
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1

apps/worker/dist/file-maintenance.js
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3
```

## 9. Manifest 信任链

已验证属性：

- Strict JSON duplicate key/trailing content 拒绝；
- Canonical JSON；
- Ed25519；
- Trusted Key ID；
- Source Tree Digest；
- Dependency Lock Digest；
- Runtime Dependency Digest/count；
- Artifact Digest；
- Build/Release ID；
- Git SHA；
- Build Timestamp；
- Lifecycle Safety Version；
- `cleanupCapability=DISABLED`；
- Legacy delete markers；
- Web/Worker application identity；
- 缺失 Manifest fail closed；
- 公钥替换导致签名失败；
- Artifact/Runtime Dependency 修改导致 Gate 失败；
- 旧 Safety Version 和过期 Build 即使重新签名仍拒绝。

当前未实现：

- key revocation metadata；
- key rotation status；
- minimum release sequence / anti-rollback counter；
- 生产签名审批证据。

## 10. Trust Root

代码加固：

- Trust Root 父路径不得含 symlink/Junction/Reparse Point；
- 读取前后核对 dev/inode/size/mtime；
- 缺失 Trust Root 返回 `TRUST_ROOT_IDENTITY_INVALID`；
- 替换公钥导致签名失败；
- 签名私钥不得位于 source/artifact tree；
- Runtime 不能通过代码路径修改 Trust Root。

生产状态：

```text
Production Trust Root:
NOT CONFIGURED

Production Signing Key:
NOT CONFIGURED

Runtime Trust Root Write ACL:
NOT VERIFIED

Key Rotation:
DESIGNED / NOT IMPLEMENTED

Key Revocation:
DESIGNED / NOT IMPLEMENTED
```

## 11. Release Root

已验证：

- Build target 必须预先不存在；
- Manifest/Artifact digest；
- parent/final reparse checks；
- manifest 缺失拒绝；
- Artifact 修改/新增拒绝；
- Runtime Dependency 修改/删除拒绝；
- Gate 后再次检查可发现变化；
- Worker secure launcher 检查 release entry containment。

未完成：

- Web release 当前仍位于 `apps/web/.p13-releases/<releaseId>`，未完全独立于 application 目录；
- Runtime 对 Release Root 无写/删除权限未通过真实 ACL 证明；
- 父目录不可替换未通过真实 ACL 证明；
- standalone Web/Worker deployment bundle 未实现；
- Gate 完成到进程运行之间的 OS 文件句柄 lock/fencing 未实现。

```text
Release Root Code Design:
IMPLEMENTED

Release Root Isolated Tests:
PASS

Production Release Root:
PARTIAL / ACL NOT VERIFIED
```

## 12. Runtime Identity Matrix

| Identity | Release Write | Trust Write | Storage Delete | Cleanup | OS Verified |
|---|---|---|---|---|---|
| BUILD_IDENTITY | unpublished only | NO | NO | NO | NO |
| RELEASE_SIGNER_IDENTITY | NO | NO | NO | NO | NO |
| WEB_RUNTIME_IDENTITY | NO | NO | NO | DISABLED | NO |
| WORKER_RUNTIME_IDENTITY | NO | NO | NO | DISABLED | NO |
| MAINTENANCE_RUNTIME_IDENTITY | NO | NO | NO | DISABLED | NO |
| FUTURE_CLEANUP_IDENTITY | NO | NO | scoped only | not created | NO |
| DEPLOYMENT_ADMIN_IDENTITY | release write | NO | NO | NO | NO |
| TRUST_ROOT_ADMIN_IDENTITY | NO | trust write | NO | NO | NO |

代码 capability 边界：

```text
Web ordinary storage:
READ + UPLOAD WRITE

Worker storage:
READ ONLY

Maintenance storage:
NONE

Physical delete:
QUARANTINED FAIL-CLOSED
```

真实 OS 身份/ACL：

```text
NOT CREATED / NOT VERIFIED
```

## 13. Storage ACL 设计与验证边界

要求：

- Web：staging write；canonical read/finalize；delete denied；
- Worker：canonical read；delete denied；
- Maintenance：无 Storage dependency；delete denied；
- Future Cleanup：独立、scoped、未创建。

代码和隔离测试已覆盖：

- capability separation；
- ordinary object deletes unavailable；
- Legacy delete fail-closed；
- AST scanner 0 unallowlisted production physical delete；
- Maintenance 无 Storage 参数。

未验证：

- NTFS/SMB ACL；
- 生产运行账户；
- 对象存储 IAM/Bucket Policy；
- 旧 Worker 账户的实际 delete 权限；
- 文件句柄 fencing。

```text
Production Storage ACL:
NOT VERIFIED
```

## 14. Legacy Worker Drain Protocol

已定义完整审批链：

```text
Freeze
 -> Inventory All Instances
 -> Identify Artifact Identity
 -> Identify Scheduler / Watchdog
 -> Disable Legacy Auto Restart
 -> Stop New Legacy Intake
 -> Drain Existing Jobs
 -> Verify No Active Legacy Worker
 -> Verify No External Scheduler
 -> Verify Storage Delete Denied
 -> Approval
 -> Retire Artifact
```

排空前置证据：

- instance/host/process/service/container；
- artifact path/build/release/digest；
- startup entry；
- runtime identity；
- service restart policy；
- scheduler/watchdog；
- worker heartbeat；
- queue backlog/running/retry/failed；
- active jobs；
- storage ACL；
- DB/Queue login；
- 观察窗口。

失败处理：

- 不恢复 Legacy delete；
- 不自动清理 queue；
- 对未知 Job 保持隔离并人工处置；
- 自动重启未证明关闭时不得退休旧 Artifact；
- Evidence 过期或摘要不一致时重新采集；
- 任何 ACL/instance/scheduler 为 UNKNOWN 时停止。

当前：

```text
Protocol:
COMPLETE

Execution:
NOT EXECUTED
```

## 15. 外部 Evidence 工具

新增：

```text
apps/web/scripts/p13-deployment-evidence/evidence.ts
apps/web/scripts/p13-deployment-evidence/cli.ts
apps/web/scripts/p13-deployment-evidence/manual-evidence.template.json
apps/web/tests/p13-deployment-evidence.test.ts
```

用途：

- 管理员离线提交 Deployment Evidence；
- 校验 schema、时间窗口和 checksum；
- 拒绝 secret-like field/value；
- 拒绝相对 Artifact path；
- 检查 CURRENT Artifact 身份；
- 检查 runtime identity 和 ACL denial；
- 检查 Legacy instances/schedulers/auto restart/queue；
- 输出 READY/BLOCKED/INVALID 和结构化 blockers。

命令：

```powershell
pnpm --filter @elevator/web p13:evidence:validate -- <evidence.json>
```

工具不读取 `.env`、`.pem`、`.key`，不访问生产系统、数据库或 Storage。

限制：

- 没有实时跨主机采集器；
- Evidence checksum 不提供身份真实性；
- 生产采集动作必须由独立管理员按证据模板执行；
- 当前没有生产 Evidence，不能输出 READY。

```text
External Evidence Collector:
PARTIAL / OFFLINE VALIDATOR ONLY
```

## 16. 部署模拟测试结果

| 模拟 | 结果 |
|---|---|
| 正常签名 Release | PASS |
| Manifest 缺失 | FAIL CLOSED |
| Trust Root 缺失 | FAIL CLOSED |
| Trust Root 公钥替换 | SIGNATURE INVALID |
| Manifest 篡改 | REJECT |
| Artifact 修改/新增 | ARTIFACT DIGEST MISMATCH |
| Runtime Dependency 修改/删除 | RUNTIME DIGEST MISMATCH |
| 旧 Lifecycle Safety Version | REJECT |
| 过期 Build Timestamp | REJECT |
| Legacy delete marker | REJECT |
| Artifact Root 最终 Junction | REJECT |
| Artifact Root 父路径 Junction | REJECT |
| Trust Root 父路径 Junction | REJECT |
| Gate 后 Artifact 变化 | 下次 Gate REJECT |
| Evidence secret | INVALID |
| Evidence 过期/摘要修改 | BLOCKED |
| Legacy instance/scheduler/auto restart/queue | BLOCKED |
| direct legacy startup / unknown entry | BLOCKED |
| Worker package start 指向 old dist | FIXED / STATIC TEST |

未模拟：

- 真实 Windows ACL；
- NTLM/AD 身份；
- Service restart policy；
- 容器/K8s；
- 远程主机；
- 真实 file handle replacement fence。

## 17. 独立攻击性审计

| 攻击问题 | 结论 |
|---|---|
| 直接启动 Web | `next start` 仍可被外部命令调用；部署必须阻断 |
| 直接启动 Worker | old `dist` 文件仍可手工执行；package start 已修复 |
| 绕过 Web Gate | 新构建 instrumentation 有 Gate；旧 `.next` UNKNOWN |
| 绕过 Worker Gate | `worker-entry` 直启仍为 HIGH；部署未验证 |
| 使用旧 Artifact | historical files 仍 PRESENT |
| 使用不完整 Release | Manifest/Gate fail closed |
| 替换 Manifest | Signature/Digest fail closed |
| 替换公钥 | Signature fail closed |
| 替换 Artifact | Artifact Digest fail closed |
| 修改 Runtime Dependency | Closure Digest fail closed |
| 修改 Safety Version | 重新签名后仍因最低版本拒绝 |
| 伪造 Build ID/Release ID | Manifest 签名与 expected identity 验证 |
| 已撤销 Key | Production revocation metadata 未实现 |
| 过期 Manifest | 365 天策略拒绝 |
| 父目录写权限 | 真实 ACL 未验证 |
| Junction/Symlink/Reparse | code/path tests 拒绝 |
| Gate 后文件变化 | 依赖不可写 Release ACL |
| 自动重启 | repository 无旧引用；生产配置 UNKNOWN |
| 外部 Scheduler | 生产 UNKNOWN |
| 构建失败回退 | 新 release fail closed；rollback policy UNKNOWN |
| 旧 Worker | 生产实例 UNKNOWN |
| Runtime 修改 Release/Trust | Code design 禁止；OS ACL 未验证 |
| 重新开放 Cleanup | cleanupCapability 仅 DISABLED；Future Cleanup 未创建 |
| 绕过 L6 capability | L6 tests PASS |
| 通过未知入口执行旧删除 | static scanner 0 production blocked；外部入口 UNKNOWN |

## 18. 回归测试结果

```text
Web:
22 files / 134 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS

Web TypeScript:
PASS (--noEmit --incremental false)

Worker TypeScript:
PASS (--noEmit --incremental false)
```

沙箱外执行原因：

```text
pnpm/Node realpath on current user's AppData fails with EPERM inside sandbox.
```

沙箱外测试仅使用：

- Mock；
- 合成 Manifest；
- 一次性 Ed25519 test key；
- 临时目录；
- 无真实数据库、Storage、Service、Web、Worker。

## 19. 未解决风险

1. 生产 Web/Worker/Maintenance 实例清单 UNKNOWN；
2. 外部 Scheduler/Watchdog UNKNOWN；
3. 自动重启配置 UNKNOWN；
4. Production Trust Root 未配置；
5. Production Signing Key 未配置；
6. Key revocation/rotation 未实现；
7. Release Root 生产 ACL 未验证；
8. Web Release Root 尚未完全独立于 application；
9. standalone deployment bundle 未实现；
10. Runtime 独立 OS identity 未创建；
11. Production Storage delete ACL 未验证；
12. Windows ACL/Junction 真实权限未验证；
13. Gate 后 file handle fencing 未实现；
14. 外部 Evidence 未提供；
15. Production rollback policy UNKNOWN；
16. 旧 `.next` 和 Worker `dist` 仍存在。

## 20. BLOCKED 项目

```text
Production Instance Inventory:
BLOCKED / EVIDENCE MISSING

Scheduler / Watchdog Inventory:
BLOCKED / EXTERNAL ACCESS

Automatic Restart Verification:
BLOCKED / EXTERNAL CONFIG

Production Trust Root:
BLOCKED / NOT CONFIGURED

Production Signing Key:
BLOCKED / NOT CONFIGURED

Production Release Root ACL:
BLOCKED / ACL EVIDENCE MISSING

Production Storage Delete ACL:
BLOCKED / ACL EVIDENCE MISSING

Legacy Worker Drain:
BLOCKED / PRODUCTION EVIDENCE MISSING
```

## 21. 本轮未执行

```text
No PostgreSQL connection
No SQL
No Prisma Migration
No Integration Test
No E2E Test
No real Web startup
No real Worker startup
No service start/stop/restart
No process kill
No Scheduler change
No Windows Service change
No Task Scheduler change
No PM2/Docker/Kubernetes change
No production deployment
No release switch
No rollback
No real Storage access
No real cleanup or file deletion
No ACL/IAM/Bucket Policy change
No runtime identity creation
No production signing key
No production Trust Root
No Git write
No historical artifact delete/move/overwrite
No .env or .env.test content read
```

## 22. 历史产物 SHA-256

```text
apps/web/.next/BUILD_ID
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1

apps/worker/dist/file-maintenance.js
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3

apps/web/tsconfig.tsbuildinfo
018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777

apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

P1-3 Migration
187D82A00DB73CB6F5D79C97DCD6B4FF2E01BD7E5F78BB9E1273D54D8A141479
```

## 23. L7 文档与实现 SHA-256

```text
packages/build-integrity/src/index.mjs
34963943ED25155B79CFF504D147B620FA3BD58CC47631189FC6F679812E838D

apps/worker/scripts/start-secure.mjs
985A2B795206784B48971BCD706B84926F34474E2895DEEFCD620C762CF8B953

apps/worker/package.json
5852D4F37B9C1AA253C134DC6FBC59644C1C7FA0456FDF7AF07CF921AE0ECDBF

apps/web/package.json
BE62811C9769F5E4D8D56CFEF62B3EF412910B585A3E2BB1B14F24F6A5ABD778

apps/web/tests/p13-release-security.test.ts
F96584798B08C31CDA75A1EB825F363E2BD5057E2F5CB3DD34CFAA9C4DFC1247

apps/web/scripts/p13-deployment-evidence/evidence.ts
4E43523C0CFBA57F3A595FA7A4DBF6E40B30D30B820D913A8A59E2A2A980428B

apps/web/scripts/p13-deployment-evidence/cli.ts
365C2D2189F18BB09E93E585E9FC015E87A6B5EBE85DD916439EAB6B759C8844

apps/web/scripts/p13-deployment-evidence/manual-evidence.template.json
25E11E263CABF71BA358041851959C26B3126B741D979FA6736F472C33BC73C1

apps/web/tests/p13-deployment-evidence.test.ts
CEA64023F7960B574F069946FDDC62FBF59B9FB21D1BD30C363B1E9EE8EFF3B8

docs/architecture/file-lifecycle-p13-c6-2-l7-design.md
60D8F8B7DC24F66C1F989237B1B4FD9B570EE9E0320E4D804D2482FFD1BE958D

docs/architecture/file-lifecycle-p13-implementation-status.md
24D81A3F27EA2FE7090B900520BA6ACAA8611FCD24B150EC110A983E7FCFE1AF

docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
5062F58EC413AF039D1A3412EF6E6A9D223D29D602B0C48BAB75CBBB36A7C169
```

报告自身 SHA-256 在最终交付消息中提供。

## 24. 阶段门禁

```text
C-6.2-L7:
PASS WITH WARNINGS

Deployment Topology:
PARTIAL / PRODUCTION UNKNOWN

Web Startup Entry Audit:
COMPLETE IN REPOSITORY

Worker Startup Entry Audit:
COMPLETE IN REPOSITORY

Startup Gate Enforcement:
SUPPORTED ENTRIES VERIFIED / DEPLOYMENT UNKNOWN

Startup Gate Bypass:
EXTERNAL DIRECT/LEGACY ENTRY NOT ELIMINATED

Legacy Artifact Inventory:
LOCAL KNOWN / PRODUCTION UNKNOWN

Legacy Worker Drain Protocol:
COMPLETE

Legacy Worker Drain Execution:
NOT EXECUTED

Scheduler / Watchdog:
EXTERNAL UNKNOWN

Automatic Restart:
UNKNOWN

Build Identity:
IMPLEMENTED / TESTED

Signed Manifest:
IMPLEMENTED / TESTED

Production Trust Root:
NOT CONFIGURED

Production Signing Key:
NOT CONFIGURED

Release Root:
PARTIAL / PRODUCTION ACL NOT VERIFIED

Runtime Identity:
DESIGNED / OS NOT VERIFIED

Production Storage ACL:
NOT VERIFIED

External Evidence Collector:
PARTIAL / OFFLINE VALIDATOR IMPLEMENTED

Deployment Simulation:
PASS IN ISOLATION

Independent Security Audit:
COMPLETE WITH OPEN GAPS

Legacy Artifact Removal:
NOT EXECUTED

Production Deployment:
NOT EXECUTED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```
