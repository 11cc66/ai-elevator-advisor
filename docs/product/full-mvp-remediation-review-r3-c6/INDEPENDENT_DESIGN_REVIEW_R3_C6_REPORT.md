# FULL-MVP-REMEDIATION-REVIEW-R3-C6

Date: 2026-11-24

Review mode: independent, read-only, adversarial.

## 1. Overall Result

```text
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
P0: 0
P1: 4
P2: 6
P3: 0
```

R3-C6 materially improves R3-C5:

- SourceKey 362 / R6 BYTES 512 are consistently specified;
- C6-SNAP-01 is byte-identical across three implementations;
- SK-R2 code-3 vectors pass;
- Candidate, Parameter, Price and RuleSet fields are added to Registry/Basis;
- TrustedSession carries session, epoch, expiry and revocation semantics;
- PolicyRevision/PolicyReviewEvent schemas are introduced;
- Warning source ID is now present.

The design is not implementation-ready because:

1. Snapshot root and Selection provenance relationships remain largely prose
   rather than actual FKs.
2. Snapshot creation/validation calls several undefined functions.
3. TrustedSession revocation can race a transition because the session row is
   not locked.
4. Policy content/digest are not cryptographically bound, and Event/Review DDL
   still references undefined columns/functions.

## 2. Input and Shell

Shell:

```text
PowerShell: 7.6.9
FileVersion: 7.6.9.500
Executable:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
PID: 35616
Parent PID: 27624
Parent: codex.exe
```

Python bytecode writes were disabled with `python -B` and
`PYTHONDONTWRITEBYTECODE=1`.

C6 manifest:

```text
SHA-256: 905D062BC424BF8B76AFAA4D8D078474528FB609817E635604FD31CC77D0DBFC
Bytes: 7940
Lines: 48
Records: 48
Mismatches: 0
```

Historical manifests:

```text
R3-C5 design: 40B53E7C639F9D48AB83231593B85FBCD00314B8E979220E7F9BA4A2E0799424
R3-C5 review: 275A53455A8AD5A03FAC6E52271A54421442A78912A35147CB6013B02E57D0CC
R3-C4 design: 347EB6515BB910C4C1AE22319655BC078D7130CCBC832E2D55420827B9DD778B
R3-C4 review: BB96FF7A3A60B7C2AFFF0EC7DF89FC8D32DFE6C49D17ECD74B1F53EB5445FB6B
```

Only historical drift is the generated C5 `.pyc`; see section 10.

## 3. Historical Closure

```text
R3-C4 Historical Findings: RESOLVED 6/11
R3-C5 P1: RESOLVED 1/4
R3-C5 P2: RESOLVED 4/6
R3-C5 P3: RESOLVED
```

R3-C4 P1-03 and P1-04, plus R3-C5 provenance/policy/session-DDL findings,
remain unresolved.

## 4. SourceKey and R6

```text
SOURCE_KEY_R3: PASS
SOURCE_KEY 362-byte limit: PASS
R6 BYTES 512-byte limit: PASS
Node/Python length enforcement: PASS (static and valid-vector)
```

Independent calculation:

```text
8-byte prefix
+ 32-byte component framing
+ 64 + 64 + 64 + 128 payload bytes
+ 2-byte terminator
= 362 bytes
```

The registered sample reaches 275 bytes; the theoretical domain reaches 362.
Node/Python reject auxiliary >128 and full SourceKey >362. R6 permits 512.

The boundary script reports max+1 but does not execute a 363-byte rejection
through both encoders; this is a P2 evidence gap, not a source-format defect.

## 5. Selection Provenance

```text
SELECTION PROVENANCE: FAIL
CANDIDATE BINDING: FAIL
PARAMETER PROVENANCE: FAIL
PRICE PROVENANCE: FAIL
RULESET BASIS BINDING: PASS
```

Strong conceptual identities exist, but the normalized schema's root tables do
not contain the corresponding foreign keys:

- Snapshot Header has no FK to Case, RequirementVersion or SelectionRun.
- SelectionRun has no FKs to RequirementVersion or RuleSetRevision.
- SelectionCandidateResult has no FKs to SelectionRun, Product Revision,
  Specification Revision, Price Revision or RuleSet Revision.
- Candidate/Parameter/Price child tables are prose column lists, not executable
  `CREATE TABLE` plus exact FKs.

`create_snapshot_r3` accepts Case and RequirementVersion as caller parameters
and does not compare RequirementVersion to `v_run`. A Snapshot can therefore
label a valid run with another requirement version unless an omitted check
prevents it.

RuleSet ID/digest are correctly present in Header Basis tags 9–10.

## 6. Snapshot / Registry / Basis

```text
SK-R2 / Registry Code 3: PASS
SNAPSHOT-R3: FAIL
Registry / Schema / Basis: FAIL
C6-SNAP-01: PASS
Node/Python Full Bytes: IDENTICAL
Warning Identity / Ordering: PASS
```

C6-SNAP-01:

```text
15 records
4036 bytes
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
```

The vector contains all new RuleSet, Candidate, Parameter, Price, Warning and
Missing Field tags. A third independent Python implementation produced the same
bytes and hash.

The vector proves encoding, not the missing database constraints.

## 7. Scalar Validation

```text
R6 Scalar Validation: PASS (static)
Node/Python Accept-Reject Parity: BLOCKED (negative vectors not executed)
```

Both supplied encoders contain the required checks for:

- strict Boolean;
- INT64 range;
- canonical decimal grammar/precision;
- NFC and 4,000-scalar TEXT;
- ASCII ID/key limits;
- BYTES 512 and SourceKey 362;
- auxiliary control characters;
- exact record/field inventory.

The reject-vector file is not executed by either encoder; this is a P2 evidence
gap.

## 8. TrustedSession

```text
TrustedSession: FAIL
Session Expiry / Revocation: FAIL
Old Connection Protection: FAIL
```

The normal-state design correctly binds a per-session login role to a
TrustedSession row and checks expiry/revocation. The current privilege design
also makes `elevator_identity_broker` a login role.

Blocking race:

```text
Transition: require_active_session -> plain SELECT, no row lock
Concurrent revoke: UPDATE trusted_session SET REVOKED
Transition: inserts event and commits
```

The transition can observe ACTIVE, then revocation commits, then the transition
commits its sensitive event. This contradicts “no transition after revoke
commit.” The session and principal epoch rows must be locked `FOR SHARE`, with
revoke/epoch change taking `FOR UPDATE`, and the final transaction state must
be checked before event insert/commit.

## 9. Policy Lifecycle

```text
PolicyRevision: FAIL
PolicyReviewEvent: FAIL
Author / Approver Separation: PASS
```

The state matrix and author/approver separation are well defined. However:

- `create_policy_revision` accepts `p_content` and `p_content_digest` from the
  caller and never proves the digest matches content.
- `policy_revision` has no immutable-content trigger.
- `policy_review_event` has no append-only trigger DDL.
- `current_policy_revision_v` returns the latest event regardless of whether it
  is APPROVED/INVALIDATED/EXPIRED, and has no policy authority/project filter.
- `policy_is_effective` is called by ProfessionalReview but is not defined.

An author can create content/digest disagreement and the approval event binds an
identifier rather than verified content.

## 10. Deferred Validation and ProfessionalReview DDL

```text
Deferred Validation: FAIL
ProfessionalReview Composite FK: PASS (inherited structure)
Policy-inclusive Review/Event FK: PASS (design)
```

The `mutation_version` column and CAS are now correctly defined.

But the implementation calls undefined objects:

```text
app.build_snapshot_basis_r6
app.verify_snapshot_basis_r6
app.snapshot_record_count
app_private.current_principal_id
app_private.materialize_snapshot_*
app_private.require_no_active_snapshot_children_r3
app.policy_is_effective
```

The ProfessionalReview transition inserts `created_by_principal_id`,
`actor_principal_id`, `actor_authority_grant_id` and `review_audit` fields that
are not defined in the reviewed schema. The exact runtime grant signatures for
the policy/professional transition functions also do not match their declared
argument counts. These DDLs cannot be applied as a complete design.

## 11. PostgreSQL Privileges

```text
PostgreSQL Owner / Role / Privilege: FAIL
```

The matrix now lists important objects and views. Missing/incomplete:

- exact per-table/function GRANT/REVOKE statements for every auth/policy/session
  object;
- corrected function signatures in the runtime grant section;
- DDL for `current_sales_snapshot_v`, audit views and undefined
  `has_project_authority`;
- policy effective-view semantics and authorization;
- exact trigger-function ownership and append-only trigger definitions;
- default privileges for every creator.

## 12. Python Cache Baseline

```text
C5 Python Cache Baseline Exception: ACCEPT AS NON-SEMANTIC GENERATED CACHE
```

Evidence:

- the C5 review manifest records the historical cache hash;
- only the `.pyc` mismatches;
- current `.pyc` header source mtime/size exactly match the unchanged source;
- source SHA-256 remains
  `92383447283C3C18C27AFDB402FB45CD3398679CD2E58DDAA920E12F4A45A19D`;
- all C5 design reports, review reports and vectors match;
- the cache was not used as an authoritative input;
- this review ran Python with no-bytecode-write mode.

Acceptance applies only to this generated cache. The C5 manifest remains
unchanged and future authoritative manifests must exclude `__pycache__`.

## 13. Open Decisions

```text
Existing: 46 PRESENT / 46 OPEN
R3-C6: 5 PRESENT / 5 OPEN
```

No approval evidence exists.

## 14. Final Status

```text
FULL-MVP-REMEDIATION-REVIEW-R3-C6

Overall:
FAIL — DESIGN CORRECTIONS REQUIRED

P0: 0
P1: 4
P2: 6
P3: 0

R3-C4 Historical Findings:
RESOLVED 6/11

R3-C5 P1:
RESOLVED 1/4

R3-C5 P2:
RESOLVED 4/6

R3-C5 P3:
RESOLVED

SOURCE_KEY_R3:
PASS

SOURCE_KEY 362-BYTE LIMIT:
PASS

R6 BYTES 512 LIMIT:
PASS

SELECTION PROVENANCE:
FAIL

CANDIDATE BINDING:
FAIL

PARAMETER PROVENANCE:
FAIL

PRICE PROVENANCE:
FAIL

RULESET BASIS BINDING:
PASS

SK-R2 / REGISTRY CODE 3:
PASS

SNAPSHOT-R3:
FAIL

REGISTRY / SCHEMA / BASIS:
FAIL

C6-SNAP-01:
PASS

Node/Python Full Bytes:
IDENTICAL

R6 Scalar Validation:
PASS

TrustedSession:
FAIL

Session Expiry / Revocation:
FAIL

Old Connection Protection:
FAIL

PolicyRevision:
FAIL

PolicyReviewEvent:
FAIL

Policy Author / Approver Separation:
PASS

Deferred Validation:
FAIL

PostgreSQL Owner / Role / Privilege:
FAIL

Warning Identity / Ordering:
PASS

Python Cache Baseline Exception:
ACCEPT

Existing Open Decisions:
46 PRESENT / 46 OPEN

R3-C6 Open Decisions:
5 PRESENT / 5 OPEN

IMPLEMENTATION AUTHORIZATION: NOT GRANTED
SCHEMA: NOT AUTHORIZED
MIGRATION: NOT AUTHORIZED
DATABASE: NOT ACCESSED
STORAGE: NOT ACCESSED
RUNTIME: NOT EXECUTED
PRODUCTION: NOT AUTHORIZED
GIT WRITES: NONE
```

