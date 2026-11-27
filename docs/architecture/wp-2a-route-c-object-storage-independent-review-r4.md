# WP-2A-R4 — Independent Adversarial Review of D3 Integrated Route C Protocol

## 0. Review Control

```text
Stage:
  WP-2A-R4

Mode:
  INDEPENDENT / READ-ONLY / ADVERSARIAL DESIGN REVIEW

Date:
  2026-11-25

Repository:
  D:\thinkbook\Desktop\jieya

Branch at review start:
  codex/public-github-sync

HEAD at review start:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

origin/main at review start:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Reviewed design:
  docs/architecture/wp-2a-route-c-object-storage-remediation-design-d3.md

Reviewed D3 SHA-256:
  D5CDB6BE582DA618057F581FA03A2612CBCC012F0A5FB4435F8CB8FFB36BFD33

Final result:
  FAIL — DESIGN CORRECTIONS REQUIRED

Route C isolated validation:
  NOT ADMITTED

Implementation:
  NOT AUTHORIZED
```

D3 is a substantial architectural improvement. It correctly introduces:

- operation-specific staging/canonical key allocation;
- persistent Provider upload sessions;
- typed acceptance Evidence;
- authority claims and custody generations;
- same-FileVersion backend representations;
- append-only manifest revocation and trust-root epochs;
- one intended shared storage-key lock order.

It still has five new blocking defects. They are design contradictions that a
Provider sandbox cannot repair:

1. stale/superseded exact objects are represented as conflict-only while the
   recovery protocol requires admitting a correct late object;
2. UploadSession Complete/Abort idempotency nonces are required by prose but do
   not exist in the data model;
3. representation-role uniqueness makes failed rollback/migration replication
   impossible to retry;
4. Provider audit contradiction has no fail-closed representation/read path;
5. Evidence subtype definitions are not field-level complete enough to
   implement the claimed exact FKs and digest trust.

## 1. Scope and Independence

This review checks:

- D3 against R3, D2, D1, WP-2A and current source;
- the eight R3 P1 remediation claims;
- D3's new authority, upload, Evidence, representation, trust and locking
  models;
- all 16 integrated race timelines;
- all 24 D3 fixed test vectors;
- current P1-3 compatibility and external governance blockers.

No D3 `RESOLVED BY DESIGN` label is treated as independent evidence.

## 2. Skills and Evidence

### 2.1 Skills Invoked

The following Skills were read completely and applied:

- `$project-architecture`;
- `$prisma-db-safety`;
- `$security-audit`;
- `$testing-and-verification`;
- `$file-lifecycle`.

### 2.2 Evidence Classes

| Label | Meaning |
|---|---|
| `SOURCE VERIFIED` | Current source/Schema/Migration |
| `D3 DESIGN` | D3 proposal; not implemented |
| `TEST VERIFIED` | Executed in this review; none |
| `NOT VERIFIED` | Requires target environment |
| `BLOCKED` | External decision/environment required |

### 2.3 Current Source Facts

`SOURCE VERIFIED`:

| Evidence | Location |
|---|---|
| Current FileVersion storage/chain fields | `prisma/schema.prisma:398-443` |
| Current P1-3 lifecycle/attempt/operation types | `prisma/schema.prisma:501-655` |
| Current operation type enum | `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:55-60` |
| Current staging/canonical namespaces | same Migration `377-388` |
| Current local close fields | same Migration `484-543` |
| Current staging cleanup proof | same Migration `674-718` |
| Current lifecycle/operation guards | same Migration `873-1008` |
| Current upload/completion chain | same Migration `1360-1537` |
| Current FileVersion guards | same Migration `1781-1946` |
| Current DB test capability gaps | `apps/web/scripts/p13-db-tests/capabilities.ts:1-16` |
| Current raw Storage boundary | `packages/file-storage/src/capabilities.ts:23-98` |

Current source contains none of D3's Provider, Claim, UploadSession,
Representation, typed Evidence, TrustRoot or Routing tables.

## 3. Executive Verdict

```text
P0: 0
P1: 5
P2: 6
P3: 2

Overall:
  FAIL — DESIGN CORRECTIONS REQUIRED

Route C direction:
  WORTH CONTINUING

D3 quality:
  MAJOR IMPROVEMENT / NOT ADMISSIBLE FOR ISOLATED VALIDATION
```

All five P1 findings are internal contradictions or missing executable state
models. None depends on unavailable Provider credentials.

## 4. R3 Eight-P1 Independent Trace

| R3 P1 | Independent status | Reason |
|---|---|---|
| `WP2AR3-P1-01` acceptance modes | `PARTIALLY RESOLVED` | Modes exist, but superseded exact adoption and conflicting aggregate/attempt outcome states remain unresolved |
| `WP2AR3-P1-02` staging namespace | `RESOLVED BY DESIGN` | `namespaceKind` + exact operation/lifecycle/key matrix closes the namespace contradiction |
| `WP2AR3-P1-03` multipart session | `PARTIALLY RESOLVED` | Session model exists, but Complete/Abort action idempotency is not persisted |
| `WP2AR3-P1-04` readback binding | `PARTIALLY RESOLVED` | Base object-version FK exists; typed Evidence subtype fields and digest recomputation are incomplete |
| `WP2AR3-P1-05` allocation authority | `PARTIALLY RESOLVED` | Claim/custody chain exists; owner digest equivalence and custody state transition constraints need closure |
| `WP2AR3-P1-06` rollback representation | `PARTIALLY RESOLVED` | Same-FileVersion graph exists; role uniqueness blocks retry after failed replication |
| `WP2AR3-P1-07` revocation/trust root | `RESOLVED BY DESIGN` | Manifest, revocation ledger, root epochs and lease ordering are defined |
| `WP2AR3-P1-08` exact FileVersion origin | `RESOLVED BY DESIGN` | Typed representation plus content/path composite anchors are sufficient for design review |

No R3 P1 receives `RESOLVED WITH EVIDENCE`; no test was executed.

## 5. New P1 Findings

### WP2AR4-P1-01 — Superseded Exact Objects Cannot Be Consistently Adopted

Severity:

```text
P1
```

D3 evidence:

- lines 834-850 define `SUPERSEDED + any -> LATE_EFFECT` as “Conflict only”;
- lines 971-980 say a confirmed expected Provider effect may complete through
  a new recovery authority;
- lines 1586-1592 require `RESPONSE_LOSS_RECOVERY` acceptance for an exact
  observation and readback;
- `StoragePublisherAttempt` also has an independent state while
  `StorageOperationAuthorityClaim` has request/outcome axes.

Minimal counterexample:

```text
Claim A, generation 7:
  request sent
Provider completes exact expected version V
client response lost

Claim B, generation 8:
  verifier observes V
  readback verifies V
  Finalizer is current generation 8
```

The correct V should be adoptable under B, but D3's authority matrix says the
superseded A can only have `LATE_EFFECT` and “Conflict only.” At the same time,
the response-loss protocol says this exact case is acceptance-eligible.

There is also no normative precedence rule when:

```text
AuthorityClaim.outcomeState = LATE_EFFECT
StoragePublisherAttempt.state = OBSERVED
```

or the reverse. Two state machines can disagree; the Finalizer cannot tell
which is authoritative.

Expected:

```text
Claim aggregate outcome:
  NONE / NO_EFFECT / SOURCE_CANDIDATE / CONFLICT / FAILED_RETAINED

Publisher attempt detail:
  REQUEST_SENT / RESPONSE_UNKNOWN / EXACT_OBSERVED /
  CONTENT_VERIFIED / WRONG_CONTENT / LATE_UNCLAIMED

SUPERSEDED/CLOSED + EXACT_OBSERVED/CONTENT_VERIFIED
  may be a source candidate but cannot grant publish authority.

SUPERSEDED/CLOSED + WRONG_CONTENT/LATE_UNCLAIMED
  is conflict-only.
```

A DB-derived aggregate transition must be the sole acceptance input.

Blocking:

```text
YES
```

Required tests:

- stale generation writes correct exact version and loses response;
- new generation observes/readbacks it;
- Finalizer adopts it exactly once;
- stale generation writes wrong content, which must remain conflict-only;
- claim and attempt outcome mismatch is rejected.

### WP2AR4-P1-02 — Complete/Abort Idempotency Is Not Represented

Severity:

```text
P1
```

D3 evidence:

- lines 1040-1063 list UploadSession fields:

```text
initiationNonce
providerUploadId
state
providerRequestId
```

but no `completionNonce`, `abortNonce`, completion request row or action
ledger;

- lines 1179-1185 require:

```text
completionNonce persisted before Complete call
abortNonce persisted before Abort call
```

This requirement has no corresponding field/table.

Minimal counterexample:

```text
Worker W1 enters COMPLETING with providerUploadId U.
Complete response is lost.
DB state becomes COMPLETION_UNKNOWN.
W1/W2 retry Complete without a persisted completion nonce.
Provider returns a second completion/error.
There is no durable request identity to distinguish duplicate from new work.
```

The same applies to:

```text
abort after response loss
Complete/Abort concurrent request
crash immediately before DB commit
successor worker retry
```

Expected:

```text
StorageUploadSessionAction
  id
  uploadSessionId
  action: COMPLETE | ABORT
  actionNonce
  authorityClaimId
  authorityGeneration
  state ACTIVE | RESPONSE_UNKNOWN | SUCCEEDED | FAILED
  providerRequestId
  resultObjectVersionId NULL
  createdAt
  terminalAt
  UNIQUE(uploadSessionId, actionNonce)
```

The session's terminal state must be derived from one terminal action. A late
old action may be recorded but cannot override the current session.

Blocking:

```text
YES
```

Required tests:

- duplicate Complete with same nonce;
- Complete retry after socket loss;
- Abort retry after socket loss;
- concurrent Complete/Abort;
- successor Worker action with current custody.

### WP2AR4-P1-03 — Representation Role Uniqueness Prevents Recovery Retry

Severity:

```text
P1
```

D3 evidence:

- lines 1792-1817 define representation state and:

```text
UNIQUE(fileVersionId, role)
  WHERE role IN ('ORIGIN','V2_CANONICAL','ROLLBACK_FALLBACK')
```

- lines 1927-1940 make `FAILED_RETAINED` terminal.
- Local/object subtype identity columns are not versioned into a second retry
  object.

Minimal counterexample:

```text
FileVersion F is UPLOAD_V2 and needs a local rollback fallback.
COPY operation R1 creates ROLLBACK_FALLBACK representation P1.
Local disk fails; P1 becomes FAILED_RETAINED.
Retry creates P2 for the same FileVersion/role.
UNIQUE(fileVersionId, ROLLBACK_FALLBACK) rejects P2.
```

Because `FAILED_RETAINED` is terminal and subtype identity cannot be re-bound
to a new local lifecycle, the fallback can never be retried.

The same defect blocks:

- migration object representation retry after target copy failure;
- replacement of a failed V2 canonical representation;
- rollback retry after transient local I/O.

Expected one of:

```text
StorageRepresentationAttempt
  fileVersionId
  role
  generation
  target representation
  state

StorageRepresentationSlot
  fileVersionId
  role
  currentAttemptId
  unique current
```

or partial uniqueness:

```text
UNIQUE(fileVersionId, role)
WHERE state IN ('CANDIDATE','VERIFIED','ACTIVE')
```

plus immutable failed attempts retained for audit and a unique current slot.

Blocking:

```text
YES
```

Required tests:

- rollback fallback fails then retries with a new generation;
- migration target fails then succeeds;
- old failed representation remains append-only/history;
- exactly one current slot is active.

### WP2AR4-P1-04 — Provider Audit Contradiction Has No Fail-Closed Transition

Severity:

```text
P1
```

D3 evidence:

- lines 1586-1592 make Provider audit optional for normal and migration
  acceptance;
- lines 1520-1528 say audit proves external operation/principal/time, not DB
  commit;
- no state transition handles a later audit event that contradicts the
  accepted Publisher/Readback evidence.

Minimal counterexample:

```text
Malicious/buggy Verifier writes REABACK_VERIFIED for V.
Finalizer accepts F/V.
Later Provider audit reports:
  principal mismatch, wrong object version, delete, or overwrite.
```

D3 leaves F/V active and cleanup eligibility potentially unchanged. The system
has no `AUDIT_CONFLICT`, quarantine or read-block transition.

Expected:

```text
AUDIT_CONFIRMED
AUDIT_PENDING
AUDIT_CONTRADICTED
AUDIT_UNAVAILABLE_APPROVED
```

and a transaction:

```text
register contradiction
-> mark binding/representation suspect
-> block affected reads and cleanup
-> preserve exact Provider/local objects
-> require independent recovery
```

Cost/availability policy cannot override this safety block.

Blocking:

```text
YES
```

Required tests:

- audit delayed then confirms;
- audit delayed then contradicts exact version;
- audit principal mismatch;
- audit says delete while readback says present;
- contradiction blocks read and cleanup.

### WP2AR4-P1-05 — Evidence Subtype Model Is Not Field-Level Executable

Severity:

```text
P1
```

D3 evidence:

- lines 1433-1462 define a common Evidence base and say every Evidence type has
  a typed subtype;
- lines 1464-1476 provide only a category table, not subtype field lists,
  nullability, unique anchors or composite FKs;
- line 1447 declares `canonicalPayloadDigest` but does not state that a trusted
  ingestion function recomputes it from the typed row;
- Acceptance relies on exact links to `StorageReadbackEvidence`,
  `StorageProviderObservationEvidence`, etc.

Examples of missing subtype definitions:

```text
StorageReadbackEvidence:
  exact scope/endpoint/key/objectVersion/token/generation
  size/hash/verifier/session

StorageProviderObservationEvidence:
  source attempt/request ID/version generation

StorageMigrationReadbackEvidence:
  source and target representation IDs and hashes

StorageDeleteReadbackEvidence:
  destructive target and exact absence result
```

Without those columns and keys, the claimed composite Evidence FK cannot be
implemented or inspected.

Expected:

For every subtype:

```text
field definitions
NULL matrix
PK/unique anchors
all composite FKs
producer role check
operation/objectVersion/claim/session binding
canonical digest recomputation
append-only triggers
```

`canonicalPayloadDigest` must be computed by the NOLOGIN-owned ingestion
function from canonicalized stored fields; a caller-supplied digest is not
trusted.

Blocking:

```text
YES
```

Required tests:

- foreign-key cross-operation substitution rejected;
- wrong producer role rejected;
- digest mismatch rejected;
- same Evidence reused in another acceptance rejected;
- append-only trigger on every subtype.

## 6. P2 Findings

### WP2AR4-P2-01 — Lock Key Set Discovery Is Not Normative

D3 lines 2144-2167 require every touched advisory lock to be acquired before
row locks and in lexical order, but do not state that the complete key set is
derived from immutable operation metadata before the first lock.

Minimal three-key counterexample:

```text
A begins with K1, later discovers K2 and acquires it.
B starts with K2, later discovers K1.
```

The nominal order is violated by dynamic discovery.

Expected:

```text
Operation/Rollback/Migration record materializes all source and target key
identities before lock acquisition
lock helper accepts a sorted immutable key list
dynamic key addition aborts and retries before any row/provider effect
```

Blocking:

`NO` for direction; `YES` for cleanup/rollback implementation.

### WP2AR4-P2-02 — Endpoint Candidate Uniqueness Is Not Enforced

D3 lines 480-497 say one candidate is allowed during rotation, but the listed
partial unique index is only:

```text
UNIQUE(providerScopeId) WHERE state='ACTIVE'
```

Multiple `PROVISIONING` rows can coexist. A later activation race is not
defined by a DB constraint.

Required:

```text
UNIQUE(providerScopeId) WHERE state IN ('ACTIVE','PROVISIONING')
```

or a separate singleton rotation slot.

### WP2AR4-P2-03 — Migration Identity Is Not Unique Per Source

D3's `StorageMigrationRecord` has a unique idempotency key but no explicit
unique `sourceFileVersionId` / source-representation migration slot.
Two batches can create competing migration records for one source, both
observing expected target bytes and competing for the one V2 representation.

Required:

```text
UNIQUE(sourceFileVersionId, sourceRepresentationId, targetProviderScopeId)
```

or a batch-level canonical migration slot with explicit reattempt state.

### WP2AR4-P2-04 — Custody Transition/Owner Snapshot Is Underconstrained

D3 lines 926-980 define custody states and generations but do not provide:

- allowed custody transition matrix;
- exact equality of custody.ownerTokenDigest with claim.ownerTokenDigest;
- assertion that `providerMutationStartedAt` is immutable once set;
- assertion that a stale custody cannot set a terminal state after takeover.

The intended behavior is present in prose, but missing DB-enforced predicates
would allow contradictory custody history.

### WP2AR4-P2-05 — The 16 Timelines Are Scenario Descriptions, Not Executable Transactions

D3 lines 2525-2562 list 16 sequences, but do not specify:

- concrete fixture IDs/generations/keys;
- transaction statements and barriers;
- Provider call boundaries;
- exact expected SQLSTATE/rowcount for each actor;
- observation connection behavior.

They are useful design scenarios but not independently executable test cases.

### WP2AR4-P2-06 — The 24 Vectors Lack Fixed Inputs and Assertions

D3 lines 2602-2633 name 24 scenarios but do not provide:

- exact initial rows;
- principal/session/claim tokens;
- object/version IDs;
- expected SQLSTATE and rowcount;
- expected final row states;
- negative assertions that a wrong success is absent.

Several vectors also overlap:

- `D3-FV-05/06` both initiation/completion response loss;
- `D3-FV-11/12` acceptance-mode variants;
- `D3-FV-20/21` concurrency and response-loss Finalizer.

The count of 24 does not establish coverage of:

```text
stale exact adoption
Complete/Abort nonce replay
representation retry after failure
audit contradiction
three-key dynamic lock discovery
root/revocation stale epoch
```

## 7. P3 Findings

### WP2AR4-P3-1 — Endpoint `FAILED` State Lacks Transition

`StorageProviderEndpointBinding.state` includes `FAILED`, but D3 does not list
the transition from `PROVISIONING` to `FAILED`, its retention, or whether a new
rotation candidate may replace it.

### WP2AR4-P3-2 — Manifest/Lease Operation Child Tables Need Creation Ownership

D3 defines:

```text
StorageCapabilityManifestOperation
StorageCapabilityLeaseOperation
```

but does not state which trusted function inserts each child set or how a
manifest operation row is proved complete before lease issuance. This is a
small completeness gap in the capability gate.

## 8. Sixteen Integrated Timeline Review

| D3 ID | Review result | Missing/defect |
|---|---|---|
| `D3-X-01` | valid direction | concrete two-connection fixture and SQLSTATE not fixed |
| `D3-X-02` | partial | authority matrix makes superseded exact object conflict-only |
| `D3-X-03` | partial | stale Complete authority/action nonce is not represented |
| `D3-X-04` | partial | finalizer adoption of old exact object conflicts with matrix |
| `D3-X-05` | partial | completion action idempotency row absent |
| `D3-X-06` | partial | Complete/Abort action ledger absent |
| `D3-X-07` | partial | readback object change rule lacks explicit post-acceptance suspension |
| `D3-X-08` | partial | custody owner digest/transition predicates underdefined |
| `D3-X-09` | significant risk | migration source uniqueness not enforced |
| `D3-X-10` | significant risk | lock key discovery could be dynamic |
| `D3-X-11` | mostly valid | local fallback missing yields safe failure |
| `D3-X-12` | partial | audit/revocation conflict fail-closed rule incomplete |
| `D3-X-13` | partial | root rotation epoch is defined; no fixed test input |
| `D3-X-14` | partial | shared lock intent exists; key discovery/order test absent |
| `D3-X-15` | mostly valid | Evidence alone does not create FileVersion |
| `D3-X-16` | mostly valid | no exact executable idempotency assertion |

No timeline can be called test-verified.

## 9. Fixed-Vector Coverage Review

| Vector | Independent use | Gap |
|---|---|---|
| `D3-FV-01` | scope/key identity | no duplicate/alias/observation replay fixture |
| `D3-FV-02` | staging namespace | no legacy lifecycle conflict fixture |
| `D3-FV-03` | wrong staging key | no concurrent allocation assertion |
| `D3-FV-04` | canonical namespace | no stale allocation assertion |
| `D3-FV-05` | initiation loss | no uplink-ID correlation input |
| `D3-FV-06` | completion/DB loss | no fixed version/readback digest |
| `D3-FV-07` | abort/complete | no concrete actor ordering |
| `D3-FV-08` | active claim | no fixed generation/owner digest |
| `D3-FV-09` | stale allocation | no provider mutation-started boundary |
| `D3-FV-10` | close evidence cross-op | no fixed Evidence IDs |
| `D3-FV-11` | response loss | no exact version/readback row |
| `D3-FV-12` | migration | no exact migration record/representation row |
| `D3-FV-13` | wrong readback | no expected conflict row/cleanup block |
| `D3-FV-14` | legacy relation | no origin/representation matrix fixture |
| `D3-FV-15` | local fallback | no retry-after-failure case |
| `D3-FV-16` | missing fallback | no route epoch values |
| `D3-FV-17` | dual-read mismatch | no provider/local mismatch values |
| `D3-FV-18` | manifest revoked | no trust epoch/key ID |
| `D3-FV-19` | root rotation | no overlap timestamps |
| `D3-FV-20` | cleanup/finalizer | no 2-connection/3-key case |
| `D3-FV-21` | finalizer response loss | no idempotency row |
| `D3-FV-22` | stale route reader | no route revision values |
| `D3-FV-23` | missing version token | no manifest/provider vector |
| `D3-FV-24` | audit missing strict | no delayed contradiction case |

The vectors are conceptual and non-executable. They are not sufficient as a
fixed acceptance suite for a later isolated database/Provider run.

## 10. Attack Details

### 10.1 Complete/Abort Race

```text
Transaction T1: session OPEN -> COMPLETING
Transaction T2: session OPEN -> ABORTING
```

One CAS should win. D3 states this, but a Complete response-loss retry has no
action identity, and a later Complete after Abort cannot be distinguished from
a duplicate original action.

Required:

```text
session action row + unique action nonce + terminal result
```

### 10.2 Three-Key Lock Race

```text
W1: K1 -> K3
W2: K2 -> K1
W3: K3 -> K2
```

The lexical lock order prevents the cycle only if each worker knows K1/K2/K3
before acquiring K1. D3 does not prohibit dynamic discovery. The test was not
created with three workers and three keys.

### 10.3 Failed Representation Retry

```text
F -> ROLLBACK_FALLBACK P1 -> FAILED_RETAINED
F -> ROLLBACK_FALLBACK P2 -> UNIQUE violation
```

There is no representation attempt history/slot. A transient local failure can
permanently prevent rollback.

### 10.4 Audit Contradiction

```text
READBACK_VERIFIED -> Finalizer accepted -> active FileVersion
later Provider audit -> wrong version/principal
```

D3 has no quarantine/read-block transition. The accepted file remains visible.

## 11. Cross-Stage Blockers

Unchanged:

```text
R5:
  57/57 Open Decisions remain OPEN

BV7:
  FAIL remains in force

BV8:
  NOT INDEPENDENTLY APPROVED

R8:
  BLOCKED remains in force
```

Current project:

```text
Old upload chain / P1-3 integration:
  NOT IMPLEMENTED

Generation CAS, key lock ordering, recovery scanner, filesystem fencing:
  NOT IMPLEMENTED
```

External:

```text
Provider selection/account/region/credentials/IAM:
  NOT VERIFIED

Exact Provider version/list/delete/multipart behavior:
  NOT VERIFIED

Trust-root signing/rotation:
  NOT VERIFIED

Historical local/Provider object inventory:
  NOT VERIFIED
```

## 12. P2-05 Business Boundary

P2-05 remains:

```text
ENGINEERING FAIL-CLOSED BOUNDARY:
  DESIGNED

PROVIDER COST:
  OPEN

DEGRADED READ:
  OPEN

LONG-TERM DUAL READ:
  OPEN

AUDIT LOWER ASSURANCE:
  OPEN

AUTOMATIC UNSAFE DOWNGRADE:
  PROHIBITED
```

No budget or availability policy is invented by this review.

## 13. Isolated Validation Admission

Current:

```text
NOT ADMITTED
```

Minimum conditions before re-review:

1. Make aggregate claim and detailed Publisher/Upload outcome states derive
   from one authority and allow exact stale-object adoption.
2. Add persisted Complete/Abort action rows and nonces.
3. Add representation attempt/slot history so failed rollback/migration can
   retry while one active representation remains unique.
4. Define audit contradiction/quarantine/read-block and cleanup-block states.
5. Provide complete typed Evidence subtype fields, nullability, keys and
   trusted digest recomputation.
6. Make lock key-set discovery immutable before lock acquisition.
7. Enforce one endpoint candidate and one migration slot per source.
8. Replace descriptive test scenarios with fixed inputs, exact operation
   order, expected rowcounts/SQLSTATE and negative assertions.
9. Re-run an independent adversarial review after corrections.

Even after design closure, Provider and business decisions remain blocking.

## 14. Unverified Items

```text
Provider exact version and delete semantics:
  NOT VERIFIED

Multipart initiation/list/abort/late completion:
  NOT VERIFIED

Exact-key credential issuance and revocation propagation:
  NOT VERIFIED

PostgreSQL certificate/pg_ident/pooler behavior:
  NOT VERIFIED

Trust-root custody and rotation:
  NOT VERIFIED

Real database trigger/concurrency behavior:
  NOT VERIFIED

Real filesystem close/identity/TOCTOU behavior:
  NOT VERIFIED

Real historical object inventory:
  NOT VERIFIED
```

## 15. Git and Integrity

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
  28
```

At review end:

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
  29
```

This review adds one untracked report. The report digest is emitted as external
delivery metadata after the file is frozen.

No source, Schema, Migration, Trigger, Function, test, configuration, database,
Provider, Storage, IAM, service, Build, E2E, Native RPC or deployment operation
was modified or executed.

The following were not read, hashed, modified, moved, deleted or started:

```text
$null
UNKNOWN'
apps/web/.next
apps/worker/dist
```

## 16. Final Verdict

```text
WP-2A-R4:
  FAIL — DESIGN CORRECTIONS REQUIRED

P0:
  0

P1:
  5

P2:
  6

P3:
  2

Route C isolated validation:
  NOT ADMITTED

Implementation:
  NOT AUTHORIZED

Provider / Database / Storage / Runtime:
  NOT VERIFIED

Production readiness:
  NOT CLAIMED

Next stage:
  WP-2A-D4 DESIGN CORRECTIONS ONLY
```
