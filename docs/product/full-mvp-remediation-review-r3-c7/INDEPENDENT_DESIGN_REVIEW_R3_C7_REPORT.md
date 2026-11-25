# FULL-MVP-REMEDIATION-REVIEW-R3-C7

Date: 2026-11-24

Review mode: independent, read-only, adversarial.

## 1. Overall Result

```text
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
P0: 0
P1: 6
P2: 6
P3: 1
```

The design materially improves R3-C6 and reproduces both the Node/Python and
independent C6 Basis results. It is not ready for implementation authorization
because core Snapshot provenance remains partially constrained, TrustedSession
still accepts role-level/shared credentials, and the DDL privilege graph does
not grant the SECURITY DEFINER/broker identities the object access they need.

## 2. Shell and Inputs

```text
PowerShell: 7.6.9
FileVersion: 7.6.9.500
Executable:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
PID: 25976
Parent PID: 27624
Parent: codex.exe
```

R3-C7 manifest:

```text
SHA-256: 160A2BB8F93F473063225A2DBE04C8F807E456E1B50C4DF0D82B861B84BF3094
Bytes: 10482
Lines: 64
Records: 64
Unique paths: 64
Hash/byte/line mismatches: 0
Coverage differences: 0
```

The R3-C6 review and C6 design manifests still match:

```text
R3-C6 review: CF8AD3D51551ED1F675744B829DA52A00EE39410478878F2D67BF15BAD436B41
R3-C6 design: 905D062BC424BF8B76AFAA4D8D078474528FB609817E635604FD31CC77D0DBFC
```

## 3. Independent Evidence

### C6-SNAP-01

An independent implementation, without importing R3-C7 tools, reconstructed:

```text
Records: 15
Record types: 0,1,1,2,2,3,3,4,4,5,5,6,7,8,9
Bytes: 4036
SHA-256: 7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
HEX match: true
Result: PASS
```

### Offline scalar/resource checks

```text
Scalar/source-aux vectors: 23/23 PASS
Basis resource vectors: 14/14 PASS
SourceKey boundary sample: Node/Python/independent semantics agree
```

### DDL static audit

```text
Tables: 46
Views: 8
Functions in DDL: 44
Functions in Registry: 44
Signature set match: PASS
Triggered Snapshot table set: PASS
```

The static audit also found the P1/P2 issues in the Findings document.
PostgreSQL did not compile the SQL and no Catalog introspection was performed.

## 4. Major Positive Results

- The C6 4036-byte Basis is reproducible independently.
- SourceKey 362/BYTES 512 bounds and the 14 resource boundary vectors are
  coherent in the offline paths.
- Function definition signatures and JSON Registry match.
- Snapshot Header and children have row DELETE/UPDATE guards plus exact
  constraint-trigger coverage.
- Policy content digest is computed inside the database; caller digest is gone.
- Policy Event append-only and TRUNCATE protections are present.
- Idempotent Policy/ProfessionalReview transition lookup now precedes stale
  sequence checks.
- Session/Epoch/Grant/business row lock ordering is materially improved.

## 5. Blocking Findings

1. Snapshot Candidate provenance uses only a 3-column result FK; Product,
   Specification, RuleSet and status content are not bound.
2. Requirement/source/review/warning/missing rows are key-only and final
   validation does not check their sealed population/content completeness.
3. A shared/generic login role is accepted as a TrustedSession role; copied
   role credentials are not backend-bound.
4. SECURITY DEFINER owner and broker roles lack schema/table privileges needed
   to execute controlled functions.
5. There is no controlled path to create SelectionRun/result rows or a
   ProfessionalReview initial event; direct DML is denied.
6. `trusted_session_status_v` is not caller-bound and can return all sessions
   with any `SESSION_AUDIT` grant.

Detailed requirements and acceptance criteria are in
`INDEPENDENT_REVIEW_R3_C7_FINDINGS.md`.

## 6. Historical Status

```text
R3-C4 historical findings:
RESOLVED 7/11
PARTIAL 1/11
NOT RESOLVED 3/11

R3-C5 unresolved findings:
FULLY RESOLVED 1/5
PARTIAL 2/5
NOT RESOLVED 2/5

R3-C6 P1:
FULLY RESOLVED 3/4
NOT RESOLVED 1/4

R3-C6 P2:
FULLY RESOLVED 5/6
PARTIAL 1/6
```

These counts are defined in `HISTORICAL_FINDING_CLOSURE_MATRIX_R3_C7.md`.

## 7. Open Decisions

```text
Prior Open Decisions: 51 PRESENT / 51 OPEN
R3-C7 Open Decisions:  6 PRESENT / 6 OPEN
Total:                57 PRESENT / 57 OPEN
Approvals added:        0
```

## 8. Boundaries

```text
PostgreSQL compilation: NOT VERIFIED — DATABASE NOT AUTHORIZED
Catalog introspection:   NOT VERIFIED — DATABASE NOT AUTHORIZED
Runtime concurrency:     NOT VERIFIED — DATABASE NOT AUTHORIZED
Storage access:          NOT ACCESSED
Build/product tests:     NOT EXECUTED
Native RPC/Runtime:      NOT EXECUTED
Production:             NOT AUTHORIZED
Git writes:             NONE
```

No remediation, R3-C8, Schema, Migration, implementation or Runtime is
authorized by this review.
