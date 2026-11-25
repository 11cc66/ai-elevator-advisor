# P1-3 C-6.2-L8-A7.20-R4-S2 Independent Adversarial Architecture Review

## 1. Executive Summary

```text
A7.20-R4-S2:
FAIL
```

R4-S1 正确改进了 IPC、Evidence、SEALED、进程模型和 DELETED 语义，
但独立攻击发现一个组合型 P1：

> Supervisor 虽然是唯一协调者和 Evidence 写入者，却没有给 Helper 提供
> 独立可验证的 operation grant。Helper 依赖 Supervisor 指定的 binary、
> 参数和目标；Supervisor 若发生逻辑错误或被攻陷，仍可调用 Sealer 修改
> 任意已有 canonical 的 Owner/DACL，或调用 Publisher/Cleanup 超出预期目标。

因此：

- `SEALED` 只能对“诚实 Supervisor”成立，不是完整的 Supervisor-compromise
  隔离证明。
- Supervisor-only Evidence 写权限能阻止普通 Web/Worker 伪造，但不能证明
  Supervisor 提供的事实为真。
- 单 Broker/Helper 模型的方向成立，但还缺少 Helper 自身的独立授权和
  binary/dependency 完整性门禁。

不建议 Design Freeze。

## 2. Baseline

```text
Repository:
D:\thinkbook\Desktop\jieya

Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked:
148

Staged:
0

Deleted:
0
```

开始前受保护文件：

```text
FZ:
E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705

ST:
5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586

DBTP:
FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7

Schema:
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

next-env.d.ts:
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

tsconfig.tsbuildinfo:
21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520

R4-S1 Design:
3286A6C53D9D1449BE00D5B441F188490289799B003D4FC3BC7B686E29907F8E

R4-S1 Report:
A9DAC3709AA74F671484536FEDF2DF06E8E9BA7BFED8D7ACF29965FFEDFD3444
```

A7.18 waiver 未扩展。

## 3. Skills Applied

实际读取并应用：

- `$project-architecture`
- `$security-audit`
- `$file-lifecycle`
- `$testing-and-verification`
- `$prisma-db-safety`

## 4. Documents Reviewed

- 根与蓝图 `AGENTS.md`
- `FZ`、`ST`、`DBTP`
- A7.18 waiver/disposition
- A7.19、A7.20、A7.20-R、A7.20-R2、A7.20-R3
- A7.20-R4 Design/Report
- A7.20-R4-R Review
- A7.20-R4-S1 Design/Report
- 当前 Schema、P1-3 Migration、Trigger
- 当前 Storage、Upload、Worker、Capability、AuditLog 源码和测试

## 5. Official API Verification

已核实：

| Claim | Official Source | Verified Semantics | R4-S2 Impact |
|---|---|---|---|
| Named Pipe DACL | Microsoft Learn Named Pipe Security | 默认 ACL 不能用于高安全 IPC | 必须显式限制 SID |
| Impersonation | `ImpersonateNamedPipeClient` | 可取得客户端 token，必须在受控线程调用并恢复 | 需绑定会话 |
| Job Object | Microsoft Learn Job Objects | 子进程默认关联，但 breakaway 和外部句柄仍须显式控制 | 进程退出不自动证明所有系统句柄 |
| Share Mode | `CreateFileW` | 影响后续打开，不撤销已有句柄 | Helper 必须退出 |
| DispositionEx | Microsoft Learn | POSIX semantics 允许旧句柄继续访问 | NAME_REMOVED != physical reclaim |
| FileIdInfo | Microsoft Learn | VolumeSerial + FileId 标识当前文件 | 不是永久对象 ID |
| UDS credentials | `unix(7)` | `SO_PEERCRED` 是连接时对端凭据 | 连接委托需要额外防护 |
| openat2 | man7 | 支持 `RESOLVE_BENEATH|IN_ROOT|NO_SYMLINKS` | 仍需 mount identity |
| unlinkat | man7 | 删除相对目录 FD 的名称 | 不是 inode handle delete |
| flock | man7 | advisory lock | 不能当强制权限 |
| fsync | man7 | 文件同步不保证目录项持久化 | 需目录同步/UNKNOWN |

官方资料：

- <https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights>
- <https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-impersonatenamedpipeclient>
- <https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects>
- <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew>
- <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfileinformationbyhandle>
- <https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddk/ns-ntddk-_file_disposition_information_ex>
- <https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info>
- <https://man7.org/linux/man-pages/man7/unix.7.html>
- <https://man7.org/linux/man-pages/man2/openat2.2.html>
- <https://man7.org/linux/man-pages/man2/unlinkat.2.html>
- <https://man7.org/linux/man-pages/man2/flock.2.html>
- <https://man7.org/linux/man-pages/man2/fsync.2.html>

## 6. Architecture Trust Boundary

```text
Web/Worker
  -> authenticated local IPC
Authority Supervisor
  -> DB authority + Evidence + process launch
  -> one-shot restricted Helper
Helper
  -> narrowly scoped OS filesystem access
Canonical Guardian
  -> read-only final owner
```

当前缺失的关键边：

```text
Helper -> independent verification of operation grant
Helper binary/dependency -> signed immutable release
Supervisor -> proof that chosen Helper target is DB-authorized
```

## 7. Supervisor Authority Review

| 能力 | 当前设计 | 风险 |
|---|---|---|
| 创建 Helper | 允许 | 必须是固定 binary、固定参数模板 |
| 选择 binary | 未限制 | Supervisor compromise 可替换/启动恶意 Helper |
| 传递目标 | Helper 由 Supervisor 启动 | 未要求 Helper 独立验证 operation grant |
| 改变 OS identity | 通过服务启动 | 必须有固定 identity map |
| DB/Evidence | 允许 | Supervisor 是 TCB；可伪造，已知限制 |
| 重新取得 canonical 写权 | 不允许直接写 | 但可调用 Sealer/Publisher，若参数或 binary 不受限则可能绕过 |

分类结论：

- Supervisor Logic Bug：**可导致错误 helper target**。
- Supervisor DB Credential Compromise：**可伪造 Evidence/状态**。
- Supervisor OS Identity Compromise：可控制 launcher，当前设计无法自证诚实。

## 8. Helper Authority Review

| Helper | Read | Write | Owner/ACL | Delete | Child | DB |
|---|---|---|---|---|---|---|
| Staging Writer | staging | own staging | no | no | no | no |
| Publisher | staging + new target | new target | no | no | no | no |
| Sealer | target | seal metadata | yes, exact target only | no | no | no |
| Cleanup | staging + canonical read | no | no | staging only | no | no |

必须新增：

- 每个 Helper 只接受 Supervisor 生成的**独立 operation grant**；
- grant 绑定 operationId、storageKey、generation、target identity、action；
- Helper 自身验证 grant 的签名或由独立 trust service 验证；
- Helper binary、依赖和参数模板由不可变 Release 提供；
- Supervisor 不能自由指定任意可执行文件或任意环境变量；
- Helper 必须拒绝未授权的 target/storageKey。

当前仅有 Supervisor-server-side capability，Helper 仍完全信任 Supervisor。

## 9. P1-1 IPC Review

### 已闭合

- OS peer identity 不作为客户端字符串；
- Windows Named Pipe DACL 方向正确；
- Linux UDS + SO_PEERCRED 方向正确；
- opaque token 不签发客户端私钥；
- epoch/session/generation/action 绑定；
- requestId replay journal。

### 未闭合

- Linux connected socket 被 `SCM_RIGHTS` 传给另一本地进程时，
  `SO_PEERCRED` 可能仍代表最初 peer；
- Windows pipe handle 被 `DuplicateHandle` 或受控继承后，连接可能由另一进程继续使用；
- Token 复制/连接句柄复制没有独立的 per-message proof-of-possession；
- Helper 自身没有独立授权。

结论：`OPEN`。

## 10. P1-2 Evidence Review

### 已闭合

- Web/Worker 无 Evidence INSERT；
- Supervisor 独立重新验证 OS 状态；
- Evidence 与 DB Operation 同事务；
- append-only、hash chain、epoch/session/object identity 已纳入设计。

### 限制

- Supervisor 被攻陷时仍可伪造 Evidence；
- Helper 返回的原始观测不能被 DB 独立验证；
- 需要把 Supervisor 明确标记为 TCB，或引入外部 attestation；
- Evidence 只能证明某个时间点，不证明 canonical 永不改变。

结论：`CLOSED WITH TCB WARNING`，不是独立 OS proof。

## 11. P1-3 SEALED Review

### 已闭合的正常路径

- Publisher Helper 退出后才启动 Sealer；
- Sealer 移交 Owner/DACL 或 UID/GID/mode；
- Publisher 不能直接写 sealed target；
- Supervisor 只保留 read/verify。

### 仍需关闭的路径

若 Supervisor 被攻陷或存在逻辑错误：

```text
Supervisor
  -> launch Sealer Helper
  -> pass arbitrary existing canonical target
  -> Sealer changes Owner/DACL
  -> canonical permission boundary bypassed
```

当前没有 Helper 独立 DB grant 验证，也没有固定 binary/digest/argument 约束。

结论：`OPEN`。

## 12. P1-4 Process Model Review

当前模型：

```text
long-lived Supervisor + one-shot Helpers
```

优点：

- Helper 退出可关闭其拥有的句柄；
- Supervisor 可直接持有 read-only 验证边界；
- Publisher/Sealer/Cleanup 职责分离。

未闭合：

- Helper 二进制和依赖的完整性；
- Supervisor 是否可替换 Helper；
- Helper 如何独立验证操作授权；
- Supervisor 暂停/崩溃时进程树清理证据；
- 继承、DuplicateHandle、SCM_RIGHTS、detached child 的实际禁止；
- 相同 OS identity 多实例；
- 旧 Helper 与新 Helper 并发。

结论：`OPEN`。

## 13. P1-5 Cleanup Review

已闭合的设计语义：

- `DELETED = Controlled Namespace Removal Completed`；
- 不声称介质擦除；
- 记录 link、helper exit、name absence、Evidence；
- helper 未退出不得 DB DELETED。

需要进一步明确：

- 目录 fsync 失败后 `NAME_REMOVED` 与 DB APPLIED 的关系；
- Windows external handles/Delete Pending/Memory-Mapped View 的实际状态；
- Linux source FD 和 inode reuse；
- 外部 hard-link 的观察时点。

结论：`CLOSED` 作为业务语义，平台实现 `NOT VERIFIED`。

## 14. Publication Failure Matrix

| Scenario | Required Result |
|---|---|
| staging 创建前崩溃 | 无 target；PENDING/FAILED |
| Writer 写入中崩溃 | 保留 staging；UNKNOWN |
| Writer flush 后崩溃 | 无 close evidence；不得 READY |
| Supervisor 崩溃且 helper 仍在 | 必须终止/证明退出；否则 UNKNOWN |
| Publisher 退出但 target partial | 保留 target；不得 Sealer/APPLIED |
| Publisher 退出且有额外 handle | 不得 SEALED |
| Sealer crash during ACL transfer | UNKNOWN；人工/重试仅同 operation |
| Sealer complete but response lost | 重新观察 target；不得重复破坏 |
| Evidence missing | 不得 APPLIED |
| DB commit unknown | 新连接查询；否则 UNKNOWN |
| DB APPLIED response lost | 查询后返回同一结果 |

## 15. Cleanup Failure Matrix

| Scenario | Required Result |
|---|---|
| Helper crash before delete | UNKNOWN/FAILED_RETAINED |
| unlink syscall unknown | UNKNOWN；不重复删除 |
| name removed, helper not exited | UNKNOWN |
| name removed, dir fsync failed | UNKNOWN/RECLAMATION_PENDING |
| external handles remain | NAME_REMOVED，不宣称 physical reclaim |
| hard-link unexpected | FAILED_RETAINED |
| parent/root changed | UNKNOWN |
| Evidence missing | 不 DELETED |
| DB commit unknown | 新连接查询 |
| old helper/token replay | AUTHORITY_BUSY/EPOCH_STALE |

## 16. Recovery Review

允许恢复：

- Broker epoch 新、DB operation 当前、无旧 helper；
- OS root/ns/object identity 重新验证成功；
- target/cleanup Evidence 可解释；
- 不涉及未知旧句柄。

禁止恢复：

- 旧 Publisher/Sealer/Cleanup 进程仍未确认退出；
- partial target；
- helper 结果未知；
- 旧 epoch/token；
- root/namespace identity 改变；
- parent/name identity 不一致；
- hard-link 状态异常。

Supervisor crash 后必须由 Process Supervisor/Job Object/cgroup 证明 helper 终止；
无法证明时只能 UNKNOWN。

## 17. Windows / Linux Capability Matrix

| Capability | Windows Node core | Windows Native | Linux Node core | Linux Native |
|---|---|---|---|---|
| Pipe/Socket peer auth | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | SUPPORTED |
| Per-request identity | NOT SUPPORTED | PARTIAL | NOT SUPPORTED | SUPPORTED with SCM_CREDENTIALS |
| Process-tree kill proof | NOT SUPPORTED | SUPPORTED with Job Object | NOT SUPPORTED | SUPPORTED with cgroup |
| Helpers no inherited handle | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED with CLOEXEC |
| File identity | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Parent identity | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Reparse/Symlink rejection | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Handle-bound delete | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | PARTIAL |
| Hard-link count | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Directory durability | NOT SUPPORTED | PARTIAL | PARTIAL | PARTIAL |
| Owner/DACL transfer | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | SUPPORTED with privileged helper |
| Process pause detection | NOT SUPPORTED | REQUIRES SUPERVISOR | NOT SUPPORTED | REQUIRES SUPERVISOR |

## 18. Internal Consistency Review

```text
IPC Identity -> Session -> Operation -> Generation
Operation -> storageKey -> v2 namespace
Supervisor -> helper role + operation
Helper exit -> owned handles close
Supervisor read-only verification -> Evidence
Evidence + Operation -> same DB transaction
Sealer transfer -> Canonical Guardian
Cleanup -> staging namespace only
DELETED -> namespace removal only
```

当前断点：

```text
Supervisor -> Helper operation grant
```

Helper 没有独立验证该 grant，Supervisor 仍是可任意指派的信任中心。

```text
INTERNAL CONSISTENCY:
FAIL
```

## 19. Findings

### P1

| ID | Finding |
|---|---|
| `R4S2-P1-01` | Supervisor-controlled Helper 缺少独立 DB/signed operation grant；可命令 Sealer 修改任意 canonical，或让 Publisher/Cleanup 使用非预期目标 |
| `R4S2-P1-02` | Helper binary、依赖和参数模板未冻结为不可变 Release；Supervisor compromise 可替换或错误启动高权限 Helper |
| `R4S2-P1-03` | IPC capability 与连接的 process/handle 生命周期未完整闭合，Linux socket/Windows pipe handle 被复制后缺少 per-message identity proof |

### P2

| ID | Finding |
|---|---|
| `R4S2-P2-01` | Supervisor compromise 可伪造 Evidence，需明确 TCB 或外部 attestation |
| `R4S2-P2-02` | `SO_PEERCRED` 是连接时凭据，需 SO_PASSCRED/pidfd/连接关闭语义 |
| `R4S2-P2-03` | Windows Delete Pending 与 memory-mapped view 的持久状态未完全定义 |
| `R4S2-P2-04` | Linux `unlinkat` 与 inode reuse 仍只在设计层描述 |
| `R4S2-P2-05` | 目录 fsync 失败和 NAME_REMOVED/RECLAMATION_PENDING 状态需补充 |
| `R4S2-P2-06` | v1/v2 namespace Drain Protocol 尚未有实际 ACL/进程证据 |
| `R4S2-P2-07` | Schema v2 的 AuthoritySession、RequestJournal、Evidence append-only 约束尚未落实 |

### P3

- R4-S1 应明确 `Supervisor` 是否为 trusted computing base。
- 应把 helper binary/dependency digest 纳入 Signed Release Manifest。
- 应补充 Helper 启动参数 schema 和 environment allowlist。

## 20. Required Remediation

设计修订至少需要：

1. 增加 Helper 独立 operation grant：
   - 由 DB/Auth service 签发或由 Broker 以不可被普通应用伪造的方式验证；
   - 绑定 operationId、storageKey、generation、action、helper role；
   - 每个 grant 一次性或严格幂等。
2. 冻结 Helper binary 和依赖：
   - Supervisor 不能选择任意 executable path；
   - 固定参数结构；
   - Signed Release/Manifest 绑定 digest；
   - 禁止环境变量和 current directory 注入。
3. 明确 Supervisor TCB 边界：
   - 若 Supervisor compromise 不在威胁模型内，写明；
   - 否则必须引入独立 attestation/DB-side grant，不能把 Supervisor 自报当作 OS fact。
4. IPC 连接绑定：
   - Linux 强制 per-message credentials；
   - Windows 验证 pipe/token 的实际 client identity；
   - 防复制/继承/SCM_RIGHTS 委托。
5. 完成 P2 的 Windows Delete Pending、memory-map、Linux fsync、inode reuse、
   v1/v2 drain 和 Schema v2 设计。

## 21. Design Freeze Decision

```text
R4 DESIGN FREEZE:
NOT APPROVED
```

原因：

- P1-1 IPC 未闭合；
- P1-3 SEALED 未闭合；
- P1-4 Process Model 未闭合；
- P1-2 Evidence 有 TCB 限警告；
- P1-5 DELETED 业务语义已闭合，但平台实现未验证。

## 22. Next Stage Recommendation

```text
A7.20-R4-S3:
RECOMMENDED AS DESIGN REMEDIATION
```

R4-S3 应只修订设计，重点完成：

- helper独立 grant；
- helper binary/dependency freeze；
- Supervisor TCB 声明或外部 attestation；
- IPC connection delegation 防护；
- Windows/Linux P2 细节与 v1/v2 drain。

不建议进入 R4-A、R4-B、Schema v2 或任何 implementation。

## 23. Worktree Before / After

```text
Before:
  Tracked modified: 26
  Untracked:       148
  Staged:            0
  Deleted:           0

After:
  Tracked modified: 26
  Untracked:       149
  Staged:            0
  Deleted:           0
```

唯一新增文件：

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s2-independent-adversarial-review.md
```

## 24. Final Result

```text
A7.20-R4-S2:
FAIL

P1-1 IPC:
OPEN

P1-2 Evidence:
CLOSED

P1-3 SEALED:
OPEN

P1-4 Broker Process Model:
OPEN

P1-5 DELETED Semantics:
CLOSED / PLATFORM NOT VERIFIED

NEW P1 FINDINGS:
3

NEW P2 FINDINGS:
7

INTERNAL CONSISTENCY:
FAIL

WINDOWS DESIGN:
NOT VERIFIED

LINUX DESIGN:
NOT VERIFIED

R4-A:
NOT AUTHORIZED

R4-B:
NOT AUTHORIZED

SCHEMA V2:
NOT AUTHORIZED

IMPLEMENTATION:
NOT AUTHORIZED

DATABASE:
NOT AUTHORIZED

STORAGE:
NOT AUTHORIZED

CLEANUP / RECOVERY:
NOT AUTHORIZED

GIT COMMIT:
NOT AUTHORIZED

DEPLOYMENT:
NOT AUTHORIZED
```
