# P1-3 C-6.2-L8-A Production Evidence Intake & Verification 设计

## 文档信息

- 阶段：`C-6.2-L8-A`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 设计状态：`IMPLEMENTED / FAIL-CLOSED / PRODUCTION EVIDENCE NOT PROVIDED`
- Production Drain：`NOT EXECUTED`

## 1. 目标

建立生产证据 intake 和离线验证机制，回答：

```text
生产实例是否完整盘点？
Scheduler/Watchdog/自动重启是否全部识别？
运行 Artifact 是否有独立验证的签名 Manifest？
Trust Root 是否可信且不可由 Runtime 修改？
Runtime 与 Storage ACL 是否禁止物理删除？
Legacy Queue/Job/Upload/Operation 是否已排空？
是否有两名独立管理员绑定同一 Evidence Bundle 审批？
```

只有全部证据通过，才输出：

```text
READY FOR HUMAN REVIEW
```

不等于 Drain 授权或执行。

## 2. 四类事实严格分离

| 层级 | 内容 | 当前结论 |
|---|---|---|
| Repository Capability | 源码、Schema、Gate、Capability isolation | 可在仓库和隔离测试中验证 |
| Local Observation | 当前主机进程/服务/端口只读观察 | LOCAL / PARTIAL |
| Administrator Evidence | 生产管理员提供的结构化证据 | NOT PROVIDED |
| Independent Verification | 离线签名、Manifest、ACL、跨证据验证 | Tool ready；production evidence NOT VERIFIED |

不得将前一层结论外推为后一层事实。

## 3. Evidence Requirement Matrix

代码矩阵：

```text
apps/web/scripts/p13-deployment-evidence/requirements.ts
```

每个 Requirement 包含：

- Evidence ID；
- Category；
- Required；
- Source；
- Collection Method；
- Host Identity；
- Collected At；
- Collector Identity；
- Collector Version；
- Bundle SHA-256；
- Verification Method；
- Freshness；
- Cross-Evidence Dependencies；
- Acceptance Criteria；
- Failure Conditions。

| Category | Required | 来源 | 关键验收 |
|---|---|---|---|
| HOST_INVENTORY | YES | 生产主机清单 | 全部 Host 唯一且 Production |
| WEB_INSTANCE | YES | Web 运行时 | Secure Launcher + CURRENT Artifact |
| WORKER_INSTANCE | YES | Worker/Maintenance | Release Index + 无 Legacy |
| PROCESS_INVENTORY | YES | 主机进程 | PID/父 PID/命令/实例一致 |
| STARTUP_ENTRY | YES | Process/runner | allowlist Gate entry |
| ARTIFACT_IDENTITY | YES | Release Root | 签名 Manifest + Digest |
| RELEASE_MANIFEST | YES | Manifest | Ed25519 独立验证 |
| TRUST_ROOT | YES | Trust Admin | Key active + fingerprint |
| RELEASE_ROOT | YES | Deploy Admin | ACL/atomic/reparse |
| RUNTIME_IDENTITY | YES | OS identity | Web/Worker/Maint 分离 |
| STORAGE_ACL | YES | Storage host | Delete/ACL/Owner denied |
| SCHEDULER | YES | Scheduler inventory | 无 Legacy target |
| WATCHDOG | YES | Watchdog inventory | 无 Legacy target |
| AUTO_RESTART | YES | Service/container | 只重启 CURRENT Gate Artifact |
| QUEUE_STATE | YES | Queue export | 新鲜且全部归零 |
| RUNNING_JOBS | YES | Queue export | 无 Active/Retry/Failed |
| RETRY_JOBS | YES | Queue export | Retry=0 |
| NETWORK_AND_DEPENDENCY | YES | Network inventory | Legacy Worker 不可达 |
| DRAIN_APPROVAL | YES | 两位管理员 | 双人独立且绑定 Bundle ID |

## 4. Evidence Schema Version 2

Schema 根字段：

```text
schemaVersion = 2
bundleId
createdAt
coverage
hosts
processes
services
schedulers
watchdogs
instances
artifacts
trustRoots
releaseRoots
runtimeIdentities
storageAcls
queueSnapshots
runningJobs
networkDependencies
approvals
integrity
signature
```

所有条目严格拒绝未知字段。

每个条目包含 provenance：

```text
evidenceId
category
hostId
collectedAt
collectorIdentity
collectorVersion
collectionMethod
trustLevel
```

`evidenceId` 必须在整个 Bundle 中唯一。

## 5. 主机与实例

Host 字段：

```text
Host ID
Host Role
OS Version
Environment
Region
Collection provenance
```

Process 字段：

```text
Process Key
PID
Parent PID
Executable
Command Line
Working Directory
Runtime Identity
Startup Entry
Artifact ID
```

Instance 字段：

```text
Instance ID
Host ID
Kind
Process Key
Runtime Identity
Startup Entry
Artifact ID
Release Root ID
Release/Build/Digests/Safety Version
Process Start Time
Auto Restart ID
```

跨证据检查：

- Host 必须存在；
- Process Key 每个 Host 唯一；
- Instance 必须引用已有 Process；
- Process/Instance 的 Host、Entry、Artifact 必须相同；
- Instance Artifact identity 必须与 Artifact 证据相同；
- Web/Worker 至少各一个；
- 命令行不得包含 `dist/index.js`、`worker-entry` 或 `next start`。

## 6. Scheduler / Watchdog / Auto Restart

Scheduler 字段覆盖：

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

要求：

- Enabled target 必须为 CURRENT Artifact；
- Target Entry 必须是 Gate-protected；
- Command 不得包含 direct/legacy entry；
- Scheduler Type UNKNOWN 阻断；
- Watchdog Type/State UNKNOWN 阻断；
- Enabled Watchdog 指向 Legacy 阻断；
- Service State UNKNOWN 阻断；
- Auto Restart 只能指向 CURRENT 且 Gate-protected Artifact。

空 Scheduler/Watchdog 数组不能自动解释为“没有”；必须由覆盖声明和结构化证据证明。

## 7. Artifact / Manifest / Trust Root

Artifact 证据包含：

```text
Artifact ID
Application
Location
Release ID
Build ID
Source/Artifact/Runtime Digest
Manifest Schema Version
Manifest Envelope
Trust Root ID
Signing Key ID
Lifecycle Safety Version
Legacy Marker Count
Startup Gate Status
Cleanup Capability
Production Status
Can Start Directly
Can Be Restarted
```

独立验证：

1. Trust Root Key ID 存在；
2. Ed25519 public key；
3. SPKI DER SHA-256 fingerprint 匹配；
4. Key 为 ACTIVE；
5. validFrom/validTo 覆盖验证时间；
6. Manifest signature 独立验证；
7. Manifest application/release/build/digests/safety version 与 Artifact 一致；
8. Manifest 时间不过期、不过度未来；
9. Lifecycle Safety Version 不低于当前最小值；
10. `cleanupCapability=DISABLED`；
11. CURRENT Artifact Legacy marker=0。

Trust Root modifying principals 不得匹配 Web/Worker/Maintenance runtime account。

## 8. Release Root

Release Root 证据：

```text
Release Root ID
Location
Owner Identity
Modifying Identities
Reading Identities
Runtime Write Denied
Parent Write Denied
Runtime Delete Denied
Reparse-free
Atomic Switch Verified
```

要求：

- Runtime Identity 不得出现在 modifying identities；
- 所有安全布尔必须显式为 true；
- Release Root ID 必须被 Instance 引用；
- 生产 ACL 事实不能由源码推断。

## 9. Runtime Identity

必须存在：

```text
WEB_RUNTIME_IDENTITY
WORKER_RUNTIME_IDENTITY
MAINTENANCE_RUNTIME_IDENTITY
```

每个身份要求：

- unique runtime identity ID；
- unique account；
- `releaseRootWrite=false`；
- `trustRootWrite=false`；
- `storagePhysicalDelete=DENIED_VERIFIED`；
- `cleanupCapability=DISABLED`；
- Host 已盘点。

Web/Worker/Maintenance 共享账户直接阻断。

## 10. Storage ACL

ACL permission 必须逐项记录：

```text
read
create
write
rename
delete
modifyAcl
changeOwner
```

同时记录：

- inheritance；
- parent-wide permission；
- Reparse Point；
- external object store；
- ACL modifier identities。

规则：

- 任何 Runtime delete=true 阻断；
- modifyAcl/changeOwner=true 阻断；
- ACL modifier 包含 Runtime 阻断；
- Parent-wide 或 Reparse 阻断；
- External Object Store 权限未明确阻断；
- Release/Trust Root 有任何 Runtime create/write/rename 阻断；
- Web/Worker/Maintenance 至少需要 Release Root、Trust Root、Canonical Storage ACL 证据。

ACL inheritance 本身产生 WARNING；安全结论基于 effective permissions。

## 11. Queue / Job / Upload / Operation

Queue Snapshot 必须包含：

```text
snapshotAt
source
waiting
active
retry
failed
scheduled
oldestJobAt
workerConsumptionRate
unfinishedOperations
activeUploads
processingRecoveryStatus
```

READY 要求：

- Snapshot 15 分钟内；
- Waiting/Active/Retry/Failed/Scheduled = 0；
- Oldest Job = null；
- Unfinished Operations = 0；
- Active Uploads = 0；
- Recovery = IDLE；
- 无 WAITING/ACTIVE/RETRY/FAILED/SCHEDULED/UNKNOWN Job；
- Legacy network dependency reachability = false。

## 12. Cross-Evidence Consistency

验证器检查：

- Duplicate Evidence ID；
- Duplicate Process ID；
- Duplicate Instance ID；
- Unknown Host reference；
- Process/Instance mismatch；
- Instance/Artifact identity mismatch；
- Unknown Release Root；
- Unknown Trust Root；
- Duplicate Trust Key ID；
- Unknown ACL identity；
- Missing required ACL resource；
- Shared runtime account；
- Scheduler/Service/Watchdog → Artifact reference；
- Approval → Bundle ID；
- Evidence collection time skew。

最大收集时间偏差：30 分钟。

Bundle 最大年龄：1 小时。

单条证据最大年龄：24 小时。

Queue 最大年龄：15 分钟。

未来时间容忍：5 分钟。

## 13. 证据完整性与签名

### Bundle Integrity

`integrity.digest` = canonical Bundle body（不含 integrity/signature）的 SHA-256。

封存命令：

```powershell
pnpm --filter @elevator/web p13:evidence:validate -- seal <draft.json> <sealed.json>
```

### Evidence Signature

Signature：

```json
{
  "algorithm": "ed25519",
  "keyId": "evidence-key-id",
  "value": "base64url-signature"
}
```

签名输入为包含 integrity、不包含 signature 的 canonical body。

验证时使用独立提供的：

```json
{
  "signerPublicKeys": {
    "evidence-key-id": "PUBLIC KEY PEM"
  },
  "trustedCollectorIdentities": [
    "trusted-collector-id"
  ]
}
```

普通 SHA-256 只能检测意外变化；Evidence Signature 才提供 Signer 绑定。

本阶段只使用一次性测试密钥，生产 Evidence Signer 未配置。

## 14. 证据可信度

| Level | 证据 | 可证明 | 不可证明 |
|---|---|---|---|
| 0 | 口头声明 | 声明本身 | 任何技术事实 |
| 1 | 截图/人工文本 | 有人展示过某内容 | 来源、完整性、实时性 |
| 2 | 原始命令输出 | 命令在某时产生输出 | 执行者身份、未篡改 |
| 3 | 可信只读采集器结构化输出 | 结构化采集事实 | 采集端未被攻陷 |
| 4 | 独立签名并外部信任验证 | Signer 绑定与完整性 | 操作已执行或批准生效 |

L8-A 关键证据要求 Level 3/4；未签名 Bundle 不能 READY。

## 15. Drain Readiness

输出 Section：

```text
Host Inventory
Instance Inventory
Scheduler / Watchdog
Automatic Restart
Artifact Verification
Trust Root
Runtime Identity
Storage ACL
Legacy Queue
Drain Approval
Release Root
Evidence Integrity
```

最终：

```text
READY FOR HUMAN REVIEW
```

或：

```text
BLOCKED
```

任何 blocker 均输出 `BLOCKED`。

## 16. 已测试攻击

- 缺失 Host；
- Unknown Host；
- 缺失 Worker；
- Duplicate Process ID；
- Duplicate Instance ID；
- Duplicate Evidence ID；
- Process/Instance mismatch；
- Legacy Artifact；
- 无效签名 Manifest；
- Revoked Key；
- 错误 Trust Root；
- Shared Runtime Account；
- Delete ACL；
- Runtime ACL modifier；
- 缺失 ACL；
- Unsafe Release Root；
- Legacy Scheduler；
- Legacy Watchdog；
- Legacy Auto Restart；
- Active/Retry Job；
- Queue 非零；
- Legacy dependency reachable；
- Stale/Future evidence；
- Cross-host time skew；
- Tampered digest；
- Untrusted Evidence Signer；
- Low trust collector；
- Insufficient approvals；
- Unknown Scheduler/Watchdog/Service；
- Direct startup command。

## 17. 当前状态

```text
Evidence Schema v2:
IMPLEMENTED

Evidence Requirements Matrix:
IMPLEMENTED

Offline Validator:
IMPLEMENTED / TESTED

Cross-Evidence Verification:
IMPLEMENTED / TESTED

Evidence Signature:
IMPLEMENTED FOR TEST KEYS

Production Evidence Signer:
NOT CONFIGURED

Production Evidence Bundle:
NOT PROVIDED

Drain Readiness:
BLOCKED

Production Drain:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
