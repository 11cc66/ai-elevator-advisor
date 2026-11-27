# WP-2A-R — Independent Adversarial Review of Route C

## 0. Review Control

```text
Stage:
  WP-2A-R

Mode:
  INDEPENDENT / READ-ONLY / ADVERSARIAL REVIEW

Date:
  2026-11-25

Repository:
  D:\thinkbook\Desktop\jieya

Reviewed report:
  docs/architecture/wp-2a-route-c-object-storage-feasibility-and-migration-assessment.md

Reviewed report SHA-256:
  D47A00C3ED3B0E95E59D3E5429FAB5EB1A96CE76098B25C617D96FBC82BC61E3

Reviewed baseline:
  codex/public-github-sync
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Official documentation rechecked:
  2026-11-25

Final result:
  FAIL — DESIGN CORRECTIONS REQUIRED

Source implementation:
  NOT AUTHORIZED

Database / Provider / Storage / Runtime:
  NOT ACCESSED
```

Route C remains a credible architectural direction, but WP-2A is not ready to
serve as the baseline for isolated provider testing. The report leaves several
P1 safety properties as prose rather than enforceable protocol or database
invariants.

## 1. Scope, Independence and Method

### 1.1 Scope

This review covers:

- the complete WP-2A report and its cited provider documentation;
- current upload, download, Worker, maintenance and Storage capability source;
- current Prisma Schema and P1-3 Migration/Triggers;
- existing test and fault-harness entries;
- WP-1H, WP-1I, WP-1I-R, WP-1J and relevant WP-1E–WP-1G decisions.

The review is independent in the sense that it does not accept WP-2A's
conclusion or capability matrix as evidence. It is not a third-party human
audit.

### 1.2 Method

1. Re-traced current filesystem call paths.
2. Re-read the actual P1-3 Schema and Trigger constraints.
3. Rechecked the official provider pages for exact operation semantics.
4. Constructed stale-Publisher, key-collision, delete-marker and evidence
   forgery scenarios.
5. Tested whether the proposed database model enforces the prose invariants.
6. Separated provider documentation, source facts and engineering inference.

### 1.3 Evidence Labels

| Label | Meaning |
|---|---|
| `SOURCE VERIFIED` | Current repository code/Schema/Migration |
| `OFFICIAL DOCUMENTATION VERIFIED` | Public official provider document checked 2026-11-25 |
| `TEST VERIFIED` | Executed and reproduced in this review |
| `INFERRED` | Derived conclusion from verified evidence |
| `NOT VERIFIED` | No target-provider or runtime evidence |
| `BLOCKED` | External decision or unavailable environment |

No tests were executed. No DB, cloud resource, provider credential, Storage
object, Worker, Build, Native RPC or E2E was accessed.

### 1.4 Protected Objects

The following were not read, hashed, modified, moved, renamed, deleted or
started:

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
  22
```

The WP-1J and WP-2A reports are untracked and preserved. This review will add
one further untracked report.

## 3. Overall Assessment of WP-2A

### 3.1 Correct Direction

WP-2A correctly identifies:

- object storage can replace local file-byte ownership;
- a managed service can remove the need to build local Windows handle/mmap
  fencing;
- provider versioning and Object Lock do not replace application lifecycle
  fencing;
- separate Ingest/Publisher/Read/Cleanup identities are necessary;
- historical data migration and Provider selection are blockers;
- no named provider is approved.

These are supported by current source and official provider documentation.

### 3.2 Not Ready

WP-2A's `ROUTE C FEASIBLE WITH BLOCKERS` is reasonable as a direction, but the
report is not ready for isolated test preparation because it does not define
enforceable versions of its central invariants:

```text
canonical key ownership
late Publisher conflict resolution
four-role cloud identity isolation
publication evidence trust
provider-version requirement
object-store close/cleanup evidence
```

Several are still paragraphs, role names or optional-looking fields. A test
plan cannot compensate for invariants that engineers would have to invent
during implementation.

## 4. R-01 — Canonical Key Permanence

### 4.1 WP-2A Claim

WP-2A sections 6.1–6.2 and 8.4 propose:

```text
object key unique to Operation
key never updated in place
key persistently bound
```

Proposed example:

```text
objects/<fileId>/<operationId>/<random64>.<ext>
```

`SOURCE VERIFIED` that this remains `DESIGN ONLY`; no allocation model or
Migration exists.

### 4.2 Missing Database Invariant

The proposed `StorageObjectBinding` unique key is:

```text
(providerKind, accountScopeRef, bucketOrContainer, objectKey, providerVersionId)
```

This allows:

- the same provider object key to appear in multiple bindings when provider
  version IDs differ;
- the same Operation to have multiple bindings;
- a new Operation to bind an old key under a new version;
- the key to be reused after delete/delete-marker/version deletion unless
  application code remembers not to.

It does not encode:

```text
A canonical object key is permanently bound to one Operation and never reused.
```

### 4.3 Existing Schema Is Only a Partial Foundation

`SCHEMA VERIFIED`:

- `StorageObjectLifecycle.storageKey` is unique.
- `StorageObjectLifecycle` row identity is immutable and DELETE is rejected.
- `FileUploadAttempt.canonicalStorageKey` is unique.
- `FileVersion.storageKey` is unique.
- `FileVersion.creationOperationAttemptId` is unique.
- `p13_assert_attempt_canonical_owner` requires a FINALIZE operation owned by
  the Attempt.
- `p13_assert_file_version_storage_active` requires the exact current
  FINALIZE Operation.

These constraints are useful and can prevent one successful FileVersion from
binding multiple Operations. They do not:

- allocate a provider key before any cloud request;
- bind the key to one Operation before a FileVersion exists;
- distinguish the same string in two providers/buckets;
- require the provider object version to be non-null;
- prevent provider-level delete/key recreation;
- require a durable tombstone before the first provider write.

### 4.4 Provider-Side Counterexamples

`OFFICIAL DOCUMENTATION VERIFIED`:

1. AWS `If-None-Match: *` evaluates the current version and can succeed when
   the current version is a delete marker.
2. AWS conditional deletes evaluate only the current version.
3. Versioned delete without `versionId` adds a delete marker; permanent delete
   requires a version ID.
4. Tencent COS without `versionId` also adds a delete marker when versioning is
   enabled; exact-version deletion requires `versionId`.
5. A provider has no knowledge of the application's historical key-retirement
   invariant.

Therefore neither randomness nor a provider conditional alone establishes
permanent non-reuse.

### 4.5 Required Correction

Add an explicit persistent allocation model, for example:

```text
CanonicalObjectKeyAllocation
  id
  providerKind
  accountScopeRef
  bucketOrContainer
  objectKey
  operationId
  lifecycleId
  state: RESERVED | BOUND | RETIRED
  allocatedAt
  retiredAt

  UNIQUE(providerKind, accountScopeRef, bucketOrContainer, objectKey)
  UNIQUE(operationId)
  UNIQUE(lifecycleId)
```

Rules:

- allocate in the same DB transaction that creates the FINALIZE Operation;
- use a cryptographic nonce plus immutable Operation identity;
- check for collision before any provider write;
- never delete or rewrite the allocation row;
- keep the key RETIRED after object deletion;
- bind a provider version to the allocation only after independent readback;
- a new Operation gets a new key, even for the same logical File.

Alternatively, adapt the existing unique Lifecycle key as the allocation row,
but make the one-key/one-Operation/tombstone invariant explicit in Schema,
Triggers and tests.

### 4.6 Finding

```text
WP2AR-P1-01
Severity: P1
WP-2A section: 6.1, 6.2, 7.4, 8.4
Blocking: YES
```

The required key-permanence invariant is not enforced and the proposed
binding uniqueness allows key reuse under different provider versions.

Closure:

- exact allocation table/constraint or equivalent Lifecycle invariant;
- live-DB transaction sequence proving allocation before provider I/O;
- delete-marker/version-deletion/key-recreation negative tests;
- migration inventory proving all pre-existing keys are reserved or retired.

## 5. R-02 — Publisher Late Request and Fencing

### 5.1 Scenario

```text
1. Publisher A holds Operation O generation G.
2. A pauses with a provider request prepared or in flight.
3. DB recovery revokes G and assigns publisher B generation G+1.
4. B starts publishing.
5. A resumes and sends its stale request.
```

WP-2A correctly states that DB fencing cannot cancel a request already sent to
a provider. Its current design does not fully define the outcome.

### 5.2 Conditional-Provider Case

Assume both A and B use the same persisted Operation key:

- If A writes first with correct content, B gets a precondition conflict but
  can verify A's exact version and potentially adopt it.
- If A writes first with wrong content, B cannot create the fixed canonical key
  under `If-None-Match:*`. WP-2A does not specify how to quarantine the
  unauthorized object and recover.
- If B writes first, A's conditional request should fail.
- If a delete marker is introduced between attempts, `If-None-Match:*` may
  allow a write even if an older protected version still exists.

The report therefore avoids silent overwrite but can deadlock publication
behind a stale or malformed object.

### 5.3 Versioned Unconditional-Provider Case

Tencent COS disables `x-cos-forbid-overwrite` in a versioned bucket. Both stale
A and B may create different versions of the same key.

- If the DB binds the exact version returned by B and all reads use that exact
  version ID, A's later version cannot silently replace B's FileVersion bytes.
- If any read uses “latest”, A can make a newer malicious current version.
- A can also add delete markers if granted delete permission.
- A can consume storage indefinitely if its write capability remains valid.

WP-2A says reads use an exact provider version, but it does not explicitly ban
latest-key reads or canonical-prefix delete for Publisher.

### 5.4 Different Operation Keys

If recovery creates a different Operation/key:

- A and B can both create valid provider objects;
- DB CAS can bind only the chosen Operation;
- A's object becomes an unreferenced resource, not a FileVersion;
- Provider storage cost and audit noise persist;
- cleanup must not delete B's object merely because A's stale request exists.

This is safe only if per-key/operation authorization prevents A from writing B's
key and all reads remain exact-version.

### 5.5 Required Correction

Define one of these explicit protocols:

#### Option 1: One fixed key and conditional create

- Persist key before provider call.
- A/B use the same key and expected checksum.
- On conflict, independently read the current exact version.
- If content and expected metadata match and no FileVersion exists, optionally
  accept it.
- If content differs, state FAILED_RETAINED; quarantine exact version through
  an authorized Recovery Operation; allocate a new Operation/key only after
  the old key is retired.
- Do not overwrite/unlink the disputed object in the original attempt.

#### Option 2: Operation-generation candidate keys

- Each publish generation uses its own immutable key.
- DB CAS selects exactly one candidate version.
- Loser objects are known orphans and remain retained until approved cleanup.
- Never call the provider's “latest” object canonical by itself.

WP-2A must choose one. It currently mixes fixed canonical keys, generated keys
and provider copy semantics.

### 5.6 Finding

```text
WP2AR-P1-02
Severity: P1
WP-2A section: 6.2, 6.5, 6.6, 7.5, C-FS-16
Blocking: YES
```

There is no complete recovery path when a stale Publisher wins the provider
barrier with wrong content or when two versioned writers create conflicting
current versions.

Closure:

- exact stale-A/stale-B timing implementation;
- fixed expected checksum and version semantics;
- quarantine/retry/new-operation rules;
- tests that forbid latest-key read after stale writes;
- IAM tests proving Publisher cannot delete canonical versions or add
  delete markers.

## 6. R-03 — Four Storage Identities

### 6.1 WP-2A Position

WP-2A's role table is directionally correct:

```text
Ingest
Publisher
Read
Cleanup
```

It correctly states that a single all-powerful SDK credential defeats the
design.

### 6.2 Current Status

`SOURCE VERIFIED`:

- No object-store SDK exists.
- No cloud identity abstraction exists.
- No provider IAM policy exists.
- No runtime process split exists.
- Web currently owns direct storage read/write capability.
- Worker currently owns direct raw read capability.
- Maintenance currently has no storage credentials, which is useful.

The four cloud identities are `NOT IMPLEMENTED`.

### 6.3 Missing Details

WP-2A does not yet define:

- which process/runtime owns each identity;
- source of credentials for each process;
- token cache and maximum lifetime;
- what happens when a role is revoked while a token remains valid;
- exact provider policy by action/resource/condition;
- whether per-operation session policies are possible;
- whether a compromised Web process can obtain Ingest or Publisher role
  credentials;
- deployment, restart and emergency revocation;
- DB role separation corresponding to Storage roles;
- prohibition on one process holding multiple roles.

### 6.4 Required Concrete Identity Matrix

At minimum:

| Identity | Provider operations | Explicitly denied | DB role |
|---|---|---|---|
| Ingest | Create/upload own staging key; complete/abort own upload; head own key | Canonical write/delete, bucket config, list other prefixes | staging metadata only |
| Publisher | Read exact approved staging version; create canonical unique key; head/read own result | Delete canonical, delete markers, bucket config, arbitrary keys | lifecycle CAS/evidence request |
| Read | Read/head exact canonical versions required by verified jobs | Write/delete/list administrative scope | read-only file/lifecycle |
| Cleanup | List approved staging/quarantine prefixes; delete exact authorized version | Web/Worker bypass, canonical delete outside Operation | cleanup Operation claims |

The provider policy must identify principals, resources, conditions, session
duration and revocation behavior. A role-name table is insufficient.

### 6.5 Finding

```text
WP2AR-P1-03
Severity: P1
WP-2A section: 10.1–10.3
Blocking: YES
```

The identities are deployment intentions, not a concrete capability boundary.
Without process ownership and exact provider/DB policies, isolated tests cannot
prove isolation.

Closure:

- one provider selected for test;
- concrete principal definitions and policy documents;
- positive/negative IAM tests;
- credential TTL/revocation behavior measured;
- archive or test evidence proving no single process holds all four roles.

## 7. R-04 — Publication Evidence Trust

### 7.1 WP-2A Position

WP-2A proposes an append-only `StorageLifecycleEvidence` containing:

- operation/binding;
- provider request ID;
- principal;
- exact object identity;
- checksum/ETag;
- observation time;
- result/error;
- `evidenceDigest`.

It does not define who is trusted to produce that evidence or how the DB knows
the provider fact is real.

### 7.2 Evidence Classes

| Class | Trust meaning |
|---|---|
| Publisher API response | Application observation at one point; Publisher can be compromised |
| Publisher internal record | Same trust as application process |
| DB append-only row | Append-only under DB privilege model; not proof that cloud operation occurred |
| Provider request ID | Correlation identifier; value alone can be copied/fabricated |
| Provider audit event | External provider record, but delayed/config-dependent and sometimes incomplete |
| Independent exact-version readback | A separate principal re-observes object existence/content at a point in time |
| Recovery/operator evidence | Administrative action evidence; must be independently contained |

`SECURITY DEFINER` can restrict who invokes an ingestion function. It cannot
prove that the supplied cloud facts are true. An append-only Trigger protects
history after insertion; it does not authenticate the original claim.

### 7.3 Attack

If the Publisher process:

- holds the canonical write credential;
- can call the Evidence ingestion function;
- controls the request ID and checksum fields;

then a compromised Publisher can create a DB Evidence row for an operation that
did not produce the claimed object/version. FileVersion creation would accept a
forged fact chain.

Provider logs do not automatically close this because they can be:

- disabled;
- delayed;
- sampled or incomplete;
- stored in a different control plane;
- inaccessible at transaction time.

### 7.4 Required Correction

Define an explicit multi-source evidence protocol:

```text
PUBLISH_RESULT
  Publisher principal, exact key, expected checksum, provider request ID,
  returned version ID

READBACK_VERIFIED
  independent Read/Verifier principal, exact provider version,
  observed size/SHA-256/ETag, nonce/challenge bound to Operation

PROVIDER_AUDIT_CORRELATION
  asynchronous external corroboration where enabled
```

Minimum FileVersion gate:

1. one PUBLISH_RESULT;
2. one independent READBACK_VERIFIED by a distinct provider principal;
3. both bind the same canonical allocation, Operation, provider version,
   expected checksum and nonce;
4. no evidence reuse across Operations;
5. accepted evidence row immutable and append-only;
6. DB role separation so Publisher cannot self-insert verifier evidence.

Provider audit evidence may strengthen investigation but must not be presented
as synchronous proof unless its delivery and availability are proven.

### 7.5 Finding

```text
WP2AR-P1-04
Severity: P1
WP-2A section: 6.1, 8.4, 8.5, 13.2
Blocking: YES
```

`Publication Evidence` currently claims more trust than its ingestion and
verification model can establish.

Closure:

- exact evidence producer identities;
- separated DB privileges;
- independent readback;
- challenge/replay binding;
- provider-log limitations documented;
- forged/duplicate/cross-operation evidence tests.

## 8. R-05 — Exact Object Version and Delete

### 8.1 Required Invariant

For an object-store canonical backend:

```text
providerVersionId IS NOT NULL
provider and bucket/container are immutable for a binding
all reads use the exact bound version
all destructive actions target the exact bound version
no versionless provider is accepted for canonical FileVersion
```

WP-2A describes this direction but does not make `providerVersionId` explicitly
NOT NULL or state that a versionless Provider is disqualified.

### 8.2 AWS Correction

`OFFICIAL DOCUMENTATION VERIFIED`:

- Deleting an object without `versionId` in a versioned bucket creates a delete
  marker rather than deleting a historical version.
- Permanent deletion requires a version ID.
- Conditional deletes apply only to the current version.

Therefore:

- exact historical-version deletion cannot be described as ETag-conditional
  deletion;
- cleanup must use exact `versionId`, DB authorization and provider IAM;
- a delete operation can be performed without conditionally proving that
  historical-version ETag;
- Object Lock may deny the operation, which must be reported as retained.

The WP-2A matrix's generic “version-aware delete” is technically true but does
not state this conditional limitation.

### 8.3 WP-2A + AWS Bucket Policy Conflict

`OFFICIAL DOCUMENTATION VERIFIED`:

If an S3 bucket policy enforces conditional writes:

- `CopyObject` without conditional headers is denied;
- `CopyObject` with conditional headers returns `501 Not Implemented`.

Thus a design cannot simultaneously:

```text
enforce all writes through conditional bucket policy
+ use CopyObject as the staging-to-canonical publication primitive
```

WP-2A lists conditional CopyObject and bucket-policy-enforced writes without
capturing this incompatibility.

### 8.4 Delete Marker and Canonical Key

For AWS and Tencent:

- ordinary delete can create a marker;
- exact version delete is separate;
- a key can become “absent” while historical versions remain;
- key recreation after a marker may still be possible depending on Provider and
  policy.

Cleanup must distinguish:

```text
delete current key -> marker
delete marker version
delete canonical content version
delete retired key allocation/tombstone
```

Only the canonical data version is a potential purge candidate, and only under
the approved lifecycle. The key allocation tombstone in the DB must remain.

### 8.5 Required Correction

- Make provider version/generation non-null for canonical object backends.
- Reject a Provider capability profile with no immutable version identity.
- For every backend, define exact-version read and delete APIs.
- Prohibit delete-marker creation by Publisher and ordinary Read roles.
- Do not claim conditional historical-version deletion unless Provider tests
  prove it.
- Provider lifecycle rules may not target `objects/`.
- Preserve DB key allocation after Provider object deletion.
- Add tests for delete marker, historical version deletion, retention denial,
  missing version, and version-2 selection.

### 8.6 Findings

```text
WP2AR-P1-05
Severity: P1
WP-2A section: 7.1–7.5, 8.4, 8.5, 14.2
Blocking: YES
```

Exact version existence, delete semantics, delete-marker behavior and
versionless backend rejection are not closed.

```text
WP2AR-P1-06
Severity: P1
WP-2A section: 4 capability matrix, 6.3
Blocking: YES
```

AWS conditional enforcement and CopyObject cannot be combined as a general
publication mechanism. Provider-specific capability gates must distinguish
this before test design.

## 9. Current P1-3 Database Compatibility

### 9.1 Reusable Constraints

`SCHEMA VERIFIED`:

- Lifecycle `storageKey` is unique.
- Lifecycle identity is immutable.
- Lifecycle/Operation/Attempt/FileVersion DELETE is rejected.
- A canonical Lifecycle's `currentOperationId` must be the exact FINALIZE
  Operation.
- A FileVersion must reference an ACTIVE canonical Lifecycle and the current
  APPLIED FINALIZE Operation.
- A FileVersion's Intent/Attempt/canonical key chain must agree.
- `FileVersion.creationOperationAttemptId` and `storageKey` are unique.

These are a strong foundation for one successful canonical publication per
key.

### 9.2 Incompatible Close Attestation

`SCHEMA VERIFIED`:

`StorageObjectLifecycle` has local filesystem close fields:

```text
closedDev
closedIno
closedIdentityVerified
```

The existing constraints require:

- `closedIdentityVerified=true` to have non-null `closedDev` and `closedIno`;
- staging cleanup/quarantine/DELETE to require
  `closedIdentityVerified=true`;
- a COMPLETED Attempt to require the Staging Lifecycle to be `DELETED`.

Object storage has no dev/ino. WP-2A's proposed provider binding does not
change these constraints.

Consequence:

```text
An object-store staging object cannot legally traverse the current
Staging cleanup path without either:
  a schema/Trigger correction, or
  semantically false use of closedDev/closedIno.
```

Using Provider version IDs or ETags inside `closedDev`/`closedIno` would be a
trust-boundary defect because the fields mean local filesystem object identity.

### 9.3 Required Close-Evidence Union

The future Schema must distinguish backends explicitly:

```text
storageBackend = LOCAL_FILESYSTEM
  requires local dev/ino/ordinary file/close evidence

storageBackend = OBJECT_STORE
  requires provider, bucket/container, object key, provider version,
  observed SHA-256, size, request ID and readback verification
```

A single `closedIdentityVerified=true` boolean is insufficient unless the
Triggers require the correct backend-specific evidence tuple.

### 9.4 Missing Provider Model

Current repository has no:

```text
StorageObjectBinding
StorageLifecycleEvidence
CanonicalObjectKeyAllocation
provider version/generation
provider request ID
provider audit correlation
object-store backend discriminator
```

WP-2A's proposed fields are directionally useful but remain an outline.

### 9.5 Finding

```text
WP2AR-P1-07
Severity: P1
WP-2A section: 8.1–8.6
Blocking: YES
```

The current P1-3 close-attestation and cleanup constraints cannot carry object
storage unchanged. The proposed binding/evidence model does not provide an
exact union constraint or Trigger integration.

Closure:

- backend-specific close evidence model;
- exact PK/FK/UNIQUE/CHECK/nullability;
- cross-table FKs to Operation and Binding;
- Trigger behavior preserving local semantics and adding object-store
  semantics;
- no fake dev/ino;
- isolated schema/Trigger tests.

## 10. Database Model Review

### 10.1 Current Versus Proposed

| Entity/Invariant | Current fact | WP-2A proposal | Verdict |
|---|---|---|---|
| `StorageObjectLifecycle.storageKey` | Unique and immutable; row cannot delete | Not explicitly used as key allocation authority | Reuse and strengthen |
| `FileUploadIntent` | Legacy key fields and P1-3 current Attempt | No provider-aware intent changes specified | Incomplete |
| `FileUploadAttempt` | Canonical key unique; READY→FINALIZING rules | No Provider version/generation fields | Incomplete |
| `StorageObjectOperation` | One active per key; operation types fixed | No object-store request/version/evidence FK | Incomplete |
| `StorageObjectLifecycle` | Local dev/ino close attestation and state machine | New binding not wired into close checks | Incompatible |
| `FileVersion` | Unique storageKey and P1-3 chain; current app does not satisfy chain | Exact object binding proposed but optionality unresolved | Incomplete |
| `FileExtraction` | Direct FK to FileVersion | Preserve via common FileVersion graph | Compatible direction |
| `FileSecurityEvent` | Append-only; direct FileVersion FK | Evidence not linked to current event chain | Incomplete |
| `ExtractionFieldReview` | Append-only and FileVersion via Extraction | No direct object-store change needed | Preserve |
| `AuditLog` | Update/Delete denied; no TRUNCATE guard; generic JSON | Evidence rows not equivalent to audit | Incomplete |

### 10.2 `StorageObjectBinding` Corrections

At minimum:

- `providerVersionId` NOT NULL for canonical object backends;
- canonical key allocation unique independent of version ID;
- binding identity immutable;
- exactly one accepted binding for one canonical Operation/key;
- FK to Operation/Lifecycle/Attempt/Intent with composite consistency;
- provider/account/bucket/key/version in one uniqueness cross-check;
- no update from VERIFIED to a different object version;
- deletion of binding prohibited;
- lifecycle/recovery state uses new binding, not local dev/ino.

### 10.3 Evidence Corrections

- Evidence INSERT must be role-controlled and append-only.
- Evidence cannot be updated/deleted/truncated.
- Evidence identity and nonce cannot repeat.
- Accepted FileVersion gate should require an independent readback verifier,
  not only Publisher-generated data.
- `evidenceDigest` must be computed over canonical evidence payload and checked
  by DB ingestion; a self-supplied hash is not proof.
- Provider audit correlation may be nullable/asynchronous but not
  contemporaneous proof.

### 10.4 Legacy/v2 Decision

WP-2A changes the WP-1G direction from separate `file_version_v2` to a possible
single FileVersion graph. It labels the new direction a recommendation, not an
approved design.

This review agrees that direct downstream FKs make a separate v2 table
expensive, but no choice is approved. The next review must compare:

1. one FileVersion table with protocol/back-end conditional constraints; or
2. parallel v2 FileVersion/Extraction/Review/Event tables and mapping.

No Migration may proceed before one model is selected and modeled exactly.

### 10.5 Finding

```text
WP2AR-P1-10
Severity: P1
WP-2A section: 8.3–8.6, 9.2–9.4
Blocking: YES
```

The report does not settle the Legacy/v2 table decision or provide an exact
forward migration model that preserves downstream FKs without fabricating
history.

Closure:

- user-reviewed model choice;
- exact ERD with nullable/unique/FK/delete behavior;
- migration interruption/resume design;
- API and Worker path isolation;
- synthetic data tests only.

## 11. Official Provider Corrections

All findings in this section are `OFFICIAL DOCUMENTATION VERIFIED` on
2026-11-25.

| ID | Topic | WP-2A wording | Independent recheck |
|---|---|---|---|
| O-01 | AWS conditional write enforcement | Supports conditional Put/Complete/Copy and IAM direction | Bucket-policy enforcement permits `PutObject`/`CompleteMultipartUpload` with conditions, but CopyObject to the enforced bucket/prefix fails `403` with no conditional header and `501` with one. [AWS enforcement](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes-enforce.html) |
| O-02 | AWS conditional delete | Lists version-aware delete | Conditional delete evaluates only the current version. Historical-version permanent delete requires `versionId`, and ETag conditions should not be assumed to bind historical version content. [AWS conditional deletes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-deletes.html), [`DeleteObject`](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html) |
| O-03 | AWS delete marker | Notes version-specific deletion | A normal versioned delete inserts a delete marker; permanent deletion includes `versionId`. Object Lock may reject version deletion while a normal delete still creates a marker. [AWS Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) |
| O-04 | Azure version-level WORM | Says versioning required | Confirmed: version-level WORM requires versioning; locked retention policy restrictions remain. [Azure immutable storage](https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-storage-overview) |
| O-05 | Azure hierarchical namespace | Not discussed | HNS changes Blob/API capabilities, ACL behavior and anonymous-read semantics. If HNS is enabled, anonymous read access can bypass ACLs for reads; this must be part of capability gate. [Azure HNS known issues](https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-known-issues) |
| O-06 | Azure versions | Notes version retention/cost | Azure recommends fewer than 1,000 versions per blob for listing latency; versioning cannot recover a deleted container/account. [Azure versioning](https://learn.microsoft.com/en-us/azure/storage/blobs/versioning-overview) |
| O-07 | Tencent conditional multipart | WP-2A notes PUT behavior | `x-cos-forbid-overwrite` is documented on CompleteMultipartUpload too and is ineffective when versioning is enabled. [Tencent Complete MultipartUpload](https://cloud.tencent.com/document/product/436/7742) |
| O-08 | Tencent delete marker | Matrix says exact-version behavior must be tested | `DELETE` without `versionId` creates a delete marker when versioning is enabled; exact version delete requires `versionId`. [Tencent DELETE Object](https://cloud.tencent.com/document/product/436/7743) |
| O-09 | Tencent copy response | Proposes CopyObject only after proof | CopyObject can return HTTP `200 OK` with an error body; status alone is not success proof. [Tencent PUT Object - Copy](https://cloud.tencent.com/document/product/436/10881) |
| O-10 | GCS versioning | Correctly notes versioning | GCS recommends soft delete for accidental/malicious deletion; Object Versioning preserves noncurrent objects until explicitly removed. [GCS Object Versioning](https://cloud.google.com/storage/docs/object-versioning) |
| O-11 | S3-compatible category | Correctly says capability varies | MinIO supports versioning/Object Lock; R2 compatibility page marks versioning/Object Lock APIs unsupported. The class cannot be approved without an exact implementation. [MinIO](https://min.io/docs/minio/linux/administration/object-management/object-versioning.html), [R2 compatibility](https://developers.cloudflare.com/r2/api/s3/api/) |

### 11.1 Finding

```text
WP2AR-P1-06
Severity: P1
WP-2A section: 3–4, 6.3, 7.1–7.5
Blocking: YES
```

The provider matrix must be corrected before a test plan chooses publish/delete
operations. In particular, AWS conditional enforcement and CopyObject cannot
be combined; AWS conditional deletes are current-version only.

### 11.2 P2 Provider Corrections

```text
WP2AR-P2-01  Azure HNS is not part of the test gate.
WP2AR-P2-02  Azure version-count/list latency and account/container deletion
             limits are not in the operational criteria.
WP2AR-P2-03  Tencent CopyObject HTTP-200 error body is not in the Adapter
             contract.
WP2AR-P2-04  Provider audit logs are asynchronous/configuration-dependent and
             cannot be assumed available for synchronous acceptance.
```

These do not independently make Route C infeasible, but they must be closed in
the capability manifest and tests.

## 12. Migration Review

### 12.1 What WP-2A Gets Right

- No source deletion during initial migration.
- Verify target checksum and size.
- Keep unprovable rows legacy/blocked.
- Do not fabricate chain IDs/evidence.
- Preserve original local objects for rollback.

### 12.2 Missing Preconditions

- Actual DB row classes are not inventoried.
- Current P1-3 migration requires empty file/intent tables; a real history
  cannot use it unchanged.
- No exact key-allocation/tombstone model exists.
- No record-level migration state table or durable checkpoint model exists.
- No rule defines whether one FileVersion can have multiple Provider retries
  without violating the one-key/one-Operation invariant.
- No validation proves that provider metadata/tags cannot be altered to spoof
  migration source identity.
- No cost budget or rollback/exit test is defined.

### 12.3 Finding

```text
WP2AR-P1-09
Severity: P1
WP-2A section: 9.1–9.5
Blocking: YES
```

Historical migration remains a plan skeleton, not an executable protocol.

Closure:

- read-only inventory first;
- exact classification and checkpoint table;
- one-provider test dataset;
- interruption/resume and source-retention tests;
- cost/throughput measurement;
- no active history until source/DB/binding proves equivalence.

## 13. Route C versus Route A

### 13.1 Route C Still Worth Continuing

The review agrees with the high-level preference:

- Route C avoids a custom privileged Windows file authority;
- modern managed object stores expose conditional/versioned operations;
- provider IAM can be split across services;
- object-store version IDs replace local file identity for canonical bytes;
- no local cache/opener means no handle/mmap fencing problem.

This is not a claim that Route C is cheaper in every dimension. It adds:

- external provider and account operations;
- China-region/data-residency/commercial dependency;
- API-specific failure semantics;
- network/egress/request/version/log costs;
- remote migration and recovery.

### 13.2 Route A Still Has Value as an Offline Fallback

If the product requires a fully local/offline deployment, Route C is unavailable.
Route A remains the fallback, but its P1 blockers from WP-1I-R/WP-1J are not
closed.

### 13.3 Decision

```text
Route C direction:
  WORTH CONTINUING

WP-2A as isolated-test baseline:
  FAIL — CORRECTIONS REQUIRED

Final provider:
  NOT SELECTED

Route A:
  DO NOT CONTINUE BY DEFAULT

Route C implementation:
  NOT AUTHORIZED
```

## 14. Provider and Deployment Blockers

### 14.1 Technical Blockers

- No provider/API version chosen.
- No exact conditional write/copy/complete semantics tested.
- No version-specific read/delete semantics tested.
- No IAM principals or policy artifacts exist.
- No provider audit-log settings/retention tested.
- No explicit availability/consistency model for the target region.

### 14.2 Business/Legal Blockers

- Mainland operating entity/account route not decided.
- Data residency/cross-border position not decided.
- File retention/deletion/legal hold policy not decided.
- Provider contract/SLA/exit/export terms not reviewed.
- Sensitive customer/project data processing basis not decided.

No provider claim in this review should be read as a China compliance approval.

## 15. Isolated Test Preparation Admission

WP-2A asks whether the architecture assessment can end and isolated test
preparation begin.

### 15.1 Minimum Corrections Before Test Preparation

1. Write the exact canonical-key allocation invariant and database model.
2. Choose the stale-Publisher conflict/recovery protocol.
3. Define concrete cloud identities and exact least-privilege policies.
4. Define the multi-source Publication Evidence gate.
5. Require exact Provider version/generation and exact-version delete.
6. Add backend-specific P1-3 close/snapshot evidence constraints.
7. Select one Legacy/v2 data-model direction.
8. Correct AWS Copy/conditional enforcement and delete semantics.
9. Add Azure HNS/Tencent copy-error rules to the capability manifest.
10. Define a read-only data inventory before any migration design is finalized.
11. Choose a candidate Provider/region for a synthetic test environment.

### 15.2 What Can Be Tested Once Those Are Closed

- Fake adapter contract and DB clone tests;
- isolated provider conditional create/version read;
- multipart/resumable interruption;
- exact-version delete and delete-marker behavior;
- IAM positive/negative tests;
- credential TTL/revocation;
- Provider audit correlation;
- stale Publisher race and recovery;
- DB commit response loss;
- migration interruption/resume with synthetic records.

### 15.3 What Cannot Be Tested

Without separate authorization:

- real customer files;
- production provider accounts;
- business DB migrations;
- Windows service/ACL/CNG changes;
- actual deployment;
- provider contract/legal/data-residency compliance.

## 16. Test Matrix Corrections

The WP-2A test matrix is useful but misses critical cases:

| Missing test | Why required |
|---|---|
| Key allocation collision before Provider call | R-01 |
| Delete-marker recreation of canonical key | R-01/R-05 |
| Stale A wins with wrong content | R-02 |
| Stale A creates later version after B success | R-02 |
| Publisher attempts delete-marker placement | R-03/R-05 |
| Ingest token after upload owner change | R-03 |
| Credential revocation propagation delay | R-03 |
| Publisher forges Evidence | R-04 |
| Evidence replay across Operation/version | R-04 |
| Independent readback unavailable | R-04 |
| AWS conditional policy plus CopyObject | R-05 |
| AWS historical-version delete with/without ETag | R-05 |
| Azure HNS anonymous/ACL behavior | R-05 |
| Tencent HTTP-200 error body | R-05 |
| Provider lifecycle rule tries deleting canonical | R-05 |
| Schema with object-store close evidence | P1-07 |
| Actual historical DB classification | P1-09 |

No test should be called passed until executed in the authorized layer and
recorded with provider request IDs and durable output.

## 17. Findings Register

### P0

None confirmed. Route C has not been implemented or deployed, so no current
production vulnerability was introduced by this design report.

### P1

| ID | Finding | Blocking |
|---|---|---|
| `WP2AR-P1-01` | Canonical key permanence is not enforced by the proposed schema | Yes |
| `WP2AR-P1-02` | Stale Publisher/provider collision recovery is incomplete | Yes |
| `WP2AR-P1-03` | Four Provider identities lack concrete runtime, credential and policy boundaries | Yes |
| `WP2AR-P1-04` | Publication Evidence has no independent trust chain | Yes |
| `WP2AR-P1-05` | Exact Provider version and version-relative delete semantics are not closed | Yes |
| `WP2AR-P1-06` | AWS conditional enforcement conflicts with CopyObject and delete semantics are mis-scoped | Yes |
| `WP2AR-P1-07` | Current local close-attestation cannot carry object-store lifecycle | Yes |
| `WP2AR-P1-08` | `StorageObjectBinding`/Evidence constraints and FileVersion relationship are incomplete | Yes |
| `WP2AR-P1-09` | Historical migration is a skeleton without exact state/checkpoint/rollback model | Yes |
| `WP2AR-P1-10` | Legacy/v2 model decision remains unresolved | Yes |

### P2

| ID | Finding |
|---|---|
| `WP2AR-P2-01` | Azure HNS restrictions and anonymous-read ACL behavior are not in the capability gate |
| `WP2AR-P2-02` | Azure version-count/list latency and account/container deletion limits need operational criteria |
| `WP2AR-P2-03` | Tencent CopyObject requires response-body success parsing |
| `WP2AR-P2-04` | Provider audit logs are asynchronous and configuration/cost dependent |
| `WP2AR-P2-05` | No exact credential TTL/revocation propagation test is defined |
| `WP2AR-P2-06` | No configuration-drift detector exists for versioning/retention/lifecycle rules |
| `WP2AR-P2-07` | Provider cost/retention estimates are qualitative only |
| `WP2AR-P2-08` | No explicit provider outage/degraded-read policy exists |

### P3

| ID | Finding |
|---|---|
| `WP2AR-P3-01` | Provider/backend terminology needs a canonical versioned capability registry |
| `WP2AR-P3-02` | Evidence/result error taxonomy needs one cross-provider mapping |

## 18. Final Review Conclusion

WP-2A is directionally useful and should continue as the Route C candidate.
It correctly rejects a custom Windows Broker as the default path and
correctly refuses to claim that object storage alone solves lifecycle safety.

It is not yet ready for isolated provider test preparation because its central
security invariants remain unenforced or underspecified. The most serious
issues are:

1. no database-level permanent canonical-key allocation invariant;
2. no complete stale Publisher conflict/recovery protocol;
3. no concrete cloud identity/credential boundary;
4. no independent Publication Evidence verifier;
5. no backend-compatible object-store close evidence in P1-3;
6. unresolved Legacy/v2 model and historical migration.

```text
Review independence:
  PASS WITH SAME-SESSION LIMITATION

Route C direction:
  WORTH CONTINUING

WP-2A readiness:
  FAIL — DESIGN CORRECTIONS REQUIRED

Isolated provider test preparation:
  BLOCKED ON THE P1 CORRECTIONS ABOVE

Provider selection:
  NOT MADE

Source implementation / Provider / Migration / Runtime:
  NOT AUTHORIZED
```

## 19. Git and Report Integrity

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
  22
```

This review adds one untracked file. Final Git status is supplied after the
report is frozen.

No source, Schema, Migration, Trigger, configuration or test was modified.
No database, Provider, cloud identity, Storage object, Windows security,
Worker, Build, Native RPC, E2E or deployment operation was performed.

### Report SHA-256

The full-file self-hash cannot be embedded without changing the hash. The final
SHA-256, byte count and line count are computed after freezing this report and
reported in the delivery message.
