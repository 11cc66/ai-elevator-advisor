# R4 Finding Traceability

All statuses below mean `RESOLVED — DESIGN`. They do not assert PostgreSQL
compilation, Catalog ACL or Runtime concurrency.

## REV-R3-R3-P2-01

| Item | Evidence |
|---|---|
| Original report | `INDEPENDENT_REVIEW_R3_C8_CORRECTIONS_R3.md` lines 81-86 |
| Original defect | Persist LOCKED then throw and roll it back |
| R4 correction | Committing helper plus caller-owned structured Ledger completion |
| Actual objects | `lock_expired_root_change_r4`, Approve R4, Execute R4 |
| Complete DDL | lines 15723, 15760, 16054 |
| Negative evidence | `R4-TX-01` through `R4-TX-08` |
| Status | `RESOLVED — DESIGN` |

## REV-R3-R3-P2-02

| Item | Evidence |
|---|---|
| Original report | `INDEPENDENT_REVIEW_R3_C8_CORRECTIONS_R3.md` lines 87-93 |
| Original defect | One recovery per Generation blocks a later Attempt |
| R4 correction | Terminal-preserving Attempt history, monotonic sequence, partial active uniqueness |
| Actual objects | Recovery R4 columns, sequence table, partial unique index, Begin R4 |
| Complete DDL | lines 15628, 15673, 15693, 15697, 15855 |
| Negative evidence | `R4-ATT-01` through `R4-ATT-10` |
| Status | `RESOLVED — DESIGN` |

## REV-R3-R3-P2-03

| Item | Evidence |
|---|---|
| Original report | `INDEPENDENT_REVIEW_R3_C8_CORRECTIONS_R3.md` lines 94-99 |
| Original defect | Validator detects markers but not transaction/Attempt semantics |
| R4 correction | Final-definition parser, semantic checks, transaction model, Attempt model, 46 R4 mutations |
| Actual object | `tools/validate_r4.py`, semantic checks at line 224 |
| Evidence | `VALIDATION_EVIDENCE_R4.json` |
| Status | `RESOLVED — DESIGN` |

## REV-R3-R3-P3-01

| Item | Evidence |
|---|---|
| Original report | `INDEPENDENT_REVIEW_R3_C8_CORRECTIONS_R3.md` lines 100-105 |
| Original defect | Two ProfessionalReview `candidate_id` columns are nullable |
| R4 correction | Exact backfill, fail-closed unresolved preflight, two NOT NULL constraints |
| Complete DDL | lines 15470, 15603, 15610, 15612 |
| Negative evidence | `R4-CAND-01` through `R4-CAND-09` |
| Status | `RESOLVED — DESIGN` |

## Additional R4 Review Findings Discovered During Design

### R4-DESIGN-P2-01 — Expiry Ledger Operation Mismatch

The first draft helper completed
`BOOTSTRAP_LOCK_EXPIRED_ATTEMPT`, while Approve/Execute had claimed different
operation names. This would fail to complete either original request.

Correction: the helper no longer completes Ledger rows; each caller completes
its own operation. Covered by `R4-TX-05`.

### R4-DESIGN-P2-02 — Final ACL Could Omit Approved Capabilities

Final PUBLIC revoke does not revoke role grants, but relying on earlier source
ordering and omitting the root completion grant from the final closure was not
an auditable final-state contract.

Correction: the final phase reasserts the complete approved capability map and
the Validator compares it with the frozen R3 map minus the four unsafe Recovery
entries. Covered by `R4-ACL-01` through `R4-ACL-03`.

### R4-DESIGN-P2-03 — New Sequence Table Missed Function-Owner DML

The new sequence table is created after the earlier all-table privilege grant.
Its table owner does not automatically grant DML to the separate SECURITY
DEFINER owner.

Correction: grant only `SELECT/INSERT/UPDATE` on that exact table to
`elevator_review_function_owner`, revoke PUBLIC table access, and cover the
missing grant with `R4-ACL-04`.

### R4-DESIGN-P2-04 — Sealed Candidate Backfill Was Blocked

The existing sealed/finalized guards reject direct UPDATEs. Disabling those
Triggers would violate the safety boundary.

Correction: replace them in-place with a helper that permits only a
NULL-to-value `candidate_id` change while every other row field remains
identical. The helper is owned by the Trigger Owner before backfill, and the
composite FKs remain authoritative. Covered by `R4-CAND-07` through
`R4-CAND-10`.

### R4-DESIGN-P2-05 — Recovery Identity Checks Were Incomplete

The first R4 Begin/Execute rewrite omitted R3's active-root rotation check and
did not require fresh/active target identity, ACTIVE operators, or strict
backend identity.

Correction: restore those checks, require pre-provisioned Active target
Principal with Epoch 1, recheck both approval Operators and Principals under
lock, and prohibit Execute-side Principal/Epoch provisioning. Covered by
`R4-REC-01` through `R4-REC-12`.

### R4-DESIGN-P3-01 — Expiry Event Actor Pair

System expiry originally combined the current caller role with the Attempt
Initiator Principal.

Correction: Event role and Principal both come from the immutable Attempt
Initiator pair. Covered by `R4-TX-09`.

### R4-DESIGN-P3-01 — Legacy Attempt Backfill

Adding NOT NULL `attempt_sequence` directly would fail on existing rows.

Correction: deterministic row-number backfill precedes NOT NULL and uniqueness.
No sequence gap or caller input is introduced.

## Boundaries

No original P1 is reopened. No new P0/P1 is claimed closed at Runtime.
The following remain outside this design proof:

- PostgreSQL 18 parsing/compilation;
- actual FK, CHECK, partial-index and Trigger behavior;
- lock and deadlock behavior;
- Catalog ACL and Owner state;
- migration duration/locks on real data;
- interactive concurrency.
