# P1-3 C-6.2-L8-A Production Evidence Intake & Verification 报告

## 文档信息

- 阶段：`C-6.2-L8-A`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 最终结论：`PASS WITH WARNINGS`

## 1. 最终状态

```text
C-6.2-L8-A:
PASS WITH WARNINGS

Production Evidence Schema:
IMPLEMENTED / VERSION 2 / STRICT

Evidence Validator:
IMPLEMENTED / OFFLINE / TESTED

Host Inventory:
BLOCKED / NO PRODUCTION EVIDENCE

Worker Inventory:
BLOCKED / NO PRODUCTION EVIDENCE

Scheduler / Watchdog:
BLOCKED / NO PRODUCTION EVIDENCE

Automatic Restart:
BLOCKED / NO PRODUCTION EVIDENCE

Artifact Verification:
BLOCKED / NO PRODUCTION ARTIFACT EVIDENCE

Trust Root:
BLOCKED / PRODUCTION NOT CONFIGURED

Runtime Identity:
BLOCKED / NO PRODUCTION IDENTITY EVIDENCE

Storage ACL:
BLOCKED / NO PRODUCTION ACL EVIDENCE

Legacy Queue:
BLOCKED / NO APPROVED QUEUE EXPORT

Evidence Integrity:
SCHEMA AND TEST SIGNATURE IMPLEMENTED / NO PRODUCTION BUNDLE

Drain Readiness:
BLOCKED

Production Drain:
NOT EXECUTED

Legacy Artifact Removal:
NOT EXECUTED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

L8-A 的仓库内证据工具已完成，但本阶段没有真实生产 Evidence Bundle，因此不能输出 `READY FOR HUMAN REVIEW`。

## 2. Git 与工作树

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保留此前所有未提交变更。未执行 Git 写操作。

## 3. 修改文件

新增：

```text
apps/web/scripts/p13-deployment-evidence/evidence-bundle.ts
apps/web/scripts/p13-deployment-evidence/requirements.ts
apps/web/scripts/p13-deployment-evidence/verification-trust.template.json
apps/web/tests/p13-deployment-evidence-bundle.test.ts
docs/architecture/file-lifecycle-p13-c6-2-l8a-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a-admin-evidence-guide.md
```

更新：

```text
apps/web/scripts/p13-deployment-evidence/cli.ts
apps/web/scripts/p13-deployment-evidence/manual-evidence.template.json
docs/architecture/file-lifecycle-p13-implementation-status.md
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
```

未修改：

- Prisma Schema；
- Migration；
- 数据库角色/ACL；
- 历史 `.next` / Worker `dist`；
- Web/Worker 启动 Gate；
- Storage capability；
- 生产部署配置。

## 4. Evidence Requirement Matrix

新增 `requirements.ts`，覆盖 19 类：

```text
HOST_INVENTORY
WEB_INSTANCE
WORKER_INSTANCE
PROCESS_INVENTORY
STARTUP_ENTRY
ARTIFACT_IDENTITY
RELEASE_MANIFEST
TRUST_ROOT
RELEASE_ROOT
RUNTIME_IDENTITY
STORAGE_ACL
SCHEDULER
WATCHDOG
AUTO_RESTART
QUEUE_STATE
RUNNING_JOBS
RETRY_JOBS
NETWORK_AND_DEPENDENCY
DRAIN_APPROVAL
```

每项记录：

- Evidence ID；
- Source；
- Collection method；
- Host identity；
- Collected At；
- Collector identity/version；
- Verification method；
- Freshness；
- Cross-evidence dependencies；
- Acceptance/failure conditions。

## 5. Host 与实例证据

V2 Schema 覆盖：

- Host ID / Role / OS / Environment / Region；
- PID / Parent PID / Executable / Command Line；
- Working Directory；
- Runtime Identity；
- Startup Entry；
- Artifact ID；
- Release Root ID；
- Release/Build/Digest/Lifecycle Safety；
- Process Start Time；
- Auto Restart ID。

跨证据验证：

- Host 引用；
- Process Key 唯一；
- Instance → Process；
- Process/Instance Host、Entry、Artifact 一致；
- Instance identity 与 Artifact 一致；
- Web/Worker 至少各一个；
- 命令不得包含 `dist/index.js`、`worker-entry` 或 `next start`。

## 6. Scheduler / Watchdog / Auto Restart

Schema 覆盖：

- Windows Service；
- Task Scheduler；
- PM2；
- Docker；
- Kubernetes；
- Cron；
- systemd；
- Supervisor；
- Watchdog；
- CI/CD；
- Cloud Scheduler；
- Other/Unknown。

所有 Enabled Scheduler/Watchdog 和目标 Artifact 均交叉验证。

以下阻断：

- Scheduler 指向 Legacy/Unknown Artifact；
- Scheduler Command 含 direct/legacy entry；
- Watchdog 指向 Legacy Artifact；
- Scheduler/Watchdog Type UNKNOWN；
- Service State UNKNOWN；
- Auto Restart 指向 Legacy 或 direct entry。

## 7. Artifact 与 Manifest

Artifact 证据包含完整 identity 和签名 Manifest envelope。

Validator 独立执行：

- Trust Key ID lookup；
- Ed25519 公钥类型；
- SPKI DER SHA-256 fingerprint；
- Key ACTIVE / validFrom / validTo；
- Manifest 签名验证；
- Application/Release/Build/Digest/Lifecycle 一致性；
- Manifest Build Timestamp；
- Minimum Lifecycle Safety；
- `cleanupCapability=DISABLED`；
- CURRENT Legacy marker = 0；
- Legacy Artifact 不可直接启动/重启。

不信任管理员自己填写的 `manifestStatus=VERIFIED`。

## 8. Trust Root

Trust Root 证据包含：

- Trust Root ID；
- 绝对路径；
- 读/修改主体；
- Key ID；
- 公钥 PEM；
- 指纹；
- 生效/失效时间；
- ACTIVE/REVOKED/EXPIRED；
- 最近轮换时间。

以下阻断：

- Key 不在 Trust Root；
- Key 撤销或过期；
- Fingerprint 不匹配；
- Manifest 使用不同 Key ID；
- Runtime account 是 Trust Root modifier；
- Duplicate Key ID。

Production Trust Root：

```text
NOT CONFIGURED
```

## 9. Release Root

Release Root 证据要求：

- Runtime write denied；
- Parent write denied；
- Runtime delete denied；
- Reparse-free；
- Atomic switch verified；
- Runtime 不是 Release Root modifier。

当前：

```text
Repository checks:
IMPLEMENTED

Production Release Root ACL:
NOT VERIFIED
```

## 10. Runtime Identity

必须独立证明：

```text
WEB_RUNTIME_IDENTITY
WORKER_RUNTIME_IDENTITY
MAINTENANCE_RUNTIME_IDENTITY
```

检查：

- unique account；
- not shared；
- Release Root read only；
- Trust Root read only；
- Storage physical delete denied；
- cleanup DISABLED。

当前：

```text
Code Capability Separation:
PRESERVED

Production OS Identity:
NOT PROVIDED
```

## 11. Storage ACL

ACL 记录完整权限：

```text
read
create
write
rename
delete
modifyAcl
changeOwner
```

并检查：

- inheritance；
- parent-wide permission；
- Reparse Point；
- external object store；
- ACL modifier identity。

以下阻断：

- Runtime delete；
- Runtime modify ACL/owner；
- Runtime ACL modifier；
- Parent-wide permission；
- Reparse Point；
- External Object Store 权限未明确；
- Release/Trust Root Runtime write/create/rename；
- Web/Worker/Maintenance 缺少 Release/Trust/Canonical ACL 证据。

## 12. Queue / Job / Operation

Queue Snapshot 覆盖：

- Waiting；
- Active；
- Retry；
- Failed；
- Scheduled；
- Oldest；
- Consumption rate；
- Unfinished Operation；
- Active Upload；
- Processing Recovery。

Gate：

- Snapshot ≤ 15 分钟；
- 所有队列计数为 0；
- Oldest = null；
- Operation/Upload = 0；
- Recovery = IDLE；
- 无非 COMPLETE Job；
- Legacy network dependency unreachable。

当前无生产 Queue Export。

## 13. Evidence Trust Level

| Level | 可以证明 | 不能证明 |
|---|---|---|
| 0 | 口头声明 | 任何技术事实 |
| 1 | 截图/文本 | 来源、完整性、实时性 |
| 2 | 原始命令输出 | 执行者身份、防篡改 |
| 3 | 可信只读采集器结构化输出 | 采集端未被攻陷 |
| 4 | 独立签名并外部信任验证 | 操作已执行或审批生效 |

L8-A 关键证据必须 Level 3/4。

## 14. Evidence Integrity

### Bundle Digest

```text
SHA-256(canonical body without integrity/signature)
```

### Evidence Signature

```text
Ed25519
payload = canonical body including integrity, excluding signature
```

验证使用独立提供的 Signer public keys 和 trusted collector identities。

未签名、错误签名、未知 Signer 或不受信 Collector 均阻断。

本轮只使用一次性测试密钥。生产 Evidence Signer 未配置。

## 15. Cross-Evidence Consistency

已实现：

- Duplicate Evidence ID；
- Duplicate Process ID；
- Duplicate Instance ID；
- Unknown Host；
- Process/Instance mismatch；
- Instance/Artifact mismatch；
- Unknown Trust/Release Root；
- Duplicate Trust Key ID；
- Unknown ACL/Metadata Identity；
- Shared Runtime Account；
- Scheduler/Service/Watchdog target；
- Approval Bundle ID；
- Collection time skew；
- Queue source freshness。

最大跨主机采集偏差：30 分钟。

## 16. Drain Readiness

输出 Sections：

```text
EvidenceIntegrity
HostInventory
InstanceInventory
SchedulerWatchdog
AutomaticRestart
ArtifactVerification
TrustRoot
RuntimeIdentity
StorageAcl
LegacyQueue
DrainApproval
ReleaseRoot
```

任何 blocker：

```text
Drain Readiness = BLOCKED
```

零 blocker：

```text
READY FOR HUMAN REVIEW
```

不含 `DRAIN EXECUTED` 状态。

## 17. 攻击性测试

| 攻击 | 结果 |
|---|---|
| 缺失 Host | BLOCKED / SCHEMA |
| 未知 Host | BLOCKED |
| 缺失 Worker | BLOCKED |
| Duplicate Process ID | BLOCKED |
| Duplicate Instance ID | BLOCKED |
| Duplicate Evidence ID | BLOCKED |
| Process/Instance mismatch | BLOCKED |
| Legacy Artifact | BLOCKED |
| 无效 Manifest signature | BLOCKED |
| Revoked key | BLOCKED |
| 错误 Trust Root | BLOCKED |
| Shared Runtime Account | BLOCKED |
| Runtime delete ACL | BLOCKED |
| Runtime ACL modifier | BLOCKED |
| Missing ACL | BLOCKED |
| Unsafe Release Root | BLOCKED |
| Legacy Scheduler | BLOCKED |
| Legacy Watchdog | BLOCKED |
| Legacy Auto Restart | BLOCKED |
| Active/Retry Job | BLOCKED |
| Queue 非零 | BLOCKED |
| Legacy dependency reachable | BLOCKED |
| Evidence stale/future | BLOCKED |
| Cross-host time skew | BLOCKED |
| Tampered Bundle | BLOCKED |
| Unknown Evidence Signer | BLOCKED |
| Low-trust Collector | BLOCKED |
| Single Approval | BLOCKED |
| Scheduler/Watchdog/Service UNKNOWN | BLOCKED |
| Direct startup command | BLOCKED |

## 18. 回归测试

```text
Web:
23 files / 146 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS

Web TypeScript:
PASS

Worker TypeScript:
PASS
```

本轮没有真实 Integration/E2E/DB/Storage 测试。

## 19. 生产证据状态

```text
Production Evidence Bundle:
NOT PROVIDED

Host Inventory:
UNKNOWN

Worker Inventory:
UNKNOWN

Scheduler / Watchdog:
UNKNOWN

Automatic Restart:
UNKNOWN

Artifact Verification:
NOT VERIFIED

Trust Root:
NOT CONFIGURED

Runtime Identity:
NOT VERIFIED

Storage ACL:
NOT VERIFIED

Legacy Queue:
NOT VERIFIED

Evidence Integrity:
NO PRODUCTION SIGNED BUNDLE

Drain Readiness:
BLOCKED
```

## 20. 未解决风险

- 生产主机清单和覆盖范围未知；
- 外部 Scheduler/Watchdog 未知；
- Worker 自动重启配置未知；
- 生产 Trust Root/Signing Key 未配置；
- Evidence Signer 未配置；
- Trust Key 长期轮换/撤销自动化未实现；
- 生产 Release Root ACL 未验证；
- Runtime 独立 OS 账号未验证；
- NTFS/SMB/对象存储 delete ACL 未验证；
- 真实 Queue/PgBoss 状态未导出；
- Windows Reparse Point 和文件句柄 fencing 未验证；
- 生产 Evidence 采集端自身可信性未验证；
- 旧 `.next` 和 Worker `dist` 仍存在。

## 21. 未执行操作

```text
No production server connection
No SSH / remote command
No PostgreSQL connection
No SQL / Migration
No Kubernetes / Docker / PM2 access
No service start/stop/restart
No Scheduler/Watchdog change
No deployment or rollback
No real Storage access
No file deletion or Cleanup
No ACL/IAM/Bucket Policy change
No production evidence signing key
No Git write
No historical artifact change
No .env / private key / token read
```

## 22. 保护哈希

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

## 23. L8-A SHA-256

```text
apps/web/scripts/p13-deployment-evidence/evidence-bundle.ts
4C4FA51201D938FAE4292C895442AB176FFE1F9DDEF19BB53AACB525E09B3FFA

apps/web/scripts/p13-deployment-evidence/requirements.ts
75ADBA78215209D6440B4B792AD0DE95F73442D42674331A04A94E0EB1846E7D

apps/web/scripts/p13-deployment-evidence/cli.ts
779351E60CF3F1F76C21320AC05F5A1DBA579F5B7714CC82B3E30542848BD345

apps/web/scripts/p13-deployment-evidence/manual-evidence.template.json
67D4FD04B55C8FB3EBF2C6354F09022C6DDD6A8F9069D69379B83E883539F749

apps/web/scripts/p13-deployment-evidence/verification-trust.template.json
FF92FBAAC1A99C64A6D46B8B568038F1E16E43F95D5193DCAC5AF3AB99182139

apps/web/tests/p13-deployment-evidence-bundle.test.ts
8D9E9C8BFEEED82736EDAE0D9A9390667FFA45214F3D1FB5CDF16A8D7FF6A04D

docs/architecture/file-lifecycle-p13-c6-2-l8a-design.md
ACEBF1B4AF0D16235FEC616B7908DC55AA044759D8FCDDB841C85E4F3A98FFB3

docs/architecture/file-lifecycle-p13-c6-2-l8a-admin-evidence-guide.md
57E8964FE4530B3CC4E2DB8C2E4A03236E58DA119DD8C13E5D5FEE72B0BE6B3E

docs/architecture/file-lifecycle-p13-implementation-status.md
AB3C6B1C10AE90BD049CD37C2C5E01C912C4E3D6FF34E4DB3D74812584CC5E13

docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
F698209CAD9B21AAF83E138F2F0A0E9CC8C04E09B2173A4F1B154A00697FBF6D
```

报告自身 SHA-256 在最终交付消息中提供。

## 24. 最终门禁

```text
C-6.2-L8-A:
PASS WITH WARNINGS

Production Evidence Schema:
IMPLEMENTED

Evidence Validator:
IMPLEMENTED / TESTED

Host Inventory:
BLOCKED

Worker Inventory:
BLOCKED

Scheduler / Watchdog:
BLOCKED

Automatic Restart:
BLOCKED

Artifact Verification:
BLOCKED

Trust Root:
BLOCKED / NOT CONFIGURED

Runtime Identity:
BLOCKED

Storage ACL:
BLOCKED

Legacy Queue:
BLOCKED

Evidence Integrity:
NO PRODUCTION SIGNED BUNDLE

Drain Readiness:
BLOCKED

Production Drain:
NOT EXECUTED

Legacy Artifact Removal:
NOT EXECUTED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```
