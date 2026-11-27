# WP-2A-R5 — Independent Adversarial Review of D4 Executable Protocol

## 0. Review Control

```text
Stage:
  WP-2A-R5

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

Reviewed D4:
  docs/architecture/wp-2a-route-c-object-storage-remediation-design-d4.md

D4 SHA-256:
  267C86AF4A6E0B645619641F7B6CB6EF8388369BAAC26FD6994556E4A0CF3056

Final result:
  FAIL — DESIGN CORRECTIONS REQUIRED

Route C isolated validation:
  NOT ADMITTED

Implementation:
  NOT AUTHORIZED
```

D4 makes material improvements to the overall protocol. It correctly:

- separates authority claims from Provider effects;
- adds a durable Upload Action Ledger and provider-result attempts;
- separates representation slots from retryable attempts;
- adds Integrity Incident and quarantine concepts;
- defines a canonical Evidence payload boundary;
- attempts a sealed, sorted lock plan;
- adds deterministic fixture namespaces and substantially more test detail.

The design is still not an executable safe baseline because several claimed
database relationships cannot be formed as written, and the test specifications
remain partly descriptive rather than fully instantiated.

## 1. Scope and Independence

This review checks:

- D4 against R4, R3, D3 and the current repository;
- five R4 P1 findings;
- six R4 P2 and two P3 findings;
- every D4 table/unique/FK/CHECK/state rule in the affected protocol;
- the 14 typed Evidence classes;
- the 16 integrated race specifications;
- the 24 fixed vectors;
- the 12 additional cross-protocol tests;
- external governance and provider/database blockers.

No D4 `RESOLVED BY DESIGN` statement is accepted without independent evidence.

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
| `D4 DESIGN` | D4 proposed protocol |
| `TEST VERIFIED` | Executed in this review; none |
| `NOT VERIFIED` | Requires target database/Provider/OS/runtime |
| `BLOCKED` | External decision or environment required |

### 2.3 Current Source Facts

`SOURCE VERIFIED`:

| Evidence | Location |
|---|---|
| Current FileVersion/chain relation | `prisma/schema.prisma:398-443` |
| Current P1-3 lifecycle/attempt/operation types | `prisma/schema.prisma:501-655` |
| Current operation enum | `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:55-60` |
| Current staging/canonical namespaces | same Migration `377-388` |
| Current close constraints | same Migration `484-543` |
| Current staging cleanup proof | same Migration `674-718` |
| Current lifecycle/operation guards | same Migration `873-1008` |
| Current upload completion chain | same Migration `1360-1537` |
| Current FileVersion guards | same Migration `1781-1946` |
| Current DB test gaps | `apps/web/scripts/p13-db-tests/capabilities.ts:1-16` |

No D4 Provider/Effect/Action/Representation/Incident table exists in current
source.

## 3. Executive Verdict

```text
P0: 0
P1: 6
P2: 5
P3: 2

Overall:
  FAIL — DESIGN CORRECTIONS REQUIRED

Route C direction:
  WORTH CONTINUING

D4 quality:
  MAJOR IMPROVEMENT / NOT ADMISSIBLE FOR ISOLATED VALIDATION
```

The P1 findings are internal schema/transaction defects, not missing
Provider-account evidence.

## 4. R4 Five-P1 Independent Trace

| R4 P1 | Status | Independent reason |
|---|---|---|
| `WP2AR4-P1-01` authority/effect | `PARTIALLY RESOLVED` | ProviderEffect is conceptually correct, but UploadAction does not carry its effect FK and action/effect authority is not fully tied |
| `WP2AR4-P1-02` action ledger | `PARTIALLY RESOLVED` | Action state model exists, but request digest is unspecified and the action slot lacks a complete exact FK |
| `WP2AR4-P1-03` representation retry | `PARTIALLY RESOLVED` | Slot/Attempt generation solves role retry, but active pointer and parent uniqueness are not fully constrained |
| `WP2AR4-P1-04` quarantine | `PARTIALLY RESOLVED` | Incident/quarantine/read lease exist, but in-flight cleanup/rollback and epoch transitions are not fully fenced |
| `WP2AR4-P1-05` typed Evidence | `PARTIALLY RESOLVED` | 14 families and canonicalization are present, but subtype-level exact FK/CHECK contracts remain incomplete |

None receives `RESOLVED WITH EVIDENCE`.

## 5. New P1 Findings

### WP2AR5-P1-01 — Upload Action Does Not Reference the Authoritative Effect

Severity:

```text
P1
```

D4 evidence:

- §4.1 says `StorageProviderUploadAction` and `StoragePublisherAttempt`
  reference the same `StorageProviderEffect`;
- §4.3 defines the effect identity;
- §5.1 fields at lines 405-424 contain `uploadSessionId`, action fields and
  Provider identity, but no `providerEffectId`;
- §5.2 action results also do not carry an effect FK.

Minimal counterexample:

```text
Action A completes with providerUploadId U.
Provider result can be interpreted as exact V or UNKNOWN.
StorageProviderEffect E exists for the Operation.
Action A has no DB column/fk proving which effect it produced.
```

Two reconcilers can create/update different Effect rows for the same action.
The authoritative Effect is therefore not actually referenced by the Action
ledger.

Expected:

```text
StorageProviderUploadAction.providerEffectId NOT NULL
  -> StorageProviderEffect(id, operationId, allocationId, sourceGeneration)

UNIQUE(providerEffectId, uploadSessionId, actionType)
```

and action result/evidence must prove the same effect identity.

Blocking:

```text
YES
```

### WP2AR5-P1-02 — Several Claimed Composite FKs Have No Parent Unique Anchor

Severity:

```text
P1
```

D4 claims these exact relations:

- `StorageProviderEffect`:

```text
(objectVersionId, allocationId)
  -> StorageObjectVersion(id, allocationId)
```

but `StorageObjectVersion` at lines 1756-1775 lists no
`UNIQUE(id, allocationId)`;

- `StorageUploadPartCheckpoint`:

```text
(actionId, uploadSessionId)
  -> StorageProviderUploadAction(id, uploadSessionId)
```

but the Action table at lines 428-430 only lists
`UNIQUE(id, uploadSessionId, actionType)`;

- `StorageUploadSessionActionSlot.activeActionId` has no FK to the action or a
  composite `(uploadSessionId, activeActionId)` anchor (lines 518-519);

- `StorageRepresentationSlot.activeAttemptId` has no FK to
  `StorageRepresentationAttempt(slotId,id)` (lines 585-590).

Minimal counterexample:

```text
RepresentationSlot S has activeAttemptId = P
P belongs to a different Slot S2.
No FK rejects the pointer.
```

Expected:

- add unique anchors required by each FK;
- add active pointer FKs and deferred constraints;
- make all pointer fields same-transaction CAS updates;
- add negative joins across slot/session/action/object.

Blocking:

```text
YES
```

### WP2AR5-P1-03 — `requestDigest` Has No Canonical Input Contract

Severity:

```text
P1
```

D4 evidence:

- lines 405-424 define `requestDigest NOT NULL`;
- lines 527-531 reuse same nonce/request digest semantics;
- §5.5 says validate the digest before action dispatch.

There is no definition of:

- fields included in the digest;
- occurrence/order of nullable fields;
- canonical encoding;
- timestamp/number representation;
- whether scope, endpoint, object key, upload ID, part number and session
  generation are included;
- read-time recomputation.

Minimal counterexample:

```text
Action A1:
  nonce N, key K1, requestDigest D
Action A2:
  same nonce N, different key K2 or endpoint E2,
  client supplies the same D
```

If the digest excludes scope/key/endpoint/part, the implementation can return
A1 as the idempotent result for A2. If it includes different caller-controlled
fields, canonicalization ambiguity can produce false replay results.

Expected:

```text
requestDigest = SHA-256(
  domain + canonical(
    actionType, uploadSessionId, stagingOperationId,
    sessionGeneration, authorityClaimId,
    providerScopeId, endpointBindingId, objectKey,
    providerUploadId, partNumber, create/complete/abort parameters
  )
)
```

The canonicalizer and exact field set must be normative and tested.

Blocking:

```text
YES
```

### WP2AR5-P1-04 — Quarantine Cannot Fence Already-dispatched Cleanup or Rollback

Severity:

```text
P1
```

D4 evidence:

- lines 793-802 exclude active quarantine from new cleanup/rollback selection;
- lines 804-829 define read leases and quarantine epoch;
- §7.5 lines 832-849 insert quarantine and “block cleanup references”;
- Provider calls are outside DB transactions (D4 §13).

The design has no exact field/action protocol that revokes an already
`DISPATCHED` destructive Effect. The quarantine transaction can lock a
representation, but a cleanup Worker can already have committed its dispatch
marker and be waiting on the Provider network. It can then delete the exact
version after quarantine commits.

Minimal counterexample:

```text
CLEANUP CT marks DELETE effect DISPATCHED with quarantineEpoch=4.
BARRIER: cleanup is about to call Provider DELETE.
Incident I inserts ACTIVE quarantine and increments epoch=5.
CT continues and deletes V.
Cleanup APPLIED, but the quarantined object needed for investigation is gone.
```

D4's `quarantineEpochSnapshot` exists on ReadLease but not on the cleanup
effect/action; no pre-provider epoch recheck or dispatch fence is specified.
The same race applies to rollback copy reads.

Expected:

```text
quarantineEpoch stored on RepresentationSlot/Attempt
cleanup/rollback action records expectedQuarantineEpoch
before Provider call, action CAS checks current epoch
incident increments epoch under the same storage key plan
dispatch after quarantine fails closed
already-dispatched effect becomes UNKNOWN/retained, never assumed APPLIED
```

Blocking:

```text
YES
```

### WP2AR5-P1-05 — Typed Evidence Subtypes Still Lack Per-Subtype Exact Constraints

Severity:

```text
P1
```

D4 evidence:

- §8.1 base fields and common producer FKs are present;
- §8.2 lines 933-1120 list field names for 14 Evidence classes;
- there are no per-subtype PK/FK/UNIQUE/CHECK anchors listed after the field
  lists;
- the general table says every subtype shares a parent relation, but exact
  cross-checks such as:

```text
uploadActionId matches action.stagingOperationId
providerEffectId matches action.providerEffectId
objectVersionId matches target binding/version
representationAttemptId matches the declared backend
```

are not enumerated as database constraints.

Minimal counterexample:

```text
StorageUploadActionEvidence E references action A of session S1,
but base operationId belongs to another operation O2.
The common base relation only checks producer/session/operation, not
action.operationId.
```

Expected for every subtype:

- exact PK and discriminator;
- FK to base by `(evidenceId, evidenceType)`;
- exact parent fields;
- type-specific NULL matrix;
- unique anchors for object/action/attempt/incident references;
- CHECKs preventing subtype/base field disagreement;
- read/digest recomputation function.

Blocking:

```text
YES
```

### WP2AR5-P1-06 — The “Fixed” Test Suite Is Not Fully Deterministic or Executable

Severity:

```text
P1
```

D4 evidence:

- §16 lines 2614-2650 use symbolic `<T>` fixture tokens and list only a
  symbolic row set;
- §17 16-race cases provide narrative steps but not complete SQL/function
  inputs and expected rowcounts for every actor;
- §18 24-vector table combines input/action/expected in prose; its second
  provider/evidence table still omits exact initial row values and exact
  final state for each actor;
- §19 XT subsections add useful detail but still omit complete initial
  Provider object/Evidence rows and all `UPDATE` rowcounts.

Minimal counterexample:

```text
D4-X-02 says “old server-side completion is discovered”
without specifying:
  exact upload action row,
  exact Provider version row,
  exact final effect state,
  exact Evidence row set,
  exact expected rowcount for the stale update.
```

The suite cannot distinguish a correct rejection from an accidental success by
executing the written steps alone.

Expected:

```text
one fully materialized fixture per test
one SQL/function call per step
explicit transaction boundaries/barriers
explicit Provider call and fault result
expected SQLSTATE/application class
expected rowcount
expected final DB/Provider/Evidence snapshots
negative queries
```

Blocking:

```text
YES
```

## 6. P2 Findings

### WP2AR5-P2-01 — Global Action Nonce Can Create Cross-Workload Availability Conflicts

D4 uses global `idempotencyNonce UNIQUE`. This prevents reuse but makes a
nonce from one workload/session conflict globally with another unrelated
workload.

Expected:

- use an opaque high-entropy nonce with `(actionType, nonce)` uniqueness;
- or `(workloadId, actionType, nonce)` plus a separate anti-replay table;
- never leak the existence of another session's nonce.

### WP2AR5-P2-02 — Action Slot and Active Representation Pointers Need Exact FKs

The active pointers are stated as invariants but not represented by exact
composite FKs in D4:

```text
UploadSessionActionSlot.activeActionId
RepresentationSlot.activeAttemptId
Operation.activeAuthorityClaimId
Lifecycle.activeAuthorityClaimId
```

The current D4 statements are application/trigger prose, not field-level
database relationships for every pointer.

### WP2AR5-P2-03 — Incident/Quarantine Rows Are Described as Append-only but Have Mutable State

D4 labels the integrity mechanism append-only and gives both Incident and
Quarantine mutable states, but does not define an immutable transition-event
table. It therefore cannot simultaneously enforce row immutability and
state transitions.

Expected:

```text
IncidentEvent
QuarantineEvent
append-only transition history
current state derived from latest event
```

### WP2AR5-P2-04 — Migration Target Fill Is Incomplete

`StorageMigrationRecord` lists nullable target fields and says they are filled
together, but does not provide the exact composite target FKs or the
transition row that seals the target tuple. A failed migration could leave
partially filled target columns without a DB-level check.

### WP2AR5-P2-05 — Endpoint Rotation and Capability Child Sets Need Atomic Ownership

D4 describes endpoint candidate singleton and manifest/lease operation child
sets, but does not define the exact transaction that prevents a candidate
binding from being inserted without its manifest operation row and lease
operation rows. The intended constraints are not fully executable.

### R4 P2/P3 Original Finding Trace

| Original R4 finding | R5 status | Why it cannot be closed |
|---|---|---|
| `WP2AR4-P2-01` dynamic lock set | `PARTIALLY RESOLVED` | sealed plan is directionally correct, but key materialization and exact table locks are not complete |
| `WP2AR4-P2-02` endpoint provisioning | `PARTIALLY RESOLVED` | singleton slot exists, but child-set atomicity/activation constraints are incomplete |
| `WP2AR4-P2-03` migration source | `PARTIALLY RESOLVED` | source slot exists, but exact target/current-record constraints and rollback state remain incomplete |
| `WP2AR4-P2-04` custody | `PARTIALLY RESOLVED` | transition matrix exists, but owner digest equality and active pointer FK require executable constraints |
| `WP2AR4-P2-05` timelines | `PARTIALLY RESOLVED` | 16 narratives are present, but fixture rows/steps/rowcounts are not fully materialized |
| `WP2AR4-P2-06` vectors | `PARTIALLY RESOLVED` | 24 IDs and broad assertions exist, but exact provider/evidence snapshots and negative queries are incomplete |
| `WP2AR4-P3-1` endpoint failed | `PARTIALLY RESOLVED` | `FAILED` state exists, but transition ownership/evidence is not expressed as a constraint |
| `WP2AR4-P3-2` capability child ownership | `PARTIALLY RESOLVED` | gate ownership is stated, but exact insert grants/FKs/transaction are not complete |

## 7. P3 Findings

### WP2AR5-P3-01 — `StorageUploadActionEvidence` Naming Is Ambiguous

The common base uses `uploadActionId`, while the subtype repeats
`uploadActionId` and `uploadSessionId`. The model should specify whether both
are FK snapshots and which one is canonical.

### WP2AR5-P3-02 — `StorageProviderEffect` Uses `objectVersionId` but Some Effect Types Are Not Object Versions

The model allows effects such as `ROLLBACK_COPY`, `DELETE` and
`CONFLICT_CLEANUP`; the null/identity rule for non-object effects is stated
only indirectly. Add an explicit effect-kind/NULL matrix.

## 8. Database Constraint Audit

### 8.1 Unique Constraints

The following require explicit parent anchors or are not fully defined:

| Relationship | Required parent anchor | D4 result |
|---|---|---|
| Effect object version | `ObjectVersion(id,allocationId)` | absent in field list |
| Part checkpoint action | `UploadAction(id,uploadSessionId)` | only triple including actionType listed |
| Action slot pointer | `UploadAction(id,uploadSessionId)` | no FK stated |
| Representation active pointer | `Attempt(slotId,id)` | no FK stated |
| Operation active claim | `Claim(id,operationId,generation)` | claimed in prose, not fully listed in all consumers |
| FileVersion origin attempt | `Attempt(slotId,id,backendKind)` | parent anchor present, consumer proof still partial |

### 8.2 NULL/Composite FK Risks

D4 uses nullable effect, action, representation and incident fields. Without
typed subtype CHECKs and `MATCH` semantics specified, a partial NULL tuple can
evade a composite FK. The D4 global matrix is helpful but does not supply the
exact SQL CHECK for every subtype.

### 8.3 Transaction/CAS

The proposed CAS examples are directionally correct, but:

- missing pointer FKs can allow a row pointer to another aggregate;
- effect/action update does not always include `effectId` or current lease;
- `StorageProviderUploadAction` does not include providerEffectId;
- action result can exist without effect identity;
- active claim/lifecycle/operation tuple needs deferred trigger equivalence.

### 8.4 Permissions

D4 describes owner, session, producer and Finalizer boundaries, but the
complete DML grant matrix is still described rather than tabulated per table.
An implementation could accidentally leave direct INSERT/UPDATE paths on the
new Evidence/action/representation tables.

## 9. Fourteen Typed Evidence Review

| Evidence type | Independent status | Missing exactness |
|---|---|---|
| Authorization | `PARTIAL` | producer/session FK defined; operation/claim snapshot consistency needs explicit check |
| Provider Operation | `PARTIAL` | providerEffectId and action/attempt mutual exclusivity not exact |
| Provider Outcome | `PARTIAL` | effect/attempt/action parent exact FK not listed |
| Readback | `PARTIAL` | scope/endpoint/key/token/hash fields listed, but per-type CHECK/SQLSTATE absent |
| Upload Action | `PARTIAL` | action/session/effect consistency not fully constrained |
| Migration Copy | `PARTIAL` | source/target representation/attempt FKs listed only conceptually |
| Migration Readback | `PARTIAL` | exact source/target representation keys missing |
| Representation | `PARTIAL` | target family checks and unique anchors incomplete |
| Delete Result | `PARTIAL` | target/provider exact version and effect relation incomplete |
| Delete Readback | `PARTIAL` | exact-version/absence relation needs typed FK/CHECK |
| Provider Audit | `PARTIAL` | base/subtype object fields can disagree; principal/request correlation incomplete |
| Manifest Revocation | `PARTIAL` | revocation/base operation/root correlation not exact |
| Integrity Incident | `PARTIAL` | target representation/version fields require typed relationship |
| Quarantine Release | `PARTIAL` | release evidence and incident state transition not exact |

The common canonical digest rule is directionally sound, but no database
verification primitive is present in current source; D4 correctly marks this
as a deployment blocker.

## 10. Sixteen Race Specification Review

| D4 ID | Result | Independent finding |
|---|---|---|
| `D4-X-01` | partial | exact rowcounts/session fixture values not complete |
| `D4-X-02` | partial | old effect/action/effect FK missing from executable model |
| `D4-X-03` | partial | provider version/evidence final rows not fully fixed |
| `D4-X-04` | partial | response-loss adoption conflict with aggregate state |
| `D4-X-05` | partial | action/effect identity link missing |
| `D4-X-06` | partial | action slot pointer lacks exact FK |
| `D4-X-07` | partial | post-acceptance quarantine/transition assertion missing |
| `D4-X-08` | partial | custody owner digest transition not fully constrained |
| `D4-X-09` | partial | migration target anchors incomplete |
| `D4-X-10` | partial | lock plan key materialization not fully specified |
| `D4-X-11` | valid direction | fallback failure is safe, exact fixture still partial |
| `D4-X-12` | partial | revocation/effect late path needs exact epoch fields |
| `D4-X-13` | partial | root overlap assertions not fully fixed |
| `D4-X-14` | partial | cleanup/readback quarantine in-flight race |
| `D4-X-15` | valid direction | Evidence-only no-publication conceptually correct |
| `D4-X-16` | partial | finalizer idempotency and rowcounts need exact rows |

No scenario is test-verified.

## 11. Twenty-Four Vector Review

| Vector | Result | Gap |
|---|---|---|
| `D4-FV-01` | partial | no exact alias/observation replay values |
| `D4-FV-02` | partial | no exact lifecycle/operation IDs |
| `D4-FV-03` | partial | no full negative fixture |
| `D4-FV-04` | partial | no exact canonical binding state |
| `D4-FV-05` | partial | initiation correlation row not fixed |
| `D4-FV-06` | partial | action/effect link absent |
| `D4-FV-07` | partial | action-slot FK and timing values missing |
| `D4-FV-08` | partial | exact claim rows/rows counts not fixed |
| `D4-FV-09` | partial | custody owner digest not fully constrained |
| `D4-FV-10` | partial | exact close/Evidence rows not fixed |
| `D4-FV-11` | partial | response-loss source effect rows incomplete |
| `D4-FV-12` | partial | migration target tuple incomplete |
| `D4-FV-13` | partial | conflict/quarantine final rows incomplete |
| `D4-FV-14` | partial | legacy representation exact values missing |
| `D4-FV-15` | partial | fallback slot/attempt rows not fixed |
| `D4-FV-16` | partial | failed attempt generation/evidence rows not fixed |
| `D4-FV-17` | partial | dual-read quarantine/read lease values missing |
| `D4-FV-18` | partial | revocation/trust epoch fields not fixed |
| `D4-FV-19` | partial | root overlap timestamps not fixed |
| `D4-FV-20` | partial | cleanup/finalizer three-way fixtures absent |
| `D4-FV-21` | partial | finalizer acceptance/evidence exact rows incomplete |
| `D4-FV-22` | partial | routing epoch/reader rows not fixed |
| `D4-FV-23` | partial | version identity NULL matrix not exact |
| `D4-FV-24` | partial | audit missing/profile policy values not fixed |

## 12. Twelve Additional XT Review

| Test | Result | Finding |
|---|---|---|
| `D4-XT-01` | partial | stale exact adoption authority state still conflicted |
| `D4-XT-02` | partial | action/effect link and request digest not executable |
| `D4-XT-03` | partial | retry representation exact slot/attempt model incomplete |
| `D4-XT-04` | partial | incident/quarantine mutable state/event model missing |
| `D4-XT-05` | partial | subtype cross-reference constraints incomplete |
| `D4-XT-06` | partial | digest recomputation implementation path unspecified |
| `D4-XT-07` | partial | revocation epoch fields on action/effect missing |
| `D4-XT-08` | partial | cleanup already-dispatched quarantined object race |
| `D4-XT-09` | partial | rollback source race/in-flight read handling |
| `D4-XT-10` | valid direction | source slot concept sound; exact rowcounts incomplete |
| `D4-XT-11` | valid direction | endpoint candidate unit missing exact lock plan |
| `D4-XT-12` | partial | lock key set discovery test still symbolic |

## 13. Cross-Protocol Attack Results

### 13.1 Stale Worker + Response Loss

The intended D4 path is:

```text
old C7 -> exact effect E7 -> current C8 -> Finalizer acceptance
```

It is not fully closed because:

- C7's effect cannot be linked to the Action Ledger;
- aggregate claim/effect state values are not fully authoritatively defined;
- the current Finalizer acceptance has no exact effect/action relation in all
  subtype contracts.

A stale Worker may therefore create an action/effect lineage that cannot be
distinguished from a current Worker's lineage.

### 13.2 Cleanup vs Quarantine

The preselect check works. The already-dispatched Provider DELETE window does
not. The locked DB step and the external Provider call are separated; a
quarantine committed after dispatch cannot recall the Provider request.

### 13.3 Representation Retry

Slot/attempt generation is the right direction, but active pointers and
per-attempt exact FKs need explicit parent uniqueness. Cleanup must retain
failed attempts until their required evidence is resolved.

## 14. Cross-Stage Status

```text
R5 57 Open Decisions:
  OPEN

BV7:
  FAIL

BV8:
  NOT INDEPENDENTLY APPROVED

R8:
  BLOCKED

Old upload chain / P1-3 integration:
  NOT IMPLEMENTED

Provider/account/region/credentials/IAM:
  NOT VERIFIED

Trust root:
  NOT VERIFIED

Historical object inventory:
  NOT VERIFIED
```

P2-05 cost/degraded-read policy remains OPEN; no business choice is made here.

## 15. Isolated Validation Admission

Current:

```text
NOT ADMITTED
```

Minimum before re-review:

1. Add `StorageProviderUploadAction.providerEffectId` and exact Effect FK.
2. Add all missing parent unique anchors and active pointer FKs.
3. Define canonical `requestDigest` inputs and algorithm.
4. Add quarantine epoch to representation/action/effect, and fence
   already-dispatched cleanup/rollback.
5. Complete per-subtype Evidence FK/CHECK/null contracts.
6. Materialize all 16/24/12 tests with exact fixtures, SQL steps and assertion
   rowcounts.
7. Re-run independent review.

Provider/account/trust and business policies remain independently blocking.

## 16. Git and Integrity

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
  30
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
  31
```

This review adds one untracked report. The report SHA-256 is emitted as final
delivery metadata after the bytes are frozen.

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

## 17. Final Verdict

```text
WP-2A-R5:
  FAIL — DESIGN CORRECTIONS REQUIRED

P0:
  0

P1:
  6

P2:
  5

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
  WP-2A-D5 DESIGN CORRECTIONS ONLY
```
