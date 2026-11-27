# WP-2A-CM1-R3-R2 — Targeted Recovery Idempotency and Read-Path Remediation

## 0. Final Conclusion

```text
CM1-R3-R2 PASS WITH RESTRICTIONS — READY FOR INDEPENDENT REVIEW
```

本轮已修复 R3-R1 的两个 P1：Local staging-chain 和 canonical-chain 的
COMMIT-response-loss 现在以持久化状态判定，不再依赖 `canonicalPrepared` 内存
布尔值；恢复入口能够识别已提交链、接管过期 owner/generation/lease，并阻止旧
执行者覆盖新结果。

本轮没有把 Local Object Adapter 宣称为生产级存储。Node core 仍不能提供
Windows handle-relative/OS fencing。Legacy Local 读取在 production/staging
已被显式 Fail-Closed；PostgreSQL Migration、Deferred Trigger、真实 Provider
和真实双 Session 仍未验证。

## 1. Document Control

```text
Stage:
  WP-2A-CM1-R3-R2

Mode:
  CONTROLLED TARGETED SOURCE REMEDIATION AND LOCAL SERVICE TESTING

Date:
  2026-11-26

Repository:
  D:\thinkbook\Desktop\jieya

Branch:
  codex/public-github-sync

HEAD:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

origin/main:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Input R3-R1:
  docs/architecture/wp-2a-route-c-minimal-independent-review-r3-r1.md

Input R3-R1 SHA-256:
  C27B8F9B9CD58794A9FBEF7042FE0BC1A365801B019E77EA663C1DB6704E3848
```

## 2. Scope and Evidence

本轮实际修改或新增：

```text
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/download-service.ts
apps/worker/src/file-processing.ts
packages/file-storage/src/local-private-storage.ts
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql
apps/web/tests/helpers/object-upload-prisma-harness.ts
apps/web/tests/local-upload-recovery-service.test.ts
apps/web/tests/object-upload-migration.test.ts
apps/web/tests/download-object-storage-failure.test.ts
apps/worker/tests/object-storage-integrity.test.ts
```

证据标签：

| 标签 | 含义 |
|---|---|
| `SOURCE VERIFIED` | 当前源码直接可读 |
| `LOCAL TEST` | 本机 Mock/Repository、纯文件系统或单元测试 |
| `STATIC SQL` | PostgreSQL DDL/PLpgSQL 静态检查，未执行 |
| `NOT VERIFIED` | 需要 PostgreSQL、Provider、Windows OS、ACL 或运行时 |

没有执行 SQL、Migration、PostgreSQL、Provider、Storage、Build、E2E、
Native RPC、服务启动/重启或部署。没有读取或输出 `.env`、密钥、Token 或连接串。

## 3. R3-R1 Findings Disposition

| Finding | 状态 | 处置证据 |
|---|---|---|
| `CM1-R3-R1-P1-01` Local staging-chain COMMIT unknown | `RESOLVED — LOCAL TEST` | `upload-service.ts:790-836`、`:1262-1517`；`local-upload-recovery-service.test.ts:107-132` |
| `CM1-R3-R1-P1-02` Local canonical preparation COMMIT unknown | `RESOLVED — LOCAL TEST` | `upload-service.ts:839-1016`、`:1650-1830`；canonical response-loss/precommit tests |
| `CM1-R3-R1-P2-01` Legacy Local production read | `RESOLVED — PRODUCTION GATE` | Web `download-service.ts:361-380`；Worker `file-processing.ts:574-590`; production tests |
| `CM1-R3-R1-P2-02` Migration precheck order/atomicity | `PARTIALLY RESOLVED` | precheck now precedes first `ALTER TABLE`; actual PostgreSQL transaction behavior `NOT VERIFIED` |
| `CM1-R3-R1-P2-03` Service matrix dispatch COMMIT/stale executor | `PARTIALLY RESOLVED` | Local stale executor is now service-tested; object dispatch-COMMIT response loss still needs a dedicated PostgreSQL-stage test |
| `CM1-R3-R1-P3-01` Migration test only marker | `RESOLVED` | `object-upload-migration.test.ts` now asserts precheck/DDL ordering and all four categories |

`PARTIALLY RESOLVED` and `NOT VERIFIED` are not counted as resolved.

## 4. P1-01: Local Staging Chain COMMIT Unknown

### 4.1 Root cause

旧流程：

```text
prepareLocalStagingChain() commits
-> caller receives no success response
-> Intent UPLOADING + Attempt WRITING + Staging STAGING
-> retry calls recoverLocalUpload()
-> loader requires canonical Lifecycle/Operation
-> permanent UPLOAD_RECOVERY_CHAIN_INVALID
```

### 4.2 Correction

`completeUpload()` now buffers and validates Local content, and dispatches Local
work to `completeLocalP13Upload()`. `prepareLocalStagingChain()` is inside the
recoverable execution path. On failure, the service re-queries the Intent and
classifies:

```text
PENDING
  -> transaction did not commit; retry the normal path

UPLOADING, staging exists, canonical absent
  -> recover pre-canonical staging chain

UPLOADING, canonical exists
  -> recover canonical chain

COMPLETED / FileVersion exists
  -> return the committed result

UNKNOWN / invalid chain
  -> retain evidence and Fail Closed
```

Pre-canonical recovery:

```text
load Attempt + Staging Lifecycle
-> require WRITING + STAGING
-> check lease expiry
-> CAS ownerToken/generation/lease
-> verify existing staging file or write only if absent
-> create canonical chain only under new generation
```

The new `LocalStagingLeaseController` renews the staging lease while the Local
write is running. `ObjectUploadLeaseController` renews the canonical chain
lease while the target is finalized and read.

### 4.3 Service evidence

`local-upload-recovery-service.test.ts` executes `completeUpload()` directly with
a controlled Prisma/Repository harness and real `LocalPrivateStorage`:

- normal Local publish;
- staging server response loss;
- staging pre-commit failure;
- reentry after staging commit;
- two recoveryers;
- stale old executor;
- heartbeat lookup failure;
- no duplicate Attempt/Lifecycle/FileVersion.

## 5. P1-02: Local Canonical Chain COMMIT Unknown

The old `canonicalPrepared` flag was removed as an authority source.
`completeLocalP13Upload()` now always loads the persisted Attempt/Staging/
Canonical/Operation state and decides from those rows.

The following states are distinguishable:

```text
no canonical row:
  pre-canonical staging recovery

canonical row + operation row + Attempt FINALIZING/RECOVERY_REQUIRED:
  canonical recovery, exact read, then finalization

Intent COMPLETED or FileVersion exists:
  return stored result

canonical/operation mismatch or ambiguous ownership:
  Fail Closed and retain objects/evidence
```

`prepareLocalCanonicalChain()` now uses ownerToken/generation/lease CAS for the
staging lifecycle and Attempt transitions. Recovery logs no FileVersion until
the canonical object has been finalized and verified.

## 6. Service Fault Matrix

| Scenario | Test/behavior | Result |
|---|---|---|
| Normal Local upload | `publishes a normal local upload...` | `PASS — LOCAL TEST` |
| Staging transaction before commit fails | `does not leave a false chain...` | `PASS — LOCAL TEST` |
| Staging committed, response lost | `recovers a staging-chain COMMIT response loss...` | `PASS — LOCAL TEST` |
| Staging chain reentry after crash | same test with new storage instance and expired lease | `PASS — LOCAL TEST` |
| Two staging recoverers | concurrent staging response/lease race | `PASS — LOCAL TEST` |
| Old staging executor late | blocked old writer + recovery takeover | `PASS — LOCAL TEST` |
| Heartbeat lookup fails | `stops the old Local executor...` | `PASS — LOCAL TEST` |
| Duplicate completed reentry | finalization response-loss test calls service again | `PASS — LOCAL TEST` |
| Canonical pre-commit failure | `re-enters after a canonical transaction failure...` | `PASS — LOCAL TEST` |
| Canonical committed, response lost | `recognizes a committed canonical chain...` | `PASS — LOCAL TEST` |
| Canonical process restart/reentry | same test after lease expiration | `PASS — LOCAL TEST` |
| Two canonical recoverers | `serializes two canonical recovery entrants...` | `PASS — LOCAL TEST` |
| Finalization response lost | `reuses the committed result...` | `PASS — LOCAL TEST` |
| Production Local upload | production environment gate | `PASS — FAIL CLOSED` |
| OBJECT_STORE dispatch COMMIT loss | object service still lacks a dedicated test | `PARTIAL — FUTURE DB VALIDATION` |

The Local tests use two `Promise`s and a real storage operation for the stale
executor case. The harness serializes repository transactions, so this is not
evidence of PostgreSQL row-lock or isolation behavior.

## 7. Legacy LocalPrivateStorage Read Path

### 7.1 Source audit

Before this remediation:

```text
Worker file-processing
  -> readObjectBytes()
  -> LocalPrivateStorage.openReadStream()
```

That path did not use the full `readVerifiedObject()` path identity and checksum
protocol. It also remained reachable for `LEGACY_LOCAL` files outside
development/test.

### 7.2 Correction

Worker now calls:

```text
storage.readVerifiedObject({
  objectKey,
  expectedSizeBytes,
  expectedChecksumSha256,
  maxBytes
})
```

The Web/Worker production gates explicitly reject `LEGACY_LOCAL` reads:

```text
Web:
  LEGACY_LOCAL_STORAGE_DISABLED

Worker:
  PROCESSING_LEGACY_LOCAL_STORAGE_DISABLED
```

`LocalPrivateStorage.verifyStagingForRecovery()` is added for in-development
Local chain recovery and re-verifies staging path identity, size and SHA-256.

`openReadStream()` remains a compatibility API used by Local storage helper
tests/`verifyObjectChecksum()` in development/test; it is no longer the Worker
object-read path and is not a production fallback.

### 7.3 Remaining Local limitation

The Local adapter still uses path-string APIs rather than an OS handle-relative
`openat` equivalent. A concurrent Junction/Reparse Point replacement in a narrow
window can require fail-closed behavior; it cannot be called Windows OS fencing.
Local Object Adapter remains limited to explicit `development/test`.

## 8. Migration Precheck and Failure Semantics

The R3 Migration now performs the historical precheck before any `ALTER TABLE`:

```text
any existing storage_object_binding
any existing OBJECT_STORE lifecycle
any existing OBJECT_STORE FINALIZE operation
any existing PENDING/UPLOADING append Intent
any incomplete Binding/Lifecycle/Operation/key chain
```

If any count is non-zero, the Migration raises `23514` before adding the three
new columns. It does not fabricate Provider Version, observation time,
idempotency identity, expected-current value or VERIFIED state.

Consequences:

```text
clean database:
  precheck passes; forward DDL may follow

non-empty database with object history:
  stop before DDL; historical inventory/backfill requires a separate
  authorized migration
```

The SQL file has no explicit transaction wrapper. The source order resolves
the precheck-before-expand requirement, but PostgreSQL/Prisma Migration
transaction behavior remains `NOT VERIFIED`.

## 9. Migration Ordering

```text
20261123130000_full_mvp_domain
20261126120000_phase38_route_c_minimal_object_binding
20261126130000_phase38_route_c_minimal_recovery_hardening
```

No duplicate timestamp or reverse dependency is present. The R3 migration is
new and unapplied; no historical applied migration was modified.

## 10. New Findings

### CM1-R3-R2-P2-01 — Local object path remains platform-limited

Node core snapshot checks are not equivalent to OS handle-relative fencing.
Production selection of Local Object Adapter remains forbidden. PostgreSQL
validation can proceed without treating this as a production Provider claim.

### CM1-R3-R2-P2-02 — Object dispatch COMMIT loss lacks a dedicated service test

The object path has reservation, observation and finalization response-loss
tests, but no direct `DISPATCH` commit-response-loss injection. Its current
`failBeforeDispatch()` branch depends on existing lifecycle triggers to reject
an inconsistent compensation. This must be added to the controlled PostgreSQL
test matrix and must not be marked resolved by local mocks.

### CM1-R3-R2-P3-01 — Migration runner atomicity is not proven

The source precheck is correctly ordered before DDL. Whether a failed later
DDL leaves the whole script absent depends on the actual Prisma/PostgreSQL
runner transaction semantics. This is `NOT VERIFIED`, not a source PASS.

## 11. Tests and Results

Executed:

```text
pnpm db:validate
PASS

pnpm db:generate
PASS — Prisma Client 6.19.0

pnpm typecheck
PASS — 8 workspace projects

pnpm --filter @elevator/file-storage test
PASS — 6 files / 51 tests

pnpm --filter @elevator/web test
PASS — 36 files / 352 tests

pnpm --filter @elevator/worker test
PASS — 8 files / 33 tests

pnpm --filter @elevator/contracts test
PASS — 4 files / 15 tests

pnpm --filter @elevator/selection-engine test
PASS — 2 files / 9 tests

git diff --check
PASS — existing LF/CRLF advisory only
```

Total:

```text
Test files: 56
Tests:      460 PASS
```

`pnpm db:generate` reports that `.env` was loaded; no content was read,
printed or recorded.

Not executed:

```text
pnpm build
package/Web/Worker Build
pnpm security:startup
pnpm test:db:verify
pnpm test:db:constraints
pnpm test:e2e
SQL or Migration application
PostgreSQL connection
Provider/Storage/IAM/ACL access
service startup/restart/deployment
```

## 12. Unexecuted Verification and External Blockers

```text
PostgreSQL Migration application:          NOT EXECUTED
Migration transaction atomicity:           NOT VERIFIED
Trigger/FK/Deferred behavior:              NOT VERIFIED
Two-session concurrency:                   NOT VERIFIED
Real COMMIT response loss:                 NOT VERIFIED
Real process restart:                      NOT VERIFIED
Real Provider conditional write/discovery: NOT VERIFIED
Windows Junction/Reparse Point runtime:     NOT VERIFIED
Windows Effective Access/ACL:              NOT VERIFIED
Legacy Worker drain:                       NOT EXECUTED
Historical object inventory/backfill:      NOT EXECUTED
E2E / Build / Startup Gate:                NOT EXECUTED
Production deployment:                     NOT AUTHORIZED
```

Historical statuses remain:

```text
R5 57 Open Decisions:          OPEN
BV7:                           FAIL
BV8:                           NOT INDEPENDENTLY APPROVED
Historical governance R8:      BLOCKED
P2-05 business retention:      OPEN
```

## 13. Files Changed

```text
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/download-service.ts
apps/worker/src/file-processing.ts
packages/file-storage/src/local-private-storage.ts
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql
apps/web/tests/helpers/object-upload-prisma-harness.ts
apps/web/tests/local-upload-recovery-service.test.ts
apps/web/tests/object-upload-migration.test.ts
apps/web/tests/download-object-storage-failure.test.ts
apps/worker/tests/object-storage-integrity.test.ts
```

No existing report, source, test, Migration or configuration file was
overwritten by this review beyond the targeted files above. All pre-existing
uncommitted and untracked work remains preserved.

## 14. Git State

### 14.1 At R3-R2 start

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  68
Untracked files:        69
```

### 14.2 At R3-R2 end

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  70
Untracked files:        71
New report:             docs/architecture/wp-2a-route-c-minimal-controlled-remediation-r3-r2.md
```

Only the authorized R3-R2 source/tests/Migration and this report were changed.
No Git reset, restore, clean, checkout, stash, add, commit or push occurred.

## 15. Final Verdict

```text
CM1-R3-R2 PASS WITH RESTRICTIONS — READY FOR INDEPENDENT REVIEW
```

Resolved:

- Local staging-chain COMMIT unknown;
- Local canonical-chain COMMIT unknown;
- Local owner/generation/lease takeover and stale-executor fencing at the
  service/repository level;
- Local finalization response-loss idempotency;
- Local heartbeat loss fail-closed behavior;
- Worker legacy read moved off `openReadStream()` and onto `readVerifiedObject()`;
- production/staging Legacy Local reads fail closed;
- Migration precheck before first DDL;
- migration static ordering/category tests.

Restrictions:

- Local Object Adapter remains development/test only and does not provide
  Windows OS-level path fencing;
- PostgreSQL transaction/Trigger/Deferred and two-session behavior are not
  verified;
- object dispatch COMMIT-loss service coverage still requires the next
  controlled database test phase;
- real Provider, Windows ACL, E2E, Build and deployment remain unverified.

This is not production authorization. The next step is independent review of
R3-R2, followed only by a separately authorized isolated PostgreSQL validation
design/execution.
