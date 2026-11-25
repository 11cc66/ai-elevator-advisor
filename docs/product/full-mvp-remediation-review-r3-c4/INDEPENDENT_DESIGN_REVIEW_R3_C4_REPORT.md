# FULL-MVP-REMEDIATION-REVIEW-R3-C4

## Independent Design Review Report

Date: 2026-11-24

Project root: `D:\thinkbook\Desktop\jieya`

Review mode: independent, read-only, adversarial design review.

## 1. Executive Conclusion

```text
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
P0: 0
P1: 4
P2: 6
P3: 1
```

R3-C4 repairs the original ProfessionalReviewEvent parent-key mismatch. The
six-column Event owner key, Event-to-Review FK, and FieldValue-to-Event FK now
have matching column sets.

R3-C4 does not close the second original P1. Snapshot Registry `stableKey`
values remain ordinary colon concatenations. `PRICE:candidateId:priceRevisionId`
can collide for legitimate text IDs such as `(a:b, c)` and `(a, b:c)`.

The delivered full Basis vector is also internally inconsistent. Independent
Node.js and Python construction from the stated semantic records produces:

```text
length = 2350
SHA-256 = 8C88E3F0EE8480AD78373375E737555B932CFF4CECB89E152A688D73E8A234E2
```

The Basis hex actually embedded in `R3_BASIS_V4_FIXED_VECTORS.md` has length
2350 but hashes to:

```text
4874A5E512C53EBF4C480577C03DBB8FAE1CE7F0C582B414DC3D8DA4A0C2E262
```

It encodes both Requirement Field records as record type `0x0000`, so the
delivered known-answer bytes cannot be the bytes represented by the table.

The normalized child schema cannot produce several fields required by the
Registry and full vector. `SalesSnapshotSource` has no `sourceKind`;
`SalesSnapshotCatalogReview` has neither `targetRevisionId` nor
`policyRevisionId`; `SalesSnapshotWarning` has no structured
`warningSequence`. The declared canonical child rows therefore cannot serve as
the sole authority for the claimed Basis.

The Event-only security design grants a `SECURITY DEFINER` transition function
but takes `p_actor_id` and `p_new_state` from the caller. It does not bind the
actor to `current_user`/an authenticated principal, does not show the allowed
transition matrix, and does not bind `actor_authority_id` to an authority
record. A granted reviewer can therefore forge actor attribution unless the
omitted function body adds unspecified controls.

No implementation authorization is granted.

## 2. Scope and Independence

Reviewed:

- all 16 files in `docs/product/full-mvp-remediation-design-r3-c4/`;
- the C4 checksum manifest;
- R3-C3 independent findings and verification reports;
- retained R2/R3/R3-C2/R3-C3 Open Decisions;
- current Git status and whether any C4-named implementation exists.

Not performed:

- source, Schema, Migration, test, configuration or lockfile modification;
- PostgreSQL connection, SQL, migration, seed or reset;
- Prisma DB command;
- test, Build, Worker, E2E, Native RPC, Storage or Runtime execution;
- Git add/commit/reset/restore/clean/checkout/stash;
- ACL, Registry, Service, PFR or `$null` content access.

Database behavior remains `NOT VERIFIED — DATABASE NOT ACCESSED`.
Runtime behavior remains `NOT EXECUTED`.

## 3. Skills Read

The following project Skills were read in full:

- `$security-audit`;
- `$prisma-db-safety`;
- `$testing-and-verification`;
- `$project-architecture`;
- `$file-lifecycle`;
- `security-audit/references/adversarial-review.md`;
- `prisma-db-safety/references/database-change-review.md`.

## 4. Shell and Worktree

Verified actual process:

```text
Executable:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

PowerShell: 7.6.9
FileVersion: 7.6.9.500
PID: 17724
Parent PID: 27624
Parent: codex.exe
Parent executable:
C:\Program Files\WindowsApps\OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0\app\resources\codex.exe
```

No CMD/Bash wrapper was used for path construction, and no error-output
redirection was used.

Starting worktree:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Staged: 0
Deleted: 0
```

The ending snapshot is recorded in section 15.

## 5. Input Integrity

Manifest:

```text
SHA-256: 347EB6515BB910C4C1AE22319655BC078D7130CCBC832E2D55420827B9DD778B
Bytes: 2597
Lines: 16
Records checked: 16
Mismatches: 0
```

| Input | Bytes | Lines | SHA-256 | Result |
|---|---:|---:|---|---|
| `P1_PRODUCT_REMEDIATION_DESIGN_R3_C4.md` | 11806 | 361 | `B964C3B4D7730D9CD553577E8BC081B301F560520FC170974F97161EB4276BA6` | MATCH |
| `P1_PRODUCT_REMEDIATION_TRACEABILITY_R3_C4.md` | 3264 | 66 | `ADDA48B994AAFDBC1252B275F34388719A907CED640022978C08B1D85E67BDB7` | MATCH |
| `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3_C4.md` | 5746 | 107 | `A39457269B23D0B30CB2B9535BAD9BC5FAB1214599CE593D41AAEA8AFCFB6431` | MATCH |
| `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R3_C4.md` | 3205 | 84 | `9C4876171D5310A57490D87B15E54A84E395D3F7F345673758AE40ABF97C9978` | MATCH |
| `P1_PRODUCT_REMEDIATION_R3_C4_CHANGELOG.md` | 2173 | 70 | `F9DBD35B4A78DCA8FF2F58E89417282AD30408C01BF32DC18130215B9FF231C5` | MATCH |
| `PROFESSIONAL_REVIEW_COMPOSITE_FK_DESIGN_R3_C4.md` | 6529 | 188 | `A51097C973B9FAB221F811A26B6A23906775EB59E3DAE38D52F3BD14F4D24A21` | MATCH |
| `SNAPSHOT_REGISTRY_R1.md` | 5790 | 183 | `7B1D430F4595696B8F6593D594345E3F627C5AE6697C81894268098E7CE744C0` | MATCH |
| `SNAPSHOT_NORMALIZED_CHILD_SCHEMA_R1.md` | 6007 | 214 | `8FA87C2874B98FFD956C694E4AC9499530C5778720E7EDFB8BDF9DD7D3C67339` | MATCH |
| `SNAPSHOT_DEFERRED_VALIDATION_CONTRACT_R1.md` | 3410 | 98 | `4DB8D691B9D20119EC62E8F5B5F050C2E4532BFFD9A42E0C7678D221F8743001` | MATCH |
| `R3_BASIS_V4_PROTOCOL_AND_VECTOR_SPEC.md` | 3065 | 117 | `06EEB5B8E309D6331B75F9B5D1DFE3097899318C80A99E9F0BDE64D09C8E557A` | MATCH |
| `R3_BASIS_V4_FIXED_VECTORS.md` | 7482 | 86 | `74957D1827EC8F7BBAF39FCB2F573AC7B6BB5D3FDC1EEFD9E713CB3690220465` | MATCH |
| `R3_BASIS_V4_INDEPENDENT_REPRODUCTION.md` | 1961 | 76 | `274BA520C511B114BD915F04DECC001267C62039BE583EB34B48FBCCFC4D852B` | MATCH |
| `TYPED_FIELD_CATALOGUE_R1.md` | 3977 | 68 | `A7E6E617F13AC06BC7D1EDA053273278B54D555974F6E77AE9B5EDD95F068126` | MATCH |
| `LEGACY_JSON_TYPED_MIGRATION_MAP_R1.md` | 4085 | 98 | `9BBD2C1F7AF7B8EA79F77E225BEB3EE0CAFE0D026B7B7ECBE096118ECBBA9F2E` | MATCH |
| `EVENT_ONLY_DATABASE_PRIVILEGE_DESIGN_R1.md` | 4137 | 125 | `2483F85D635A7D9646BBA2D7C0631A9B7D7DE399910DCAFE8B2017EB07FB8C6C` | MATCH |
| `CANONICAL_SOURCE_IDENTITY_R2.md` | 2523 | 79 | `2D6C379FF4046B28AB85ECDBC576720D6643FBE8A1E3F8F0B64F203DEA669629` | MATCH |

## 6. Original P1 Findings

| Original finding | Result | Basis |
|---|---|---|
| `REV-R3-C3-P1-01` ProfessionalReviewEvent parent mismatch | `RESOLVED` | Exact six-column Event UNIQUE now exists and matches both Event-to-Review and FieldValue-to-Event column sets. |
| `REV-R3-C3-P1-02` missing actual Registry and ambiguous stableKey | `NOT RESOLVED` | Registry exists, but multi-ID stable keys remain ordinary colon concatenation and can collide. |

## 7. Eight Review Areas

### 7.1 ProfessionalReview Composite FK

`PASS`

Exact Event parent key:

```text
(id, project_id, conversation_id, requirement_id,
 requirement_version_id, installation_scenario)
```

Event-to-Review and FieldValue-to-Event each use that exact set in the same
order. All six owner columns are `NOT NULL`; the optional professional source
ID must be non-null through the retained C3 source-kind CHECK.

PostgreSQL runtime enforcement is not executed. The static key match is valid.

Residual P2: Event `policy_revision_id` still lacks a policy FK and the shown
constraint named `policy_matches_review` only checks `IS NOT NULL`.

### 7.2 Snapshot Registry R1

`FAIL`

All ten record types and field tags are present. The stable-key construction is
not tuple-safe:

```text
PRICE:a:b:c

candidateId = "a:b", priceRevisionId = "c"
candidateId = "a",   priceRevisionId = "b:c"
```

Both components are canonical text IDs that may contain `:`. Both map to one
`(recordType, stableKey)`, causing a valid Snapshot to be rejected as a
duplicate or making an unregistered tuple encoding necessary in implementation.

The Registry also says misordered field tags are rejected before canonical
sorting, while the protocol says input order must not affect output and the
test plan requires reversed input to produce the same Basis.

### 7.3 Snapshot Normalized Schema

`FAIL`

The normalized schema is not field-complete against the Registry:

- Registry Source Revision tag 4 `sourceKind` has no
  `SalesSnapshotSource.sourceKind`;
- Registry Catalog Review tags 2–3 `targetRevisionId` and
  `policyRevisionId` have no corresponding columns;
- Registry Warning stable key uses `warningSequence`, but the row has no
  structured sequence column.

It also does not serialize `sourceFieldValueId`, `sourceEntityType`,
`sourceAuxId` or `sourceKey` in the Requirement Field record, although
`CANONICAL_SOURCE_IDENTITY_R2.md` says `sourceKey` participates in the Basis.

The design therefore cannot derive the claimed complete Basis solely from the
declared canonical child rows.

### 7.4 Deferred Validation

`FAIL`

The transaction order and case-row lock are directionally sound. The contract
cannot be accepted as complete because:

- exact constraint-trigger DDL is absent;
- the stated trigger events are only `AFTER INSERT/UPDATE` on child tables, not
  `DELETE` and not the Header `DRAFT -> FINALIZED` transition;
- trigger owner, function privileges, fixed `search_path`, and direct-call
  denial are not specified;
- the trigger is asked to validate fields that the normalized rows do not
  store;
- many parent/source relationships are prose checks rather than declared FKs
  on the Snapshot tables.

Database enforcement remains `NOT VERIFIED — DATABASE NOT ACCESSED`.

### 7.5 R3-BASIS V4

`FAIL`

Both independent encoders generated 2350 bytes and the expected hash for the
semantic records. The delivered complete Basis hex does not match its own
declared hash. Its second and third records are record type `0`, but the table
declares them Requirement Field records of type `1`.

This is not a harmless documentation hash typo: the delivered bytes are an
invalid known-answer vector.

### 7.6 Typed Field Catalogue

`PASS`

The R1 catalogue defines field IDs, scalar/SQL types, units, basic ranges,
nullability and source classes. Unknown keys, units and values are rejected by
design.

Residual P2: obvious cross-field invariants such as `budgetMin <= budgetMax`
are not defined, and exact source-kind enum names are abbreviated. Engineering
authority remains an Open Decision.

### 7.7 Legacy JSON Mapping

`PASS`

The mapping includes each current legacy field path, explicit conversions,
quarantine categories, conflict rules, atomicity and no-default behavior.

Residual P2: `trim` and Unicode normalization are labelled lossless without
distinguishing semantic equivalence from byte-for-byte preservation.

### 7.8 Canonical Source Identity

`PASS`

Structured source columns plus a length-prefixed derived key remove the original
delimiter-parsing dependency. Typed source FKs, not `sourceKey`, remain the
ownership proof.

Residual P2: the specification says components are limited to 64 ASCII bytes
while claiming to test Unicode/NFC. It must distinguish ASCII canonical IDs
from UTF-8 auxiliary text or constrain the field accordingly.

### 7.9 Event-only Permissions

`FAIL`

The ordinary table DML revokes and PUBLIC execute revoke are useful, but they
do not complete the event-only security boundary.

The transition signature accepts:

```text
p_actor_id
p_new_state
p_policy_revision_id
```

from the caller. No rule binds `p_actor_id` to the authenticated DB session or
to an authority mapping. A granted reviewer can therefore submit another user's
ID and an arbitrary requested state unless an unimplemented function body adds
the missing restriction.

Schema `USAGE/CREATE`, default privileges, sequence grants, function-owner
assignment, role membership/inheritance and all trigger-function execute
reviews are also unspecified.

## 8. Independent Basis Evidence

Independent construction from the written protocol and Registry:

| Implementation | Length | SHA-256 | Record lengths |
|---|---:|---|---|
| Node.js | 2350 | `8C88E3F0EE8480AD78373375E737555B932CFF4CECB89E152A688D73E8A234E2` | 155,155,159,208,213,145,138,148,148,167,162,125,184,105,110 |
| Python | 2350 | `8C88E3F0EE8480AD78373375E737555B932CFF4CECB89E152A688D73E8A234E2` | 155,155,159,208,213,145,138,148,148,167,162,125,184,105,110 |

The two implementations used separate standard libraries and encoders. Their
complete in-memory Basis byte streams were compared and were byte-identical.

Embedded vector check:

| Artifact | Length | SHA-256 |
|---|---:|---|
| Generated semantic Basis | 2350 | `8C88E3F0...34E2` |
| Hex in fixed-vector document | 2350 | `4874A5E5...E262` |

First difference: byte offset 188 (the second record type). The generated byte
is `0x0001`; the document contains `0x0000`.

## 9. Open Decisions

`OPEN`

All 41 retained decisions remain open:

```text
OD-R2-01 .. OD-R2-20
OD-R3-01 .. OD-R3-09
OD-R3-C2-01 .. OD-R3-C2-04
OD-R3-C3-01 .. OD-R3-C3-04
OD-R3-C4-01 .. OD-R3-C4-04
```

No Open Decision can waive stable tuple identity, the fixed Basis bytes,
normalized-data completeness, exact FKs, or actor/state authorization.

## 10. Implementation Blocker Matrix

| Capability | State | Blocker |
|---|---|---|
| ProfessionalReview source FK | `DESIGNED / STATIC PASS` | Separate Schema authorization; policy-equality trigger still required |
| Snapshot Registry R1 | `BLOCKED` | Stable tuple encoder and collision fixtures |
| Snapshot normalized tables | `BLOCKED` | Registry/schema field reconciliation and exact FKs |
| Snapshot creation | `BLOCKED` | Valid Basis vector and deferred trigger specification |
| R3-BASIS R4 implementation | `BLOCKED` | Correct fixed vector; verifier deployment decision |
| Typed field activation | `BLOCKED_BY_OPEN_DECISION` | `OD-R3-C3-02`, `OD-R3-C4-02` |
| Legacy import | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-12`, `OD-R2-15`, `OD-R3-06` |
| Event transition functions | `BLOCKED` | Actor binding, transition matrix, exact grants/owner |
| P1-3 lifecycle | `SEPARATE WORKSTREAM` | No R3-C4 authorization |
| Demo/Production deployment | `BLOCKED` | All applicable Open Decisions and corrected design |

## 11. Verification Status

```text
Input hashes: PASS
Static key-column comparison: PASS
Node/Python semantic construction: PASS
Delivered full Basis vector: FAIL
Database constraints/triggers: NOT VERIFIED — DATABASE NOT ACCESSED
Runtime: NOT EXECUTED
Storage: NOT ACCESSED
Build/tests: NOT EXECUTED
```

## 12. Authorization

```text
IMPLEMENTATION AUTHORIZATION: NOT GRANTED
DATABASE: NOT ACCESSED
STORAGE: NOT ACCESSED
RUNTIME: NOT EXECUTED
GIT WRITES: NONE
```

R3-C5 is required for the four P1 corrections and the P2 set in the Findings
file. No Schema, Migration, source or Runtime phase may follow directly from
this report.

## 13. Ending Worktree

Ending worktree:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Staged: 0
Deleted: 0
```

The new directory is an untracked review artifact under `docs/product/`; no
existing file is modified and no Git write is performed.

