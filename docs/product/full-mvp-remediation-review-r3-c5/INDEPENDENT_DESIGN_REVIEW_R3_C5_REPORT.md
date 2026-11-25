# FULL-MVP-REMEDIATION-REVIEW-R3-C5

Date: 2026-11-24

Review mode: independent, read-only, adversarial design review.

## 1. Overall Result

```text
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
P0: 0
P1: 4
P2: 6
P3: 1
```

R3-C5 makes substantial progress:

- `SK-R2` closes the original colon-concatenation collision;
- C5-SNAP-01 independently reproduces as 3051 bytes;
- Node/Python complete bytes are identical;
- source binding now enters the Requirement Field Basis;
- schema/source fields reported by R3-C4 are added;
- Policy-inclusive Review/Event key structure is sound;
- legal state transitions are explicitly enumerated;
- all 41 historical Open Decisions and five new decisions remain open.

It is not ready for implementation because four P1 gaps remain:

1. `SOURCE_KEY_R3` permits a larger byte range than the Basis BYTES field;
2. Candidate/Parameter/Price provenance and business validity are not fully
   represented or constrained;
3. `session_user` is not bound by database-verifiable session/request
   lifecycle evidence;
4. Policy Revision approval remains a prose assertion rather than an
   executable event-only schema.

## 2. Scope and Safety

Reviewed:

- all 25 R3-C5 manifest records;
- all R3-C4 findings and prior review manifests;
- C5 protocol, registry, schema, crosswalk, deferred validation, trusted
   identity, privilege baseline, test plan and Open Decisions;
- all supplied Node/Python and verification scripts.

Not performed:

- DB connection, SQL, migration, Prisma DB command;
- Build, product tests, application launch, Native RPC or Runtime;
- Storage access;
- Git write;
- modification of R3-C5 or R3-C4 inputs.

## 3. Shell and Worktree

Verified process:

```text
Executable:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

PowerShell: 7.6.9
FileVersion: 7.6.9.500
PID: 34500
Parent PID: 27624
Parent: codex.exe
```

Starting worktree:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Staged: 0
Deleted: 0
```

Ending state is recorded in section 16.

## 4. Input Integrity

```text
R3-C5 manifest SHA-256:
40B53E7C639F9D48AB83231593B85FBCD00314B8E979220E7F9BA4A2E0799424

Manifest entries: 25
Manifest bytes: 4073
Manifest lines: 25
Record mismatches: 0

R3-C4 design manifest:
347EB6515BB910C4C1AE22319655BC078D7130CCBC832E2D55420827B9DD778B

R3-C4 review manifest:
BB96FF7A3A60B7C2AFFF0EC7DF89FC8D32DFE6C49D17ECD74B1F53EB5445FB6B

R3-C4 record mismatches: 0
```

No input file was missing, duplicated or modified.

## 5. Historical Finding Closure

```text
R3-C4 P1: RESOLVED 2/4
R3-C4 P2: RESOLVED 3/6
R3-C4 P3: RESOLVED
```

| Original Finding | Result |
|---|---|
| `REV-R3-C4-P1-01` stableKey collision | RESOLVED |
| `REV-R3-C4-P1-02` invalid Basis vector | RESOLVED by C5 fixture/vector |
| `REV-R3-C4-P1-03` Registry/schema/Basis mismatch | NOT RESOLVED |
| `REV-R3-C4-P1-04` forged actor/state | NOT RESOLVED |
| `REV-R3-C4-P2-01` Event policy equality | RESOLVED by design |
| `REV-R3-C4-P2-02` deferred validation incomplete | NOT RESOLVED |
| `REV-R3-C4-P2-03` Snapshot FKs | NOT RESOLVED |
| `REV-R3-C4-P2-04` PG privilege bypass surfaces | NOT RESOLVED |
| `REV-R3-C4-P2-05` field ordering conflict | RESOLVED |
| `REV-R3-C4-P2-06` source domain contradiction | RESOLVED |
| `REV-R3-C4-P3-01` record-count wording | RESOLVED |

## 6. SK-R2

```text
SK-R2: PASS
```

Independently verified:

- magic/version/registry/record type domain separation;
- one-byte component type and presence;
- uint16 component index/count;
- uint32 byte length;
- INT64 fixed eight-byte payload;
- exact ordered component registration;
- no stable-key digest substitution;
- 158-byte registered maximum;
- 16 adversarial categories;
- all 17 successful fixed byte strings.

Colon collision vectors are distinct. Missing is rejected before encoding.
NULL and empty have distinct byte representations, while required NULL/empty
are rejected by Registry validation.

One P3 ambiguity remains: the Registry-separation vector encodes a hypothetical
registry code 3 although the SK-R2 layout labels registry code 2 as
SNAPSHOT-R2 and unknown versions are required to reject.

## 7. SOURCE_KEY_R3

```text
SOURCE_KEY_R3: FAIL
```

The structured identity and ASCII/UTF-8 split are sound. The context-free
cases below are distinct:

```text
("a:b","c")   87 bytes
("a","b:c")   87 bytes
("a:b:c",NULL) 88 bytes
```

NFC `café` and NFD `cafe\u0301` normalize to identical source-key bytes.
Multibyte Chinese text is length-counted as UTF-8.

Critical limit contradiction:

```text
sourceKind max        64
sourceEntityType max  64
sourceEntityId max    64
sourceAuxId max      128

fixed source framing   42
maximum encoded size  362

Basis BYTES maximum   256
```

A valid SOURCE_KEY_R3 can therefore exceed the R3-BASIS byte-field limit by
106 bytes. Both supplied encoders derive the source key without enforcing the
256-byte Basis limit.

Additional P2: “printable UTF-8 NFC” auxiliary text is not checked for control
characters either.

## 8. SNAPSHOT-R2

```text
SNAPSHOT-R2: FAIL
```

The requested C4 omissions are present:

- full Requirement source binding;
- Source `sourceKind`;
- Catalog `targetRevisionId` and `policyRevisionId`;
- structured Warning `warningSequence`.

However, the Registry is not a complete business snapshot:

### Price

No field represents:

- source revision supplying the price;
- validity start/end;
- quote/region scope beyond a single `applicability` enum;
- exact immutable Price Revision relation in the normalized Schema.

Two prices with the same amount, currency, tax basis and broad applicability
but different validity/source cannot be distinguished inside the Basis.

### Parameter

`catalog_parameter_revision_id` exists in the normalized table but is absent
from the Registry, Basis and Crosswalk.

### Candidate provenance

The Candidate source FK binds candidate ID, run, ownership and rule-set revision
but excludes `productRevisionId`, `specificationRevisionId` and
`priceRevisionId`. A Snapshot Candidate may claim revisions that differ from
the immutable SelectionCandidateResult row.

### Rule set

`rule_set_revision_id` exists in the Snapshot envelope but not in the Header
Record/Basis. The Crosswalk says selected rules enter the Basis, which is not
true in the actual tag layout.

### Warning

Sequence ordering uses `sourceWarningId`, but no Registry/Schema/Basis field
stores that ID. Identical warning code/text values cannot be deterministically
reordered or audited after snapshot creation.

## 9. Normalized Schema and Crosswalk

```text
Normalized Schema: FAIL
Registry / Schema / Basis Crosswalk: FAIL
```

Strong same-Snapshot FKs are present for most child rows, and the C4 missing
fields are fixed.

Remaining schema gaps:

1. Candidate product/spec/price revisions are unconstrained text.
2. Price has no immutable price-revision or source-revision FK.
3. Parameter catalog revision is stored but not represented in Basis.
4. Snapshot `rule_set_revision_id` is not classified or serialized.
5. Deferred finalization uses an undefined `version_vector`.
6. Warning sequence source identity is absent.

These gaps mean the Crosswalk claim “every Basis field is immutable Snapshot
data or a registered derivation” and the reciprocal “every business field is
represented or explicitly excluded” both fail.

## 10. C5-SNAP-01

```text
C5-SNAP-01: PASS
Node/Python Full Bytes: IDENTICAL
```

Independent results:

```text
Record count: 15
Basis bytes: 3051
SHA-256:
83F00E53B7AC21779B2753F0640B3023E2DE6A53AFA405BC0E4C8A2FDC056FB1

Record types:
0,1,1,2,2,3,3,4,4,5,5,6,7,8,9

Node == Python == independent reviewer implementation
HEX document matches generated bytes
```

The byte pipeline is correct. This does not cure Registry/Price/Identity
semantic gaps.

## 11. Deferred Validation

```text
Deferred Validation: FAIL
```

The transaction order and lock hierarchy are directionally sound, but:

- `version_vector` is referenced without a schema column;
- child guard, TRUNCATE guard and change-dispatch function DDL are incomplete;
- `validate_snapshot_r2` body is `BEGIN ... END`;
- child/basis metadata immutability triggers are not fully declared;
- no exact proof table/trigger covers a finalization with stale Basis metadata;
- no database behavior was tested.

## 12. ProfessionalReview and Policy

```text
ProfessionalReview Composite FK: PASS
Policy-inclusive Review/Event FK: PASS
Policy Revision Binding: FAIL
```

The six-column Event ownership key remains intact, and the new seven-column
Review/policy key is structurally correct in design.

Policy lifecycle is incomplete:

- no `PolicyReviewEvent` table DDL;
- no author/approver columns or FKs;
- no event sequence/state/CAS constraints;
- no immutable content digest relationship;
- no current-effective-policy view;
- no privilege baseline for policy tables;
- “only effective after policy event” remains prose.

## 13. Trusted Principal and Authority

```text
Trusted Principal: BLOCKED
AuthorityGrant: PASS
Closed Transition Matrix: PASS
```

The command matrix is closed, and caller-supplied actor/new-state parameters
are removed.

The database still has no verifiable session instance:

- `TrustedPrincipal` is principal-level, not session-level;
- there is no assertion ID, login epoch, DB backend/session ID, or session
  expiry/revocation record visible to the function;
- after application logout, an already-open principal-bound connection remains
  accepted until the principal row is revoked;
- broker session binding/replay protection is an external promise, not a
  database-checkable design.

`AuthorityGrant` scope/validity is well modeled, but activation/revocation must
not become arbitrary UPDATE. The privilege baseline does not cover this table.

## 14. PostgreSQL Privilege Baseline

```text
PostgreSQL Owner / Role / Privilege: FAIL
```

Positive controls:

- PUBLIC table/function revokes;
- non-login owner roles;
- no runtime owner membership;
- fixed search path;
- no dynamic SQL;
- trigger function execute revokes;
- explicit TRUNCATE strategy.

Incomplete:

- no exact `CREATE ROLE` / `ALTER ROLE` / membership DDL;
- `trusted_principal`, `authority_grant`, policy revision and PolicyReviewEvent
  objects are absent from the protected-table matrix;
- view definitions, owners and `security_barrier` are absent;
- table/trigger/function owner assignment is mostly prose;
- default privilege reset is shown only for migrator;
- per-principal role provisioning and connection cleanup are unspecified;
- no exact object inventory ties every protected table/function to a grant.

## 15. Open Decisions

```text
Historical Open Decisions: 41 PRESENT / 0 APPROVED / 41 OPEN
R3-C5 Open Decisions: 5 PRESENT / 0 APPROVED / 5 OPEN
```

The five C5 decisions correctly identify:

- trusted identity/session broker;
- R2/R5 rollout;
- source-key persistence;
- reviewer/approver separation;
- break-glass administration.

No Open Decision is marked approved.

## 16. End Worktree

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Staged: 0
Deleted: 0
```

Only the independent review directory is added; no design or project file is
modified.

## 17. Authorization

```text
FULL-MVP-REMEDIATION-REVIEW-R3-C5

Overall:
FAIL — DESIGN CORRECTIONS REQUIRED

P0: 0
P1: 4
P2: 6
P3: 1

R3-C4 P1:
RESOLVED 2/4

R3-C4 P2:
RESOLVED 3/6

R3-C4 P3:
RESOLVED

SK-R2:
PASS

SOURCE_KEY_R3:
FAIL

SNAPSHOT-R2:
FAIL

Normalized Schema:
FAIL

Registry / Schema / Basis Crosswalk:
FAIL

ProfessionalReview Composite FK:
PASS

Policy-inclusive Review/Event FK:
PASS

C5-SNAP-01:
PASS

Node/Python Full Bytes:
IDENTICAL

Deferred Validation:
FAIL

Trusted Principal:
BLOCKED

AuthorityGrant:
PASS

Closed Transition Matrix:
PASS

Policy Revision Binding:
FAIL

PostgreSQL Owner / Role / Privilege:
FAIL

Historical Open Decisions:
41 PRESENT / 41 OPEN / NO APPROVALS

R3-C5 Open Decisions:
5 PRESENT / 5 OPEN / NO APPROVALS

IMPLEMENTATION AUTHORIZATION: NOT GRANTED
SCHEMA AUTHORIZATION: NOT GRANTED
MIGRATION AUTHORIZATION: NOT GRANTED
DATABASE AUTHORIZATION: NOT GRANTED
RUNTIME AUTHORIZATION: NOT GRANTED
PRODUCTION AUTHORIZATION: NOT GRANTED
GIT WRITES: NONE
```

