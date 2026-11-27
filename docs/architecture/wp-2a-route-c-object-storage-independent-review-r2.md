# WP-2A-R2 — Independent Adversarial Review of Route C Remediation Design

## 0. Review Control

```text
Stage:
  WP-2A-R2

Mode:
  INDEPENDENT / READ-ONLY / ADVERSARIAL REVIEW

Date:
  2026-11-25

Repository:
  D:\thinkbook\Desktop\jieya

Reviewed report:
  docs/architecture/wp-2a-route-c-object-storage-remediation-design.md

Reviewed report SHA-256:
  9F5F8A04F47B5E348EB8F7D5886B7B469484660EDE8A338216DC99A7A21CD8BB

Reviewed baseline:
  codex/public-github-sync
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Official Provider documentation rechecked:
  2026-11-25

Final result:
  FAIL — DESIGN CORRECTIONS REQUIRED

Implementation:
  NOT AUTHORIZED

Provider / Database / Storage:
  NOT ACCESSED
```

WP-2A-D1 is a substantial improvement and provides a useful architecture
direction. It is not yet a safe isolated-validation baseline because several
ownership relations remain prose rather than database-enforced relationships,
and two lifecycle/migration paths can still produce ambiguous or unavailable
current data.

## 1. Scope and Method

### 1.1 Scope

This review covers:

- WP-2A and WP-2A-R;
- the complete WP-2A-D1 report;
- current P1-3 Schema and Triggers;
- current upload, download, Worker, maintenance and Storage capabilities;
- current test harness and fixture limitations;
- the official Provider restrictions cited by WP-2A-D1.

### 1.2 Independence

The review does not accept `RESOLVED BY DESIGN` labels as evidence. It rebuilds
the relationship graph and attacks:

- key/Operation ownership;
- Publisher attempts and takeover;
- accepted binding creation;
- evidence producer identity;
- exact-version cleanup;
- Legacy/V2 migration;
- runtime identity scope;
- routing and rollback.

This is a same-session independent review, not a third-party human audit.

### 1.3 Evidence Labels

| Label | Meaning |
|---|---|
| `SOURCE VERIFIED` | Visible in current code/Schema/Migration |
| `OFFICIAL DOCUMENTATION VERIFIED` | Public official Provider document |
| `DESIGN ONLY` | Proposed in WP-2A-D1 |
| `TEST VERIFIED` | Executed; none occurred |
| `NOT VERIFIED` | No target-environment evidence |
| `BLOCKED` | External decision/environment required |

No test, SQL, DB, Provider, Storage, Build, E2E, Native RPC or deployment was
executed.

The following protected artifacts were not read, hashed, modified, moved,
renamed, deleted or started:

```text
$null
UNKNOWN'
apps/web/.next
apps/worker/dist
```

No `.env`, `.env.test`, token, secret, password or connection string was read.

## 2. Baseline

At review start:

```text
Branch:
  codex/public-github-sync

HEAD:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

origin/main:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Tracked modified:
  0

Staged:
  0

Deleted:
  0

Untracked:
  24
```

The WP-2A-D1 report is untracked and preserved.

### 2.1 Source and Line Evidence

`SOURCE VERIFIED`:

| Evidence | Location |
|---|---|
| FileVersion chain fields and storageKey | `prisma/schema.prisma:398-443` |
| FileUploadIntent/Attempt/Lifecycle/Operation | `prisma/schema.prisma:501-655` |
| Local close fields | `prisma/schema.prisma:577-617` |
| Current close CHECK | `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:484-535` |
| Current staging cleanup function | same Migration `674-718` |
| Current FileVersion lifecycle checks | same Migration `1811-1943` |
| Current web direct upload | `apps/web/src/modules/files/upload-service.ts:155-236,267-650` |
| Current storage rename | `packages/file-storage/src/local-private-storage.ts:108-191` |
| Current raw stream | `packages/file-storage/src/capabilities.ts:23-98`; `apps/worker/src/file-processing.ts:173-189` |
| Current tests/capabilities | `apps/web/scripts/p13-db-tests/capabilities.ts:1-16` |

## 3. Overall Verdict

### 3.1 What Improved

WP-2A-D1 correctly adds:

- a key-allocation concept independent of Provider version;
- Publisher attempt records;
- separate candidate Provider versions and accepted binding;
- multi-source Evidence;
- backend-specific close evidence;
- separate workload/IAM/DB role requirements;
- a migration batch/record/routing model;
- a provider capability manifest.

These are the right categories.

### 3.2 Why It Still Fails

The design often says “must agree” or “only the authorized role may,” but does
not define the complete composite foreign keys, deferred constraints,
role-derived columns and state predicates needed to enforce that statement:

- `StoragePublisherAttempt` can point to an allocation that does not belong to
  its Operation.
- `StorageObjectBinding` can point to an attempt from another Operation unless
  a composite relation is added.
- `StorageBindingAcceptance` can reference arbitrary primary/readback Evidence
  rows; the IDs are not defined as exact FKs.
- The Evidence `producerDbRole` is a caller-supplied field and may be forged
  unless a DB trigger binds it to `SESSION_USER`/certificate-authenticated role.
- Cleanup Operations do not have an exact Provider version target.
- The single-FileVersion migration does not fully resolve the current required
  `FileVersion.storageObject` relation and chain-field nullability.
- Cutover rollback can orphan V2-only files that have no local source.
- Migration workers have no explicit record-level owner token/lease/generation.

The remainder of this report supplies the counterexamples and closure criteria.

## 4. R2-1 — Canonical Key Permanent Ownership

### 4.1 What Is Correct

`DESIGN ONLY`:

- `(providerScopeId, objectKey)` unique independent of Provider version;
- `operationId` unique;
- `lifecycleId` unique;
- key/operation/provider/lifecycle identity immutable;
- allocation row cannot be deleted;
- collision occurs before Provider mutation.

This is the correct shape.

### 4.2 Provider Scope Can Still Move the Namespace

`WP-2A-D1 §13.1` defines the capability manifest but does not make all
`StorageProviderScope` identity fields immutable or protected by a Trigger.
`providerResourceId`, `accountScopeRef`, `region`, `bucketOrContainer`,
`endpointRef` and `capabilityManifestId` can appear updateable in the proposed
model.

Counterexample:

```text
1. Scope S is approved for account A / bucket B.
2. Allocation K is created under S.
3. A deployment/admin update changes S.account or S.bucket to B2.
4. K now names the same key in a different physical Provider namespace.
5. A new binding can be created against K without violating K's own text.
```

The DB uniqueness remains, but its meaning has moved.

### 4.3 Another Scope Can Represent the Same Physical Bucket

`providerResourceId` is intended to be stable, but the design does not require
it to be verified against the live Provider control plane. Two DB scopes can
claim different resource IDs/aliases for the same physical bucket.

If provisioning role or manifest validation is wrong:

```text
Scope S1 -> bucket B / resource-id R1
Scope S2 -> bucket B / resource-id R2 (alias/spoof)
same objectKey can be allocated in both scopes
```

The Provider could see both as the same physical object namespace.

### 4.4 Required Correction

Add:

```text
StorageProviderScope:
  identity fields immutable after ACTIVE:
    providerKind
    accountScopeRef
    providerResourceId
    region
    bucketOrContainer
    endpointRef
  providerResourceId must come from a live Provider control-plane observation
    recorded in the signed capability/test evidence.
  active scope cannot be deleted.
  changing endpoint/config requires a new manifest revision and epoch;
    no key allocation rows are moved between scopes.
```

A scope's resource identity must be independently verified in the Provider
sandbox; DB strings alone cannot establish physical bucket identity.

### 4.5 Additional Key Edge

`StorageObjectKeyAllocation` allows `ImPORT_CANONICAL` and `FINALIZE` only. It
does not explicitly forbid an allocation from pointing to a migration operation
that is already terminal or belongs to a different lifecycle. The composite FK
must include:

```text
allocation.operationType IN (FINALIZE, IMPORT_CANONICAL)
allocation.operation.objectLifecycleId = allocation.lifecycleId
allocation.operation.storageKey = allocation.objectKey
allocation.state != CONFLICT/RETIRED before a binding
```

### 4.6 Finding

```text
WP2AR2-P1-01
Severity: P1
WP-2A-D1 sections: 5.1–5.4, 13.1
Blocking: YES
```

The key allocation concept is sound, but the Provider namespace itself is not
fully immutable and Provider resource identity is not independently bound.

Closure:

- immutable Scope fields and no-delete triggers;
- stable live resource identity evidence;
- exact allocation composite predicates;
- concurrent allocation/scope-update tests.

## 5. R2-2 — Publisher Attempt and Multi-Version Competition

### 5.1 Attempt Ownership Is Not Fully Relational

`WP-2A-D1 §6.1` defines:

```text
StoragePublisherAttempt.operationId
StoragePublisherAttempt.keyAllocationId
```

but does not define composite FKs proving:

```text
attempt.keyAllocationId belongs to attempt.operationId
attempt.operationGeneration is the current lifecycle generation when issued
attempt.publisherWorkloadId can act for the current workload role
```

An application with the Publisher DB role could insert an attempt linking
Operation A to the key allocation of Operation B. Provider-side metadata then
carries an inconsistent identity accepted by the application.

The database must use:

```text
(keyAllocationId, operationId)
  -> CanonicalObjectKeyAllocation(id, operationId)
```

and a deferred/Trigger check that the lifecycle/operation owner/generation
matched at attempt creation.

### 5.2 Attempt Partial Unique Is Ambiguous

The design says “one active attempt per Operation” but does not list which
states are active. Recovery must mark A `STALE`/`RESPONSE_UNKNOWN` before B can
insert an active attempt. If a partial unique index includes
`RESPONSE_UNKNOWN`, B cannot start; if it excludes it, both A and B can be
active but have different semantics.

The exact index must be specified:

```text
UNIQUE(operationId)
WHERE state IN ('CLAIMED','REQUEST_SENT')
```

and the state transition that changes A to `STALE` must be atomic with B's
claim. Otherwise two distinct active attempts are possible.

### 5.3 Acceptance Generation Window

`StorageBindingAcceptance.acceptanceGeneration` is a single number. A can
produce a correct object under generation 7, B accepts it under generation 8,
and then C takes over generation 9 before FileVersion finalization. The design
does not define whether acceptance is invalidated or revalidated after a
generation change.

Safe rule:

```text
FileVersion finalizer must require:
  acceptanceGeneration = current Operation.fencingGeneration
  current owner token = finalizer's recovery generation
  acceptance not older than current ownership epoch
```

or explicitly define a grace/acceptance epoch that survives takeover and why.
Without that, an old accepted binding can be reused by a new owner without a
fresh decision.

### 5.4 Wrong-Content / Late-Version Timeline

```text
1. A owns O generation 7.
2. A writes version Vbad to key K; response lost.
3. A's lease expires.
4. B takes over generation 8.
5. B reads Vbad and sees hash mismatch.
6. D1 marks conflict and allocates a new Operation/key.
7. A resumes and writes Vlate under K (versioning enabled).
8. Vbad and Vlate are retained; K is retired.
9. New Operation/key K2 receives correct content.
```

This is safe only if:

- K's allocation remains permanent and retired;
- no FileVersion ever points to K;
- Vbad/Vlate are retained/quarantined;
- B cannot reuse K;
- exact-version reads never use K's latest object;
- finalizer rejects any binding not on K2.

WP-2A-D1 describes this, but its acceptance/provenance evidence does not yet
enforce all five as one DB state transition. The new Operation/key path must be
shown with the current P1-3 `StorageObjectOperation` constraints after adding
`supersedesOperationId`.

### 5.5 Finding

```text
WP2AR2-P1-02
Severity: P1
WP-2A-D1 sections: 6.1–6.7
Blocking: YES
```

Publisher attempts do not yet have complete cross-object ownership constraints
or an exact current-generation finalization rule.

Closure:

- composite FK Attempt → Operation/Allocation;
- exact active-attempt partial index;
- atomic takeover state transition;
- acceptance generation invalidation/revalidation rule;
- wrong/late object test with all DB rows and exact versions.

## 6. R2-3 — Evidence and Finalizer

### 6.1 Producer Role Is Still a Claimed Field

`StorageLifecycleEvidence.producerDbRole` is listed as a row field. A Publisher
with INSERT permission can submit:

```text
producerDbRole = "elevator_storage_verifier"
evidenceType = READBACK_VERIFIED
```

unless the table has:

- column-level inserts that exclude producerDbRole;
- a SECURITY DEFINER ingestion function that reads `SESSION_USER`/certified
  database identity;
- or a Trigger rejecting any mismatch.

The design says “producer DB role must be allowed” but does not define the
enforcement mechanism. This is a direct evidence-forgery path.

### 6.2 Acceptance Evidence Has No Exact FK Definition

`StorageBindingAcceptance` has:

```text
primaryEvidenceId
readbackEvidenceId
auditEvidenceId
```

The design says they must agree, but does not explicitly define FKs or
composite foreign keys to:

```text
StorageLifecycleEvidence(id, operationId, bindingId,
                        objectVersionId, evidenceType)
```

Without those exact relationships, a Publisher or malformed Finalizer request
can pair evidence from different attempts/objects.

### 6.3 Old Evidence Across Operations

The text says nonce/operation uniqueness rejects replay. The concrete table does
not state whether the unique key is:

```text
(operationId, evidenceType, requestNonce)
```

or includes `bindingId`, `publisherAttemptId`, `providerVersionId`. Those
choices have different consequences:

- too narrow: a valid readback nonce can be reused with a different binding;
- too broad: a legitimate repeated provider observation cannot be represented.

The design needs exact uniqueness and immutable FKs.

### 6.4 Finalizer Bypass Surface

The design says the Finalizer is a NOLOGIN owner and the only path to insert
FileVersion. It does not define:

- grants/revokes for all runtime roles;
- function owner;
- `search_path`;
- exact function signature;
- whether direct `storage_object_binding` updates can mark ACCEPTED;
- whether a Publisher can set `acceptanceId`;
- whether the `StorageLifecycleEvidence` table allows direct INSERT by client
  roles.

`SECURITY DEFINER` only helps if the function is the sole insertion path and
does not leak or accept untrusted locks/inputs.

### 6.5 Audit Log Delay

If the Provider audit event is absent or delayed, D1 allows a binding to remain
accepted “per evidence profile,” but the profile is not defined as an enum,
required evidence set, or explicit policy. Missing audit logs must not be
silently treated as absence of activity.

### 6.6 Finding

```text
WP2AR2-P1-03
Severity: P1
WP-2A-D1 sections: 8.2–8.6, 10.7
Blocking: YES
```

The multi-source Evidence idea is sound, but producer identity, exact FKs,
uniqueness, Finalizer grants and audit absence semantics are not concrete
enough to prevent forged or mixed evidence.

Closure:

- exact Evidence FKs/unique indexes;
- producer Db Role derived from authenticated session, not caller field;
- finalizer-only binding acceptance and FileVersion INSERT;
- explicit evidence-profile enum;
- tests for forged role, mixed evidence, replay and finalizer bypass.

## 7. R2-4 — Dual Backend Close Attestation

### 7.1 Current Local Constraint Reality

`SOURCE VERIFIED`:

- current `close_attestation_complete_check` requires
  `closedIdentityVerified=true` with non-null local `closedDev`/`closedIno`;
- staging cleanup requires identity-verified close;
- Attempt COMPLETED requires staging Lifecycle DELETED;
- FileVersion insert currently requires ACTIVE canonical Lifecycle and an
  APPLIED FINALIZE Operation.

These are actual SQL constraints/functions, not merely doc statements.

### 7.2 D1 Does Not Yet Specify the Real Trigger Predicate

D1 proposes a generic `StagingCloseAttestation` with backend-specific fields,
but does not provide the actual replacement predicates:

- how `closeAttestationId` points to two possible evidence tables;
- how `StorageObjectLifecycle` records backend kind;
- how old local rows are backfilled without violating existing immutable
  triggers;
- how a local lifecycle cannot later become object-store;
- how object-store cleanup evidence is identified;
- how `STAGING_CLEANUP` affects `StorageObjectOperation` path checks;
- how `Attempt COMPLETED` checks exact binding and staging deletion.

A design cannot claim compatibility while those predicates remain prose.

### 7.3 Local/Remote Identity Mixing Attack

If a client can submit object-store `providerVersionId` and also set a local
`closedDev`/`closedIno`, the wrong branch may pass a check. The design says
“mixed fields fail closed” but does not define an XOR CHECK with all fields.

### 7.4 Finding

```text
WP2AR2-P1-04
Severity: P1
WP-2A-D1 sections: 9.1–9.7, 12.1
Blocking: YES
```

The backend-neutral close design is not yet an executable replacement for the
current close constraints and Trigger/Function matrix.

Closure:

- exact backend discriminator and XOR CHECK;
- exact generic/local/object evidence FK design;
- exact Trigger/function predicates for staging cleanup and Attempt COMPLETED;
- migration of old local rows with preserved semantics;
- negative tests for mixed/fake identity.

## 8. R2-5 — Identity, DB Role, IAM and Revocation

### 8.1 Role Names Are Still Architectural

The D1 map correctly names:

```text
storage-ingest
storage-publisher
storage-read-verifier
storage-cleanup
storage-migration
provider-audit-collector
```

and separate DB roles. It does not define:

- actual deployment accounts/services;
- mTLS certificate subject/SAN to DB role mapping;
- exact DB grants/revokes;
- how the `publisherWorkloadId` row field is authenticated;
- how an operation-scoped Provider credential is bound to a key;
- the fallback when the Provider cannot issue exact-key session capabilities.

### 8.2 Static Prefix Permissions Can Cross Operations

“Publisher IAM: exact allocated canonical prefix” is not necessarily
operation-scoped. A static Publisher role allowed on `objects/` can write any
Operation's allocated key. Exact DB acceptance can reject wrong FileVersion,
but a compromised Publisher can fill future canonical keys and cause
availability/cost damage.

The design needs either:

1. a trusted publisher credential broker issuing exact-key session policies; or
2. a separate Publisher service with DB revalidation that is the only
Provider writer and cannot be invoked with an arbitrary key.

The current text says “where supported” for operation-scoped capabilities but
does not make it mandatory or state the fallback.

### 8.3 DB Role Does Not Prove OS Process

The report correctly warns not to infer this. It still needs a concrete
mTLS/certificate-to-DB-role mapping and negative test. Without it, two app
processes sharing `elevator_storage_publisher` are indistinguishable.

### 8.4 Finding

```text
WP2AR2-P1-05
Severity: P1
WP-2A-D1 sections: 7.1–7.5
Blocking: YES
```

Identity separation is specified as roles/requirements but not an enforceable
workload-to-DB-to-Provider binding.

Closure:

- exact certificate/workload-to-DB-role mapping;
- exact per-operation Provider capability issuance or a proven Publisher
  gateway;
- role/grant matrix;
- cross-role and stale-token tests.

## 9. R2-6 — Single FileVersion and Legacy/V2 Model

### 9.1 The Chosen Model Is Reasonable

The single `FileVersion` graph avoids duplicating:

```text
File.currentVersionId
FileExtraction
ExtractionField
ExtractionFieldReview
FileSecurityEvent
AuditLog
```

That is the correct direction.

### 9.2 Current Direct Storage Relation Is Not Resolved

`SOURCE VERIFIED`:

- `FileVersion.storageKey` is a non-null FK to `StorageObjectLifecycle.storageKey`.
- FileVersion does not currently have a provider binding.
- P1-3 triggers require an ACTIVE canonical Lifecycle and a matching APPLIED
  FINALIZE Operation.

D1 says for `MIGRATED_V2`:

```text
FileVersion.storageKey` may remain the old local key
Provider binding identifies a different provider key
```

but does not define the migration of the existing `storageObject` relation or
the exact condition that makes the local relation optional. “Where present”
is not a database constraint.

### 9.3 Legacy NOT NULL Chain Fields

D1 correctly says not to fabricate Intent/Attempt/Operation IDs, but the current
columns are NOT NULL. It says `MIGRATED_V2` may leave chain fields null while
also saying `creationOperationAttemptId` remains a required relation for the
import operation. The exact nullability matrix and migration DDL are not
resolved:

```text
UPLOAD_V2: Intent/Attempt/FINALIZE all present
MIGRATED_V2: Intent/Attempt may be absent; IMPORT operation present
LEGACY_LOCAL: all upload chain fields may be absent
```

The current triggers always expect the direct FileVersion chain and active
canonical Lifecycle. A full Trigger/constraint rewrite is required.

### 9.4 Finding

```text
WP2AR2-P1-06
Severity: P1
WP-2A-D1 sections: 10.1–10.5
Blocking: YES
```

The single-FileVersion direction is correct, but the actual FK/nullability and
Trigger transition from current Schema to the three-origin model is not complete.

Closure:

- exact DDL matrix for nullability and backfill;
- explicit optional/required relation behavior;
- exact Trigger branch tests for all three origins;
- no fake IDs;
- unchanged downstream FKs proven in a clone.

## 10. R2-7 — Migration, Checkpoint and Rollback

### 10.1 Migration Worker Concurrency

`StorageMigrationRecord` has states and idempotency, but no:

- owner token;
- lease;
- fencing generation;
- claim CAS predicate;
- worker identity;
- rowcount semantics.

Two migration workers can both read a MAPPABLE record, both copy to the same key,
or both advance checkpoints unless an unstated CAS/lock protocol is implemented.

### 10.2 Checkpoint Failure Window

The state machine says `COPYING -> COPIED -> TARGET_VERIFIED`, but does not
define the durable state after:

- provider copy success and checkpoint write failure;
- checkpoint write success and Provider object later becomes unreadable;
- binding acceptance success and routing update failure;
- routing update success and old writer still running.

The evidence model can discover candidate objects, but the migration record's
owner/generation and recovery owner are not defined.

### 10.3 Rollback Can Orphan V2-only Files

This is a decisive counterexample:

```text
1. Migration reaches OBJECT_V2_PRIMARY.
2. A customer uploads a new file after cutover.
3. The new FileVersion exists only in Provider storage; no local source exists.
4. Operator selects ROLLBACK_LEGACY.
5. Routing serves legacy/local only.
6. The new V2-only file becomes unavailable.
```

D1 says rollback retains Provider objects, but it does not define a mixed-read
mode or prohibit new V2-only uploads during the rollback window. A safe
rollback requires:

- freeze new uploads before rollback; or
- dual storage for files created after cutover; or
- a mixed read/routing mode that continues serving V2-only files while legacy
  history is primary.

No such option is selected.

### 10.4 Routing Epoch Is Not Propagated to All Callers

`StorageRoutingState` has epoch CAS, but D1 does not require:

- operation calls carry expected routing epoch;
- DB finalizer rechecks epoch;
- stale workers abort;
- provider-audit/cleanup tasks use the same epoch;
- reads prove current routing mode per request.

An old process can retain a cached `OBJECT_V2_PRIMARY` decision while rollback
is active.

### 10.5 Source Retention / New Writes

Migration does not state:

- how new customer uploads are handled during shadow copy;
- whether a new version can be added to a file under migration;
- how source retention interacts with a migration still not complete;
- how a changed source FileVersion invalidates the manifest.

### 10.6 Findings

```text
WP2AR2-P1-07
Severity: P1
WP-2A-D1 sections: 11.1–11.8
Blocking: YES
```

Migration lacks record-level worker fencing and a safe rollback model for
V2-only files.

```text
WP2AR2-P2-01
Severity: P2
WP-2A-D1 sections: 11.8
Blocking: NO
```

Routing epoch exists but is not passed through all operations and stale-client
paths.

Closure:

- MigrationRecord owner/lease/generation/CAS;
- source mutation detection and freeze rules;
- mixed-read rollback decision;
- routing epoch included in every mutating and read decision;
- complete crash/response-loss matrix.

## 11. R2-8 — Cleanup and Exact-Version Delete

### 11.1 The Operation Does Not Yet Carry Exact Version

D1 states cleanup must target exact Provider version. `StorageObjectOperation`
currently has:

```text
storageKey
sourcePath
targetPath
quarantinePath
```

it does not have an exact `objectVersionId`/`providerVersionId` field. The
proposed `StoragePublisherAttempt` and `StorageObjectVersion` records do not
automatically force a cleanup Operation to name the exact version it may delete.

Without a required `operationObjectVersionId` (or equivalent), a Cleanup
implementation can:

```text
claim a valid Operation for key K
read a different current version from K
delete that version
record DELETE_RESULT for K
```

The DB must make the exact version part of the authorized Operation.

### 11.2 Key-Only Delete Is Not Formally Prohibited

D1's prose says no key-only delete, but the schema/operation type does not have
an explicit exact-version FK and capability manifest operation signature.
The capability manifest names `versionDelete`, but does not bind it to the
operation row.

### 11.3 Cleanup vs FileVersion

D1 correctly says canonical FileVersion cleanup is prohibited, but it does not
state the exact predicate for:

- FileVersion binding reference;
- migration source reference;
- accepted binding reference;
- retained conflict reference;
- legal hold/retention.

The future Trigger must reject a cleanup Operation if any referenced entity
still owns the version.

### 11.4 Finding

```text
WP2AR2-P1-08
Severity: P1
WP-2A-D1 sections: 7.1–7.5, 12.1–12.3
Blocking: YES
```

Cleanup authority is not yet exact-version-bound in the Operation model and
the affected object-version identity is not represented as a required FK.

Closure:

- `StorageObjectOperation.targetObjectVersionId` (or equivalent) with exact
  provider/bucket/key/version composite FK;
- no key-only operation grant;
- reference checks before delete;
- exact delete postcondition and response-loss tests;
- no deletion of canonical bound/FileVersion/migration/conflict-retained rows.

## 12. R2-9 — Provider Capability Gate

### 12.0 Official Documentation Recheck

`OFFICIAL DOCUMENTATION VERIFIED`, checked 2026-11-25:

| Provider | Rechecked fact | Official source |
|---|---|---|
| AWS S3 | Conditional Put/Complete/Copy; bucket-policy enforcement conflicts with Copy; historical version delete uses `versionId`; conditional delete is current-version-only | [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html), [enforcement](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes-enforce.html), [conditional deletes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-deletes.html) |
| Azure Blob | ETag conditions; version-level WORM requires versioning; HNS changes ACL/anonymous/API behavior | [Azure concurrency](https://learn.microsoft.com/en-us/azure/storage/blobs/concurrency-manage), [immutability](https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-storage-overview), [HNS issues](https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-known-issues) |
| Google Cloud Storage | generation/metageneration preconditions; `ifGenerationMatch=0`; exact generations; Object Versioning/retention | [Preconditions](https://cloud.google.com/storage/docs/request-preconditions), [Versioning](https://cloud.google.com/storage/docs/object-versioning), [Retention Lock](https://cloud.google.com/storage/docs/object-lock) |
| Tencent COS | versioned forbid-overwrite disabled; exact-version delete; CopyObject may return HTTP 200 with error body | [PUT](https://cloud.tencent.com/document/product/436/7749), [Complete MPU](https://cloud.tencent.com/document/product/436/7742), [DELETE](https://cloud.tencent.com/document/product/436/7743), [Copy](https://cloud.tencent.com/document/product/436/10881) |
| S3-compatible | no category-wide versioning/Object Lock guarantee | [R2 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/), [MinIO versioning](https://min.io/docs/minio/linux/administration/object-management/object-versioning.html) |

The Tencent Complete MPU link in the D1 report is
`https://cloud.tencent.com/document/product/436/7742`; the table above also
uses the formal PUT/Object-versioning sources. No API call was made.

### 12.1 D1 Correctly Captures Main Provider Limits

The design includes:

- AWS conditional Copy/enforcement caveat;
- AWS current-version conditional delete limitation;
- Azure HNS and WORM restrictions;
- Tencent versioning/forbid-overwrite conflict;
- Tencent CopyObject HTTP 200 body;
- GCS generation preconditions;
- S3-compatible variability.

That is materially better than WP-2A.

### 12.2 Manifest Is Still Not a Complete Runtime Gate

The manifest has no exact trust-root/signature key policy, approval state,
Provider control-plane probe, bucket-versioning live check, or drift-detection
transaction. “Signed or digest-bound” is not enough.

The design must define:

```text
manifest signer/trust root
manifest expiry/revocation
account/resource identity verification
live read-only configuration probe
operation allowlist per manifest
provider response/error normalization
failure/suspension behavior
```

### 12.3 Findings

```text
WP2AR2-P2-02
Severity: P2
WP-2A-D1 sections: 13.1–13.4
Blocking: NO for direction; YES for Provider implementation
```

The capability gate is conceptually good but not yet an executable live
configuration gate.

```text
WP2AR2-P2-03
Severity: P2
WP-2A-D1 section: 13.2
Blocking: NO for architecture; YES for Provider sandbox
```

Provider status labels are sandbox requirements, not verified capabilities.

## 13. Current P1-3 Source Cross-Check

`SOURCE VERIFIED`:

| Current object | Current constraint/function | D1 interaction |
|---|---|---|
| `StorageObjectLifecycle.storageKey` | unique, immutable, delete rejected | usable as logical allocation foundation |
| `StorageObjectOperation` | immutable identity, one active per storageKey | needs exact object version and new operation types |
| `FileUploadAttempt` | one open and one completed partial indexes | PublisherAttempt is additional, not replacement |
| `FileVersion` | storageKey/creation operation/attempt unique; P1-3 chain required | needs origin-aware constraints and current relation solution |
| `p13_assert_staging_cleanup_attestation` | local identity-verified close mandatory | needs backend union |
| `p13_assert_file_version_storage_active` | storageKey→ACTIVE Lifecycle/current FINALIZE | needs V2 migration branch |
| `p13_protect_file_version_identity` | chain fields immutable | needs explicit origin/protocol transition rules |
| `AuditLog` | UPDATE/DELETE trigger only | new evidence needs its own truncate/access controls |
| `P13_TEST_CAPABILITIES` | generation CAS/locks/DB execution adapter not implemented | tests remain planned |

The D1 design correctly identifies many of these as required changes, but does
not yet provide the exact SQL predicates or migration order that would preserve
all current constraints without weakening local storage.

## 14. Failure-Injection Matrix

| ID | Minimal sequence | Expected | D1 actual risk | Blocked by DB? | Provider/identity? | Required test |
|---|---|---|---|---|---|---|
| `F-01` | Scope S updates bucket after allocation | allocation remains in same physical namespace | scope fields may be mutable | not defined | live resource probe | R2-1 |
| `F-02` | Attempt operation A points allocation B | reject | no composite FK shown | no | no | R2-2 |
| `F-03` | Two claims both read generation 7 | one claim wins | partial unique predicate ambiguous | partial | identity | R2-2 |
| `F-04` | A accepted gen7, B takes gen8 before finalize | revalidate/invalidate acceptance | not specified | not defined | DB CAS | R2-2 |
| `F-05` | Publisher inserts role=verifier evidence | reject | role is caller field | not exact | DB role | R2-3 |
| `F-06` | Acceptance references unrelated evidence | reject | no exact FK specified | not exact | DB trigger | R2-3 |
| `F-07` | Local dev/ino mixed with Provider version | reject | XOR not exact | not exact | local/object triggers | R2-4 |
| `F-08` | Legacy FileVersion missing lifecycle relation | preserve read-only, no migration claim | current required FK unresolved | not defined | migration | R2-6 |
| `F-09` | Two migration workers copy one record | one claims/copies | no owner/lease fields | not defined | migration role | R2-7 |
| `F-10` | Cutover new V2 file then rollback | file remains readable | D1 may route to legacy only | no | routing | R2-7 |
| `F-11` | Cleanup operation key K deletes version V2 | only exact V2 delete or fail | Operation lacks exact version FK | no | IAM | R2-8 |
| `F-12` | Provider version missing for acceptance | no FileVersion | non-null intended | pending SQL | capability | R2-9 |
| `F-13` | Provider audit delayed after accepted binding | incident, no false audit claim | profile undefined | no | audit collector | R2-3 |
| `F-14` | Stale credential writes key after revoke | orphan/conflict, no FileVersion | late protocol present | yes if policy implemented | IAM TTL | R2-5 |
| `F-15` | Routing epoch changes while old reader runs | old request aborts/uses safe read | per-request epoch not explicit | not defined | routing | R2-7 |
| `F-16` | Migration target no longer readable after checkpoint | no cutover, quarantine | no revalidation schedule/stop | not defined | migration | R2-7 |

## 15. WP-2A Original Finding Trace

| Original finding | D1 design coverage | Independent result |
|---|---|---|
| R2-1 key ownership | strong allocation table | `PARTIALLY RESOLVED`; scope mutability and exact operation constraints |
| R2-2 Publisher | attempt + takeover protocol | `PARTIALLY RESOLVED`; cross-FK/active-index/generation semantics |
| R2-3 Evidence | producer/evidence/acceptance model | `PARTIALLY RESOLVED`; exact FKs, role binding, audit profile |
| R2-4 close | backend-neutral attestation | `PARTIALLY RESOLVED`; exact Trigger/union migration pending |
| R2-5 identity | workload/IAM/DB role map | `PARTIALLY RESOLVED`; exact operation capability and authentication |
| R2-6 FileVersion | single model | `PARTIALLY RESOLVED`; existing direct relation/nullability unresolved |
| R2-7 migration | batch/state/routing | `PARTIALLY RESOLVED`; worker fencing and V2-only rollback |
| R2-8 cleanup | exact-version intent | `PARTIALLY RESOLVED`; operation lacks object version FK |
| R2-9 Provider gate | official limits + manifest | `PARTIALLY RESOLVED`; live gate/trust root not executable |

No original P1 is fully `RESOLVED WITH EVIDENCE`; all remain design-level
partials.

## 16. Provider / Deployment Blockers

These are not defects that can be waived by document edits:

```text
Provider kind/resource identity:
  NOT SELECTED

Provider account/bucket/region:
  NOT APPROVED

Provider versioning/retention config:
  NOT VERIFIED

Provider audit-log delivery:
  NOT VERIFIED

Provider IAM token scope/revocation:
  NOT VERIFIED

China data residency/legal/commercial:
  BLOCKED

Actual DB/local object inventory:
  NOT VERIFIED
```

The design can specify requirements for these, but cannot prove them without a
separately authorized isolated Provider environment.

## 17. Findings Register

### P0

None confirmed. No implemented Route C source exists.

### P1

| ID | Finding | D1 evidence | Source evidence | Blocking |
|---|---|---|---|---|
| `WP2AR2-P1-01` | ProviderScope identity and namespace can drift after allocation | `wp-2a-route-c-object-storage-remediation-design.md:273-432` | D1 has no Scope immutability/delete trigger | Yes |
| `WP2AR2-P1-02` | Publisher Attempt lacks exact Operation/Allocation composite constraints and active-generation semantics | same design `629-892` | current attempt/lifecycle guards at Migration `731-825` | Yes |
| `WP2AR2-P1-03` | Evidence producer identity, exact FKs and finalizer bypass controls are not concrete | same design `1013-1157`, `1518-1563` | current FileVersion guards at Migration `1811-1943` | Yes |
| `WP2AR2-P1-04` | Local/object close-attestation union is not an executable replacement for current constraints/Triggers | same design `1158-1335` | Schema `577-617`; Migration `484-535`, `674-718` | Yes |
| `WP2AR2-P1-05` | Workload and Provider credentials lack exact process-to-DB-to-IAM binding and operation-scoped enforcement | same design `893-1012` | current Web/Worker storage wiring cited above | Yes |
| `WP2AR2-P1-06` | Single FileVersion model does not resolve current `storageObject` and chain-field migration predicates | same design `1336-1561` | Schema `398-443`; Migration `1811-1943` | Yes |
| `WP2AR2-P1-07` | Migration worker fencing and V2-only rollback are incomplete | same design `1562-1745` | none implemented | Yes |
| `WP2AR2-P1-08` | Cleanup Operations do not explicitly bind exact object version | same design `1746-1842` | Schema `627-655`; Migration `560-590` | Yes |
| `WP2AR2-P1-09` | Provider capability gate is not a live, trust-rooted, fail-closed runtime gate | same design `1843-1949` | no runtime manifest implementation | Yes |

### P2

| ID | Finding |
|---|---|
| `WP2AR2-P2-01` | Routing epoch is not propagated through all readers/writers |
| `WP2AR2-P2-02` | Migration checkpoints lack documented owner/heartbeat/recovery semantics |
| `WP2AR2-P2-03` | Provider audit absence profile is not an explicit enum/policy |
| `WP2AR2-P2-04` | Object conflict cleanup lacks a complete closure/obligation transition |
| `WP2AR2-P2-05` | Cost and degraded-read policy require Provider/business approval |

### P3

| ID | Finding |
|---|---|
| `WP2AR2-P3-01` | Some provider-specific request/error fields remain outside the normalized contract |
| `WP2AR2-P3-02` | D1's `upload-service.ts:267-602` and `download-service.ts:233-513` ranges stop before their actual function ends |

## 18. Admission Decision

The design is not accepted for isolated validation because the remaining P1s
are internal design defects, not just unavailable external credentials.

```text
Isolated Provider test preparation:
  NOT ADMITTED

Reason:
  The test suite cannot prove key ownership, cleanup exactness, finalizer
  authority or safe rollback while the schema/protocol predicates remain
  undefined.
```

### Minimum Conditions Before Re-review

1. Immutable `StorageProviderScope` and trusted resource identity.
2. Exact composite FKs for Attempt/Allocation/Operation/Binding/Acceptance.
3. Exact Evidence producer-role derivation and table grants.
4. Exact backend close/cleanup Trigger predicates.
5. Exact single-FileVersion origin/nullability/storageObject relation design.
6. Migration owner/lease/generation and V2-only rollback policy.
7. Exact-version target on every destructive Operation.
8. Live capability manifest trust root/config verification protocol.
9. Negative tests for all F-01 to F-16 cases.

## 19. Final Verdict

```text
Route C direction:
  WORTH CONTINUING

WP-2A-D1 design quality:
  MATERIAL IMPROVEMENT

WP-2A-R2 overall:
  FAIL — DESIGN CORRECTIONS REQUIRED

P0:
  0

P1:
  9

P2:
  5

P3:
  2

Implementation / isolated Provider execution:
  NOT AUTHORIZED
```

## 20. Git and Integrity

At review start:

```text
Branch:
  codex/public-github-sync

HEAD:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

origin/main:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Tracked modified:
  0

Staged:
  0

Deleted:
  0

Untracked:
  24
```

The independent review adds one untracked report. Final Git state and the
full-file SHA-256 are supplied in the delivery message after the report is
frozen.

No source, Schema, Migration, Trigger, configuration or test was modified.
No database, Provider, Storage, cloud credential, Build, E2E, Native RPC or
deployment operation was performed.
