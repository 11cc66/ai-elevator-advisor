# FULL-MVP-REMEDIATION-REVIEW-R3-C8-CORRECTIONS-R2

Date: 2026-11-24

Review type: independent, read-only, adversarial design review.

## Overall

```text
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
P0: 0
P1: 3
P2: 6
P3: 2
```

The R2 package improves the root Principal equality, Source-Target binding
model, owner Catalog scans, Request termination classification and shared
FieldValue validation. It is not ready for the next gate because:

- Bootstrap recovery contains invalid and mutable-lifecycle foreign keys that
  prevent rotation from compiling or committing;
- two Catalog binding foreign keys do not reference valid unique target keys;
- new SECURITY DEFINER helper functions are not explicitly revoked from PUBLIC
  after definition, and three mutable helpers have no caller identity check;
- recovery and Request Ledger state checks precede replay detection, so lost
  responses are not idempotent;
- Owner Closure claims a transaction advisory lock that is not present;
- the submitted Validator returns PASS despite those structural issues.

## Scope and Method

Reviewed:

- all 34 files in the input directory, including all 33 Manifest records;
- complete DDL and final-state Overlay;
- Function Signature Registry;
- all R2 tools and evidence;
- historical C8, Corrections R1, C7, C6 and fixed vectors;
- the 57 Open Decisions.

Methods:

- independent Manifest and key-hash verification;
- balanced table-block extraction;
- independent FK source/target column and unique-key analysis;
- independent function/Registry signature and owner comparison;
- Trigger-to-function existence and creation-order checks;
- static call-chain/state-review;
- independent replay of the submitted 12 textual mutations;
- independent C6-SNAP-01 reconstruction.

No input file was modified.

## Input Integrity

```text
R2 Manifest SHA-256:
45331850C8DB01CC4AE1DC58825AFFB9E5187259CD28F0B68D6BE32F9F6422E8

Records: 33
Unique paths: 33
Actual files including manifest: 34
Hash/byte/line mismatches: 0
Coverage differences: 0
Covered bytes: 935,143
Covered lines: 22,906
```

Key hashes match:

```text
Main design:
82D1E0977AF8F9BDE7EF09F28B3B856E9850A1D87EA27EEDBE62E441258CCB2B

Complete DDL:
BC626FA93A13D9D2096B3213554AA1C6FFF256D9B66929AC0018BD7D62597E1D

Overlay:
A2A8E061F54041431C379E41A9CF7B8232EE7F70F52BF3E7BEEEAA447614FA9C

Function Registry:
1DB91C894349FACFE134A1D4237E58048D6A3337F8C0CBED3F96AE61AAADC8F0
```

Historical input manifests also match:

```text
C8 design:
672D6206D06E4282F7C8684A3811654EEDDA72E52C55B6EDF2C324B5C131E853

C8 review:
2E895560FB3EDEEE938395E2626D0ECBE4939EA18D4A4A573FE159960E1BE611

Corrections R1 design:
0ACBBB3A4CB5F0439302E7F7109F0ECFDCFDE50843D74941E232F830ECE552A2

Corrections R1 review:
E71FA990581B70357F3D4103C1BF29E442665DD695459C524CC723D41DA63465

C7 design:
160A2BB8F93F473063225A2DBE04C8F807E456E1B50C4DF0D82B861B84BF3094

C7 review:
5254758B8B47AEBB8E591CBB380F371398EE59035D48D239D02331E09FFCC118
```

## Skills Applied

The complete Skill bodies and references were read:

- `$project-architecture`;
- `$prisma-db-safety`;
- `$security-audit`;
- `$testing-and-verification`;
- `$file-lifecycle`.

They were used for module/data ownership, composite constraints and role
semantics, adversarial caller reasoning, evidence separation and fail-closed
file/Storage boundaries.

## Independent Object Results

```text
Tables:                    71
FK declarations:          119
Final functions:          145
Triggers:                 169
Roles:                     26
Registry signatures:      145
Registry extra/missing:   0 / 0
Registry owner mismatch:  0
Registry return mismatch: 0
Registry security mismatch: 0
Invalid Trigger targets:  0
```

Those matching counts do not close the design. Independent structural checks
found five FK errors:

1. Binding to `catalog_source_revision`: target columns are not an exact
   UNIQUE/PK key.
2. Event to Binding: target columns are not an exact UNIQUE/PK key.
3. `selection_professional_review_result` FK references missing source column
   `candidate_id`.
4. `sales_snapshot_professional_review_r3` FK references missing source column
   `candidate_id`.
5. Bootstrap Root Session FK references missing source column `root_session_id`
   instead of actual `session_id`.

The first, second and fifth directly invalidate the R2 Catalog/Bootstrap
changes. The third and fourth remain historical structural defects in the
frozen DDL.

## P1 Findings

### P1-01 — Bootstrap Recovery DDL cannot compile/commit

Evidence:

- Overlay lines 350-369 define `session_id`, but lines 423-431 create an FK using
  nonexistent source column `root_session_id`.
- Approval and historical Root Session rows reference mutable
  `bootstrap_lifecycle_r2`.
- Rotation inserts new-Generation approvals before moving Lifecycle.
- Rotation updates State Generation before Lifecycle, while the separating FK
  is immediate.

### P1-02 — Catalog Binding foreign keys have no valid unique targets

Evidence:

- Overlay lines 1604-1607 reference only three Source columns, but the Source
  table's unique key contains five columns.
- Overlay lines 1828-1839 reference 12 Binding columns, while the Binding unique
  key contains 14 columns.

### P1-03 — New SECURITY DEFINER helpers are not explicitly PUBLIC-safe

Evidence:

- R2 functions are created after the frozen DDL's blanket revoke.
- The R2 block revokes PUBLIC from only three functions.
- `claim_bootstrap_request_r2`, `complete_bootstrap_request_r2` and
  `append_bootstrap_event_r2` have no caller identity guard.
- No final all-functions `REVOKE ... FROM PUBLIC` is present.

## P2 Findings

- Result recovery permits multiple recovery records for one request.
- Result recovery approval/execution is not idempotent after lost response.
- Bootstrap begin/approval/execute sequence checks order prevents replay and
  there is no recovery path from a failed new root issuance.
- Owner Closure documentation claims an advisory lock that is absent from SQL.
- Root completion does not verify `trusted_principal.state='ACTIVE'`.
- Catalog Binding creator Grant is not tied to Session/Principal by a composite
  FK.
- The submitted Validator misses all above structural/security issues.

Detailed counterexamples and required corrections are in
`REVIEW_FINDINGS_AND_REQUIRED_CORRECTIONS.md`.

## P3 Findings

- Lifecycle/Root Session timestamp-state consistency constraints are incomplete.
- Guard evidence proves launch identity but not child/tool success; it records no
  exit code or finish time.

## Positive Independent Results

- All input and historical hashes match.
- C6-SNAP-01 independently reconstructs to 15 records, 4036 bytes and
  `7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB`.
- R6 evidence remains 23/23 scalar and 14/14 resource vectors.
- Function Registry and DDL signature/owner/return/security sets match.
- Trigger targets exist and are defined before creation.
- FieldValue domain design is statically consistent across Requirement,
  Selection and Snapshot; execution is unverified.
- All submitted 12 textual mutations are reproducible, but their coverage is
  incomplete and they cannot establish structural correctness.

## Historical Closure

```text
R3-C8 Corrections R1 P1:
RESOLVED STATIC: 1/3
PARTIALLY RESOLVED: 1/3
NOT RESOLVED: 1/3

R3-C8 Corrections R1 P2:
RESOLVED STATIC: 0/3
PARTIALLY RESOLVED: 1/3
NOT RESOLVED: 2/3

R3-C8 Corrections R1 P3:
RESOLVED STATIC: 1/2
PARTIALLY RESOLVED: 1/2
NOT RESOLVED: 0/2

R3-C8 original:
P1: 1 RESOLVED STATIC, 2 PARTIAL, 1 NOT RESOLVED
P2: 2 RESOLVED STATIC, 1 PARTIAL, 1 NOT RESOLVED
P3: 2 RESOLVED STATIC, 1 PARTIAL, 0 NOT RESOLVED

R3-C7:
7 RESOLVED STATIC, 4 PARTIAL, 2 NOT RESOLVED
```

No historical P1 is promoted to independent PASS.

## Open Decisions

```text
Original IDs: 57
Present and unique: 57/57
Approved by User: 0
Still OPEN: 57
```

The R2 documents preserve the IDs and do not silently approve business or
operational decisions. Root approval ownership, credential custody, recovery
authority, role provisioning, break-glass and production topology remain OPEN
and implementation-blocking.

## Verification Boundaries

```text
PostgreSQL Grammar:
NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL Compilation:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Catalog Introspection:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Runtime Concurrency:
NOT VERIFIED — RUNTIME NOT AUTHORIZED

Database:
NOT ACCESSED

Storage:
NOT ACCESSED

Runtime:
NOT EXECUTED

Production:
NOT AUTHORIZED

Git Writes:
NONE
```

The FK errors above are static structural findings. A real PostgreSQL migration
is still required to confirm final SQLSTATE, Catalog outcome and trigger order.

## Final Decision

`FAIL — DESIGN CORRECTIONS REQUIRED`

Next stage may only be separately authorized R3-C8 Corrections R3 design
correction. No implementation, Schema, Prisma, Migration, SQL execution or
Runtime is authorized.
