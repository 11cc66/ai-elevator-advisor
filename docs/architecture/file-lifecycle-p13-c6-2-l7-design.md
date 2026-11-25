# P1-3 C-6.2-L7 Production Deployment Trust 与 Legacy Drain Readiness 设计

## 文档信息

- 阶段：`C-6.2-L7`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 设计状态：`IMPLEMENTED IN REPOSITORY / PRODUCTION EVIDENCE OUTSTANDING`
- 数据库：`NOT CONNECTED`
- 真实 Storage：`NOT ACCESSED`
- Production Trust Root：`NOT CONFIGURED`
- Legacy Worker Drain：`NOT EXECUTED`

## 1. 目标

本设计回答两类问题：

1. 仓库中哪些启动入口能进入受签名 Gate 保护的 Web/Worker；
2. 外部管理员必须提交什么证据，才能证明旧 Worker、Scheduler、自动重启和宽删除权限已经排空。

代码与文档不能代替生产事实。没有外部证据的项目保持 `UNKNOWN` 或 `BLOCKED`。

## 2. Deployment Topology

```text
Source Repository
  -> Build Pipeline [PARTIAL: repository scripts verified, CI/CD UNKNOWN]
  -> Artifact Creation [VERIFIED IN ISOLATION]
  -> Signing [IMPLEMENTED; production key NOT CONFIGURED]
  -> Release Root [DESIGN COMPLETE; production ACL NOT VERIFIED]
  -> Startup Gate [IMPLEMENTED / UNIT TESTED]
       -> Web Runtime [secure launcher + instrumentation gate]
       -> Worker Runtime [gated index + secure launcher]
       -> Maintenance Runtime [inside Worker; non-destructive]
  -> Storage / Database [production permissions NOT VERIFIED]
```

### 2.1 仓库内可验证

- Web build 只允许通过 `apps/web/scripts/build-secure.ts`；
- Web start 只支持通过 `apps/web/scripts/start-secure.mjs`；
- Worker build 只允许通过 `apps/worker/scripts/build-secure.ts`；
- Worker package start 在 L7 改为 `apps/worker/scripts/start-secure.mjs`；
- Worker `index.ts` 先运行 Gate，再动态 import business entry；
- Web instrumentation 在 Node production runtime 再次运行 Gate；
- Storage delete capability 和 Legacy cleanup quarantine 保持 L6 边界。

### 2.2 仓库内未发现

- Dockerfile / Compose；
- Kubernetes / Helm；
- Terraform / Pulumi / Ansible；
- PM2 / systemd；
- Windows Service 项目配置；
- Task Scheduler XML；
- 外部 Cron / Supervisor / Watchdog；
- CI/CD workflow。

这只能说明当前仓库没有这些本地配置，不能证明外部生产系统不存在。

## 3. Web 启动入口

| 入口 | Gate | 分类 | 风险 |
|---|---|---|---|
| `pnpm --filter @elevator/web start` | Secure Launcher + child instrumentation | SUPPORTED | LOW |
| `node scripts/start-secure.mjs` | 两次 Gate | SUPPORTED | LOW |
| `next dev` | 无 production Gate | DEVELOPMENT ONLY | 若暴露生产则 HIGH |
| direct `next start` | 取决于实际 `.next`；旧产物可能无 Gate | DEPLOYMENT BYPASS | HIGH |
| custom Node server | 当前不存在 | UNKNOWN | 新增入口必须 Gate |
| external PM2/Service/Container | 外部配置未知 | UNKNOWN | 必须证明 command 指向 wrapper |

`start-secure.mjs` 先校验 Manifest、Artifact、Runtime Dependency 和 Legacy marker，再启动 Next。Next production instrumentation 在 Node runtime 再次校验。

无法由仓库代码禁止外部 operator 直接执行 `next start`；部署证据必须证明不存在该入口。

## 4. Worker 启动入口

| 入口 | Gate | 分类 | 风险 |
|---|---|---|---|
| `pnpm --filter @elevator/worker start` | L7 Secure Launcher + gated release index | SUPPORTED | LOW |
| `node <release>/index.js` | Worker index Gate | SUPPORTED | LOW |
| `worker-entry.ts/js` 直接启动 | 无独立外部 Gate | PROHIBITED | HIGH |
| `node dist/index.js` | 当前 `dist` 为历史产物 | LEGACY PROHIBITED | CRITICAL |
| `tests/test-worker-entry.ts` | Test only | TEST ONLY | 生产禁止 |
| PDF Worker Thread | 由已 Gate 的 Worker 创建子线程 | INTERNAL | 不是进程入口 |

L7 修复前 Worker package `start` 为 `node dist/index.js`，而历史 `dist` 含旧删除代码。现在 package start 改为 secure launcher：

```text
start-secure.mjs
  -> verifyStartupRelease()
  -> require <release>/index.js regular file
  -> realpath/root containment check
  -> spawn node <release>/index.js
  -> gated index verifies again
  -> dynamic import worker-entry
```

历史 `dist` 仍存在且禁止删除或覆盖。部署层必须确保 Service、Watchdog 和自动重启不引用它。

## 5. Build Identity 与 Signed Manifest

Manifest 当前绑定：

- `manifestVersion`；
- `application`；
- `buildId`；
- `releaseId`；
- `gitSha` / `gitDirty`；
- `sourceTreeDigest` 与排除策略版本；
- `dependencyLockDigest`；
- `runtimeDependencyDigest` / count / platform；
- `artifactDigest`；
- `buildTimestamp`；
- `lifecycleSafetyVersion`；
- `cleanupCapability=DISABLED`；
- Artifact Root scope。

安全属性：

- Strict JSON：拒绝重复 key 和 trailing content；
- Canonical JSON：签名对象排序确定；
- Ed25519；
- Trusted key ID 必须存在于 Trust Root；
- Runtime Dependency Closure 每次 Gate 重新计算；
- Artifact 中 Legacy delete marker 必须为零；
- 未来时间超过 5 分钟拒绝；
- 构建超过 365 天拒绝；
- 低于最小 Lifecycle Safety Version 拒绝；
- `cleanupCapability` 只允许 `DISABLED`。

尚未实现：

- Trusted key 的 `validFrom/validUntil/revokedAt` 元数据；
- 签名密钥轮换状态机；
- Revocation List；
- Release rollback counter / anti-downgrade release sequence；
- 独立的签名审批证据。

这些必须在生产启用前由 Trust Root 管理方案补齐。

## 6. Trust Root

### 6.1 主体分离

| 主体 | 私钥 | Trust Root 写 | Release 写 | Runtime 启动 |
|---|---|---|---|---|
| Build Identity | 否 | 否 | 未发布输出 | 否 |
| Release Signer | KMS/HSM 内 | 否 | 否 | 否 |
| Deployment Admin | 否 | 否 | 是 | 否 |
| Trust Root Admin | 否 | 是 | 否 | 否 |
| Web Runtime | 否 | 否 | 否 | 是 |
| Worker Runtime | 否 | 否 | 否 | 是 |
| Maintenance | 否 | 否 | 否 | 由 Worker 派生 |

生产私钥不得进入源码、Artifact、Release Root、环境变量、日志或证据文件。

### 6.2 Trusted Public Key Registry

当前代码接受严格 JSON：

```json
{
  "keys": {
    "key-id": "PUBLIC KEY PEM"
  }
}
```

生产 Registry 必须由 Trust Root Admin 写入，Web/Worker/Maintenance 只读。

### 6.3 Key 生命周期

设计目标：

- Offline Root；
- Release Signing Key；
- 每个 key 的 `keyId`、fingerprint、validFrom、validUntil、status；
- 正常轮换保持旧 key 验证窗口；
- 撤销后拒绝新 Release；
- Emergency Revocation 不依赖待发布 Release；
- Trust Root 更新需双人审批和审计。

实现状态：`DESIGN ONLY / PRODUCTION NOT CONFIGURED`。

### 6.4 路径与读取稳定性

L7 加固：

- Release Root、Runtime Root、Artifact Root、Manifest、Trust Root 父路径不得包含 symlink/Junction/Reparse Point；
- Trust Root 与 Manifest 在读取前后核对 dev/inode/size/mtime；
- 缺失文件返回明确 `TRUST_ROOT_IDENTITY_INVALID` / `MANIFEST_IDENTITY_INVALID`；
- Trust Root 替换公钥导致签名验证失败。

代码不能证明 ACL 不可写。生产必须提供运行身份无写权限的 ACL 证据。

## 7. Release Root

### 7.1 安全要求

- 不在源码工作树内；
- 不在临时构建目录内；
- 不在普通运行可写目录内；
- 不完整 Release 不可启动；
- 每个 Release 使用唯一 release ID；
- Manifest 与 Artifact 在同一 Release Root；
- Runtime 只读；
- Web/Worker 无创建、覆盖、重命名和删除权限；
- 父目录同样不可由 Runtime 替换；
- 拒绝 Junction/Symlink/Reparse Point；
- 部署切换必须使用完整 Release 和原子 pointer/metadata 变更；
- 自动重启只能引用 CURRENT Release。

### 7.2 当前实现边界

Web isolated build 当前输出到：

```text
apps/web/.p13-releases/<releaseId>
```

它保证不复用旧 `.next`，但位于 runtime application 目录内，尚未达到“独立于源码物理目录”的生产目标。

Worker 的安全构建允许配置 Release Root，但 Runtime Dependency Closure 仍来自 installed application；完整 standalone Worker bundle 尚未实现。

因此：

```text
Build isolation:
VERIFIED

Release Root reparse protection:
CODE TESTED

Production immutable ACL:
NOT VERIFIED

Standalone deployment bundle:
NOT IMPLEMENTED
```

## 8. Runtime Identity Matrix

| Identity | Release Read | Release Write | Trust Read | Trust Write | Storage Read | Staging Write | Canonical Write | Physical Delete |
|---|---|---|---|---|---|---|---|---|
| BUILD_IDENTITY | build inputs | unpublished temp | public keys optional | NO | NO | NO | NO | NO |
| RELEASE_SIGNER_IDENTITY | digest only | NO | policy state | NO | NO | NO | NO | NO |
| WEB_RUNTIME_IDENTITY | YES | NO | YES | NO | business need | YES | finalize only | NO |
| WORKER_RUNTIME_IDENTITY | YES | NO | YES | NO | YES | default NO | NO | NO |
| MAINTENANCE_RUNTIME_IDENTITY | YES | NO | YES | NO | task need | NO | NO | NO |
| FUTURE_CLEANUP_IDENTITY | scoped | NO | YES | NO | scoped | NO | NO | approved scope only |
| DEPLOYMENT_ADMIN_IDENTITY | YES | YES | NO | NO | NO | NO | NO | NO |
| TRUST_ROOT_ADMIN_IDENTITY | NO | NO | YES | YES | NO | NO | NO | NO |

当前：

- Web/Worker/Maintenance 的代码 capability 已隔离；
- 真实 OS 账户和 ACL 尚未建立/验证；
- Future Cleanup 账户未创建。

## 9. Storage ACL 最小权限

必须验证：

```text
Web:
  staging: write allowed
  canonical: read/finalize path only
  delete: denied

Worker:
  uploads: read
  processing internal artifacts: scoped if later needed
  delete: denied

Maintenance:
  no Storage dependency
  delete: denied

Future Cleanup:
  independent identity
  scoped delete only
  default not created
```

本地测试覆盖 capability wrapper 和 fail-closed quarantine；NTFS、SMB 与云对象存储 ACL 均未验证。

## 10. Legacy Artifact Inventory

每个 Artifact 必须记录：

```text
Artifact ID
Application
Location
Build ID
Release ID
Source Tree Digest
Artifact Digest
Runtime Dependency Digest
Lifecycle Safety Version
Manifest Status
Startup Gate Status
Cleanup Capability
Legacy Delete Marker Count
Can Start Directly
Can Be Restarted
Production Status
```

当前本地历史产物：

| Artifact | Manifest | Identity | Legacy Delete | Direct Start | Production Status |
|---|---|---|---|---|---|
| `apps/web/.next` | 无 | 旧 BUILD_ID 可读 | 已知存在历史风险 | 可能 | UNKNOWN |
| `apps/worker/dist` | 无 | 无已验证 Release | 已知存在旧删除代码 | 可能 | UNKNOWN |
| 当前源码 | N/A | Git HEAD | L6 scan 0 unallowlisted | 非部署产物 | SOURCE |
| 隔离 `.p13-releases` | 有签名测试 Manifest | 隔离 build 已验证 | 0 | Gate 保护 | TEST/ISOLATED |

历史 `.next` 和 Worker `dist` 未移动、覆盖或删除。

## 11. Legacy Worker Drain Protocol

### Phase 0：冻结

- 禁止旧版本新部署；
- 禁止回滚到旧 Artifact；
- 记录当前候选 Release；
- 获取变更审批。

### Phase 1：Inventory

- Web/Worker/Maintenance 实例；
- PID/Container/Service ID；
- Host ID；
- Artifact Path；
- Build/Release ID；
Startup Entry；
- Runtime Identity；
- Scheduler/Watchdog；
- Auto Restart；
- Storage Root 与 ACL 证据。

### Phase 2：停止新 Legacy Intake

- 暂停旧 Scheduler；
- 禁止旧 Job producer；
- 禁止自动重启旧 Artifact；
- 保留普通 processing 状态可审计。

### Phase 3：Drain

- 等待 Maintenance queue expiry 120 秒；
- 记录 legacy running/backlog/failed；
- 等待 Worker graceful stop 10 秒；
- 处理未知 active job；
- 不执行新 Cleanup。

### Phase 4：停止实例

- 逐实例停止；
- 验证进程退出；
- 验证自动重启关闭；
- 验证 Scheduler 无残余；
- 保存日志和命令输出摘要。

### Phase 5：撤销权限

- 撤销旧 Worker DB/Queue 登录；
- 撤销旧 Web/Worker/Maintenance Storage delete；
- 保持 Future Cleanup 未创建；
- 不修改新运行签名权限。

### Phase 6：验证

- 所有旧实例为 0；
- 外部 Scheduler 为 0；
- Legacy Auto Restart 为 0；
- Legacy Artifact direct start 不可达；
- New Release Gate PASS；
- Web/Worker normal smoke test PASS；
- 告警和队列可见。

### Phase 7：退休审批

- 只有独立管理员审批后才能隔离/删除旧产物；
- 本阶段不执行。

## 12. Scheduler 与自动重启

已确认仓库内 PgBoss：

```text
file-maintenance
  cron = */15 * * * *
  key = regular-file-maintenance
  startup immediate execution = same non-destructive function
```

无法确认外部：

- Task Scheduler；
- Windows Service recovery；
- PM2 autorestart；
- Docker restart policy；
- Kubernetes controller；
- systemd Restart=；
- Supervisor/Watchdog；
- 外部 Cron。

任何 enabled scheduler 或 auto restart 若不能映射到 verified CURRENT Release，均阻断排空。

## 13. External Evidence Tool

新增：

```text
apps/web/scripts/p13-deployment-evidence/evidence.ts
apps/web/scripts/p13-deployment-evidence/cli.ts
apps/web/scripts/p13-deployment-evidence/manual-evidence.template.json
apps/web/tests/p13-deployment-evidence.test.ts
```

证据类别：

- Evidence metadata；
- Processes；
- Services；
- Schedulers；
- Web/Worker/Maintenance instances；
- Artifacts；
- Trust Chain；
- Runtime Identities；
- Storage ACL；
- Queue drain state；
- Integrity digest。

Validator 规则：

- 严格字段；
- 拒绝 secret-like value/field；
- 只接受绝对 Artifact path；
- Evidence 最大年龄 24 小时；
- 未来时间超过 5 分钟拒绝；
- 校验 evidence body SHA-256；
- 信任链、签名 key、Trust Root 必须明确；
- CURRENT Artifact 必须具备完整 digest、Manifest、Gate、cleanup DISABLED、Legacy marker 0；
- Legacy Artifact 若可直接启动或自动重启则阻断；
- Legacy instance、scheduler、auto restart 任何存在均阻断；
- Legacy queue running/backlog/failed 必须为 0；
- Web/Worker/Maintenance Runtime 的 Release/Trust 写权限必须为 false；
- Storage delete 必须 `DENIED_VERIFIED`；
- 缺少 Release/Trust/Storage ACL denial 证据即阻断。

Evidence checksum 只用于检测意外变化，不是生产签名或身份证明。

调用：

```powershell
pnpm --filter @elevator/web p13:evidence:validate -- <evidence.json>
```

本轮没有生产 Evidence 文件，因此 Validator 只能通过合成隔离 Fixture 验证，不能输出生产 READY。

## 14. 部署模拟和攻击测试

已有隔离测试覆盖：

- Manifest 缺失；
- Trust Root 缺失；
- Trust Root 公钥替换；
- Manifest 签名篡改；
- Artifact 替换/新增；
- Runtime Dependency 修改/删除；
- 旧 Lifecycle Safety Version；
- 过期 Build；
- Legacy delete marker；
- Artifact Root 最终 Junction；
- Artifact Root 父路径 Junction；
- Trust Root 父路径 Junction；
- Gate 后 Artifact 再次变化；
- Evidence 过期、篡改摘要、secret、unknown ACL；
- Legacy instance/scheduler/auto restart/queue；
- direct legacy startup 和 unknown startup entry；
- Worker package start 不再指向 `dist`。

环境限制：

- Windows ACL 实际拒绝写无法由 sandbox user 稳定模拟；
- Gate 与进程启动之间完整 OS handle fencing 未实现；
- 真实 Service/Container restart policy 不可见；
- 真实 External Scheduler 不可见。

## 15. 威胁模型

| 威胁 | 当前防线 | 剩余风险 |
|---|---|---|
| 旧 Worker 自动重启 | secure launcher + Release identity evidence | Auto Restart 配置 UNKNOWN |
| 旧 `dist` 直接启动 | package start 修复；evidence blocker | `node dist/index.js` 仍可被恶意命令执行 |
| direct next start | instrumentation + deployment evidence | 旧 `.next` 无 Gate |
| Manifest 篡改 | Ed25519 + canonical JSON | Trust Root 写权限未验证 |
| 公钥替换 | Trust Root identity checks | 生产 ACL NOT VERIFIED |
| Artifact 替换 | full Artifact Digest | Gate 后写入依赖 ACL |
| Dependency 替换 | Runtime Closure Digest | 未声明动态 import 仍存在 |
| Junction 逃逸 | root parent component checks | 所有 Windows reparse tag 未穷举 |
| 构建失败回退 | unique release + Gate | 部署系统回滚策略 UNKNOWN |
| 旧删除能力 | L6 capability isolation + fail-closed | 旧产物与 OS delete ACL 仍存在 |
| Scheduler 重复 | PgBoss key + evidence | 外部 Cron/Task UNKNOWN |
| Evidence 伪造 | checksum + explicit blockers | 无生产签名，需可信采集链 |

## 16. 未解决风险与阻塞

- 生产实例清单未知；
- 生产 Scheduler/Watchdog 未知；
- Auto Restart 未知；
- 真实 Trust Root/Signing Key 未配置；
- Key revocation/rotation metadata 未实现；
- Release Root 生产 ACL 未验证；
- Web Release Root 尚未完全独立于 application 目录；
- standalone deployment bundle 未实现；
- Worker package secure start 已验证为源码入口，但未执行真实 Release；
- 生产 Storage delete ACL 未验证；
- Runtime 独立 OS 身份未创建；
- Gate 后文件写入防护依赖 ACL；
- Windows ACL 与真实 Junction/Reparse 未验证；
- 外部 Evidence 尚未提供。

## 17. 门禁

```text
Repository Deployment Trust Architecture:
IMPLEMENTED

Production Trust Root:
NOT CONFIGURED

Production Signing Key:
NOT CONFIGURED

Production Release Root:
NOT VERIFIED

Legacy Worker Drain Execution:
NOT EXECUTED

Production Storage ACL:
NOT VERIFIED

External Production Evidence:
NOT PROVIDED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```
