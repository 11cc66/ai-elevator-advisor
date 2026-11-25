# FULL-MVP-REMEDIATION-REVIEW-R3-C8-CORRECTIONS-R4

Date: 2026-11-25
Review type: independent, read-only, adversarial design review.

## Overall

```text
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
P0: 0
P1: 0
P2: 4
P3: 1
```

The original R3 expiry rollback, denied/locked next-Attempt block and Candidate
nullable defects are materially corrected. The package is not ready for an
implementation-readiness gate because:

- Execute does not revalidate the current ROTATION Root Session/Grant/Principal/
  Epoch after Begin and approval;
- an expired PENDING/APPROVED Attempt still blocks a new Begin until an old
  request happens to trigger LOCKED;
- the sealed/finalized Candidate backfill changes immutable rows without a
  durable per-row audit/evidence trail;
- the Validator misses both state defects and its response-loss Attempt vector
  compares `None` with `None`.

## Scope and Method

Reviewed:

- all 25 Manifest-covered R4 files;
- Complete DDL, Final-State Overlay and Function Registry;
- the submitted Validator and mutation definitions;
- all 18 R3 independent review files;
- the R3 original review findings and R2 original Finding definitions;
- all 57 Open Decision IDs.

Methods:

- independent Manifest and key-hash verification;
- final-definition resolution by function signature;
- independent table, FK, Trigger, function, role and effective-grant parsing;
- transaction/state-machine reasoning;
- 29 R3 formal, 12 R2 historical and 46 R4 submitted Mutation replay in
  isolated temporary copies;
- 22 independent negative rule checks;
- check of Candidate digest relationships and Trigger ordering.

No SQL or database operation was performed.

## Skills Applied

The complete bodies and referenced checklists were read for:

- `$project-architecture`;
- `$prisma-db-safety`;
- `$security-audit`;
- `$testing-and-verification`;
- `$file-lifecycle`.

They were used for module/data boundaries, transaction and constraint proof,
adversarial authorization analysis, verification separation and fail-closed
lifecycle constraints.

## Input Integrity

```text
R4 Manifest:
BAB1129478D70E3CD21B6C2D60B338525CE7E18660ABE26D69BBE540409AB377

Records:                    25
Unique paths:               25
Actual files excluding Manifest: 25
Coverage differences:        0
Manifest/byte/line/hash errors: 0
```

Key hashes match the authorization:

```text
Complete DDL:
F4DA543931B69F67DEB6672B41F968FCF24E1D8E025B367E5282B4AF44711B2F

Overlay:
87A3814632B59FBD6614CCA31E6A388FE3FDEDD0D695611FC04B1E39C4664552

Registry:
C0FD9D353F5E82D937E587A81106652B3A66DC47256B777BD8CE2DF430F86EA3

Validation Evidence:
B1AB36A2CFB92E286AAA78F43F036B643257978B2F2112ACAF807360FAEBDA0E
```

R3 Review Manifest and main report also match their authorized hashes.

## Independent Object Results

```text
Tables:                         73
Foreign-key declarations:      124
Final function signatures:     161
Triggers:                      174
Roles:                          26
Effective grant signatures:     42

FK structural errors:            0
Trigger target/function errors:  0
Complete DDL exact R3+Overlay:  PASS
Registry/DDL/ACL agreement:     PASS
```

The parser verifies source columns, exact target key sets, Trigger target tables
and function names. It cannot prove PostgreSQL type resolution, Catalog
locking, or Trigger execution.

## Original R3 Finding Status

| Finding | Independent status | Basis |
|---|---|---|
| `REV-R3-R3-P2-01` | `RESOLVED — INDEPENDENT STATIC REVIEW` | Expiry state/Event/Ledger writes now share a normal-return transaction; no update-then-RAISE path remains in the final caller |
| `REV-R3-R3-P2-02` | `RESOLVED — INDEPENDENT STATIC REVIEW` | DENIED/LOCKED Attempt history is terminal, Sequence is atomic, and PENDING/APPROVED is partially unique |
| `REV-R3-R3-P2-03` | `PARTIALLY RESOLVED` | 29/29, 12/12 and 46/46 reproduce, but important R4 state rules are absent and one response-loss vector is vacuous |
| `REV-R3-R3-P3-01` | `RESOLVED — INDEPENDENT STATIC REVIEW` | Both Candidate columns have real NOT NULL constraints and exact composite FKs |

## Findings

### P2-01 — ROTATION Execute Does Not Recheck Current Root Authority

`bootstrap_begin_root_change_r4` verifies Root Session, Grant, Principal and
Epoch at lines 15922-15951. Those checks are absent from
`bootstrap_execute_root_change_r4` after it locks Lifecycle at lines
16109-16122 and before it mutates approvals/operators/Generation at line 16170.

If the Root Session or Grant expires or is revoked after approval but before
Execute, a `ROTATION` still proceeds. The authorization explicitly requires
Execute to recheck current Root state. This is a P2 state-machine/authorization
semantic defect.

Minimum correction: make the current Root Session/Grant/Principal/Epoch check
part of Execute for `kind='ROTATION'`, under appropriate locks, before any
Generation or operator mutation.

### P2-02 — Expired Active Attempt Blocks Immediate Next Recovery

`bootstrap_begin_root_change_r4` checks for any PENDING/APPROVED Attempt and
raises without evaluating `approval_expires_at` at lines 15985-15992.

Consequently:

```text
A1 = PENDING/APPROVED, expiry already passed
no old Approve/Execute request has yet transitioned A1 to LOCKED
new Begin(A2) -> "active recovery attempt already exists"
```

The user cannot immediately start the next ordered Recovery merely because
time has expired. It requires an unrelated old request or Deny call to perform
the state transition first. This contradicts the required expired-approval
recovery flow.

Minimum correction: Begin must atomically recognize an expired active Attempt,
transition it to LOCKED (with Event/Ledger policy), then allocate the next
Attempt, or the design must provide an explicit authorized expiry command that
the Begin protocol invokes.

### P2-03 — Sealed Candidate Backfill Has No Durable Audit Trail

The migration changes sealed/finalized rows at Overlay lines 15568-15612.
The narrow Trigger exception and table locks are present, but the backfill uses
plain UPDATE statements without:

- `RETURNING` into durable migration evidence;
- a per-row before/after record;
- an Audit Event;
- an evidence object/hash; or
- an affected-row count attestation.

The Candidate value is constrained by the composite FK and digest-derived
selection identity, so no wrong Candidate bypass was found. However, a future
operator cannot independently establish which immutable rows changed or what
their pre-migration NULL state was. This violates the required auditability of
the sealed-data exception.

Minimum correction: capture every updated key and authoritative source into an
append-only migration evidence structure in the same transaction, validate its
count against `ROW_COUNT`, and include it in the eventual migration evidence.

### P2-04 — Validator Semantic Coverage Remains Partial

The submitted 29/29, 12/12 and 46/46 results are mechanically reproducible,
but the independent 22-rule suite detects four misses:

```text
IND-MUT-10: ROTATION Execute current Root recheck
IND-MUT-20: expired active Attempt replacement
IND-MUT-21: Candidate backfill audit evidence
IND-MUT-22: concrete response-loss replay result
```

The `response_loss_replay` vector in `tools/validate_r4.py` lines 668-678
records `before=None`, `replay=None`, then passes because both are equal. This
does not prove a durable-answer replay.

Minimum correction: add target-specific checks/mutations for the missing rules,
replace declarative transaction records with an independently evaluated state
model, and require a non-NULL durable replay result.

### P3-01 — Traceability Document Drift

`R4_FINDING_TRACEABILITY.md`:

- lists Candidate evidence only through `R4-CAND-09`, while R4 defines 11;
- uses `R4-DESIGN-P3-01` twice for different findings;
- lists R3 P2-01 evidence through `R4-TX-08`, omitting `R4-TX-09`.

This does not change executable DDL, but the traceability record is ambiguous.

## Positive Independent Results

- Expiry LOCKED path is no longer rolled back by a subsequent raise.
- Approve and Execute complete their own Ledger operations.
- Sequence allocator is a single atomic PostgreSQL upsert path.
- Old one-per-Generation unique is dropped; active Attempt partial unique is
  exact for PENDING/APPROVED.
- Historical terminal Attempts remain outside the active predicate.
- Sequence table has only the needed `SELECT/INSERT/UPDATE` privilege for the
  review Function Owner and no PUBLIC grant.
- Final capability grant set equals the frozen R3 set with the four unsafe
  Recovery entries replaced.
- Execute does not auto-create `trusted_principal` or `principal_epoch`.
- Candidate columns are NOT NULL and their composite FKs are structurally
  valid.
- Candidate backfill source joins are exact and source tables are frozen with
  `SHARE ROW EXCLUSIVE`.
- Candidate-only update exception preserves all other JSONB fields.
- Snapshot digest verification remains active.

## Validation Boundaries

```text
Static Structural Review: COMPLETED
PostgreSQL Grammar: NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER
PostgreSQL Compilation: NOT VERIFIED — DATABASE NOT AUTHORIZED
Catalog Introspection: NOT VERIFIED — DATABASE NOT AUTHORIZED
Constraint/Trigger Runtime: NOT VERIFIED — DATABASE NOT AUTHORIZED
Migration Lock Behavior: NOT VERIFIED — DATABASE NOT AUTHORIZED
Runtime Concurrency: NOT VERIFIED — RUNTIME NOT AUTHORIZED
Database: NOT ACCESSED
Storage: NOT ACCESSED
Runtime: NOT EXECUTED
Production: NOT AUTHORIZED
Git Writes: NONE
```

## Decision

`FAIL — DESIGN CORRECTIONS REQUIRED`

Only separately authorized R4 design corrections may follow. This review does
not authorize implementation, SQL, Migration, Build, Runtime, Storage or
deployment.
